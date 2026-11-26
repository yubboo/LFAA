// 临时排查：定位 404 与启动失败的具体资源。
import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const events = [];
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") events.push(`[${m.type()}] ${m.text()}`.slice(0, 600));
});
page.on("pageerror", (e) => events.push(`[pageerror] ${String(e).slice(0, 800)}`));
page.on("requestfailed", (r) => events.push(`[failed] ${r.url()} :: ${r.failure()?.errorText}`));
page.on("response", (r) => { if (r.status() >= 400) events.push(`[http ${r.status()}] ${r.url()}`); });
await page.goto("http://127.0.0.1:5173/", { waitUntil: "load" });
await page.waitForTimeout(4000);
const html = await page.evaluate(() => document.getElementById("root")?.innerHTML.length ?? -1);
console.log(JSON.stringify({ rootLen: html, events: events.slice(0, 40) }, null, 2));
await browser.close();