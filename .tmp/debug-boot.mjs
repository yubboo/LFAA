// 临时调试脚本：打印开发服务器首屏状态（不入库）。
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const candidates = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
];
const executablePath = candidates.find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const logs = [];
page.on("console", (m) => logs.push(`${m.type()}: ${m.text()}`));
page.on("pageerror", (e) => logs.push(`PAGEERROR ${e.message}`));
page.on("requestfailed", (r) => logs.push(`REQFAIL ${r.url()}`));

await page.goto(process.argv[2] ?? "http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(6000);
console.log("title:", await page.title());
console.log("html len:", (await page.content()).length);
console.log("body text:", (await page.evaluate(() => document.body.innerText)).slice(0, 400));
console.log("logs:", JSON.stringify(logs.slice(0, 15), null, 1));
await page.screenshot({ path: "E:/lfaa/.tmp/shots/debug-boot.png" });
await browser.close();