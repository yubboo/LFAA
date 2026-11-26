// 临时探测：Ctrl+←/→/↓ 是否真的能传到页面（决定能不能当默认键位）。
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
await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-columns]", { timeout: 60000 });
await page.waitForTimeout(1200);

await page.evaluate(() => {
  window.__keys = [];
  document.addEventListener("keydown", (event) => {
    if (event.ctrlKey) window.__keys.push(`${event.key}${event.altKey ? "+alt" : ""}${event.shiftKey ? "+shift" : ""}`);
  }, true);
});

for (const combo of ["Control+ArrowLeft", "Control+ArrowRight", "Control+ArrowDown", "Control+Alt+Digit1"]) {
  await page.keyboard.press(combo);
  await page.waitForTimeout(200);
}
console.log("received:", JSON.stringify(await page.evaluate(() => window.__keys)));
await browser.close();