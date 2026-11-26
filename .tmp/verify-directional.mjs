// 临时验收：Ctrl+← / Ctrl+→ / Ctrl+↓ 三栏直觉键位（输入框内不抢按词移动）（不入库）。
import { existsSync, mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const candidates = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
];
const executablePath = candidates.find((p) => existsSync(p));
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
await page.evaluate(() => {
  localStorage.setItem("lfaa:layout-mode", JSON.stringify("preview-center"));
  localStorage.removeItem("lfaa:shortcut-bindings:v1");
});
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-columns]", { timeout: 60000 });
await page.waitForTimeout(2000);

const attrs = () => page.evaluate(() => {
  const shell = document.querySelector("[data-columns]");
  return {
    leftOpen: shell?.getAttribute("data-left-open"),
    rightOpen: shell?.getAttribute("data-right-open"),
    tabs: [...document.querySelectorAll('[role="tablist"] [role="tab"]')].map((t) => t.textContent?.trim()),
  };
});

const out = { start: await attrs() };
await page.keyboard.press("Control+ArrowLeft");
await page.waitForTimeout(500);
out.afterCtrlLeft = await attrs();
await page.keyboard.press("Control+ArrowLeft");
await page.waitForTimeout(500);
await page.keyboard.press("Control+ArrowRight");
await page.waitForTimeout(500);
out.afterCtrlRight = await attrs();
await page.keyboard.press("Control+ArrowRight");
await page.waitForTimeout(500);
await page.keyboard.press("Control+ArrowDown");
await page.waitForTimeout(1200);
out.afterCtrlDown = await attrs();

// 输入框里按 Ctrl+← 不应切栏（保留按词移动光标）
const composer = page.locator("textarea").first();
if (await composer.count()) {
  await composer.click();
  await page.keyboard.press("Control+ArrowLeft");
  await page.waitForTimeout(400);
}
out.afterCtrlLeftInInput = await attrs();
await page.screenshot({ path: `${shotDir}/shortcut-directional.png` });

console.log(JSON.stringify(out, null, 1));
console.log("errors:", JSON.stringify(errors.slice(0, 6)));
await browser.close();