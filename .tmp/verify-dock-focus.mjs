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
await page.evaluate(() => { localStorage.setItem("lfaa:terminal-placement", "bottom"); });
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-columns]", { timeout: 60000 });
await page.waitForTimeout(2500);
const before = await page.evaluate(() => ({
  dock: Boolean(document.querySelector('section[aria-label="底部终端"]')),
  tabs: [...document.querySelectorAll('[role="tablist"] [role="tab"]')].map((t) => t.textContent?.trim()),
}));
// 点图标轨的「终端」：应聚焦底部终端、不新增右栏标签
const rail = page.locator('[data-region="context-panel"] button[aria-label="终端"]').first();
if (await rail.count()) await rail.click();
await page.waitForTimeout(1200);
const after = await page.evaluate(() => ({
  dock: Boolean(document.querySelector('section[aria-label="底部终端"]')),
  tabs: [...document.querySelectorAll('[role="tablist"] [role="tab"]')].map((t) => t.textContent?.trim()),
  focused: document.activeElement?.className?.includes("xterm-helper-textarea") ?? false,
}));
console.log(JSON.stringify({ before, after, errors: errors.slice(0, 3) }, null, 1));
await browser.close();
