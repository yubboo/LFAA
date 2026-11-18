// 定义 @lfaa/llm 包的 Host 侧无 DOM 公共契约类型：模型配置、API 协议格式、官方模型能力、思考强度与流式事件。
export type LlmProviderKind = "openai-compatible" | "deepseek" | "ollama";
export type LlmApiProtocol =
  | "openai-chat"
  | "openai-responses"
  | "anthropic-messages"
  | "gemini-generate-content";
export type ReasoningEffortLevel = "minimal" | "low" | "medium" | "high" | "max";
export type ModelReasoningMode = "none" | "fixed" | "effort";

export interface ModelCapabilityInfo {
  id: string;
  displayName?: string;
  supportsReasoning: boolean;
  reasoningMode: ModelReasoningMode;
  reasoningLevels: ReasoningEffortLevel[];
  defaultReasoningLevel?: ReasoningEffortLevel;
}

export interface LlmProfile {
  id: string;
  providerId?: string;
  name: string;
  kind: LlmProviderKind;
  apiProtocol?: LlmApiProtocol;
  baseUrl: string;
  model: string;
  apiKey: string;
  configured?: boolean;
  availableModels?: ModelCapabilityInfo[];
  temperature?: number;
  maxTokens?: number;
  updatedAt: number;
}

export interface PublicLlmProfile {
  id: string;
  providerId?: string;
  name: string;
  kind: LlmProviderKind;
  apiProtocol: LlmApiProtocol;
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
  apiKeyMasked: string;
  configured: boolean;
  availableModels: ModelCapabilityInfo[];
  temperature?: number;
  maxTokens?: number;
  updatedAt: number;
}

export interface SaveLlmProfileInput {
  id?: string;
  providerId?: string;
  name: string;
  kind: LlmProviderKind;
  apiProtocol?: LlmApiProtocol;
  baseUrl: string;
  model: string;
  apiKey?: string;
  configured?: boolean;
  availableModels?: ModelCapabilityInfo[];
  temperature?: number;
  maxTokens?: number;
}

export interface LlmToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LlmToolCall {
  id: string;
  name: string;
  argumentsJson: string;
}

export interface LlmMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  reasoningContent?: string;
  toolCalls?: LlmToolCall[];
  toolCallId?: string;
  name?: string;
}

export interface LlmStreamDelta {
  type: "reasoning" | "text" | "tool_call";
  text?: string;
  toolCallId?: string;
  toolName?: string;
}

export interface LlmGenerateInput {
  profileId?: string;
  messages: LlmMessage[];
  tools?: LlmToolDefinition[];
  reasoningEffort?: ReasoningEffortLevel;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  onDelta?: (delta: LlmStreamDelta) => void;
}

export interface LlmUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface LlmGenerateOutput {
  model: string;
  provider: LlmProviderKind;
  content: string;
  reasoningContent?: string;
  toolCalls: LlmToolCall[];
  finishReason: string;
  usage?: LlmUsage;
}

export type LlmAdapter = (profile: LlmProfile, input: LlmGenerateInput) => Promise<LlmGenerateOutput>;
