// 临时验收脚本 3：聊天区在左（默认排版）回归——关闭最后一个标签仍收起右侧工作台，会话区接满宽度（不入库）。
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

await page.goto(process.argv[2] ?? "http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-columns]", { timeout: 90000 });
await page.evaluate(() => localStorage.setItem("lfaa:layout-mode", JSON.stringify("chat-center")));
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-columns]", { timeout: 90000 });
await page.waitForTimeout(1500);

async function report(label) {
  const state = await page.evaluate(() => {
    const shell = document.querySelector("[data-columns]");
    const workspace = document.querySelector("main[data-region]");
    const panel = document.querySelector('[data-region="context-panel"]');
    const rect = (el) => (el ? Math.round(el.getBoundingClientRect().width) : 0);
    return {
      layout: shell?.getAttribute("data-layout"),
      previewOpen: shell?.getAttribute("data-preview-open"),
      rightOpen: shell?.getAttribute("data-right-open"),
      chatWidth: rect(workspace),
      panelWidth: rect(panel),
      tabs: [...document.querySelectorAll('[role="tablist"] [role="tab"]')].map((t) => t.textContent?.trim()),
    };
  });
  console.log(label, JSON.stringify(state));
  await page.screenshot({ path: `${shotDir}/chatcenter-${label}.png` });
}

await report("1-default");
await page.locator('[data-region="context-panel"] button', { hasText: "终端" }).first().click();
await page.waitForTimeout(800);
await report("2-terminal-open");
await page.keyboard.press("Control+Alt+KeyW");
await page.waitForTimeout(1000);
await report("3-last-tab-closed");
await page.keyboard.press("Control+Shift+KeyB");
await page.waitForTimeout(900);
await report("4-panel-reopened");
console.log("errors:", JSON.stringify(errors.slice(0, 6)));
await browser.close();