// 组合四栏 Shell 左栏：一级图标栏、窄屏抽屉遮罩、左二导航侧栏与宽度拖拽手柄。
import { useMemo, type KeyboardEvent, type PointerEvent } from "react";
import type { WorkbenchSectionItem } from "../../contract/index";
import type { LocaleMessages } from "../locales";
import type { LocalProject, NavigationTarget, NavigationView, RecentItem, WorkspaceMode } from "../navigation/navigation";
import type { ResizeSide } from "./useSidebarResize";
import type { SidebarMode } from "./ui-preferences";
import { buildChatRecentItems, buildNavigationTargets, type WorkbenchDomainConfig } from "../navigation/workbench-domains";
import type { LibraryTabKey, WorkbenchSnapshot } from "../workbench-service";
import { NavigationRail } from "../navigation/NavigationRail";
import { NavigationSidebar } from "../navigation/NavigationSidebar";
import { SearchDialog } from "../panels/SearchDialog";
import { SidebarResizeHandle } from "./SidebarResizeHandle";
import styles from "./WorkbenchShell.module.css";

/** 按工作台快照渲染左栏各层；折叠状态与宽度仍由 Shell 根组件持有。 */
export function ShellLeftColumn({
  snapshot,
  locale,
  domain,
  pinnedApps,
  isMobile,
  isCompact,
  mode,
  newChatSelected,
  searchOpen,
  activityOpen,
  dragging,
  dragCollapsed,
  onNavigate,
  onTogglePinned,
  onOpenAppearance,
  onOpenSettings,
  onBackdropClick,
  onCloseDrawer,
  onModeChange,
  onNewChat,
  onNewRecentChat,
  onNewChatInProject,
  onNewChatInSection,
  onSelectChatSession,
  onSelectProjectContext,
  onSelectLibraryTab,
  onSelectDomainItem,
  onOpenProject,
  onProjectRemoved,
  onToggleSearch,
  onCloseSearch,
  onToggleActivity,
  onCloseActivity,
  sidebarMode,
  onChangeSidebarMode,
  onStartResize,
  onKeyResize,
}: {
  snapshot: WorkbenchSnapshot;
  locale: LocaleMessages;
  domain: WorkbenchDomainConfig;
  pinnedApps: NavigationView[];
  isMobile: boolean;
  isCompact: boolean;
  mode: WorkspaceMode;
  newChatSelected: boolean;
  searchOpen: boolean;
  activityOpen: boolean;
  dragging: boolean;
  dragCollapsed: boolean;
  onNavigate: (view: NavigationView) => void;
  onTogglePinned: (view: NavigationView) => boolean;
  onOpenAppearance: () => void;
  onOpenSettings: () => void;
  onBackdropClick: () => void;
  onCloseDrawer: () => void;
  onModeChange: (mode: WorkspaceMode) => void;
  onNewChat: () => void;
  onNewRecentChat: () => void;
  onNewChatInProject: (project: LocalProject) => void;
  onNewChatInSection: (section: WorkbenchSectionItem) => void;
  onSelectChatSession: (sessionId: string) => void;
  onSelectProjectContext: (project: LocalProject) => void;
  onSelectLibraryTab: (tab: LibraryTabKey) => void;
  onSelectDomainItem: (id: string) => void;
  onOpenProject: (project: LocalProject) => void;
  onProjectRemoved: (projectId: string) => void;
  onToggleSearch: () => void;
  onCloseSearch: () => void;
  onToggleActivity: () => void;
  onCloseActivity: () => void;
  /** 左二内容模式：会话列表或项目工作区。 */
  sidebarMode: SidebarMode;
  onChangeSidebarMode: (mode: SidebarMode) => void;
  onStartResize: (side: ResizeSide, event: PointerEvent<HTMLDivElement>) => void;
  onKeyResize: (side: ResizeSide, event: KeyboardEvent<HTMLDivElement>) => void;
}) {
  const {
    activeView,
    activeProjectId,
    activeLibraryTab,
    activeDomainItem,
    leftSidebarOpen,
    rightPanelOpen,
    views,
    projects,
    sections,
    chatSessions,
    chatProvider,
    projectProvider,
    sectionProvider,
    activeChatSessionId,
  } = snapshot;

  // 最近会话按当前会话与项目列表现算，选择后由 Shell 统一关闭窄屏抽屉。
  const recents: RecentItem[] = chatProvider
    ? buildChatRecentItems({
        chatSessions,
        chatProvider,
        activeView,
        activeChatSessionId,
        existingProjectIds: new Set(projects.map((project) => project.id)),
        onSelectSession: onSelectChatSession,
      })
    : [];

  const searchTargets = useMemo<NavigationTarget[]>(
    () => buildNavigationTargets(locale, projects),
    [locale, projects],
  );
  const chooseSearchTarget = (target: NavigationTarget) => {
    onCloseSearch();
    if (target.projectId) {
      const project = projects.find((item) => item.id === target.projectId);
      if (project) onOpenProject(project);
    } else onNavigate(target.view);
  };

  return (
    <>
      <NavigationRail
        locale={locale}
        isMobile={isMobile}
        activeView={activeView as NavigationView}
        activeDomain={domain.id}
        pinnedApps={pinnedApps}
        accountActions={snapshot.accountActions}
        onNavigate={onNavigate}
        onTogglePinned={onTogglePinned}
        onOpenAppearance={onOpenAppearance}
        onOpenSettings={onOpenSettings}
      />

      {isCompact && (leftSidebarOpen || rightPanelOpen) && (
        <div
          className={styles.drawerBackdrop}
          aria-hidden="true"
          onClick={onBackdropClick}
        />
      )}

      {leftSidebarOpen && (
        <NavigationSidebar
          locale={locale}
          domain={domain}
          activeView={activeView as NavigationView}
          activeLibraryTab={activeLibraryTab}
          activeDomainItem={activeDomainItem}
          pluginViews={views.filter((v) => v.domain === "plugins")}
          newChatSelected={newChatSelected}
          activeProjectId={activeProjectId}
          activeChatSessionId={activeChatSessionId}
          mode={mode}
          projects={projects}
          sections={sections}
          recents={recents}
          chatSessions={chatSessions}
          chatProvider={chatProvider}
          projectProvider={projectProvider}
          sectionProvider={sectionProvider}
          searchOpen={searchOpen}
          activityOpen={activityOpen}
          compact={isCompact}
          onCloseDrawer={onCloseDrawer}
          onModeChange={onModeChange}
          onNewChat={onNewChat}
          onNewChatInProject={onNewChatInProject}
          onNewRecentChat={onNewRecentChat}
          onNewChatInSection={onNewChatInSection}
          onSelectChatSession={onSelectChatSession}
          onSelectProjectContext={onSelectProjectContext}
          onNavigate={onNavigate}
          onSelectLibraryTab={onSelectLibraryTab}
          onSelectDomainItem={onSelectDomainItem}
          onOpenProject={onOpenProject}
          onProjectCreated={(project) => onNewChatInProject(project)}
          onProjectUpdated={() => {}}
          onProjectRemoved={onProjectRemoved}
          onToggleSearch={onToggleSearch}
          onCloseSearch={onCloseSearch}
          onToggleActivity={onToggleActivity}
          onCloseActivity={onCloseActivity}
          sidebarMode={sidebarMode}
          onChangeSidebarMode={onChangeSidebarMode}
        />
      )}

      {!isCompact && leftSidebarOpen && (
        <SidebarResizeHandle
          side="left"
          label={locale.resizeLeftSidebar}
          dragging={dragging}
          snapped={dragCollapsed}
          onStartResize={onStartResize}
          onKeyResize={onKeyResize}
        />
      )}

      {/* 全局搜索弹窗与各业务浮层独立于左二栏折叠态挂载，确保侧栏收起时 Ctrl+K 与项目/会话弹窗仍可正常弹出。 */}
      {searchOpen && (
        <SearchDialog
          locale={locale}
          targets={searchTargets}
          chatProvider={chatProvider}
          onClose={onCloseSearch}
          onChoose={chooseSearchTarget}
        />
      )}
      {projectProvider?.renderProjectOverlays?.({
        sections,
        onCreateSection: (projectId) => sectionProvider?.openCreateDialog(projectId),
        onProjectUpdated: () => {},
        onProjectRemoved,
      })}
      {chatProvider?.renderSessionOverlays?.({ projects, sections })}
      {sectionProvider?.renderOverlays()}
    </>
  );
}