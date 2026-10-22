/**
 * 功能：回归 AI Work 顶部应用标签与公共布局中心列的切换合同。
 * 作用：检查会话/工作台标签复用当前 Browser Owner，并确保零宽中心仅由受控调用方启用。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const workspace = read("../../../packages/client/ui-workspace/src/ApplicationWorkspace.tsx");
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
  assert.match(workspace, /openWorkspaceUtility = useCallback\(\(kind: Exclude<WorkspaceUtilityTab\["kind"\], "new">/u);
  assert.match(workspace, /onClick=\{\(\) => openWorkspaceUtility\("browser"\)\}/u);
  assert.match(workspace, /onClick=\{\(\) => openWorkspaceUtility\("git"\)\}/u);
  assert.match(workspace, /onClick=\{\(\) => openWorkspaceUtility\("applications"\)\}/u);
  assert.match(workspace, /sidebarRight\.tabs\.map\(tab => <button[\s\S]*?openWorkspaceUtility\("extension", tab\.id\)/u, "扩展入口由真实登记的右侧面板动态生成");
  assert.match(workspace, /registeredExtensions\.filter\(item => !item\.applicationIds \|\| item\.applicationIds\.includes\(app\)\)\.map/u, "能力资源从当前应用的真实登记目录展示");
  const legacyRightNav = workspace.match(/mode !== "ai-work" \? <nav className="module-context__tabs"[\s\S]*?<\/nav> : null/u)?.[0];
  assert.ok(legacyRightNav, "普通应用仍保留自己的右侧上下文导航");
  assert.doesNotMatch(legacyRightNav, />浏览器|>变更/u, "AI Work 不再将工具功能固定在右侧互斥导航行");
  assert.match(workspace, /const activeCenterCollapsed = centerCollapsePreview \?\? centerCollapsed/u, "拖动预览优先于已提交的中心列状态");
  assert.match(workspace, /const workbenchTabs = showWorkbenchTabs && activeCenterCollapsed \? <div className="module-workbench-tabstrip"/u, "达到中心收起阈值时立即显示动态工作区标签");
  assert.match(workspace, /<strong>\{mode === "ai-work" \? activeAiSessionTitle\?\.trim\(\) \|\| "小鱼智能体" : selectedApp\.title\}<\/strong>/u, "中心区展开时显示当前会话名");
  assert.doesNotMatch(workspace, /module-workbench-collapse-header|module-workbench-main--tabs/u, "页签应进入右侧 Dock 自己的标题行，不新增整行全局标题栏");
  const center = workspace.match(/const center = \([\s\S]*?\n  const gitManagerPanel/u)?.[0];
  assert.ok(center, "中心区 JSX 应可定位");
  assert.doesNotMatch(center, /workbenchTabs/u, "中心区标题只放当前会话名，不挂切换页签");
  const right = workspace.match(/const right = \([\s\S]*?\n  const bottom/u)?.[0];
  assert.ok(right, "右侧菜单 JSX 应可定位");
  assert.match(right, /module-context__shell-actions[\s\S]*?\{workbenchTabs\}[\s\S]*?module-context__body/u, "右侧菜单打开时在其标题行显示拖动预览或已收起标签");
  assert.match(right, /id=\{showWorkbenchTabs && activeCenterCollapsed \? "module-workbench-tab-panel" : undefined\}[\s\S]*?role=\{showWorkbenchTabs && activeCenterCollapsed \? "tabpanel"/u, "页签与右侧菜单内容面板保持同级关系");
  assert.match(right, /选择工具，在当前标签页打开/u);
  assert.match(workspace, /onCenterCollapsePreviewChange=\{setCenterCollapsePreview\}/u);
  assert.match(workspace, /setAiWorkView\(tab\.kind === "browser" \? "browser" : tab\.kind === "git" \? "git" : "chat"\)/u);
  assert.match(workspace, /if \(tab === "chat"\) \{\s*setCenterCollapsed\(false\)/u);
  assert.match(workspace, /<BrowserPanel sessionId=\{activeAiSessionId\} settings=\{settings\} \/>/u);
  assert.match(workspace, /<ResizableWorkbench[\s\S]*?centerCollapsed=\{showWorkbenchTabs && centerCollapsed\}/u);
  assert.match(workbenchTypes, /onCenterCollapsePreviewChange\?: \(preview: boolean \| null\) => void/u);
  assert.match(workbench, /if \(previousCenterSnapped !== sideDrag\.centerSnapped\) onCenterCollapsePreviewChange\?\.\(sideDrag\.centerSnapped\)/u, "公共布局仅在进入或退出吸附预览时通知页面");
  assert.match(workbench, /if \(drag\.centerCollapseEnabled\) onCenterCollapsePreviewChange\?\.\(null\)/u, "松开后清除临时预览状态");
  assert.match(workbench, /if \(sideDrag\?\.centerCollapseEnabled\) onCenterCollapsePreviewChange\?\.\(null\)/u, "取消拖动后清除临时预览状态");
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
  assert.match(workspaceCss, /\.module-workbench-tabs--context \{[^}]*width: 100%;[^}]*flex: 1 1 auto;[^}]*overflow-x: auto/u, "页签导航占满顶部可用宽度，窄栏仍可横向滚动");
  assert.match(workspaceCss, /\.module-context__launcher-grid \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/u);
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
