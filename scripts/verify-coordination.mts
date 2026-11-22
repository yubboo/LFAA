// 交接条与目标条真实浏览器验收：在隔离 HOME 中启动 Host，创建两个会话并 seed 一条交接，
// 打开接收会话 → 接手 → 目标条出现 → 暂停/恢复自动续跑。控制台错误或步骤失败即退出码 1。
// 只写临时目录，不碰用户真实 ~/.lfaa 与项目仓库。
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const WEB_DIST = join(REPO_ROOT, "apps", "web", "dist");
const HOME_DIR = mkdtempSync(join(tmpdir(), "lfaa-coordination-"));
/** 浏览器仍使用真实用户目录启动：Edge 依赖 USERPROFILE 下的系统路径，改到临时目录会启动失败。 */
const BROWSER_ENV: Record<string, string> = {};
for (const [key, value] of Object.entries(process.env)) {
  if (value !== undefined) BROWSER_ENV[key] = value;
}

// 必须在加载任何 @lfaa 包之前改写 HOME，让会话/目标/交接都落在临时目录。
process.env.USERPROFILE = HOME_DIR;
process.env.HOME = HOME_DIR;

/** 本机 Edge/Chrome；没有时跳过并以 0 退出。 */
function findBrowserExecutable(): string | null {
  const candidates = [
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  ];
  return candidates.find((path) => existsSync(path)) ?? null;
}

/** Web 产物缺失时先构建一次。 */
function ensureWebBuild(): void {
  if (existsSync(join(WEB_DIST, "index.html"))) return;
  const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const result = spawnSync(command, ["run", "build:web"], { cwd: REPO_ROOT, stdio: "inherit", shell: true });
  if (result.status !== 0) throw new Error("Web 构建失败，交接验收中止。");
}

const executablePath = findBrowserExecutable();
if (!executablePath) {
  console.log("未检测到本机 Edge/Chrome，跳过交接验收。");
  process.exit(0);
}
ensureWebBuild();

const { chromium } = await import("playwright-core");
const { startHostServer } = await import("@lfaa/web-server");

const server = await startHostServer({ webRoot: WEB_DIST, projectRoot: REPO_ROOT, port: 0 });
const baseUrl = server.url.replace(/\/+$/u, "");
// Host 只把一次性令牌注入页面 meta；验收脚本从首页取出，再带上 x-lfaa-token 调 API。
const bootHtml = await (await fetch(`${baseUrl}/`)).text();
const token = /<meta name="lfaa-api-token" content="([^"]+)"/u.exec(bootHtml)?.[1];
if (!token) throw new Error("页面未注入本机接口令牌，无法准备验收数据。");
const errors: string[] = [];
let exitCode = 0;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;

/** 带令牌的本地 API 调用：只用于验收准备，不经过页面。 */
async function api(path: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", "x-lfaa-token": token, ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  return (await res.json()) as Record<string, unknown>;
}

try {
  const first = (await api("/api/chat/sessions", { method: "POST", body: JSON.stringify({ title: "会话一" }) })).session as { id: string };
  const second = (await api("/api/chat/sessions", { method: "POST", body: JSON.stringify({ title: "会话二" }) })).session as { id: string };
  mkdirSync(join(HOME_DIR, ".lfaa"), { recursive: true });
  writeFileSync(join(HOME_DIR, ".lfaa", "handoffs.json"), JSON.stringify({
    version: 1,
    handoffs: [{
      id: "handoff-verify",
      projectId: null,
      fromSessionId: first.id,
      toSessionId: second.id,
      title: "接手循环拆分",
      summary: "A1–A4 已完成，剩余 B1",
      nextSteps: ["写回调单测", "跑 verify:web"],
      status: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }],
  }, null, 2), "utf8");

  browser = await chromium.launch({ executablePath, headless: true, env: BROWSER_ENV });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(`PAGEERROR ${error.message}`));
  await page.addInitScript((sessionId) => {
    window.localStorage.setItem("lfaa:active-chat-session-id", sessionId);
  }, second.id);
  await page.goto(`${baseUrl}/?sessionId=${encodeURIComponent(second.id)}`, { waitUntil: "domcontentloaded" });

  const handoffBar = page.getByTestId("handoff-bar");
  await handoffBar.waitFor({ state: "visible", timeout: 20_000 });
  const beforeAccept = (await page.locator("body").innerText()).replace(/\s+/gu, " ");
  if (!beforeAccept.includes("待接手") || !beforeAccept.includes("接手循环拆分")) {
    throw new Error("交接条未显示标题或「待接手」文案。");
  }

  await page.getByRole("button", { name: "接手", exact: true }).click();
  await page.getByTestId("goal-bar").waitFor({ state: "visible", timeout: 20_000 });
  const afterAccept = (await page.locator("body").innerText()).replace(/\s+/gu, " ");
  if (!afterAccept.includes("进行中的目标") || !afterAccept.includes("自动继续 0/10")) {
    throw new Error("接手后目标条未出现或轮次文案不正确。");
  }

  const toggle = page.getByTestId("goal-auto-toggle");
  await toggle.click();
  await page.waitForTimeout(800);
  if (!(await page.locator("body").innerText()).includes("自动继续已暂停")) {
    throw new Error("暂停自动续跑后未显示已暂停文案。");
  }
  await toggle.click();
  await page.waitForTimeout(800);
  if (!(await page.locator("body").innerText()).includes("自动继续 0/10")) {
    throw new Error("恢复自动续跑后未回到轮次文案。");
  }

  if (errors.length > 0) throw new Error(`浏览器控制台出现 ${errors.length} 条错误：${errors[0]}`);
  console.log("交接条与目标条浏览器验收通过。");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  exitCode = 1;
} finally {
  await browser?.close().catch(() => undefined);
  await server.stop().catch(() => undefined);
  rmSync(HOME_DIR, { recursive: true, force: true });
  process.exit(exitCode);
}