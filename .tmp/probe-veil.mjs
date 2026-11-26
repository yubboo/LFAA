// 临时排查：动画期间外壳/两块的真实内联状态（是否还在编排中）。
import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
await context.addInitScript(() => window.localStorage.setItem("lfaa:appearance-mode", "dark"));
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 400)));
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(`[${m.type()}] ${m.text().slice(0, 300)}`); });
await page.goto("http://127.0.0.1:5173/", { waitUntil: "load" });
await page.waitForSelector('main[data-region="workspace"]', { timeout: 20000 });
await page.waitForTimeout(800);
await page.locator('[data-region="section-navigation"]').getByText("查看一下目录", { exact: false }).first().click();
await page.waitForTimeout(2000);

const read = () => page.evaluate(() => {
  const chat = document.querySelector('main[data-region="workspace"]');
  const shell = chat.parentElement;
  const kids = [...shell.children].map((el) => `${el.tagName.toLowerCase()}${el.getAttribute("data-pane-side") ?? ""}${el.getAttribute("data-pane-anim") ? "|layer" : ""}`);
  return {
    chatStyle: (chat.getAttribute("style") ?? "").slice(0, 120),
    shellTransition: shell.style.transition,
    layer: Boolean(shell.querySelector("[data-pane-anim]")),
    kids,
    panelCount: shell.querySelectorAll('[data-pane-side="right"]').length,
  };
});

await page.keyboard.press("Control+Shift+M");
await page.waitForTimeout(400);
const a = await read();
await page.waitForTimeout(800);
const b = await read();
await page.waitForTimeout(1800);
const c = await read();
console.log(JSON.stringify({ a, b, c, errors }, null, 2));
await browser.close();