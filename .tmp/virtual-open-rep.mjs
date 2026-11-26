// 临时验收：重复 3 次，比较窗口化开/关打开 80 条消息会话的首行时间与长任务总量。
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const exe = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].find((p) => existsSync(p));
const url = process.argv[2] ?? "http://127.0.0.1:5173/";
const session = "00000000-0000-4000-8000-000000000001";

async function once(offline) {
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(`(() => { try {
    localStorage.setItem("lfaa:active-chat-session-id", ${JSON.stringify(session)});
    if (${offline}) localStorage.setItem("lfaa:thread-virtualization", "off");
    else localStorage.removeItem("lfaa:thread-virtualization");
  } catch {} })()`);
  const page = await ctx.newPage();
  await page.addInitScript(`(() => { window.__lt = new Set();
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.add(Math.round(e.duration)); }).observe({ entryTypes: ["longtask"], buffered: true }); })()`);
  const t0 = Date.now();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  let ms = -1;
  while (Date.now() - t0 < 25000) {
    if ((await page.evaluate("document.querySelectorAll('[id^=chat-message-]').length")) > 0) { ms = Date.now() - t0; break; }
    await page.waitForTimeout(30);
  }
  await page.waitForTimeout(1500);
  const lt = (await page.evaluate("Array.from(window.__lt)")).sort((a, b) => b - a);
  const dom = await page.evaluate("document.querySelectorAll('*').length");
  await browser.close();
  return { ms, dom, lt: lt.slice(0, 5), ltTotal: lt.reduce((a, b) => a + b, 0) };
}

for (const offline of [false, true]) {
  const label = offline ? "virtual-off" : "virtual-on";
  const runs = [];
  for (let i = 0; i < 3; i += 1) runs.push(await once(offline));
  console.log(`[${label}] 首行ms=${runs.map((r) => r.ms).join("/")} dom=${runs.map((r) => r.dom).join("/")} 长任务总ms=${runs.map((r) => r.ltTotal).join("/")} top5=${JSON.stringify(runs[0].lt)}`);
}