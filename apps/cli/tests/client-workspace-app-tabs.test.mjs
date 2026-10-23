/**
 * 功能：回归 AI Work 顶部应用标签与公共布局中心列的切换合同。
 * 作用：检查会话/工作台标签复用当前 Browser Owner，并确保零宽中心仅由受控调用方启用。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const workspace = read("../../../packages/client/ui-workspace/src/ApplicationWorkspace.tsx");
const workbenchSource = read("../../../packages/client/ui-layout/src/Workbench.tsx");
const browserPanel = read("../../../packages/client/ui-sidebar-browser/src/BrowserPanel.tsx");
const browserPanelCss = read("../../../packages/client/ui-sidebar-browser/src/browser-panel.css");
const workbench = read("../../../packages/client/ui-dockkit/src/ResizableWorkbench.tsx");
const workbenchTypes = read("../../../packages/client/ui-dockkit/src/workbench-layout.types.ts");
const workbenchCss = [
  "common-layout.css",
  "common-pane.css",
  "common-pointer.css",
  "common-bottom.css",
  "common-responsive.css",
].map(file => read(`../../../packages/client/ui-dockkit/src/css/${file}`)).join("\n");
const workspaceCss = [
  "../../../packages/client/ui-workspace/src/module-workbench.css",
  "../../../packages/client/ui-workspace/src/css/secondary-navigation.css",
  "../../../packages/client/ui-workspace/src/css/center-workspace.css",
  "../../../packages/client/ui-workspace/src/css/right-menu.css",
  "../../../packages/client/ui-workspace/src/css/workbench-regions.css",
].map(read).join("\n");

test("AI Work 中心区收起后显示会话、新标签页及动态工具标签", () => {
  assert.match(workspace, /const showWorkbenchTabs = mode === "ai-work" && !voiceMode/u);
  assert.match(workspace, /role="tablist" aria-label="工作区标签"/u);
  assert.match(workspace, /id="module-workbench-tab-chat"[\s\S]*?aria-selected=\{selectedWorkbenchTab === "chat"\}/u);
  assert.match(workspace, /aria-label=\{activeAiSessionTitle\?\.trim\(\) \|\| "小鱼智能体"\} title=\{activeAiSessionTitle\?\.trim\(\) \|\| "小鱼智能体"\}/u);
  assert.ok(workspace.includes('useState<WorkspaceUtilityTab[]>([{ id: "workspace-tab-1", kind: "new" }])'), "入口首先是一张可新建的空白功能页，不预置固定工作台页签");
  assert.match(workspace, /if \(tab\.kind === "new"\) return "新标签页"/u);
  assert.doesNotMatch(workspace, /aria-label="LFAA 工作台"|<span>LFAA 工作台<\/span>/u);
  assert.match(workspace, /module-workbench-tab-add[\s\S]*?aria-label="新建标签页"[\s\S]*?onClick=\{createWorkspaceUtilityTab\}/u);
  assert.match(workspace, /module-workbench-tab-close[\s\S]*?aria-label=\{`关闭\$\{title\}`\}[\s\S]*?closeWorkspaceUtilityTab\(tab\.id\)/u);
  const closeUtilityTab = workspace.match(/const closeWorkspaceUtilityTab = useCallback\(\(tabId: string\) => \{([\s\S]*?)\n  \}, \[activeWorkspaceUtilityTabId/u)?.[1];
  assert.ok(closeUtilityTab, "右侧标签关闭逻辑应可定位");
  assert.match(closeUtilityTab, /if \(nextTabs\.length === 0\)[\s\S]*?kind: "new"[\s\S]*?setWorkspaceUtilityTabs\(\[replacementTab\]\)[\s\S]*?setActiveWorkspaceUtilityTabId\(replacementTab\.id\)[\s\S]*?showWorkspaceUtilityTab\(replacementTab\)[\s\S]*?setChrome\(current => \(\{ \.\.\.current, rightCollapsed: true \}\)\)/u, "关闭最后一个功能标签后保留空白新标签状态并收起右侧菜单栏");
  assert.doesNotMatch(closeUtilityTab, /setCenterCollapsed\(false\)/u, "关闭右栏标签不应改变中心区开合状态");
  assert.match(workspace, /const showWorkspaceUtilityTab = useCallback\(\(tab: WorkspaceUtilityTab\) => \{[\s\S]*?rightCollapsed: false/u, "选中替代新标签时显式保持右侧栏展开");
  assert.match(workspace, /module-workbench-tab-close[\s\S]*?onClick=\{event => \{ event\.stopPropagation\(\); closeWorkspaceUtilityTab\(tab\.id\); \}\}/u, "关闭按钮阻止事件冒泡到标签选择交互");
  assert.match(workspace, /openWorkspaceUtility = useCallback\(\(kind: Exclude<WorkspaceUtilityTab\["kind"\], "new">/u);
  assert.doesNotMatch(workspace, /kind: "browser"|openWorkspaceUtility\("browser"\)/u, "浏览器不会再创建另一个工作区工具标签");
  assert.match(workspace, /onClick=\{\(\) => openWorkspaceUtility\("git"\)\}/u);
  assert.match(workspace, /onClick=\{\(\) => openWorkspaceUtility\("applications"\)\}/u);
  assert.match(workspace, /sidebarRight\.tabs\.map\(tab => <button[\s\S]*?openWorkspaceUtility\("extension", tab\.id\)/u, "扩展入口由真实登记的右侧面板动态生成");
  assert.match(workspace, /registeredExtensions\.filter\(item => !item\.applicationIds \|\| item\.applicationIds\.includes\(app\)\)\.map/u, "能力资源从当前应用的真实登记目录展示");
  const legacyRightNav = workspace.match(/mode !== "ai-work" \? <nav className="module-context__tabs"[\s\S]*?<\/nav> : null/u)?.[0];
  assert.ok(legacyRightNav, "普通应用仍保留自己的右侧上下文导航");
  assert.doesNotMatch(legacyRightNav, />浏览器|>变更/u, "AI Work 不再将工具功能固定在右侧互斥导航行");
  assert.match(workspace, /const activeCenterCollapsed = centerCollapsePreview \?\? centerCollapsed/u, "拖动预览优先于已提交的中心列状态");
  assert.match(workspace, /const toggleCenterCollapsed = useCallback\(\(\) => \{\s*setCenterCollapsePreview\(null\);\s*setCenterCollapsed\(collapsed => !collapsed\);/u, "双击切换只改变受控中心区状态并清除旧预览");
  assert.match(workspace, /const workbenchTabs = showWorkbenchTabs \? <div className="module-workbench-tabstrip"/u, "右侧工作区标签在聊天区展开时也显示");
  assert.match(workspace, /selectRightUtilityTab = useCallback\(\(tab: WorkspaceUtilityTab\)/u, "右侧标签切换复用当前 Utility Owner");
  assert.match(workspace, /onClick=\{\(\) => activeCenterCollapsed \? selectWorkbenchTab\(tab\.id\) : selectRightUtilityTab\(tab\)\}/u, "聊天区展开时切换右侧标签不收起中间工作区");
  assert.match(workspace, /onClick=\{\(\) => activeCenterCollapsed \? selectWorkbenchTab\(tab\.id\) : selectRightUtilityTab\(tab\)\} onDoubleClick=\{toggleCenterCollapsed\}/u, "单击仍选择工具，双击同一标签独立切换中心区");
  assert.match(workspace, /title=\{`\$\{title\} · 双击切换中间区`\}/u, "标签提示可发现双击操作");
  assert.match(workspace, /<strong>\{mode === "ai-work" \? activeAiSessionTitle\?\.trim\(\) \|\| "小鱼智能体" : activeApplicationTitle\}<\/strong>/u, "中心区显示当前工作区名称");
  assert.doesNotMatch(workspace, /module-workbench-collapse-header|module-workbench-main--tabs/u, "页签应进入右侧 Dock 自己的标题行，不新增整行全局标题栏");
  const center = workspace.match(/const center = \([\s\S]*?\n  const gitManagerPanel/u)?.[0];
  assert.ok(center, "中心区 JSX 应可定位");
  assert.doesNotMatch(center, /workbenchTabs/u, "中心区标题只放当前会话名，不挂切换页签");
  const right = workspace.match(/const right = \([\s\S]*?\n  const bottom/u)?.[0];
  assert.ok(right, "右侧菜单 JSX 应可定位");
  assert.match(right, /!chrome\.rightCollapsed && \(metrics\.mode === "desktop" \|\| showWorkbenchTabs\)[\s\S]*?module-context__shell-actions[\s\S]*?\{workbenchTabs\}[\s\S]*?module-context__body/u, "右侧菜单打开时标签栏常驻在右侧标题行");
  assert.match(right, /id=\{showWorkbenchTabs && !chrome\.rightCollapsed \? "module-workbench-tab-panel" : undefined\}[\s\S]*?role=\{showWorkbenchTabs && !chrome\.rightCollapsed \? "tabpanel"/u, "页签与右侧菜单内容面板保持同级关系");
  assert.match(right, /选择工具，在当前标签页打开/u);
  assert.match(workspace, /onCenterCollapsePreviewChange=\{setCenterCollapsePreview\}/u);
  assert.match(workspace, /setAiWorkView\(tab\.kind === "git" \? "git" : "chat"\)/u);
  assert.match(workspace, /if \(tab === "chat"\) \{\s*setCenterCollapsed\(false\)/u);
  assert.match(workspace, /activeWorkspaceUtilityTabKind === "new" \? <Suspense[\s\S]*?<BrowserPanel sessionId=\{activeAiSessionId\} settings=\{settings\} hidden=\{!activeWorkspaceUtilityTab\?\.browserUrl\} navigationRequest=\{activeWorkspaceUtilityTab\?\.browserNavigationRequest[^>]*onOpenTabsChange=\{handleBrowserOpenTabsChange\}/u);
  assert.match(workspace, /<ResizableWorkbench[\s\S]*?centerCollapsed=\{showWorkbenchTabs && centerCollapsed\}/u);
  assert.match(workbenchTypes, /onCenterCollapsePreviewChange\?: \(preview: boolean \| null\) => void/u);
  assert.match(workbench, /if \(previousCenterSnapped !== sideDrag\.centerSnapped\) onCenterCollapsePreviewChange\?\.\(sideDrag\.centerSnapped\)/u, "公共布局仅在进入或退出吸附预览时通知页面");
  assert.match(workbench, /if \(drag\.centerCollapseEnabled\) onCenterCollapsePreviewChange\?\.\(null\)/u, "松开后清除临时预览状态");
  assert.match(workbench, /if \(sideDrag\?\.centerCollapseEnabled\) onCenterCollapsePreviewChange\?\.\(null\)/u, "取消拖动后清除临时预览状态");
});

test("游戏库将运行环境、Minecraft 与 SteamCMD 收入四栏工作区唯一入口", async () => {
  const { normalizeWorkRoute } = await import("../../../packages/util/values/src/application-id.ts");
  assert.equal(normalizeWorkRoute("/apps/steamcmd/normal"), "/games/steamcmd");
  assert.equal(normalizeWorkRoute("/apps/minecraft/normal/instance/123/overview"), "/games/minecraft/instance/123/overview");
  assert.equal(normalizeWorkRoute("/apps/minecraft/ai-work"), "/work");
  assert.match(workbenchSource, /\.filter\(\(application\) => application\.id !== "steamcmd" && application\.id !== "minecraft"\)/u, "应用导航只保留游戏库一级入口");
  assert.match(workbenchSource, /applicationContent=\{isGameLibraryRoute && app === "workspace" \? <GameLibraryPage/u, "游戏库和运行环境在同一个 ApplicationWorkspace 内容区渲染");
  assert.match(workspace, /gameLibrary \? <nav className="module-context__app-menu" aria-label="游戏库菜单"/u, "四栏右侧菜单提供游戏库内部导航");
});

test("浏览器导航保留上一帧，滚轮只滚网页并合并截图刷新", () => {
  assert.match(browserPanel, /const BROWSER_SCROLL_INPUT_DELAY_MS = 60/u, "滚动事件快速合并，减少首个滚轮响应等待");
  assert.match(browserPanel, /const BROWSER_VISUAL_REFRESH_DELAY_MS = 40/u, "滚轮操作完成后尽快刷新网页画面");
  assert.match(browserPanel, /prewarmBrowserDock\(providerId, controller\.signal\)/u, "打开浏览器标签时提前启动可用的隔离浏览器进程");
  assert.match(browserPanel, /return \(\) => controller\.abort\(\);\s*\}, \[browserProviderReady, providerId\]\)/u, "切换或卸载标签时撤销未完成的预热请求");
  assert.match(browserPanel, /loading \|\| snapshot\.loading/u, "导航请求结束但文档尚未渲染时仍显示加载状态");
  assert.match(browserPanel, /setTimeout\(flushWheel, BROWSER_SCROLL_INPUT_DELAY_MS\)/u);
  assert.match(browserPanel, /viewport\.addEventListener\("wheel", onWheel, \{ capture: true, passive: false \}\)/u, "用非被动捕获监听消费滚轮，避免工作区外层同时滚动");
  assert.match(browserPanel, /if \(actionInFlight\.current\) \{[\s\S]*?setTimeout\(flushWheel, BROWSER_SCROLL_INPUT_DELAY_MS\)/u, "上次滚动完成前累计滚轮距离，不排队提交重复页面动作");
  assert.match(browserPanel, /const wheelPending = Math\.abs\(wheelDeltaRef\.current\) >= 1;[\s\S]*?else if \(needsVisualRefreshRef\.current/u, "连续滚动期间跳过中间整页截图，停止后刷新最终画面");
  assert.match(browserPanelCss, /\.lfaa-browser-panel__content\s*\{[^}]*overflow: hidden;[^}]*overscroll-behavior: none;/u, "浏览器截图内容区不再成为页面级滚动容器");
  assert.match(browserPanel, /\}, BROWSER_VISUAL_REFRESH_DELAY_MS\)/u);
  assert.match(workspace, /if \(activeUtilityTab\?\.kind === "new" && activeBrowserTab && \(activeUtilityTab\.browserUrl !== undefined \|\| activeBrowserPageChanged\)\) \{[\s\S]*?tab\.browserUrl !== activeBrowserTab\.url[\s\S]*?browserAddressEditingRef\.current/u, "已有网页标签随真实页面导航同步，新建空白标签不会被快照自动填入");
  assert.match(browserPanel, /if \(current && next\.revision < current\.revision\) return current;[\s\S]*?if \(current\?\.screenshot && !next\.screenshot\) return \{ \.\.\.next, screenshot: current\.screenshot \};/u, "页面切换或刷新期间没有新画面时保留最近一帧");
  assert.match(browserPanel, /if \(current && resized\.revision < current\.revision\) return current;[\s\S]*?if \(current\?\.screenshot && !resized\.screenshot\) return \{ \.\.\.resized, screenshot: current\.screenshot \};/u, "视口同步期间没有新画面时保留最近一帧");
});

test("浏览器加号只创建空白标签，不能继承当前搜索结果", () => {
  const createTab = workspace.match(/const createWorkspaceUtilityTab = useCallback\(\(\) => \{([\s\S]*?)\n  \}, \[showWorkspaceUtilityTab\]\)/u)?.[1];
  assert.ok(createTab, "浏览器加号应由工作区标签 Owner 处理");
  assert.match(createTab, /kind: "new"/u);
  assert.doesNotMatch(createTab, /browserUrl|browserNavigationRequest|openBrowserWebsite/u, "加号不能提交地址或创建搜索请求");

  const syncTabs = workspace.match(/const handleBrowserOpenTabsChange = useCallback\(\(tabs: BrowserOpenTab\[\]\) => \{([\s\S]*?)\n  \}, \[activeAiSessionId[\s\S]*?\]\)/u)?.[1];
  assert.ok(syncTabs, "浏览器标签同步逻辑应可定位");
  assert.match(syncTabs, /const previousActiveBrowserTab = browserOpenTabs\.find\(tab => tab\.active\)/u);
  assert.match(syncTabs, /const activeBrowserPageChanged = Boolean\(previousActiveBrowserTab[\s\S]*?previousActiveBrowserTab\.url !== activeBrowserTab\.url/u);
  assert.match(syncTabs, /activeUtilityTab\.browserUrl !== undefined \|\| activeBrowserPageChanged/u, "仅同步当前已打开页面或观察到真实页面切换后的 URL");
});

test("中心列拖动越过下限阈值后吸附收起，标签仍可显式切换", () => {
  assert.match(workbench, /centerCollapsed = false/u);
  assert.match(workbench, /const responsiveRightCenterFloor = centerCollapsed \? 0 : minCenterWidth/u);
  assert.match(workbench, /centerCollapsed \? maxRightGridWidth : Math\.min\(rightWidth, maxRightGridWidth\)/u);
  assert.match(workbench, /centerCollapseEnabled = false/u);
  assert.match(workbench, /resolveRightCenterDragFrame/u);
  assert.match(workbench, /centerCaptureThreshold: resolveSnapCaptureThreshold\(minCenterWidth, snapCaptureRatio\)/u);
  assert.match(workbench, /allowCenterCollapse \? available : Math\.min\(staticMax, available\)/u, "中心列吸附时按容器总预算计算阈值，不能用右 Dock 静态最大宽度提前收起");
  assert.match(workbench, /if \(drag\.side === "right" && drag\.centerCollapseEnabled && drag\.centerSnapped\)[\s\S]*?onCenterCollapsedChange\?\.\(true\)/u);
  assert.match(workbench, /aria-valuemax=\{getDynamicMax\("right"\)\}/u);
  assert.match(workbench, /element\.inert = centerCollapsed/u);
  assert.match(workspace, /centerCollapsed=\{showWorkbenchTabs && centerCollapsed\}/u);
  assert.match(workspace, /centerCollapseEnabled=\{showWorkbenchTabs\}/u);
  assert.match(workspace, /onCenterCollapsedChange=\{handleCenterCollapsedChange\}/u);
  assert.match(workbenchCss, /--lfaa-center-column: minmax\(0, 1fr\); \/\* 中间聊天列宽/u);
  assert.match(workbenchCss, /data-center-collapsed="true"\] \.lfaa-workbench__center \{ visibility: hidden; pointer-events: none; \}/u);
  assert.match(workbenchCss, /data-snap-preview="center"\] \.lfaa-workbench__center \{ visibility: hidden; pointer-events: none; transition: none; \}/u);
  assert.match(workspaceCss, /\.module-workbench-tabstrip \{[^}]*flex: 1 1 auto/u, "收起后的右侧顶栏为页签提供弹性空间");
  assert.match(workspace, /<\/nav>\s*<button className="module-workbench-tab-add"/u, "新建按钮紧跟标签导航末尾且不进入 tablist");
  assert.doesNotMatch(workspace, /module-workbench-tabs__spacer/u, "标签和新建按钮之间不保留弹性空白");
  assert.match(workspaceCss, /\.module-workbench-tabs--context \{[^}]*width: max-content;[^}]*max-width: calc\(100% - 34px\);[^}]*flex: 0 1 auto;[^}]*overflow-x: auto/u, "导航按标签宽度收缩并为加号保留空间，溢出时仍可横向滚动");
  assert.match(workspaceCss, /\.module-workbench-tabs--context \.module-workbench-tab \{ min-height: 100%; max-width: 280px; \}/u, "右侧页签不以自身宽度百分比限制标签而制造空白");
  assert.match(workspaceCss, /\.module-workbench-tabs--context \.module-workbench-tab-item \{ max-width: 280px; \}/u, "常规右侧标签宽度由内容决定并限制到固定上限");
  assert.match(workspaceCss, /@container module-context \(max-width: 340px\)[\s\S]*?\.module-workbench-tabs--context \{ max-width: calc\(100% - 25px\);/u, "窄右栏按紧凑加号尺寸预留空间");
  assert.match(workspaceCss, /@container module-context \(max-width: 340px\)[\s\S]*?\.module-workbench-tabs--context \.module-workbench-tab-item \{ max-width: 38px; \}/u, "窄右栏标签切换为紧凑宽度");
  assert.match(workspaceCss, /\.module-context__launcher-grid,\s*\.module-context__launcher-extra-grid \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/u);
  assert.match(workspaceCss, /@container module-context \(max-width: 340px\)[\s\S]*?\.module-context__launcher-grid \{ grid-template-columns: minmax\(0, 1fr\)/u, "窄栏入口切换为单列");
  assert.match(workspaceCss, /\.module-workbench-layout\s*\{[^}]*container-name:\s*module-workbench-main/u);
  assert.match(workspaceCss, /@container module-context \(max-width: 340px\)[\s\S]*?\.module-workbench-tab-item \.module-workbench-tab \{ justify-content: center; padding-inline: 6px; \}/u, "窄右栏收起页签将文字收为图标并保留辅助名称");
});

test("分隔条第一次越过启动阈值的移动也必须更新尺寸", () => {
  const moveHandler = workbench.match(/const onSidePointerMove = useCallback\(\(event: PointerEvent<HTMLDivElement>\) => \{([\s\S]*?)\n  \}, \[getDynamicMax/u)?.[1];

  assert.ok(moveHandler, "侧栏分隔条必须有 Pointer Move 处理器");
  assert.match(moveHandler, /drag\.activated = true/u);
  assert.match(moveHandler, /const raw = resolveSideDragRawSize\(drag\.side, drag\.startSize, drag\.pointerStartX, event\.clientX\)/u);
  assert.match(moveHandler, /schedule\(raw\)/u);
  assert.doesNotMatch(moveHandler, /drag\.activated = true[\s\S]*?return;/u, "首次越过启动阈值的 Pointer Move 不能被丢弃");
});
