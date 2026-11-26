// 临时诊断：列出右栏切换期间返回非 2xx 的 /api 请求，确认 400 的来源是否与本轮改动相关。
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const exe = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].find((p) => existsSync(p));
const session = process.argv[2] ?? "";
const browser = await chromium.launch({ executablePath: exe, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const bad = [];
page.on("response", (res) => {
  if (!res.url().includes("/api/") || res.status() < 400) return;
  bad.push(`${res.status()} ${res.request().method()} ${res.url().replace(/^https?:\/\/[^/]+/, "")}`);
});
if (session) await page.addInitScript(`try { localStorage.setItem("lfaa:active-chat-session-id", ${JSON.stringify(session)}); } catch {}`);
await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(9500);
for (const name of ["终端", "变更"]) {
  await page.getByText(name, { exact: true }).first().click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(1500);
}
console.log("非 2xx 请求:", JSON.stringify(bad, null, 1));
await browser.close();