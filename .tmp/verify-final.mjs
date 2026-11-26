// 临时验收脚本：预览区在左的四条路径——关最后一个标签、展开、收起/展回、点文件（不入库）。
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
    return {
      previewOpen: shell?.getAttribute("data-preview-open"),
      rightOpen: shell?.getAttribute("data-right-open"),
      chatWidth: rect(workspace),
      panelWidth: rect(panel),
      toggleLabel: document.querySelector("header button[aria-label*='菜单栏']")?.getAttribute("aria-label") ?? null,
      tabs: [...document.querySelectorAll('[role="tablist"] [role="tab"]')].map((t) => t.textContent?.trim()),
    };
  });
  console.log(label, JSON.stringify(info));
  await page.screenshot({ path: `${shotDir}/final-${label}.png` });
}

await state("1-split");

// A) 收起会话列：工作台铺满（老样子）
await page.keyboard.press("Control+Shift+KeyB");
await page.waitForTimeout(800);
await state("2-chat-collapsed");

// B) 工作台顶栏那枚按钮再把会话列展回来：应恢复分屏，而不是让会话列吃掉整片
const panelToggle = page.locator('[data-region="context-panel"] button[aria-label*="切换侧面板"]').first();
console.log("panel toggle count:", await panelToggle.count());
if (await panelToggle.count()) {
  await panelToggle.click();
  await page.waitForTimeout(900);
}
await state("3-chat-back");

// C) 关掉最后一个标签：预览列收起，会话列吃满
await page.keyboard.press("Control+Shift+KeyB"); // 先收起会话列，让工作台露出来
await page.waitForTimeout(700);
await page.locator('[data-region="context-panel"] button', { hasText: "终端" }).first().click();
await page.waitForTimeout(600);
await page.keyboard.press("Control+Shift+KeyB"); // 会话列回来
await page.waitForTimeout(600);
await page.keyboard.press("Control+Alt+KeyW"); // 关掉最后一个标签
await page.waitForTimeout(900);
await state("4-preview-closed-chat-full");

// D) 点展开：恢复分屏（新开一个空白标签页）
await page.keyboard.press("Control+Shift+KeyB");
await page.waitForTimeout(900);
await state("5-expand-split");

// E) 点文件：分屏打开
const file = page.getByText("AGENTS.md", { exact: true }).first();
if (await file.count()) { await file.click(); await page.waitForTimeout(1500); }
await state("6-open-file-split");
console.log("errors:", JSON.stringify(errors.slice(0, 6)));
await browser.close();