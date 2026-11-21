// 侧栏导航行构建器：把项目、会话与最近记录转换为 SidebarSectionList 的统一行配置，不持有 React 状态。
import type { ReactNode } from "react";
import type {
  WorkbenchChatProvider,
  WorkbenchChatSessionSummary,
  WorkbenchProjectProvider,
} from "../../contract/index";
import type { LocalProject, NavigationView, RecentItem } from "../navigation";
import type { SessionListControl } from "./session-list-paging";
import type { SidebarItemConfig } from "./SidebarSectionList";

/** 把会话更新时间格式化为「刚刚 / 12m / 3h / 2d」的短提示，无有效时间时不显示。 */
export function formatRelativeSessionAge(updatedAt?: number): string | undefined {
  if (!updatedAt || !Number.isFinite(updatedAt)) return undefined;
  const diffMs = Math.max(0, Date.now() - updatedAt);
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return mins < 1 ? "刚刚" : `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

/** 项目行与项目下子会话行共享的上下文与事件入口，由 NavigationGroups 注入。 */
export interface ProjectItemDeps {
  activeProjectId: string | null;
  /** 当前分组是否显示选中态：同一项目会出现在多个分组，只有用户点击的那个分组高亮。 */
  showActive: boolean;
  onRowActivate: (groupKey: string) => void;
  /** 展开状态按具体行 id 记录：置顶与项目两份副本各自展开/收起。 */
  isProjectExpanded: (rowId: string) => boolean;
  projectProvider?: WorkbenchProjectProvider<ReactNode> | null | undefined;
  onNewChatInProject: (project: LocalProject) => void;
  onToggleProjectExpanded: (rowId: string) => void;
  onExpandProject: (rowId: string) => void;
  /** 点击行内图钉切换置顶状态。 */
  onToggleProjectPin: (projectId: string) => void;
  /** 未置顶时图钉按钮的提示文案。 */
  pinProjectLabel: string;
  /** 已置顶时图钉按钮的提示文案。 */
  unpinProjectLabel: string;
  /** 项目行下子会话的显示条数；省略时不截断。 */
  sessionVisibleCount?: ((rowId: string, total: number) => number) | undefined;
  /** 项目行末尾的展开/收起控件；会话数不超过一批时返回 null。 */
  sessionListControl?: ((rowId: string, total: number) => SessionListControl | null) | undefined;
}

/** 会话行共享的上下文与事件入口，由 NavigationGroups 注入。 */
export interface SessionItemDeps {
  activeView: NavigationView;
  activeChatSessionId: string | null;
  /** 当前分组是否显示选中态：同一会话会出现在多个分组，只有用户点击的那个分组高亮。 */
  showActive: boolean;
  onRowActivate: (groupKey: string) => void;
  chatProvider?: WorkbenchChatProvider<ReactNode> | null | undefined;
  onSelectChatSession?: ((sessionId: string) => void) | undefined;
  /** 待确认/待回答徽标文案，由 Shell 按当前语言注入。 */
  attentionLabels?: { approval: string; question: string } | undefined;
}

/** 徽标文案兜底：布局层未注入语言字典时仍避免显示空徽标。 */
const DEFAULT_ATTENTION_LABELS = { approval: "待确认", question: "待回答" } as const;

/** 会话行的可选展示形态：前缀、缩进、图标隐藏与所属分组键。 */
export interface SessionItemOptions {
  idPrefix?: string;
  groupId?: string;
  nested?: boolean;
  hideIcon?: boolean;
}

/** 侧栏项目分组结果：置顶只是顶部快捷入口，项目本身仍保留在原来的分组里。 */
export interface NavigationProjectGroups {
  pinned: LocalProject[];
  unassigned: LocalProject[];
  inSection: (sectionId: string) => LocalProject[];
}

/** 按置顶与自定义分区切分项目；置顶不把项目从「项目」或所属分区里移走。 */
export function groupNavigationProjects(
  projects: LocalProject[],
  sectionIds: ReadonlySet<string>,
): NavigationProjectGroups {
  return {
    pinned: projects.filter((item) => item.pinned),
    unassigned: projects.filter((item) => !item.sectionId || !sectionIds.has(item.sectionId)),
    inSection: (sectionId) => projects.filter((item) => item.sectionId === sectionId),
  };
}

/** 生成自定义分区的行分组键，供行 id 与选中态解析共用。 */
export function sectionGroupKey(sectionId: string): string {
  return `sec-${sectionId}`;
}

/** 选出要单独出现在「置顶」分组的会话：已置顶、未归档，且所属项目尚未在置顶分组里带出会话。 */
export function selectPinnedSessions(
  chatSessions: WorkbenchChatSessionSummary[],
  pinnedProjectIds: ReadonlySet<string>,
): WorkbenchChatSessionSummary[] {
  return chatSessions
    .filter((session) => session.pinned && !session.archived)
    .filter((session) => !session.projectId || !pinnedProjectIds.has(session.projectId))
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

/** 列出项目在左二栏出现的分组键，顺序为「置顶 → 所属分区 → 项目」。 */
export function projectGroupKeys(project: LocalProject, sectionIds: ReadonlySet<string>): string[] {
  const keys: string[] = [];
  if (project.pinned) keys.push("pinned");
  if (project.sectionId && sectionIds.has(project.sectionId)) keys.push(sectionGroupKey(project.sectionId));
  keys.push("project");
  return keys;
}

/** 解析应显示选中态的分组：优先用户最后点击的分组，否则回退到项目首次出现的分组。 */
export function resolveActiveGroupKey(
  activeGroupKey: string | null,
  project: LocalProject | null,
  sectionIds: ReadonlySet<string>,
  options: { pinnedSession?: boolean } = {},
): string | null {
  const keys = project ? projectGroupKeys(project, sectionIds) : [];
  // 已置顶的会话在「置顶」分组里有独立入口，即使它属于未置顶项目也应能高亮那里。
  if (options.pinnedSession && !keys.includes("pinned")) keys.unshift("pinned");
  if (keys.length === 0) return null;
  return activeGroupKey && keys.includes(activeGroupKey) ? activeGroupKey : keys[0] ?? null;
}

/** 构建单个项目行；点击行为保持「关闭项目菜单并折叠/展开子会话」。 */
export function createProjectSidebarItem(
  project: LocalProject,
  groupKey: string,
  deps: ProjectItemDeps,
): SidebarItemConfig {
  const rowId = `${groupKey}:${project.id}`;
  const pinned = Boolean(project.pinned);
  return {
    id: rowId,
    label: project.name,
    icon: "project",
    // 每行都带图钉：已置顶用强调色，未置顶保持中性色，点击即可切换。
    pinned,
    pinLabel: pinned ? deps.unpinProjectLabel : deps.pinProjectLabel,
    onTogglePin: () => deps.onToggleProjectPin(project.id),
    expanded: deps.isProjectExpanded(rowId),
    active: deps.showActive && deps.activeProjectId === project.id,
    actionsVisible: deps.projectProvider?.isProjectRowHighlighted?.(project.id, rowId) ?? false,
    draggableProjectId: project.id,
    onMouseEnter: (element) => deps.projectProvider?.onProjectRowEnter?.(project, element),
    onMouseLeave: () => deps.projectProvider?.onProjectRowLeave?.(project),
    onClick: () => {
      deps.onRowActivate(groupKey);
      deps.projectProvider?.closeProjectMenus?.();
      deps.onToggleProjectExpanded(rowId);
    },
    actions: deps.projectProvider?.renderProjectRowActions?.({
      project,
      onNewChatInProject: (targetProject) => {
        deps.onExpandProject(rowId);
        deps.onNewChatInProject(targetProject);
      },
    }),
  };
}

/** 构建单个会话行，同时服务于「项目下子会话」与「最近」分组。 */
export function createSessionSidebarItem(
  sessionObj: WorkbenchChatSessionSummary,
  deps: SessionItemDeps,
  opts?: SessionItemOptions,
): SidebarItemConfig {
  const trailingHint = formatRelativeSessionAge(sessionObj.updatedAt);
  const actions = deps.chatProvider?.renderSessionRowActions?.(sessionObj);
  const rowId = `${opts?.idPrefix ?? ""}${sessionObj.id}`;
  // Agent 还在该会话里工作时，把左侧铅笔换成转圈；切走会话后依然可见。
  const working = deps.chatProvider?.isSessionRunning?.(sessionObj.id) ?? false;
  const isActive = deps.showActive && deps.activeView === "workspace" && deps.activeChatSessionId === sessionObj.id;
  // 状态互斥：进行中只转圈，完成后才亮未读点；需要确认/回答时用徽标替代完成点。
  const attention = isActive ? null : deps.chatProvider?.getSessionAttention?.(sessionObj.id) ?? null;
  const showUnread = !working && !isActive && !attention && Boolean(sessionObj.unread);
  return {
    id: rowId,
    label: sessionObj.title,
    icon: working ? "working" : "newChat",
    ...(opts?.nested ? { nested: true } : {}),
    ...(opts?.hideIcon && !working ? { hideIcon: true } : {}),
    active: isActive,
    ...(showUnread ? { unread: true } : {}),
    ...(attention ? { attention, attentionLabel: (deps.attentionLabels ?? DEFAULT_ATTENTION_LABELS)[attention] } : {}),
    ...(trailingHint && !attention ? { trailingHint } : {}),
    ...(actions ? { actions } : {}),
    actionsVisible: deps.chatProvider?.isSessionRowHighlighted?.(sessionObj.id, rowId) ?? false,
    onMouseEnter: (element: HTMLElement) => deps.chatProvider?.onSessionRowEnter?.(sessionObj, element),
    onMouseLeave: () => deps.chatProvider?.onSessionRowLeave?.(sessionObj),
    onDoubleClick: () => deps.chatProvider?.onSessionRowDoubleClick?.(sessionObj),
    onClick: () => {
      if (opts?.groupId) deps.onRowActivate(opts.groupId);
      deps.chatProvider?.closeSessionMenus?.();
      deps.onSelectChatSession?.(sessionObj.id);
      void deps.chatProvider?.openSession(sessionObj.id);
    },
  };
}

/** 把会话窗口控件转换为侧栏末尾的整行按钮，项目内缩进与子会话文字对齐。 */
export function createSessionWindowItem(
  id: string,
  control: SessionListControl,
  nested = false,
): SidebarItemConfig {
  return {
    id,
    label: control.label,
    icon: "chevronDown",
    ...(nested ? { nested: true } : {}),
    hideIcon: true,
    control: true,
    expanded: control.expanded,
    onClick: control.onClick,
  };
}

/** 将项目及其所属的未归档聊天会话展开为「项目行 + 缩进子会话行」。 */
export function createProjectWithChatItems(
  projectList: LocalProject[],
  groupKey: string,
  chatSessions: WorkbenchChatSessionSummary[],
  deps: ProjectItemDeps & SessionItemDeps,
): SidebarItemConfig[] {
  return projectList.flatMap((project) => {
    const rowId = `${groupKey}:${project.id}`;
    const isExpanded = deps.isProjectExpanded(rowId);
    const childSessions = isExpanded
      ? chatSessions.filter((s) => !s.archived && s.projectId === project.id)
      : [];
    // 子会话超过一批时只渲染窗口内的行，末尾追加「展开其余 / 收起」控件。
    const visibleCount = deps.sessionVisibleCount?.(rowId, childSessions.length);
    const visibleSessions = visibleCount === undefined
      ? childSessions
      : childSessions.slice(0, Math.max(0, visibleCount));
    const control = isExpanded ? deps.sessionListControl?.(rowId, childSessions.length) ?? null : null;
    return [
      createProjectSidebarItem(project, groupKey, deps),
      ...visibleSessions.map((sessionObj) =>
        createSessionSidebarItem(sessionObj, deps, {
          idPrefix: `${groupKey}:${project.id}:`,
          groupId: groupKey,
          nested: true,
          hideIcon: true,
        }),
      ),
      ...(control ? [createSessionWindowItem(`${rowId}:session-window`, control, true)] : []),
    ];
  });
}

/** 构建「最近」分组行所需的上下文，包含跳转与行内操作来源。 */
export interface RecentItemDeps {
  projects: LocalProject[];
  chatSessions: WorkbenchChatSessionSummary[];
  activeView: NavigationView;
  activeProjectId: string | null;
  chatProvider?: WorkbenchChatProvider<ReactNode> | null | undefined;
  onOpenProject: (project: LocalProject) => void;
  onNavigate: (view: NavigationView) => void;
  /** 待确认/待回答徽标文案，由 Shell 按当前语言注入。 */
  attentionLabels?: { approval: string; question: string } | undefined;
}

/** 构建「最近」分组的行列表：优先沿用记录自带选择回调，其次按项目或视图跳转。 */
export function createRecentSidebarItems(recents: RecentItem[], deps: RecentItemDeps): SidebarItemConfig[] {
  return recents.map((item) => {
    const sessionObj = item.sessionId
      ? deps.chatSessions.find((s) => s.id === item.sessionId)
      : undefined;
    const trailingHint = formatRelativeSessionAge(sessionObj?.updatedAt ?? item.updatedAt);
    const actions = sessionObj ? deps.chatProvider?.renderSessionRowActions?.(sessionObj) : undefined;
    const working = sessionObj ? deps.chatProvider?.isSessionRunning?.(sessionObj.id) ?? false : false;
    const isActive = item.active ?? (deps.activeView === item.view && (item.projectId ?? null) === deps.activeProjectId);
    const attention = isActive ? null : (sessionObj ? deps.chatProvider?.getSessionAttention?.(sessionObj.id) ?? null : null);
    // 与项目/置顶行同一套状态：进行中隐藏未读点，需要确认/回答时用徽标替代完成点。
    const showUnread = !working && !isActive && !attention && Boolean(sessionObj?.unread ?? item.unread);
    return {
      id: item.id,
      label: item.label,
      icon: working ? "working" as const : "newChat" as const,
      active: isActive,
      ...(showUnread ? { unread: true } : {}),
      ...(attention ? { attention, attentionLabel: (deps.attentionLabels ?? DEFAULT_ATTENTION_LABELS)[attention] } : {}),
      ...(trailingHint && !attention ? { trailingHint } : {}),
      ...(actions ? { actions } : {}),
      ...(sessionObj ? {
        actionsVisible: deps.chatProvider?.isSessionRowHighlighted?.(sessionObj.id, item.id) ?? false,
        onMouseEnter: (element: HTMLElement) => deps.chatProvider?.onSessionRowEnter?.(sessionObj, element),
        onMouseLeave: () => deps.chatProvider?.onSessionRowLeave?.(sessionObj),
        onDoubleClick: () => deps.chatProvider?.onSessionRowDoubleClick?.(sessionObj),
      } : {}),
      onClick: () => {
        if (item.onSelect) {
          item.onSelect();
          return;
        }
        if (item.projectId) {
          const project = deps.projects.find((candidate) => candidate.id === item.projectId);
          if (project) deps.onOpenProject(project);
        } else {
          deps.onNavigate(item.view);
        }
      },
    };
  });
}
