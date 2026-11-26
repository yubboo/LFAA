import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
const candidates = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe","C:/Program Files/Microsoft/Edge/Application/msedge.exe","C:/Program Files/Google/Chrome/Application/chrome.exe"];
const executablePath = candidates.find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);
const info = await page.evaluate(() => {
  const el = document.querySelector("[data-columns]");
  return { count: document.querySelectorAll("[data-columns]").length, attrs: el ? [...el.attributes].map((a) => a.name + "=" + a.value.slice(0, 20)) : null, rect: el ? el.getBoundingClientRect().toJSON() : null };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
