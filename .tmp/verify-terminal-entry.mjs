import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
const candidates = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe","C:/Program Files/Microsoft/Edge/Application/msedge.exe","C:/Program Files/Google/Chrome/Application/chrome.exe"];
const executablePath = candidates.find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-columns]", { timeout: 60000 });
await page.waitForTimeout(1500);
await page.evaluate(() => { localStorage.removeItem("lfaa:terminal-placement"); localStorage.removeItem("lfaa:bottom-panel-open"); });
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-columns]", { timeout: 60000 });
await page.waitForTimeout(2500);
const out = {};
// 1) 起始页「打开」里的终端卡片
const card = page.getByRole("button", { name: /^终端$/ }).first();
out.cardCount = await card.count();
if (await card.count()) await card.click();
await page.waitForTimeout(2500);
out.afterCard = await page.evaluate(() => ({
  xterm: Boolean(document.querySelector(".xterm-rows")),
  screen: document.querySelector(".xterm-rows")?.textContent?.slice(0, 40) ?? "",
  tab: [...document.querySelectorAll('[role="tablist"] [role="tab"]')].map((t) => t.textContent?.trim()),
}));
await page.screenshot({ path: "E:/lfaa/.tmp/shots/terminal-entry-fixed.png" });
// 2) 设置中心 → 终端
await page.keyboard.press("Control+Alt+Comma");
await page.waitForTimeout(1200);
const nav = page.getByRole("button", { name: /^终端$/ }).last();
out.settingsNavCount = await nav.count();
if (await nav.count()) await nav.click();
await page.waitForTimeout(1200);
out.settingsPage = await page.evaluate(() => document.body.innerText.includes("展示位置"));
const bottomOption = page.getByRole("radio", { name: /底部面板/ }).first();
out.bottomOption = await bottomOption.count();
if (await bottomOption.count()) await bottomOption.click();
await page.waitForTimeout(1500);
await page.keyboard.press("Escape");
await page.waitForTimeout(1200);
out.afterSettingsSwitch = await page.evaluate(() => ({ dock: Boolean(document.querySelector("[data-bottom-dock]")), placement: localStorage.getItem("lfaa:terminal-placement") }));
await page.screenshot({ path: "E:/lfaa/.tmp/shots/settings-terminal.png" });
console.log(JSON.stringify({ ...out, errors: errors.slice(0, 5) }, null, 1));
await browser.close();
