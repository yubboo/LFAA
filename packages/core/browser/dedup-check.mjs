// 插件卡片去重验收：内置标记只在右上角，装配状态在左下角，页面不再有重复的「已装配」按钮。
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const edge = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].find((candidate) => existsSync(candidate));

const browser = await chromium.launch({ executablePath: edge, headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
try {
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2600);
  await page.locator('[data-region="primary-navigation"] button[aria-label="插件"]').click();
  await page.getByText("插件中心", { exact: true }).first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(1200);

  const providedTexts = await page.getByText("已装配", { exact: true }).count();
  const buttons = await page.locator("[data-provided='true'] button").count();
  const builtinBadges = await page.getByText("内置", { exact: true }).count();
  await page.screenshot({ path: "C:\\Windows\\Temp\\lfaa-cards-dedup.png" });
  console.log(JSON.stringify({ providedTexts, disabledButtonsInProvidedCards: buttons, builtinBadges }, null, 2));
} finally {
  await browser.close();
}
