// 临时取证：真实会话下最大化动画的中段帧（看遮蔽与接缝是否体面）。
import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
await context.addInitScript(() => window.localStorage.setItem("lfaa:appearance-mode", "dark"));
const page = await context.newPage();
await page.goto("http://127.0.0.1:5173/", { waitUntil: "load" });
await page.waitForSelector('main[data-region="workspace"]', { timeout: 20000 });
await page.waitForTimeout(800);
await page.locator('[data-region="section-navigation"]').getByText("查看一下目录", { exact: false }).first().click();
await page.waitForTimeout(2000);

// 用一次性动画帧回调精确停在动画中段，避免截图抖动带来的时间误差。
await page.evaluate(() => {
  window.__marks = [];
  const chat = document.querySelector('main[data-region="workspace"]');
  const start = performance.now();
  const tick = () => {
    const pinned = Boolean(chat.getAttribute("style"));
    if (pinned) window.__marks.push(Math.round(performance.now() - start));
    if (window.__marks.length < 20) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
await page.keyboard.press("Control+Shift+M");
for (const at of [60, 110, 170]) {
  await page.waitForTimeout(at === 60 ? 60 : 50);
  await page.screenshot({ path: `shots/pane-session-mid-${at}.png` });
}
await page.waitForTimeout(600);
console.log(JSON.stringify(await page.evaluate(() => window.__marks.slice(0, 8))));
await browser.close();