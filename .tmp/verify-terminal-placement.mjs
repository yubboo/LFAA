// 临时验收：底部终端面板 + 位置切换 + 持久化（不入库）。
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
  localStorage.setItem("lfaa:layout-mode", JSON.stringify("chat-center"));
  localStorage.removeItem("lfaa:terminal-placement");
  localStorage.removeItem("lfaa:bottom-panel-open");
});
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-columns]", { timeout: 60000 });
await page.waitForTimeout(2500);

const state = () => page.evaluate(() => {
  const shell = document.querySelector("[data-columns]");
  const dock = document.querySelector("[data-bottom-dock]");
  return {
    placement: localStorage.getItem("lfaa:terminal-placement"),
    bottomOpen: shell?.getAttribute("data-bottom-open"),
    dockExists: Boolean(dock),
    dockRect: dock ? { x: Math.round(dock.getBoundingClientRect().x), y: Math.round(dock.getBoundingClientRect().y), w: Math.round(dock.getBoundingClientRect().width), h: Math.round(dock.getBoundingClientRect().height) } : null,
    dockTabs: dock ? [...dock.querySelectorAll('[role="tab"]')].map((t) => t.textContent?.trim()) : [],
    terminalRows: dock?.querySelector(".xterm-rows")?.textContent?.slice(0, 60) ?? "",
  };
});

// 默认右侧：打开终端标签
const out = { defaultState: await state() };
await page.locator('[data-region="context-panel"] button[aria-label="终端"]').first().click();
await page.waitForTimeout(2000);
out.rightOpen = await state();
await page.screenshot({ path: `${shotDir}/terminal-placement-right.png` });

// 切到底部
const moveBtn = page.getByRole("button", { name: "移到下方" }).first();
out.moveBtnCount = await moveBtn.count();
if (await moveBtn.count()) await moveBtn.click();
await page.waitForTimeout(2000);
out.afterMoveBottom = await state();
await page.screenshot({ path: `${shotDir}/terminal-placement-bottom.png` });

// 在底部终端里敲命令
const ta = page.locator('[data-bottom-dock] .xterm-helper-textarea').first();
if (await ta.count()) { await ta.click({ force: true }).catch(() => {}); }
await page.keyboard.type("echo bottom-ok");
await page.keyboard.press("Enter");
await page.waitForTimeout(2000);
out.bottomScreen = await page.evaluate(() => document.querySelector('[data-bottom-dock] .xterm-rows')?.textContent?.slice(-120) ?? "");

// 刷新后位置保持
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-columns]", { timeout: 60000 });
await page.waitForTimeout(2500);
out.afterReload = await state();

// 切回右栏
const moveBack = page.getByRole("button", { name: "移到右栏" }).first();
out.moveBackCount = await moveBack.count();
if (await moveBack.count()) await moveBack.click();
await page.waitForTimeout(2000);
out.backToRight = await state();
await page.screenshot({ path: `${shotDir}/terminal-placement-back.png` });

console.log(JSON.stringify(out, null, 1));
console.log("errors:", JSON.stringify(errors.slice(0, 6)));
await browser.close();