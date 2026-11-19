// 声明 @lfaa/chat/client 浏览器端状态与 API 数据模型（无 Node 专有依赖）。
import type { GeneralSettingsConfig, ReasoningLevelOption } from "./general-settings-client";
import type { AgentStepTrace } from "@lfaa/memory";

export type { GeneralSettingsConfig, OpenSourcePackageInfo, ReasoningLevelOption } from "./general-settings-client";
export type AgentPermissionMode = "ask" | "smart" | "full";
/** 统一时间线上思考、操作和检查步骤的公开状态。 */
export type AgentStepItem = AgentStepTrace;
export type AgentPhase = AgentStepItem["phase"];
export type AgentStepStatus = AgentStepItem["status"];

/** 单次运行的耗时与上下文构成，字段与 Host 的 AgentRunMetrics 对应。 */
export interface ChatRunMetrics {
  llmMs: number;
  toolMs: number;
  ttftMs: number;
  ttftSteps: number;
  decodeMs: number;
  decodeTokens: number;
  context: { systemTokens: number; toolsTokens: number; messageTokens: number };
  contextWindowTokens?: number;
}

/** 提供聊天界面所需的消息内容、时间及运行信息。 */
export interface ChatMessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  reasoningDurationMs?: number;
  runDurationMs?: number;
  progressText?: string;
  steps?: AgentStepItem[];
  status?: "streaming" | "done" | "error" | "aborted";
  model?: string;
  /** 本轮运行累计的模型用量，供应商未返回时缺省。 */
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    cachedPromptTokens?: number;
  };
  /** 本轮运行的耗时与上下文构成，旧消息可能缺省。 */
  metrics?: ChatRunMetrics;
  /** 本轮按模型单价换算的人民币成本。 */
  cost?: { amount: number; currency: "CNY"; input: number; cachedInput: number; output: number };
  createdAt: number;
}

/** 描述侧栏定位与排序使用的会话摘要。 */
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

/** 返回选中会话及其消息，供中央工作区渲染。 */
export interface ChatSessionDetail extends ChatSessionItem {
  messages: ChatMessageItem[];
}

/** 定义模型目录中可供浏览器识别的思考档位元数据。 */
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

/** 表示浏览器可见的模型档案，密钥只以脱敏形式出现。 */
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
  contextWindowTokens?: number;
  inputPricePerMillion?: number;
  outputPricePerMillion?: number;
  cachedInputPricePerMillion?: number;
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

/** 承载正在等待用户决策的工具请求及其提示。 */
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

/** 定义资料库列表与预览使用的资产索引信息。 */
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

/** 向设置表单提供当前存储模式、目录与迁移相关状态。 */
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

/** 约定聊天 Store 向 React 订阅者提交的会话、设置和运行快照。 */
export interface FilePreviewTab {
  id: string;
  path: string;
  relativePath?: string;
  projectId?: string | null;
  messageId?: string;
  stepId?: string;
  targetLine?: number;
  endLine?: number;
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
  filePreviewTabs: FilePreviewTab[];
  activeFilePreviewId: string | null;
  rightStageKind?: "file" | "browser" | "review" | null;
  rightPanelRequest?: { tab: string; url?: string; nonce: number } | null;
  pendingComposerInsert?: { text: string; nonce: number } | null;
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
