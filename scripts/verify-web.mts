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
/** 8×8 PNG：用于在浏览器里合成一次「粘贴图片」，验证输入区缩略图、撤回、放大与右键菜单。 */
const PASTED_IMAGE_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAdklEQVR4nAXBIQEAIQwAQOIQghCEIMTp19PoafQ0mlh/17o3vOktjxdeeuW17g53usvlhptuua2roaZaigqVqlTrznCmsxxOOOmU07occsolyZApS7ZuD3vay2aHnXbZrYshpliCCJGiROu+4Zu+5eMLX/rK9wOBsWLBFtoPwAAAAABJRU5ErkJggg==";

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
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
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
  const homeText = await text();
  steps.push({ step: "壳层与对话", ok: homeText.includes("我们要聊些什么") || homeText.includes("你想让我们构建什么"), screenshot: await shot("home") });

  // 聊天模式：左二栏换成今天 / 昨天 / 最近（7 天内）的时间分组，不再出现置顶与项目分组。
  await page.getByText("聊天", { exact: true }).first().click();
  await page.waitForTimeout(900);
  const chatHeadings = await page.evaluate(() => {
    const nav = document.querySelector('[role="navigation"][aria-label="工作区导航"]');
    return [...(nav?.querySelectorAll("section") ?? [])].map((section) => (
      section.querySelector("button[class*='groupHeadingButton']")?.textContent
      ?? section.querySelector("*[class*='sectionTitle']")?.textContent
      ?? ""
    ).trim());
  });
  const chatHeading = ["今天", "昨天", "最近（7 天内）"];
  steps.push({
    step: "聊天模式左二时间分组",
    // 跨过午夜时「今天」可能没有会话：只要求标题都属于时间分组，且没有项目/置顶。
    ok: chatHeadings.length > 0
      && chatHeadings.every((title) => chatHeading.includes(title))
      && !chatHeadings.includes("项目")
      && !chatHeadings.includes("置顶"),
    screenshot: await shot("chat-mode-groups"),
  });
  await page.getByText("工作", { exact: true }).first().click();
  await page.waitForTimeout(800);

  // 输入区图片：粘贴 → 缩略图 → Ctrl+Z 撤回 → 点击放大 → 右键菜单（复制 / 另存为 / 移除）。
  const chipImage = page.locator('span[data-kind="image"] img');
  const pasteImage = async (): Promise<void> => {
    await page.locator("main textarea").first().click();
    await page.evaluate((base64) => {
      const textarea = document.querySelector("main textarea");
      if (!textarea) throw new Error("composer textarea missing");
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      const data = new DataTransfer();
      data.items.add(new File([bytes], "pasted.png", { type: "image/png" }));
      textarea.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
    }, PASTED_IMAGE_PNG);
    await page.waitForTimeout(900);
  };
  await pasteImage();
  steps.push({ step: "输入区图片粘贴（缩略图）", ok: (await chipImage.count()) === 1, screenshot: await shot("composer-image-chip") });

  await page.locator("main textarea").first().focus();
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(400);
  steps.push({
    step: "输入区图片 Ctrl+Z 撤回",
    ok: (await page.locator('span[data-kind="image"]').count()) === 0,
    screenshot: await shot("composer-image-undo"),
  });

  await pasteImage();
  const thumb = page.locator('span[data-kind="image"] button[class*="attachmentThumb"]').first();
  await thumb.click();
  await page.waitForTimeout(500);
  const preview = page.locator('[data-composer-image-preview="true"]');
  steps.push({ step: "输入区图片点击放大", ok: await preview.isVisible(), screenshot: await shot("composer-image-preview") });

  // 放大层默认约占屏幕七成（不是按原尺寸缩在中间，也不铺满整屏），小图放大时启用像素化渲染保证清晰。
  const previewImage = preview.locator("img");
  const previewBox = await previewImage.boundingBox();
  const upscaled = await previewImage.getAttribute("data-upscaled");
  steps.push({
    step: "输入区图片默认占屏幕约七成",
    ok: Boolean(previewBox && previewBox.width >= 1440 * 0.6 && previewBox.width <= 1440 * 0.75 && upscaled === "true"),
    screenshot: await shot("composer-image-preview-fill"),
  });

  // 1:1 回到原始像素，再点「适应」恢复七成显示。
  await preview.getByRole("button", { name: "实际大小" }).click();
  await page.waitForTimeout(400);
  const actualBox = await previewImage.boundingBox();
  await preview.locator('[data-zoom-fit="true"]').click();
  await page.waitForTimeout(400);
  const fitAgain = await previewImage.boundingBox();
  steps.push({
    step: "输入区图片 1:1 与适应切换",
    ok: Boolean(actualBox && actualBox.width <= 8.5 && fitAgain && fitAgain.width >= 1440 * 0.6 && fitAgain.width <= 1440 * 0.75),
  });

  await preview.getByRole("button", { name: "复制图片" }).click();
  await page.waitForTimeout(700);
  steps.push({ step: "输入区图片复制到剪贴板", ok: (await text()).includes("图片已复制"), screenshot: await shot("composer-image-copy") });

  const downloadPromise = page.waitForEvent("download", { timeout: 5000 }).catch(() => null);
  await preview.getByRole("button", { name: "另存为" }).click();
  const download = await downloadPromise;
  steps.push({
    step: "输入区图片另存为",
    ok: Boolean(download && /\.png$/iu.test(download.suggestedFilename())),
    screenshot: await shot("composer-image-save"),
  });

  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  steps.push({ step: "输入区图片预览 Esc 关闭", ok: (await page.locator('[data-composer-image-preview="true"]').count()) === 0 });

  await thumb.click({ button: "right" });
  await page.waitForTimeout(500);
  const menuText = await text();
  steps.push({
    step: "输入区图片右键菜单",
    ok: menuText.includes("复制图片") && menuText.includes("另存为") && menuText.includes("移除"),
    screenshot: await shot("composer-image-menu"),
  });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

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

  // 统一主聊天顶栏「协作 Agent 成员」弹窗：支持拉成员协作与填写分工，不再有独立群聊页。
  await page.locator('button[aria-label="协作 Agent 成员"]').first().click();
  await page.waitForTimeout(800);
  const teamText = await text();
  steps.push({
    step: "主聊天-协作 Agent 成员选择器",
    ok: teamText.includes("会话协作 Agent") && teamText.includes("小鱼"),
    screenshot: await shot("chat-team-picker"),
  });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

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

  // 终端页：页头 + 分组 + 展示位置分段控件，三者缺一都说明退回旧的自定义排版。
  await page.locator('[role="dialog"] aside button', { hasText: "终端" }).first().click();
  await page.waitForTimeout(900);
  const terminalSettingsText = await text();
  steps.push({
    step: "设置-终端（页头与展示位置）",
    ok: terminalSettingsText.includes("展示位置") && terminalSettingsText.includes("布局") && terminalSettingsText.includes("底部面板"),
    screenshot: await shot("settings-terminal"),
  });

  // 长期记忆页：新增 → 搜索 → 编辑 → 删除，覆盖记忆管理的完整交互。
  await page.getByRole("button", { name: "模型与规则", exact: true }).first().click();
  await page.waitForTimeout(900);
  await page.getByRole("tab", { name: "长期记忆库", exact: true }).first().click();
  await page.waitForTimeout(900);
  const memoryAddRegion = page.getByRole("region", { name: "写入记忆" });
  const memoryLibraryRegion = page.getByRole("region", { name: "记忆库" });
  await memoryAddRegion.getByLabel("记忆内容", { exact: true }).fill("验证用记忆：统一使用 pnpm 管理依赖");
  await memoryAddRegion.getByRole("button", { name: "写入记忆", exact: true }).click();
  await page.waitForTimeout(1200);
  steps.push({ step: "设置-记忆写入", ok: (await text()).includes("验证用记忆"), screenshot: await shot("settings-memory-write") });

  const memorySearch = memoryLibraryRegion.getByLabel("搜索记忆", { exact: true });
  await memorySearch.fill("pnpm 管理");
  await page.waitForTimeout(500);
  steps.push({ step: "设置-记忆搜索", ok: (await text()).includes("验证用记忆") });
  await memorySearch.fill("不存在的关键词zzz");
  await page.waitForTimeout(500);
  steps.push({ step: "设置-记忆搜索空态", ok: (await text()).includes("没有匹配") });
  await memorySearch.fill("");
  await page.waitForTimeout(400);

  await memoryLibraryRegion.getByRole("button", { name: "编辑", exact: true }).first().click();
  await page.waitForTimeout(500);
  const memoryEditRegion = page.getByRole("region", { name: "编辑记忆" });
  await memoryEditRegion.getByRole("textbox").first().fill("验证用记忆：统一使用 pnpm 管理依赖（已编辑）");
  await memoryEditRegion.getByRole("button", { name: "保存修改", exact: true }).click();
  await page.waitForTimeout(1200);
  const afterEdit = await text();
  steps.push({ step: "设置-记忆编辑", ok: afterEdit.includes("已编辑"), screenshot: await shot("settings-memory-edit") });

  const dangerGroup = page.getByRole("region", { name: "删除记忆" });
  await dangerGroup.getByLabel("选择要删除的记忆").selectOption({ index: 1 });
  await page.waitForTimeout(300);
  await dangerGroup.getByRole("button", { name: "删除", exact: true }).click();
  await page.waitForTimeout(1200);
  steps.push({ step: "设置-记忆删除", ok: !(await text()).includes("（已编辑）"), screenshot: await shot("settings-memory-after-delete") });
  await page.getByRole("button", { name: "连接器", exact: true }).click();
  await page.getByRole("button", { name: "MCP 服务器", exact: true }).first().click();
  await page.getByRole("button", { name: "添加服务器", exact: true }).click();
  const mcpDialog = page.getByRole("dialog", { name: "添加服务器" });
  await mcpDialog.getByLabel("传输方式").selectOption("sse");
  steps.push({ step: "设置-连接器", ok: await mcpDialog.getByRole("textbox", { name: "服务 URL" }).isVisible(), screenshot: await shot("settings-connectors") });
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

  // 用用户菜单里的三档外观开关切换实际主题，避免页面仍挂载时直接改存储导致旧主题被写回。
  const applyTheme = async (mode: "light" | "dark"): Promise<void> => {
    await page.getByRole("button", { name: "用户菜单", exact: true }).click();
    await page.getByRole("radio", { name: mode === "light" ? "浅色模式" : "深色模式" }).click();
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

  // 窄屏切回首页确认顶栏「协作 Agent 成员」按钮可见且不溢出。
  await page.locator('button[aria-label="首页"]').first().click();
  await page.waitForTimeout(1000);
  const mobileTeamVisible = await page.locator('button[aria-label="协作 Agent 成员"]').first().isVisible();
  steps.push({
    step: "窄屏-主聊天协作成员入口",
    ok: mobileTeamVisible,
    screenshot: await shot("chat-team-mobile"),
  });

  // 平板宽度（768–1023px）左二栏是抽屉：展开后必须渲染出会话列表，不能白屏。
  // 回归背景：提示气泡的贴边补偿曾在这里无限 setState，整棵树被卸载成空白页。
  await page.setViewportSize({ width: 900, height: 800 });
  await page.waitForTimeout(800);
  await page.locator('button[aria-label="展开左二会话项目菜单栏"]').first().click();
  await page.waitForTimeout(1200);
  const drawerText = await text();
  steps.push({
    step: "平板-展开左二会话抽屉",
    ok: drawerText.includes("项目") && drawerText.includes("最近") && drawerText.length > 60,
    screenshot: await shot("tablet-sidebar-drawer"),
  });

  // 深色主题再回一次 Agents 页，确认列表、开关与编辑卡在深色下都清晰。
  await page.setViewportSize({ width: 1440, height: 900 });
  await applyTheme("dark");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2600);
  await page.locator('button[aria-label="Agents"]').first().click();
  await page.waitForTimeout(1500);
  // Agents 卡片 + 弹窗：点「设置 小鱼」弹出居中配置弹窗。
  await page.locator("main").getByText("Agent 与模型").first().waitFor({ timeout: 10000 }).catch(() => {});
  await page.locator('main button[aria-label="设置 小鱼"]').first().click();
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