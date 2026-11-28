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
  /** 内置「默认工作区」：目录取设置里的默认工作区路径，可二次确认整删。 */
  isDefault?: boolean;
  /** 项目领域类型："canvas" 为无限画布/短剧项目，"workspace"（或缺省）为代码/常规工作区项目。 */
  kind?: "workspace" | "canvas";
  /** 无限画布大厅分类文件夹 ID（仅 kind === "canvas" 使用）。 */
  canvasFolderId?: string | null;
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
  domain?: "plugins";
  render: () => TContent;
}

// 由业务插件贡献的新建标签入口，在当前项目的右侧工作台渲染。
export interface WorkbenchTabContribution<TContent = unknown> {
  id: string;
  title: { zh: string; en: string };
  render: (context: { projectId: string | null; isZh: boolean }) => TContent;
}

// 向全高右工作台插件传入同级辅助面板、项目上下文及抽屉关闭回调。
export interface WorkbenchContextPanelRenderContext<TContent = unknown> {
  utilityPanels: WorkbenchContextPanelContribution<TContent>[];
  projectContext: TContent | null;
  compact: boolean;
  rightPanelMaximized: boolean;
  /** 当前页面排版；「预览区在左」时工作台居中间列，图标轨与收起语义随之调整。 */
  layoutMode: "chat-center" | "preview-center";
  onToggleMaximizeRightPanel: () => void;
  onCollapseRightPanel: () => void;
  onCloseDrawer: () => void;
}

// 业务插件向 Shell 底部面板贡献的内容契约：v1 只有真实终端，标题由贡献方给。
export interface WorkbenchBottomPanelContribution<TContent = unknown> {
  id: string;
  title: string;
  /** 面板内容；契约层不引 React，由 Client 侧按 ReactNode 消费。 */
  render: () => TContent;
}

// 业务插件向右侧菜单栏贡献的上下文面板契约。
export interface WorkbenchContextPanelContribution<TContent = unknown> {
  id: string;
  title: string;
  order?: number;
  /** "card" 使用默认卡片与标题框；"workbench" 由插件接管顶部对齐 Tab 与全高 IDE 布局。 */
  chrome?: "card" | "workbench";
  /** "utility" 面板在主右区采用 "workbench" 模式时收纳进最右图标轨与辅助栏。 */
  placement?: "primary" | "utility";
  match?: (activeView: string, activeProjectId: string | null) => boolean;
  render: (context?: WorkbenchContextPanelRenderContext<TContent>) => TContent;
}

// 业务插件向左下角用户账户菜单头部右侧贡献快捷操作按钮的契约。
export interface WorkbenchAccountActionContribution<TContent = unknown> {
  id: string;
  order?: number;
  render: () => TContent;
}

// 业务插件向中央工作区顶栏（WorkspaceBar 右侧、紧邻右工作台左缘）贡献操作按钮的契约。
export interface WorkbenchWorkspaceActionContribution<TContent = unknown> {
  id: string;
  order?: number;
  render: (context: { compact: boolean; rightPanelOpen: boolean; rightPanelMaximized: boolean }) => TContent;
}

// 业务插件向顶栏标题右侧贡献轻量状态控件（如会话模式徽标）的契约；与右侧动作分开排序。
export interface WorkbenchTitleActionContribution<TContent = unknown> {
  id: string;
  order?: number;
  render: (context: { compact: boolean }) => TContent;
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
  /** 会话绑定的 Git 工作树摘要；旧会话缺省。 */
  worktree?: WorkbenchSessionWorktree;
  pinned?: boolean;
  archived?: boolean;
  unread?: boolean;
  /** 会话通知已静音；不显示待处理徽标、不播放该会话的提醒音。 */
  muted?: boolean;
  /** 客户端临时新会话草稿：未落库，只用于在项目下显示可返回的草稿行。 */
  draft?: boolean;
  /** 草稿正在收起：保留约一个动画时长后由聊天侧移除，让行高平滑退场。 */
  draftExiting?: boolean;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
}

/** 聊天全文搜索命中项：标题命中或某条消息命中。 */
export interface WorkbenchChatSearchResult {
  sessionId: string;
  sessionTitle: string;
  archived: boolean;
  projectId: string | null;
  messageId?: string;
  role?: "user" | "assistant";
  snippet: string;
  match: "title" | "message";
  updatedAt: number;
}

// 会话绑定的工作树摘要，供侧栏与输入框展示；路径由 Host 解析，客户端不可自行拼接。
export interface WorkbenchSessionWorktree {
  id: string;
  projectId: string;
  path: string;
  branch: string;
  repositoryRoot: string;
}

