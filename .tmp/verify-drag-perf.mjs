import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
const candidates = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe","C:/Program Files/Microsoft/Edge/Application/msedge.exe","C:/Program Files/Google/Chrome/Application/chrome.exe"];
const executablePath = candidates.find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 140)); });
page.on("pageerror", (e) => errors.push(`PAGEERROR ${e.message.slice(0, 140)}`));
await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-columns]", { timeout: 60000 });
await page.waitForTimeout(1500);
await page.evaluate(() => { localStorage.setItem("lfaa:terminal-placement", "bottom"); localStorage.removeItem("lfaa:bottom-panel-height"); });
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-columns]", { timeout: 60000 });
await page.waitForTimeout(2500);
const h = () => page.evaluate(() => Math.round(document.querySelector('section[aria-label="底部终端"]')?.getBoundingClientRect().height ?? 0));
const before = await h();
// 拖动手柄：记录拖动过程中是否卡顿（用帧间隔采样）
const handle = page.locator('section[aria-label="底部终端"] > div').first();
const box = await handle.boundingBox();
let frames = [];
if (box) {
  await page.mouse.move(box.x + box.width / 2, box.y + 3);
  await page.mouse.down();
  const t0 = Date.now();
  for (let i = 0; i < 10; i++) { await page.mouse.move(box.x + box.width / 2, box.y + 3 - (i + 1) * 12, { steps: 1 }); frames.push(Date.now() - t0); }
  await page.mouse.up();
}
await page.waitForTimeout(600);
const after = await h();
console.log(JSON.stringify({ before, after, dragMs: frames, errors: errors.slice(0, 3) }, null, 1));
await browser.close();
