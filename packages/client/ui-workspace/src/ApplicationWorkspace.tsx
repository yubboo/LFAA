/**
 * 文件：ApplicationWorkspace.tsx
 * 功能：组合 AI Work、领域应用、画布与终端的共享工作区。
 * 作用：装配职责 Hook 与左右/中心区域视图；会话、项目、Git、浏览器和领域数据仍由原 Owner 持有。
 * 关联文件：./application-workspace/hooks/*、./application-workspace/components/*、./module-workbench.css。
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { APPLICATION_ROUTE_PATTERN } from "lfaa-util-values/src/application-id.js";
import { sidebarRightRuntime, useSidebarRightSnapshot } from "./sidebar-right-runtime.js";
import { setFileManagerLocation } from "lfaa-client-connection/src/file-manager-location.js";
import { type ApplicationId, type ApplicationMode, type WorkspaceProjectApplicationId } from "lfaa-client-connection/src/api.js";
import { ResizableWorkbench } from "lfaa-client-ui-dockkit/src/ResizableWorkbench.js";
import { createScrollRestorationKey, useScrollRestoration } from "lfaa-client-store/src/scroll-restoration.js";
import { GlobalNavigationRail } from "lfaa-client-ui-sidebar/src/GlobalNavigationRail.js";
import { ApplicationSidebar, type ApplicationSidebarProps } from "./application-workspace/components/ApplicationSidebar.js";
import { ApplicationGitSummary } from "./application-workspace/components/ApplicationGitSummary.js";
import { ApplicationWorkbenchTabs } from "./application-workspace/components/ApplicationWorkbenchTabs.js";
import { ApplicationContextPanel } from "./application-workspace/components/ApplicationContextPanel.js";
import { ApplicationChatSurface } from "./application-workspace/components/ApplicationChatSurface.js";
import { ApplicationCenterWorkspace } from "./application-workspace/components/ApplicationCenterWorkspace.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import { createAgentWorkbenchView } from "./agent-workbench-view.js";
import type { ApplicationWorkspaceProps } from "./application-workspace/types.js";
import { TaskTerminal } from "./TaskTerminal.js";
import { useWorkspaceCapabilities } from "./application-workspace/hooks/useWorkspaceCapabilities.js";
import { useWorkspaceSessionsAndProjects } from "./application-workspace/hooks/useWorkspaceSessionsAndProjects.js";
import { useWorkbenchChrome } from "./application-workspace/hooks/useWorkbenchChrome.js";
import { useWorkspaceUtilityTabs } from "./application-workspace/hooks/useWorkspaceUtilityTabs.js";
import { useWritingWorkspace } from "./application-workspace/hooks/useWritingWorkspace.js";
import { useCanvasWorkspaceContext } from "./application-workspace/hooks/useCanvasWorkspaceContext.js";
import { useMinecraftWorkspaceContext } from "./application-workspace/hooks/useMinecraftWorkspaceContext.js";
import { useGitWorkspace } from "./application-workspace/hooks/useGitWorkspace.js";
import "./module-workbench.css";
import "./css/secondary-navigation.css";
import "./css/center-workspace.css";
import "./css/right-menu.css";
import "./css/workbench-regions.css";

const LAYOUT_KEY = "lfaa.module-workbench.layout.v1";

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (
    target.isContentEditable || Boolean(target.closest("input, textarea, select, [contenteditable='true']"))
  );
}

export function ApplicationWorkspace(props: ApplicationWorkspaceProps) {
  const { userId, app, mode, section, gameLibrary = false, workspaceTitle, canvasWorkspace, apps, applicationNavigationItems, username, role, serverState, settings, onBack, onOpenSelectedApplication, onNavigate, onOpenSettings, onOpenApplication, recentSessionsOpenRequestId, onRecentSessionsOpenRequestHandled, rightPanelSection, onRightPanelSectionChange, applicationsOpenRequestId, onApplicationsOpenRequestHandled, activeAiSessionId, aiDraft, notifications, onMarkNotificationsRead, onMarkSessionNotificationsRead, onClearNotifications, onOpenNotification, onActiveAiSessionChange, onLogout } = props;
  const activeRightPanelSection = mode === "normal" ? "context" : rightPanelSection;
  const voiceMode = app === "workspace" && mode === "ai-work" && section === "voice";
  const workspaceProjectAppId: WorkspaceProjectApplicationId | null = mode === "ai-work" ? "workspace" : app === "workspace" || app === "minecraft" ? app : null;
  const chatSessionAppId = mode === "ai-work" ? "workspace" : app;
  const sidebarRight = useSidebarRightSnapshot();

  const chromeWorkspace = useWorkbenchChrome({ app, mode, section, settings, onRightPanelSectionChange });
  const {
    layoutRef, metrics, shortcuts, chrome, setChrome,
    leftPaneWidth, setLeftPaneWidth, leftPreviewOpen, centerCollapsed,
    centerCollapsePreview, setCenterCollapsePreview, setCenterCollapsed,
    showRightPanelSection: showChromeRightPanelSection,
    toggleLeft, toggleRight, toggleTerminal, openTerminal, closeLeftPreview,
  } = chromeWorkspace;
  const sideChatShortcuts = shortcuts.openSideChat;

  const capabilities = useWorkspaceCapabilities(userId, app, mode, settings.plugins);
  const { extensionsLoading } = capabilities;
  const sessionWorkspace = useWorkspaceSessionsAndProjects({
    userId, app, mode, voiceMode, workspaceProjectAppId, chatSessionAppId,
    activeSessionId: activeAiSessionId,
    onActiveSessionChange: onActiveAiSessionChange,
  });
  const {
    sessions: aiSessions, sessionsLoading: aiSessionsLoading, sessionsError: aiSessionsError,
    sessionsDataReady: aiSessionsDataReady,
    refreshSessions: refreshAiSessions,
    workspaceProjects, workspaceProjectsReady,
    workspaceProjectsError, workspaceProjectsRevision,
    retryWorkspaceProjects,
    missingSessionDirectoryIds, pinnedSessionIds, togglePinnedSession,
    recentSessionsExpandRequestId, requestRecentSessions,
    startNewAiSession, selectSession: selectAiSession,
    archiveSession: archiveAiWorkSession, renameSession: renameAiSessionForSidebar,
  } = sessionWorkspace;

  const canvasContext = useCanvasWorkspaceContext(userId, app, chatSessionAppId, canvasWorkspace?.applicationId, settings);
  const {
    canvasChatOpen, setCanvasChatOpen, agentCanvasContext,
    applicationProjectContext,
  } = canvasContext;
  const minecraftContext = useMinecraftWorkspaceContext(userId, role, app, mode, section, onNavigate);
  const { openGameFiles } = minecraftContext;
  const writing = useWritingWorkspace(app, userId);
  const { flushBeforeNavigation } = writing;
  const [writingLibraryPortalTarget, setWritingLibraryPortalTarget] = useState<HTMLDivElement | null>(null);
  const [aiProviderStatus, setAiProviderStatus] = useState<string | null>(null);
  const handledApplicationsOpenRequestRef = useRef<number | null>(null);

  const utility = useWorkspaceUtilityTabs({
    userId, app, mode, activeSessionId: activeAiSessionId, settings, layoutMode: metrics.mode,
    rightPanelSection: activeRightPanelSection, onRightPanelSectionChange,
    sidebarRight, setChrome, showRightPanelSection: showChromeRightPanelSection,
    setCenterCollapsed, setCenterCollapsePreview, workspaceProjects,
  });
  const {
    sideChatOpen,
    aiWorkView, setAiWorkView, tabs: workspaceUtilityTabs,
    activeTab: activeWorkspaceUtilityTab, activeTabId: activeWorkspaceUtilityTabId,
    activeTabKind: activeWorkspaceUtilityTabKind,
    previewOpenId: workbenchTabPreviewOpenId, browserPreviewRequest: browserTabPreviewRequest,
    browserPreviewImage: browserTabPreviewImage,
    browserOpenTabs, openWorkspaceUtility, openProjectFile,
    createWorkspaceUtilityTab, selectWorkbenchTab, selectRightUtilityTab, toggleCenterCollapsed,
    handleCenterCollapsedChange, closeWorkspaceUtilityTab, showWorkspaceUtilityTab, openSessionFiles, openAiHostTask,
    openSideChat, closeSideChat, handleWorkbenchTabPreviewOpen,
    handleWorkbenchTabPreviewClose, handleChatTabPreviewOpenChange,
  } = utility;
  const git = useGitWorkspace({
    userId, app, mode, voiceMode, activeSessionId: activeAiSessionId, activeSession: sessionWorkspace.sessions.find(session => session.id === activeAiSessionId) ?? null,
    workspaceProjectsRevision, activeTab: activeWorkspaceUtilityTab, activeTabKind: activeWorkspaceUtilityTabKind,
    layoutMode: metrics.mode, openWorkspaceUtility,
  });
  const {
    summaryOpen: gitSummaryOpen, handleSummaryOpenChange: handleGitSummaryOpenChange,
    summaryActionFolderKey: gitSummaryActionFolderKey, setSummaryActionFolderKey: setGitSummaryActionFolderKey,
    summaryActionMenuRef: gitSummaryActionMenuRef, summaryActionTriggerRefs: gitSummaryActionTriggerRefs,
    summaryFolderState: gitSummaryFolderState, summaryFolderMatches: gitSummaryFolderMatches,
    hostTasks: gitSummaryHostTasks, hostTasksLoading: gitSummaryHostTasksLoading, hostTasksError: gitSummaryHostTasksError,
    stoppingHostTaskId: stoppingAiHostTaskId,
    hostTaskStopError: aiHostTaskStopError, sessionFileChangesState, sessionFileSummary,
    openGitSummaryFolder,
    stopHostTask: stopAiHostTask,
  } = git;
  const showRightPanelSection = useCallback((nextSection: "context" | "applications") => {
    showChromeRightPanelSection(nextSection);
    if (nextSection === "applications") setAiWorkView("chat");
  }, [setAiWorkView, showChromeRightPanelSection]);
  const contextBodyScroll = useScrollRestoration(
    createScrollRestorationKey(userId, "module-context", app, mode),
    !extensionsLoading
  );

  const selectedApp = apps.find((item) => item.id === app);
  const activeApplicationTitle = workspaceTitle ?? selectedApp?.title ?? "当前应用";
  const modeLabel = mode === "normal" ? "应用" : "工作";
  const writingNormal = app === "writing" && mode === "normal";
  const aiVideoNormal = app === "aivideo" && mode === "normal";
  const terminalPanelAvailable = app !== "writing" && app !== "minecraft";
  const activeAiSessionTitle = aiSessions.find((session) => session.id === activeAiSessionId)?.title ?? null;
  const activeAiSession = aiSessions.find((session) => session.id === activeAiSessionId) ?? null;
  const chatAppId = chatSessionAppId;
  const activeChatSession = activeAiSession?.appId === chatAppId ? activeAiSession : null;
  const activeChatSessionId = activeChatSession?.id ?? null;
  const applicationModeScopeId = canvasWorkspace?.applicationId ?? (app === "workspace" ? null : app);
  const modeSwitchAppId = applicationModeScopeId;
  const canvasApplicationTitle = canvasWorkspace ? applicationNavigationItems.find(item => item.applicationId === canvasWorkspace.applicationId)?.title ?? activeApplicationTitle : activeApplicationTitle;
  const activeChatSessionTitle = activeChatSession?.title ?? (canvasWorkspace ? canvasApplicationTitle : chatAppId !== "workspace" ? activeApplicationTitle : "小鱼智能体");
  const activeChatSessionDirectoryMissing = Boolean((chatAppId === "workspace" || chatAppId === "minecraft") && activeChatSessionId && missingSessionDirectoryIds.has(activeChatSessionId));
  const gitManagerAvailable = mode === "ai-work";
  const statusLabel = serverState === "online" ? "控制端已连接" : serverState === "checking" ? "正在检查控制端" : "控制端未连接";
  const contextLabel = writingNormal ? "作品信息" : mode === "ai-work" ? "工具与资源" : "应用工具";

  const openApplication = useCallback(async (nextApp: ApplicationId, nextMode: ApplicationMode) => {
    if (app === "writing" && mode === "normal" && !await flushBeforeNavigation()) {
      return;
    }
    await onOpenApplication(nextApp, nextMode);
  }, [app, flushBeforeNavigation, mode, onOpenApplication]);
  useEffect(() => { setAiProviderStatus(null); }, [mode, userId]);

  const toggleApplicationsPanel = useCallback(() => {
    if (rightPanelSection === "applications" && !chrome.rightCollapsed) {
      setChrome((current) => ({ ...current, rightCollapsed: true }));
      return;
    }
    openWorkspaceUtility("applications");
  }, [chrome.rightCollapsed, openWorkspaceUtility, rightPanelSection]);
  const openToolsPanel = useCallback(() => {
    if (mode !== "ai-work") {
      if (rightPanelSection === "context" && !chrome.rightCollapsed) setChrome((current) => ({ ...current, rightCollapsed: true }));
      else showRightPanelSection("context");
      return;
    }
    const activeTab = workspaceUtilityTabs.find(tab => tab.id === activeWorkspaceUtilityTabId);
    if (rightPanelSection === "context" && !chrome.rightCollapsed && activeTab?.kind === "new" && sidebarRight.activeId === null) {
      setChrome((current) => ({ ...current, rightCollapsed: true }));
      return;
    }
    if (activeTab?.kind === "new") showWorkspaceUtilityTab(activeTab);
    else createWorkspaceUtilityTab();
  }, [activeWorkspaceUtilityTabId, chrome.rightCollapsed, createWorkspaceUtilityTab, mode, rightPanelSection, showRightPanelSection, showWorkspaceUtilityTab, sidebarRight.activeId, workspaceUtilityTabs]);
  const showRecentSessions = useCallback(() => {
    setChrome((current) => ({
      ...current,
      leftCollapsed: false,
      ...(metrics.mode !== "desktop" ? { rightCollapsed: true } : {}),
    }));
    requestRecentSessions();
    if (mode === "ai-work") refreshAiSessions();
    else void openApplication("workspace", "ai-work").catch(() => undefined);
  }, [metrics.mode, mode, openApplication, refreshAiSessions, requestRecentSessions]);
  useEffect(() => {
    if (mode !== "ai-work" || recentSessionsOpenRequestId === null) return;
    showRecentSessions();
    onRecentSessionsOpenRequestHandled(recentSessionsOpenRequestId);
  }, [mode, onRecentSessionsOpenRequestHandled, recentSessionsOpenRequestId, showRecentSessions]);
  useEffect(() => {
    if (applicationsOpenRequestId === null || handledApplicationsOpenRequestRef.current === applicationsOpenRequestId) return;
    handledApplicationsOpenRequestRef.current = applicationsOpenRequestId;
    onApplicationsOpenRequestHandled(applicationsOpenRequestId);
    if (mode === "ai-work") openWorkspaceUtility("applications");
    else {
      onRightPanelSectionChange("context");
      setChrome((current) => ({
        ...current,
        leftCollapsed: false,
        ...(metrics.mode !== "desktop" ? { rightCollapsed: true } : {}),
      }));
    }
  }, [applicationsOpenRequestId, metrics.mode, mode, onApplicationsOpenRequestHandled, onRightPanelSectionChange, openWorkspaceUtility]);
  const toggleSideChat = useCallback(() => sideChatOpen ? closeSideChat() : openSideChat(), [closeSideChat, openSideChat, sideChatOpen]);
  useEffect(() => sidebarRightRuntime.bindExpansion(() => !chrome.rightCollapsed, toggleRight), [chrome.rightCollapsed, toggleRight]);
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.isComposing) return;
      const key = event.key.toLocaleLowerCase();
      const matches = (chord: string) => {
        const parts = chord.split("+").map((part) => part.toLocaleLowerCase());
        const targetKey = parts.at(-1) ?? "";
        return key === targetKey
          && Boolean(event.ctrlKey || event.metaKey) === parts.includes("ctrl")
          && Boolean(event.altKey) === parts.includes("alt")
          && Boolean(event.shiftKey) === parts.includes("shift");
      };
      const region = isEditableTarget(event.target) ? "editable" : "page";
      if (shortcuts.wallpaperSidebarToggle.some((chord) => chord && matches(chord))
        && sidebarRightRuntime.runShortcut(event, region)) {
        event.preventDefault();
        return;
      }
      if (mode === "ai-work" && sideChatShortcuts.some((chord) => chord && matches(chord))) {
        event.preventDefault();
        toggleSideChat();
        return;
      }
      if (region === "editable") return;
      const actionGroups: Array<[string[], () => void]> = [
        [shortcuts.toggleContextPanel, toggleRight],
        [shortcuts.toggleSidebar, toggleLeft],
        [terminalPanelAvailable ? shortcuts.toggleBottomPanel : [], toggleTerminal],
        [terminalPanelAvailable ? shortcuts.openTerminal : [], openTerminal],
        [shortcuts.switchNormalMode, onBack],
        [shortcuts.switchAiWorkMode, () => { void openApplication(app, "ai-work"); }]
      ];
      const actions = actionGroups.flatMap(([chords, action]) => chords.filter(Boolean).map((chord) => [chord, action] as [string, () => void]));
      const action = actions.find(([chord]) => matches(chord));
      if (action) {
        event.preventDefault();
        action[1]();
        return;
      }
      if (event.key === "Escape" && metrics.mode === "mobile") {
        setChrome((current) => ({ ...current, leftCollapsed: true, rightCollapsed: true }));
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [app, metrics.mode, mode, openApplication, openTerminal, shortcuts, sideChatShortcuts, toggleLeft, toggleRight, toggleSideChat, toggleTerminal]);

  if (!selectedApp) return null;

  const openSidebarMode = async (nextApp: ApplicationId, nextMode: ApplicationMode) => {
    await openApplication(nextApp, nextMode);
    if (metrics.mode === "mobile") setChrome((current) => ({ ...current, leftCollapsed: true }));
  };
  const navigateWithinApplication = useCallback((path: string) => {
    const appModeRoute = path.match(APPLICATION_ROUTE_PATTERN);
    if (appModeRoute && !appModeRoute[3] && appModeRoute[1] !== "workspace") {
      void openApplication(appModeRoute[1] as ApplicationId, appModeRoute[2] as ApplicationMode);
    } else onNavigate(path);
    if (metrics.mode === "mobile") setChrome((current) => ({ ...current, leftCollapsed: true }));
  }, [metrics.mode, onNavigate, openApplication]);
  const handleOpenSessionFiles = useCallback(() => {
    if (!activeAiSessionId) return;
    openSessionFiles(activeAiSessionId, [...sessionFileSummary.outputs, ...sessionFileSummary.sources]);
  }, [activeAiSessionId, openSessionFiles, sessionFileSummary.outputs, sessionFileSummary.sources]);
  const gitSummaryContent = <ApplicationGitSummary
    app={app}
    layoutMode={metrics.mode}
    activeSession={activeAiSession}
    projects={workspaceProjects}
    folderMatches={gitSummaryFolderMatches}
    folders={gitSummaryFolderState.folders}
    foldersLoading={gitSummaryFolderState.loading}
    foldersError={gitSummaryFolderState.error}
    actionFolderKey={gitSummaryActionFolderKey}
    onActionFolderKeyChange={setGitSummaryActionFolderKey}
    actionMenuRef={gitSummaryActionMenuRef}
    actionTriggerRefs={gitSummaryActionTriggerRefs}
    sessionFileChangesState={sessionFileChangesState}
    sessionFileSummary={sessionFileSummary}
    hostTasks={gitSummaryHostTasks}
    hostTasksLoading={gitSummaryHostTasksLoading}
    hostTasksError={gitSummaryHostTasksError}
    hostTaskStopError={aiHostTaskStopError}
    stoppingHostTaskId={stoppingAiHostTaskId}
    onOpenFolder={openGitSummaryFolder}
    onOpenHostTask={openAiHostTask}
    onStopHostTask={stopAiHostTask}
    onOpenSessionFiles={handleOpenSessionFiles}
    onOpenProjectFile={openProjectFile}
  />;
  const sidebarProps: ApplicationSidebarProps = {
    userId,
    app,
    mode,
    section,
    gameLibrary,
    workspaceTitle,
    apps,
    applicationNavigationItems,
    onOpenGameFiles: app === "minecraft" || app === "steamcmd" ? openGameFiles : undefined,
    onOpenSelectedApplication,
    layoutMode: metrics.mode,
    onWritingLibraryPortalTargetChange: setWritingLibraryPortalTarget,
    onNavigate: navigateWithinApplication,
    onOpenApplication: openSidebarMode,
    onToggleLeft: toggleLeft,
    notifications,
    onMarkNotificationsRead,
    onMarkSessionNotificationsRead,
    onClearNotifications,
    onOpenNotification,
    sessions: aiSessions,
    missingSessionDirectoryIds,
    aiDraft,
    pinnedSessionIds,
    onTogglePinnedSession: togglePinnedSession,
    workspaceProjects,
    workspaceProjectsReady,
    sessionsDataReady: aiSessionsDataReady,
    recentSessionsExpandRequestId,
    projectLoadError: workspaceProjectsError,
    onRetryProjects: retryWorkspaceProjects,
    activeSessionId: activeAiSessionId,
    sessionsLoading: aiSessionsLoading,
    sessionsError: aiSessionsError,
    providerStatus: aiProviderStatus,
    gitSummaryOpen,
    gitSummaryContent,
    onNewSession: startNewAiSession,
    onRenameSession: renameAiSessionForSidebar,
    onSelectSession: selectAiSession,
    onArchiveSession: (session) => { void archiveAiWorkSession(session); },
    onCloseGitSummary: () => handleGitSummaryOpenChange(false),
    onPreviewMouseLeave: closeLeftPreview,
    onPreviewBlur: closeLeftPreview,
  };
  const left = <ApplicationSidebar {...sidebarProps} />;
  const showWorkbenchTabs = mode === "ai-work" && !voiceMode;
  const showRightShellControls = metrics.mode === "desktop" || (showWorkbenchTabs && metrics.mode === "compact");
  const showCenterPanelControls = chrome.rightCollapsed || metrics.mode === "mobile" || (metrics.mode === "compact" && !showWorkbenchTabs);
  const activeCenterCollapsed = centerCollapsePreview ?? centerCollapsed;
  const activeBrowserUrl = browserOpenTabs.find(tab => tab.active)?.url;
  const activeAgentRightPane = sidebarRight.activeId !== null ? "extension"
    : activeRightPanelSection === "applications" ? "applications"
      : aiWorkView === "git" || activeWorkspaceUtilityTabKind === "git" ? "git"
        : activeWorkspaceUtilityTabKind === "assets" ? "assets"
        : activeWorkspaceUtilityTabKind === "applications" ? "applications"
          : activeWorkspaceUtilityTabKind === "side-chat" ? "side-chat"
            : activeWorkspaceUtilityTabKind === "extension" ? "extension"
          : activeWorkspaceUtilityTabKind === "project-file" ? "project-file"
              : activeWorkspaceUtilityTabKind === "new"
                ? activeRightPanelSection === "context" && activeBrowserUrl ? "browser" : "new-tab"
                : "application-tools";
  const agentBrowserUrl = activeAgentRightPane === "browser" ? activeBrowserUrl : undefined;
  const agentWorkbenchView = useMemo(() => createAgentWorkbenchView({
    rightPane: activeAgentRightPane,
    rightPaneOpen: !chrome.rightCollapsed,
    bottomTerminalOpen: chrome.terminalOpen,
    browserUseEnabled: settings.browserUse.enabled,
    ...(agentCanvasContext.canvas?.applicationId === (canvasWorkspace?.applicationId ?? chatAppId) ? { canvas: agentCanvasContext.canvas } : {}),
    ...(agentCanvasContext.workflow?.applicationId === (canvasWorkspace?.applicationId ?? chatAppId) ? { workflow: agentCanvasContext.workflow } : {}),
    ...(applicationProjectContext?.applicationId === (canvasWorkspace?.applicationId ?? chatAppId) ? { applicationProject: applicationProjectContext } : {}),
    ...(agentBrowserUrl ? { activeBrowserUrl: agentBrowserUrl } : {})
  }), [activeAgentRightPane, agentBrowserUrl, agentCanvasContext.canvas, agentCanvasContext.workflow, applicationProjectContext, canvasWorkspace, chatAppId, chrome.rightCollapsed, chrome.terminalOpen, settings.browserUse.enabled]);
  const selectedWorkbenchTab = activeCenterCollapsed ? activeWorkspaceUtilityTab?.id ?? "chat" : activeWorkspaceUtilityTab?.id ?? "";
  const workbenchTabs = showWorkbenchTabs ? <ApplicationWorkbenchTabs
    tabs={workspaceUtilityTabs}
    activeTab={activeWorkspaceUtilityTab}
    activeCenterCollapsed={activeCenterCollapsed}
    activeSessionTitle={activeAiSessionTitle}
    browserOpenTabs={browserOpenTabs}
    sidebarRight={sidebarRight}
    rightPanelSection={activeRightPanelSection}
    settings={settings}
    previewOpenId={workbenchTabPreviewOpenId}
    previewRequest={browserTabPreviewRequest}
    previewImage={browserTabPreviewImage}
    onChatPreviewOpenChange={handleChatTabPreviewOpenChange}
    onTabPreviewOpen={handleWorkbenchTabPreviewOpen}
    onPreviewClose={handleWorkbenchTabPreviewClose}
    onSelectWorkbenchTab={selectWorkbenchTab}
    onSelectRightUtilityTab={selectRightUtilityTab}
    onToggleCenterCollapsed={toggleCenterCollapsed}
    onCloseUtilityTab={closeWorkspaceUtilityTab}
    onCreateUtilityTab={createWorkspaceUtilityTab}
  /> : null;
  const renderAiWorkChatContent = (workspaceHeader?: ReactNode) => <ApplicationChatSurface
    workspace={props}
    appId={chatAppId}
    sessionId={activeChatSessionId}
    projectDirectoryMissing={activeChatSessionDirectoryMissing}
    workspaceView={agentWorkbenchView}
    workspaceHeader={workspaceHeader}
    capabilities={capabilities}
    sessions={sessionWorkspace}
    utility={utility}
    writing={writing}
    canvas={canvasContext}
    git={git}
    onProviderStatusChange={setAiProviderStatus}
  />;
  const center = <ApplicationCenterWorkspace
    workspace={props}
    chrome={chromeWorkspace}
    utility={utility}
    canvas={canvasContext}
    minecraft={minecraftContext}
    writing={writing}
    git={git}
    state={{ activeApplicationTitle, modeLabel, writingNormal, aiVideoNormal, terminalPanelAvailable, activeChatSessionTitle, chatAppId, applicationModeScopeId, modeSwitchAppId, statusLabel, gitManagerAvailable, showCenterPanelControls, gitSummaryContent, writingLibraryPortalTarget }}
    openApplication={openApplication}
    navigateWithinApplication={navigateWithinApplication}
    renderAiWorkChatContent={renderAiWorkChatContent}
    toggleRight={toggleRight}
    toggleTerminal={toggleTerminal}
  />;
  const right = <ApplicationContextPanel
    workspace={props}
    selectedApp={selectedApp}
    activeApplicationTitle={activeApplicationTitle}
    modeLabel={modeLabel}
    contextLabel={contextLabel}
    writingNormal={writingNormal}
    terminalPanelAvailable={terminalPanelAvailable}
    showWorkbenchTabs={showWorkbenchTabs}
    showRightShellControls={showRightShellControls}
    selectedWorkbenchTab={selectedWorkbenchTab}
    metrics={metrics}
    chrome={chrome}
    activeRightPanelSection={activeRightPanelSection}
    sidebarRight={sidebarRight}
    capabilities={capabilities}
    sessions={sessionWorkspace}
    utility={utility}
    writing={writing}
    minecraft={minecraftContext}
    git={git}
    contextBodyScroll={contextBodyScroll}
    shortcuts={shortcuts}
    workbenchTabs={workbenchTabs}
    openApplication={openApplication}
    openSidebarMode={openSidebarMode}
    navigateWithinApplication={navigateWithinApplication}
    showRightPanelSection={showRightPanelSection}
    toggleRight={toggleRight}
    toggleTerminal={toggleTerminal}
    onWritingLibraryPortalTargetChange={setWritingLibraryPortalTarget}
  />;
  const bottom = terminalPanelAvailable ? <TaskTerminal appId={app} settings={settings} sessionId={activeAiSessionId} role={role} onClose={toggleTerminal} /> : null;

  const previewStyle = { "--module-left-preview-width": `${leftPaneWidth}px` } as CSSProperties;
  const leftPreviewMode = chrome.leftCollapsed && metrics.mode !== "mobile";
  const leftRegionClassName = `module-workbench-region--secondary-navigation${leftPreviewMode ? ` module-left-preview${leftPreviewOpen ? " is-visible" : ""}` : ""}`;
  return (
    <div className={`module-workbench-stage module-workbench-stage--application${voiceMode ? " module-workbench-stage--voice" : ""}`} style={previewStyle} data-layout-mode={metrics.mode}>
      <ResizableWorkbench
        rootElementRef={layoutRef}
        className="module-workbench-inner module-workbench-layout"
        leading={<GlobalNavigationRail secondaryNavigationMinWidth={metrics.left.min} username={username} role={role} serverState={serverState} shortcuts={shortcuts} activePage="home" applications={applicationNavigationItems} onOpenRecentSessions={showRecentSessions} showServiceStatus={settings.general.showServiceStatus} onNavigate={onNavigate} onOpenApplication={openApplication} isSharedWorkHome={app === "workspace" && mode === "ai-work" && section !== "canvas"} onOpenFiles={() => { setFileManagerLocation(userId, ""); onNavigate("/files"); }} onOpenSettings={onOpenSettings} onLogout={onLogout} onToggleTools={openToolsPanel} applicationsExpanded={mode === "normal" ? !chrome.leftCollapsed : activeRightPanelSection === "applications" && !chrome.rightCollapsed} applicationsTargetId="module-context-applications" onToggleApplications={mode === "ai-work" ? toggleApplicationsPanel : undefined} />}
        leadingRegionClassName="module-workbench-region--leading"
        leftRegionClassName={leftRegionClassName}
        centerRegionClassName="module-workbench-region--center-workspace"
        rightRegionClassName="module-workbench-region--right-menu"
        bottomRegionClassName="module-workbench-region--bottom"
        left={left}
        center={center}
        leftVisible={!voiceMode}
        right={voiceMode ? null : canvasWorkspace && canvasChatOpen ? (
          <aside className="module-context module-context--canvas-chat" aria-label="小鱼智能体通用会话" data-layout-mode={metrics.mode} data-testid="canvas-agent-chat">
            <header className="module-context__heading">
              <div>
                <strong>{activeChatSessionTitle?.trim() || `${activeApplicationTitle}助手`}</strong>
                <span>{canvasWorkspace ? `通用 Work 会话 · ${canvasApplicationTitle}画布上下文` : "通用 Work 会话"}</span>
              </div>
              <button type="button" className="module-shell-icon-button module-context__close" aria-label="收起小鱼会话" onClick={() => setCanvasChatOpen(false)}><WorkbenchIcon name="close" size={15} /></button>
            </header>
            <div className="module-context__body module-context__body--canvas-chat">{renderAiWorkChatContent()}</div>
          </aside>
        ) : right}
        bottom={!voiceMode && terminalPanelAvailable && chrome.terminalOpen && settings.general.terminalPosition === "bottom" ? bottom : null}
        storageKey={LAYOUT_KEY}
        leftLimits={metrics.left}
        rightLimits={metrics.right}
        bottomLimits={metrics.bottom}
        containerWidth={metrics.containerWidth}
        snapCaptureRatio={metrics.snapCaptureRatio}
        snapHysteresis={metrics.snapHysteresis}
        minCenterWidth={metrics.minCenterWidth}
        centerCollapsed={showWorkbenchTabs && centerCollapsed}
        centerCollapseEnabled={showWorkbenchTabs}
        onCenterCollapsedChange={handleCenterCollapsedChange}
        onCenterCollapsePreviewChange={setCenterCollapsePreview}
        layoutMode={metrics.mode}
        responsiveRightDock
        responsiveLeftDock
        leftWidth={leftPaneWidth}
        onLeftWidthChange={setLeftPaneWidth}
        leftCollapsed={chrome.leftCollapsed}
        onLeftCollapsedChange={(leftCollapsed) => setChrome((current) => ({ ...current, leftCollapsed }))}
        rightCollapsed={canvasWorkspace && canvasChatOpen ? false : chrome.rightCollapsed}
        onRightCollapsedChange={(rightCollapsed) => {
          if (canvasWorkspace && canvasChatOpen && rightCollapsed) {
            setCanvasChatOpen(false);
            setChrome(current => ({ ...current, rightCollapsed: true }));
          }
          else setChrome((current) => ({ ...current, rightCollapsed }));
        }}
        bottomOpen={terminalPanelAvailable && chrome.terminalOpen && settings.general.terminalPosition === "bottom"}
        onBottomOpenChange={(terminalOpen) => setChrome((current) => ({ ...current, terminalOpen }))}
      />
    </div>
  );
}
