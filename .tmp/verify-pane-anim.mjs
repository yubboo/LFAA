// 临时验收：最大化/还原的布局编排动画（DEV-000569）。
// 逐帧采样 9 点 elementFromPoint（命中必须落在两块面板内部，落在外壳底色即判空白）、
// 两块面板的实时宽度、内联样式残留、节点同一性与滚动位置。
// 用法：node .tmp/verify-pane-anim.mjs [--shots]
import { chromium } from "playwright-core";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const BASE = "http://127.0.0.1:5173/";
const WANT_SHOTS = process.argv.includes("--shots");

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const report = [];

/** 装逐帧采样器：采样区夹在外壳可见范围内，命中必须属于会话列或工作台。 */
async function installSampler(page) {
  await page.evaluate(() => {
    const find = () => {
      const chat = document.querySelector('main[data-region="workspace"]');
      const shell = chat?.parentElement;
      const panel = shell?.querySelector('[data-pane-side="right"]');
      return { chat, shell, panel };
    };
    const { chat, shell, panel } = find();
    const base = shell.getBoundingClientRect();
    // 会话列的内容视口：动画期内它自己必须一动不动，滚动位置才算没被动画碰过。
    const viewport = [...(chat?.children ?? [])].find((el) => getComputedStyle(el).overflowY === "auto");
    const left = Math.max(base.left, Math.min(...[chat, panel].map((el) => el.getBoundingClientRect().left)));
    const right = Math.min(base.right, Math.max(...[chat, panel].map((el) => el.getBoundingClientRect().right)));
    const top = Math.max(base.top, Math.min(...[chat, panel].map((el) => el.getBoundingClientRect().top)));
    const bottom = Math.min(base.bottom, Math.max(...[chat, panel].map((el) => el.getBoundingClientRect().bottom)));
    const xs = [left + (right - left) * 0.08, (left + right) / 2, right - (right - left) * 0.08];
    const ys = [top + (bottom - top) * 0.08, (top + bottom) / 2, bottom - (bottom - top) * 0.08];
    const points = [];
    for (const y of ys) for (const x of xs) points.push([Math.round(x), Math.round(y)]);
    window.__paneAnim = { points, samples: [], sampling: true };
    const tick = () => {
      const state = window.__paneAnim;
      if (!state.sampling) return;
      const now = find();
      const rect = (el) => (el ? el.getBoundingClientRect() : { width: 0, left: 0, right: 0, top: 0, bottom: 0 });
      const chatRect = rect(now.chat);
      const panelRect = rect(now.panel);
      const hits = state.points.map(([x, y]) => {
        const el = document.elementFromPoint(x, y);
        const inRect = (r) => x >= r.left - 1 && x <= r.right + 1 && y >= r.top - 1 && y <= r.bottom + 1;
        const covered = inRect(chatRect) || inRect(panelRect);
        if (!el) return { ok: false, covered, label: "null" };
        const inside = Boolean((now.chat && now.chat.contains(el)) || (now.panel && now.panel.contains(el)));
        const handle = Boolean(el.closest?.("[data-resize-side]"));
        const cls = typeof el.className === "string" && el.className ? `.${el.className.split(" ")[0]}` : "";
        return { ok: inside || handle, covered, label: `${el.tagName.toLowerCase()}${cls}` };
      });
      state.samples.push({
        t: Math.round(performance.now()),
        hits,
        chatW: Math.round(rect(now.chat).width * 10) / 10,
        panelW: Math.round(rect(now.panel).width * 10) / 10,
        chatLeft: Math.round(rect(now.chat).left),
        panelLeft: Math.round(rect(now.panel).left),
        chatTf: now.chat?.style.transform ?? "",
        panelTf: now.panel?.style.transform ?? "",
        pinned: Boolean(now.chat?.getAttribute("style")),
        scrollTop: viewport ? Math.round(viewport.scrollTop) : -1,
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function toggleAndSample(page) {
  await installSampler(page);
  await page.keyboard.press("Control+Shift+M");
  await page.waitForTimeout(950);
  return page.evaluate(() => {
    const state = window.__paneAnim;
    state.sampling = false;
    return { points: state.points, samples: state.samples };
  });
}

/** 六条断言：空白帧、宽度序列、无残留 transform、节点同一性、滚动位置、0 报错。 */
function judge(run, errors, scroll) {
  const samples = run.samples;
  const animating = samples.filter((s) => s.chatTf || s.panelTf);
  const blankHit = samples.filter((s) => s.hits.some((hit) => !hit.ok));
  const blankCover = samples.filter((s) => s.hits.some((hit) => !hit.covered));
  return {
    采样帧数: samples.length,
    动画帧数: animating.length,
    空白帧数_几何覆盖: blankCover.length,
    空白帧数_命中面板: blankHit.length,
    空白样例: (blankCover.length ? blankCover : blankHit).slice(0, 2)
      .map((s) => ({ t: s.t, bad: s.hits.filter((h) => !h.ok || !h.covered).map((h) => h.label) })),
    会话列宽度取值数: new Set(animating.map((s) => s.chatW)).size,
    工作台宽度取值数: new Set(animating.map((s) => s.panelW)).size,
    边界序列: animating.slice(0, 10).map((s) => `${s.chatLeft}+${s.chatW}|${s.panelLeft}+${s.panelW}`),
    动画期内滚动取值: [...new Set(animating.map((s) => s.scrollTop))],
    滚动: scroll,
    报错: errors,
  };
}

async function layoutRun(mode) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
  await context.addInitScript((layout) => {
    window.localStorage.setItem("lfaa:appearance-mode", "dark");
    window.localStorage.setItem("lfaa:layout-mode", JSON.stringify(layout));
  }, mode);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 300)); });
  await page.goto(BASE, { waitUntil: "load" });
  await page.waitForSelector('main[data-region="workspace"]', { timeout: 20000 });
  await page.waitForTimeout(800);

  const env = await page.evaluate(() => {
    const chat = document.querySelector('main[data-region="workspace"]');
    const shell = chat?.parentElement;
    const panel = shell?.querySelector('[data-pane-side="right"]');
    chat?.setAttribute("data-verify-mark", "chat");
    panel?.setAttribute("data-verify-mark", "panel");
    // 当前档案没有打开的会话，欢迎页不可滚动：给会话列的内容视口塞一段临时高内容，
    // 让「滚动位置在最大化/还原前后不变」这条断言有真实对象可测（测完移除）。
    const viewport = [...(chat?.children ?? [])].find((el) => getComputedStyle(el).overflowY === "auto");
    if (viewport) {
      const spacer = document.createElement("div");
      spacer.setAttribute("data-verify-spacer", "1");
      spacer.style.height = "3000px";
      spacer.style.pointerEvents = "none";
      viewport.appendChild(spacer);
      viewport.scrollTop = 300;
    }
    window.__readScroll = () => (viewport ? Math.round(viewport.scrollTop) : -1);
    return {
      layout: shell?.dataset.layout ?? "chat-center",
      device: shell?.dataset.device,
      rightOpen: shell?.dataset.rightOpen,
      panel: Boolean(panel),
      滚动容器: viewport ? "workspaceViewport" : "none",
      scrollBefore: viewport ? Math.round(viewport.scrollTop) : -1,
    };
  });

  const maxRun = await toggleAndSample(page);
  const maxResidue = await page.evaluate(readResidue);
  const scrollAfterMax = await page.evaluate(() => window.__readScroll());

  let shots = [];
  if (WANT_SHOTS) {
    await page.keyboard.press("Control+Shift+M");
    for (const at of [40, 80, 120, 200]) {
      await page.waitForTimeout(40);
      const path = `shots/pane-anim-${mode}-${at}.png`;
      await page.screenshot({ path });
      shots.push(path);
    }
    await page.waitForTimeout(700);
  }

  const restoreRun = await toggleAndSample(page);
  const restoreResidue = await page.evaluate(readResidue);
  const scrollAfterRestore = await page.evaluate(() => window.__readScroll());

  const sameScroll = (a, b) => a === b;
  report.push({
    mode,
    env,
    最大化: judge(maxRun, errors, {
      容器: env.滚动容器,
      前: env.scrollBefore,
      后: scrollAfterMax,
      一致: sameScroll(env.scrollBefore, scrollAfterMax),
    }),
    最大化后残留: maxResidue,
    还原: judge(restoreRun, errors, {
      容器: env.滚动容器,
      前: scrollAfterMax,
      后: scrollAfterRestore,
      一致: sameScroll(scrollAfterMax, scrollAfterRestore),
    }),
    还原后残留: restoreResidue,
    帧截图: shots,
  });
  await context.close();
}

function readResidue() {
  const chat = document.querySelector('main[data-region="workspace"]');
  const shell = chat?.parentElement;
  const panel = shell?.querySelector('[data-pane-side="right"]');
  const attr = (el, name) => (el ? el.getAttribute(name) ?? "" : "missing");
  return {
    覆盖层残留: Boolean(document.querySelector("[data-pane-anim]")),
    会话列内联样式: attr(chat, "style"),
    工作台内联样式: attr(panel, "style"),
    会话列父节点正确: chat?.parentElement === shell,
    工作台父节点正确: panel?.parentElement === shell,
    会话列节点同一: attr(chat, "data-verify-mark") === "chat",
    工作台节点同一: attr(panel, "data-verify-mark") === "panel",
    外壳transition: shell?.style.transition ?? "",
    最大化标记: shell?.dataset.rightMaximized ?? "none",
    右栏开启: shell?.dataset.rightOpen ?? "none",
  };
}

for (const mode of ["chat-center", "preview-center"]) {
  await layoutRun(mode);
}
await browser.close();
console.log(JSON.stringify(report, null, 2));