/**
 * 文件：ui-contract-check.mjs
 * 作用：检查 Web 工作台最容易发生视觉/交互回归的静态 UI 契约。
 * 负责：单一 Tooltip、容器响应式计算、变量化布局、Composer 底部安全间距、三向 capture-threshold 吸附状态机、Dock/Overlay 模式契约。
 * 不负责：浏览器真实像素截图、Pointer 实机手感、PTY 行为测试。
 * 状态归属：无运行时状态；每次执行读取当前 App Shell 与 ResizableWorkbench 源码/CSS。
 * 对外接口：`node scripts/ui-contract-check.mjs`，成功返回 0，失败返回 1。
 * 关联文件：AgentWorkbench.tsx、agent-workbench.css、workbench-layout.config.ts、ResizableWorkbench.tsx、workbench.css、docs/UI.md、docs/TESTING.md。
 * 修改注意事项：UI 交互事实变化时，先更新规范/测试，再同步更新此门禁；禁止删检查绕过回归。
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const fail = (message) => {
  console.error(`LFAA UI contract check failed: ${message}`);
  process.exit(1);
};

const tsx = read("packages/app-shell/src/AgentWorkbench.tsx");
const css = read("packages/app-shell/src/agent-workbench.css");
const layoutConfig = read("packages/ui/src/workbench/workbench-layout.config.ts");
const resizeTsx = read("packages/ui/src/workbench/ResizableWorkbench.tsx");
const workbenchCss = read("packages/ui/src/workbench/workbench.css");

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

// 2. 响应式必须以容器测量 + 单一计算器为事实源，不再同时维护 window 断点与 CSS media 断点。
for (const token of [
  "resolveWorkbenchLayoutMetrics",
  "new ResizeObserver(update)",
  "containerRef.current",
  "layoutMode={layoutMode}",
  "leftLimits={layout.left}",
  "rightLimits={layout.right}",
  "bottomLimits={layout.bottom}",
  "minCenterWidth={layout.minCenterWidth}",
]) {
  if (!tsx.includes(token)) fail(`missing container-responsive contract: ${token}`);
}
if (/window\.innerWidth\s*</.test(tsx)) fail("fixed window.innerWidth breakpoints must not return");
if (/const\s+(LEFT|RIGHT|BOTTOM)_LIMITS\s*=/.test(tsx)) fail("App Shell must not own hard-coded pane limits");

for (const token of [
  "WORKBENCH_LAYOUT_TOKENS",
  "ratio:",
  "floor:",
  "ceiling:",
  "desktopNeed",
  "compactNeed",
  "resolveWorkbenchLayoutMetrics",
]) {
  if (!layoutConfig.includes(token)) fail(`missing calculated layout token: ${token}`);
}

for (const token of [
  'data-layout-mode="compact"',
  'data-layout-mode="mobile"',
  "--lfaa-overlay-right-width",
  "clamp(15rem, 34%, 20rem)",
  "container-type: inline-size",
]) {
  if (!workbenchCss.includes(token)) fail(`missing variable-based responsive CSS contract: ${token}`);
}
if (/88vw|56vw|420px/.test(workbenchCss)) fail("legacy fixed/near-fullscreen drawer sizing must not return");
if (/\@media\s*\(max-width:\s*1239px\)|\@media\s*\(max-width:\s*759px\)/.test(workbenchCss + css)) {
  fail("legacy layout breakpoints must not return; use data-layout-mode + variables");
}

// 3. App Shell 视觉尺寸必须使用设计变量 / rem / clamp，而不是继续复制 48px / 760px 结构常量。
for (const token of [
  "--agent-shell-header-h",
  "--agent-content-max",
  "--agent-composer-max",
  "--agent-composer-bottom-gap",
  "--agent-page-gutter",
  "clamp(",
  'data-layout-mode="compact"',
  'data-layout-mode="mobile"',
]) {
  if (!css.includes(token)) fail(`missing App Shell design token: ${token}`);
}
if (/grid-template-rows:\s*48px/.test(css) || /height:\s*48px/.test(css)) {
  fail("48px header magic number must not return; use --agent-shell-header-h");
}
if (!css.includes("max(var(--agent-composer-bottom-gap), env(safe-area-inset-bottom))")) {
  fail("Composer bottom spacing must use --agent-composer-bottom-gap + safe-area instead of a fixed bottom padding");
}

// 4. 三向吸附必须使用“隐藏超拖” capture threshold：视觉尺寸到 min 后保持 min，Pointer 继续向内超拖到阈值才吸附；不松手仍可反向解锁。
const interactionConfig = read("packages/ui/src/workbench/workbench-interaction.config.ts");
for (const token of [
  "resolveSnapDragFrame({",
  "frame.visualSize",
  "frame.capturedThisFrame",
  "frame.releasedThisFrame",
  "resolveSnapCaptureThreshold(effectiveMin, snapCaptureRatio)",
  "resolveSnapCaptureThreshold(bottomLimits.min, snapCaptureRatio)",
  "Pointer Up",
  "onBottomOpenChange?.(false)",
]) {
  if (!resizeTsx.includes(token)) fail(`missing capture-threshold snap contract: ${token}`);
}
for (const token of [
  "rawSize <= input.captureThreshold",
  "rawSize >= safeMin + Math.max(0, input.releaseHysteresis)",
  "visualSize: snapped ? 0 : Math.min(safeMax, Math.max(safeMin, rawSize))",
]) {
  if (!interactionConfig.includes(token)) fail(`missing centralized snap-frame contract: ${token}`);
}
if (resizeTsx.includes("!drag.snapped && raw <= drag.min")) {
  fail("minWidth must not directly trigger snap capture; use captureThreshold");
}

if (resizeTsx.includes("clamp(raw, drag.captureThreshold, drag.max)")) {
  fail("pre-capture visual size must stay at minWidth; captureThreshold is pointer-only, not visual width");
}
for (const token of [
  "captureRatio: 0.50",
  "releaseHysteresis",
  "captureDurationMs",
  "releaseDurationMs",
  "settleDurationMs",
  "stepPx",
  "fastStepPx",
]) {
  if (!interactionConfig.includes(token)) fail(`missing centralized Workbench interaction token: ${token}`);
}
if (!resizeTsx.includes('data-layout-mode={layoutMode}')) fail("ResizableWorkbench must expose layoutMode to CSS");
if (!resizeTsx.includes('layoutMode === "desktop"')) fail("dynamic max must distinguish Dock from Overlay modes");
if (!resizeTsx.includes('setResolvedLeftWidth((value) => clamp(value, dynamicMin, dynamicMax))')) {
  fail("shared/persisted left width must be re-clamped when container becomes narrower");
}
if (!/\.lfaa-is-resizing \.lfaa-workbench,[\s\S]*transition:\s*none;/.test(workbenchCss)) {
  fail("normal dragging must disable transitions so Pointer stays responsive");
}
if (!workbenchCss.includes('data-snap-preview="left"') || !workbenchCss.includes('var(--lfaa-snap-capture-duration)')) {
  fail("snap preview must use the centralized magnetic-collapse duration variable");
}
if (!workbenchCss.includes('var(--lfaa-snap-release-duration)') || !workbenchCss.includes('var(--lfaa-snap-settle-duration)')) {
  fail("snap release/settle transitions must use centralized CSS duration variables");
}


// 5. 左栏 Hover Preview 与点击展开必须共享同一实际宽度，禁止维护第二套 preview clamp。
for (const token of [
  "onLeftWidthChange",
  "setLeftPaneWidth",
  '"--agent-left-preview-width": `${leftPaneWidth}px`',
]) {
  if (!tsx.includes(token) && !resizeTsx.includes(token)) fail(`missing shared left preview width contract: ${token}`);
}
if (/--agent-left-preview-width\s*:\s*clamp\(/.test(css)) {
  fail("Hover Preview must not own an independent clamp width; bind it to the real left pane width");
}

// 6. Chat / Work 必须共用同一 Agent Runtime，Work 是真实无限画布 Projection，模型名不得写死。
const canvasTsx = read("packages/ui/src/features/workbench/InfiniteCanvas.tsx");
for (const token of [
  'agentSurface === "chat"',
  'onAgentSurfaceChange("work")',
  'AGENT_PERMISSION_PROFILES',
  'runtimeConnected={Boolean(props.agentRuntimeHost)}',
  'selectedModelId',
  '<InfiniteCanvas',
]) {
  if (!tsx.includes(token)) fail(`missing Chat/Work shared runtime contract: ${token}`);
}
if (tsx.includes("GPT-5.6 Sol")) fail("Workbench must display the configured model, not a hard-coded model name");
for (const token of ["beginPan", "beginNodeDrag", "onWheel", "onNodesChange?.(next)", "<svg"]) {
  if (!canvasTsx.includes(token)) fail(`missing Infinite Canvas interaction contract: ${token}`);
}

console.log("LFAA UI contract check passed.");
