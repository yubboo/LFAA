// 会话领域契约：消息、步骤轨迹、运行指标、会话摘要与创建/更新输入。
export type AgentLoopPhase = "think" | "act" | "check";
export type AgentStepStatus = "preparing" | "running" | "waiting_approval" | "done" | "error";

/** 任务清单条目的状态取值；由模型通过 todo_write 维护。 */
export type TodoStatus = "pending" | "in_progress" | "completed";

/** 一条任务清单条目；id 允许缺省，缺省时调用方按内容生成稳定标识。 */
export interface TodoItem {
  id: string;
  content: string;
  status: TodoStatus;
}

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
  operation: "created" | "edited" | "deleted";
  firstLine: number;
  before: string;
  after: string;
  truncated: boolean;
}

/** 真实读取文件时记录的行号范围与解析路径，供时间线展示 #L起-止 并支持点击定位源码。 */
export interface AgentFileReadRange {
  startLine: number;
  endLine: number;
  totalLines?: number;
  resolvedPath?: string;
}

/** 子智能体向父思维链上报的单步结构化摘要。 */
export interface SubagentStepPreview {
  id: string;
  name: string;
  label?: string;
  target?: string;
  resultSummary?: string;
  browserEvidence?: AgentStepTrace["browserEvidence"];
  browserVerdict?: AgentStepTrace["browserVerdict"];
  status: AgentStepStatus;
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
  resultSummary?: string;
  browserEvidence?: { id: string; sessionId: string };
  browserVerdict?: "pass" | "needs_fix" | "unverified";
  addedLines?: number;
  removedLines?: number;
  /** 任务清单类工具在本次调用后回传的完整清单，供时间线与任务面板还原。 */
  todos?: TodoItem[];
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
    /** 子智能体专职类型；"browser" 在思维链渲染专属浏览器实时步骤卡，其余类型在右侧栏新建流式工作标签。 */
    kind?: "general" | "research" | "coder" | "browser" | "reviewer";
    /** 所用浏览器类型标识（如「内置浏览器」「桌面浏览器」）。 */
    browserLabel?: string;
    /** 运行中实时动作或思考文案（如「思考中」「正在打开页面」）。 */
    liveAction?: string;
    /** 子智能体已执行的步骤清单，供思维链展开查看。 */
    steps?: SubagentStepPreview[];
  };
  commandTrace?: AgentCommandTrace;
  fileChange?: AgentFileChange;
  readRange?: AgentFileReadRange;
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

/** 会话中等待用户回答的澄清问题；回答（发送新消息）后清除。 */
export interface PendingQuestion extends UserClarification {
  /** 产生该问题的助手消息 id，用于定位澄清卡片。 */
  messageId: string;
}

/** 指向会话附件存储中仍可读取的图片素材，不内嵌图片字节。 */
export interface ChatMessageAttachment {
  id: string;
  kind: "image";
}

/** 指向会话中已生成媒体文件的引用图；素材由 /api/media/file 按路径读取。 */
export interface ChatMessageReference {
  /** 产生该图片的助手消息 id。 */
  messageId: string;
  /** 宿主校验过的本地绝对路径。 */
  path: string;
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
  /** 群聊里这条助手消息由哪个 agent 发出；单聊缺省。 */
  authorAgentId?: string;
  /** 群聊回合 id：同一轮的多条发言共享，界面据此折叠成一组。 */
  turnId?: string;
  /** 本轮分给该成员的子任务，显示在气泡头部。 */
  speakerTask?: string;
  clarification?: UserClarification;
  /** 用户消息关联的附件引用；历史文本消息与助手消息可缺省。 */
  attachments?: ChatMessageAttachment[];
  /** 用户消息引用过的会话内生成图片；用于在气泡里还原「说的就是这张」。 */
  references?: ChatMessageReference[];
  /** 本轮运行累计的模型用量，缺省表示供应商未返回 usage。 */
  tokenUsage?: ChatTokenUsage;
  /** 本轮运行的耗时与上下文构成，缺省表示未采集。 */
  metrics?: AgentRunMetrics;
  /** 本轮按模型单价换算的人民币成本，未配置单价时缺省。 */
  cost?: AgentRunCost;
  createdAt: number;
}

/** 会话绑定的 Git 工作树快照；真实状态以 Host 工作树记录与 Git 为准。 */
export interface SessionWorktree {
  id: string;
  projectId: string;
  path: string;
  branch: string;
  repositoryRoot: string;
}

