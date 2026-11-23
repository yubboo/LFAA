// 装配主题、四栏可折叠骨架，并通过 Cordis workbench 服务响应业务插件贡献。
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import type { WorkbenchSectionItem } from "../../contract/index";
import { locales } from "../locales";
import { isSettingsView, type LocalProject, type NavigationView, type WorkspaceMode } from "../navigation/navigation";
import { usePinnedApps } from "../navigation/usePinnedApps";
import { useSidebarResize, type ResizeSide } from "./useSidebarResize";
import { buildSidebarWidthVars } from "./sidebar-resize";
import { readWorkspaceModePref, writeWorkspaceModePref } from "./ui-preferences";
import { useViewportMode } from "./useViewportMode";
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
  } = snapshot;

  const [newChatSelected, setNewChatSelected] = useState(false);
  const [mode, setMode] = useState<WorkspaceMode>(readWorkspaceModePref);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [workspaceNotice, setWorkspaceNotice] = useState("");
  const { pinnedApps, togglePinnedApp } = usePinnedApps();
  const { device, isCompact } = useViewportMode();
  const shellRef = useRef<HTMLDivElement>(null);
  const wasCompactRef = useRef<boolean | null>(null);
  const autoCollapsedRef = useRef({ left: false, right: false });
  // 记录最近一个非设置视图（含项目上下文）：设置中心是弹窗，关闭后要回到打开前的确切页面。
  const lastMainRef = useRef({ view: isSettingsView(activeView) ? "workspace" : activeView, projectId: activeProjectId });

  const settingsOpen = isSettingsView(activeView);
  useEffect(() => {
    if (!settingsOpen) lastMainRef.current = { view: activeView, projectId: activeProjectId };
  }, [activeProjectId, activeView, settingsOpen]);
  const backgroundView = settingsOpen ? lastMainRef.current.view : activeView;

  const domain = resolveWorkbenchDomain(backgroundView, locale);
  const hasRightColumn = domain.columns === 4;
  const showRightPanel = hasRightColumn && rightPanelOpen;

  const handleDragCollapse = useCallback((side: ResizeSide) => {
    if (side === "left") {
      service.setLeftSidebarOpen(false, true);
    } else {
      service.setRightPanelOpen(false, true);
    }
  }, [service]);

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
    setMode(nextMode);
    writeWorkspaceModePref(nextMode);
  }, []);

  const closeCompactDrawers = useCallback(() => {
    if (!isCompact) return;
    service.setLeftSidebarOpen(false, false);
    service.setRightPanelOpen(false, false);
  }, [isCompact, service]);

  const toggleLeftSidebar = useCallback(() => {
    if (isCompact && !leftSidebarOpen && rightPanelOpen) {
      service.setRightPanelOpen(false);
    }
    service.toggleLeftSidebar();
  }, [isCompact, leftSidebarOpen, rightPanelOpen, service]);

  const toggleRightPanel = useCallback(() => {
    if (isCompact && !rightPanelOpen && leftSidebarOpen) {
      service.setLeftSidebarOpen(false);
    }
    service.toggleRightPanel();
  }, [isCompact, leftSidebarOpen, rightPanelOpen, service]);

  const navigate = useCallback((view: NavigationView) => {
    service.navigate(view, null);
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

  const startChatSession = useCallback((opts: {
    projectId?: string | null;
    sectionId?: string | null;
    fallbackProject?: LocalProject;
    unavailableNotice: string;
  }) => {
    setSearchOpen(false);
    setActivityOpen(false);
    if (chatProvider) {
      service.navigate("workspace", null);
      setNewChatSelected(true);
      setWorkspaceNotice("");
      void chatProvider.startNewChat({
        projectId: opts.projectId ?? null,
        sectionId: opts.sectionId ?? null,
      });
    } else if (opts.fallbackProject) {
      service.openProject(opts.fallbackProject.id);
      setNewChatSelected(false);
      setWorkspaceNotice(opts.unavailableNotice);
    } else {
      service.navigate("workspace", null);
      setNewChatSelected(true);
      setWorkspaceNotice(opts.unavailableNotice);
    }
    if (isCompact) service.setLeftSidebarOpen(false, false);
  }, [chatProvider, isCompact, service]);

  // 在项目上下文里开新聊天时继承当前项目，项目起步建议才能围绕该项目生成。
  const startNewChat = useCallback(
    () => startChatSession({
      projectId: service.getSnapshot().activeProjectId,
      unavailableNotice: locale.newChatUnavailable,
    }),
    [locale.newChatUnavailable, service, startChatSession],
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

  // 选中会话统一回到工作区视图并清理临时提示，供左栏最近列表与会话入口复用。
  const handleSelectChatSession = useCallback(() => {
    service.navigate("workspace", null);
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

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
        setActivityOpen(false);
      } else if (event.ctrlKey && event.altKey && event.key.toLowerCase() === "u") {
        event.preventDefault();
        setActivityOpen(true);
        setSearchOpen(false);
      } else if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "b") {
        if (hasRightColumn) {
          event.preventDefault();
          toggleRightPanel();
        }
      } else if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "m") {
        if (hasRightColumn && !isCompact) {
          event.preventDefault();
          service.toggleRightPanelMaximized();
        }
      } else if (event.key === "Escape") {
        setSearchOpen(false);
        setActivityOpen(false);
        if (isCompact && (leftSidebarOpen || rightPanelOpen)) {
          service.setLeftSidebarOpen(false);
          service.setRightPanelOpen(false);
        }
      }
    };
    document.addEventListener("keydown", onShortcut);
    return () => document.removeEventListener("keydown", onShortcut);
  }, [hasRightColumn, isCompact, leftSidebarOpen, rightPanelOpen, service, toggleRightPanel]);

  const currentProject = projects.find((project) => project.id === activeProjectId);

  // 若恢复的项目视图在本地列表加载完毕后已不存在，自动退回工作区首页（弹窗打开时也按背景视图判断）。
  useEffect(() => {
    if (backgroundView !== "project" || !activeProjectId || !projectProvider?.hasLoaded?.()) return;
    if (!currentProject) {
      service.navigate("workspace", null);
    }
  }, [activeProjectId, backgroundView, currentProject, projectProvider, service]);
  // 右侧面板与项目上下文按「背景视图」匹配：设置弹窗打开时 activeView 指向设置页，
// 若仍用 activeView，背景工作区的右栏面板会全部失配而退化成空占位。
  const matchingPanels = contextPanels.filter((panel) => !panel.match || panel.match(backgroundView, activeProjectId));
  const hasWorkbenchHost = matchingPanels.some((panel) => panel.chrome === "workbench");
  const isRightMaximized = showRightPanel && rightPanelMaximized && !isCompact;
  const projectContext = backgroundView === "project" && currentProject && projectProvider?.renderProjectContext
    ? projectProvider.renderProjectContext(currentProject)
    : null;
  const openAppearance = () => navigate("appearance");
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
        newChatSelected={newChatSelected}
        searchOpen={searchOpen}
        activityOpen={activityOpen}
        dragging={dragState?.side === "left"}
        dragCollapsed={leftDragCollapsed}
        onNavigate={navigate}
        onTogglePinned={togglePinnedApp}
        onOpenAppearance={openAppearance}
        onBackdropClick={closeCompactDrawers}
        onCloseDrawer={() => service.setLeftSidebarOpen(false, !isCompact)}
        onModeChange={handleModeChange}
        onNewChat={startNewChat}
        onNewChatInProject={startNewChatInProject}
        onNewChatInSection={startNewChatInSection}
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
        newChatSelected={newChatSelected}
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