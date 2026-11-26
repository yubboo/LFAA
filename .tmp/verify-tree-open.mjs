// 临时验收脚本 2：预览列收起后，从左二项目工作区点文件查看（不入库）。
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
await page.waitForTimeout(1500);

// 1) 会话模式里点项目行，绑定项目上下文
const projectRow = page.locator('button, [role="button"]').filter({ hasText: /^lfaa$/ }).first();
console.log("project row count:", await projectRow.count());
if (await projectRow.count()) {
  await projectRow.click();
  await page.waitForTimeout(1200);
}
console.log("route:", await page.evaluate(() => localStorage.getItem("lfaa:active-route")));

// 2) 切到项目工作区 + 预览区在左，刷新
await page.evaluate(() => {
  localStorage.setItem("lfaa:sidebar-mode", JSON.stringify("project"));
  localStorage.setItem("lfaa:layout-mode", JSON.stringify("preview-center"));
});
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-columns]", { timeout: 60000 });
await page.waitForTimeout(2500);

async function state(label) {
  const info = await page.evaluate(() => {
    const shell = document.querySelector("[data-columns]");
    const workspace = document.querySelector("main[data-region]");
    const panel = document.querySelector('[data-region="context-panel"]');
    const rect = (el) => (el ? Math.round(el.getBoundingClientRect().width) : 0);
    return {
      previewOpen: shell?.getAttribute("data-preview-open"),
      chatWidth: rect(workspace),
      panelWidth: rect(panel),
      tabs: [...document.querySelectorAll('[role="tablist"] [role="tab"]')].map((t) => t.textContent?.trim()),
      treeItems: [...document.querySelectorAll('[role="tree"] [role="treeitem"]')].slice(0, 6).map((el) => (el.textContent ?? "").trim().slice(0, 20)),
    };
  });
  console.log(label, JSON.stringify(info));
  await page.screenshot({ path: `${shotDir}/tree-${label}.png` });
}

await state("1-project-mode");

// 3) 关掉预览列
const terminal = page.locator('[data-region="context-panel"] button', { hasText: "终端" }).first();
if (await terminal.count()) {
  await terminal.click();
  await page.waitForTimeout(700);
  await page.keyboard.press("Control+Alt+KeyW");
  await page.waitForTimeout(900);
}
await state("2-preview-closed");

// 4) 点文件树里的文件
const fileRow = page.locator('[role="tree"] [role="treeitem"]').filter({ hasText: /\.(ts|md|json|css)\b/ }).first();
console.log("file row count:", await fileRow.count());
if (await fileRow.count()) {
  await fileRow.click();
  await page.waitForTimeout(1600);
  await state("3-after-open-file");
}
console.log("errors:", JSON.stringify(errors.slice(0, 6)));
await browser.close();