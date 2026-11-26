// 临时验收：内容可见性下，底部视图、锚点跳转与「复制整段文本」是否仍正常。
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const exe = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].find((p) => existsSync(p));
const session = process.argv[2] ?? "";
const browser = await chromium.launch({ executablePath: exe, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
if (session) await ctx.addInitScript(`try { localStorage.setItem("lfaa:active-chat-session-id", ${JSON.stringify(session)}); } catch {}`);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(10000);
await page.screenshot({ path: "E:/lfaa/.tmp/cv-bottom.png" });

const text = await page.evaluate(`(() => {
  const el = document.querySelector("[class*='scrollArea']");
  return { len: el.innerText.length, hasLast: el.innerText.includes("继续生成") };
})()`);
console.log("底部视图文本:", JSON.stringify(text));

// 锚点刻度：点第一格，看是否跳上去且有高亮
const ticks = page.locator("[class*='tickBtn']");
const n = await ticks.count();
if (n > 0) {
  const before = await page.evaluate(`Math.round(document.querySelector("[class*='scrollArea']").scrollTop)`);
  await ticks.first().click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(600);
  const after = await page.evaluate(`Math.round(document.querySelector("[class*='scrollArea']").scrollTop)`);
  const active = await page.locator("[class*='tickActive']").count();
  console.log(`锚点跳转: ticks=${n} scrollTop ${before} → ${after}，激活刻度=${active}`);
}
// 结束后回底
await page.evaluate(`(() => { const el = document.querySelector("[class*='scrollArea']"); el.scrollTop = el.scrollHeight; })()`);
await page.waitForTimeout(400);
console.log("errors:", errors.length ? errors.slice(0, 4) : "none");
await browser.close();