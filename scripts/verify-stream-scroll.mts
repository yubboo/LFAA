// 会话滚动的红/绿反馈环：内容持续增长（流式输出）时，用户上滚必须真的停住、不能被贴底写回；
// 回到底部后必须恢复跟底；贴底时滚动条滑块落在输入区带上也必须仍能拖得动。任一项不成立即退出码 1。
// 默认起生产构建静态宿主（无浏览器或无会话时跳过，退出码 0）；本地联调用 --url http://127.0.0.1:5173/ 指向正在跑的开发服务。
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright-core";
import { startHostServer } from "@lfaa/web-server";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const WEB_DIST = join(REPO_ROOT, "apps", "web", "dist");
/** 滚轮步长与次数：4×400 足以离开底部阈值，也不会把会话滚过太多内容。 */
const WHEEL_STEP = 400;
const WHEEL_STEPS = 4;
/** 内容增长模拟：每 60ms 长高 30px，比程序贴底的写入间隔更快，正是会与用户抢滚动条的情形。 */
const GROW_INTERVAL_MS = 60;
const GROW_STEP_PX = 30;
/** 容差：取整尺寸允许半个像素的读数误差。 */
const TOLERANCE = 1;

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
  max: number;
}

/** 读取聊天视口当前位置与可滚终点。 */
function readGeometry(page: Page): Promise<Geometry> {
  return page.evaluate(() => {
    const node = document.querySelector<HTMLElement>('div[class*="_scrollArea_"]');
    if (!node) return { top: 0, max: 0 };
    return {
      top: Math.round(node.scrollTop * 100) / 100,
      max: Math.round((node.scrollHeight - node.clientHeight) * 100) / 100,
    };
  });
}

