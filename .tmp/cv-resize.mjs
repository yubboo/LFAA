// 临时验收：改宽度（收起/展开右栏）后向上滚动，检查是否有回跳或位置漂移。
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
await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(10000);
const read = () => page.evaluate(`(() => {
  const el = document.querySelector("[class*='scrollArea']");
  return { top: Math.round(el.scrollTop), height: Math.round(el.scrollHeight), client: el.clientHeight };
})()`);
console.log("初始", JSON.stringify(await read()));

// 顶栏的“切换右栏/最大化”类按钮：找一个带面板语义的按钮点一下
const toggles = page.locator("button[aria-label*='面板'], button[aria-label*='侧栏'], button[aria-label*='最大化']");
const count = await toggles.count();
if (count > 0) {
  await toggles.first().click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(900);
}
const afterToggle = await read();
console.log("改宽后", JSON.stringify(afterToggle), `toggles=${count}`);

const tops = [];
await page.mouse.move(600, 450);
for (let i = 0; i < 12; i += 1) {
  await page.mouse.wheel(0, -420);
  await page.waitForTimeout(45);
  tops.push((await read()).top);
}
const jumps = tops.map((t, i) => (i === 0 ? 0 : t - tops[i - 1])).filter((d) => d > 0);
console.log("上滚 tops:", JSON.stringify(tops));
console.log("反向跳变:", jumps.length, jumps.length ? Math.max(...jumps) : 0);
await page.waitForTimeout(700);
console.log("停止后", JSON.stringify(await read()));
await browser.close();