import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
const candidates = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe","C:/Program Files/Microsoft/Edge/Application/msedge.exe","C:/Program Files/Google/Chrome/Application/chrome.exe"];
const executablePath = candidates.find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 140)); });
page.on("pageerror", (e) => errors.push(`PAGEERROR ${e.message.slice(0, 140)}`));
await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-columns]", { timeout: 60000 });
await page.waitForTimeout(1200);
const out = [];
for (const layout of ["chat-center", "preview-center"]) {
  await page.evaluate((l) => { localStorage.setItem("lfaa:layout-mode", JSON.stringify(l)); localStorage.setItem("lfaa:terminal-placement", "bottom"); localStorage.removeItem("lfaa:bottom-panel-height"); }, layout);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-columns]", { timeout: 60000 });
  await page.waitForTimeout(2500);
  const info = await page.evaluate(() => {
    const dock = document.querySelector('section[aria-label="底部终端"]')?.getBoundingClientRect();
    const cols = [...document.querySelectorAll("[data-columns] > *")].slice(0, 4).map((el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), w: Math.round(r.width), bottom: Math.round(r.bottom) }; });
    return { dock: dock ? { x: Math.round(dock.x), w: Math.round(dock.width), y: Math.round(dock.y), h: Math.round(dock.height) } : null, cols, xterm: Boolean(document.querySelector(".xterm-rows")), vh: window.innerHeight };
  });
  out.push({ layout, ...info });
  await page.screenshot({ path: `E:/lfaa/.tmp/shots/dockv2-${layout}.png` });
}
console.log(JSON.stringify({ out, errors: errors.slice(0, 4) }, null, 1));
await browser.close();
