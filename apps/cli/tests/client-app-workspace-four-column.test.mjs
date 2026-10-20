import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const workbench = read("../../../packages/client/ui-layout/src/Workbench.tsx");
const workspace = read("../../../packages/client/ui-workspace/src/ApplicationWorkspace.tsx");
const workspaceCss = read("../../../packages/client/ui-workspace/src/module-workbench.css");
const aiWorkChatCss = read("../../../packages/client/ui-chat/src/ai-work-chat.css");
const rail = read("../../../packages/client/ui-sidebar/src/GlobalNavigationRail.tsx");
const secondaryNavigation = read("../../../packages/client/ui-sidebar/src/SecondaryNavigation.tsx");
const settingsPage = read("../../../packages/client/ui-settings/src/SettingsPage.tsx");
const pluginManagerPage = read("../../../packages/client/ui-plugin-manager/src/PluginManagerPage.tsx");
const fileManagerPage = read("../../../packages/client/ui-sidebar-files/src/FileManagerPage.tsx");

test("应用工作区复用 Workbench 已有应用菜单数据与打开链路", () => {
  assert.match(workbench, /const allApplicationNavigationItems: ApplicationNavigationItem\[\] = \[/u);
  assert.match(workbench, /applicationNavigationItems=\{applicationNavigationItems\}/u);
  assert.match(workspace, /applicationNavigationItems\.map\(\(item\) =>/u);
  assert.match(workspace, /if \(item\.route\) onNavigate\(item\.route\)/u);
  assert.match(workspace, /onOpenApplication\(item\.applicationId, "normal"\)/u);
  assert.match(workspace, /const responsiveAppDock = true;[\s\S]*?useWorkbenchMetrics\(layoutRef, \(\) => initialMetrics\(responsiveAppDock\), responsiveAppDock\)/u);
  assert.doesNotMatch(workspace, /const applicationNavigationItems =/u);
});

test("AI Work 将 Git 摘要与变更管理联动到右侧菜单且聊天保持显示", () => {
  const gitSummary = read("../../../packages/client/ui-workspace/src/GitChangeSummary.tsx");
  assert.match(workspace, /module-center__work-tabs[\s\S]*?变更/u);
  assert.match(workspace, /Git 摘要[\s\S]*?agentGitRepositories\.slice\(0, 12\)/u);
  assert.match(workspace, /new AbortController\(\);[\s\S]*?loadAgentGitStatus\(repository\.id, controller\.signal\)[\s\S]*?controller\.abort\(\)/u);
  assert.match(workspace, /首次获准在项目文件夹写入时，会自动初始化 Git/u);
  assert.match(workspace, /const gitManagerPanel = gitManagerAvailable && aiWorkView === "git"/u);
  assert.match(workspace, /<div className="module-ai-work-chat">/u);
  const center = workspace.slice(workspace.indexOf("const center = ("), workspace.indexOf("const gitManagerPanel ="));
  assert.doesNotMatch(center, /module-git-manager/u);
  assert.match(workspace, /aria-label=\{mode === "ai-work" [?] "小鱼智能体对话"/u);
  assert.match(workspace, /rightPanelSection === "context" && aiWorkView === "git"/u);
  assert.match(workspace, /openGitManager\(repository\.id\)/u);
  assert.match(workspace, /module-git-summary__repository[\s\S]*?module-git-summary__branch/u);
  assert.match(workspace, /onClick=\{\(\) => openGitManager\(\)\}>变更/u);
  assert.doesNotMatch(workspace, /data-git-open/u);
  assert.doesNotMatch(workspace, /添加本机 Git 仓库|添加仓库/u);
  assert.match(workspace, /<GitChangeSummary[\s\S]*?status=\{visibleGitStatus\.status\}[\s\S]*?onRefresh=\{refreshSelectedGitStatus\}/u);
  assert.doesNotMatch(workspace, /module-context__git-loading[\s\S]{0,200}<GitChangeSummary/u);
  assert.doesNotMatch(workspace, /gitWorkspaceSupported|git-workspace-v1/u);
  assert.match(gitSummary, /status: WorkspaceGitStatus \| null;/u);
  assert.match(gitSummary, /由 LFAA 本机 Git 管理器读取/u);
  assert.match(gitSummary, /status\?\.syncCapableRemotes\?\.includes\(selectedRemote\)/u);
  assert.match(gitSummary, /status\?\.syncCapableRemotes\?\.includes\(upstreamRemote\)/u);
  assert.match(gitSummary, /repositoryId && !status\.worktreeId/u);
  assert.match(gitSummary, /此 remote 类型暂未接入账户隔离的同步凭据/u);
  assert.doesNotMatch(gitSummary.slice(0, gitSummary.indexOf("interface GitChangeActivityReviewProps")), /loadWorkspaceGitStatus\(/u);
  assert.match(workspaceCss, /\.module-git-manager__body\s*\{[^}]*overflow:\s*auto/u);
  assert.match(workspaceCss, /\.module-center__work-tabs/u);
  assert.match(workspaceCss, /\.module-context \.module-git-manager__header\s*\{/u);
});

test("应用图标打开右侧应用菜单，左侧 Dock 留给会话与项目", () => {
  assert.match(workspace, /applicationsExpanded=\{rightPanelSection === "applications" && !chrome\.rightCollapsed\} applicationsTargetId="module-context-applications" onToggleApplications=\{toggleApplicationsPanel\}/u);
  assert.match(workspace, /className="module-context__applications" id="module-context-applications"/u);
  assert.match(workspace, /rightPanelSection !== "applications" \|\| sidebarRight\.activeId !== null/u);
  assert.match(workspace, /className="module-sidebar__sessions"/u);
  assert.doesNotMatch(workspace, /module-sidebar__application-navigation|module-sidebar__app-menu/u);
  assert.match(workbench, /rightPanelSection=\{workspaceRightPanelSection\}[\s\S]*?onRightPanelSectionChange=\{setWorkspaceRightPanelSection\}/u);
  assert.match(rail, /if \(onToggleApplications\) \{[\s\S]*?onToggleApplications\(\)/u);
  assert.match(workspace, /<ResizableWorkbench[\s\S]*?left=\{left\}[\s\S]*?center=\{center\}[\s\S]*?right=\{right\}/u);
  assert.match(workspace, /return \{ leftCollapsed: false, rightCollapsed: false, terminalOpen: false \}/u);
  assert.doesNotMatch(workspace, /rightSwapped|togglePaneOrder|onSwapPanes/u);
});

test("AI Work 中心画布按中心列宽度为左右 Dock 留白", () => {
  assert.match(workspaceCss, /\.module-center__content--ai-work\s+\.module-ai-work-chat\s*>\s*\.ai-work-chat\s*\{[^}]*width:\s*100%[^}]*padding-inline:\s*clamp\(12px,\s*2cqi,\s*24px\)[^}]*background-clip:\s*content-box/u);
  assert.match(workspaceCss, /\.module-center__content--ai-work\s+\.module-ai-work-chat\s*>\s*\.ai-work-chat\s*>\s*\.ai-work-chat__conversation\s*\{[^}]*width:\s*calc\(100%\s*\+\s*2\s*\*\s*clamp\(12px,\s*2cqi,\s*24px\)\)[^}]*margin-inline:\s*calc\(-1\s*\*\s*clamp\(12px,\s*2cqi,\s*24px\)\)/u);
  assert.match(workspaceCss, /\.module-center__content--ai-work\s+\.ai-work-chat__messages\s*\{[^}]*width:\s*calc\(100%\s*-\s*2\s*\*\s*clamp\(12px,\s*2cqi,\s*24px\)\)[^}]*margin-inline:\s*auto/u);
  assert.match(workspaceCss, /\.workbench-shell\[data-background-image="true"\]\s+\.ai-work-chat\s*\{[^}]*background-clip:\s*content-box/u);
  assert.match(aiWorkChatCss, /\.ai-work-chat__anchors\s*\{[^}]*left:\s*0/u);
  assert.match(aiWorkChatCss, /\.ai-work-chat__message-stage\s*\{[^}]*position:\s*relative[^}]*width:\s*100%/u);
});

test("设置中心应用图标进入四栏工作区，不使用旧弹出列表", () => {
  assert.match(settingsPage, /onToggleApplications=\{onOpenApplications \?\? \(\(\) => onNavigate\("\/work"\)\)\}/u);
  assert.match(workbench, /const requestApplicationsOpen = useCallback\(\(\) => \{[\s\S]*?setWorkspaceRightPanelSection\("applications"\)[\s\S]*?setApplicationsOpenRequestId\(requestId\)[\s\S]*?onNavigate\(SHARED_WORK_ROUTE\)/u);
  assert.match(workbench, /onOpenApplications=\{requestApplicationsOpen\}/u);
});

test("插件管理应用图标进入四栏工作区，不使用旧弹出列表", () => {
  assert.match(pluginManagerPage, /onToggleApplications=\{onOpenApplications \?\? \(\(\) => onNavigate\("\/work"\)\)\}/u);
  assert.match(pluginManagerPage, /onOpenApplications=\{onOpenApplications\}/u);
});

test("文件管理应用图标进入四栏工作区，不使用旧弹出列表", () => {
  assert.match(fileManagerPage, /onToggleApplications=\{onOpenApplications \?\? \(\(\) => onNavigate\("\/work"\)\)\}/u);
});

test("设置、插件与文件页将最近会话请求交给 Workbench", () => {
  for (const page of [settingsPage, pluginManagerPage, fileManagerPage]) {
    assert.match(page, /onOpenRecentSessions=\{onOpenRecentSessions\}/u);
    assert.match(page, /onOpenWork=\{\(\) => onNavigate\("\/work"\)\}/u);
  }
  assert.match(workbench, /const requestRecentSessionsOpen = useCallback\(\(\) => \{[\s\S]*?setRecentSessionsOpenRequestId\(requestId\)[\s\S]*?onNavigate\(SHARED_WORK_ROUTE\)/u);
  assert.match(workbench, /recentSessionsOpenRequestId=\{recentSessionsOpenRequestId\}/u);
  assert.match(workspace, /if \(mode !== "ai-work" \|\| recentSessionsOpenRequestId === null\) return;[\s\S]*?showRecentSessions\(\);[\s\S]*?onRecentSessionsOpenRequestHandled\(recentSessionsOpenRequestId\)/u);
});

test("右侧应用视图沿用共享清单和 SecondaryNavigation，保留应用子菜单", () => {
  assert.match(workspace, /function ApplicationNavigationPanel[\s\S]*?applicationNavigationItems\.map\(\(item\) =>/u);
  assert.match(workspace, /<SecondaryNavigation ariaLabel="应用导航"[\s\S]*?groups=\{applicationNavigationGroups\}/u);
  assert.match(workspace, /aria-label="Minecraft 工作区菜单"/u);
  assert.match(workspace, /aria-label="LFAA 联机服务菜单"/u);
  assert.match(workspace, /onClick=\{\(\) => showRightPanelSection\("applications"\)\}>应用/u);
  assert.match(workspace, /onClick=\{\(\) => \{ setAiWorkView\("chat"\); showRightPanelSection\("context"\); \}\}>\{contextLabel\}/u);
  assert.match(workspace, /className="module-sidebar__sessions"/u);
  assert.match(workspaceCss, /\.module-context__applications\s*\{/u);
  assert.match(workspaceCss, /\.module-context__application-navigation\s*\{/u);
});

test("左一最近会话入口直接展开唯一的左二会话 Dock，不复制悬浮列表", () => {
  assert.match(rail, /onOpenRecentSessions: \(\) => void/u);
  assert.match(rail, /onOpenRecentSessions\(\);/u);
  assert.doesNotMatch(rail, /else onOpenWork\?\.\(\)/u);
  assert.doesNotMatch(rail, /openPopover === "recent"|popover--recent|loadAiSessions|AiSession/u);
  assert.match(workspace, /const showRecentSessions = useCallback\(\(\) => \{[\s\S]*?leftCollapsed: false[\s\S]*?metrics\.mode !== "desktop" \? \{ rightCollapsed: true \} : \{\}[\s\S]*?if \(mode === "ai-work"\) refreshAiSessions\(\);[\s\S]*?openApplication\("workspace", "ai-work"\)/u);
  assert.match(workspace, /onOpenRecentSessions=\{showRecentSessions\}/u);
  assert.match(workspace, /sessions=\{aiSessions\}/u);
  assert.match(workspace, /const aiSessions = aiSessionsState\.userId === userId \? aiSessionsState\.sessions : aiSessionSnapshots\.get\(userId\) \?\? \[\]/u);
  assert.match(workspace, /onSelectSession: \(sessionId\) => \{ onActiveAiSessionChange\(sessionId\)/u);
  assert.match(workspace, /onSessionsChange=\{\(sessions\) => \{\s*updateAiSessions\(\(\) => sessions\)/u);
  assert.match(workspace, /if \(pendingRequest\?\.userId === userId && !pendingRequest\.controller\.signal\.aborted\) return/u);
  assert.match(workspace, /pendingRequest\.controller\.abort\(\)/u);
  assert.match(workbench, /window\.addEventListener\(aiWorkSessionOpenEventName, handleSessionNotificationClick\)/u);
  assert.match(workbench, /openAiWorkNotification\(detail\)/u);
});

test("共享二级导航支持可选说明和尾部图标，其他页面仍可只显示名称", () => {
  assert.match(secondaryNavigation, /description\?: string/u);
  assert.match(secondaryNavigation, /trailingIcon\?: WorkbenchIconName/u);
  assert.match(secondaryNavigation, /item\.description \? <small>/u);
  assert.match(secondaryNavigation, /item\.trailingIcon \? <WorkbenchIcon/u);
});
