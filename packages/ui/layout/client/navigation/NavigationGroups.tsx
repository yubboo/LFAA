// 管理工作区“新聊天”与置顶、自定义分区、项目、最近聊天分组，并复用 SidebarSectionList 渲染。
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  WorkbenchChatProvider,
  WorkbenchChatSessionSummary,
  WorkbenchProjectProvider,
  WorkbenchSectionItem,
  WorkbenchSectionProvider,
} from "../../contract/index";
import type { LocaleMessages } from "../locales";
import type { LocalProject, NavigationView, RecentItem } from "./navigation";
import {
  readNavGroupExpandedPref,
  readProjectSortPref,
  readRecentSortPref,
  readSectionExpandedPref,
  writeNavGroupExpandedPref,
  writeProjectSortPref,
  writeRecentSortPref,
  writeSectionExpandedPref,
  type BuiltinGroupName,
  type ProjectSortMode,
} from "../shell/ui-preferences";
import { GroupHeaderTools } from "./GroupHeaderTools";
import { buildProjectGroups, buildRecentGroup } from "./navigation-groups-config";
import {
  createRecentSidebarItems,
  groupNavigationProjects,
  resolveActiveGroupKey,
  type ProjectItemDeps,
  type SessionItemDeps,
} from "./navigation-items";
import { NavigationNewChatButton } from "./NavigationNewChatButton";
import { SidebarSectionList, type SidebarGroupConfig } from "../panels/SidebarSectionList";
import { useSessionWindow } from "./use-session-window";
import styles from "./NavigationGroups.module.css";

