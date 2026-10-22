import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const workspaceCss = [
  "../../../packages/client/ui-workspace/src/module-workbench.css",
  "../../../packages/client/ui-workspace/src/css/secondary-navigation.css",
  "../../../packages/client/ui-workspace/src/css/center-workspace.css",
  "../../../packages/client/ui-workspace/src/css/right-menu.css",
  "../../../packages/client/ui-workspace/src/css/workbench-regions.css",
].map(read).join("\n");
const workbench = read("../../../packages/client/ui-layout/src/Workbench.tsx");
const workspace = read("../../../packages/client/ui-workspace/src/ApplicationWorkspace.tsx");
const secondaryNavigationCss = read("../../../packages/client/ui-workspace/src/css/secondary-navigation.css");
const rightMenuCss = read("../../../packages/client/ui-workspace/src/css/right-menu.css");
const workspaceRegionsCss = read("../../../packages/client/ui-workspace/src/css/workbench-regions.css");
const dockkitCss = ["common-layout.css", "common-responsive.css"].map(file => read(`../../../packages/client/ui-dockkit/src/css/${file}`)).join("\n");
const commonCss = ["common-layout.css", "common-pane.css", "common-pointer.css", "common-bottom.css", "common-responsive.css"].map(file => read(`../../../packages/client/ui-dockkit/src/css/${file}`)).join("\n");
const dockkit = read("../../../packages/client/ui-dockkit/src/ResizableWorkbench.tsx");
const aiWorkChatCss = read("../../../packages/client/ui-chat/src/ai-work-chat.css");
const rail = read("../../../packages/client/ui-sidebar/src/GlobalNavigationRail.tsx");
const secondaryNavigation = read("../../../packages/client/ui-sidebar/src/SecondaryNavigation.tsx");
const settingsPage = read("../../../packages/client/ui-settings/src/SettingsPage.tsx");
const pluginManagerPage = read("../../../packages/client/ui-plugin-manager/src/PluginManagerPage.tsx");
const fileManagerPage = read("../../../packages/client/ui-sidebar-files/src/FileManagerPage.tsx");
const fileManagerCss = read("../../../packages/client/ui-sidebar-files/src/FileManagerPage.css");
const renderer = read("../../../packages/client/ui-renderer/src/render.tsx");
const moduleShellCss = read("../../../packages/client/ui-layout/src/css/module-shell.css");

