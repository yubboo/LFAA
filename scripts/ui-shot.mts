// UI 截图工具：起生产宿主 → 无头 Edge/Chrome 按任务表逐项操作 → 出图到 shots/ 并写 manifest.json。
// 用于「改完界面先看图再评价」：`pnpm ui:shot`、`pnpm ui:shot --list`、`pnpm ui:shot --only=settings`。
// 截图目录不入库（.gitignore 已忽略 shots/）；没有可用浏览器时跳过并以 0 退出。
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "playwright-core";
import { startHostServer } from "@lfaa/web-server";
import { TASKS, applySteps, type ShotTask } from "./ui-shot-tasks.ts";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const WEB_DIST = join(REPO_ROOT, "apps", "web", "dist");
const OUT_DIR = join(REPO_ROOT, "shots");
const DEFAULT_VIEWPORT = { width: 1440, height: 900 };
const DEFAULT_BOOT_MS = 3200;

/** 解析 `--flag=value` 形式的参数。 */
function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

/** 本机 Edge/Chrome 候选；都没有时返回 null（截图跳过）。 */
function findBrowserExecutable(): string | null {
  const candidates = [
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/usr/bin/microsoft-edge",
    "/usr/bin/google-chrome",
  ];
  return candidates.find((path) => existsSync(path)) ?? null;
}

/** 缺少构建产物或显式要求时先构建 Web。 */
function ensureWebBuild(force: boolean): void {
  if (!force && existsSync(join(WEB_DIST, "index.html"))) return;
  console.log("未找到 Web 产物或指定了 --build，先执行 pnpm build:web …");
  const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const result = spawnSync(command, ["run", "build:web"], { cwd: REPO_ROOT, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) {
    console.error("Web 构建失败，截图中止。");
    process.exit(1);
  }
}

/** 按 --only / --group 过滤任务；--only 支持逗号或空格分隔的子串匹配（pnpm 会把逗号拆开）。 */
function selectTasks(): ShotTask[] {
  const only = (argValue("only") ?? "").split(/[,\s]+/u).map((item) => item.trim()).filter(Boolean);
  const group = argValue("group");
  return TASKS.filter((task) => {
    if (group && task.group !== group) return false;
    if (only.length === 0) return true;
    return only.some((needle) => task.name.includes(needle) || task.group === needle);
  });
}

/** 打印任务清单，供 --list 使用。 */
function printList(): void {
  const groups = new Map<string, ShotTask[]>();
  for (const task of TASKS) {
    if (!groups.has(task.group)) groups.set(task.group, []);
    groups.get(task.group)?.push(task);
  }
  for (const [group, list] of groups) {
    console.log(`\n[${group}] ${list.length} 项`);
    for (const task of list) {
      const size = `${task.width ?? DEFAULT_VIEWPORT.width}×${task.height ?? DEFAULT_VIEWPORT.height}`;
      const theme = task.theme ?? "system";
      console.log(`  ${task.name.padEnd(26)} ${size} ${theme.padEnd(6)} ${task.description}`);
    }
  }
  console.log("\n用法：pnpm ui:shot --only=settings   /   --group=app   /   --theme=light   /   --list");
}

const browserPath = findBrowserExecutable();
if (process.argv.includes("--list")) {
  printList();
  process.exit(0);
}
if (!browserPath) {
  console.log("未检测到本机 Edge/Chrome，跳过截图。");
  process.exit(0);
}

const tasks = selectTasks();
if (tasks.length === 0) {
  console.error("没有匹配的任务；用 pnpm ui:shot --list 查看可用名称。");
  process.exit(1);
}

const forcedTheme = argValue("theme");
const bootMs = Number(argValue("boot") ?? DEFAULT_BOOT_MS);
const externalUrl = argValue("url");
if (!externalUrl) ensureWebBuild(process.argv.includes("--build"));
mkdirSync(OUT_DIR, { recursive: true });

/** 静态服务的启动器；用已有 --url 时为空。 */
const server = externalUrl ? null : await startHostServer({ webRoot: WEB_DIST, projectRoot: REPO_ROOT, port: 0 });
const baseUrl = externalUrl ?? server?.url ?? "";
let browser: Browser | undefined;
const results: Array<Record<string, unknown>> = [];

try {
  browser = await chromium.launch({ executablePath: browserPath, headless: true });

  for (const task of tasks) {
    const theme = forcedTheme ?? task.theme;
    const viewport = { width: task.width ?? DEFAULT_VIEWPORT.width, height: task.height ?? DEFAULT_VIEWPORT.height };
    const context = await browser.newContext({ viewport });
    if (theme) {
      // 在应用脚本之前写入主题偏好，首帧就是目标主题（外观配置存在时同步改 mode）。
      await context.addInitScript((mode: string) => {
        localStorage.setItem("lfaa:appearance-mode", mode);
        const raw = localStorage.getItem("lfaa:appearance-config-v1");
        if (!raw) return;
        try {
          const config = JSON.parse(raw) as Record<string, unknown>;
          config.mode = mode;
          localStorage.setItem("lfaa:appearance-config-v1", JSON.stringify(config));
        } catch {
          // 偏好损坏时保持原样，截图仍然可用。
        }
      }, theme);
    }

    const page = await context.newPage();
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(`PAGEERROR ${error.message}`));

    const started = Date.now();
    let ok = true;
    let failure = "";
    try {
      await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(bootMs);
      await applySteps(page, task.steps);
      await page.waitForTimeout(250);
    } catch (error) {
      ok = false;
      failure = error instanceof Error ? error.message : String(error);
    }

    const file = join("shots", `${task.name}.png`);
    if (ok) await page.screenshot({ path: join(OUT_DIR, `${task.name}.png`) });
    const durationMs = Date.now() - started;
    console.log(`${ok ? "✔" : "✖"} ${task.name.padEnd(26)} ${String(durationMs).padStart(6)}ms  ${ok ? file : failure.slice(0, 120)}`);
    results.push({ name: task.name, group: task.group, description: task.description, theme: theme ?? "system", viewport, ok, file: ok ? file : null, failure, consoleErrors, durationMs });
    await context.close();
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    webDistModifiedAt: externalUrl ? null : statSync(join(WEB_DIST, "index.html")).mtime.toISOString(),
    bootMs,
    tasks: results,
  };
  writeFileSync(join(OUT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const failed = results.filter((item) => item.ok === false);
  const noisy = results.filter((item) => Array.isArray(item.consoleErrors) && (item.consoleErrors as string[]).length > 0);
  console.log(`\n截图 ${results.length - failed.length}/${results.length} 成功 → ${join("shots")}/（manifest.json 已写入）`);
  if (noisy.length > 0) {
    console.log(`控制台有报错的任务 ${noisy.length} 个：`);
    for (const item of noisy) console.log(`  - ${String(item.name)}：${(item.consoleErrors as string[]).slice(0, 2).join(" | ")}`);
  }
  process.exitCode = failed.length > 0 ? 1 : 0;
} finally {
  await browser?.close();
  await server?.stop();
}