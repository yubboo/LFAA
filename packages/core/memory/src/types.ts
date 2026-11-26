// @lfaa/memory 的领域契约：会话类型由 @lfaa/session 提供，资料库/存储类型由 @lfaa/storage 提供；本文件保留长期记忆条目。
export type {
  AgentCommandTrace,
  AgentFileChange,
  AgentLoopPhase,
  AgentRunCost,
  AgentRunMetrics,
  AgentStepStatus,
  AgentStepTrace,
  ChatMessageAttachment,
  ChatMessageRecord,
  ChatMessageReference,
  ChatSessionRecord,
  ChatSessionSummary,
  ChatTokenUsage,
  CreateSessionInput,
  PendingQuestion,
  SubagentStepPreview,
  TodoItem,
  TodoStatus,
  UpdateSessionInput,
} from "@lfaa/session";

export type {
  LibraryAssetItem,
  LibraryItemCategory,
  SaveLibraryAssetInput,
  StorageConfigState,
  StorageLocationMode,
  StorageMigrationResult,
  StorageStats,
} from "@lfaa/storage";

/** 记忆类型：偏好、事实、决策、坑、约定；缺省按事实处理，兼容旧条目。 */
export type MemoryKind = "preference" | "fact" | "decision" | "pitfall" | "convention";

/** 记忆作用域：全局、项目、团队（同一会话内共享）、会话、运行（仅本次 crew 执行内可见）。 */
export type MemoryScope = "global" | "project" | "team" | "session" | "run";

/** 记忆来源，供界面追溯与冲突判定。 */
export interface MemorySource {
  sessionId?: string;
  messageId?: string;
  toolName?: string;
  runId?: string;
}

/** 表示按项目或全局范围保存的可检索记忆条目。 */
export interface MemoryEntry {
  id: string;
  /** 记忆类型；旧条目缺省为 fact。 */
  kind: MemoryKind;
  scope: MemoryScope;
  projectId: string | null;
  /** team / session 的归属键是会话 ID；run 的归属键是 crew 运行 ID。 */
  ownerId: string | null;
  /** 写入者：main / subagent:research / group:xxx。 */
  agentId?: string;
  content: string;
  tags: string[];
  source?: MemorySource;
  /** 置信度 0–1，由提炼器或人工写入给出，只影响排序与去重。 */
  confidence: number;
  /** 被召回次数，用于命中加权。 */
  hits: number;
  lastUsedAt: number;
  /** 本条替代的旧条目 ID。 */
  supersedes?: string;
  /** 本条已被哪条新记忆替代；被替代后不再进入召回。 */
  supersededBy?: string;
  expiresAt?: number | null;
  createdAt: number;
  updatedAt: number;
  /** 旧字段：来源会话，读取时迁移为 source.sessionId。 */
  sourceSessionId?: string;
}

/** 写入一条长期记忆的输入。 */
export interface AddMemoryInput {
  kind?: MemoryKind;
  scope?: MemoryScope;
  projectId?: string | null;
  /** team / session / run 的归属键；team/session 用会话 ID，run 用运行 ID。 */
  ownerId?: string | null;
  agentId?: string;
  content: string;
  tags?: string[];
  confidence?: number;
  source?: MemorySource;
  /** 旧字段，等价于 source.sessionId。 */
  sourceSessionId?: string;
}

/** 长期记忆列表面向界面的过滤条件。 */
export interface ListMemoriesOptions {
  projectId?: string | null;
  sessionId?: string | null;
  /** run 作用域只在同一运行内可见；缺省不返回 run 条目。 */
  runId?: string | null;
  query?: string;
  kind?: MemoryKind;
  /** 是否包含已被替代的条目，界面审计需要，召回永远排除。 */
  includeSuperseded?: boolean;
}

/** 召回输入：查询、作用域上下文与预算。 */
export interface RecallMemoriesOptions {
  query: string;
  projectId?: string | null;
  sessionId?: string | null;
  /** crew 运行 ID：只有同一次运行的 run 记忆参与召回。 */
  runId?: string | null;
  limit?: number;
  budgetChars?: number;
}

/** 一条召回结果附带打分，便于调试与界面展示。 */
export interface RecalledMemory {
  entry: MemoryEntry;
  score: number;
}

/** 记忆库统计，供界面与迁移校验使用。 */
export interface MemoryStats {
  total: number;
  active: number;
  superseded: number;
  archived: number;
  byKind: Record<MemoryKind, number>;
}

/** 记忆行为的持久化设置，独立于资料库数据文件。 */
export interface MemorySettings {
  /** 每轮结束是否用模型提炼新记忆。 */
  autoExtract: boolean;
  /** 活跃条目上限，超出后最弱的条目归档。 */
  maxEntries: number;
  /** 每轮召回条数上限。 */
  recallLimit: number;
  /** 每轮召回注入的字符预算。 */
  recallBudgetChars: number;
}