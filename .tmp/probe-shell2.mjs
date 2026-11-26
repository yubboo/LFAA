import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
const candidates = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe","C:/Program Files/Microsoft/Edge/Application/msedge.exe","C:/Program Files/Google/Chrome/Application/chrome.exe"];
const executablePath = candidates.find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const logs = [];
page.on("console", (m) => logs.push(`${m.type()}: ${m.text().slice(0, 300)}`));
page.on("pageerror", (e) => logs.push(`PAGEERROR: ${e.message.slice(0, 300)}`));
await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(7000);
const info = await page.evaluate(() => ({
  overlay: Boolean(document.querySelector("vite-error-overlay")),
  regions: [...document.querySelectorAll("[data-region]")].map((el) => el.getAttribute("data-region")),
}));
console.log(JSON.stringify(info, null, 1));
console.log(logs.slice(0, 12).join("\n"));
await page.screenshot({ path: "E:/lfaa/.tmp/shots/debug-shell.png" });
await browser.close();
