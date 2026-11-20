import { chromium } from "playwright-core";
const browser = await chromium.launch({ executablePath: process.argv[2], headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await page.locator("textarea").first().fill("用 glob 找一下当前工作区有多少个 md 文件，只回数字");
await page.locator("textarea").first().press("Enter");
const seen = new Set();
for (let i = 0; i < 16; i++) {
  await page.waitForTimeout(600);
  const line = await page.evaluate(() => {
    const el = document.querySelector('[role="status"]');
    return el ? (el.textContent || "").trim() : "";
  });
  if (line) seen.add(line);
}
await page.screenshot({ path: "C:\\Windows\\Temp\\lfaa-inplace.png" });
console.log(JSON.stringify({ labels: [...seen].slice(0, 6) }));
await browser.close();
