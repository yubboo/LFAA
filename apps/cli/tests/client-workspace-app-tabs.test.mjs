/**
 * 功能：回归 AI Work 顶部应用标签与公共布局中心列的切换合同。
 * 作用：检查会话/工作台标签复用当前 Browser Owner，并确保零宽中心仅由受控调用方启用。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { preferCurrentBrowserSnapshot, shouldRestoreBrowserDockPage } from "../../../packages/client/ui-sidebar-browser/src/browser-snapshot.ts";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const workspace = read("../../../packages/client/ui-workspace/src/ApplicationWorkspace.tsx");
const aiWorkChat = read("../../../packages/client/ui-chat/src/AiWorkChat.tsx");
const workbenchSource = read("../../../packages/client/ui-layout/src/Workbench.tsx");
const browserPanel = read("../../../packages/client/ui-sidebar-browser/src/BrowserPanel.tsx");
const browserPanelCss = read("../../../packages/client/ui-sidebar-browser/src/browser-panel.css");
const browserConnection = read("../../../packages/client/connection/src/api.ts");
const browserOwner = read("../../../packages/browser-use/browser-use/src/session-manager.ts");
const browserController = read("../../../packages/api/browser-controller/src/index.ts");
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
  assert.match(workspace, /useLayoutEffect\(\(\) => \{\s*if \(appliedLayoutMode\.current === metrics\.mode\) return;[\s\S]*?\}, \[metrics\.mode, mode\]\);/u, "实际容器断点变化时在绘制前对齐 Dock 状态");
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
  assert.match(workspace, /activeWorkspaceUtilityTabKind === "new" \? <Suspense[\s\S]*?<BrowserPanel sessionId=\{BUILTIN_BROWSER_WORKSPACE_ID\} settings=\{settings\} [^>]*hidden=\{!activeWorkspaceUtilityTab\?\.browserUrl\} navigationRequest=\{activeWorkspaceUtilityTab\?\.browserNavigationRequest[^>]*onOpenTabsChange=\{handleBrowserOpenTabsChange\}/u, "内置浏览器独立于 AI 会话，并始终绑定同一个账户工作区");
  assert.match(workspace, /preferredProviderId=\{preferredBrowserProvider\?\.providerId\} providerSelectionRequestId=\{preferredBrowserProvider\?\.requestId\}/u, "Browser Dock 使用 Agent 实际选择的内置 Provider");
  assert.match(aiWorkChat, /activity\.status === "complete" && activity\.toolId\?\.startsWith\("browser-use\."\) && isBuiltinBrowserProvider\(activity\.browserProviderId\)[\s\S]*?onBrowserToolCompleted\?\.\(activity\.browserProviderId\)/u, "仅成功的内置 Browser Tool 活动通知右侧 Dock");
  assert.match(aiWorkChat, /return providerId === "lfaa-native-browser" \|\| providerId === "lfaa-managed-edge" \|\| providerId === "lfaa-managed-chrome"/u, "个人 Tabbit 浏览器不会切换 LFAA 内置 Dock");
  const openBrowserDockForAgent = workspace.match(/const openBrowserDockForAgent = useCallback\(\(providerId: BrowserProviderId\) => \{([\s\S]*?)\n  \}, \[activeWorkspaceUtilityTabId/u)?.[1];
  assert.ok(openBrowserDockForAgent, "Agent Browser Dock 联动逻辑应可定位");
  assert.match(openBrowserDockForAgent, /setPreferredBrowserProvider\(\{ providerId, requestId \}\)[\s\S]*?!tab\.browserNavigationRequest && !tab\.browserActionRequest[\s\S]*?showWorkspaceUtilityTab\(nextTab\)/u, "切换到无待处理操作的新标签并展开右侧 Dock，不重新导航");
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

test("Web Browser Dock 在 LFAA 内显示 Browser Owner 的连续实时页面流", () => {
  assert.match(browserPanel, /streamBrowserDockFrames\(/u, "右侧 Dock 自动订阅 Browser Owner 推送的页面帧流");
  assert.match(browserPanel, /className="lfaa-browser-panel__live-canvas"/u, "Canvas 仅绘制 Browser Owner 主动推送的实时页面帧");
  assert.match(browserPanel, /void startLiveView\(\)/u, "页面进入当前 Browser Owner Session 后自动连接实时帧流");
  assert.match(browserPanel, /waitForBrowserDockRevision\(sessionId, providerId, current\?\.revision \?\? 0/u, "空白工作区也等待 Agent 页面创建；有页面后继续使用修订等待");
  assert.match(browserPanel, /Agent 使用同一页面/u, "页面状态明确说明人与 Agent 共用同一真实页面");
  assert.match(browserPanel, /snapshot\.loading \? "网页仍在加载"/u, "导航提交后仍能报告真实页面加载状态");
  assert.match(browserPanelCss, /@media \(max-width: 560px\)/u, "状态页卡片适配窄分栏与手机视口");
  assert.doesNotMatch(browserPanel, /getDisplayMedia|capture-handle|<video|snapshot\.screenshot|data:image\/jpeg|prewarmBrowserDock/u, "不启动外部浏览器标签选择器或截图播放器");
  assert.doesNotMatch(browserPanel, /连接实时画面|连接对应的 Chromium 浏览器标签/u, "网址提交后直接在 LFAA 内显示页面");
  assert.match(browserPanel, /new ResizeObserver\(readContainerSize\)/u, "Dock 视口随真实内容区尺寸调整");
  assert.match(browserPanel, /resizeBrowserDockViewport\(sessionId, providerId, nextSize\.width, nextSize\.height, controller\.signal\)/u, "容器尺寸经认证 API 同步给 Browser Owner");
  assert.match(browserPanelCss, /object-fit: fill/u, "实时网页帧铺满 Dock 内容区，不留上下宽边");
  assert.match(browserPanel, /relativeX \/ rect\.width \* viewport\.width/u, "画面拉伸时点击坐标按完整 Dock 映射");
  assert.doesNotMatch(browserPanelCss, /object-fit: contain/u, "网页视区不保留固定比例黑边");
  assert.match(browserPanel, /action: "clickAt"/u, "点击实时页面调用当前 Browser Owner Page");
  assert.match(browserPanel, /action: "scroll"/u, "实时页面滚动调用当前 Browser Owner Page");
  assert.match(browserPanel, /action: "typeText"/u, "实时页面输入调用当前 Browser Owner Page");
  assert.match(browserPanel, /AbortController\(\)/u, "隐藏 Dock 或切换 Session 会取消流连接");
  assert.match(browserPanel, /createImageBitmap/u, "收到的实时帧异步解码，避免占用主线程解码图片");
  assert.match(browserConnection, /eventName === "frame"/u, "连接层接收 Browser Owner 通过 SSE 推送的帧事件");
  assert.match(browserOwner, /Page\.startScreencast/u, "Browser Owner 从真实 Chromium Page 订阅合成器帧事件");
  assert.match(browserOwner, /Page\.screencastFrameAck/u, "每帧发送后向 Chromium 确认，保持有界流控");
  assert.match(browserOwner, /headless \? false|headless: this\.headless/u, "Web Browser Owner 按无窗口隔离模式启动 Chromium");
  assert.match(workspace, /keepSavedAddressDuringOwnerRecovery = activeBrowserTab\?\.url === "about:blank"[\s\S]*?if \(activeUtilityTab\?\.kind === "new" && activeBrowserTab && !keepSavedAddressDuringOwnerRecovery && \(activeUtilityTab\.browserUrl !== undefined \|\| activeBrowserPageChanged \|\| browserOpenTabs\.length === 0\)\) \{[\s\S]*?tab\.browserUrl !== activeBrowserTab\.url[\s\S]*?browserAddressEditingRef\.current/u, "Agent 首次打开网页时空白新标签显示真实页面，后续导航也同步地址，并在恢复中保留原地址");
  assert.equal((browserPanel.match(/setSnapshot\(current => preferCurrentBrowserSnapshot\(current,/gu) ?? []).length, 3, "快照读取、视口更新和浏览器操作都使用 Session 感知的快照接纳规则");
});

test("Browser Dock 快照只在同一 Browser Owner Session 内按 revision 排序", () => {
  const previous = { sessionId: "old-session", revision: 42 };
  const lateOldRevision = { sessionId: "old-session", revision: 41 };
  const newSession = { sessionId: "new-session", revision: 0 };
  assert.equal(preferCurrentBrowserSnapshot(previous, lateOldRevision), previous, "同一 Session 的迟到旧响应不能回退页面状态");
  assert.equal(preferCurrentBrowserSnapshot(previous, newSession), newSession, "重建后的新 Session 可用较低 revision 替换旧快照");
});

test("Browser Dock 只在 Owner 确认页面丢失后恢复当前标签 URL", () => {
  assert.equal(shouldRestoreBrowserDockPage("https://www.bing.com/", true, undefined, false), true, "成功读取到空 Owner Session 后恢复当前标签地址");
  assert.equal(shouldRestoreBrowserDockPage("https://www.bing.com/", true, "about:blank", false), true, "Owner 重启期间新建的空白占位页也恢复原地址");
  assert.equal(shouldRestoreBrowserDockPage("https://www.bing.com/", false, undefined, false), false, "初始快照仍在读取时不抢先导航");
  assert.equal(shouldRestoreBrowserDockPage("https://www.bing.com/", true, "https://example.com/", false), false, "Owner 仍有真实页面时不重复导航");
  assert.equal(shouldRestoreBrowserDockPage("https://www.bing.com/", true, undefined, true), false, "已有用户导航请求时不发起重复恢复");
  assert.equal(shouldRestoreBrowserDockPage("about:blank", true, undefined, false), false, "空白标签没有可恢复的 HTTP(S) 地址时不创建页面");
  assert.match(browserPanel, /if \(!response\.session\) \{[\s\S]*?refreshSnapshot\(providerId, sessionId, request\.signal\)[\s\S]*?if \(!refreshed\) return/u, "Owner 页面丢失时刷新快照并结束旧修订等待");
  assert.match(browserPanel, /shouldRestoreBrowserDockPage\(browserUrl, snapshotReady, snapshot\?\.url, Boolean\(navigationRequest\)\)[\s\S]*?navigateBrowserDock\(sourceSession, selectedProvider, target\)/u, "只有已核实空 Session 或空白占位页且无待处理导航时才从标签 URL 重建页面");
  assert.match(workspace, /keepSavedAddressDuringOwnerRecovery = activeBrowserTab\?\.url === "about:blank"[\s\S]*?!keepSavedAddressDuringOwnerRecovery/u, "Owner 的空白占位页不能覆盖标签中保存的真实地址");
  assert.match(workspace, /<BrowserPanel sessionId=\{BUILTIN_BROWSER_WORKSPACE_ID\} settings=\{settings\} browserUrl=\{activeWorkspaceUtilityTab\?\.browserUrl\}/u, "当前工作区标签 URL 传给 Browser Dock 作为恢复地址");
});

test("实时 Browser Dock 流只保留有界 SSE 缓冲并在取消时撤销读取", () => {
  assert.match(browserConnection, /buffer\.length > 5_500_000/u, "客户端限制尚未处理的 SSE 缓冲大小");
  assert.match(browserConnection, /reader\.cancel\(\)/u, "流结束或取消后释放 Fetch reader");
  assert.match(browserController, /requireAuthentication/u, "实时帧路由使用现有认证 Owner");
  assert.match(browserController, /response\.once\("close", cancel\)/u, "Dock 断开后取消 Browser Owner 页面帧订阅");
  assert.doesNotMatch(browserController, /capture-handle|readSameOrigin/u, "实时流不再绑定浏览器原生标签选择器身份");
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
