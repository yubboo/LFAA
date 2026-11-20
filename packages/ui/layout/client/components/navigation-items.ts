// 侧栏导航行构建器：把项目、会话与最近记录转换为 SidebarSectionList 的统一行配置，不持有 React 状态。
import type { ReactNode } from "react";
import type {
  WorkbenchChatProvider,
  WorkbenchChatSessionSummary,
  WorkbenchProjectProvider,
} from "../../contract/index";
import type { LocalProject, NavigationView, RecentItem } from "../navigation";
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
  isProjectExpanded: (projectId: string) => boolean;
  projectProvider?: WorkbenchProjectProvider<ReactNode> | null | undefined;
  onNewChatInProject: (project: LocalProject) => void;
  onToggleProjectExpanded: (projectId: string) => void;
  onExpandProject: (projectId: string) => void;
}

/** 会话行共享的上下文与事件入口，由 NavigationGroups 注入。 */
export interface SessionItemDeps {
  activeView: NavigationView;
  activeChatSessionId: string | null;
  chatProvider?: WorkbenchChatProvider<ReactNode> | null | undefined;
  onSelectChatSession?: ((sessionId: string) => void) | undefined;
}

/** 会话行的可选展示形态：前缀、缩进与图标隐藏。 */
export interface SessionItemOptions {
  idPrefix?: string;
  nested?: boolean;
  hideIcon?: boolean;
}

/** 构建单个项目行；点击行为保持「关闭项目菜单并折叠/展开子会话」。 */
export function createProjectSidebarItem(
  project: LocalProject,
  groupKey: string,
  deps: ProjectItemDeps,
): SidebarItemConfig {
  return {
    id: `${groupKey}:${project.id}`,
    label: project.name,
    icon: "project",
    expanded: deps.isProjectExpanded(project.id),
    active: deps.activeProjectId === project.id,
    actionsVisible: deps.projectProvider?.isProjectRowHighlighted?.(project.id) ?? false,
    draggableProjectId: project.id,
    onMouseEnter: (element) => deps.projectProvider?.onProjectRowEnter?.(project, element),
    onMouseLeave: () => deps.projectProvider?.onProjectRowLeave?.(project),
    onClick: () => {
      deps.projectProvider?.closeProjectMenus?.();
      deps.onToggleProjectExpanded(project.id);
    },
    actions: deps.projectProvider?.renderProjectRowActions?.({
      project,
      onNewChatInProject: (targetProject) => {
        deps.onExpandProject(targetProject.id);
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
  return {
    id: `${opts?.idPrefix ?? ""}${sessionObj.id}`,
    label: sessionObj.title,
    icon: "newChat",
    ...(opts?.nested ? { nested: true } : {}),
    ...(opts?.hideIcon ? { hideIcon: true } : {}),
    active: deps.activeView === "workspace" && deps.activeChatSessionId === sessionObj.id,
    ...(sessionObj.unread ? { unread: true } : {}),
    ...(trailingHint ? { trailingHint } : {}),
    ...(actions ? { actions } : {}),
    actionsVisible: deps.chatProvider?.isSessionRowHighlighted?.(sessionObj.id) ?? false,
    onMouseEnter: (element: HTMLElement) => deps.chatProvider?.onSessionRowEnter?.(sessionObj, element),
    onMouseLeave: () => deps.chatProvider?.onSessionRowLeave?.(sessionObj),
    onDoubleClick: () => deps.chatProvider?.onSessionRowDoubleClick?.(sessionObj),
    onClick: () => {
      deps.chatProvider?.closeSessionMenus?.();
      deps.onSelectChatSession?.(sessionObj.id);
      void deps.chatProvider?.openSession(sessionObj.id);
    },
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
    const isExpanded = deps.isProjectExpanded(project.id);
    const childSessions = isExpanded
      ? chatSessions.filter((s) => !s.archived && s.projectId === project.id)
      : [];
    return [
      createProjectSidebarItem(project, groupKey, deps),
      ...childSessions.map((sessionObj) =>
        createSessionSidebarItem(sessionObj, deps, {
          idPrefix: `${groupKey}:${project.id}:`,
          nested: true,
          hideIcon: true,
        }),
      ),
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
}

/** 构建「最近」分组的行列表：优先沿用记录自带选择回调，其次按项目或视图跳转。 */
export function createRecentSidebarItems(recents: RecentItem[], deps: RecentItemDeps): SidebarItemConfig[] {
  return recents.map((item) => {
    const sessionObj = item.sessionId
      ? deps.chatSessions.find((s) => s.id === item.sessionId)
      : undefined;
    const trailingHint = formatRelativeSessionAge(sessionObj?.updatedAt ?? item.updatedAt);
    const actions = sessionObj ? deps.chatProvider?.renderSessionRowActions?.(sessionObj) : undefined;
    return {
      id: item.id,
      label: item.label,
      icon: "newChat" as const,
      active: item.active ?? (deps.activeView === item.view && (item.projectId ?? null) === deps.activeProjectId),
      ...(sessionObj?.unread ?? item.unread ? { unread: true } : {}),
      ...(trailingHint ? { trailingHint } : {}),
      ...(actions ? { actions } : {}),
      ...(sessionObj ? {
        actionsVisible: deps.chatProvider?.isSessionRowHighlighted?.(sessionObj.id) ?? false,
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
