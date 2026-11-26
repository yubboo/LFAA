// 临时排查：preview-center 下最大化→还原后两块面板的真实几何与外壳状态。
import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
await context.addInitScript(() => {
  window.localStorage.setItem("lfaa:appearance-mode", "dark");
  window.localStorage.setItem("lfaa:layout-mode", JSON.stringify("preview-center"));
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 500)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 300)); });
await page.goto("http://127.0.0.1:5173/", { waitUntil: "load" });
await page.waitForSelector('main[data-region="workspace"]', { timeout: 20000 });
await page.waitForTimeout(600);

const snap = () => page.evaluate(() => {
  const chat = document.querySelector('main[data-region="workspace"]');
  const shell = chat.parentElement;
  const panel = shell.querySelector('[data-pane-side="right"]');
  const r = (el) => {
    const b = el.getBoundingClientRect();
    return { x: Math.round(b.x), w: Math.round(b.width), top: Math.round(b.top), h: Math.round(b.height) };
  };
  return {
    max: shell.dataset.rightMaximized ?? "none",
    rightOpen: shell.dataset.rightOpen,
    layout: shell.dataset.layout ?? "chat-center",
    chat: r(chat),
    panel: r(panel),
    layer: Boolean(shell.querySelector("[data-pane-anim]")),
    chatStyle: chat.getAttribute("style") ?? "",
    panelStyle: panel.getAttribute("style") ?? "",
    chatMinW: getComputedStyle(chat).minWidth,
    chatDisplay: getComputedStyle(chat).display,
  };
});

const out = { initial: await snap() };
await page.keyboard.press("Control+Shift+M");
await page.waitForTimeout(60);
out.maxMid = await snap();
await page.waitForTimeout(900);
out.maxDone = await snap();
await page.keyboard.press("Control+Shift+M");
await page.waitForTimeout(60);
out.restoreMid = await snap();
await page.waitForTimeout(900);
out.restoreDone = await snap();
out.errors = errors;
console.log(JSON.stringify(out, null, 2));
await browser.close();