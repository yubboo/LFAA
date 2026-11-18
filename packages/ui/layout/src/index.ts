// 声明四栏 Shell 的无 DOM 公共区域标识与跨包插件贡献契约，供 Host 与 Client 共同使用。
export const WORKBENCH_REGIONS = [
  "primary-navigation",
  "section-navigation",
  "workspace",
  "context-panel",
] as const;

/** 限定插件可注册面板内容的工作台区域。 */
export type WorkbenchRegion = (typeof WORKBENCH_REGIONS)[number];

// 业务插件注册的本地或远端项目摘要结构，不绑定具体存储或 React 实现。
export interface WorkbenchProjectItem {
  id: string;
  name: string;
  createdAt: number;
  description?: string;
  rootPath?: string;
  rootPaths?: string[];
  locationType?: "local" | "remote";
  trusted?: boolean;
  pinned?: boolean;
  sectionId?: string | null;
  chatCount?: number;
}

// 业务插件注册的自定义分区摘要结构。
export interface WorkbenchSectionItem {
  id: string;
  name: string;
  createdAt: number;
}

// 业务插件向中央工作区贡献的页面视图契约。
export interface WorkbenchViewContribution<TContent = unknown> {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  render: () => TContent;
}

// 业务插件向右侧菜单栏贡献的上下文面板契约。
export interface WorkbenchContextPanelContribution<TContent = unknown> {
  id: string;
  title: string;
  order?: number;
  match?: (activeView: string, activeProjectId: string | null) => boolean;
  render: () => TContent;
}

// 业务插件向左下角用户账户菜单头部右侧贡献快捷操作按钮的契约。
export interface WorkbenchAccountActionContribution<TContent = unknown> {
  id: string;
  order?: number;
  render: () => TContent;
}

// 分区提供方插件契约，由 @lfaa/sections 贡献并在左侧栏展示与管理自定义分区。
export interface WorkbenchSectionProvider<TContent = unknown> {
  getSections: () => WorkbenchSectionItem[];
  subscribe: (listener: () => void) => () => void;
  openCreateDialog: (assignProjectId?: string) => void;
  renderSectionTools?: (params: {
    section: WorkbenchSectionItem;
    onNewChatInSection: (section: WorkbenchSectionItem) => void;
  }) => TContent;
  renderOverlays: () => TContent;
}

/** 约定聊天插件向导航提供的会话摘要。 */
export interface WorkbenchChatSessionSummary {
  id: string;
  title: string;
  projectId: string | null;
  sectionId?: string | null;
  pinned?: boolean;
  archived?: boolean;
  unread?: boolean;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
}

/** 规定工作台访问会话列表与会话动作的插件契约。 */
export interface WorkbenchChatProvider<TContent = unknown> {
  getSessions: () => WorkbenchChatSessionSummary[];
  getActiveSessionId: () => string | null;
  subscribe: (listener: () => void) => () => void;
  startNewChat: (options?: { projectId?: string | null; sectionId?: string | null }) => void | Promise<void>;
  openSession: (sessionId: string) => void | Promise<void>;
  onSessionRowEnter?: (session: WorkbenchChatSessionSummary, rowElement: HTMLElement) => void;
  onSessionRowLeave?: (session: WorkbenchChatSessionSummary) => void;
  onSessionRowDoubleClick?: (session: WorkbenchChatSessionSummary) => void;
  closeSessionMenus?: () => void;
  isSessionRowHighlighted?: (sessionId: string) => boolean;
  renderSessionRowActions?: (session: WorkbenchChatSessionSummary) => TContent;
  renderSessionOverlays?: (params: {
    projects: WorkbenchProjectItem[];
    sections: WorkbenchSectionItem[];
  }) => TContent;
}

// 项目提供方插件契约，使侧栏与 Shell 无需直接依赖具体项目 UI、弹窗或存储包。
export interface WorkbenchProjectProvider<TContent = unknown> {
  getProjects: () => WorkbenchProjectItem[];
  hasLoaded?: () => boolean;
  subscribe: (listener: () => void) => () => void;
  renderCreateDialog: (params: {
    onCreated: (project: WorkbenchProjectItem) => void;
    onClose: () => void;
  }) => TContent;
  assignProjectSection?: (projectId: string, sectionId: string | null) => void | Promise<void>;
  togglePinProject?: (projectId: string) => void | Promise<void>;
  onProjectRowEnter?: (project: WorkbenchProjectItem, rowElement: HTMLElement) => void;
  onProjectRowLeave?: (project: WorkbenchProjectItem) => void;
  closeProjectMenus?: () => void;
  isProjectRowHighlighted?: (projectId: string) => boolean;
  renderProjectRowActions?: (params: {
    project: WorkbenchProjectItem;
    onNewChatInProject: (project: WorkbenchProjectItem) => void;
  }) => TContent;
  renderProjectOverlays?: (params: {
    sections: WorkbenchSectionItem[];
    onCreateSection: (projectId?: string) => void;
    onProjectUpdated: (project: WorkbenchProjectItem) => void;
    onProjectRemoved: (projectId: string) => void;
  }) => TContent;
  renderProjectView: (project: WorkbenchProjectItem) => TContent;
  renderProjectContext?: (project: WorkbenchProjectItem) => TContent;
}
