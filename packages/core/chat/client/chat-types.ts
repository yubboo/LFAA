// 声明 @lfaa/chat/client 浏览器端状态与 API 数据模型（无 Node 专有依赖）。
import type { GeneralSettingsConfig, ReasoningLevelOption } from "./general-settings-client";

export type { GeneralSettingsConfig, OpenSourcePackageInfo, ReasoningLevelOption } from "./general-settings-client";
export type AgentPermissionMode = "ask" | "smart" | "full";
export type AgentPhase = "think" | "act" | "check";
export type AgentStepStatus = "running" | "waiting_approval" | "done" | "error";

export interface AgentStepItem {
  id: string;
  iteration: number;
  phase: AgentPhase;
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

export interface ChatMessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  reasoningDurationMs?: number;
  steps?: AgentStepItem[];
  status?: "streaming" | "done" | "error" | "aborted";
  model?: string;
  createdAt: number;
}

export interface ChatSessionItem {
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

export interface ChatSessionDetail extends ChatSessionItem {
  messages: ChatMessageItem[];
}

export interface ModelCapabilityItem {
  id: string;
  displayName?: string;
  supportsReasoning: boolean;
  reasoningMode: "none" | "fixed" | "effort";
  reasoningLevels: ReasoningLevelOption[];
  defaultReasoningLevel?: ReasoningLevelOption;
}

export type LlmApiProtocolOption =
  | "openai-chat"
  | "openai-responses"
  | "anthropic-messages"
  | "gemini-generate-content";

export interface PublicLlmProfileItem {
  id: string;
  providerId?: string;
  name: string;
  kind: "openai-compatible" | "deepseek" | "ollama";
  apiProtocol?: LlmApiProtocolOption;
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
  apiKeyMasked: string;
  configured: boolean;
  availableModels: ModelCapabilityItem[];
  temperature?: number;
  maxTokens?: number;
  updatedAt: number;
}

export interface RuleDocumentItem {
  id: string;
  layer: "system" | "project" | "user";
  title: string;
  source: string;
  content: string;
  readOnly: boolean;
}

export interface LongTermMemoryItem {
  id: string;
  scope: "global" | "project";
  projectId: string | null;
  content: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface PendingApprovalBanner {
  runId: string;
  approvalId: string;
  toolName: string;
  permissionLevel: "write" | "exec";
  argsPreview: string;
  permissionMode?: AgentPermissionMode;
  approvalPattern?: string;
  approvalCount?: number;
  approvalThreshold?: number;
  highRisk?: boolean;
  riskReason?: string;
}

export type LibraryItemCategory = "artifact" | "asset";
export type StorageLocationMode = "default" | "project" | "custom";

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

export interface ChatStoreSnapshot {
  loaded: boolean;
  sessions: ChatSessionItem[];
  activeSessionId: string | null;
  activeSession: ChatSessionDetail | null;
  draftProjectId: string | null;
  draftSectionId: string | null;
  runningRunId: string | null;
  queuedMessages: string[];
  pendingApproval: PendingApprovalBanner | null;
  permissionMode: AgentPermissionMode;
  smartTrustCounts: Record<string, number>;
  activeProfileId: string;
  profiles: PublicLlmProfileItem[];
  rules: RuleDocumentItem[];
  memories: LongTermMemoryItem[];
  libraryAssets: LibraryAssetItem[];
  storageState: StorageConfigState | null;
  storageStats: StorageStats | null;
  generalSettings: GeneralSettingsConfig;
  reasoningLevel: ReasoningLevelOption;
  streamStatusNotice: string;
  degradedStream: { runId: string; sessionId: string; assistantMessageId: string; lastSeq: number } | null;
  errorMessage: string;
}
