// 临时探测：终端主题色与 xterm 实际行列/滚动条情况（不入库）。
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
await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-columns]", { timeout: 60000 });
await page.waitForTimeout(2000);
const shellBtn = page.locator('[data-region="context-panel"] button[aria-label="终端"]').first();
if (await shellBtn.count()) await shellBtn.click();
await page.waitForTimeout(2500);
const probe = await page.evaluate(() => {
  const root = getComputedStyle(document.documentElement);
  const host = document.querySelector('[data-testid="terminal-host"]');
  const screen = host?.querySelector(".xterm-screen");
  const viewport = host?.querySelector(".xterm-viewport");
  const rows = host?.querySelector(".xterm-rows");
  return {
    theme: document.documentElement.getAttribute("data-resolved-theme") ?? document.documentElement.getAttribute("data-theme"),
    codeBg: root.getPropertyValue("--color-code-bg").trim(),
    codeInk: root.getPropertyValue("--color-code-ink").trim(),
    surface: root.getPropertyValue("--color-surface").trim(),
    ink: root.getPropertyValue("--color-ink").trim(),
    hostBox: host ? { w: host.clientWidth, h: host.clientHeight } : null,
    screenCols: screen?.style.width,
    rowsHeight: rows?.style.height,
    viewport: viewport ? { scrollW: viewport.scrollWidth, clientW: viewport.clientWidth, scrollH: viewport.scrollHeight, clientH: viewport.clientHeight } : null,
    rowsColor: rows ? getComputedStyle(rows).color : null,
    styleTagsInHost: host ? host.querySelectorAll("style").length : -1,
  };
});
console.log(JSON.stringify(probe, null, 1));
await browser.close();