// 临时冒烟：右栏概览与子视图（终端/变更/侧边提问）在切片订阅后仍正常渲染，且无运行时报错。
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const exe = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].find((p) => existsSync(p));
const session = process.argv[2] ?? "";
const browser = await chromium.launch({ executablePath: exe, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
if (session) {
  await page.addInitScript(`try { localStorage.setItem("lfaa:active-chat-session-id", ${JSON.stringify(session)}); } catch {}`);
}
await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(9500);

for (const name of ["终端", "变更", "侧边提问"]) {
  const btn = page.getByText(name, { exact: true }).first();
  const exists = await btn.count();
  if (!exists) { console.log(`${name}: 入口未找到`); continue; }
  await btn.click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const text = await page.evaluate(`document.querySelector("[data-region='context-panel']")?.innerText.length ?? 0`);
  console.log(`${name}: 面板文本 ${text}`);
}
console.log("errors:", errors.length ? errors.slice(0, 5) : "none");
await page.screenshot({ path: "E:/lfaa/.tmp/panel-smoke.png" });
await browser.close();