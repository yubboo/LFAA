// 生产构建产物浏览器验收：用本机 Edge/Chrome 无头打开工作台，依次检查壳层、资料库、代码审查、
// 设置中心（常规 / Git / 代码审查）、浅色主题与窄屏；出现控制台错误或步骤失败即退出码 1。
// 未检测到浏览器时跳过并以 0 退出，供无浏览器的 CI 使用；Web 产物缺失时自动执行 `pnpm build:web`。
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "playwright-core";
import { startHostServer } from "@lfaa/web-server";

/** 仓库根：本脚本位于 scripts/ 下。 */
const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const WEB_DIST = join(REPO_ROOT, "apps", "web", "dist");
const SHOT_DIR = join(tmpdir(), "lfaa-verify");
const WANT_BUILD = process.argv.includes("--build");

/** 本机 Edge/Chrome 可执行文件候选；没有时返回 null（跳过验收）。 */
function findBrowserExecutable(): string | null {
  const candidates = [
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/usr/bin/microsoft-edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ];
  return candidates.find((path) => existsSync(path)) ?? null;
}

/** Web 产物缺失或显式要求时先构建一次。 */
function ensureWebBuild(): void {
  if (!WANT_BUILD && existsSync(join(WEB_DIST, "index.html"))) return;
  console.log("未找到 Web 产物，先执行 pnpm build:web …");
  const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const result = spawnSync(command, ["run", "build:web"], { cwd: REPO_ROOT, stdio: "inherit", shell: true });
  if (result.status !== 0) {
    console.error("Web 构建失败，验收中止。");
    process.exit(1);
  }
}

interface StepResult {
  step: string;
  ok: boolean;
  screenshot?: string;
}

const executablePath = findBrowserExecutable();
if (!executablePath) {
  console.log("未检测到本机 Edge/Chrome，跳过浏览器验收。");
  process.exit(0);
}

ensureWebBuild();
mkdirSync(SHOT_DIR, { recursive: true });

const server = await startHostServer({ webRoot: WEB_DIST, projectRoot: REPO_ROOT, port: 0 });
let browser: Browser | undefined;
const errors: string[] = [];
const steps: StepResult[] = [];

