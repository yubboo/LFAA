// 临时验收脚本：预览列收起后，从左二项目工作区点文件查看，应当分屏打开（不入库）。
import { existsSync, mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const candidates = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
];
const executablePath = candidates.find((p) => existsSync(p));
if (!executablePath) throw new Error("no browser");

const shotDir = "E:/lfaa/.tmp/shots";
mkdirSync(shotDir, { recursive: true });

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(`PAGEERROR ${e.message}`));

await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-columns]", { timeout: 60000 });
await page.evaluate(() => {
  localStorage.setItem("lfaa:layout-mode", JSON.stringify("preview-center"));
  localStorage.setItem("lfaa:sidebar-mode", JSON.stringify("project"));
});
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-columns]", { timeout: 60000 });
await page.waitForTimeout(2000);

async function report(label) {
  const state = await page.evaluate(() => {
    const shell = document.querySelector("[data-columns]");
    const workspace = document.querySelector("main[data-region]");
    const panel = document.querySelector('[data-region="context-panel"]');
    const rect = (el) => (el ? Math.round(el.getBoundingClientRect().width) : 0);
    return {
      previewOpen: shell?.getAttribute("data-preview-open"),
      rightOpen: shell?.getAttribute("data-right-open"),
      chatWidth: rect(workspace),
      panelWidth: rect(panel),
      tabs: [...document.querySelectorAll('[role="tablist"] [role="tab"]')].map((t) => t.textContent?.trim()),
    };
  });
  console.log(label, JSON.stringify(state));
  await page.screenshot({ path: `${shotDir}/file-${label}.png` });
}

// 先把预览列关掉：点空白页的「终端」再关掉它。
await page.locator('[data-region="context-panel"] button', { hasText: "终端" }).first().click();
await page.waitForTimeout(700);
await page.keyboard.press("Control+Alt+KeyW");
await page.waitForTimeout(900);
await report("1-preview-closed");

const tree = await page.evaluate(() => {
  const root = document.querySelector('[role="tree"]');
  if (!root) return { found: false, items: [] };
  return {
    found: true,
    items: [...root.querySelectorAll('[role="treeitem"], button, [class*="row"]')]
      .slice(0, 12)
      .map((el) => ({ role: el.getAttribute("role"), text: (el.textContent ?? "").trim().slice(0, 24) })),
  };
});
console.log("tree:", JSON.stringify(tree));

// 点文件树里的一个文件（优先找带扩展名的行）。
const fileRow = page.locator('[role="tree"] [role="treeitem"], [role="tree"] button').filter({ hasText: /\.(ts|md|json)\b/ }).first();
if (await fileRow.count()) {
  await fileRow.click();
  await page.waitForTimeout(1500);
  await report("2-after-open-file");
} else {
  console.log("no file row matched");
}
console.log("errors:", JSON.stringify(errors.slice(0, 6)));
await browser.close();