// 临时验收脚本 2：预览列收起后的极端路径——最大化、侧面板开关都不会把两列一起收掉（不入库）。
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
await page.evaluate(() => localStorage.setItem("lfaa:layout-mode", JSON.stringify("preview-center")));
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
      rightOpen: shell?.getAttribute("data-right-open"),
      previewOpen: shell?.getAttribute("data-preview-open"),
      maximized: shell?.getAttribute("data-right-maximized"),
      chatWidth: rect(workspace),
      panelWidth: rect(panel),
    };
  });
  console.log(label, JSON.stringify(state));
  await page.screenshot({ path: `${shotDir}/edge-${label}.png` });
}

// 先造出「预览列已收起」的状态
await page.locator('[data-region="context-panel"] button', { hasText: "终端" }).first().click();
await page.waitForTimeout(800);
await page.keyboard.press("Control+Alt+KeyW");
await page.waitForTimeout(900);
await report("1-preview-closed");

// 最大化：必须先放出预览列，否则只会得到 0 宽会话列
await page.keyboard.press("Control+Shift+KeyM");
await page.waitForTimeout(900);
await report("2-maximize-from-closed");

await page.keyboard.press("Control+Shift+KeyM");
await page.waitForTimeout(900);
await report("3-restored");

// 收起预览列后再按侧面板开关：不能两列同时消失
await page.keyboard.press("Control+Alt+KeyW");
await page.waitForTimeout(900);
await report("4-preview-closed-again");
await page.keyboard.press("Control+Shift+KeyB");
await page.waitForTimeout(900);
await report("5-toggle-from-closed");
await page.keyboard.press("Control+Shift+KeyB");
await page.waitForTimeout(900);
await report("6-toggle-back");

console.log("errors:", JSON.stringify(errors.slice(0, 6)));
await browser.close();