try {
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(`PAGEERROR ${error.message}`));
  page.on("requestfailed", (request) => errors.push(`REQFAIL ${request.url()}`));

  const text = async (): Promise<string> => (await page.evaluate(() => document.body.innerText)).replace(/\s+/gu, " ");
  const shot = async (name: string): Promise<string> => {
    const path = join(SHOT_DIR, `${name}.png`);
    await page.screenshot({ path });
    return path;
  };

  await page.goto(server.url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  steps.push({ step: "壳层与对话", ok: (await text()).includes("我们从哪里开始") || (await text()).includes("我们要做什么"), screenshot: await shot("home") });

  // Agents 页：左一入口 + 列表渲染 + 内置 agent 与默认绑定。
  await page.locator('button[aria-label="Agents"]').first().click();
  await page.waitForTimeout(2000);
  const agentsText = await text();
  steps.push({
    step: "Agents 页（列表与模型列）",
    ok: agentsText.includes("Agent 与模型") && agentsText.includes("小鱼") && agentsText.includes("默认模型"),
    screenshot: await shot("agents"),
  });
  await page.locator('button[aria-label="首页"]').first().click();
  await page.waitForTimeout(1400);

  // 群聊页：入口、空态与「新建群聊」按钮。
  await page.locator('button[aria-label="群聊"]').first().click();
  await page.waitForTimeout(1800);
  const groupText = await text();
  steps.push({
    step: "群聊页（空态与新建入口）",
    ok: groupText.includes("群聊") && groupText.includes("新建群聊"),
    screenshot: await shot("group"),
  });
  await page.locator('button[aria-label="首页"]').first().click();
  await page.waitForTimeout(1200);

  await page.locator('button[aria-label="资料库"]').first().click();
  await page.waitForTimeout(2000);
  steps.push({ step: "资料库", ok: (await text()).includes("资产与记忆"), screenshot: await shot("library") });

  // 图像分类走 @lfaa/tool-media 的素材网格与缩略图组件，单独点开验证迁移后的渲染。
  const imageTab = page.getByText("图像", { exact: true }).first();
  if ((await imageTab.count()) > 0) {
    await imageTab.click();
    await page.waitForTimeout(1800);
    const imageText = await text();
    const imageCount = await page.locator("img").count();
    steps.push({
      step: "资料库-图像分类（媒体网格）",
      // 空素材库时展示「还没有生成的图片或视频」提示，与 ui-chat locales 的 libraryMediaEmptyHint 保持一致。
      ok: imageText.includes("图像") && (imageCount > 0 || imageText.includes("还没有生成")),
      screenshot: await shot("library-images"),
    });
  } else {
    steps.push({ step: "资料库-图像分类（媒体网格）", ok: false });
  }

  await page.locator('button[aria-label="更多"]').first().click();
  await page.waitForTimeout(600);
  await page.getByText("代码审查", { exact: true }).first().click();
  await page.waitForTimeout(2500);
  steps.push({ step: "代码审查", ok: (await text()).includes("内置 Git 与代码审查"), screenshot: await shot("review") });

  await page.locator('button[aria-label="用户菜单"]').first().click();
  await page.waitForTimeout(600);
  await page.getByText("设置", { exact: true }).first().click();
  await page.waitForTimeout(1200);

  await page.getByRole("button", { name: "常规", exact: true }).first().click();
  await page.waitForTimeout(1200);
  const switchCount = await page.locator('[role="switch"]').count();
  steps.push({
    step: "设置-常规（分组/开关渲染）",
    ok: switchCount > 0,
    screenshot: await shot("settings-general"),
  });

  await page.getByRole("button", { name: "Git", exact: true }).first().click();
  await page.waitForTimeout(1200);
  steps.push({ step: "设置-Git", ok: (await text()).includes("分支前缀"), screenshot: await shot("settings-git") });
  await page.getByRole("button", { name: "MCP", exact: true }).click();
  await page.getByRole("button", { name: "添加服务器", exact: true }).click();
  const mcpDialog = page.getByRole("dialog", { name: "添加服务器" });
  await mcpDialog.getByLabel("传输方式").selectOption("sse");
  steps.push({ step: "设置-MCP", ok: await mcpDialog.getByRole("textbox", { name: "服务 URL" }).isVisible(), screenshot: await shot("settings-mcp") });
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "代码审查", exact: true }).first().click();
  await page.waitForTimeout(1200);
  const reviewSettings = await text();
  steps.push({
    step: "设置-代码审查",
    ok: reviewSettings.includes("审查智能体") || reviewSettings.includes("代码仓库"),
    screenshot: await shot("settings-review"),
  });

  // 设置中心状态记忆：F5 后必须回到同一个设置子页，而不是掉回工作区。
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  const afterReload = await text();
  steps.push({
    step: "设置中心刷新后仍停在代码审查",
    ok: afterReload.includes("审查智能体") || afterReload.includes("代码仓库"),
    screenshot: await shot("settings-after-reload"),
  });

  // 关闭设置弹窗回到背景视图，后续步骤才能继续操作左一栏。
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);
  steps.push({
    step: "Esc 关闭设置中心回到背景视图",
    ok: !(await page.locator('[role="dialog"][aria-modal="true"]').count()),
  });

  // 用用户菜单切换实际主题，避免页面仍挂载时直接改存储导致旧主题被写回。
  const applyTheme = async (mode: "light" | "dark"): Promise<void> => {
    await page.getByRole("button", { name: "用户菜单", exact: true }).click();
    await page.getByRole("button", { name: /^切换外观模式/u }).click();
    await page.getByRole("menuitemradio", { name: mode === "light" ? "浅色模式" : "深色模式" }).click();
    await page.locator(`html[data-resolved-theme="${mode}"]`).waitFor();
    await page.keyboard.press("Escape");
  };
  await applyTheme("light");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  steps.push({
    step: "浅色主题",
    ok: (await page.evaluate(() => document.documentElement.dataset.resolvedTheme)) === "light",
    screenshot: await shot("light"),
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1200);
  steps.push({ step: "窄屏", ok: (await text()).length > 30, screenshot: await shot("mobile") });

  // 窄屏下的 Agents 页：单列布局、编辑卡不溢出。
  await page.locator('button[aria-label="Agents"]').first().click();
  await page.waitForTimeout(1500);
  steps.push({
    step: "窄屏-Agents 页",
    ok: (await text()).includes("Agent 与模型"),
    screenshot: await shot("agents-mobile"),
  });

  // 窄屏群聊页：单列布局，群列表与窗口不溢出。
  await page.locator('button[aria-label="群聊"]').first().click();
  await page.waitForTimeout(1500);
  steps.push({
    step: "窄屏-群聊页",
    ok: (await text()).includes("群聊"),
    screenshot: await shot("group-mobile"),
  });

  // 深色主题再回一次 Agents 页，确认列表、开关与编辑卡在深色下都清晰。
  await page.setViewportSize({ width: 1440, height: 900 });
  await applyTheme("dark");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2600);
  await page.locator('button[aria-label="Agents"]').first().click();
  await page.waitForTimeout(1500);
  // 左二头部现在也显示「小鱼」，点列表行改用行按钮的结构类名，避免点到侧栏标题或时序抖动。
  await page.locator("main").getByText("Agent 与模型").first().waitFor({ timeout: 10000 }).catch(() => {});
  await page.locator('main button[class*="rowMain"]').first().click();
  // 等待编辑卡真正挂载再断言，避免视口切换后的重排把点击挤到渲染之前。
  await page.getByText("人设指令").first().waitFor({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(600);
  steps.push({
    step: "深色-Agents 编辑态",
    ok: (await page.evaluate(() => document.documentElement.dataset.resolvedTheme)) === "dark"
      && (await text()).includes("人设指令"),
    screenshot: await shot("agents-dark"),
  });

  await page.close();
} finally {
  await browser?.close();
  await server.stop();
  writeFileSync(
    join(SHOT_DIR, "report.json"),
    JSON.stringify({ executedAt: new Date().toISOString(), steps, errors }, null, 2),
    "utf8",
  );
}

for (const step of steps) {
  console.log(`${step.ok ? "✔" : "✖"} ${step.step}${step.screenshot ? `  → ${step.screenshot}` : ""}`);
}
if (errors.length > 0) {
  console.error(`控制台错误 ${errors.length} 条：`);
  for (const error of errors.slice(0, 10)) console.error(`  - ${error}`);
}
const ok = steps.every((step) => step.ok) && errors.length === 0;
console.log(ok ? `\n浏览器验收通过（${steps.length}/${steps.length}），截图目录：${SHOT_DIR}` : "\n浏览器验收失败。");
process.exitCode = ok ? 0 : 1;
