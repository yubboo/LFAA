// 临时取证（配合把时长临时改成 2600ms）：中段帧 + 遮蔽状态。
import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
await context.addInitScript(() => window.localStorage.setItem("lfaa:appearance-mode", "dark"));
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
await page.goto("http://127.0.0.1:5173/", { waitUntil: "load" });
await page.waitForSelector('main[data-region="workspace"]', { timeout: 20000 });
await page.waitForTimeout(800);
await page.locator('[data-region="section-navigation"]').getByText("查看一下目录", { exact: false }).first().click();
await page.waitForTimeout(2000);

const read = () => page.evaluate(() => {
  const chat = document.querySelector('main[data-region="workspace"]');
  const shell = chat.parentElement;
  const panel = shell.querySelector('[data-pane-side="right"]');
  const kid = panel.firstElementChild;
  return {
    veil: panel.getAttribute("data-anim-veil"),
    chatPinned: (chat.getAttribute("style") ?? "").includes("position: absolute"),
    panelPinned: (panel.getAttribute("style") ?? "").includes("position: absolute"),
    layer: Boolean(shell.querySelector("[data-pane-anim]")),
    kidVis: kid ? getComputedStyle(kid).visibility : "none",
    panelBg: getComputedStyle(panel).backgroundColor,
  };
});

const shots = [];
const marks = [];
for (const label of ["max", "restore"]) {
  await page.keyboard.press("Control+Shift+M");
  for (const at of [500, 1100, 1900]) {
    await page.waitForTimeout(at === 500 ? 500 : 600);
    marks.push({ label, at, ...(await read()) });
    const path = `shots/pane-slowmo-${label}-${at}.png`;
    await page.screenshot({ path });
    shots.push(path);
  }
  await page.waitForTimeout(1400);
}
console.log(JSON.stringify({ marks, errors, shots }, null, 2));
await browser.close();