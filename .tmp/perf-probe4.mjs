// 临时性能探针 v4：聚焦「输入延迟」与「滚动掉帧」。
// 用 Event Timing API 采集每次 keydown 的呈现耗时（processingStart → 下一帧），
// 并记录首屏关键时间点，便于对比 dev(5173) 与 prod(5199) 同一会话。
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const exe = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
].find((p) => existsSync(p));
if (!exe) throw new Error("no browser");

const url = process.argv[2] ?? "http://127.0.0.1:5173/";
const sessionId = process.argv[3] ?? "";
const label = process.argv[4] ?? "probe";

const browser = await chromium.launch({ executablePath: exe, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
if (sessionId) {
  await context.addInitScript(`try { localStorage.setItem("lfaa:active-chat-session-id", ${JSON.stringify(sessionId)}); } catch {}`);
}
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.addInitScript(`(() => {
  window.__nav = {};
  window.__events = [];
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__events.push({ name: e.name, dur: Math.round(e.duration) }); })
    .observe({ type: "event", durationThreshold: 16, buffered: true });
})()`);

const t0 = Date.now();
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForFunction(`document.querySelector("#chat-message-") !== null || document.body.innerText.includes("从哪里开始") || document.body.innerText.includes("我们要做什么")`, { timeout: 60000 }).catch(() => {});
const firstMessageMs = Date.now() - t0;
await page.waitForTimeout(2500);
const timing = await page.evaluate(`({
  fcp: Math.round((performance.getEntriesByName("first-contentful-paint")[0]?.startTime) || 0),
  dcl: Math.round(performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart),
  load: Math.round(performance.timing.loadEventEnd - performance.timing.navigationStart),
  resources: performance.getEntriesByType("resource").length,
  transferKB: Math.round(performance.getEntriesByType("resource").reduce((s, r) => s + (r.transferSize || 0), 0) / 1024),
  domNodes: document.querySelectorAll("*").length,
  messageRows: document.querySelectorAll("[id^='chat-message-']").length,
})`);
console.log(`[${label}] firstMessage≈${firstMessageMs}ms`, JSON.stringify(timing));

// 滚动帧
await page.evaluate(`(() => { window.__frames = []; let last = performance.now();
  const tick = (now) => { window.__frames.push(Math.round(now - last)); last = now; requestAnimationFrame(tick); };
  requestAnimationFrame(tick); })()`);
await page.mouse.move(700, 460);
for (let i = 0; i < 40; i++) { await page.mouse.wheel(0, -520); await page.waitForTimeout(35); }
const frames = (await page.evaluate("window.__frames")).filter((n) => n > 0);
console.log(`[${label}] scroll frames=${frames.length} p50=${frames.slice().sort((a,b)=>a-b)[Math.floor(frames.length*0.5)]} p95=${frames.slice().sort((a,b)=>a-b)[Math.floor(frames.length*0.95)]} max=${Math.max(...frames)} over33=${frames.filter((n) => n > 33).length}`);

// 键盘输入延迟
await page.evaluate("window.__events = []; window.__frames = []");
if ((await page.locator("textarea").count()) > 0) {
  await page.locator("textarea").first().click();
  await page.waitForTimeout(200);
  await page.keyboard.type("这是一段用于测试输入是否跟手的文字", { delay: 45 });
  await page.waitForTimeout(500);
  const events = (await page.evaluate("window.__events")).filter((e) => e.name === "keydown");
  const durs = events.map((e) => e.dur).sort((a, b) => a - b);
  console.log(`[${label}] keydown events(>16ms)=${durs.length} of ${events.length} p50=${durs[Math.floor(durs.length/2)] ?? "-"} max=${durs.at(-1) ?? "-"} all=${JSON.stringify(durs)}`);
  const tframes = (await page.evaluate("window.__frames")).filter((n) => n > 0);
  console.log(`[${label}] typing frames p95=${tframes.slice().sort((a,b)=>a-b)[Math.floor(tframes.length*0.95)]} max=${Math.max(0, ...tframes)}`);
  for (let i = 0; i < 4; i++) await page.keyboard.press("Backspace");
}
if (errors.length) console.log(`[${label}] errors`, errors.slice(0, 3));
await browser.close();