/** 组合置顶、项目和最近会话分组，由共享列表处理折叠和行展示。 */
export function NavigationGroups({
  locale,
  activeView,
  newChatSelected,
  activeProjectId,
  activeChatSessionId = null,
  projects,
  sections,
  recents,
  chatSessions = [],
  chatProvider,
  projectProvider,
  sectionProvider,
  onNewChat,
  onNewChatInProject,
  onNewChatInSection,
  onSelectChatSession,
  onNavigate,
  onOpenProject,
  onProjectCreated,
  onProjectUpdated,
  onProjectRemoved,
}: {
  locale: LocaleMessages;
  activeView: NavigationView;
  newChatSelected: boolean;
  activeProjectId: string | null;
  activeChatSessionId?: string | null | undefined;
  projects: LocalProject[];
  sections: WorkbenchSectionItem[];
  recents: RecentItem[];
  chatSessions?: WorkbenchChatSessionSummary[] | undefined;
  chatProvider?: WorkbenchChatProvider<ReactNode> | null | undefined;
  projectProvider?: WorkbenchProjectProvider<ReactNode> | null | undefined;
  sectionProvider?: WorkbenchSectionProvider<ReactNode> | null | undefined;
  onNewChat: () => void;
  onNewChatInProject: (project: LocalProject) => void;
  onNewChatInSection: (section: WorkbenchSectionItem) => void;
  onSelectChatSession?: ((sessionId: string) => void) | undefined;
  onNavigate: (view: NavigationView) => void;
  onOpenProject: (project: LocalProject) => void;
  onProjectCreated: (project: LocalProject) => void;
  onProjectUpdated: (project: LocalProject) => void;
  onProjectRemoved: (projectId: string) => void;
}) {
  const storedGroupsRef = useRef(readNavGroupExpandedPref());
  const hasExplicitPinnedPrefRef = useRef(typeof storedGroupsRef.current.pinned === "boolean");
  const [expanded, setExpanded] = useState<Record<BuiltinGroupName, boolean>>(() => ({
    pinned: storedGroupsRef.current.pinned ?? false,
    projects: storedGroupsRef.current.projects ?? true,
    recent: storedGroupsRef.current.recent ?? false,
  }));
  const [sectionExpanded, setSectionExpanded] = useState<Record<string, boolean>>(readSectionExpandedPref);
  const [projectExpanded, setProjectExpanded] = useState<Record<string, boolean>>({});
  // 项目子会话与「最近」分组的展开批次由会话窗口状态统一管理。
  const sessionWindow = useSessionWindow({
    expandLabel: locale.expandSessions,
    collapseLabel: locale.collapseSessions,
  });
  // 展开状态按行 id 记录：同一项目在「置顶」与「项目」各有一行时互不影响。
  const toggleProjectExpanded = (rowId: string) => {
    const nextExpanded = !(projectExpanded[rowId] ?? true);
    setProjectExpanded((current) => ({ ...current, [rowId]: nextExpanded }));
    if (!nextExpanded) sessionWindow.resetProject(rowId);
  };
  const expandProject = (rowId: string) => {
    setProjectExpanded((current) => ({ ...current, [rowId]: true }));
  };
  const [sort, setSort] = useState<ProjectSortMode>(readProjectSortPref);
  const [recentSort, setRecentSort] = useState<ProjectSortMode>(readRecentSortPref);
  const [openToolMenu, setOpenToolMenu] = useState<"projects" | "recent" | null>(null);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const recentFilterTriggerRef = useRef<HTMLButtonElement>(null);

  const sortedProjects = useMemo(() => [...projects].sort((left, right) =>
    sort === "name" ? left.name.localeCompare(right.name) : right.createdAt - left.createdAt,
  ), [projects, sort]);
  const sortedRecents = useMemo(() => (
    recentSort === "name"
      ? [...recents].sort((left, right) => left.label.localeCompare(right.label))
      : recents
  ), [recents, recentSort]);
  const sectionIds = useMemo(() => new Set(sections.map((section) => section.id)), [sections]);
  // 置顶只增加顶部快捷入口：置顶项目同时保留在「项目」或它所属的自定义分区里。
  const projectGroups = useMemo(
    () => groupNavigationProjects(sortedProjects, sectionIds),
    [sortedProjects, sectionIds],
  );
  const pinnedProjects = projectGroups.pinned;
  const unassignedProjects = projectGroups.unassigned;

  // 同一项目/会话会同时出现在「置顶」与原分组：只让用户最后点击的那一组显示选中态。
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null);
  const activeProject = useMemo(() => {
    const projectId = activeProjectId
      ?? chatSessions.find((session) => session.id === activeChatSessionId)?.projectId
      ?? null;
    return projectId ? sortedProjects.find((item) => item.id === projectId) ?? null : null;
  }, [activeChatSessionId, activeProjectId, chatSessions, sortedProjects]);
  const activeSessionPinned = useMemo(() => {
    const session = chatSessions.find((item) => item.id === activeChatSessionId);
    return Boolean(session?.pinned && !session.archived);
  }, [activeChatSessionId, chatSessions]);
  const resolvedActiveGroupKey = resolveActiveGroupKey(
    activeGroupKey,
    activeProject,
    sectionIds,
    { pinnedSession: activeSessionPinned },
  );

  // 侧栏行构建器所需的当前渲染状态与事件入口；`showActive` 决定该分组是否显示选中态。
  const createItemDeps = (showActive: boolean): ProjectItemDeps & SessionItemDeps => ({
    activeProjectId,
    activeView,
    activeChatSessionId,
    showActive,
    onRowActivate: setActiveGroupKey,
    chatProvider,
    projectProvider,
    onNewChatInProject,
    onSelectChatSession,
    attentionLabels: { approval: locale.awaitingApproval, question: locale.awaitingAnswer },
    isProjectExpanded: (rowId) => projectExpanded[rowId] ?? true,
    onToggleProjectExpanded: toggleProjectExpanded,
    onExpandProject: expandProject,
    onToggleProjectPin: (projectId) => {
      void projectProvider?.togglePinProject?.(projectId);
    },
    sessionVisibleCount: sessionWindow.projectVisibleCount,
    sessionListControl: sessionWindow.projectControl,
    pinProjectLabel: locale.pinProject,
    unpinProjectLabel: locale.unpinProject,
  });

  const updateBuiltinExpanded = (
    updater: (current: Record<BuiltinGroupName, boolean>) => Record<BuiltinGroupName, boolean>,
  ) => {
    setExpanded((current) => {
      const next = updater(current);
      writeNavGroupExpandedPref(
        hasExplicitPinnedPrefRef.current
          ? next
          : { projects: next.projects, recent: next.recent },
      );
      return next;
    });
  };

  const prevLoadedRef = useRef(Boolean(projectProvider?.hasLoaded?.()));
  const prevPinnedCountRef = useRef(pinnedProjects.length);

  useEffect(() => {
    const isLoaded = projectProvider?.hasLoaded ? projectProvider.hasLoaded() : true;
    const justHydrated = !prevLoadedRef.current && isLoaded;
    const pinnedIncreased = pinnedProjects.length > prevPinnedCountRef.current;

    if (justHydrated) {
      if (!hasExplicitPinnedPrefRef.current && pinnedProjects.length > 0) {
        hasExplicitPinnedPrefRef.current = true;
        updateBuiltinExpanded((current) => (current.pinned ? current : { ...current, pinned: true }));
      }
    } else if (isLoaded && pinnedIncreased) {
      hasExplicitPinnedPrefRef.current = true;
      updateBuiltinExpanded((current) => (current.pinned ? current : { ...current, pinned: true }));
    }

    prevLoadedRef.current = isLoaded;
    prevPinnedCountRef.current = pinnedProjects.length;
  }, [pinnedProjects.length, projectProvider]);

  useEffect(() => {
    if (!openToolMenu) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpenToolMenu(null);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    return () => document.removeEventListener("pointerdown", closeOnOutside);
  }, [openToolMenu]);

  const toggleBuiltin = (group: BuiltinGroupName) => {
    if (group === "pinned") hasExplicitPinnedPrefRef.current = true;
    updateBuiltinExpanded((current) => ({ ...current, [group]: !current[group] }));
  };

  const toggleCustomSection = (sectionId: string) => {
    setSectionExpanded((current) => {
      const next = { ...current, [sectionId]: !(current[sectionId] ?? true) };
      writeSectionExpandedPref(next);
      return next;
    });
  };

  const changeSort = (nextSort: ProjectSortMode) => {
    setSort(nextSort);
    writeProjectSortPref(nextSort);
    setOpenToolMenu(null);
  };

  const changeRecentSort = (nextSort: ProjectSortMode) => {
    setRecentSort(nextSort);
    writeRecentSortPref(nextSort);
    setOpenToolMenu(null);
  };

  const handleCreated = (project: LocalProject) => {
    updateBuiltinExpanded((current) => ({ ...current, projects: true }));
    setProjectDialogOpen(false);
    onProjectCreated(project);
  };

  const handleDropToPinned = (projectId: string) => {
    const project = projects.find((item) => item.id === projectId);
    if (!project || project.pinned) return;
    hasExplicitPinnedPrefRef.current = true;
    updateBuiltinExpanded((current) => ({ ...current, pinned: true }));
    void projectProvider?.togglePinProject?.(projectId);
  };

  const handleDropToCustomSection = (projectId: string, sectionId: string) => {
    void projectProvider?.assignProjectSection?.(projectId, sectionId);
  };

  const handleDropToProjects = (projectId: string) => {
    const project = projects.find((item) => item.id === projectId);
    if (!project) return;
    // 置顶只是快捷入口，拖回「项目」分组不再顺带取消置顶，只把项目从自定义分区移出。
    if (project.sectionId) {
      void projectProvider?.assignProjectSection?.(projectId, null);
    }
  };

  const renderCreateDialog = projectProvider?.renderCreateDialog;
  const projectTools = (
    <GroupHeaderTools
      filterLabel={locale.filterProjects}
      sortByCreatedLabel={locale.sortByCreated}
      sortByNameLabel={locale.sortByName}
      triggerRef={filterTriggerRef}
      isMenuOpen={openToolMenu === "projects"}
      currentSort={sort}
      onToggleMenu={() => setOpenToolMenu((value) => (value === "projects" ? null : "projects"))}
      onSelectSort={changeSort}
      {...(renderCreateDialog
        ? { action: { label: locale.createProject, icon: "plus" as const, onClick: () => setProjectDialogOpen(true) } }
        : {})}
    />
  );

  const recentTools = (
    <GroupHeaderTools
      filterLabel={locale.filterRecent}
      sortByCreatedLabel={locale.sortByCreated}
      sortByNameLabel={locale.sortByName}
      triggerRef={recentFilterTriggerRef}
      isMenuOpen={openToolMenu === "recent"}
      currentSort={recentSort}
      onToggleMenu={() => setOpenToolMenu((value) => (value === "recent" ? null : "recent"))}
      onSelectSort={changeRecentSort}
      action={{ label: locale.newChat, icon: "newChat", onClick: onNewChat }}
    />
  );

  const projectGroupsConfig = buildProjectGroups({
    locale,
    pinnedProjects,
    unassignedProjects,
    sections,
    sectionProjects: projectGroups.inSection,
    chatSessions,
    expanded,
    sectionExpanded,
    resolvedActiveGroupKey,
    createItemDeps,
    projectTools,
    sectionTools: (section) => sectionProvider?.renderSectionTools?.({ section, onNewChatInSection }),
    canCreateProject: Boolean(renderCreateDialog),
    projectCount: sortedProjects.length,
    onCreateProject: () => setProjectDialogOpen(true),
    onToggleSection: toggleCustomSection,
    onToggleBuiltin: toggleBuiltin,
    onDropProjectToSection: handleDropToCustomSection,
    onDropProjectToPinned: handleDropToPinned,
    onDropProjectToProjects: handleDropToProjects,
  });

  const recentItems = createRecentSidebarItems(sortedRecents, {
    projects,
    chatSessions,
    activeView,
    activeProjectId,
    chatProvider,
    attentionLabels: { approval: locale.awaitingApproval, question: locale.awaitingAnswer },
    onOpenProject,
    onNavigate,
  });
  const groups: SidebarGroupConfig[] = [
    ...projectGroupsConfig,
    buildRecentGroup({
      locale,
      items: recentItems,
      expanded: expanded.recent,
      onToggle: () => toggleBuiltin("recent"),
      tools: recentTools,
      visibleCount: sessionWindow.recentVisibleCount(recentItems.length),
      control: sessionWindow.recentControl(recentItems.length),
    }),
  ];

  return (
    <div
      className={styles.root}
      ref={rootRef}
      onKeyDown={(event) => {
        if (event.key === "Escape" && openToolMenu) {
          event.stopPropagation();
          const activeMenu = openToolMenu;
          setOpenToolMenu(null);
          (activeMenu === "projects" ? filterTriggerRef : recentFilterTriggerRef).current?.focus();
        }
      }}
    >
      <SidebarSectionList
        ariaLabel={locale.sectionNavigation}
        topSlot={(
          <NavigationNewChatButton
            label={locale.newChat}
            selected={newChatSelected}
            onClick={onNewChat}
          />
        )}
        groups={groups}
      />

      {projectDialogOpen && renderCreateDialog?.({
        onCreated: handleCreated,
        onClose: () => setProjectDialogOpen(false),
      })}

      {projectProvider?.renderProjectOverlays?.({
        sections,
        onCreateSection: (projectId) => sectionProvider?.openCreateDialog(projectId),
        onProjectUpdated,
        onProjectRemoved,
      })}

      {chatProvider?.renderSessionOverlays?.({ projects, sections })}

      {sectionProvider?.renderOverlays()}
    </div>
  );
}
