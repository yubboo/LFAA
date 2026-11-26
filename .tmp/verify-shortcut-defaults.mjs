// 临时验收脚本：新默认快捷键真的生效、旧冲突键位不再绑定、提示同步（不入库）。
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
await page.evaluate(() => {
  localStorage.setItem("lfaa:layout-mode", JSON.stringify("chat-center"));
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
  };
});

async function press(keys) {
  await page.keyboard.press(keys);
  await page.waitForTimeout(500);
}

const results = {};
results.start = await attrs();

// 新键位：左二栏 / 右栏
await press("Control+Alt+Digit1");
results.afterCtrlAlt1 = await attrs();
await press("Control+Alt+Digit1");
await press("Control+Alt+Digit2");
results.afterCtrlAlt2 = await attrs();
await press("Control+Alt+Digit2");

// 旧冲突键位：Ctrl+Shift+S 不应再切换左二栏
results.beforeOld = await attrs();
await press("Control+Shift+KeyS");
results.afterCtrlShiftS = await attrs();

// 搜索（Ctrl+Alt+K）应打开搜索框
await press("Control+Alt+KeyK");
results.searchOpen = await page.evaluate(() => Boolean(document.querySelector('input[placeholder*="搜索会话"], input[placeholder*="Search chats"]')));
await page.keyboard.press("Escape");

// 快捷键设置页直达（Ctrl+Alt+/）
await press("Control+Alt+Slash");
results.shortcutSettings = await page.evaluate(() => document.body.innerText.includes("键盘快捷键"));
await page.keyboard.press("Escape");

// 提示文本：左二开关的气泡应显示 Ctrl+Alt+1
const leftToggle = page.locator('header button[aria-label*="左二会话项目菜单栏"]').first();
await leftToggle.hover();
await page.waitForTimeout(500);
results.leftToggleTip = await page.evaluate(() => {
  const tips = [...document.querySelectorAll("body *")].map((el) => el.textContent ?? "");
  return tips.some((text) => text.includes("Ctrl+Alt+1"));
});
await page.screenshot({ path: `${shotDir}/shortcut-new-defaults.png` });

console.log(JSON.stringify(results, null, 1));
console.log("errors:", JSON.stringify(errors.slice(0, 6)));
await browser.close();