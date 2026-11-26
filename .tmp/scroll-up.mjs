// 临时测量：大会话里连续向上滚动，检查 scrollTop 是否连续（无跳回底部/跳顶），并统计滚动帧间隔。
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const exe = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].find((p) => existsSync(p));
const url = process.argv[2] ?? "http://127.0.0.1:5173/";
const label = process.argv[3] ?? "scroll-up";
const session = process.argv[4] ?? "";

const browser = await chromium.launch({ executablePath: exe, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
if (session) await ctx.addInitScript(`try { localStorage.setItem("lfaa:active-chat-session-id", ${JSON.stringify(session)}); } catch {}`);
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(10000);

const start = await page.evaluate(`(() => {
  const el = document.querySelector("[class*='scrollArea']");
  return el ? { top: Math.round(el.scrollTop), height: Math.round(el.scrollHeight), client: el.clientHeight } : null;
})()`);
console.log(`[${label}] start`, JSON.stringify(start));

await page.evaluate(`(() => { window.__frames = []; let last = performance.now();
  const tick = (now) => { window.__frames.push(Math.round(now - last)); last = now; requestAnimationFrame(tick); };
  requestAnimationFrame(tick); })()`);

const tops = [];
await page.mouse.move(700, 460);
for (let i = 0; i < 30; i += 1) {
  await page.mouse.wheel(0, -420);
  await page.waitForTimeout(45);
  tops.push(await page.evaluate(`Math.round(document.querySelector("[class*='scrollArea']").scrollTop)`));
}
const end = await page.evaluate(`(() => {
  const el = document.querySelector("[class*='scrollArea']");
  return { top: Math.round(el.scrollTop), height: Math.round(el.scrollHeight), client: el.clientHeight };
})()`);
const frames = (await page.evaluate("window.__frames")).filter((n) => n > 0).sort((a, b) => a - b);
const jumps = tops.map((t, i) => (i === 0 ? 0 : t - tops[i - 1])).filter((d) => d > 0);
console.log(`[${label}] end`, JSON.stringify(end));
console.log(`[${label}] tops=${JSON.stringify(tops)}`);
console.log(`[${label}] 反向跳变次数=${jumps.length} 最大值=${jumps.length ? Math.max(...jumps) : 0}`);
console.log(`[${label}] scroll frames=${frames.length} p95=${frames[Math.floor(frames.length * 0.95)]} max=${frames.at(-1)} over33=${frames.filter((n) => n > 33).length}`);
await browser.close();