const executablePath = findBrowserExecutable();
if (!executablePath) {
  console.log("未检测到本机 Edge/Chrome，跳过会话滚动验收。");
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

const browser = await chromium.launch({
  executablePath,
  headless: true,
  // 需要真实滚动条宽度才能验证「滑块能不能拖」：Playwright 默认隐藏滚动条并走覆盖式滚动条。
  ignoreDefaultArgs: ["--hide-scrollbars"],
  args: ["--disable-features=OverlayScrollbar"],
});
let failed = 0;
const failures: string[] = [];
const report: string[] = [];

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  // 控制台新增报错同样算失败：滚动回环常伴随 ResizeObserver / 布局告警。
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console.error: ${message.text()}`);
  });
  await page.addInitScript(() => {
    // tsx/esbuild 会给函数注入命名辅助；序列化进页面后需要补上，否则报 __name 未定义。
    (window as unknown as { __name: (fn: unknown) => unknown }).__name = (fn: unknown) => fn;
  });
  await page.goto(target, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3200);

  // 打开左二第一条会话：会话「更多」按钮的 aria-label 里带着会话标题。
  // 冷启动的开发服务首次加载模块较慢，等会话行真正挂载而不是固定 sleep。
  const more = page.locator("[data-session-more]").first();
  await more.waitFor({ state: "attached", timeout: 20000 }).catch(() => undefined);
  if ((await more.count()) === 0) {
    console.log("没有可打开的会话，跳过会话滚动验收。");
    process.exit(0);
  }
  const title = ((await more.getAttribute("aria-label")) ?? "").split(": ").slice(1).join(": ");
  const row = page.getByText(title, { exact: true }).first();
  if (await row.count()) await row.click();
  await page.waitForTimeout(3000);

  const chat = page.locator('div[class*="_scrollArea_"]').first();
  await chat.waitFor({ state: "visible" });
  await chat.evaluate((element) => {
    const area = element as HTMLElement;
    area.scrollTop = area.scrollHeight;
  });
  await page.waitForTimeout(400);
  const baseline = await readGeometry(page);
  if (baseline.max <= 0) {
    console.log("会话内容不足一屏，无法验证滚动所有权，跳过。");
    process.exit(0);
  }
  const box = await chat.boundingBox();
  if (!box) {
    console.log("会话视口不可见，跳过会话滚动验收。");
    process.exit(0);
  }

  /**
   * 把指针放到会话区里一个不被内嵌限高滚动区（思考正文、工具输出）覆盖的纵向位置。
   * 内层还能滚时滚轮归内层，按设计不会让会话视口交出跟随权，验证脚本必须避开这些位置。
   */
  const aimWheel = async (): Promise<void> => {
    const current = await chat.boundingBox();
    if (!current) return;
    const y = await page.evaluate(({ left, width, top, height }) => {
      const chatEl = document.querySelector<HTMLElement>('div[class*="_scrollArea_"]');
      const blocked = (x: number, py: number): boolean => {
        let node: Element | null = document.elementFromPoint(x, py);
        while (node && node !== chatEl) {
          if (node instanceof HTMLElement) {
            const style = getComputedStyle(node);
            if ((style.overflowY === "auto" || style.overflowY === "scroll") && node.scrollHeight > node.clientHeight + 1) return true;
          }
          node = node.parentElement;
        }
        return false;
      };
      for (const ratio of [0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85]) {
        const candidate = top + height * ratio;
        if (!blocked(left + width / 2, candidate)) return candidate;
      }
      return top + height / 2;
    }, { left: current.x, width: current.width, top: current.y, height: current.height });
    await page.mouse.move(current.x + current.width / 2, y);
  };
  await aimWheel();

  // 在线程尾部挂一块内容，模拟流式输出；先给足可上滚的余量，结束时移除。
  await page.evaluate(({ interval, step, headroom }) => {
    const thread = document.querySelector<HTMLElement>('[class*="_thread_"]');
    if (!thread) return;
    const block = document.createElement("div");
    block.dataset.probe = "stream-growth";
    block.style.height = `${headroom}px`;
    block.style.background = "transparent";
    thread.append(block);
    const grow = (window as unknown as { __growTimer?: number });
    const tick = () => {
      block.style.height = `${Number.parseFloat(block.style.height) + step}px`;
      grow.__growTimer = window.setTimeout(tick, interval);
    };
    grow.__growTimer = window.setTimeout(tick, interval);
  }, { interval: GROW_INTERVAL_MS, step: GROW_STEP_PX, headroom: WHEEL_STEPS * WHEEL_STEP + 800 });
  await page.waitForTimeout(300);

  await page.waitForTimeout(1200);
  const beforeWheel = await readGeometry(page);
  for (let step = 0; step < WHEEL_STEPS; step += 1) {
    await aimWheel();
    await page.mouse.wheel(0, -WHEEL_STEP);
    await page.waitForTimeout(240);
  }
  const afterWheel = await readGeometry(page);
  const escaped = beforeWheel.top - afterWheel.top;
  const wheelOk = escaped >= WHEEL_STEPS * WHEEL_STEP - 200;
  if (!wheelOk) failed += 1;
  report.push(
    `${wheelOk ? "✔" : "✖"} 增长期间上滚 ${WHEEL_STEPS}×${WHEEL_STEP}px：实际离开底边 ${Math.round(escaped)}px（要求 ≥ ${WHEEL_STEPS * WHEEL_STEP - 200}），距底 ${Math.round(afterWheel.max - afterWheel.top)}px`,
  );

  // 停止增长，滚回尾部：跟随必须恢复，之后再增长也要贴住。
  await page.evaluate(() => {
    const timer = (window as unknown as { __growTimer?: number }).__growTimer;
    if (timer !== undefined) window.clearTimeout(timer);
  });
  for (let step = 0; step < 24; step += 1) {
    const now = await readGeometry(page);
    if (now.max - now.top <= TOLERANCE) break;
    await page.mouse.wheel(0, WHEEL_STEP);
    await page.waitForTimeout(120);
  }
  const backToBottom = await readGeometry(page);
  const resumeOk = backToBottom.max - backToBottom.top <= TOLERANCE;
  if (!resumeOk) failed += 1;
  report.push(`${resumeOk ? "✔" : "✖"} 滚回尾部：距底 ${Math.round(backToBottom.max - backToBottom.top)}px（要求 ≤ ${TOLERANCE}）`);

  // 回到尾部后晚到的一整块内容（追问建议、改动卡片就是这样挂上来的）：应平滑让位回到底部，说明跟随已恢复。
  await page.evaluate(() => {
    const block = document.querySelector<HTMLElement>('[data-probe="stream-growth"]');
    if (!block) return;
    block.style.height = `${Number.parseFloat(block.style.height) + 320}px`;
  });
  await page.waitForTimeout(900);
  const followAfterGrow = await readGeometry(page);
  const followOk = followAfterGrow.max - followAfterGrow.top <= 8;
  if (!followOk) failed += 1;
  report.push(
    `${followOk ? "✔" : "✖"} 回到底部后晚到 320px 内容：距底 ${Math.round(followAfterGrow.max - followAfterGrow.top)}px（要求 ≤ 8，说明跟底已恢复）`,
  );

  // 贴底时滑块停在轨道最底部，正好落在叠在滚动区之上的输入区带里：
  // 这一带必须让滚动条可命中，否则就是「鼠标精准悬停在滑块上却拖不动」。
  // 拖动要在探针块还在时做（保证有足够的可滚区间），结束后再清掉探针块。
  const areaBox = await chat.boundingBox();
  let dragDistance = 0;
  let dragHit = "";
  if (areaBox) {
    const dragX = Math.round(areaBox.x + areaBox.width - 5);
    const startY = Math.round(areaBox.y + areaBox.height - 15);
    dragHit = await page.evaluate(({ x, y }) => {
      const node = document.elementFromPoint(x, y);
      return node ? `${node.tagName}.${String(node.className).split(" ")[0]}` : "none";
    }, { x: dragX, y: startY });
    const beforeDrag = await readGeometry(page);
    await page.mouse.move(dragX, startY);
    await page.mouse.down();
    // 分步拖动：一次大跨度移动在无头环境里可能被合并成一两个事件，逐段推进更接近真实拖拽。
    for (let step = 1; step <= 10; step += 1) {
      await page.mouse.move(dragX, startY - step * 12);
      await page.waitForTimeout(40);
    }
    await page.mouse.up();
    await page.waitForTimeout(300);
    dragDistance = Math.round(beforeDrag.top - (await readGeometry(page)).top);
  }
  await page.evaluate(() => {
    document.querySelector('[data-probe="stream-growth"]')?.remove();
  });
  const dragHitOk = dragHit.includes("scrollArea");
  const dragOk = dragHitOk && dragDistance >= 200;
  if (!dragOk) failed += 1;
  report.push(
    `${dragOk ? "✔" : "✖"} 贴底位置拖动滚动条滑块：命中 ${dragHit || "未取到"}、scrollTop 上移 ${dragDistance}px（要求命中 scrollArea 且 ≥ 200）`,
  );

  // 刷新后必须回到刷新前的位置：历史一次性挂载不许把它冲到底部，也不许出现「从顶部滑到底部」的动画。
  const beforeReload = await readGeometry(page);
  await page.addInitScript(() => {
    window.__reloadFrames = [];
    const start = performance.now();
    const tick = () => {
      const area = document.querySelector<HTMLElement>('div[class*="_scrollArea_"]');
      if (area) {
        window.__reloadFrames.push({
          top: Math.round(area.scrollTop),
          max: Math.round(area.scrollHeight - area.clientHeight),
        });
      }
      if (performance.now() - start < 4000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  const afterReload = await readGeometry(page);
  const reloadFrames = await page.evaluate(() => window.__reloadFrames ?? []);
  // 动画的特征是大量「既不在顶也不在底」的中间帧；同步贴底只会有个位数帧。
  const movingFrames = reloadFrames.filter((frame) => frame.max > 0 && frame.top > 1 && frame.top < frame.max - 1).length;
  const drift = Math.abs(afterReload.top - beforeReload.top);
  const settledOk = drift <= TOLERANCE;
  const reloadOk = settledOk && movingFrames < 8;
  if (!reloadOk) failed += 1;
  report.push(
    `${reloadOk ? "✔" : "✖"} 刷新后落位：${Math.round(beforeReload.top)} → ${Math.round(afterReload.top)}（漂移 ${Math.round(drift)}px，要求 ≤ ${TOLERANCE}；过渡帧 ${movingFrames} 个，要求 < 8）`,
  );

  report.push(`${failures.length === 0 ? "✔" : "✖"} 控制台：${failures.length === 0 ? "0 报错" : failures.join(" / ")}`);
  if (failures.length > 0) failed += 1;
} finally {
  await browser.close();
  await server?.stop();
}

for (const line of report) console.log(line);
console.log(failed === 0 ? "\n会话滚动所有权反馈环：通过（增长期间用户上滚不被写回，回到底部恢复跟底）" : `\n会话滚动所有权反馈环：失败（${failed} 项）`);
process.exitCode = failed === 0 ? 0 : 1;