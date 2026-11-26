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
await page.evaluate(() => { localStorage.setItem("lfaa:terminal-placement", "bottom"); localStorage.removeItem("lfaa:bottom-dock-visible"); });
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-columns]", { timeout: 60000 });
await page.waitForTimeout(2200);
const state = () => page.evaluate(() => ({
  dock: Boolean(document.querySelector('section[aria-label="底部终端"]')),
  terminals: document.querySelectorAll(".xterm-rows").length,
}));
const opened = await state();
const closeBtn = page.getByRole("button", { name: "关闭终端" }).first();
const closeCount = await closeBtn.count();
if (closeCount) await closeBtn.click();
await page.waitForTimeout(900);
const closed = await state();
// Ctrl+↓ 应重新展开
await page.keyboard.press("Control+ArrowDown");
await page.waitForTimeout(1200);
const reopened = await state();
console.log(JSON.stringify({ opened, closeCount, closed, reopened, errors: errors.slice(0, 3) }, null, 1));
await browser.close();
