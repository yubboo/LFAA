// 临时验收脚本：预览区在左只保留一枚侧面板开关，并逐段验证它（点按钮，不用快捷键）（不入库）。
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
const projectRow = page.locator('button, [role="button"]').filter({ hasText: /^lfaa$/ }).first();
if (await projectRow.count()) { await projectRow.click(); await page.waitForTimeout(1000); }
await page.evaluate(() => {
  localStorage.setItem("lfaa:sidebar-mode", JSON.stringify("project"));
  localStorage.setItem("lfaa:layout-mode", JSON.stringify("preview-center"));
});
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-columns]", { timeout: 60000 });
await page.waitForTimeout(2200);

async function state(label) {
  const info = await page.evaluate(() => {
    const shell = document.querySelector("[data-columns]");
    const workspace = document.querySelector("main[data-region]");
    const panel = document.querySelector('[data-region="context-panel"]');
    const rect = (el) => (el ? Math.round(el.getBoundingClientRect().width) : 0);
    const labels = [...document.querySelectorAll("header button[aria-label]")]
      .map((b) => b.getAttribute("aria-label") ?? "")
      .filter((label) => /菜单栏|侧面板/.test(label));
    return {
      previewOpen: shell?.getAttribute("data-preview-open"),
      rightOpen: shell?.getAttribute("data-right-open"),
      chatWidth: rect(workspace),
      panelWidth: rect(panel),
      panelSwitches: labels,
      tabs: [...document.querySelectorAll('[role="tablist"] [role="tab"]')].map((t) => t.textContent?.trim()),
    };
  });
  console.log(label, JSON.stringify(info));
  await page.screenshot({ path: `${shotDir}/switch-${label}.png` });
}

await state("1-split");
// 点唯一那枚开关：收起会话列
await page.locator('header button[aria-label="收起右侧菜单栏"]').first().click();
await page.waitForTimeout(900);
await state("2-chat-collapsed");
// 工作台顶栏那枚按钮把会话列展回
await page.locator('[data-region="context-panel"] button[aria-label="切换侧面板 Ctrl+Alt+2"]').first().click();
await page.waitForTimeout(900);
await state("3-chat-back");
// 关掉最后一个标签：会话列吃满
await page.keyboard.press("Control+Alt+KeyW");
await page.waitForTimeout(900);
await state("4-preview-closed");
// 点「展开」：恢复分屏
await page.locator('header button[aria-label="展开右侧菜单栏"]').first().click();
await page.waitForTimeout(900);
await state("5-split-again");
console.log("errors:", JSON.stringify(errors.slice(0, 6)));
await browser.close();