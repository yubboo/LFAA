// 临时验收脚本：点「+」和新建标签快捷键能连续新建标签页（不入库）。
import { existsSync, mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const candidates = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
];
const executablePath = candidates.find((p) => existsSync(p));
if (!executablePath) throw new Error("no browser");
const shotDir = "E:/lfaa/.tmp/shots";
mkdirSync(shotDir, { recursive: true });

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(`PAGEERROR ${e.message}`));

await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-columns]", { timeout: 60000 });
await page.waitForTimeout(1500);
const projectRow = page.locator('button, [role="button"]').filter({ hasText: /^lfaa$/ }).first();
if (await projectRow.count()) { await projectRow.click(); await page.waitForTimeout(800); }
await page.evaluate(() => {
  localStorage.setItem("lfaa:sidebar-mode", JSON.stringify("project"));
  localStorage.setItem("lfaa:layout-mode", JSON.stringify("preview-center"));
});
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-columns]", { timeout: 60000 });
await page.waitForTimeout(2200);

async function state(label) {
  const info = await page.evaluate(() => ({
    tabs: [...document.querySelectorAll('[role="tablist"] [role="tab"]')].map((t) => t.textContent?.trim()),
    addBtn: document.querySelector('[data-region="context-panel"] button[aria-label="新建浏览器标签页"]') !== null,
  }));
  console.log(label, JSON.stringify(info));
  await page.screenshot({ path: `${shotDir}/newtab-${label}.png` });
}

await state("0-initial");
const add = page.locator('[data-region="context-panel"] button[aria-label="新建浏览器标签页"]').first();
for (let i = 1; i <= 3; i += 1) {
  await add.click();
  await page.waitForTimeout(700);
  await state(`plus-${i}`);
}
await page.keyboard.press("Control+Alt+KeyB");
await page.waitForTimeout(800);
await state("shortcut-1");
await page.keyboard.press("Control+Alt+KeyB");
await page.waitForTimeout(800);
await state("shortcut-2");
console.log("errors:", JSON.stringify(errors.slice(0, 6)));
await browser.close();