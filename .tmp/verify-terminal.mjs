// 临时验收脚本：真实终端——打开「终端」标签、跑一条命令、确认输出（不入库）。
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
await page.waitForTimeout(2000);
await page.evaluate(() => {
  localStorage.setItem("lfaa:layout-mode", JSON.stringify("chat-center"));
});
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-columns]", { timeout: 60000 });
await page.waitForTimeout(2500);

// 右栏图标轨里的「终端」
const shellBtn = page.locator('[data-region="context-panel"] button[aria-label="终端"]').first();
console.log("terminal rail count:", await shellBtn.count());
if (await shellBtn.count()) await shellBtn.click();
await page.waitForTimeout(2500);

const hasHost = await page.locator('[data-testid="terminal-host"]').count();
const screenText = await page.evaluate(() => document.querySelector('[data-testid="terminal-host"] .xterm-rows')?.textContent ?? "");
console.log("terminal host:", hasHost, "initial screen:", JSON.stringify(screenText.slice(0, 120)));

// 输入一条命令（xterm 的隐藏 textarea 接键盘）
await page.locator('[data-testid="terminal-host"] .xterm-helper-textarea').first().click({ force: true }).catch(() => {});
await page.keyboard.type("echo hello-lfaa");
await page.keyboard.press("Enter");
await page.waitForTimeout(2500);
const after = await page.evaluate(() => document.querySelector('[data-testid="terminal-host"] .xterm-rows')?.textContent ?? "");
console.log("after:", JSON.stringify(after.slice(-220)));
await page.screenshot({ path: `${shotDir}/terminal-right.png` });
console.log("errors:", JSON.stringify(errors.slice(0, 8)));
await browser.close();