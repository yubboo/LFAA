// 装配主题、四栏可折叠骨架，并通过 Cordis workbench 服务响应业务插件贡献。
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import type { WorkbenchSectionItem } from "../../contract/index";
import { locales } from "../locales";
import { isSettingsView, type LocalProject, type NavigationView, type WorkspaceMode } from "../navigation/navigation";
import { usePinnedApps } from "../navigation/usePinnedApps";
import { useSidebarResize, type ResizeSide } from "./useSidebarResize";
import { usePaneMotionSuspend } from "./usePaneMotionSuspend";
import { useShellShortcuts } from "./useShellShortcuts";
import { buildSidebarWidthVars } from "./sidebar-resize";
import { useViewportMode } from "./useViewportMode";
import { resolveNewChatProject } from "../navigation/navigation-items";
import { resolveWorkbenchDomain } from "../navigation/workbench-domains";
import type { WorkbenchClientService } from "../workbench-service";
import { SettingsDialog } from "../panels/SettingsDialog";
import { ShellLeftColumn } from "./ShellLeftColumn";
import { ShellRightColumn } from "./ShellRightColumn";
import { ShellWorkspace } from "./ShellWorkspace";
import styles from "./WorkbenchShell.module.css";

// Shell 是四栏/三栏统一复用骨架与折叠状态的唯一所有者；根据域配置决定是否启用右侧栏。
export function WorkbenchShell({ service }: { service: WorkbenchClientService }) {
  const locale = typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("zh")
    ? locales.zh
    : locales.en;
  const snapshot = useSyncExternalStore(service.subscribe, service.getSnapshot, service.getSnapshot);
  const {
    activeView,
    activeProjectId,
    leftSidebarOpen,
    rightPanelOpen,
    contextPanels,
    chatProvider,
    projectProvider,
    projects,
    rightPanelMaximized,
    rightWorkbenchWide,
    workspaceMode,
  } = snapshot;

  // 「聊天 / 工作」由 workbench 服务持有：中心区分段、左二头部与插件都读同一份状态。
  const mode = workspaceMode;

  const [newChatSelected, setNewChatSelected] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [workspaceNotice, setWorkspaceNotice] = useState("");
  const { pinnedApps, togglePinnedApp } = usePinnedApps();
  const { device, isCompact } = useViewportMode();
  const shellRef = useRef<HTMLDivElement>(null);
  const wasCompactRef = useRef<boolean | null>(null);
  const autoCollapsedRef = useRef({ left: false, right: false });
  // 记录最近一个非设置视图（含项目上下文）：设置中心是弹窗，关闭后要回到打开前的确切页面。
  // 刷新恢复设置弹窗时，打开前的视图来自服务读回的背景路由，不能默认成工作区。
  const lastMainRef = useRef({
    view: isSettingsView(activeView) ? (snapshot.settingsReturnView ?? "workspace") : activeView,
    projectId: activeProjectId,
  });

  const settingsOpen = isSettingsView(activeView);
  useEffect(() => {
    if (!settingsOpen) lastMainRef.current = { view: activeView, projectId: activeProjectId };
  }, [activeProjectId, activeView, settingsOpen]);
  const backgroundView = settingsOpen ? lastMainRef.current.view : activeView;

  const domain = resolveWorkbenchDomain(backgroundView, locale);
  const hasRightColumn = domain.columns === 4;
  const showRightPanel = hasRightColumn && rightPanelOpen;

  // 窗口缩放与拖拽吸附期间暂停轨道过渡，宽度始终跟手。
  const suspendPaneMotion = usePaneMotionSuspend(shellRef);

  const handleDragCollapse = useCallback((side: ResizeSide) => {
    // 吸附收起时宽度已跟随指针到 0，不再补播轨道过渡。
    suspendPaneMotion();
    if (side === "left") {
      service.setLeftSidebarOpen(false, true);
    } else {
      service.setRightPanelOpen(false, true);
    }
  }, [service, suspendPaneMotion]);

  const { leftWidth, rightWidth, dragState, startResize, handleKeyResize } = useSidebarResize({
    shellRef,
    isCompact,
    leftOpen: leftSidebarOpen,
    rightOpen: showRightPanel,
    onCollapseSide: handleDragCollapse,
    onBeforeDrag: () => projectProvider?.closeProjectMenus?.(),
  });

  // 平板与手机端首次进入时默认收起两侧抽屉，且不覆盖桌面端已保存的展开记忆。
  useEffect(() => {
    if (wasCompactRef.current === isCompact) return;
    wasCompactRef.current = isCompact;
    const current = service.getSnapshot();
    if (isCompact) {
      autoCollapsedRef.current = {
        left: current.leftSidebarOpen,
        right: current.rightPanelOpen,
      };
      if (current.leftSidebarOpen) service.setLeftSidebarOpen(false, false);
      if (current.rightPanelOpen) service.setRightPanelOpen(false, false);
    } else {
      if (autoCollapsedRef.current.left) service.setLeftSidebarOpen(true, false);
      if (autoCollapsedRef.current.right) service.setRightPanelOpen(true, false);
      autoCollapsedRef.current = { left: false, right: false };
    }
  }, [isCompact, service]);

  const handleModeChange = useCallback((nextMode: WorkspaceMode) => {
    service.setWorkspaceMode(nextMode);
  }, [service]);

  const closeCompactDrawers = useCallback(() => {
    if (!isCompact) return;
    service.setLeftSidebarOpen(false, false);
    service.setRightPanelOpen(false, false);
  }, [isCompact, service]);

  const toggleLeftSidebar = useCallback(() => {
    if (isCompact && !leftSidebarOpen && rightPanelOpen) {
      service.setRightPanelOpen(false, false);
    }
    service.setLeftSidebarOpen(!leftSidebarOpen, !isCompact);
  }, [isCompact, leftSidebarOpen, rightPanelOpen, service]);

  const toggleRightPanel = useCallback(() => {
    if (isCompact && !rightPanelOpen && leftSidebarOpen) {
      service.setLeftSidebarOpen(false, false);
    }
    service.setRightPanelOpen(!rightPanelOpen, !isCompact);
  }, [isCompact, leftSidebarOpen, rightPanelOpen, service]);

  const navigate = useCallback((view: NavigationView) => {
    service.navigate(view, service.getSnapshot().activeProjectId);
    setNewChatSelected(false);
    setWorkspaceNotice("");
    if (isCompact) service.setLeftSidebarOpen(false, false);
  }, [isCompact, service]);

  // 关闭设置弹窗：回到打开设置前的视图与项目上下文，而不是固定回工作区首页。
  const closeSettings = useCallback(() => {
    const last = lastMainRef.current;
    service.navigate(last.view, last.projectId);
    setNewChatSelected(false);
    setWorkspaceNotice("");
  }, [service]);

  const openProject = useCallback((project: LocalProject) => {
    service.openProject(project.id);
    setNewChatSelected(false);
    setWorkspaceNotice("");
    if (isCompact) service.setLeftSidebarOpen(false, false);
  }, [isCompact, service]);

  // 单击左二项目文件夹行仅高亮并切换当前项目上下文，不跳走或清空当前聊天。
  const selectProjectContext = useCallback((project: LocalProject) => {
    service.setActiveProject(project.id);
  }, [service]);

  const startChatSession = useCallback((opts: {
    projectId?: string | null;
    sectionId?: string | null;
    fallbackProject?: LocalProject;
    unavailableNotice: string;
  }) => {
    setSearchOpen(false);
    setActivityOpen(false);
    const nextProjectId = opts.projectId ?? null;
    if (chatProvider) {
      service.navigate("workspace", nextProjectId);
      setNewChatSelected(true);
      setWorkspaceNotice("");
      void chatProvider.startNewChat({ projectId: nextProjectId, sectionId: opts.sectionId ?? null });
    } else if (opts.fallbackProject) {
      service.openProject(opts.fallbackProject.id);
      setNewChatSelected(false);
      setWorkspaceNotice(opts.unavailableNotice);
    } else {
      service.navigate("workspace", nextProjectId);
      setNewChatSelected(true);
      setWorkspaceNotice(opts.unavailableNotice);
    }
    if (isCompact) service.setLeftSidebarOpen(false, false);
  }, [chatProvider, isCompact, service]);

  // 左二顶部「新聊天」始终沿用当前已选/已绑定的项目上下文，不再丢失项目绑定。
  const startNewChat = useCallback(() => {
    const snap = service.getSnapshot();
    const target = resolveNewChatProject({
      activeProjectId: snap.activeProjectId,
      activeChatSessionId: snap.activeChatSessionId,
      chatSessions: snap.chatSessions,
      draftProjectId: snap.chatProvider?.getDraftProjectId?.() ?? null,
      projects: snap.projects,
    });
    startChatSession({
      projectId: target?.id ?? null,
      sectionId: target?.sectionId ?? null,
      unavailableNotice: locale.newChatUnavailable,
    });
  }, [locale.newChatUnavailable, service, startChatSession]);

  // 「最近」标题右侧新会话入口：强制开一条不绑定任何项目的全新独立对话。
  const startNewRecentChat = useCallback(
    () => startChatSession({ projectId: null, sectionId: null, unavailableNotice: locale.newChatUnavailable }),
    [locale.newChatUnavailable, startChatSession],
  );

  const startNewChatInProject = useCallback(
    (project: LocalProject) => startChatSession({
      projectId: project.id,
      sectionId: project.sectionId ?? null,
      fallbackProject: project,
      unavailableNotice: locale.newChatInProjectUnavailable,
    }),
    [locale.newChatInProjectUnavailable, startChatSession],
  );

  const startNewChatInSection = useCallback(
    (section: WorkbenchSectionItem) => startChatSession({
      sectionId: section.id,
      unavailableNotice: `${section.name}：${locale.newChatInSectionUnavailable}`,
    }),
    [locale.newChatInSectionUnavailable, startChatSession],
  );

  const handleProjectRemoved = useCallback((projectId: string) => {
    if (service.getSnapshot().activeProjectId === projectId) {
      service.navigate("workspace", null);
    }
  }, [service]);

  // 选中历史会话时同步该会话所属项目（项目外会话为 null），供后续顶部「新聊天」沿用。
  const handleSelectChatSession = useCallback((sessionId: string) => {
    const target = service.getSnapshot().chatSessions.find((session) => session.id === sessionId);
    service.navigate("workspace", target?.projectId ?? null);
    setNewChatSelected(false);
    setWorkspaceNotice("");
    if (isCompact) service.setLeftSidebarOpen(false, false);
  }, [isCompact, service]);

  const closeActivity = useCallback(() => setActivityOpen(false), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const toggleActivity = useCallback(() => {
    setActivityOpen((open) => !open);
    setSearchOpen(false);
  }, []);
  const toggleSearch = useCallback(() => {
    setSearchOpen((open) => !open);
    setActivityOpen(false);
  }, []);

  useShellShortcuts({
    hasRightColumn,
    isCompact,
    leftSidebarOpen,
    rightPanelOpen,
    onOpenSearch: () => { setSearchOpen(true); setActivityOpen(false); },
    onOpenActivity: () => { setActivityOpen(true); setSearchOpen(false); },
    onCloseOverlays: () => { setSearchOpen(false); setActivityOpen(false); },
    onToggleRightPanel: toggleRightPanel,
    onToggleRightMaximized: () => service.toggleRightPanelMaximized(),
    onCloseCompactDrawers: () => { service.setLeftSidebarOpen(false, false); service.setRightPanelOpen(false, false); },
  });

  const currentProject = projects.find((project) => project.id === activeProjectId);

  // 若恢复的项目上下文在本地列表加载完毕后已不存在，自动清理，避免残留失效项目绑定。
  useEffect(() => {
    if (!activeProjectId || !projectProvider?.hasLoaded?.()) return;
    if (!currentProject) {
      if (backgroundView === "project") service.navigate("workspace", null);
      else service.setActiveProject(null);
    }
  }, [activeProjectId, backgroundView, currentProject, projectProvider, service]);
  const effectiveNewChatSelected = newChatSelected
    || (backgroundView === "workspace" && !snapshot.activeChatSessionId && Boolean(currentProject));
  // 右侧面板与项目上下文按「背景视图」匹配：设置弹窗打开时 activeView 指向设置页，
// 若仍用 activeView，背景工作区的右栏面板会全部失配而退化成空占位。
  const matchingPanels = contextPanels.filter((panel) => !panel.match || panel.match(backgroundView, activeProjectId));
  const hasWorkbenchHost = matchingPanels.some((panel) => panel.chrome === "workbench");
  const isRightMaximized = showRightPanel && rightPanelMaximized && !isCompact;
  const projectContext = backgroundView === "project" && currentProject && projectProvider?.renderProjectContext
    ? projectProvider.renderProjectContext(currentProject)
    : null;
  const openAppearance = () => navigate("appearance");
  // 「设置」入口落到设置中心首屏（常规），而不是外观页。
  const openSettings = () => navigate("settings:general");
  const leftDragCollapsed = dragState?.side === "left" && dragState.snappedCollapsed;
  const rightDragCollapsed = dragState?.side === "right" && dragState.snappedCollapsed;
  const shellStyle = buildSidebarWidthVars({
    isCompact,
    leftWidth,
    rightWidth,
    rightWide: rightWorkbenchWide,
  }) as CSSProperties;

  return (
    <div
      ref={shellRef}
      className={styles.shell}
      style={shellStyle}
      data-device={device}
      data-columns={String(domain.columns)}
      data-left-open={String(leftSidebarOpen)}
      data-right-open={String(showRightPanel)}
      data-right-wide={rightWorkbenchWide ? "true" : undefined}
      data-right-maximized={isRightMaximized ? "true" : undefined}
      data-left-drag-collapsed={leftDragCollapsed ? "true" : undefined}
      data-right-drag-collapsed={rightDragCollapsed ? "true" : undefined}
    >
      <ShellLeftColumn
        snapshot={snapshot}
        locale={locale}
        domain={domain}
        pinnedApps={pinnedApps}
        isMobile={device === "mobile"}
        isCompact={isCompact}
        mode={mode}
        newChatSelected={effectiveNewChatSelected}
        searchOpen={searchOpen}
        activityOpen={activityOpen}
        dragging={dragState?.side === "left"}
        dragCollapsed={leftDragCollapsed}
        onNavigate={navigate}
        onTogglePinned={togglePinnedApp}
        onOpenAppearance={openAppearance}
        onOpenSettings={openSettings}
        onBackdropClick={closeCompactDrawers}
        onCloseDrawer={() => service.setLeftSidebarOpen(false, !isCompact)}
        onModeChange={handleModeChange}
        onNewChat={startNewChat}
        onNewRecentChat={startNewRecentChat}
        onNewChatInProject={startNewChatInProject}
        onNewChatInSection={startNewChatInSection}
        onSelectProjectContext={selectProjectContext}
        onSelectChatSession={handleSelectChatSession}
        onSelectLibraryTab={(tab) => service.setLibraryTab(tab)}
        onSelectDomainItem={(id) => service.setDomainItem(id)}
        onOpenProject={openProject}
        onProjectRemoved={handleProjectRemoved}
        onToggleSearch={toggleSearch}
        onCloseSearch={closeSearch}
        onToggleActivity={toggleActivity}
        onCloseActivity={closeActivity}
        onStartResize={startResize}
        onKeyResize={handleKeyResize}
      />

      <ShellWorkspace
        snapshot={snapshot}
        locale={locale}
        view={backgroundView}
        mode={mode}
        newChatSelected={effectiveNewChatSelected}
        workspaceNotice={workspaceNotice}
        isCompact={isCompact}
        isRightMaximized={isRightMaximized}
        hasRightColumn={hasRightColumn}
        hasWorkbenchHost={hasWorkbenchHost}
        leftDragCollapsed={leftDragCollapsed}
        rightDragCollapsed={rightDragCollapsed}
        onToggleLeft={toggleLeftSidebar}
        onToggleRight={toggleRightPanel}
      />

      <ShellRightColumn
        locale={locale}
        panels={matchingPanels}
        projectContext={projectContext}
        compact={isCompact}
        showPanel={showRightPanel}
        rightPanelMaximized={isRightMaximized}
        dragging={dragState?.side === "right"}
        snapped={rightDragCollapsed}
        onStartResize={startResize}
        onKeyResize={handleKeyResize}
        onToggleMaximize={() => service.toggleRightPanelMaximized()}
        onClosePanel={() => service.setRightPanelOpen(false, !isCompact)}
      />

      {/* 设置中心以弹窗覆盖在当前工作区之上：背景保留打开前的视图，关闭即回到该视图。 */}
      {settingsOpen && (
        <SettingsDialog
          locale={locale}
          activeView={activeView}
          renderContent={() => snapshot.views.find((entry) => entry.id === activeView)?.render() ?? null}
          onNavigate={navigate}
          onClose={closeSettings}
        />
      )}
    </div>
  );
}