/**
 * 功能：锁定 AI Work 窄屏工作台的最小中心宽度、滚动条边界与通用 Surface 断点隔离。
 * 作用：防止应用右 Dock 改动意外压窄 Settings 等复用 ResizableWorkbench 的单栏页面或破坏聊天内缩。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveWorkbenchCenterFloor, resolveWorkbenchLayoutMetrics, shouldDockResponsiveLeftPane, shouldDockResponsiveRightPane, WORKBENCH_LAYOUT_TOKENS } from "../../../packages/client/ui-dockkit/src/workbench-layout.config.ts";
import { resolveRightCenterDragFrame, resolveSideDragRawSize, resolveSnapDragFrame, WORKBENCH_INTERACTION_TOKENS } from "../../../packages/client/ui-dockkit/src/workbench-interaction.config.ts";

const readWorkspaceCss = () => [
  "../../../packages/client/ui-workspace/src/module-workbench.css",
  "../../../packages/client/ui-workspace/src/css/secondary-navigation.css",
  "../../../packages/client/ui-workspace/src/css/center-workspace.css",
  "../../../packages/client/ui-workspace/src/css/right-menu.css",
  "../../../packages/client/ui-workspace/src/css/workbench-regions.css",
].map(path => readFileSync(new URL(path, import.meta.url), "utf8")).join("\n");

test("嵌入式工作台首次绘制前按实际容器尺寸校准响应式布局", () => {
  const metricsHook = readFileSync(new URL("../../../packages/client/ui-dockkit/src/use-workbench-metrics.ts", import.meta.url), "utf8");

  assert.match(metricsHook, /useLayoutEffect\(\(\) => \{[\s\S]*?element\.getBoundingClientRect\(\)[\s\S]*?resolveWorkbenchLayoutMetrics\(Math\.max\(0, bounds\.width - leadingInset\), bounds\.height, responsiveRightDock\)[\s\S]*?setMetrics\(/u);
  assert.match(metricsHook, /return observeWorkbenchMetrics\(element, next =>/u, "首次真实测量之后仍由 ResizeObserver 管理容器变化");
});

test("受控工作台宽度在 clamp 结果不变时不回写父状态", () => {
  const workbench = readFileSync(new URL("../../../packages/client/ui-dockkit/src/ResizableWorkbench.tsx", import.meta.url), "utf8");
  const widthSetter = workbench.slice(workbench.indexOf("const setResolvedLeftWidth"), workbench.indexOf("const rootRef"));

  assert.match(widthSetter, /const resolved = typeof next === "function" \? next\(leftWidth\) : next;[\s\S]*?if \(Object\.is\(resolved, leftWidth\)\) return;[\s\S]*?onLeftWidthChange\?\.\(resolved\)/u);
});

test("AI Work 在所有布局保留 300px 中心下限，通用 Surface 保持原断点", () => {
  const applicationDesktop = resolveWorkbenchLayoutMetrics(1536, 900, true);
  assert.equal(applicationDesktop.mode, "desktop");
  assert.equal(applicationDesktop.minCenterWidth, 300);
  assert.ok(applicationDesktop.right.max >= applicationDesktop.containerWidth
    - applicationDesktop.left.initial
    - applicationDesktop.minCenterWidth
    - WORKBENCH_LAYOUT_TOKENS.separator * 2);

  const applicationCompact = resolveWorkbenchLayoutMetrics(850, 800, true);
  assert.equal(applicationCompact.mode, "compact");
  assert.equal(applicationCompact.minCenterWidth, 300);

  const applicationMobile = resolveWorkbenchLayoutMetrics(488, 800, true);
  assert.equal(applicationMobile.mode, "mobile");
  assert.equal(applicationMobile.minCenterWidth, 300);

  const sharedWorkbench = resolveWorkbenchLayoutMetrics(850, 800);
  assert.equal(sharedWorkbench.mode, "compact");
  assert.equal(sharedWorkbench.minCenterWidth, 440);

  const sharedDesktop = resolveWorkbenchLayoutMetrics(1536, 900);
  assert.equal(sharedDesktop.minCenterWidth, 720);
  assert.equal(applicationDesktop.left.min, sharedDesktop.left.min);
  assert.equal(applicationDesktop.left.initial, sharedDesktop.left.initial);
  assert.equal(applicationDesktop.left.max, 399);
  assert.equal(sharedDesktop.left.max, 522);
  assert.ok(applicationDesktop.left.max < applicationDesktop.right.max);
  assert.deepEqual(
    { min: applicationDesktop.right.min, initial: applicationDesktop.right.initial },
    { min: sharedDesktop.right.min, initial: sharedDesktop.right.initial },
  );
  assert.ok(sharedDesktop.right.max < applicationDesktop.right.max);
});

test("AI Work 仅外移会话刻度；消息正文与输入区布局保持不变", () => {
  const workspaceCss = readWorkspaceCss();
  const chatCss = readFileSync(new URL("../../../packages/client/ui-chat/src/ai-work-chat.css", import.meta.url), "utf8");
  const anchorRule = chatCss.match(/^\.ai-work-chat__anchors\s*\{([^}]+)\}/mu)?.[1] ?? "";
  const anchorDockRule = workspaceCss.match(/^\.module-center__content\.module-center__content--ai-work \.ai-work-chat__message-stage > \.ai-work-chat__anchors\s*\{([^}]+)\}/mu)?.[1];
  const gapTokens = workspaceCss.match(/^\.module-ai-work-chat\s*\{([^}]+)\}/mu)?.[1];
  const chatWrapperRule = workspaceCss.match(/^\.module-center__content--ai-work\s*>\s*\.module-ai-work-chat\s*\{([^}]+)\}/mu)?.[1];
  const surfaceRule = workspaceCss.match(/\.module-center__content--ai-work\s+\.module-ai-work-chat\s*>\s*\.ai-work-chat\s*\{([^}]+)\}/u)?.[1];
  const conversationRule = workspaceCss.match(/^\.module-center__content--ai-work \.module-ai-work-chat > \.ai-work-chat > \.ai-work-chat__conversation\s*\{([^}]+)\}/mu)?.[1];
  const messageStageRule = workspaceCss.match(/^\.module-center__content\.module-center__content--ai-work \.ai-work-chat__message-stage\s*\{([^}]+)\}/mu)?.[1];
  const messagesRule = workspaceCss.match(/^\.module-center__content\.module-center__content--ai-work \.ai-work-chat__messages\s*\{([^}]+)\}/mu)?.[1];
  const anchorPreviewRule = workspaceCss.match(/\.module-center__content\.module-center__content--ai-work\s+\.ai-work-chat__anchor-preview\s*\{([^}]+)\}/u)?.[1];
  const insetControlsRule = workspaceCss.match(/\.module-center__content\.module-center__content--ai-work\s+:is\(\.ai-work-chat__composer,\s*\.ai-work-chat__usage-footer\)\s*\{([^}]+)\}/u)?.[1];
  const composerRule = chatCss.match(/\.ai-work-chat__composer\s*\{([^}]+)\}/u)?.[1];

  assert.ok(gapTokens, "AI Work should define its responsive chat gap tokens");
  assert.ok(chatWrapperRule, "AI Work should inset the whole central chat wrapper");
  assert.ok(surfaceRule, "AI Work chat surface should fill the inset wrapper");
  assert.ok(conversationRule, "AI Work conversation geometry should remain unchanged");
  assert.ok(messageStageRule, "AI Work message stage geometry should remain unchanged");
  assert.ok(messagesRule, "AI Work message scroller geometry should remain unchanged");
  assert.ok(anchorDockRule, "AI Work should move only the anchor rail to the pane edge");
  assert.ok(anchorPreviewRule, "AI Work anchor preview should retain its previous position");
  assert.ok(insetControlsRule, "AI Work composer and usage footer should retain the inset width and alignment");
  assert.ok(composerRule, "AI Work composer should fill its conversation column by default");
  assert.match(gapTokens, /--ai-work-chat-inline-gap:\s*clamp\(20px,\s*6cqi,\s*32px\)/u);
  assert.match(gapTokens, /--ai-work-chat-inline-gap-half:\s*clamp\(10px,\s*3cqi,\s*16px\)/u);
  assert.match(chatWrapperRule, /width:\s*calc\(100% - var\(--ai-work-chat-inline-gap\)\)/u);
  assert.match(chatWrapperRule, /align-self:\s*flex-start/u);
  assert.match(surfaceRule, /overflow-x:\s*visible/u);
  assert.match(surfaceRule, /overflow-y:\s*clip/u);
  assert.match(conversationRule, /width:\s*calc\(100% \+ var\(--ai-work-chat-inline-gap\)\)/u);
  assert.match(conversationRule, /margin-inline:\s*0/u);
  assert.match(conversationRule, /padding-inline-start:\s*var\(--ai-work-chat-inline-gap\)/u);
  assert.match(conversationRule, /box-sizing:\s*border-box/u);
  assert.match(messageStageRule, /width:\s*calc\(100% - var\(--ai-work-chat-inline-gap\)\)/u);
  assert.doesNotMatch(messageStageRule, /align-self:/u);
  assert.match(messagesRule, /width:\s*calc\(100% \+ var\(--ai-work-chat-inline-gap\)\)/u);
  assert.match(messagesRule, /padding-inline-end:\s*var\(--ai-work-chat-inline-gap\)/u);
  assert.match(anchorRule, /left:\s*0\s*;/u);
  assert.match(anchorDockRule, /left:\s*calc\(-1 \* var\(--ai-work-chat-inline-gap\)\)/u);
  assert.match(anchorPreviewRule, /left:\s*calc\(100% \+ var\(--ai-work-chat-inline-gap\) - 4px\)/u);
  assert.match(insetControlsRule, /width:\s*min\(calc\(100% - var\(--ai-work-chat-inline-gap\)\),\s*920px\)/u);
  assert.match(insetControlsRule, /left:\s*calc\(-1 \* var\(--ai-work-chat-inline-gap-half\)\)/u);
  assert.match(composerRule, /width:\s*min\(100%,\s*920px\)/u);
  assert.match(chatCss, /\.ai-work-chat__messages\s*\{[^}]*scrollbar-gutter:\s*stable/su);
});

test("AI Work 右侧滚动留白继承聊天表面材质，不透出画布底色", () => {
  const workspaceCss = readWorkspaceCss();
  const gutterSurfaceRule = workspaceCss.match(/\.module-center__content\.module-center__content--ai-work \.module-ai-work-chat > \.ai-work-chat::after\s*\{([^}]+)\}/u)?.[1];
  const accentScrollbarRule = workspaceCss.match(/\.module-center__content\.module-center__content--ai-work \.ai-work-chat__messages\s*\{(?=[^}]*scrollbar-color:)([^}]+)\}/u)?.[1];
  const accentThumbRule = workspaceCss.match(/\.module-center__content\.module-center__content--ai-work \.ai-work-chat__messages::-webkit-scrollbar-thumb\s*\{([^}]+)\}/u)?.[1];

  assert.ok(gutterSurfaceRule, "AI Work should extend the chat surface behind its right-edge scroll gutter");
  assert.ok(accentScrollbarRule, "AI Work should retain the Appearance accent color on the message scrollbar");
  assert.ok(accentThumbRule, "WebKit message scrollbars should retain the Appearance accent color");
  assert.match(gutterSurfaceRule, /inset-inline-start:\s*100%/u);
  assert.match(gutterSurfaceRule, /width:\s*var\(--ai-work-chat-inline-gap\)/u);
  assert.match(gutterSurfaceRule, /background:\s*inherit/u);
  assert.match(gutterSurfaceRule, /(?:-webkit-)?backdrop-filter:\s*inherit/u);
  assert.match(gutterSurfaceRule, /pointer-events:\s*none/u);
  assert.match(accentScrollbarRule, /scrollbar-color:\s*var\(--settings-accent, var\(--color-brand\)\) transparent !important/u);
  assert.match(accentThumbRule, /border:\s*0(?:px)?;/u);
  assert.match(accentThumbRule, /background:\s*var\(--settings-accent, var\(--color-brand\)\)/u);
  assert.doesNotMatch(accentThumbRule, /background-clip:\s*content-box/u);
});

test("响应式应用工作区仅在中心区和左栏下限都放得下时将二级导航改为 Dock", () => {
  assert.equal(shouldDockResponsiveLeftPane(750, 300, 200, true), true);
  assert.equal(shouldDockResponsiveLeftPane(500, 300, 200, true), false);
  assert.equal(shouldDockResponsiveLeftPane(501, 300, 200, true), true);
  assert.equal(shouldDockResponsiveLeftPane(750, 300, 200, false), false);
});

test("Mobile 左导航 Dock 复用大屏标准分隔条宽度", () => {
  assert.equal(WORKBENCH_LAYOUT_TOKENS.separator, 1);
  assert.equal(shouldDockResponsiveLeftPane(501, 300, 200, true), true);
  assert.equal(shouldDockResponsiveLeftPane(500, 300, 200, true), false);
});

test("Mobile 工作区标题栏只保留一行，并与菜单 Overlay 顶边对齐", () => {
  const workspaceCss = readWorkspaceCss();
  const mobileHeader = workspaceCss.match(/\.module-center__header\[data-layout-mode="mobile"\]\s*\{([^}]+)\}/u)?.[1];

  assert.ok(mobileHeader, "mobile chat header should have a responsive rule");
  assert.doesNotMatch(mobileHeader, /display:|grid-template-|min-height:/u);
  assert.equal([...workspaceCss.matchAll(/--agent-shell-header-h:\s*3rem/gu)].length, 1);
  assert.doesNotMatch(workspaceCss, /\.module-center__header\[data-layout-mode="mobile"\]\s+\.module-center__(?:heading|actions)/u);
  assert.match(workspaceCss, /\.module-left-preview\s*\{[\s\S]*?top:\s*var\(--agent-shell-header-h\)/u);
  assert.match(workspaceCss, /\.module-sidebar__brand-row\s*\{[\s\S]*?min-height:\s*var\(--agent-shell-header-h,\s*3rem\)/u);
});

test("中心区收起时左二菜单保留自身可见关闭入口", () => {
  const workspaceCss = readWorkspaceCss();
  const workspaceSource = readFileSync(new URL("../../../packages/client/ui-workspace/src/ApplicationWorkspace.tsx", import.meta.url), "utf8");

  assert.match(workspaceCss, /\.lfaa-workbench\[data-center-collapsed="true"\]\s+\.module-sidebar__close\s*\{\s*display:\s*grid;\s*\}/u);
  assert.match(workspaceSource, /className="module-icon-button module-sidebar__close"[^>]*aria-label="收起应用导航"[\s\S]*?onToggleLeft\(\)/u);
});

test("中心区横向列变化使用缓入缓出，终端纵向行沿用原曲线", () => {
  const dockKitCss = readFileSync(new URL("../../../packages/client/ui-dockkit/src/css/common-layout.css", import.meta.url), "utf8");

  assert.match(dockKitCss, /grid-template-columns var\(--lfaa-snap-settle-duration\) cubic-bezier\(\.42,\s*0,\s*\.58,\s*1\)/u);
  assert.match(dockKitCss, /grid-template-rows:\s*minmax\(0, 1fr\) var\(--lfaa-bottom-row\)[\s\S]*?grid-template-rows var\(--lfaa-snap-settle-duration\) cubic-bezier\(\.16,\s*\.82,\s*\.24,\s*1\)/u);
});

test("中心区和右栏都收起时关闭左二菜单会恢复中心工作区", () => {
  const workspaceSource = readFileSync(new URL("../../../packages/client/ui-workspace/src/ApplicationWorkspace.tsx", import.meta.url), "utf8");

  assert.match(workspaceSource, /if\s*\(!chrome\.leftCollapsed\s*&&\s*centerCollapsed\s*&&\s*chrome\.rightCollapsed\)\s*setCenterCollapsed\(false\)/u);
});

test("窄中心列将操作压缩为图标，同时保留当前对话名", () => {
  const workspaceCss = readWorkspaceCss();
  const workspaceSource = readFileSync(new URL("../../../packages/client/ui-workspace/src/ApplicationWorkspace.tsx", import.meta.url), "utf8");

  assert.match(workspaceCss, /\.module-center\s*\{[^}]*container-name:\s*module-center/u);
  assert.match(workspaceCss, /@container\s+module-center\s*\(max-width:\s*560px\)[\s\S]*?\.module-center__voice-button/u);
  assert.match(workspaceCss, /@container module-center \(max-width: 560px\)[\s\S]*?\.module-center__title strong \{ min-width: 0; font-size: var\(--font-size-xs\); \}/u);
  assert.doesNotMatch(workspaceCss, /\.module-center__title strong\s*\{\s*font-size:\s*0/u, "窄中心列仍应显示可截断的会话名");
  assert.match(workspaceSource, /<strong>\{mode === "ai-work" \? activeAiSessionTitle\?\.trim\(\) \|\| "小鱼智能体" : activeApplicationTitle\}<\/strong>/u);
  assert.match(workspaceCss, /\.module-center__work-tabs\s*>\s*button:not\(\.module-git-summary-trigger\)\s*>\s*span\s*\{\s*display:\s*none;/u);
  assert.match(workspaceSource, /className="module-center__voice-button"[^>]*aria-label="语音主脑"[^>]*title="语音主脑"/u);
  assert.match(workspaceSource, /module-runtime-state[^>]*role="img"[^>]*aria-label=\{statusLabel\}[^>]*title=\{statusLabel\}/u);
  assert.match(workspaceSource, /aria-label=\{`当前 Agent 的 Git 变更：\$\{gitSummaryText\}`\}/u);
});

test("Git 摘要抽屉从中心内容区顶部贴右侧分隔线展开，遵循减少动态效果设置", () => {
  const workspaceCss = readWorkspaceCss();
  const workspaceSource = readFileSync(new URL("../../../packages/client/ui-workspace/src/ApplicationWorkspace.tsx", import.meta.url), "utf8");

  assert.match(workspaceCss, /^\.module-center\s*\{[^}]*position:\s*relative;/mu);
  assert.match(workspaceSource, /getPopupContainer=\{trigger => trigger\.closest\("\.module-center"\) \?\? document\.body\}/u);
  assert.match(workspaceCss, /\.module-git-summary-popover\s*\{[^}]*inset-inline-start:\s*auto !important;[^}]*inset-inline-end:\s*0 !important;[^}]*top:\s*var\(--agent-shell-header-h,\s*3rem\) !important;[^}]*bottom:\s*auto !important;[^}]*height:\s*auto !important;[^}]*transform:\s*none !important;[^}]*transform-origin:\s*right center;/u);
  assert.match(workspaceCss, /^\.module-git-summary\s*\{[^}]*height:\s*auto;\s*max-height:\s*min\(72dvh,\s*620px\)/mu);
  assert.match(workspaceCss, /\.module-git-summary-popover\.ant-zoom-big-fast-enter-active,[\s\S]*?animation:\s*module-git-summary-drawer-in/u);
  assert.match(workspaceCss, /@keyframes module-git-summary-drawer-in\s*\{\s*from\s*\{\s*clip-path:\s*inset\(0 0 0 100%\)/u);
  assert.match(workspaceCss, /data-reduced-motion="on"\] \.module-git-summary-popover\s*\{\s*animation-duration:\s*0ms/u);
  assert.match(workspaceCss, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.workbench-shell\[data-reduced-motion="system"\] \.module-git-summary-popover/u);
});

test("Git 摘要四项操作菜单完整留在摘要卡范围内", () => {
  const workspaceCss = readWorkspaceCss();

  assert.match(workspaceCss, /\.module-git-summary__operations-menu\s*\{[^}]*inset-inline-start:\s*8px;[^}]*max-width:\s*100%;/u);
  assert.doesNotMatch(workspaceCss, /\.module-git-summary__operations-menu\s*\{[^}]*inset-inline-start:\s*-\d/u);
});

test("Compact/Mobile 右栏空间足够时沿用共享 Dock 与拉伸预算", () => {
  assert.equal(shouldDockResponsiveRightPane(528, 300, 228, 0, true), false);
  assert.equal(shouldDockResponsiveRightPane(529, 300, 228, 0, true), true);
  assert.equal(shouldDockResponsiveRightPane(729, 300, 228, 200, true), false);
  assert.equal(shouldDockResponsiveRightPane(730, 300, 228, 200, true), true);
  assert.equal(shouldDockResponsiveRightPane(850, 440, 228, 0, true), true);
  assert.equal(shouldDockResponsiveRightPane(850, 440, 228, 0, false), false);
});

test("极窄屏右栏才退回共享 Overlay", () => {
  assert.equal(shouldDockResponsiveRightPane(382, 300, 228, 0, true), false);
  assert.equal(shouldDockResponsiveRightPane(272, 300, 228, 0, true), false);
});

test("窄屏导航使用 Overlay，中屏导航 Dock 后保留完整中心区", () => {
  const cases = [
    { viewportWidth: 320, railWidth: 48, expected: "overlay", mode: "mobile" },
    { viewportWidth: 390, railWidth: 48, expected: "overlay", mode: "mobile" },
    { viewportWidth: 530, railWidth: 64, expected: "overlay", mode: "mobile" },
    { viewportWidth: 626, railWidth: 64, expected: "dock", mode: "mobile" },
    { viewportWidth: 753, railWidth: 64, expected: "dock", mode: "mobile" },
    { viewportWidth: 793, railWidth: 64, expected: "dock", mode: "mobile" },
    { viewportWidth: 794, railWidth: 64, expected: "dock", mode: "compact" },
  ];

  for (const { viewportWidth, railWidth, expected, mode } of cases) {
    const containerWidth = viewportWidth - railWidth;
    const metrics = resolveWorkbenchLayoutMetrics(containerWidth, 740, true);
    assert.equal(metrics.mode, mode, `${viewportWidth}px viewport should use ${mode} workbench rules`);
    assert.equal(
      shouldDockResponsiveLeftPane(containerWidth, metrics.minCenterWidth, metrics.left.min, true),
      expected === "dock",
      `${viewportWidth}px viewport should choose ${expected}`,
    );
    if (mode === "compact") {
      const threePaneMinimum = metrics.left.min + metrics.minCenterWidth + metrics.right.min + WORKBENCH_LAYOUT_TOKENS.separator * 2;
      assert.ok(threePaneMinimum <= containerWidth, `${viewportWidth}px viewport should preserve all three compact pane minima`);
    }
  }
});


test('760×520 聊天保留中心最小宽度，右栏仅在左栏收起后可 Dock', () => {
  const metrics = resolveWorkbenchLayoutMetrics(760 - 64, 520, false);
  assert.equal(metrics.mode, 'compact');
  assert.ok(metrics.minCenterWidth >= 420);
  assert.equal(shouldDockResponsiveRightPane(metrics.containerWidth, metrics.minCenterWidth, metrics.right.min, metrics.left.initial, true), false);
  assert.equal(shouldDockResponsiveRightPane(metrics.containerWidth, metrics.minCenterWidth, metrics.right.min, 0, true), true);
  assert.ok(metrics.containerWidth - metrics.right.min - WORKBENCH_LAYOUT_TOKENS.separator >= metrics.minCenterWidth);
});

test("侧栏拖动从当前实际宽度起算，指针按下时不跳变且左右方向一致", () => {
  assert.equal(resolveSideDragRawSize("left", 280, 365, 365), 280);
  assert.equal(resolveSideDragRawSize("left", 280, 365, 401), 316);
  assert.equal(resolveSideDragRawSize("left", 280, 365, 329), 244);

  assert.equal(resolveSideDragRawSize("right", 250, 900, 900), 250);
  assert.equal(resolveSideDragRawSize("right", 250, 900, 936), 214);
  assert.equal(resolveSideDragRawSize("right", 250, 900, 864), 286);

  assert.equal(WORKBENCH_INTERACTION_TOKENS.pointer.activationDistancePx, 3);
});

test("工作台 DOM 固定左栏、中间区与右菜单顺序，点击分隔线无变化且已收起的 Dock 不接受新拖动", () => {
  const commonCss = ["common-layout.css", "common-pane.css", "common-pointer.css", "common-bottom.css", "common-responsive.css"].map(file => readFileSync(new URL(`../../../packages/client/ui-dockkit/src/css/${file}`, import.meta.url), "utf8")).join("\n");
  const pointerOwner = readFileSync(new URL("../../../packages/client/ui-dockkit/src/ResizableWorkbench.tsx", import.meta.url), "utf8");
  const workspaceOwner = readFileSync(new URL("../../../packages/client/ui-workspace/src/ApplicationWorkspace.tsx", import.meta.url), "utf8");
  const workspaceCss = readWorkspaceCss();
  const pointerMove = pointerOwner.slice(pointerOwner.indexOf("const onSidePointerMove"), pointerOwner.indexOf("const finishSideDrag"));
  const pointerDown = pointerOwner.slice(pointerOwner.indexOf("const onSidePointerDown"), pointerOwner.indexOf("const onSidePointerMove"));
  const finishPointer = pointerOwner.slice(pointerOwner.indexOf("const finishSideDrag"), pointerOwner.indexOf("// ===== 5."));

  assert.match(commonCss, /\.lfaa-workbench__center \{ grid-column: 4; grid-row: 1; \}/u);
  assert.match(commonCss, /\.lfaa-workbench__handle--right \{ grid-column: 5; grid-row: 1; \}/u);
  assert.match(commonCss, /\.lfaa-workbench__pane--right \{ grid-column: 6; grid-row: 1; \}/u);
  assert.doesNotMatch(`${commonCss}\n${pointerOwner}\n${workspaceOwner}\n${workspaceCss}`, /right-swapped|rightSwapped|rightPaneSwapped|swap-control|onSwapPanes|togglePaneOrder/u);
  assert.match(pointerMove, /if \(!drag\.activated\)[\s\S]*activationDistancePx[\s\S]*drag\.activated = true/u);
  assert.match(finishPointer, /if \(!drag\.activated\)[\s\S]*sideDragRef\.current = null;[\s\S]*return;/u);
  assert.match(pointerDown, /if \(collapsed\) return;/u);
  assert.ok(commonCss.includes('.lfaa-workbench[data-left-collapsed="true"]:not([data-dragging="left"]) .lfaa-workbench__handle--left'));
  assert.ok(commonCss.includes('.lfaa-workbench[data-right-collapsed="true"]:not([data-dragging="right"]) .lfaa-workbench__handle--right'));
  assert.match(commonCss, /pointer-events: none;\s*cursor: default;/u);
  assert.match(pointerOwner, /"--lfaa-left-handle-width": `\$\{leftVisible && leftUsesGrid \? HANDLE_WIDTH : 0\}px`/u);
  assert.match(pointerOwner, /"--lfaa-right-handle-width": `\$\{rightEnabled && rightUsesGrid \? HANDLE_WIDTH : 0\}px`/u);
  assert.ok(commonCss.includes('.lfaa-workbench[data-dragging="left"]:not([data-snap-preview="left"]) .lfaa-workbench__pane--left'));
  assert.match(pointerOwner, /const collapseKey = side === "left" \? "ArrowLeft" : "ArrowRight"/u);
  assert.match(pointerOwner, /const expandKey = side === "left" \? "ArrowRight" : "ArrowLeft"/u);
});

test("一次按住拖动可吸附后反向展开；pointerup 后不可另起拖动拉出", () => {
  const captured = resolveSnapDragFrame({ rawSize: 80, minSize: 200, maxSize: 700, captureThreshold: 100, snapped: false, releaseHysteresis: 24 });
  const releasedBeforePointerUp = resolveSnapDragFrame({ rawSize: 224, minSize: 200, maxSize: 700, captureThreshold: 100, snapped: captured.snapped, releaseHysteresis: 24 });

  assert.equal(captured.snapped, true);
  assert.equal(releasedBeforePointerUp.snapped, false);
  assert.equal(releasedBeforePointerUp.visualSize, 224);
  assert.equal(WORKBENCH_INTERACTION_TOKENS.pointer.activationDistancePx, 3);

  const pointerOwner = readFileSync(new URL("../../../packages/client/ui-dockkit/src/ResizableWorkbench.tsx", import.meta.url), "utf8");
  const pointerDown = pointerOwner.slice(pointerOwner.indexOf("const onSidePointerDown"), pointerOwner.indexOf("const onSidePointerMove"));
  const pointerMove = pointerOwner.slice(pointerOwner.indexOf("const onSidePointerMove"), pointerOwner.indexOf("const finishSideDrag"));
  const finishPointer = pointerOwner.slice(pointerOwner.indexOf("const finishSideDrag"), pointerOwner.indexOf("// ===== 5."));
  assert.match(pointerDown, /if \(collapsed\) return;[\s\S]*setPointerCapture\(event\.pointerId\)/u);
  assert.match(pointerMove, /activationDistancePx[\s\S]*drag\.activated = true/u);
  assert.match(pointerMove, /drag\.snapped \? drag\.side : "none"/u);
  assert.match(finishPointer, /if \(drag\.snapped\)[\s\S]*setResolvedLeftCollapsed\(true\)/u);
  assert.match(finishPointer, /sideDragRef\.current = null;[\s\S]*root\.dataset\.dragging = "none"/u);
});

test("右 Dock 扩展时中心列先保留最小宽度，超拖到阈值后才吸附收起", () => {
  const input = {
    rightMinSize: 240,
    maxRightSize: 1260,
    rightCaptureThreshold: 120,
    rightSnapped: false,
    centerMinSize: 300,
    centerCaptureThreshold: 150,
    centerSnapped: false,
    releaseHysteresis: 24,
  };
  const atCenterFloor = resolveRightCenterDragFrame({ ...input, rawRightSize: 1109 });
  const captured = resolveRightCenterDragFrame({ ...input, rawRightSize: 1110 });
  const released = resolveRightCenterDragFrame({ ...input, rawRightSize: 936, centerSnapped: true });
  const rightDockCaptured = resolveRightCenterDragFrame({ ...input, rawRightSize: 100 });

  assert.equal(atCenterFloor.centerFrame.snapped, false);
  assert.equal(atCenterFloor.visualCenterSize, 300);
  assert.equal(atCenterFloor.visualRightSize, 960);
  assert.equal(captured.centerFrame.snapped, true);
  assert.equal(captured.visualCenterSize, 0);
  assert.equal(captured.visualRightSize, 1260);
  assert.equal(released.centerFrame.snapped, false);
  assert.equal(released.visualCenterSize, 324);
  assert.equal(released.visualRightSize, 936);
  assert.equal(rightDockCaptured.rightFrame.snapped, true);
  assert.equal(rightDockCaptured.visualRightSize, 0);
  assert.equal(rightDockCaptured.visualCenterSize, 1260);
});

test("中心列阈值以容器总预算计算，不会因右 Dock 静态上限而提前吸附", () => {
  const input = {
    rightMinSize: 240,
    maxRightSize: 1484,
    rightCaptureThreshold: 120,
    rightSnapped: false,
    centerMinSize: 300,
    centerCaptureThreshold: 150,
    centerSnapped: false,
    releaseHysteresis: 24,
  };
  const atCenterFloor = resolveRightCenterDragFrame({ ...input, rawRightSize: 1184 });
  const beforeCapture = resolveRightCenterDragFrame({ ...input, rawRightSize: 1333 });
  const captured = resolveRightCenterDragFrame({ ...input, rawRightSize: 1334 });

  assert.equal(atCenterFloor.centerFrame.snapped, false);
  assert.equal(atCenterFloor.visualCenterSize, 300);
  assert.equal(beforeCapture.centerFrame.snapped, false);
  assert.equal(beforeCapture.visualCenterSize, 300);
  assert.equal(captured.centerFrame.snapped, true);
  assert.equal(captured.visualCenterSize, 0);
});

test("中心区折叠后左右栏共享释放中心下限的预算，左栏不会被错误压到 0", () => {
  const metrics = resolveWorkbenchLayoutMetrics(1878, 906, true);
  const handleBudget = WORKBENCH_LAYOUT_TOKENS.separator * 2;
  const collapsedRightWidth = metrics.containerWidth - metrics.left.min - handleBudget;
  const collapsedCenterFloor = resolveWorkbenchCenterFloor(metrics.minCenterWidth, true);
  const leftMaxWidth = Math.max(0, metrics.containerWidth - collapsedRightWidth - collapsedCenterFloor - handleBudget);
  const expandedCenterFloor = resolveWorkbenchCenterFloor(metrics.minCenterWidth, false);
  const collapsePreviewFloor = resolveWorkbenchCenterFloor(metrics.minCenterWidth, true);
  const workbench = readFileSync(new URL("../../../packages/client/ui-dockkit/src/ResizableWorkbench.tsx", import.meta.url), "utf8");

  assert.equal(metrics.minCenterWidth, 300);
  assert.equal(collapsedRightWidth, 1596);
  assert.equal(leftMaxWidth, metrics.left.min);
  assert.equal(expandedCenterFloor, 300);
  assert.equal(collapsePreviewFloor, 0);
  assert.match(workbench, /resolveWorkbenchCenterFloor\(minCenterWidth, centerCollapsed\s*\|\|\s*\(side === "right" && allowCenterCollapse && centerCollapseEnabled && rightUsesGrid\)\)/u);
  assert.match(workbench, /"--lfaa-center-column": `minmax\(0, \$\{centerCollapsed \? "0fr" : "1fr"\}\)`/u);
});

test("仅 AI Work 右 Dock 拖动期间停用大面积毛玻璃，并复用 DockKit 清理恢复", () => {
  const workbenchCss = readFileSync(new URL("../../../packages/client/ui-layout/src/workbench.css", import.meta.url), "utf8");
  const pointerOwner = readFileSync(new URL("../../../packages/client/ui-dockkit/src/ResizableWorkbench.tsx", import.meta.url), "utf8");
  const override = workbenchCss.match(/body\.lfaa-is-resizing \.workbench-shell \.lfaa-workbench\[data-dragging="right"\]:has\(\.ai-work-chat\) :is\(([\s\S]*?)\)\s*\{([^}]+)\}/u);

  assert.ok(override, "right-drag override should be scoped to a Workbench containing AI Work");
  assert.match(override[1], /\.module-context/u);
  assert.match(override[1], /\.ai-work-chat/u);
  assert.match(override[1], /\.ai-work-chat__composer/u);
  assert.match(override[2], /-webkit-backdrop-filter:\s*none/u);
  assert.match(override[2], /backdrop-filter:\s*none/u);
  assert.match(pointerOwner, /document\.body\.classList\.remove\("lfaa-is-resizing"\)/u);
  assert.match(pointerOwner, /root\.dataset\.dragging = "none";/u);
  assert.match(pointerOwner, /const cancelPointerInteractions = useCallback/u);
});