/** 会话形态：单聊（一个 agent）或群聊（多个 agent 在同一会话里依次发言）。 */
export type SessionKind = "single" | "group";

/** 群聊配置：成员、代理人（调度者）与预算护栏。 */
export interface GroupSessionConfig {
  /** 群成员 agent id，顺序即默认发言顺序。 */
  agentIds: string[];
  /** 代理人（群主）：负责决定本轮谁发言；缺省为内置小鱼。 */
  hostAgentId?: string;
  /** 自动续轮数（一轮结束后是否继续互审），默认 1。 */
  autoRounds?: number;
  /** 单轮最多发言人数，默认 3。 */
  maxSpeakersPerRound?: number;
  /** 每位成员的单轮步数上限，默认 12。 */
  memberMaxSteps?: number;
}

/** 提供列表渲染所需的会话归属、标题与状态摘要。 */
export interface ChatSessionSummary {
  id: string;
  title: string;
  projectId: string | null;
  sectionId: string | null;
  pinned: boolean;
  archived: boolean;
  /** 绑定工作树时随摘要返回；旧会话缺省。 */
  worktree?: SessionWorktree;
  unread?: boolean;
  /** 静音该会话的通知与侧栏待确认/待回答徽标。 */
  muted?: boolean;
  messageCount: number;
  summary?: string;
  /** 新会话固定的能力预设；缺省表示旧会话，不能推断历史配置。 */
  sessionPreset?: string;
  /** 选择时保存的插件组合，避免后续默认值或预设调整改变旧会话。 */
  sessionModules?: string[];
  /** 会话绑定的 agent 定义 id；缺省表示内置小鱼。 */
  agentId?: string;
  /** 会话级模型绑定覆盖，优先于 agent 自身绑定；缺省表示跟随 agent。 */
  bindingOverrideId?: string;
  /** 会话形态；缺省表示单聊，旧会话不受影响。 */
  kind?: SessionKind;
  /** 群聊配置；仅 kind=group 时存在。 */
  group?: GroupSessionConfig;
  /** 等待用户回答的澄清问题；回答后清除。 */
  pendingQuestion?: PendingQuestion;
  createdAt: number;
  updatedAt: number;
}

/** 在摘要基础上携带消息内容，供 Host 恢复完整会话。 */
export interface ChatSessionRecord extends ChatSessionSummary {
  messages: ChatMessageRecord[];
  /** 长会话滚动摘要：仅供模型恢复上下文，不参与会话列表摘要展示。 */
  contextSummary?: string;
  /** 会话当前的任务清单；缺省表示本轮还没建清单。 */
  todos?: TodoItem[];
}

export interface CreateSessionInput {
  title?: string;
  projectId?: string | null;
  sectionId?: string | null;
  sessionPreset?: string;
  sessionModules?: string[];
  /** Host 已解析并校验的工作树快照；客户端只能提交 worktreeId 由 Host 解析。 */
  worktree?: SessionWorktree;
  /** 新建时直接指定 agent 与模型绑定覆盖；缺省使用内置小鱼与默认绑定。 */
  agentId?: string;
  bindingOverrideId?: string;
  /** 建群：会话形态与成员配置；缺省为单聊。 */
  kind?: SessionKind;
  group?: GroupSessionConfig;
}

export interface UpdateSessionInput {
  sessionPreset?: string;
  sessionModules?: string[];
  title?: string;
  projectId?: string | null;
  sectionId?: string | null;
  /** 覆盖工作树绑定；传 null 表示解绑。 */
  worktree?: SessionWorktree | null;
  /** 切换会话绑定的 agent；传 null 恢复内置小鱼。 */
  agentId?: string | null;
  /** 覆盖会话的模型绑定；传 null 表示跟随 agent 自身绑定。 */
  bindingOverrideId?: string | null;
  /** 切换会话形态；传 null 恢复单聊。 */
  kind?: SessionKind | null;
  /** 覆盖群成员配置；传 null 表示不再是群聊。 */
  group?: GroupSessionConfig | null;
  pinned?: boolean;
  archived?: boolean;
  unread?: boolean;
  /** 静音该会话的通知与侧栏徽标；不影响运行转圈与未读点。 */
  muted?: boolean;
  summary?: string;
  contextSummary?: string;
  /** 覆盖会话的任务清单；传空数组表示显式清空。 */
  todos?: TodoItem[];
  /** 写入等待回答的澄清问题；传 null 表示清除（回答后）。 */
  pendingQuestion?: PendingQuestion | null;
}
