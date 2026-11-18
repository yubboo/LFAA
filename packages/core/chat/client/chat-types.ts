// 声明 @lfaa/chat/client 浏览器端状态与 API 数据模型（无 Node 专有依赖）。
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
  timestamp: number;
}

export interface ChatMessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
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
  messageCount: number;
  summary?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChatSessionDetail extends ChatSessionItem {
  messages: ChatMessageItem[];
}

export interface PublicLlmProfileItem {
  id: string;
  name: string;
  kind: "openai-compatible" | "deepseek" | "ollama";
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
  apiKeyMasked: string;
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
}

export interface ChatStoreSnapshot {
  loaded: boolean;
  sessions: ChatSessionItem[];
  activeSessionId: string | null;
  activeSession: ChatSessionDetail | null;
  draftProjectId: string | null;
  draftSectionId: string | null;
  runningRunId: string | null;
  pendingApproval: PendingApprovalBanner | null;
  activeProfileId: string;
  profiles: PublicLlmProfileItem[];
  rules: RuleDocumentItem[];
  memories: LongTermMemoryItem[];
  errorMessage: string;
}
