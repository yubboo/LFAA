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
