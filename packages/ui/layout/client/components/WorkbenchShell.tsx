// 装配主题、四栏可折叠骨架，并通过 Cordis workbench 服务响应业务插件贡献。
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { WORKBENCH_REGIONS, type WorkbenchSectionItem } from "../../src/index";
import { locales } from "../locales";
import type { LocalProject, NavigationView, RecentItem, WorkspaceMode } from "../navigation";
import { usePinnedApps } from "../usePinnedApps";
import { useSidebarResize, type ResizeSide } from "../useSidebarResize";
import { buildSidebarWidthVars } from "../sidebar-resize";
import { readWorkspaceModePref, writeWorkspaceModePref } from "../ui-preferences";
import { useViewportMode } from "../useViewportMode";
import { buildChatRecentItems, resolveViewLabel, resolveWorkbenchDomain } from "../workbench-domains";
import type { WorkbenchClientService } from "../workbench-service";
import { ContextPanel } from "./ContextPanel";
import { NavigationRail } from "./NavigationRail";
import { NavigationSidebar } from "./NavigationSidebar";
import { SidebarResizeHandle } from "./SidebarResizeHandle";
import { WorkspaceBar } from "./WorkspaceBar";
import themeStyles from "./ShellTheme.module.css";
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
    views,
    contextPanels,
    accountActions,
    projectProvider,
    projects,
    sectionProvider,
    sections,
    chatProvider,
    chatSessions,
    activeChatSessionId,
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

  const domain = resolveWorkbenchDomain(activeView, locale);
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

  const startNewChat = useCallback(
    () => startChatSession({ unavailableNotice: locale.newChatUnavailable }),
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

  const recents: RecentItem[] = chatProvider
    ? buildChatRecentItems({
        chatSessions,
        chatProvider,
        activeView,
        activeChatSessionId,
        onSelectSession: () => {
          service.navigate("workspace", null);
          setNewChatSelected(false);
          setWorkspaceNotice("");
          if (isCompact) service.setLeftSidebarOpen(false, false);
        },
      })
    : [];

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
  }, [isCompact, leftSidebarOpen, rightPanelOpen, service]);

  const currentProject = projects.find((project) => project.id === activeProjectId);

  // 若恢复的项目视图在本地列表加载完毕后已不存在，自动退回工作区首页。
  useEffect(() => {
    if (activeView !== "project" || !activeProjectId || !projectProvider?.hasLoaded?.()) return;
    if (!currentProject) {
      service.navigate("workspace", null);
    }
  }, [activeProjectId, activeView, currentProject, projectProvider, service]);
  const registeredView = views.find((entry) => entry.id === activeView);
  const title = activeView === "project" && currentProject
    ? currentProject.name
    : resolveViewLabel(activeView, locale, registeredView?.title);
  const matchingPanels = contextPanels.filter((panel) => !panel.match || panel.match(activeView, activeProjectId));
  const projectContext = activeView === "project" && currentProject && projectProvider?.renderProjectContext
    ? projectProvider.renderProjectContext(currentProject)
    : null;
  const openAppearance = () => navigate("appearance");
  const leftDragCollapsed = dragState?.side === "left" && dragState.snappedCollapsed;
  const rightDragCollapsed = dragState?.side === "right" && dragState.snappedCollapsed;
  const shellStyle = buildSidebarWidthVars({
    isCompact,
    leftWidth,
    rightWidth,
  }) as CSSProperties;

  return (
    <div
      ref={shellRef}
      className={`${themeStyles.theme} ${styles.shell}`}
      style={shellStyle}
      data-device={device}
      data-columns={String(domain.columns)}
      data-left-open={String(leftSidebarOpen)}
      data-right-open={String(showRightPanel)}
      data-resizing={dragState ? "true" : undefined}
      data-left-drag-collapsed={leftDragCollapsed ? "true" : undefined}
      data-right-drag-collapsed={rightDragCollapsed ? "true" : undefined}
    >
      <NavigationRail
        locale={locale}
        activeView={activeView as NavigationView}
        activeDomain={domain.id}
        pinnedApps={pinnedApps}
        accountActions={accountActions}
        onNavigate={navigate}
        onTogglePinned={togglePinnedApp}
        onOpenAppearance={openAppearance}
      />

      {isCompact && (leftSidebarOpen || showRightPanel) && (
        <div
          className={styles.drawerBackdrop}
          aria-hidden="true"
          onClick={closeCompactDrawers}
        />
      )}

      {leftSidebarOpen && (
        <NavigationSidebar
          locale={locale}
          domain={domain}
          activeView={activeView as NavigationView}
          newChatSelected={newChatSelected}
          activeProjectId={activeProjectId}
          mode={mode}
          projects={projects}
          sections={sections}
          recents={recents}
          projectProvider={projectProvider}
          sectionProvider={sectionProvider}
          searchOpen={searchOpen}
          activityOpen={activityOpen}
          compact={isCompact}
          onCloseDrawer={() => service.setLeftSidebarOpen(false, !isCompact)}
          onModeChange={handleModeChange}
          onNewChat={startNewChat}
          onNewChatInProject={startNewChatInProject}
          onNewChatInSection={startNewChatInSection}
          onNavigate={navigate}
          onOpenProject={openProject}
          onProjectCreated={openProject}
          onProjectUpdated={() => {}}
          onProjectRemoved={handleProjectRemoved}
          onToggleSearch={toggleSearch}
          onCloseSearch={closeSearch}
          onToggleActivity={toggleActivity}
          onCloseActivity={closeActivity}
        />
      )}

      {!isCompact && leftSidebarOpen && (
        <SidebarResizeHandle
          side="left"
          label={locale.resizeLeftSidebar}
          dragging={dragState?.side === "left"}
          snapped={leftDragCollapsed}
          onStartResize={startResize}
          onKeyResize={handleKeyResize}
        />
      )}

      <main className={styles.workspace} data-region={WORKBENCH_REGIONS[2]}>
        <WorkspaceBar
          locale={locale}
          title={title}
          leftOpen={leftSidebarOpen}
          leftDragCollapsed={leftDragCollapsed}
          hasRightColumn={hasRightColumn}
          rightOpen={rightPanelOpen}
          rightDragCollapsed={rightDragCollapsed}
          onToggleLeft={toggleLeftSidebar}
          onToggleRight={toggleRightPanel}
        />

        {registeredView ? (
          registeredView.render()
        ) : activeView === "project" && currentProject && projectProvider ? (
          <div className={styles.projectViewHost}>
            {workspaceNotice && (
              <p className={styles.projectNotice} role="status">{workspaceNotice}</p>
            )}
            {projectProvider.renderProjectView(currentProject)}
          </div>
        ) : activeView === "project" && projectProvider && !projectProvider.hasLoaded?.() ? (
          <section className={styles.page} aria-busy="true" />
        ) : activeView === "workspace" ? (
          <section className={styles.welcome} aria-labelledby="workspace-title">
            <p className={styles.welcomeLabel}>{mode === "chatgpt" ? "ChatGPT" : "Codex"}</p>
            <h1 id="workspace-title">{locale.headline}</h1>
            <p className={styles.introduction} role={workspaceNotice ? "status" : undefined}>{workspaceNotice || locale.introduction}</p>
          </section>
        ) : (
          <section className={styles.page} aria-labelledby="feature-title">
            <p className={styles.welcomeLabel}>{locale.localMode}</p>
            <h1 id="feature-title">{title}</h1>
            <p>{locale.featureUnavailable}</p>
          </section>
        )}
      </main>

      {!isCompact && showRightPanel && (
        <SidebarResizeHandle
          side="right"
          label={locale.resizeRightPanel}
          dragging={dragState?.side === "right"}
          snapped={rightDragCollapsed}
          onStartResize={startResize}
          onKeyResize={handleKeyResize}
        />
      )}

      {showRightPanel && (
        <ContextPanel
          locale={locale}
          panels={matchingPanels}
          projectContext={projectContext}
          compact={isCompact}
          onCloseDrawer={() => service.setRightPanelOpen(false, !isCompact)}
        />
      )}
    </div>
  );
}
