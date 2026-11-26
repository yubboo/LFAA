// 临时验收脚本：工作台收起时按 Ctrl+Alt+B，应自动展开并新建标签页（两种排版都测）（不入库）。
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
const errors = [];

async function run(layout, label) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("console", (m) => { if (m.type() === "error") errors.push(`${label}: ${m.text()}`); });
  page.on("pageerror", (e) => errors.push(`${label}: PAGEERROR ${e.message}`));
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-columns]", { timeout: 60000 });
  await page.waitForTimeout(1200);
  const projectRow = page.locator('button, [role="button"]').filter({ hasText: /^lfaa$/ }).first();
  if (await projectRow.count()) { await projectRow.click(); await page.waitForTimeout(700); }
  await page.evaluate((mode) => {
    localStorage.setItem("lfaa:sidebar-mode", JSON.stringify("project"));
    localStorage.setItem("lfaa:layout-mode", JSON.stringify(mode));
  }, layout);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-columns]", { timeout: 60000 });
  await page.waitForTimeout(2200);

  const state = async (tag) => {
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
        tabs: [...document.querySelectorAll('[role="tablist"] [role="tab"]')].map((t) => t.textContent?.trim()),
      };
    });
    console.log(`${label} ${tag}`, JSON.stringify(info));
    await page.screenshot({ path: `${shotDir}/shortcut-${label}-${tag}.png` });
  };

  await state("1-before");
  // 收起工作台：聊天区在左 = 收右栏；预览区在左 = 关掉最后一个标签
  if (layout === "preview-center") {
    await page.locator('[data-region="context-panel"] button', { hasText: "终端" }).first().click().catch(() => {});
    await page.waitForTimeout(600);
    await page.keyboard.press("Control+Alt+KeyW");
    await page.waitForTimeout(800);
  } else {
    await page.keyboard.press("Control+Shift+KeyB");
    await page.waitForTimeout(800);
  }
  await state("2-workbench-collapsed");

  await page.keyboard.press("Control+Alt+KeyB");
  await page.waitForTimeout(1600);
  await state("3-after-shortcut");
  await page.close();
}

await run("preview-center", "preview");
await run("chat-center", "chat");
console.log("errors:", JSON.stringify(errors.slice(0, 8)));
await browser.close();