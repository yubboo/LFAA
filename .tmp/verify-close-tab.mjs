import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
const candidates = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe","C:/Program Files/Microsoft/Edge/Application/msedge.exe","C:/Program Files/Google/Chrome/Application/chrome.exe"];
const executablePath = candidates.find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });
page.on("pageerror", (e) => errors.push(`PAGEERROR ${e.message.slice(0, 160)}`));
await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-columns]", { timeout: 60000 });
await page.waitForTimeout(1500);
await page.evaluate(() => localStorage.setItem("lfaa:terminal-placement", "right"));
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-columns]", { timeout: 60000 });
await page.waitForTimeout(2200);
const tabs = () => page.evaluate(() => [...document.querySelectorAll('[role="tablist"] [role="tab"]')].map((t) => t.textContent?.trim()));
// 用图标轨打开终端
const rail = page.locator('[data-region="context-panel"] button[aria-label="终端"]').first();
if (await rail.count()) await rail.click();
await page.waitForTimeout(1500);
const opened = await tabs();
// 点该标签的关闭按钮
const closeBtn = page.locator('[role="tablist"] [role="tab"] >> text=终端').first().locator("xpath=following-sibling::button[1]");
let closeCount = await closeBtn.count();
if (closeCount) await closeBtn.click();
await page.waitForTimeout(1200);
const afterClose = await tabs();
// 再点一次 × （如果还在）
if (closeCount) { const again = page.locator('[role="tablist"] [role="tab"] >> text=终端').first().locator("xpath=following-sibling::button[1]"); if (await again.count()) await again.click(); await page.waitForTimeout(1000); }
const afterSecond = await tabs();
console.log(JSON.stringify({ opened, afterClose, afterSecond, closeCount, errors: errors.slice(0, 3) }, null, 1));
await browser.close();
