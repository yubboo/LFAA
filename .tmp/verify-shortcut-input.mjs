// 临时验收脚本 2：标签切换键位 + 输入框内 Ctrl+Alt 组合放行（不入库）。
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

const tabState = () => page.evaluate(() => ({
  tabs: [...document.querySelectorAll('[role="tablist"] [role="tab"]')].map((t) => ({ label: t.textContent?.trim(), active: t.getAttribute("aria-selected") === "true" })),
}));

// 开两个标签页后切标签
await page.locator('[data-region="context-panel"] button[aria-label="新建浏览器标签页"]').first().click();
await page.waitForTimeout(600);
await page.locator('[data-region="context-panel"] button[aria-label="新建浏览器标签页"]').first().click();
await page.waitForTimeout(800);
const before = await tabState();
await page.keyboard.press("Control+Alt+PageUp");
await page.waitForTimeout(700);
const afterUp = await tabState();
await page.keyboard.press("Control+Alt+PageDown");
await page.waitForTimeout(700);
const afterDown = await tabState();

// 输入框里按 Ctrl+Alt+1 也要生效（打不出字符的组合放行）
const composer = page.locator("textarea").first();
if (await composer.count()) await composer.click();
const leftBefore = await page.evaluate(() => document.querySelector("[data-columns]")?.getAttribute("data-left-open"));
await page.keyboard.press("Control+Alt+Digit1");
await page.waitForTimeout(500);
const leftAfter = await page.evaluate(() => document.querySelector("[data-columns]")?.getAttribute("data-left-open"));
const typed = await page.evaluate(() => document.querySelector("textarea")?.value ?? "");

const activeIndex = (state) => state.tabs.findIndex((tab) => tab.active);
console.log(JSON.stringify({
  tabCount: before.tabs.length,
  activeBefore: activeIndex(before),
  activeAfterUp: activeIndex(afterUp),
  activeAfterDown: activeIndex(afterDown),
  inputShortcut: { leftBefore, leftAfter, typed },
}, null, 1));
console.log("errors:", JSON.stringify(errors.slice(0, 6)));
await browser.close();