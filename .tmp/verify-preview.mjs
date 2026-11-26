// 临时验收脚本：预览区在左时关闭最后一个标签页，检查预览列收起、AI 会话列独占宽度（不入库）。
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
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  // 深色/浅色用系统配色模拟，避免直接改主题存储被外观配置覆盖。
  colorScheme: (process.argv[3] ?? "light") === "dark" ? "dark" : "light",
});
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(`PAGEERROR ${e.message}`));

const url = process.argv[2] ?? "http://127.0.0.1:5173/";
const theme = process.argv[3] ?? "light";
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-columns]", { timeout: 90000 });
await page.evaluate((mode) => {
  localStorage.setItem("lfaa:layout-mode", JSON.stringify("preview-center"));
  // appearance 模式按原始字符串存储；用 system 跟随上面模拟的配色方案。
  localStorage.setItem("lfaa:appearance-mode", "system");
}, theme);
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
      theme: document.documentElement.dataset.resolvedTheme ?? document.documentElement.dataset.theme,
      layout: shell?.getAttribute("data-layout"),
      rightOpen: shell?.getAttribute("data-right-open"),
      previewOpen: shell?.getAttribute("data-preview-open"),
      chatWidth: rect(workspace),
      panelWidth: rect(panel),
      tabs: [...document.querySelectorAll('[role="tablist"] [role="tab"]')].map((t) => t.textContent?.trim()),
    };
  });
  console.log(`${theme} ${label}`, JSON.stringify(state));
  await page.screenshot({ path: `${shotDir}/${theme}-${label}.png` });
}

await report("1-default");

// 打开一个真实标签页（空白页上的「终端」入口）。
await page.locator('[data-region="context-panel"] button', { hasText: "终端" }).first().click();
await page.waitForTimeout(900);
await report("2-terminal-open");

// 关闭最后一个标签页：应只收起预览列，AI 会话列接满剩余宽度。
await page.keyboard.press("Control+Alt+KeyW");
await page.waitForTimeout(1000);
await report("3-last-tab-closed");

// 重新打开工作台内容（概览菜单 → 终端），预览列要回来。
await page.keyboard.press("Control+Alt+KeyO");
await page.waitForTimeout(500);
const terminalItem = page.locator('[class*="menuItem"]', { hasText: "终端" }).first();
if (await terminalItem.count()) {
  await terminalItem.click();
} else {
  console.log("no overview terminal entry found");
}
await page.waitForTimeout(1200);
await report("4-reopen-from-menu");

// 侧面板开关：预览列正常时收起会话列，工作台铺满；再点一次恢复。
await page.keyboard.press("Control+Shift+KeyB");
await page.waitForTimeout(700);
await report("5-chat-collapsed");
await page.keyboard.press("Control+Shift+KeyB");
await page.waitForTimeout(700);
await report("6-chat-restored");

console.log("errors:", JSON.stringify(errors.slice(0, 6)));
await browser.close();