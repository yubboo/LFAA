// 临时排查：最大化过程中会话列内容视口的 scrollTop 何时被清零（含 settle 之后）。
import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
const page = await context.newPage();
await page.goto("http://127.0.0.1:5173/", { waitUntil: "load" });
await page.waitForSelector('main[data-region="workspace"]');
await page.waitForTimeout(800);

await page.evaluate(() => {
  const chat = document.querySelector('main[data-region="workspace"]');
  const viewport = [...chat.children].find((el) => getComputedStyle(el).overflowY === "auto");
  const spacer = document.createElement("div");
  spacer.setAttribute("data-verify-spacer", "1");
  spacer.style.height = "3000px";
  viewport.appendChild(spacer);
  viewport.scrollTop = 300;
  window.__vp = viewport;
  window.__trace = [];
  const tick = () => {
    const vp = window.__vp;
    const chatNow = document.querySelector('main[data-region="workspace"]');
    window.__trace.push({
      t: Math.round(performance.now()),
      top: Math.round(vp.scrollTop),
      conn: vp.isConnected,
      h: Math.round(vp.clientHeight),
      w: Math.round(vp.clientWidth),
      sh: Math.round(vp.scrollHeight),
      chatW: Math.round(chatNow.getBoundingClientRect().width),
      cs: chatNow.getAttribute("style") ? "pinned" : "flow",
      max: chatNow.parentElement.dataset.rightMaximized ?? "none",
    });
    if (window.__trace.length < 120) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
await page.keyboard.press("Control+Shift+M");
await page.waitForTimeout(1500);
const trace = await page.evaluate(() => window.__trace);
const interesting = trace.filter((f, i) => i === 0 || f.top !== trace[i - 1].top || f.cs !== trace[i - 1].cs);
console.log(JSON.stringify(interesting, null, 1));
await browser.close();