// 悬停抖动的红/绿反馈环：把会话滚到最底部，逐个悬停动作按钮并向下滚轮，
// 断言「可滚终点不增加、scrollTop 不变、到底后滚轮推不动」。任何一项变化即退出码 1。
// 默认起生产构建静态宿主（无浏览器或无会话时跳过，退出码 0）；本地联调用 --url http://127.0.0.1:5173/ 指向正在跑的开发服务。
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright-core";
import { startHostServer } from "@lfaa/web-server";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const WEB_DIST = join(REPO_ROOT, "apps", "web", "dist");
const ACTIONABLE = ["复制回复", "评价回复", "朗读", "更多操作"];
/** 容差：取整尺寸允许半个像素的读数误差，超过即判定为真实位移。 */
const TOLERANCE = 0.5;

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

/** Web 产物缺失时先构建一次，供静态宿主直接使用。 */
function ensureWebBuild(): void {
  if (existsSync(join(WEB_DIST, "index.html"))) return;
  console.log("未找到 Web 产物，先执行 pnpm build:web …");
  const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const result = spawnSync(command, ["run", "build:web"], { cwd: REPO_ROOT, stdio: "inherit", shell: true });
  if (result.status !== 0) {
    console.error("Web 构建失败，验收中止。");
    process.exit(1);
  }
}

interface Geometry {
  top: number;
  scrollHeight: number;
  clientHeight: number;
  max: number;
}

/** 读取聊天视口、外层工作区视口与页面三层的滚动几何，避免只看一层滚动容器。 */
function readGeometry(page: Page): Promise<{ chat: Geometry; outer: Geometry | null; doc: Geometry }> {
  return page.evaluate(() => {
    const read = (node: HTMLElement | null): Geometry | null => {
      if (!node) return null;
      const max = node.scrollHeight - node.clientHeight;
      return {
        top: Math.round(node.scrollTop * 100) / 100,
        scrollHeight: node.scrollHeight,
        clientHeight: node.clientHeight,
        max: Math.round(max * 100) / 100,
      };
    };
    const empty: Geometry = { top: 0, scrollHeight: 0, clientHeight: 0, max: 0 };
    return {
      chat: read(document.querySelector<HTMLElement>('div[class*="_scrollArea_"]')) ?? empty,
      outer: read(document.querySelector<HTMLElement>('[class*="_workspaceViewport_"]')),
      doc: read(document.scrollingElement as HTMLElement) ?? empty,
    };
  });
}

const executablePath = findBrowserExecutable();
if (!executablePath) {
  console.log("未检测到本机 Edge/Chrome，跳过悬停抖动验收。");
  process.exit(0);
}

const urlIndex = process.argv.indexOf("--url");
let server: Awaited<ReturnType<typeof startHostServer>> | null = null;
let target: string;
if (urlIndex >= 0) {
  target = process.argv[urlIndex + 1] ?? "http://127.0.0.1:5173/";
} else {
  ensureWebBuild();
  server = await startHostServer({ webRoot: WEB_DIST, projectRoot: REPO_ROOT, port: 0 });
  target = server.url;
}

const browser = await chromium.launch({ executablePath, headless: true });
let failed = 0;
const report: string[] = [];

