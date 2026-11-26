// 临时验收：用 DOM click（绕过悬停浮层命中）触发第 6 个刻度，判断落点是否正确。
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const exe = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].find((p) => existsSync(p));
const url = process.argv[2] ?? "http://127.0.0.1:5173/";
const session = "00000000-0000-4000-8000-000000000001";

async function run(label, offline) {
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(`(() => { try {
    localStorage.setItem("lfaa:active-chat-session-id", ${JSON.stringify(session)});
    if (${offline}) localStorage.setItem("lfaa:thread-virtualization", "off");
    else localStorage.removeItem("lfaa:thread-virtualization");
  } catch {} })()`);
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(9000);
  const clicked = await page.evaluate(`(() => {
    const ticks = Array.from(document.querySelectorAll("[class*='tickBtn']"));
    if (ticks.length < 6) return null;
    const label = ticks[5].getAttribute("aria-label");
    ticks[5].click();
    return label;
  })()`);
  await page.waitForTimeout(2200);
  const result = await page.evaluate(`(() => {
    const scroller = document.querySelector("[class*='scrollArea']");
    const viewportTop = scroller.getBoundingClientRect().top;
    const near = Array.from(document.querySelectorAll("[data-turn-anchor]"))
      .map((el) => ({ id: el.getAttribute("data-turn-anchor"), delta: Math.round(el.getBoundingClientRect().top - viewportTop) }))
      .filter((x) => x.delta >= -60)
      .sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))[0];
    return { top: Math.round(scroller.scrollTop), nearest: near ?? null };
  })()`);
  console.log(`[${label}] 点击=${clicked}`, JSON.stringify(result));
  await browser.close();
}

await run("virtual-on", false);
await run("virtual-off", true);