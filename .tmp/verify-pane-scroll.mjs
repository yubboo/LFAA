// 临时验收（滚动专项）：真实会话里最大化/还原后，聊天滚动位置是否保持。
import { chromium } from "playwright-core";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
await context.addInitScript(() => window.localStorage.setItem("lfaa:appearance-mode", "dark"));
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 300)); });
await page.goto("http://127.0.0.1:5173/", { waitUntil: "load" });
await page.waitForSelector('main[data-region="workspace"]', { timeout: 20000 });
await page.waitForTimeout(800);

// 打开左二的第一条历史会话。
const row = page.locator('[data-region="section-navigation"]').getByText("你好", { exact: false }).first();
await row.click();
await page.waitForTimeout(2000);

const findScroller = () => page.evaluate(() => {
  const chat = document.querySelector('main[data-region="workspace"]');
  const all = [...chat.querySelectorAll("*")].filter((el) => el.scrollHeight > el.clientHeight + 60);
  const target = all.sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
  if (!target) return { found: false };
  target.setAttribute("data-verify-scroller", "1");
  return { found: true, top: Math.round(target.scrollTop), scrollHeight: Math.round(target.scrollHeight), clientHeight: Math.round(target.clientHeight) };
});

const readScroller = () => page.evaluate(() => {
  const el = document.querySelector("[data-verify-scroller]");
  if (!el) return { found: false };
  return { found: true, top: Math.round(el.scrollTop), connected: el.isConnected };
});

const found = await findScroller();
if (!found.found) {
  console.log(JSON.stringify({ 结果: "无滚动容器", found }, null, 2));
  await browser.close();
  process.exit(0);
}

// 停在中间位置，等滚动记忆落盘。
await page.evaluate(() => {
  const el = document.querySelector("[data-verify-scroller]");
  el.scrollTop = Math.round((el.scrollHeight - el.clientHeight) / 2);
});
await page.waitForTimeout(600);
const before = await readScroller();

const steps = {};
for (const [name, label] of [["最大化", "max"], ["还原", "restore"]]) {
  await page.keyboard.press("Control+Shift+M");
  await page.waitForTimeout(250);
  steps[`${name}中`] = await readScroller();
  await page.screenshot({ path: `shots/pane-session-${label}.png` });
  await page.waitForTimeout(900);
  steps[`${name}后`] = await readScroller();
}

console.log(JSON.stringify({ 容器: found, 切换前: before, steps, 报错: errors }, null, 2));
await browser.close();