// 临时复现脚本：预览区在左时关闭最后一个标签页，检查两列显隐（不入库）。
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

const url = process.argv[2] ?? "http://127.0.0.1:5173/";
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-columns]", { timeout: 60000 });
await page.evaluate(() => localStorage.setItem("lfaa:layout-mode", JSON.stringify("preview-center")));
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-columns]", { timeout: 60000 });
await page.waitForTimeout(1200);

async function report(label) {
  const state = await page.evaluate(() => {
    const shell = document.querySelector("[data-columns]");
    const workspace = document.querySelector("main[data-region]");
    const panel = document.querySelector('[data-region="context-panel"]');
    const cs = (el) => (el ? getComputedStyle(el).display : "missing");
    return {
      layout: shell?.getAttribute("data-layout"),
      rightOpen: shell?.getAttribute("data-right-open"),
      previewOpen: shell?.getAttribute("data-preview-open"),
      workspaceDisplay: cs(workspace),
      panelDisplay: cs(panel),
      chatVisible: workspace ? workspace.getBoundingClientRect().width : 0,
      panelWidth: panel ? panel.getBoundingClientRect().width : 0,
      tabs: [...document.querySelectorAll('[role="tablist"] [role="tab"]')].map((t) => t.textContent?.trim()),
    };
  });
  console.log(label, JSON.stringify(state));
  await page.screenshot({ path: `${shotDir}/${label}.png` });
}

await report("01-preview-center-default");

// 在空白「新标签页」上点「终端」，打开一个真实标签页。
const terminal = page.locator('[data-region="context-panel"] button', { hasText: "终端" }).first();
await terminal.click();
await page.waitForTimeout(800);
await report("02-open-terminal");

// 关闭最后一个标签。
const closeBtn = page.locator('[data-region="context-panel"] [aria-label="关闭 终端"]').first();
await closeBtn.click();
await page.waitForTimeout(900);
await report("03-after-close-last-tab");

console.log("errors:", JSON.stringify(errors.slice(0, 5)));
await browser.close();