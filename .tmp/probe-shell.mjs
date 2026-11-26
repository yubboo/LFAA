import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
const candidates = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe","C:/Program Files/Microsoft/Edge/Application/msedge.exe","C:/Program Files/Google/Chrome/Application/chrome.exe"];
const executablePath = candidates.find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 400)); });
page.on("pageerror", (e) => errors.push(`PAGEERROR ${e.message.slice(0, 400)}`));
await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(6000);
const info = await page.evaluate(() => ({
  hasShell: Boolean(document.querySelector("[data-columns]")),
  text: (document.body.innerText || "").slice(0, 200),
  railButtons: [...document.querySelectorAll('[data-region="context-panel"] button[aria-label]')].map((b) => b.getAttribute("aria-label")),
}));
console.log(JSON.stringify(info, null, 1));
console.log("errors:", JSON.stringify(errors.slice(0, 5), null, 1));
await browser.close();
