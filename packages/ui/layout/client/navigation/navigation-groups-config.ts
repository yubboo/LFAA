// 组装左二栏「置顶 / 自定义分区 / 项目」三个分组配置，不持有 React 状态，选中态与拖放事件由调用方注入。
import type { ReactNode } from "react";
import type { WorkbenchChatSessionSummary, WorkbenchSectionItem } from "../../contract/index";
import type { LocaleMessages } from "../locales";
import type { LocalProject } from "./navigation";
import type { BuiltinGroupName } from "../shell/ui-preferences";
import {
  createProjectWithChatItems,
  createSessionSidebarItem,
  createSessionWindowItem,
  sectionGroupKey,
  selectPinnedSessions,
  type ProjectItemDeps,
  type SessionItemDeps,
} from "./navigation-items";
import type { SessionListControl } from "./session-list-paging";
import type { SidebarItemConfig, SidebarGroupConfig } from "../panels/SidebarSectionList";

/** 组装项目类分组所需的当前数据、选中分组与事件入口。 */
export interface ProjectGroupSource {
  locale: LocaleMessages;
  pinnedProjects: LocalProject[];
  unassignedProjects: LocalProject[];
  sections: WorkbenchSectionItem[];
  sectionProjects: (sectionId: string) => LocalProject[];
  chatSessions: WorkbenchChatSessionSummary[];
  expanded: Record<BuiltinGroupName, boolean>;
  sectionExpanded: Record<string, boolean>;
  /** 当前应显示选中态的分组键，其余分组的同名副本不高亮。 */
  resolvedActiveGroupKey: string | null;
  createItemDeps: (showActive: boolean) => ProjectItemDeps & SessionItemDeps;
  projectTools: ReactNode;
  sectionTools: (section: WorkbenchSectionItem) => ReactNode;
  canCreateProject: boolean;
  projectCount: number;
  onCreateProject: () => void;
  onToggleSection: (sectionId: string) => void;
  onToggleBuiltin: (group: BuiltinGroupName) => void;
  onDropProjectToSection: (projectId: string, sectionId: string) => void;
  onDropProjectToPinned: (projectId: string) => void;
  onDropProjectToProjects: (projectId: string) => void;
}

/** 生成置顶、自定义分区与项目分组；置顶分组只是同一批项目的快捷入口。 */
export function buildProjectGroups(source: ProjectGroupSource): SidebarGroupConfig[] {
  const pinnedProjectIds = new Set(source.pinnedProjects.map((project) => project.id));
  // 置顶会话单独成行；已置顶项目下已经带出会话，就不重复展示。
  const pinnedSessions = selectPinnedSessions(source.chatSessions, pinnedProjectIds);
  const pinnedDeps = source.createItemDeps(source.resolvedActiveGroupKey === "pinned");

  const customSectionGroups: SidebarGroupConfig[] = source.sections.map((section) => {
    const groupKey = sectionGroupKey(section.id);
    return {
      id: `section:${section.id}`,
      title: section.name,
      collapsible: true,
      isCustomSection: true,
      expanded: source.sectionExpanded[section.id] ?? true,
      onToggle: () => source.onToggleSection(section.id),
      tools: source.sectionTools(section),
      items: createProjectWithChatItems(
        source.sectionProjects(section.id),
        groupKey,
        source.chatSessions,
        source.createItemDeps(groupKey === source.resolvedActiveGroupKey),
      ),
      emptyText: source.locale.emptySectionDropHint,
      onDropProject: (projectId) => source.onDropProjectToSection(projectId, section.id),
    };
  });

  const projectItems = createProjectWithChatItems(
    source.unassignedProjects,
    "project",
    source.chatSessions,
    source.createItemDeps(source.resolvedActiveGroupKey === "project"),
  );
  const createAction = {
    label: source.locale.createNewProject,
    icon: "plus" as const,
    onClick: source.onCreateProject,
  };
  // 只有默认工作区时列表非空：把「创建新项目」放在末尾弱化显示，而不是空态大按钮。
  const showCreateEntry = source.canCreateProject && source.projectCount === 0;

  return [
    {
      id: "pinned",
      title: source.locale.pinned,
      collapsible: true,
      expanded: source.expanded.pinned,
      onToggle: () => source.onToggleBuiltin("pinned"),
      items: [
        ...createProjectWithChatItems(
          source.pinnedProjects,
          "pinned",
          source.chatSessions,
          pinnedDeps,
        ),
        ...pinnedSessions.map((session) => createSessionSidebarItem(session, pinnedDeps, {
          idPrefix: "pinned-session:",
          groupId: "pinned",
        })),
      ],
      emptyText: source.locale.noPinnedItems,
      onDropProject: source.onDropProjectToPinned,
    },
    ...customSectionGroups,
    {
      id: "projects",
      title: source.locale.projects,
      collapsible: true,
      expanded: source.expanded.projects,
      onToggle: () => source.onToggleBuiltin("projects"),
      tools: source.projectTools,
      items: projectItems,
      emptyText: !source.canCreateProject
        ? source.locale.projectsPluginMissing
        : source.projectCount === 0
          ? source.locale.noProjects
          : source.locale.allProjectsInSections,
      ...(showCreateEntry && projectItems.length > 0 ? { trailingAction: createAction } : {}),
      ...(showCreateEntry && projectItems.length === 0 ? { emptyAction: createAction } : {}),
      onDropProject: source.onDropProjectToProjects,
    },
  ];
}

/** 组装「最近」分组所需的行、折叠状态与已计算的会话窗口。 */
export interface RecentGroupSource {
  locale: LocaleMessages;
  items: SidebarItemConfig[];
  expanded: boolean;
  onToggle: () => void;
  tools: ReactNode;
  visibleCount: number;
  control: SessionListControl | null;
}

/** 只渲染窗口内的「最近」行，并在末尾追加展开/收起控件。 */
export function buildRecentGroup(source: RecentGroupSource): SidebarGroupConfig {
  return {
    id: "recent",
    title: source.locale.recent,
    collapsible: true,
    expanded: source.expanded,
    onToggle: source.onToggle,
    tools: source.tools,
    items: [
      ...source.items.slice(0, source.visibleCount),
      ...(source.control ? [createSessionWindowItem("recent:session-window", source.control)] : []),
    ],
    emptyText: source.locale.noRecentItems,
  };
}