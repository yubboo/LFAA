// 临时验收：底部面板拖高（拖动手柄改高度并持久化）（不入库）。
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
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => errors.push(`PAGEERROR ${e.message.slice(0, 200)}`));

await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-columns]", { timeout: 60000 });
await page.waitForTimeout(1500);
await page.evaluate(() => {
  localStorage.setItem("lfaa:layout-mode", JSON.stringify("chat-center"));
  localStorage.setItem("lfaa:terminal-placement", "bottom");
  localStorage.removeItem("lfaa:bottom-panel-height");
});
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-columns]", { timeout: 60000 });
await page.waitForTimeout(3000);

const dockHeight = () => page.evaluate(() => Math.round(document.querySelector("[data-bottom-dock]")?.getBoundingClientRect().height ?? 0));
const before = await dockHeight();

// 手柄在面板上沿，往上拖 120px
const handle = page.locator("[data-bottom-dock] > div").first();
const box = await handle.boundingBox();
if (box) {
  await page.mouse.move(box.x + box.width / 2, box.y + 3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 3 - 120, { steps: 6 });
  await page.mouse.up();
}
await page.waitForTimeout(800);
const afterDrag = await dockHeight();
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-columns]", { timeout: 60000 });
await page.waitForTimeout(2500);
const afterReload = await dockHeight();

console.log(JSON.stringify({ before, afterDrag, afterReload, errors: errors.slice(0, 5) }, null, 1));
await page.screenshot({ path: "E:/lfaa/.tmp/shots/terminal-dock-resized.png" });
await browser.close();