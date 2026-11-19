// 定义 @lfaa/memory 的无 DOM 领域契约：会话消息、思考/行动/检查步骤轨迹及长期记忆条目。
export type AgentLoopPhase = "think" | "act" | "check";
export type AgentStepStatus = "preparing" | "running" | "waiting_approval" | "done" | "error";

/** 终端步骤可回看的命令与执行结果，未取得退出码时省略该字段。 */
export interface AgentCommandTrace {
  command: string;
  output?: string;
  exitCode?: number;
}

/** 持久保存工具成功写入时的变更范围，区别于工作区当前的 Git 差异。 */
export interface AgentFileChange {
  path: string;
  resolvedPath?: string;
  operation: "created" | "edited";
  firstLine: number;
  before: string;
  after: string;
  truncated: boolean;
}

export interface AgentStepTrace {
  id: string;
  iteration: number;
  phase: AgentLoopPhase;
  status: AgentStepStatus;
  title: string;
  detail?: string;
  toolCallId?: string;
  toolName?: string;
  permissionLevel?: "read" | "write" | "exec";
  argsPreview?: string;
  resultPreview?: string;
  addedLines?: number;
  removedLines?: number;
  textOffset?: number;
  modelStage?: "reasoning" | "replying";
  commandTrace?: AgentCommandTrace;
  fileChange?: AgentFileChange;
  timestamp: number;
}

/** 描述磁盘会话中的任意一条消息及其运行步骤。 */
export interface ChatMessageRecord {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  reasoningDurationMs?: number;
  runDurationMs?: number;
  progressText?: string;
  steps?: AgentStepTrace[];
  status?: "streaming" | "done" | "error" | "aborted";
  model?: string;
  createdAt: number;
}

/** 提供列表渲染所需的会话归属、标题与状态摘要。 */
export interface ChatSessionSummary {
  id: string;
  title: string;
  projectId: string | null;
  sectionId: string | null;
  pinned: boolean;
  archived: boolean;
  unread?: boolean;
  messageCount: number;
  summary?: string;
  createdAt: number;
  updatedAt: number;
}

/** 在摘要基础上携带消息内容，供 Host 恢复完整会话。 */
export interface ChatSessionRecord extends ChatSessionSummary {
  messages: ChatMessageRecord[];
}

export interface CreateSessionInput {
  title?: string;
  projectId?: string | null;
  sectionId?: string | null;
}

export interface UpdateSessionInput {
  title?: string;
  projectId?: string | null;
  sectionId?: string | null;
  pinned?: boolean;
  archived?: boolean;
  unread?: boolean;
  summary?: string;
}

/** 表示按项目或全局范围保存的可检索记忆条目。 */
export interface MemoryEntry {
  id: string;
  scope: "global" | "project";
  projectId: string | null;
  content: string;
  tags: string[];
  sourceSessionId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AddMemoryInput {
  scope?: "global" | "project";
  projectId?: string | null;
  content: string;
  tags?: string[];
  sourceSessionId?: string;
}

export type LibraryItemCategory = "artifact" | "asset";

/** 提供资料库索引中描述本地资产的公开元数据。 */
export interface LibraryAssetItem {
  id: string;
  category: LibraryItemCategory;
  title: string;
  fileName: string;
  relativePath: string;
  mimeType: string;
  sizeBytes: number;
  summary?: string;
  tags: string[];
  projectId: string | null;
  sourceSessionId?: string;
  sourceRunId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface SaveLibraryAssetInput {
  category: LibraryItemCategory;
  title: string;
  fileName: string;
  content: string;
  encoding?: "utf8" | "base64";
  mimeType?: string;
  summary?: string;
  tags?: string[];
  projectId?: string | null;
  sourceSessionId?: string;
  sourceRunId?: string;
}

export type StorageLocationMode = "default" | "project" | "custom";

/** 描述当前资料路径、位置模式与系统推荐路径。 */
export interface StorageConfigState {
  dataRoot: string;
  defaultDataRoot: string;
  recommendedProjectDataRoot: string;
  appDataRoot?: string;
  sessionsRoot?: string;
  mode: StorageLocationMode;
  updatedAt: number;
}

export interface StorageStats {
  dataRoot: string;
  memoryCount: number;
  sessionCount: number;
  artifactCount: number;
  assetCount: number;
  totalBytes: number;
}

/** 返回目录切换执行后的状态及迁移结果。 */
export interface StorageMigrationResult {
  fromRoot: string;
  toRoot: string;
  copiedFiles: number;
  copiedBytes: number;
  verified: boolean;
  state: StorageConfigState;
  stats: StorageStats;
}
