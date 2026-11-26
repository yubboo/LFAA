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
await page.evaluate(() => localStorage.setItem("lfaa:terminal-placement", "bottom"));
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-columns]", { timeout: 60000 });
await page.waitForTimeout(2500);
const count = await page.evaluate(() => document.querySelectorAll(".xterm-rows").length);
// 打开右栏终端标签（通过设置页把位置切到右侧再切回，模拟用户操作）
const info = await page.evaluate(() => ({
  dock: Boolean(document.querySelector('section[aria-label="底部终端"]')),
  terminals: document.querySelectorAll(".xterm-rows").length,
  hint: document.body.innerText.includes("终端已在底部面板"),
}));
console.log(JSON.stringify({ ...info, errors: errors.slice(0, 3) }, null, 1));
await browser.close();
