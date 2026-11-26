// 临时测量：内容可见性优化后，滚动停止是否发生「延迟重排位移」，以及回到底部/继续上滚是否稳定。
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const exe = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].find((p) => existsSync(p));
const url = process.argv[2] ?? "http://127.0.0.1:5173/";
const label = process.argv[3] ?? "stability";
const session = process.argv[4] ?? "";

const browser = await chromium.launch({ executablePath: exe, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
if (session) await ctx.addInitScript(`try { localStorage.setItem("lfaa:active-chat-session-id", ${JSON.stringify(session)}); } catch {}`);
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(10000);

const metrics = () => page.evaluate(`(() => {
  const el = document.querySelector("[class*='scrollArea']");
  const row = document.elementFromPoint(700, 450);
  return {
    top: Math.round(el.scrollTop),
    height: Math.round(el.scrollHeight),
    at: (row?.closest("[id^=chat-message-]")?.id ?? "none").slice(0, 30),
    offset: Math.round(row?.getBoundingClientRect().top ?? -1),
  };
})()`);

await page.mouse.move(700, 460);
for (let i = 0; i < 18; i += 1) { await page.mouse.wheel(0, -420); await page.waitForTimeout(45); }
const justStopped = await metrics();
await page.waitForTimeout(900);
const settled = await metrics();
console.log(`[${label}] 停止瞬间`, JSON.stringify(justStopped));
console.log(`[${label}] 稳定之后`, JSON.stringify(settled));
console.log(`[${label}] 位移: scrollTop ${settled.top - justStopped.top}px, 高度 ${settled.height - justStopped.height}px, 视口首行偏移 ${settled.offset - justStopped.offset}px`);

// 页面内“回到底部”仍然可用
const back = await page.evaluate(`(() => {
  const el = document.querySelector("[class*='scrollArea']");
  el.scrollTop = el.scrollHeight;
  return { top: Math.round(el.scrollTop), max: Math.round(el.scrollHeight - el.clientHeight) };
})()`);
await page.waitForTimeout(400);
const afterBack = await metrics();
console.log(`[${label}] 回到底部`, JSON.stringify(back), "→", JSON.stringify(afterBack));
await browser.close();