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
import type { LocalProject, NavigationView, RecentItem } from "../navigation";
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
} from "../ui-preferences";
import { GroupHeaderTools } from "./GroupHeaderTools";
import {
  createProjectWithChatItems,
  createRecentSidebarItems,
  type ProjectItemDeps,
  type SessionItemDeps,
} from "./navigation-items";
import { NavigationNewChatButton } from "./NavigationNewChatButton";
import { SidebarSectionList, type SidebarGroupConfig } from "./SidebarSectionList";
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
  const toggleProjectExpanded = (projectId: string) => {
    setProjectExpanded((current) => ({ ...current, [projectId]: !(current[projectId] ?? true) }));
  };
  const expandProject = (projectId: string) => {
    setProjectExpanded((current) => ({ ...current, [projectId]: true }));
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
  const pinnedProjects = useMemo(() => sortedProjects.filter((item) => item.pinned), [sortedProjects]);
  const unassignedProjects = useMemo(
    () => sortedProjects.filter((item) => !item.pinned && (!item.sectionId || !sectionIds.has(item.sectionId))),
    [sortedProjects, sectionIds],
  );

  // 侧栏行构建器所需的当前渲染状态与事件入口，供项目行、子会话行与最近分组复用。
  const itemDeps: ProjectItemDeps & SessionItemDeps = {
    activeProjectId,
    activeView,
    activeChatSessionId,
    chatProvider,
    projectProvider,
    onNewChatInProject,
    onSelectChatSession,
    isProjectExpanded: (projectId) => projectExpanded[projectId] ?? true,
    onToggleProjectExpanded: toggleProjectExpanded,
    onExpandProject: expandProject,
  };

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
    if (project.pinned) {
      void projectProvider?.togglePinProject?.(projectId);
    }
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

  const customSectionGroups: SidebarGroupConfig[] = sections.map((section) => {
    const sectionProjects = sortedProjects.filter((item) => !item.pinned && item.sectionId === section.id);
    return {
      id: `section:${section.id}`,
      title: section.name,
      collapsible: true,
      isCustomSection: true,
      expanded: sectionExpanded[section.id] ?? true,
      onToggle: () => toggleCustomSection(section.id),
      tools: sectionProvider?.renderSectionTools?.({
        section,
        onNewChatInSection,
      }),
      items: createProjectWithChatItems(sectionProjects, `sec-${section.id}`, chatSessions, itemDeps),
      emptyText: locale.emptySectionDropHint,
      onDropProject: (projectId) => handleDropToCustomSection(projectId, section.id),
    };
  });

  const groups: SidebarGroupConfig[] = [
    {
      id: "pinned",
      title: locale.pinned,
      collapsible: true,
      expanded: expanded.pinned,
      onToggle: () => toggleBuiltin("pinned"),
      items: createProjectWithChatItems(pinnedProjects, "pinned", chatSessions, itemDeps),
      emptyText: locale.noPinnedItems,
      onDropProject: handleDropToPinned,
    },
    ...customSectionGroups,
    {
      id: "projects",
      title: locale.projects,
      collapsible: true,
      expanded: expanded.projects,
      onToggle: () => toggleBuiltin("projects"),
      tools: projectTools,
      items: createProjectWithChatItems(unassignedProjects, "project", chatSessions, itemDeps),
      emptyText: !renderCreateDialog
        ? locale.projectsPluginMissing
        : pinnedProjects.length > 0 && sortedProjects.length === pinnedProjects.length
          ? locale.allProjectsPinned
          : locale.noProjects,
      ...(renderCreateDialog && sortedProjects.length === 0
        ? {
            emptyAction: {
              label: locale.createNewProject,
              icon: "plus" as const,
              onClick: () => setProjectDialogOpen(true),
            },
          }
        : {}),
      onDropProject: handleDropToProjects,
    },
    {
      id: "recent",
      title: locale.recent,
      collapsible: true,
      expanded: expanded.recent,
      onToggle: () => toggleBuiltin("recent"),
      tools: recentTools,
      items: createRecentSidebarItems(sortedRecents, {
        projects,
        chatSessions,
        activeView,
        activeProjectId,
        chatProvider,
        onOpenProject,
        onNavigate,
      }),
      emptyText: locale.noRecentItems,
    },
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
