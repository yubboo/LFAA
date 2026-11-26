import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
const candidates = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe","C:/Program Files/Microsoft/Edge/Application/msedge.exe","C:/Program Files/Google/Chrome/Application/chrome.exe"];
const executablePath = candidates.find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });
const open = async (placement) => {
  await page.evaluate((p) => { localStorage.setItem("lfaa:terminal-placement", p); }, placement);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-columns]", { timeout: 60000 });
  await page.waitForTimeout(2200);
};
const clickRail = async () => {
  const btn = page.locator('[data-region="context-panel"] button[aria-label="终端"]').first();
  if (await btn.count()) await btn.click();
  await page.waitForTimeout(1800);
};
const state = () => page.evaluate(() => ({
  dock: Boolean(document.querySelector("[data-bottom-dock]")),
  tabs: [...document.querySelectorAll('[role="tablist"] [role="tab"]')].map((t) => t.textContent?.trim()),
  xterm: Boolean(document.querySelector(".xterm-rows")),
}));
await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-columns]", { timeout: 60000 });
await page.waitForTimeout(1500);
const out = {};
await open("bottom"); await clickRail(); out.bottomRail = await state();
await open("right"); await clickRail(); out.rightRail = await state();
console.log(JSON.stringify({ ...out, errors: errors.slice(0, 4) }, null, 1));
await browser.close();