/** 规定工作台访问会话列表与会话动作的插件契约。 */
export interface WorkbenchChatProvider<TContent = unknown> {
  getSessions: () => WorkbenchChatSessionSummary[];
  getActiveSessionId: () => string | null;
  /** 当前新会话草稿已绑定的项目 id，供顶部「新聊天」在刷新或草稿改绑后继续沿用。 */
  getDraftProjectId?: () => string | null;
  /** 该会话是否有 Agent 正在工作；切到别的会话后仍为真，供左二栏显示工作转圈。 */
  isSessionRunning?: (sessionId: string) => boolean;
  /** 该会话是否在等待用户确认或回答；用于左二栏「待确认/待回答」徽标。 */
  getSessionAttention?: (sessionId: string) => "approval" | "question" | null;
  /** 搜索会话标题与消息正文；未提供时搜索框只展示功能与项目。 */
  searchChat?: (query: string) => Promise<WorkbenchChatSearchResult[]>;
  /** 没有活动会话时，把新聊天草稿的项目绑定切到指定项目；已打开的会话不受影响。 */
  setActiveProjectBinding?: (projectId: string | null) => void | Promise<void>;
  /** 打开会话并可选跳转到具体消息；用于搜索结果定位。 */
  openSessionMessage?: (sessionId: string, messageId?: string) => void | Promise<void>;
  subscribe: (listener: () => void) => () => void;
  startNewChat: (options?: {
    projectId?: string | null;
    sectionId?: string | null;
    /** 新会话草稿立即显示的工作树；发送时只提交 id 由 Host 解析。 */
    worktree?: WorkbenchSessionWorktree;
  }) => void | Promise<void>;
  openSession: (sessionId: string) => void | Promise<void>;
  onSessionRowEnter?: (session: WorkbenchChatSessionSummary, rowElement: HTMLElement) => void;
  onSessionRowLeave?: (session: WorkbenchChatSessionSummary) => void;
  onSessionRowDoubleClick?: (session: WorkbenchChatSessionSummary) => void;
  closeSessionMenus?: () => void;
  /** `rowKey` 标识具体侧栏行：同一会话可能同时出现在「置顶」与「项目」分组，只高亮被交互的那一行。 */
  isSessionRowHighlighted?: (sessionId: string, rowKey?: string) => boolean;
  renderSessionRowActions?: (session: WorkbenchChatSessionSummary) => TContent;
  renderSessionOverlays?: (params: {
    projects: WorkbenchProjectItem[];
    sections: WorkbenchSectionItem[];
  }) => TContent;
  /**
   * 左二「项目工作区」内容：工作区文件树由聊天插件提供，
   * 布局包因此不必依赖其 store、HTTP 接口与展开状态持久化实现。
   */
  renderProjectWorkspace?: (params: { projectId: string | null; compact: boolean }) => TContent;
}

// 项目提供方插件契约，使侧栏与 Shell 无需直接依赖具体项目 UI、弹窗或存储包。
export interface WorkbenchProjectProvider<TContent = unknown> {
  getProjects: () => WorkbenchProjectItem[];
  /** 打开项目详情视图；双击项目行或菜单入口使用。 */
  openProject?: (projectId: string) => void;
  hasLoaded?: () => boolean;
  subscribe: (listener: () => void) => () => void;
  renderCreateDialog: (params: {
    onCreated: (project: WorkbenchProjectItem) => void;
    onClose: () => void;
  }) => TContent;
  /** 一键在默认目录或平级画布目录快速新建项目并同步到左二栏，供无限画布等入口零摩擦创建。 */
  quickCreateProject?: (baseName?: string, options?: { kind?: "workspace" | "canvas"; canvasFolderId?: string | null }) => Promise<WorkbenchProjectItem>;
  /** 重命名项目并同步左二栏。 */
  renameProject?: (projectId: string, name: string) => Promise<WorkbenchProjectItem>;
  /** 删除项目并同步左二栏。 */
  removeProject?: (projectId: string) => Promise<boolean>;
  /** 打开整删默认工作区的二次确认弹窗（与左二栏「删除工作区」共用同一确认流）。 */
  requestDeleteWorkspace?: (projectId: string) => void;
  /** 强制刷新项目列表（如回收站恢复项目后立即同步左二栏）。 */
  refreshProjects?: () => Promise<void>;
  assignProjectSection?: (projectId: string, sectionId: string | null) => void | Promise<void>;
  /** 更新画布项目所属的画布大厅分类文件夹。 */
  assignCanvasFolder?: (projectId: string, folderId: string | null) => void | Promise<void>;
  togglePinProject?: (projectId: string) => void | Promise<void>;
  onProjectRowEnter?: (project: WorkbenchProjectItem, rowElement: HTMLElement) => void;
  onProjectRowLeave?: (project: WorkbenchProjectItem) => void;
  closeProjectMenus?: () => void;
  /** `rowKey` 标识具体侧栏行：同一项目可能同时出现在「置顶」与「项目」分组，只高亮被交互的那一行。 */
  isProjectRowHighlighted?: (projectId: string, rowKey?: string) => boolean;
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

/** 快捷键动作分组：全局壳层、导航、会话、右栏工作台。 */
export type WorkbenchShortcutGroup = "global" | "navigation" | "session" | "workbench";

/** 快捷键文案：注册方同时给出中英文，设置页与菜单按当前语言取用。 */
export interface WorkbenchShortcutText {
  zh: string;
  en: string;
}

/** 插件注册的真实快捷键动作；run 与界面按钮共用同一实现，不注册不存在的功能。 */
export interface WorkbenchShortcutContribution {
  id: string;
  group: WorkbenchShortcutGroup;
  title: WorkbenchShortcutText;
  description: WorkbenchShortcutText;
  /** 默认键位；null 表示默认不分配。 */
  defaultKeys: string | null;
  run: () => void;
}

/** 设置页与右键菜单共用的快捷键快照：动作元数据 + 当前生效键位。 */
export interface WorkbenchShortcutState {
  id: string;
  group: WorkbenchShortcutGroup;
  title: WorkbenchShortcutText;
  description: WorkbenchShortcutText;
  keys: string | null;
  defaultKeys: string | null;
}
