// 临时验收：窗口化下滚到最顶部，确认日期分隔条与首条消息不重叠，并检查顶部/底部/锚点。
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const exe = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].find((p) => existsSync(p));
const url = process.argv[2] ?? "http://127.0.0.1:5173/";
const session = "00000000-0000-4000-8000-000000000001";
const browser = await chromium.launch({ executablePath: exe, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(`try { localStorage.setItem("lfaa:active-chat-session-id", ${JSON.stringify(session)}); } catch {}`);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(9000);

const info = () => page.evaluate(`(() => {
  const el = document.querySelector("[class*='scrollArea']");
  const divider = document.querySelector("[class*='dayDivider']");
  const firstRow = document.querySelector("[id^=chat-message-]");
  const rows = Array.from(document.querySelectorAll("[id^=chat-message-]")).map((n) => n.id);
  return {
    virtual: Boolean(document.querySelector("[class*='thread'][data-virtualized]")),
    top: Math.round(el.scrollTop), height: Math.round(el.scrollHeight),
    gap: Math.round(el.scrollHeight - el.clientHeight - el.scrollTop),
    dividerTop: divider ? Math.round(divider.getBoundingClientRect().top) : null,
    firstRowTop: firstRow ? Math.round(firstRow.getBoundingClientRect().top) : null,
    firstRowId: firstRow ? firstRow.id.slice(0, 24) : null,
    rows: rows.length,
  };
})()`);
console.log("初始", JSON.stringify(await info()));

// 最顶部
await page.evaluate(`(() => { const el = document.querySelector("[class*='scrollArea']"); el.scrollTop = 0; })()`);
await page.waitForTimeout(700);
console.log("滚到顶", JSON.stringify(await info()));
await page.screenshot({ path: "E:/lfaa/.tmp/virtual-top.png" });

// 回到底部
await page.evaluate(`(() => { const el = document.querySelector("[class*='scrollArea']"); el.scrollTop = el.scrollHeight; })()`);
await page.waitForTimeout(800);
console.log("回到底", JSON.stringify(await info()));

console.log("errors:", errors.length ? errors.slice(0, 3) : "none");
await browser.close();