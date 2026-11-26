import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
const candidates = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe","C:/Program Files/Microsoft/Edge/Application/msedge.exe","C:/Program Files/Google/Chrome/Application/chrome.exe"];
const executablePath = candidates.find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 140)); });
await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-columns]", { timeout: 60000 });
await page.waitForTimeout(2000);
const info = await page.evaluate(() => {
  const rail = document.querySelector('[data-region="context-panel"] nav');
  const btn = rail?.querySelector("button");
  const cs = btn ? getComputedStyle(btn) : null;
  return { rail: Boolean(rail), btnSize: cs ? `${cs.width}x${cs.height}` : null, btnRadius: cs?.borderRadius ?? null, railWidth: rail ? Math.round(rail.getBoundingClientRect().width) : null };
});
console.log(JSON.stringify({ ...info, errors: errors.slice(0, 3) }, null, 1));
await browser.close();
