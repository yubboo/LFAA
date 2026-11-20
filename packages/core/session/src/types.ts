// 会话领域契约：消息、步骤轨迹、运行指标、会话摘要与创建/更新输入。
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
  modelStage?: "reasoning" | "replying" | "retrying";
  /** Host 首次观测步骤的时间，与后续流活动更新时间分开。 */
  startedAt?: number;
  toolTarget?: string;
  argumentChars?: number;
  /** 子运行的身份和状态随父消息保存，结果与动作明细使用现有字段。 */
  subagent?: {
    id: string;
    role: string;
    status: "running" | "done" | "error" | "stopped";
  };
  commandTrace?: AgentCommandTrace;
  fileChange?: AgentFileChange;
  timestamp: number;
}

/** 单轮运行汇总的模型用量，仅保留供应商实际返回的字段。 */
export interface ChatTokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  /** 命中提示缓存的输入 token，供缓存命中率展示。 */
  cachedPromptTokens?: number;
}

/** 单次运行的可观测指标：模型/工具耗时、首 token 延迟、解码与上下文构成。 */
export interface AgentRunMetrics {
  llmMs: number;
  toolMs: number;
  ttftMs: number;
  ttftSteps: number;
  decodeMs: number;
  decodeTokens: number;
  context: {
    systemTokens: number;
    toolsTokens: number;
    messageTokens: number;
  };
  /** 本次运行所用模型配置的上下文窗口；未配置时缺省。 */
  contextWindowTokens?: number;
  contextPromptTokens?: number;
  contextModel?: string;
  contextWindowSource?: "configured" | "provider-spec";
  /** 只包含同时返回输入总量和缓存读取量的模型请求。 */
  cacheMeasurement?: { promptTokens: number; cachedTokens: number };
}

/** 单次运行按模型单价换算的人民币成本；未配置单价时缺省。 */
export interface AgentRunCost {
  amount: number;
  currency: "CNY";
  input: number;
  cachedInput: number;
  output: number;
}

/** 描述磁盘会话中的任意一条消息及其运行步骤。 */
export interface UserClarification {
  question: string;
  options: string[];
}

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
  clarification?: UserClarification;
  /** 本轮运行累计的模型用量，缺省表示供应商未返回 usage。 */
  tokenUsage?: ChatTokenUsage;
  /** 本轮运行的耗时与上下文构成，缺省表示未采集。 */
  metrics?: AgentRunMetrics;
  /** 本轮按模型单价换算的人民币成本，未配置单价时缺省。 */
  cost?: AgentRunCost;
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
  /** 新会话固定的能力预设；缺省表示旧会话，不能推断历史配置。 */
  sessionPreset?: string;
  /** 选择时保存的插件组合，避免后续默认值或预设调整改变旧会话。 */
  sessionModules?: string[];
  createdAt: number;
  updatedAt: number;
}

/** 在摘要基础上携带消息内容，供 Host 恢复完整会话。 */
export interface ChatSessionRecord extends ChatSessionSummary {
  messages: ChatMessageRecord[];
  /** 长会话滚动摘要：仅供模型恢复上下文，不参与会话列表摘要展示。 */
  contextSummary?: string;
}

export interface CreateSessionInput {
  title?: string;
  projectId?: string | null;
  sectionId?: string | null;
  sessionPreset?: string;
  sessionModules?: string[];
}

export interface UpdateSessionInput {
  sessionPreset?: string;
  sessionModules?: string[];
  title?: string;
  projectId?: string | null;
  sectionId?: string | null;
  pinned?: boolean;
  archived?: boolean;
  unread?: boolean;
  summary?: string;
  contextSummary?: string;
}
