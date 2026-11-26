// 临时测量：每次新开页面 → 点击第 N 个会话行 → 量「点击到消息出现」的延迟，避免侧栏重渲染导致句柄失效。
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const exe = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].find((p) => existsSync(p));
const url = process.argv[2] ?? "http://127.0.0.1:5173/";
const label = process.argv[3] ?? "switch";

const browser = await chromium.launch({ executablePath: exe, headless: true });
const results = [];
for (const index of [1, 2, 3]) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(9000);
  await page.evaluate(`(() => { window.__lt = [];
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)); }).observe({ entryTypes: ["longtask"] }); })()`);
  const rows = page.locator("[data-sidebar-item]");
  const count = await rows.count();
  if (count <= index) { results.push({ index, ms: -1, note: `only ${count} rows` }); await page.close(); continue; }
  const id = await rows.nth(index).getAttribute("data-sidebar-item");
  const start = Date.now();
  await rows.nth(index).click({ timeout: 4000 }).catch(() => {});
  let appeared = false;
  while (Date.now() - start < 8000) {
    if ((await page.evaluate("document.querySelectorAll('[id^=chat-message-]').length")) > 0) { appeared = true; break; }
    await page.waitForTimeout(40);
  }
  const lt = await page.evaluate("window.__lt");
  results.push({ index, id: id?.slice(0, 8), ms: Date.now() - start, appeared, longtasks: lt });
  await page.close();
}
console.log(`[${label}]`, JSON.stringify(results));
await browser.close();