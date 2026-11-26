// 临时验收（浅色主题）：最大化/还原在浅色下的遮蔽底色、报错与中段帧。
import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });
await context.addInitScript(() => window.localStorage.setItem("lfaa:appearance-mode", "light"));
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
await page.goto("http://127.0.0.1:5173/", { waitUntil: "load" });
await page.waitForSelector('main[data-region="workspace"]', { timeout: 20000 });
await page.waitForTimeout(800);
await page.locator('[data-region="section-navigation"]').getByText("查看一下目录", { exact: false }).first().click();
await page.waitForTimeout(1800);

const samples = [];
await page.evaluate(() => {
  const chat = document.querySelector('main[data-region="workspace"]');
  const shell = chat.parentElement;
  const panel = shell.querySelector('[data-pane-side="right"]');
  window.__s = [];
  const tick = () => {
    if (chat.getAttribute("style")) {
      window.__s.push({
        t: Math.round(performance.now()),
        veil: panel.getAttribute("data-anim-veil"),
        bg: getComputedStyle(panel).backgroundColor,
        chatOpacity: getComputedStyle(chat).opacity,
      });
    }
    if (window.__s.length < 12) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
await page.keyboard.press("Control+Shift+M");
await page.waitForTimeout(120);
await page.screenshot({ path: "shots/pane-light-max.png" });
await page.waitForTimeout(700);
await page.keyboard.press("Control+Shift+M");
await page.waitForTimeout(120);
await page.screenshot({ path: "shots/pane-light-restore.png" });
await page.waitForTimeout(700);
const marks = await page.evaluate(() => window.__s.slice(0, 6));
console.log(JSON.stringify({ marks, errors }, null, 2));
await browser.close();