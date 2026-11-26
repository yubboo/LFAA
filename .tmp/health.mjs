// 临时健康检查：确认当前客户端无 Vite 报错遮罩，预览区在左的关闭流程正常（不入库）。
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
await page.evaluate(() => localStorage.setItem("lfaa:layout-mode", JSON.stringify("preview-center")));
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-columns]", { timeout: 60000 });
await page.waitForTimeout(1200);
console.log("overlay:", await page.locator("vite-error-overlay").count());
console.log("state1:", await page.evaluate(() => {
  const shell = document.querySelector("[data-columns]");
  const panel = document.querySelector('[data-region="context-panel"]');
  return {
    previewOpen: shell?.getAttribute("data-preview-open"),
    rightOpen: shell?.getAttribute("data-right-open"),
    panelWidth: panel ? Math.round(panel.getBoundingClientRect().width) : 0,
  };
}));
await page.locator('[data-region="context-panel"] button', { hasText: "终端" }).first().click();
await page.waitForTimeout(700);
await page.keyboard.press("Control+Alt+KeyW");
await page.waitForTimeout(1000);
console.log("state2:", await page.evaluate(() => {
  const shell = document.querySelector("[data-columns]");
  const workspace = document.querySelector("main[data-region]");
  return {
    previewOpen: shell?.getAttribute("data-preview-open"),
    rightOpen: shell?.getAttribute("data-right-open"),
    chatWidth: workspace ? Math.round(workspace.getBoundingClientRect().width) : 0,
  };
}));
console.log("errors:", JSON.stringify(errors.slice(0, 5)));
await browser.close();