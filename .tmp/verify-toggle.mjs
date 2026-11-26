// 临时验收脚本：预览列收起后，点「展开」必须恢复分屏（而不是预览区吃掉整片）（不入库）。
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
await page.evaluate(() => localStorage.setItem("lfaa:layout-mode", JSON.stringify("preview-center")));
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-columns]", { timeout: 60000 });
await page.waitForTimeout(1200);

async function report(label) {
  const state = await page.evaluate(() => {
    const shell = document.querySelector("[data-columns]");
    const workspace = document.querySelector("main[data-region]");
    const panel = document.querySelector('[data-region="context-panel"]');
    const rect = (el) => (el ? Math.round(el.getBoundingClientRect().width) : 0);
    return {
      previewOpen: shell?.getAttribute("data-preview-open"),
      rightOpen: shell?.getAttribute("data-right-open"),
      chatWidth: rect(workspace),
      panelWidth: rect(panel),
      // 顶栏那枚开关在收起态应显示「展开」，展开/分屏态显示「收起」。
      toggleLabels: [...document.querySelectorAll("button[aria-label]")]
        .map((b) => b.getAttribute("aria-label"))
        .filter((label) => label && /侧|栏|面板|pane|panel/i.test(label)),
    };
  });
  console.log(label, JSON.stringify(state));
  await page.screenshot({ path: `${shotDir}/toggle-${label}.png` });
}

await report("1-split");
await page.locator('[data-region="context-panel"] button', { hasText: "终端" }).first().click();
await page.waitForTimeout(700);
await page.keyboard.press("Control+Alt+KeyW");
await page.waitForTimeout(900);
await report("2-preview-closed");

// 收起态点「展开」：应恢复分屏
await page.keyboard.press("Control+Shift+KeyB");
await page.waitForTimeout(900);
await report("3-expand-from-closed");

// 分屏态再点：收最右侧的会话列，预览列铺满
await page.keyboard.press("Control+Shift+KeyB");
await page.waitForTimeout(900);
await report("4-collapse-chat");
await page.keyboard.press("Control+Shift+KeyB");
await page.waitForTimeout(900);
await report("5-restore-split");

console.log("errors:", JSON.stringify(errors.slice(0, 6)));
await browser.close();