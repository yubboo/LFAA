import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspaceCss = readFileSync(new URL("../../../packages/client/ui-workspace/src/css/secondary-navigation.css", import.meta.url), "utf8");
const workspaceSource = readFileSync(new URL("../../../packages/client/ui-workspace/src/ApplicationWorkspace.tsx", import.meta.url), "utf8");
const workbenchSource = readFileSync(new URL("../../../packages/client/ui-dockkit/src/ResizableWorkbench.tsx", import.meta.url), "utf8");

test("中心区收窄或吸附后左栏宽度回写收敛，收起预览不消耗 Grid 预算", () => {
  // 执行真实组件的尺寸协调 effect，模拟受控父组件每次回写后重新渲染。
  // 旧实现会在静态最小值 200 与动态预算 72/0 之间每轮回写两次。
  const effects = workbenchSource.slice(
    workbenchSource.indexOf("  // 响应式计算结果变化时"),
    workbenchSource.indexOf('    if (typeof window === "undefined") return;', workbenchSource.indexOf("  // 响应式计算结果变化时")),
  ).replace(/  useEffect\(\(\) => \{\s*$/u, "");
  const run = new Function("useEffect", "setResolvedLeftWidth", "setRightWidth", "setBottomHeight", "clamp", "leftLimits", "rightLimits", "bottomLimits", "getDynamicMax", "leftCollapsed", "leftUsesGrid", effects);
  for (const scenario of [
    { collapsed: false, grid: true, budget: 72, expected: 72 },
    { collapsed: true, grid: true, budget: 0, expected: 260 },
    { collapsed: false, grid: false, budget: 0, expected: 260 },
    { collapsed: false, grid: true, budget: 380, expected: 260 },
  ]) {
    let width = 260;
    let writes = 0;
    for (let render = 0; render < 12; render += 1) {
      // 同一 render 的 setter 闭包持有同一个受控 prop 快照。
      const renderedWidth = width;
      run(callback => callback(), next => {
        const resolved = next(renderedWidth);
        if (resolved !== renderedWidth) { width = resolved; writes += 1; }
      }, () => {}, () => {}, (value, min, max) => Math.max(min, Math.min(max, value)),
      { min: 200, max: 440 }, {}, {}, () => scenario.budget, scenario.collapsed, scenario.grid);
    }
    assert.equal(width, scenario.expected);
    assert.ok(writes <= 1, `尺寸必须收敛，不应持续回写：${JSON.stringify(scenario)}，writes=${writes}`);
  }
});

test("左二 hover 按钮到预览之间的响应式命中区连续", () => {
  const previewRule = workspaceCss.match(/\.module-workbench-layout\[data-left-collapsed="true"\]\s*>\s*\.module-workbench-region--secondary-navigation\.module-left-preview\s*\{([^}]+)\}/u)?.[1] ?? "";
  const visibleRule = workspaceCss.match(/\.module-workbench-layout\[data-left-collapsed="true"\]\s*>\s*\.module-workbench-region--secondary-navigation\.module-left-preview\.is-visible\s*\{([^}]+)\}/u)?.[1] ?? "";

  assert.match(previewRule, /visibility:\s*hidden/u);
  assert.match(previewRule, /pointer-events:\s*auto/u);
  assert.match(previewRule, /transition:\s*opacity\s+260ms[^;]*,\s*visibility\s+0s\s+linear\s+260ms/u);
  assert.match(visibleRule, /pointer-events:\s*auto/u);
  assert.ok(workspaceSource.includes("if (previewCloseTimer.current !== closeTimer) return;"));
  assert.ok(workspaceSource.includes('leftPreviewTriggerRef.current?.matches(":hover, :focus-visible") || previewPane?.matches(":hover, :focus-within")'));
  const bridgeRule = workspaceCss.match(/\.module-shell-icon-button--left-preview::after\s*\{([^}]+)\}/u)?.[1] ?? "";
  assert.match(bridgeRule, /top:\s*100%/u);
  assert.match(bridgeRule, /right:\s*-8px/u);
  assert.match(bridgeRule, /left:\s*-8px/u);
  assert.match(bridgeRule, /height:\s*max\(12px,\s*calc\(var\(--agent-shell-header-h,\s*3rem\)\s*-\s*36px\)\)/u);
  assert.match(workspaceSource, /className="module-shell-icon-button module-shell-icon-button--left-preview"/u);
  assert.match(workspaceSource, /clearTimeout\(previewCloseTimer\.current\);\s*previewCloseTimer\.current = null;/u);
  assert.match(workspaceSource, /<button ref=\{leftPreviewTriggerRef\} className="module-shell-icon-button module-shell-icon-button--left-preview"[\s\S]*?aria-expanded=\{!chrome\.leftCollapsed \|\| leftPreviewOpen\}[\s\S]*?onMouseEnter=\{openLeftPreview\}[\s\S]*?onMouseLeave=\{closeLeftPreview\}[\s\S]*?onFocus=\{\(event\) => \{ if \(event\.currentTarget\.matches\(":focus-visible"\)\) openLeftPreview\(\); \}\}/u);
  assert.equal((workspaceSource.match(/<ApplicationSidebar \{\.\.\.sidebarProps\} \/>/gu) ?? []).length, 1);
  assert.doesNotMatch(workspaceSource, /const leftPreview\s*=/u);
  assert.doesNotMatch(workspaceSource, /overlay=\{chrome\.leftCollapsed/u);
  assert.match(workspaceSource, /leftRegionClassName=\{leftRegionClassName\}/u);
  assert.match(workspaceSource, /onPreviewMouseEnter: openLeftPreview[\s\S]*?onPreviewMouseLeave: closeLeftPreview[\s\S]*?onPreviewBlur: closeLeftPreview/u);
  assert.match(workspaceSource, /className="module-sidebar"[^>]*onMouseEnter=\{onPreviewMouseEnter\}[^>]*onMouseLeave=\{onPreviewMouseLeave\}[^>]*onBlur=\{onPreviewBlur\}/u);
  assert.match(workspaceSource, /const leftPreviewContextRef = useRef\(\{ app, mode, section, layoutMode: metrics\.mode \}\)/u);
  assert.match(workspaceSource, /previousContext\.app === app && previousContext\.mode === mode && previousContext\.section === section && previousContext\.layoutMode === metrics\.mode\) return;[\s\S]*?leftPreviewContextRef\.current = \{ app, mode, section, layoutMode: metrics\.mode \};[\s\S]*?clearPreviewClose\(\);\s*setLeftPreviewOpen\(false\);/u);
});
