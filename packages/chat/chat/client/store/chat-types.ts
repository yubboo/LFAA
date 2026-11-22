// 声明 @lfaa/chat/client 浏览器端状态与 API 数据模型（无 Node 专有依赖）。
import type { GeneralSettingsConfig, ReasoningLevelOption } from "../settings/general-settings-client";
import type { AgentRunMetrics, AgentStepTrace, ChatMessageAttachment, ChatMessageReference, PendingQuestion, UserClarification } from "@lfaa/memory";
import type { QueuedMessage } from "./chat-queue";

export type { GeneralSettingsConfig, OpenSourcePackageInfo, ReasoningLevelOption } from "../settings/general-settings-client";
export type AgentPermissionMode = "ask" | "smart" | "full";
/** 统一时间线上思考、操作和检查步骤的公开状态。 */
export type AgentStepItem = AgentStepTrace;
export type AgentPhase = AgentStepItem["phase"];
export type AgentStepStatus = AgentStepItem["status"];

/** 单次运行的耗时与上下文构成，字段与 Host 的 AgentRunMetrics 对应。 */
export type ChatRunMetrics = AgentRunMetrics;

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
  clarification?: UserClarification;
  /** 用户消息上传的图片引用，旧消息与助手消息可缺省。 */
  attachments?: ChatMessageAttachment[];
  /** 用户消息引用过的会话内生成图片，旧消息可缺省。 */
  references?: ChatMessageReference[];
  /** 媒体生成中的占位消息：消息区按目标比例显示生成卡片，完成前没有正文。 */
  mediaGenerating?: { kind: "image" | "video" | "audio"; ratio?: string };
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
/** 会话绑定的 Git 工作树摘要；路径由 Host 解析，界面只负责展示。 */
export interface ChatSessionWorktree {
  id: string;
  projectId: string;
  path: string;
  branch: string;
  repositoryRoot: string;
}

export interface ChatSessionItem {
  id: string;
  title: string;
  projectId: string | null;
  sectionId: string | null;
  /** 绑定工作树时由 Host 返回；旧会话缺省。 */
  worktree?: ChatSessionWorktree;
  pinned: boolean;
  archived: boolean;
  unread?: boolean;
  /** 静音该会话的通知与侧栏待处理徽标。 */
  muted?: boolean;
  messageCount: number;
  summary?: string;
  sessionPreset?: string;
  /** 等待用户回答的澄清问题；回答或开始新一轮后清除。 */
  pendingQuestion?: PendingQuestion;
  createdAt: number;
  updatedAt: number;
}

/** 会话需要用户处理的状态，供左二栏徽标与通知使用。 */
export interface ChatSessionAttention {
  sessionId: string;
  kind: "approval" | "question";
  toolName?: string;
  question?: string;
  options?: string[];
  messageId?: string;
}

/** 会话全文搜索命中项；与 Host `/api/chat/search` 返回结构一致。 */
export interface ChatSearchResult {
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

/** 待滚动到并高亮的目标消息；跨搜索弹窗与聊天视图共享。 */
export interface MessageJumpRequest {
  sessionId: string;
  messageId: string;
  nonce: number;
}

/** 返回选中会话及其消息，供中央工作区渲染。 */
export interface ChatSessionDetail extends ChatSessionItem {
  messages: ChatMessageItem[];
  /** 会话当前任务清单；旧会话缺省，界面按「没有清单」处理。 */
  todos?: AgentStepItem["todos"];
}

/** 目标状态：进行中、已完成、受阻；与 Host 的 @lfaa/goal 契约保持一致。 */
export type ChatGoalStatus = "active" | "complete" | "blocked";

/** 当前会话的目标摘要；只取输入框目标条需要的字段，不复制完整进展日志。 */
export interface ChatGoalItem {
  id: string;
  title: string;
  objective: string;
  status: ChatGoalStatus;
  progress: { done: number; total: number };
  updatedAt: number;
  /** 已自动续跑的轮次。 */
  rounds: number;
  /** 自动续跑轮数上限。 */
  maxRounds: number;
  /** 是否允许自动续跑；用户可在 GoalBar 暂停。 */
  autoContinue: boolean;
  /** 最近一次自动续跑时间。 */
  lastContinuedAt?: number;
}

/** 定义模型目录中可供浏览器识别的思考档位元数据。 */
export interface ModelCapabilityItem {
  id: string;
  displayName?: string;
  /** 模型用途：对话 / 生图 / 生视频 / 语音 / 向量化。 */
  modelKind?: "chat" | "image" | "video" | "audio" | "embedding";
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
  /** 打开文件时所在的工作树；缺省表示项目主目录。 */
  worktreeId?: string;
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
  /** 当前会话最近一个未完成目标；undefined 表示尚未读取，null 表示没有目标。 */
  activeGoal?: ChatGoalItem | null | undefined;
  draftProjectId: string | null;
  draftSectionId: string | null;
  /** 新会话草稿绑定的工作树；发送时只提交 id，由 Host 解析。 */
  draftWorktree?: ChatSessionWorktree | undefined;
  draftSessionPreset?: string | undefined;
  submittingMessage?: boolean;
  runningRunId: string | null;
  /** 正在运行 Agent 的会话 id：切走会话后仍用于在左二栏显示工作转圈。 */
  runningSessionIds: string[];
  /** 当前需要用户确认或回答的会话；用于侧栏徽标与系统通知。 */
  attention: ChatSessionAttention[];
  /** 搜索结果点击后待定位的消息；聊天视图消费后清空。 */
  pendingMessageJump: MessageJumpRequest | null;
  queuedMessages: QueuedMessage[];
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
