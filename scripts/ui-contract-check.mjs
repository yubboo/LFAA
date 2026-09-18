/**
 * 文件：ui-contract-check.mjs
 * 作用：检查 Web 工作台中容易发生视觉/交互回归的静态 UI 契约。
 * 负责：单一 Tooltip、响应式断点/Drawer 契约、三向 min 吸附收起状态机的关键静态条件。
 * 不负责：浏览器真实像素截图、Pointer 实机手感、PTY 行为测试。
 * 状态归属：无运行时状态；每次执行读取当前 App Shell 与 ResizableWorkbench 源码/CSS。
 * 对外接口：`node scripts/ui-contract-check.mjs`，成功返回 0，失败返回 1。
 * 关联文件：AgentWorkbench.tsx、agent-workbench.css、ResizableWorkbench.tsx、workbench.css、UI_LAYOUT.md、WEB_UI_TEST.md。
 * 修改注意事项：UI 交互事实发生变化时，应先更新规范/测试，再同步更新此门禁，禁止直接删检查绕过回归。
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
const resizeTsx = fs.readFileSync(path.join(root, "packages/ui/src/workbench/ResizableWorkbench.tsx"), "utf8");
const workbenchCss = fs.readFileSync(path.join(root, "packages/ui/src/workbench/workbench.css"), "utf8");

// 1. Shell Tooltip 只能有一个来源。
const start = tsx.indexOf("function ShellHeaderButton(");
const end = tsx.indexOf("// 右侧 Shell Actions", start);
if (start < 0 || end < 0) fail("ShellHeaderButton implementation block not found");
const shellButton = tsx.slice(start, end);

if (!shellButton.includes("agent-shell-tooltip")) fail("ShellHeaderButton must keep the custom Tooltip");
if (/\btitle\s*=/.test(shellButton)) fail("ShellHeaderButton must not use native title together with custom Tooltip");
if (!shellButton.includes("aria-label=")) fail("ShellHeaderButton must keep aria-label for accessibility");
if (!shellButton.includes('tooltipAlign?: "start" | "center" | "end"')) fail("ShellHeaderButton must support edge-aware Tooltip alignment");

const tooltipRule = css.match(/\.agent-shell-tooltip\s*\{[^}]*\}/s)?.[0] ?? "";
if (!tooltipRule) fail(".agent-shell-tooltip CSS rule not found");
if (!/pointer-events\s*:\s*none\s*;/.test(tooltipRule)) fail("Tooltip must use pointer-events:none");
for (const selector of ["agent-shell-tooltip--start", "agent-shell-tooltip--end"]) {
  if (!css.includes(selector)) fail(`missing edge-aware Tooltip rule ${selector}`);
}
for (const shortcut of ["Ctrl+B", "Ctrl+J", "Ctrl+Alt+B"]) {
  if (!tsx.includes(`shortcut="${shortcut}"`)) fail(`missing Shell Header shortcut ${shortcut}`);
}

// 2. 三档响应式必须由 React 状态与 CSS 使用同一组断点。
for (const token of [
  'type LayoutMode = "desktop" | "compact" | "mobile"',
  "window.innerWidth < 760",
  "window.innerWidth < 1240",
  'data-layout-mode={layoutMode}',
]) {
  if (!tsx.includes(token)) fail(`missing responsive contract: ${token}`);
}
for (const token of [
  "@media (max-width: 1239px) and (min-width: 760px)",
  "@media (max-width: 759px)",
  'data-layout-mode="compact"',
  'data-layout-mode="mobile"',
]) {
  if (!css.includes(token) && !workbenchCss.includes(token)) fail(`missing responsive CSS contract: ${token}`);
}
if (/88vw/.test(workbenchCss)) fail("legacy 88vw side drawer width must not return");
if (!workbenchCss.includes("top:48px")) fail("responsive drawers must start below the 48px header");

// 3. 三向吸附必须是“到 min 即吸附收起”，不能再有 min 以下的展开布局。
for (const token of [
  "raw <= drag.min",
  "raw >= drag.min + snapHysteresis",
  "drag.snapped ? 0 : clamp(raw, drag.min, drag.max)",
  "Pointer Up",
]) {
  if (!resizeTsx.includes(token)) fail(`missing min-snap contract: ${token}`);
}
for (const forbidden of ["function elasticSize(", "function snapCommitThreshold("]) {
  if (resizeTsx.includes(forbidden)) fail(`legacy below-min elastic layout must not return: ${forbidden}`);
}
for (const token of [
  "const LEFT_LIMITS = { min: 280",
  "const RIGHT_LIMITS = { min: 360",
  "const BOTTOM_LIMITS = { min: 180",
]) {
  if (!tsx.includes(token)) fail(`missing readable minimum-size contract: ${token}`);
}
if (!/\.lfaa-is-resizing \.lfaa-workbench,[\s\S]*transition:\s*none;/.test(workbenchCss)) {
  fail("normal dragging must disable workbench transitions so Pointer stays responsive");
}
if (!workbenchCss.includes('data-snap-preview="left"') || !workbenchCss.includes('150ms cubic-bezier')) {
  fail("snap preview should keep the short magnetic collapse transition");
}

console.log("LFAA UI contract check passed.");