test("应用工作区复用 Workbench 已有应用菜单数据与打开链路", () => {
  assert.match(workbench, /const allApplicationNavigationItems: ApplicationNavigationItem\[\] = \[/u);
  assert.match(workbench, /applicationNavigationItems=\{applicationNavigationItems\}/u);
  assert.match(workspace, /applicationNavigationItems\.map\(\(item\) =>/u);
  assert.match(workspace, /if \(item\.route\) onNavigate\(item\.route\)/u);
  assert.match(workspace, /onOpenApplication\(item\.applicationId, "normal"\)/u);
  assert.match(workspace, /const responsiveAppDock = true;[\s\S]*?useWorkbenchMetrics\(layoutRef, \(\) => initialMetrics\(responsiveAppDock\), responsiveAppDock, readWorkbenchLeadingInsetWidth\)/u);
  assert.doesNotMatch(workspace, /const applicationNavigationItems =/u);
});

test("AI Work 后台刷新保留账户项目快照，默认目录初始化按账户限于页面会话一次", () => {
  assert.match(workspace, /setWorkspaceProjectsLoadStatus\(cached \? "ready" : "loading"\)/u);
  assert.match(workspace, /app === "workspace" && !initializedDefaultWorkspaceUsers\.has\(userId\)/u);
  assert.match(workspace, /if \(initializedDefaultWorkspaceUsers\.size > 8\)/u);
  assert.match(workspace, /return \(\) => controller\.abort\(\)/u);
});

test("AI Work 路由并行预热聊天模块，消除工作区与聊天代码的串行懒加载", () => {
  assert.match(workbench, /let aiWorkChatPreloadPromise: Promise<void> \| null = null/u);
  assert.match(workbench, /function preloadAiWorkChatModule\(\)[\s\S]*?loadClientModule<typeof import\("lfaa-client-ui-chat\/src\/AiWorkChat\.js"\)>[\s\S]*?aiWorkChatPreloadPromise = null/u);
  assert.match(workbench, /const isAiWorkRoute = appRoute\?\.\[1\] === "workspace" && appRoute\?\.\[2\] === "ai-work"/u);
  assert.match(workbench, /useEffect\(\(\) => \{\s*if \(isAiWorkRoute\) void preloadAiWorkChatModule\(\)\.catch\(\(\) => undefined\);\s*\}, \[isAiWorkRoute\]\)/u);
  assert.match(workspace, /const AiWorkChat = lazy\(\(\) => loadClientModule<typeof import\("lfaa-client-ui-chat\/src\/AiWorkChat\.js"\)>/u);
});

test("AI Work 将 Git 摘要与变更管理联动到右侧菜单且聊天保持显示", () => {
  const gitSummary = read("../../../packages/client/ui-workspace/src/GitChangeSummary.tsx");
  const aiWorkChat = read("../../../packages/client/ui-chat/src/AiWorkChat.tsx");
  assert.match(workspace, /module-center__work-tabs[\s\S]*?变更/u);
  assert.match(workspace, /const gitSummaryPrimaryRepository[\s\S]*?gitSummarySecondaryRepositories/u);
  assert.match(workspace, /gitSummarySecondaryRepositories\.map\(repository => \{[\s\S]*?const entry = gitSummaryStatuses\[repository\.id\][\s\S]*?status\.insertions[\s\S]*?status\.deletions/u);
  assert.match(workspace, /Promise\.all\(visibleRepositories\.map\(async repository => \{[\s\S]*?loadAgentGitStatus\(repository\.id, controller\.signal\)/u);
  assert.match(workspace, /aria-label="项目摘要"[\s\S]*?module-git-summary__project-card[\s\S]*?module-git-summary__folder-row/u);
  assert.match(workspace, /module-git-summary__operations-trigger[\s\S]*?Git 操作[\s\S]*?gitSummaryActionRepositoryId/u);
  assert.match(workspace, /module-git-summary__operations-menu[\s\S]*?\["commit", "提交"\][\s\S]*?\["push", "推送"\][\s\S]*?\["branch-create", "创建分支"\][\s\S]*?\["branch-switch", "切换分支"\]/u);
  assert.match(workspaceCss, /module-git-summary__operations-menu\s*\{[^}]*inset-block-start:\s*-14px;[^}]*inset-inline-start:\s*-126px;[^}]*width:\s*min\(112px,\s*calc\(100vw - 24px\)\)/u);
  assert.match(workspace, /closeOnOutsidePointer[\s\S]*?addEventListener\("pointerdown", closeOnOutsidePointer, true\)[\s\S]*?removeEventListener\("pointerdown", closeOnOutsidePointer, true\)/u);
  assert.match(workspace, /closeOnEscape[\s\S]*?event\.key !== "Escape"[\s\S]*?setGitSummaryActionRepositoryId\(null\)/u);
  assert.match(workspace, /setGitSummaryActionRepositoryId\(null\);\s*if \(repositoryId\) openGitManager\(repositoryId, action\)/u);
  assert.match(workspaceCss, /\[data-layout-mode="mobile"\]\.module-git-summary\.is-actions-open\s*\{\s*padding-block-start:\s*0;/u);
  assert.match(workspaceCss, /\[data-layout-mode="mobile"\]\.module-git-summary \.module-git-summary__operations-menu\s*\{[^}]*position:\s*relative;[^}]*width:\s*calc\(100% - 20px\);[^}]*margin:\s*0 10px 4px;[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/u);
  assert.match(workspaceCss, /\[data-layout-mode="mobile"\]\.module-git-summary \.module-git-summary__operations-menu > button\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*100%;[^}]*min-width:\s*0;[^}]*min-height:\s*44px;[^}]*text-align:\s*center;[^}]*overflow-wrap:\s*anywhere/u);
  assert.match(workspaceCss, /@container \(max-width:\s*200px\)\s*\{\s*\[data-layout-mode="mobile"\]\.module-git-summary \.module-git-summary__operations-menu\s*\{\s*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/u);
  assert.match(workspaceCss, /\.module-git-summary__project-header\s*\{[^}]*align-items:\s*center;\s*flex-direction:\s*row/u);
  assert.match(workspaceCss, /\.module-git-summary__branch\s*\{[^}]*max-width:\s*40%;/u);
  assert.match(workspaceCss, /\.module-git-summary__body\s*\{[^}]*padding-inline:\s*4px;[^}]*scrollbar-gutter:\s*auto;[^}]*box-sizing:\s*border-box/u);
  assert.match(workspaceCss, /\.module-git-summary__file-section\s*\{[^}]*width:\s*100%;[^}]*min-width:\s*0;[^}]*padding:\s*8px;[^}]*border-radius:\s*10px;[^}]*box-sizing:\s*border-box/u);
  assert.match(workspaceCss, /\.module-git-summary__file-section > header span\s*\{[^}]*margin-inline-start:\s*auto;[^}]*text-align:\s*right/u);
  assert.match(workspaceCss, /\.module-git-summary__file-row\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*100%;[^}]*min-width:\s*0;[^}]*box-sizing:\s*border-box/u);
  assert.match(workspaceCss, /\.module-git-summary\s*\{[^}]*max-width:\s*calc\(100vw - 24px\)/u);
  assert.match(workspaceCss, /\.module-git-summary__view-all\s*\{[^}]*width:\s*calc\(100% - 20px\);[^}]*margin-inline:\s*10px/u);
  assert.match(workspaceCss, /\.module-git-summary-popover \.ant-popover-inner\s*\{\s*padding:\s*8px/u);
  assert.match(workspace, /module-git-summary__endcap[\s\S]*?module-git-summary__counts[\s\S]*?module-git-summary__endcap[\s\S]*?name="chevron"/u);
  assert.match(workspaceCss, /module-git-summary__endcap\s*\{[^}]*margin-inline-start:\s*auto/u);
  assert.match(workspace, /openGitManager\(repositoryId, action\)/u);
  assert.match(workspace, /gitSummaryWriteSignature[\s\S]*?window\.setTimeout\([\s\S]*?loadAgentGitStatus\(repository\.id, controller\.signal\)[\s\S]*?window\.clearTimeout\(timer\)[\s\S]*?controller\.abort\(\)/u);
  assert.match(workspaceCss, /module-git-summary__change-row:hover > \.module-git-summary__operations-trigger/u);
  assert.match(workspaceCss, /module-git-summary__change-row:hover \.module-git-summary__endcap[\s\S]*?module-git-summary__change-row\.is-open/u);
  assert.match(workspaceCss, /@media \(hover: none\)\s*\{\s*\.module-git-summary__operations-trigger\s*\{\s*opacity:\s*1/u);
  assert.match(workspaceCss, /\[data-layout-mode="mobile"\]\.module-git-summary \.module-git-summary__operations-trigger\s*\{\s*opacity:\s*1/u);
  assert.match(workspaceCss, /\[data-layout-mode="mobile"\]\.module-git-summary \.module-git-summary__change-row \.module-git-summary__endcap\s*\{\s*opacity:\s*1/u);
  assert.match(workspace, /aria-label="输出内容"[\s\S]*?aria-label="来源"[\s\S]*?查看全部/u);
  assert.match(workspace, /const gitSummaryContent = <section[\s\S]*?is-embedded[\s\S]*?aria-label="项目摘要"/u);
  assert.match(workspace, /layoutMode === "mobile" && gitSummaryOpen[\s\S]*?module-sidebar__mobile-summary-content[\s\S]*?gitSummaryContent/u);
  assert.match(workspace, /metrics\.mode === "mobile" \? <Button className="module-git-summary-trigger"[\s\S]*?leftCollapsed: false, rightCollapsed: true[\s\S]*?handleGitSummaryOpenChange\(open\)/u);
  assert.match(workspace, /metrics\.mode === "mobile" \? <Button[\s\S]*?: <Popover[\s\S]*?content=\{gitSummaryContent\}/u);
  assert.match(workspace, /module-sidebar__mobile-summary-heading[\s\S]*?返回项目与会话[\s\S]*?onCloseGitSummary/u);
  assert.match(workspace, /if \(metrics\.mode !== "mobile" \|\| !gitSummaryOpen \|\| gitSummaryActionRepositoryId\) return;[\s\S]*?closeSummaryOnEscape[\s\S]*?addEventListener\("keydown", closeSummaryOnEscape, true\)[\s\S]*?removeEventListener\("keydown", closeSummaryOnEscape, true\)/u);
  assert.match(workspaceCss, /\.module-git-summary\.is-embedded\s*\{[^}]*width:\s*100%;[^}]*height:\s*100%;[^}]*max-height:\s*none/u);
  assert.match(workspaceCss, /\.module-sidebar__mobile-summary-content\s*\{[^}]*min-height:\s*0;[^}]*flex:\s*1 1 auto;[^}]*overflow:\s*hidden/u);
  assert.match(dockkitCss, /--lfaa-mobile-pane-width:\s*min\(calc\(100%\s*-\s*\.75rem\),\s*20rem\);\s*\/\*[^*]*工作台可用宽度减 12px[^*]*\*\//u);
  assert.match(dockkitCss, /\.lfaa-workbench\[data-layout-mode="mobile"\] \.lfaa-workbench__pane--left\s*\{[^}]*top:\s*0;/u);
  assert.match(dockkitCss, /\.lfaa-workbench\[data-layout-mode="mobile"\]\[data-responsive-right-dock="true"\]\[data-right-layout="dock"\] \.lfaa-workbench__pane--left\s*\{[^}]*top:\s*0;/u);
  assert.match(workspace, /const latestWriteByPath = new Map[\s\S]*?if \(change\.operation !== "read"\) latestWriteByPath\.set[\s\S]*?outputs: \[\.\.\.latestWriteByPath\.values\(\)\]/u);
  assert.match(workspace, /onSessionFileChanges=\{onSessionFileChanges\}/u);
  assert.match(aiWorkChat, /activity\.fileChanges \?\? \[\]/u);
  assert.match(aiWorkChat, /messagesSessionId !== activeSessionId/u);
  assert.match(workspace, /new AbortController\(\);[\s\S]*?loadAgentGitStatus\(repository\.id, controller\.signal\)[\s\S]*?controller\.abort\(\)/u);
  assert.match(workspace, /首次获准在项目文件夹写入时，会自动初始化 Git/u);
  assert.match(workspace, /const gitManagerPanel = gitManagerAvailable && aiWorkView === "git"/u);
  assert.match(workspace, /<div className="module-ai-work-chat">/u);
  const center = workspace.slice(workspace.indexOf("const center = ("), workspace.indexOf("const gitManagerPanel ="));
  assert.doesNotMatch(center, /module-git-manager/u);
  assert.match(workspace, /aria-label=\{mode === "ai-work" [?] "小鱼智能体对话"/u);
  assert.match(workspace, /rightPanelSection === "context" && aiWorkView === "git"/u);
  assert.match(workspace, /openGitManager\(repository\.id\)/u);
  assert.match(workspace, /module-git-summary__project-header[\s\S]*?module-git-summary__branch/u);
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
  assert.match(gitSummary, /requestedAction\?: \{ action: "commit" \| "push" \| "branch-create" \| "branch-switch"/u);
  assert.match(gitSummary, /requestedAction\.action === "branch-create" \|\| requestedAction\.action === "branch-switch"\) void openMetadata\("branches"\)/u);
  assert.match(gitSummary, /querySelector<HTMLTextAreaElement>\('\[aria-label="提交信息"\]'\)/u);
  assert.match(gitSummary, /requestedActionFocus === "branch-create"/u);
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
  assert.match(workspace, /className=\{`module-sidebar__sessions\$\{layoutMode === "mobile" && gitSummaryOpen/u);
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
  assert.match(workspace, /className=\{`module-sidebar__sessions\$\{layoutMode === "mobile" && gitSummaryOpen/u);
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

test("工作区通过内外层容器和区域标识独立定位四个布局盒子", () => {
  const outerIndex = workspace.indexOf("className={`module-workbench-stage");
  const innerIndex = workspace.indexOf('<ResizableWorkbench', outerIndex);

  assert.ok(outerIndex >= 0, "outer workbench container should exist");
  assert.ok(innerIndex > outerIndex, "shared workbench root should be nested inside the outer container");
  assert.match(workspace, /className="module-workbench-inner module-workbench-layout"[\s\S]*?leading=\{<GlobalNavigationRail/u);
  assert.match(workspace, /leadingRegionClassName="module-workbench-region--leading"/u);
  assert.match(workspace, /leftRegionClassName="module-workbench-region--secondary-navigation"/u);
  assert.match(workspace, /centerRegionClassName="module-workbench-region--center-workspace"/u);
  assert.match(workspace, /rightRegionClassName="module-workbench-region--right-menu"/u);
  assert.doesNotMatch(workspace, /module-workbench-main/u, "四个内容区不再被额外三栏盒子包裹");
  assert.match(rail, /className\?: string/u);
  assert.match(rail, /module-navigation-rail\$\{className \? ` \$\{className\}` : ""\}/u);
  assert.match(dockkit, /className=\{`lfaa-workbench\$\{className \? ` \$\{className\}` : ""\}`\}/u);
  assert.match(dockkit, /lfaa-workbench__leading[\s\S]*?leadingRegionClassName/u);
  assert.match(dockkit, /lfaa-workbench__pane--left\$\{leftRegionClassName/u);
  assert.match(dockkit, /lfaa-workbench__center\$\{centerRegionClassName/u);
  assert.match(dockkit, /lfaa-workbench__pane--right\$\{rightRegionClassName/u);
  assert.match(dockkit, /import "\.\/css\/common\.css"/u);
  assert.doesNotMatch(commonCss, /\.lfaa-workbench(?:__pane--(?:left|right)|__center|__bottom)\s*\{[^}]*\b(?:background|box-shadow|border(?:-left|-top)?)\s*:/u, "公共布局 CSS 不绘制各页面自己的内容盒子表面");
  assert.match(secondaryNavigationCss, /\.module-workbench-layout > \.module-workbench-region--secondary-navigation[^\n]*background:\s*var\(--color-surface\)/u);
  assert.match(rightMenuCss, /\.module-workbench-layout > \.module-workbench-region--right-menu[^\n]*background:\s*var\(--color-surface\)/u);
  assert.match(dockkit, /getAvailableContainerWidth\(\) - otherWidth - centerFloor - handleBudget/u, "拖拽预算以扣除图标栏后的工作区宽度计算");
  assert.match(workspace, /module-workbench-stage--application/u);
  assert.match(workspaceCss, /\.module-workbench-stage\.module-workbench-stage--application\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/u);
  assert.match(workspaceCss, /\.module-workbench-stage--application\s*>\s*\.lfaa-workbench\.module-workbench-inner\s*\{[^}]*--lfaa-leading-width:\s*var\(--module-rail-width\)/u, "leading width must override the common zero-width default on the app workbench root");
  assert.match(workspaceCss, /\.module-workbench-stage--voice\s*>\s*\.lfaa-workbench\.module-workbench-inner\s*\{[^}]*--lfaa-leading-width:\s*0px/u, "voice mode must intentionally release the leading column");
  assert.doesNotMatch(workspaceCss, /\.module-workbench-stage\s*\{[^}]*grid-template-columns/u, "outer stage base rules must not force unrelated pages into the single-frame grid");
  assert.doesNotMatch(renderer, /lfaa-client-ui-workspace\/src\/(?:application-workspace|module-workbench)\.css/u, "workspace feature CSS must not load globally on unrelated routes");
  assert.match(workbench, /import "\.\/css\/module-shell\.css"/u, "Workbench owns the shared module-route shell geometry");
  assert.match(moduleShellCss, /\.workbench-shell--module\s*\{[^}]*height:\s*100dvh;[^}]*overflow:\s*hidden/u);
  assert.match(fileManagerCss, /\.module-workbench-stage\.file-manager-stage\s*\{[^}]*width:\s*100%;[^}]*height:\s*100%;[^}]*min-width:\s*0;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden/u, "file manager owns its own outer workbench box geometry");
  assert.match(fileManagerCss, /\.module-workbench-stage\.file-manager-stage\s*\{[^}]*grid-template-columns:\s*var\(--module-rail-width,\s*64px\)\s+minmax\(0,\s*1fr\)/u);
  assert.match(fileManagerCss, /\.module-workbench-stage\.file-manager-stage > \.module-navigation-rail\s*\{\s*grid-column:\s*1/u);
  assert.match(workspaceCss, /\.module-workbench-inner\s*\{\s*--lfaa-leading-width:\s*var\(--module-rail-width\)/u);
  assert.match(workspaceCss, /\.module-workbench-stage--voice\s*>\s*\.lfaa-workbench\.module-workbench-inner\s*\{\s*--lfaa-leading-width:\s*0px;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/u);
  assert.match(dockkitCss, /\.lfaa-workbench\s*\{[^}]*grid-template-columns:[\s\S]*?var\(--lfaa-leading-width\)[\s\S]*?var\(--lfaa-left-column\)/u);
  assert.match(dockkitCss, /\.lfaa-workbench__leading\s*\{[^}]*grid-column:\s*1/u);
  assert.match(dockkitCss, /\.lfaa-workbench__pane--left\s*\{[^}]*grid-column:\s*2/u);
});

test("四个工作区大区域内部按功能盒子各自分组", () => {
  const sidebar = workspace.slice(workspace.indexOf('<div className="module-sidebar"'), workspace.indexOf("interface ApplicationNavigationPanelProps"));
  const center = workspace.slice(workspace.indexOf("const center = ("), workspace.indexOf("const gitManagerPanel ="));
  const right = workspace.slice(workspace.indexOf("const right = ("), workspace.indexOf("const bottom ="));

  assert.match(rail, /module-navigation-rail__top[\s\S]*?module-navigation-rail__primary[\s\S]*?module-navigation-rail__footer-actions[\s\S]*?module-navigation-rail__status-box[\s\S]*?module-navigation-rail__profile/u);
  assert.match(sidebar, /module-sidebar__brand-row[\s\S]*?module-sidebar__sessions[\s\S]*?module-sidebar__sessions-heading[\s\S]*?module-sidebar__session-list[\s\S]*?module-sidebar__provider[\s\S]*?module-sidebar__footer/u);
  assert.match(center, /module-center__header[\s\S]*?module-center__heading[\s\S]*?module-center__actions[\s\S]*?module-center__content[\s\S]*?module-ai-work-chat/u);
  assert.match(right, /module-context__shell-actions[\s\S]*?module-context__body[\s\S]*?module-context__side-chat[\s\S]*?module-context__default-content[\s\S]*?module-context__tabs/u);
  assert.match(workspace, /import "\.\/css\/secondary-navigation\.css"[\s\S]*?import "\.\/css\/center-workspace\.css"[\s\S]*?import "\.\/css\/right-menu\.css"/u);
  assert.match(workspaceRegionsCss, /\.module-workbench-region--leading,[\s\S]*?color:\s*var\(--color-text-primary\)/u);
});
