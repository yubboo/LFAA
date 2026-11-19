// 定义 @lfaa/llm 包的 Host 侧无 DOM 公共契约类型：模型配置、API 协议格式、官方模型能力、思考强度与流式事件。
export type LlmProviderKind = "openai-compatible" | "deepseek" | "ollama";
/** 描述模型请求和目录查询可使用的通信协议，供 Host 与浏览器表单约定。 */
export type LlmApiProtocol =
  | "openai-chat"
  | "openai-responses"
  | "anthropic-messages"
  | "gemini-generate-content";
export type ReasoningEffortLevel = "minimal" | "low" | "medium" | "high" | "max";
export type ModelReasoningMode = "none" | "fixed" | "effort";

/** 描述可选模型公开能力，包括固定思考或可调档位。 */
export interface ModelCapabilityInfo {
  id: string;
  displayName?: string;
  supportsReasoning: boolean;
  reasoningMode: ModelReasoningMode;
  reasoningLevels: ReasoningEffortLevel[];
  defaultReasoningLevel?: ReasoningEffortLevel;
}

/** 定义 Host 保存的完整模型档案，包含只能在本机使用的凭据。 */
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
  /** 该模型可用的上下文窗口（token）；缺省表示未知，界面不显示占比。 */
  contextWindowTokens?: number;
  /** 每百万未缓存输入 token 的人民币单价。 */
  inputPricePerMillion?: number;
  /** 每百万输出 token 的人民币单价。 */
  outputPricePerMillion?: number;
  /** 每百万缓存读取 token 的人民币单价；缺省按输入单价计算。 */
  cachedInputPricePerMillion?: number;
  updatedAt: number;
}

/** 定义可返回浏览器的档案投影，只携带脱敏凭据信息。 */
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
  contextWindowTokens?: number;
  inputPricePerMillion?: number;
  outputPricePerMillion?: number;
  cachedInputPricePerMillion?: number;
  updatedAt: number;
}

/** 定义保存模型的输入字段，省略密钥时由 Host 保留现有凭据。 */
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
  contextWindowTokens?: number;
  inputPricePerMillion?: number;
  outputPricePerMillion?: number;
  cachedInputPricePerMillion?: number;
}

/** 描述可提供给模型的工具名称和参数模式。 */
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

/** 描述适配器转换为各提供商协议消息的统一结构。 */
export interface LlmMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  reasoningContent?: string;
  toolCalls?: LlmToolCall[];
  toolCallId?: string;
  name?: string;
}

/** 定义适配器回调给 Agent 的流式文本、思考与工具事件。 */
export interface LlmStreamDelta {
  type: "reasoning" | "text" | "tool_call";
  text?: string;
  toolCallId?: string;
  toolName?: string;
}

/** 封装完成一次推理所需的消息、工具、档位和取消信号。 */
export interface LlmGenerateInput {
  profileId?: string;
  messages: LlmMessage[];
  tools?: LlmToolDefinition[];
  reasoningEffort?: ReasoningEffortLevel;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  onDelta?: (delta: LlmStreamDelta) => void;
  /** 参数流的已接收长度和有限前缀仅供 Host 识别目标，不随 SSE 发布原文。 */
  onActivity?: (progress?: { toolCallId: string; argumentChars: number; argumentPrefix: string }) => void;
}

export interface LlmUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  /** 命中提示缓存的输入 token；供应商未提供时缺省。 */
  cachedPromptTokens?: number;
}

/** 统一提供商回复、工具调用、完成原因和用量。 */
export interface LlmGenerateOutput {
  model: string;
  provider: LlmProviderKind;
  content: string;
  reasoningContent?: string;
  toolCalls: LlmToolCall[];
  finishReason: string;
  usage?: LlmUsage;
}

/** 规定协议适配器的可替换入口，供 Host 按档案发起推理。 */
export type LlmAdapter = (profile: LlmProfile, input: LlmGenerateInput) => Promise<LlmGenerateOutput>;
