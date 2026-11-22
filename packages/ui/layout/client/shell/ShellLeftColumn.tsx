// 组合四栏 Shell 左栏：一级图标栏、窄屏抽屉遮罩、左二导航侧栏与宽度拖拽手柄。
import type { KeyboardEvent, PointerEvent } from "react";
import type { WorkbenchSectionItem } from "../../contract/index";
import type { LocaleMessages } from "../locales";
import type { LocalProject, NavigationView, RecentItem, WorkspaceMode } from "../navigation/navigation";
import type { ResizeSide } from "./useSidebarResize";
import { buildChatRecentItems, type WorkbenchDomainConfig } from "../navigation/workbench-domains";
import type { LibraryTabKey, WorkbenchSnapshot } from "../workbench-service";
import { NavigationRail } from "../navigation/NavigationRail";
import { NavigationSidebar } from "../navigation/NavigationSidebar";
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
  onBackdropClick,
  onCloseDrawer,
  onModeChange,
  onNewChat,
  onNewChatInProject,
  onNewChatInSection,
  onSelectChatSession,
  onSelectLibraryTab,
  onSelectDomainItem,
  onOpenProject,
  onProjectRemoved,
  onToggleSearch,
  onCloseSearch,
  onToggleActivity,
  onCloseActivity,
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
  onBackdropClick: () => void;
  onCloseDrawer: () => void;
  onModeChange: (mode: WorkspaceMode) => void;
  onNewChat: () => void;
  onNewChatInProject: (project: LocalProject) => void;
  onNewChatInSection: (section: WorkbenchSectionItem) => void;
  onSelectChatSession: () => void;
  onSelectLibraryTab: (tab: LibraryTabKey) => void;
  onSelectDomainItem: (id: string) => void;
  onOpenProject: (project: LocalProject) => void;
  onProjectRemoved: (projectId: string) => void;
  onToggleSearch: () => void;
  onCloseSearch: () => void;
  onToggleActivity: () => void;
  onCloseActivity: () => void;
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
          onNewChatInSection={onNewChatInSection}
          onSelectChatSession={onSelectChatSession}
          onNavigate={onNavigate}
          onSelectLibraryTab={onSelectLibraryTab}
          onSelectDomainItem={onSelectDomainItem}
          onOpenProject={onOpenProject}
          onProjectCreated={onOpenProject}
          onProjectUpdated={() => {}}
          onProjectRemoved={onProjectRemoved}
          onToggleSearch={onToggleSearch}
          onCloseSearch={onCloseSearch}
          onToggleActivity={onToggleActivity}
          onCloseActivity={onCloseActivity}
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
    </>
  );
}