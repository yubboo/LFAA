// 临时验收：预览区在左时，收起/展开按钮是否只出现在窗口最右缘。
import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
await context.addInitScript(() => {
  window.localStorage.setItem("lfaa:appearance-mode", "dark");
  window.localStorage.setItem("lfaa:layout-mode", JSON.stringify("preview-center"));
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto("http://127.0.0.1:5173/", { waitUntil: "load" });
await page.waitForTimeout(3000);

const toggles = async () => page.evaluate(() => Array.from(document.querySelectorAll('button[aria-label*="侧面板"]')).map((el) => {
  const b = el.getBoundingClientRect();
  return { label: el.getAttribute("aria-label"), x: Math.round(b.x), right: Math.round(b.right) };
}));

const out = { expanded: await toggles() };
const chatBtn = page.locator('main[data-region="workspace"] button[aria-label*="侧面板"]').first();
out.chatToggleCount = await chatBtn.count();
if (await chatBtn.count()) {
  await chatBtn.click();
  await page.waitForTimeout(600);
}
out.collapsed = { toggles: await toggles(), chat: await page.evaluate(() => Boolean(document.querySelector('main[data-region="workspace"]'))) };
await page.screenshot({ path: "shots/preview-toggle-final.png" });
out.errors = errors;
console.log(JSON.stringify(out, null, 2));
await browser.close();