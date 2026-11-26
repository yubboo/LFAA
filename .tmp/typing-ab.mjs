// 临时对比：同一套打字动作，在「首页空会话」与「大会话」下各跑一遍，判断输入卡顿来自输入框本身还是消息列。
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const exe = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: exe, headless: true });

async function run(label, session) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  if (session) await ctx.addInitScript(`try { localStorage.setItem("lfaa:active-chat-session-id", ${JSON.stringify(session)}); } catch {}`);
  const page = await ctx.newPage();
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(9000);
  const dom = await page.evaluate("document.querySelectorAll('*').length");
  await page.locator("textarea").first().click();
  await page.waitForTimeout(300);
  await page.evaluate(`(() => { window.__frames = []; let last = performance.now();
    const tick = (now) => { window.__frames.push(Math.round(now - last)); last = now; requestAnimationFrame(tick); };
    requestAnimationFrame(tick); })()`);
  await page.keyboard.type("这是一段用于测试输入是否跟手的文字内容", { delay: 45 });
  await page.waitForTimeout(400);
  const frames = (await page.evaluate("window.__frames")).filter((n) => n > 0).sort((a, b) => a - b);
  console.log(`[${label}] dom=${dom} frames=${frames.length} p50=${frames[Math.floor(frames.length * 0.5)]} p95=${frames[Math.floor(frames.length * 0.95)]} max=${frames.at(-1)} over33=${frames.filter((n) => n > 33).length}`);
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await ctx.close();
}

await run("home", "");
await run("big", "cf448649-e1ec-4507-9f84-074d3d7fdafd");
await browser.close();