try {
  // 窗口压矮到会话必然溢出，才能验证「到底之后不能再滚」。
  const page = await browser.newPage({ viewport: { width: 1440, height: 760 } });
  await page.addInitScript(() => {
    // tsx/esbuild 会给函数注入命名辅助；序列化进页面后需要补上，否则报 __name 未定义。
    (window as unknown as { __name: (fn: unknown) => unknown }).__name = (fn: unknown) => fn;
  });
  await page.goto(target, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3200);

  // 打开左二第一条会话：会话「更多」按钮的 aria-label 里带着会话标题。
  const more = page.locator("[data-session-more]").first();
  if ((await more.count()) === 0) {
    console.log("没有可打开的会话，跳过悬停抖动验收。");
    process.exit(0);
  }
  const title = ((await more.getAttribute("aria-label")) ?? "").split(": ").slice(1).join(": ");
  const row = page.getByText(title, { exact: true }).first();
  if (await row.count()) await row.click();
  await page.waitForTimeout(3000);

  const chat = page.locator('div[class*="_scrollArea_"]').first();
  await chat.waitFor({ state: "visible" });
  if ((await page.getByRole("button", { name: "复制回复" }).count()) === 0) {
    console.log("当前会话没有消息动作栏（空白会话或内容不足一屏），跳过悬停抖动验收。");
    process.exit(0);
  }

  // 先滚到最底部，后续断言都以这个基线为参照。
  await chat.evaluate((element) => {
    const area = element as HTMLElement;
    area.scrollTop = area.scrollHeight;
  });
  await page.waitForTimeout(400);
  const baseline = await readGeometry(page);
  if (baseline.chat.max <= 0) {
    console.log("会话内容不足一屏，无法验证贴底行为，跳过。");
    process.exit(0);
  }
  report.push(`基线：scrollTop=${baseline.chat.top} 可滚终点=${baseline.chat.max} 外层可滚=${baseline.outer?.max ?? 0}`);

  for (const label of ACTIONABLE) {
    const button = page.getByRole("button", { name: label }).last();
    if ((await button.count()) === 0) continue;
    await button.hover();
    await page.waitForTimeout(350);
    const hovered = await readGeometry(page);
    await page.mouse.wheel(0, 320);
    await page.waitForTimeout(350);
    const wheeled = await readGeometry(page);

    const grew = Math.round((hovered.chat.max - baseline.chat.max) * 100) / 100;
    const moved = Math.round((hovered.chat.top - baseline.chat.top) * 100) / 100;
    const wheelMoved = Math.round((wheeled.chat.top - hovered.chat.top) * 100) / 100;
    const outerMoved = Math.round(((wheeled.outer?.top ?? 0) - (baseline.outer?.top ?? 0)) * 100) / 100;
    const docMoved = Math.round((wheeled.doc.top - baseline.doc.top) * 100) / 100;
    const ok =
      Math.abs(grew) <= TOLERANCE &&
      Math.abs(moved) <= TOLERANCE &&
      Math.abs(wheelMoved) <= TOLERANCE &&
      Math.abs(outerMoved) <= TOLERANCE &&
      Math.abs(docMoved) <= TOLERANCE;
    if (!ok) failed += 1;
    report.push(
      `${ok ? "✔" : "✖"} ${label}：可滚终点 ${grew >= 0 ? "+" : ""}${grew}px，悬停位移 ${moved}px，到底后滚轮再滚 ${wheelMoved}px，外层滚动 ${outerMoved}px，页面滚动 ${docMoved}px`,
    );
  }

  // 晚到内容（追问建议、已编辑文件卡片）挂载后应平滑自动滚到底：
  // 往线程尾部插一块 150px 内容，逐帧采样 scrollTop —— 单帧位移过大即硬跳，
  // 最终必须精确落在底边，且落位后不再出现反复变化（抖动）。
  const jump = await page.evaluate(async () => {
    const area = document.querySelector<HTMLElement>('div[class*="_scrollArea_"]');
    const thread = document.querySelector<HTMLElement>('[class*="_thread_"]');
    if (!area || !thread) return null;
    area.scrollTop = area.scrollHeight;
    await new Promise((resolve) => setTimeout(resolve, 150));
    const samples: number[] = [];
    let running = true;
    const sample = () => {
      samples.push(area.scrollTop);
      if (running) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    const block = document.createElement("div");
    block.dataset.probe = "late-block";
    block.style.height = "150px";
    thread.append(block);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    running = false;
    const settled = Math.round((area.scrollHeight - area.clientHeight - area.scrollTop) * 100) / 100;
    // 落位后再观察 400ms，确认没有继续抖动。
    const settledAt = samples.length;
    await new Promise((resolve) => setTimeout(resolve, 400));
    const tail = samples.slice(settledAt);
    const tailStep = tail.reduce((max, value) => Math.max(max, Math.abs(value - (tail[0] ?? value))), 0);
    block.remove();
    let maxStep = 0;
    for (let index = 1; index < samples.length; index += 1) {
      maxStep = Math.max(maxStep, Math.abs(samples[index]! - samples[index - 1]!));
    }
    return { maxStep: Math.round(maxStep * 100) / 100, settled, tailStep: Math.round(tailStep * 100) / 100, frames: samples.length };
  });
  if (jump) {
    const ok = jump.maxStep <= 32 && Math.abs(jump.settled) <= 1 && jump.tailStep <= 1;
    if (!ok) failed += 1;
    report.push(
      `${ok ? "✔" : "✖"} 晚到内容自动滚到底：单帧最大 ${jump.maxStep}px，落位偏差 ${jump.settled}px，落位后变化 ${jump.tailStep}px`,
    );
  }
} finally {
  await browser.close();
  await server?.stop();
}

for (const line of report) console.log(line);
console.log(failed === 0 ? "\n悬停抖动反馈环：通过（到底后不能再滚，悬停不改变可滚终点）" : `\n悬停抖动反馈环：失败（${failed} 项）`);
process.exitCode = failed === 0 ? 0 : 1;