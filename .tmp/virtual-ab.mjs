// 临时验收：80 条消息的会话在「窗口化开 / 关」两种设置下的首屏、切换与滚动表现，并检查贴底与锚点。
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const exe = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].find((p) => existsSync(p));
const session = "00000000-0000-4000-8000-000000000001";
const url = process.argv[2] ?? "http://127.0.0.1:5173/";

async function run(label, offline) {
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(`(() => {
    try {
      localStorage.setItem("lfaa:active-chat-session-id", ${JSON.stringify(session)});
      if (${offline}) localStorage.setItem("lfaa:thread-virtualization", "off");
      else localStorage.removeItem("lfaa:thread-virtualization");
    } catch {}
  })()`);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(9000);

  const info = await page.evaluate(`(() => {
    const el = document.querySelector("[class*='scrollArea']");
    return {
      dom: document.querySelectorAll("*").length,
      rows: document.querySelectorAll("[id^=chat-message-]").length,
      virtual: Boolean(document.querySelector("[class*='thread'][data-virtualized]")),
      top: Math.round(el.scrollTop), height: Math.round(el.scrollHeight), client: el.clientHeight,
    };
  })()`);
  console.log(`[${label}] 首屏`, JSON.stringify(info), "errors:", errors.slice(0, 2));

  // 向上滚动
  await page.evaluate(`(() => { window.__frames = []; let last = performance.now();
    const tick = (now) => { window.__frames.push(Math.round(now - last)); last = now; requestAnimationFrame(tick); };
    requestAnimationFrame(tick); })()`);
  await page.mouse.move(700, 460);
  const tops = [];
  for (let i = 0; i < 25; i += 1) {
    await page.mouse.wheel(0, -420);
    await page.waitForTimeout(45);
    tops.push(await page.evaluate(`Math.round(document.querySelector("[class*='scrollArea']").scrollTop)`));
  }
  const frames = (await page.evaluate("window.__frames")).filter((n) => n > 0).sort((a, b) => a - b);
  const jumps = tops.map((t, i) => (i === 0 ? 0 : t - tops[i - 1])).filter((d) => d > 0);
  const after = await page.evaluate(`(() => {
    const el = document.querySelector("[class*='scrollArea']");
    return { top: Math.round(el.scrollTop), height: Math.round(el.scrollHeight), rows: document.querySelectorAll("[id^=chat-message-]").length };
  })()`);
  console.log(`[${label}] 上滚 frames p95=${frames[Math.floor(frames.length * 0.95)]} max=${frames.at(-1)} over33=${frames.filter((n) => n > 33).length} 反向跳变=${jumps.length}`, JSON.stringify(after));

  // 回到底部
  await page.evaluate(`(() => { const el = document.querySelector("[class*='scrollArea']"); el.scrollTop = el.scrollHeight; })()`);
  await page.waitForTimeout(600);
  const bottom = await page.evaluate(`(() => {
    const el = document.querySelector("[class*='scrollArea']");
    return { atBottom: Math.round(el.scrollHeight - el.clientHeight - el.scrollTop) };
  })()`);
  console.log(`[${label}] 回到底部 距底=${bottom.atBottom}px`);

  // 锚点：点第 1 个刻度
  const ticks = page.locator("[class*='tickBtn']");
  const tickCount = await ticks.count();
  if (tickCount > 0) {
    await ticks.first().click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(800);
    const jumped = await page.evaluate(`(() => {
      const el = document.querySelector("[class*='scrollArea']");
      return { top: Math.round(el.scrollTop) };
    })()`);
    console.log(`[${label}] 锚点跳转 ticks=${tickCount} top=${jumped.top}`);
  }
  await browser.close();
}

await run("virtual-on", false);
await run("virtual-off", true);