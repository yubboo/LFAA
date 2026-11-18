// 定义 @lfaa/memory 的无 DOM 领域契约：会话消息、思考/行动/检查步骤轨迹及长期记忆条目。
export type AgentLoopPhase = "think" | "act" | "check";
export type AgentStepStatus = "running" | "waiting_approval" | "done" | "error";

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
  timestamp: number;
}

export interface ChatMessageRecord {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  reasoningDurationMs?: number;
  steps?: AgentStepTrace[];
  status?: "streaming" | "done" | "error" | "aborted";
  model?: string;
  createdAt: number;
}

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

export interface StorageMigrationResult {
  fromRoot: string;
  toRoot: string;
  copiedFiles: number;
  copiedBytes: number;
  verified: boolean;
  state: StorageConfigState;
  stats: StorageStats;
}
