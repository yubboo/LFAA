/**
 * 文件：ui-contract-check.mjs
 * 作用：检查 Web 工作台中容易发生视觉/交互回归的静态 UI 契约。
 * 负责：Shell Header 三个控制按钮必须只使用一套自定义 Tooltip；禁止同时存在原生 title 与自定义 Tooltip；检查 Tooltip 不抢鼠标事件。
 * 不负责：浏览器真实视觉截图、响应式像素级验收、拖拽和 PTY 行为测试。
 * 状态归属：无运行时状态；每次执行读取当前 AgentWorkbench.tsx 与 agent-workbench.css。
 * 对外接口：`node scripts/ui-contract-check.mjs`，成功返回 0，失败返回 1。
 * 关联文件：packages/app-shell/src/AgentWorkbench.tsx、packages/app-shell/src/agent-workbench.css、docs/standards/UI_LAYOUT.md、docs/testing/WEB_UI_TEST.md。
 * 修改注意事项：如果未来替换 Tooltip 方案，应先更新 UI 规范和本检查，不能直接绕过门禁。
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const fail = (message) => {
  console.error(`LFAA UI contract check failed: ${message}`);
  process.exit(1);
};

const tsx = fs.readFileSync(path.join(root, "packages/app-shell/src/AgentWorkbench.tsx"), "utf8");
const css = fs.readFileSync(path.join(root, "packages/app-shell/src/agent-workbench.css"), "utf8");

const start = tsx.indexOf("function ShellHeaderButton(");
const end = tsx.indexOf("// 右侧 Shell Actions", start);
if (start < 0 || end < 0) fail("ShellHeaderButton implementation block not found");
const shellButton = tsx.slice(start, end);

if (!shellButton.includes("agent-shell-tooltip")) {
  fail("ShellHeaderButton must keep the single custom agent-shell-tooltip");
}
if (/\btitle\s*=/.test(shellButton)) {
  fail("ShellHeaderButton must not use native title together with the custom Tooltip");
}
if (!shellButton.includes("aria-label=")) {
  fail("ShellHeaderButton must keep aria-label for accessibility");
}

const tooltipRule = css.match(/\.agent-shell-tooltip\s*\{[^}]*\}/s)?.[0] ?? "";
if (!tooltipRule) fail(".agent-shell-tooltip CSS rule not found");
if (!/pointer-events\s*:\s*none\s*;/.test(tooltipRule)) {
  fail(".agent-shell-tooltip must use pointer-events:none so the tooltip cannot steal hover/click events");
}

for (const shortcut of ["Ctrl+B", "Ctrl+J", "Ctrl+Alt+B"]) {
  if (!tsx.includes(`shortcut="${shortcut}"`)) {
    fail(`missing Shell Header shortcut ${shortcut}`);
  }
}

console.log("LFAA UI contract check passed.");
