// 管理工作区“新聊天”与置顶、自定义分区、项目、最近聊天分组，并复用 SidebarSectionList 渲染。
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  WorkbenchChatProvider,
  WorkbenchChatSessionSummary,
  WorkbenchProjectProvider,
  WorkbenchSectionItem,
  WorkbenchSectionProvider,
} from "../../src/index";
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
import { NavigationIcon } from "./NavigationIcon";
import { SidebarSectionList, type SidebarGroupConfig, type SidebarItemConfig } from "./SidebarSectionList";
import styles from "./NavigationGroups.module.css";

function formatRelativeSessionAge(updatedAt?: number): string | undefined {
  if (!updatedAt || !Number.isFinite(updatedAt)) return undefined;
  const diffMs = Math.max(0, Date.now() - updatedAt);
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return mins < 1 ? "刚刚" : `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

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

  const toProjectSidebarItem = (project: LocalProject, groupKey: string): SidebarItemConfig => ({
    id: `${groupKey}:${project.id}`,
    label: project.name,
    icon: "project",
    expanded: projectExpanded[project.id] ?? true,
    active: activeProjectId === project.id,
    actionsVisible: projectProvider?.isProjectRowHighlighted?.(project.id) ?? false,
    draggableProjectId: project.id,
    onMouseEnter: (element) => projectProvider?.onProjectRowEnter?.(project, element),
    onMouseLeave: () => projectProvider?.onProjectRowLeave?.(project),
    onClick: () => {
      projectProvider?.closeProjectMenus?.();
      toggleProjectExpanded(project.id);
    },
    actions: projectProvider?.renderProjectRowActions?.({
      project,
      onNewChatInProject: (targetProject) => {
        setProjectExpanded((current) => ({ ...current, [targetProject.id]: true }));
        onNewChatInProject(targetProject);
      },
    }),
  });

  // 将会话条目转换为统一侧栏行（同时服务于“项目下子会话”与“最近”分组）
  const toSessionSidebarItem = (
    sessionObj: WorkbenchChatSessionSummary,
    opts?: { idPrefix?: string; nested?: boolean; hideIcon?: boolean },
  ): SidebarItemConfig => {
    const trailingHint = formatRelativeSessionAge(sessionObj.updatedAt);
    const actions = chatProvider?.renderSessionRowActions?.(sessionObj);
    return {
      id: `${opts?.idPrefix ?? ""}${sessionObj.id}`,
      label: sessionObj.title,
      icon: "newChat",
      ...(opts?.nested ? { nested: true } : {}),
      ...(opts?.hideIcon ? { hideIcon: true } : {}),
      active: activeView === "workspace" && activeChatSessionId === sessionObj.id,
      ...(sessionObj.unread ? { unread: true } : {}),
      ...(trailingHint ? { trailingHint } : {}),
      ...(actions ? { actions } : {}),
      actionsVisible: chatProvider?.isSessionRowHighlighted?.(sessionObj.id) ?? false,
      onMouseEnter: (element: HTMLElement) => chatProvider?.onSessionRowEnter?.(sessionObj, element),
      onMouseLeave: () => chatProvider?.onSessionRowLeave?.(sessionObj),
      onDoubleClick: () => chatProvider?.onSessionRowDoubleClick?.(sessionObj),
      onClick: () => {
        chatProvider?.closeSessionMenus?.();
        onSelectChatSession?.(sessionObj.id);
        void chatProvider?.openSession(sessionObj.id);
      },
    };
  };

  // 将项目及其所属的未归档聊天会话展开为“项目行 + 缩进子会话行”
  const toProjectWithChatsItems = (projectList: LocalProject[], groupKey: string): SidebarItemConfig[] =>
    projectList.flatMap((project) => {
      const isExpanded = projectExpanded[project.id] ?? true;
      const childSessions = isExpanded
        ? chatSessions.filter((s) => !s.archived && s.projectId === project.id)
        : [];
      return [
        toProjectSidebarItem(project, groupKey),
        ...childSessions.map((sessionObj) =>
          toSessionSidebarItem(sessionObj, {
            idPrefix: `${groupKey}:${project.id}:`,
            nested: true,
            hideIcon: true,
          }),
        ),
      ];
    });

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
      items: toProjectWithChatsItems(sectionProjects, `sec-${section.id}`),
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
      items: toProjectWithChatsItems(pinnedProjects, "pinned"),
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
      items: toProjectWithChatsItems(unassignedProjects, "project"),
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
      items: sortedRecents.map((item) => {
        const sessionObj = item.sessionId
          ? chatSessions.find((s) => s.id === item.sessionId)
          : undefined;
        const trailingHint = formatRelativeSessionAge(sessionObj?.updatedAt ?? item.updatedAt);
        const actions = sessionObj ? chatProvider?.renderSessionRowActions?.(sessionObj) : undefined;
        return {
          id: item.id,
          label: item.label,
          icon: "newChat" as const,
          active: item.active ?? (activeView === item.view && (item.projectId ?? null) === activeProjectId),
          ...(sessionObj?.unread ?? item.unread ? { unread: true } : {}),
          ...(trailingHint ? { trailingHint } : {}),
          ...(actions ? { actions } : {}),
          ...(sessionObj ? {
            actionsVisible: chatProvider?.isSessionRowHighlighted?.(sessionObj.id) ?? false,
            onMouseEnter: (element: HTMLElement) => chatProvider?.onSessionRowEnter?.(sessionObj, element),
            onMouseLeave: () => chatProvider?.onSessionRowLeave?.(sessionObj),
            onDoubleClick: () => chatProvider?.onSessionRowDoubleClick?.(sessionObj),
          } : {}),
          onClick: () => {
            if (item.onSelect) {
              item.onSelect();
              return;
            }
            if (item.projectId) {
              const project = projects.find((candidate) => candidate.id === item.projectId);
              if (project) onOpenProject(project);
            } else {
              onNavigate(item.view);
            }
          },
        };
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
          <button
            className={`${styles.newChat} ${newChatSelected ? styles.newChatActive : ""}`}
            type="button"
            aria-current={newChatSelected ? "page" : undefined}
            onClick={onNewChat}
          >
            <NavigationIcon name="newChat" />
            <span>{locale.newChat}</span>
          </button>
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
