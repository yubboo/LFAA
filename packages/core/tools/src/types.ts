// 定义 @lfaa/tools 的无 DOM 领域契约：工具权限级别、参数协议、执行上下文及结果结构。
export type ToolPermissionLevel = "read" | "write" | "exec";

/**
 * 文件影响模式与执行前判定契约。
 * 放在 tools 侧是为了让工具层与沙箱包保持单向依赖：沙箱实现依赖工具契约，工具不反向依赖沙箱包。
 */
export type SandboxMode = "read-only" | "workspace-write" | "danger-full-access";

/** 一次执行使用的沙箱策略；按调用携带，不在全局固定。 */
export interface SandboxPolicy {
  mode: SandboxMode;
  /** 允许写入的绝对路径根；`workspace-write` 模式必须提供。 */
  workspaceRoots: readonly string[];
}

/** 判定结果：拒绝时给出可展示原因，绝不静默放行。 */
export type SandboxDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

/** 子运行通过父工具上下文报告真实状态和已完成工作。 */
export interface SubagentActivityUpdate {
  id: string;
  role: string;
  status: "running" | "done" | "error" | "stopped";
  kind?: "general" | "browser";
  browserLabel?: string;
  liveAction?: string;
  activity?: {
    id: string;
    name: string;
    label?: string;
    target?: string;
    status: "preparing" | "running" | "waiting_approval" | "done" | "error";
  };
  result?: string;
}

/** 为工具执行提供工作目录、权限和取消上下文。 */
export interface ToolExecutionContext {
  workspaceRoots: string[];
  sessionId: string;
  runId: string;
  signal: AbortSignal;
  allowOutsideWorkspace?: boolean;
  /** 本次执行的沙箱模式；缺省按工作区可写处理。 */
  sandboxMode?: "read-only" | "workspace-write" | "danger-full-access";
  onSubagentActivity?: (update: SubagentActivityUpdate) => void;
  onCommandOutput?: (output: string) => void;
  /** 子运行继承父会话的工具组合，不能借委派取得额外工具。 */
  allowsTool?: (name: string) => boolean;
  /** 父运行的动态审批能力，供受托子运行继承；不向模型暴露。 */
  parentApproval?: {
    getPermissionMode: () => "ask" | "smart" | "full";
    requestApproval: (request: { approvalId: string; toolName: string; permissionLevel: "write" | "exec"; argsPreview: string; permissionMode: "ask" | "smart" | "full"; approvalPattern?: string; approvalCount?: number; approvalThreshold?: number; highRisk?: boolean; riskReason?: string }, signal?: AbortSignal) => Promise<boolean | "mode_changed">;
  };
  parentProfileId?: string;
}

/** 规定工具返回给 Agent 的执行结果与可展示内容。 */
export interface ToolExecutionResult {
  ok: boolean;
  output: string;
  summary: string;
  metadata?: Record<string, unknown>;
  fileChange?: ToolFileChange;
}

/** 成功写入时捕获限长的真实变更片段，供宿主记录。 */
export interface ToolFileChange {
  path: string;
  resolvedPath: string;
  operation: "created" | "edited";
  firstLine: number;
  before: string;
  after: string;
  truncated: boolean;
}

/** 定义工具的参数、权限分级和执行契约，供注册与审批共用。 */
export interface AgentToolDefinition {
  /** 注册此工具的插件模块，供会话预设筛选。 */
  moduleName?: string;
  name: string;
  title: string;
  description: string;
  permissionLevel: ToolPermissionLevel;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>, context: ToolExecutionContext) => Promise<ToolExecutionResult>;
}

/** 提供工作台可展示的工具元数据，实际执行函数由 Host 持有。 */
export interface PublicToolSummary {
  name: string;
  title: string;
  description: string;
  permissionLevel: ToolPermissionLevel;
  parameters: Record<string, unknown>;
}

/** 前台命令超时后转后台任务所需的上下文。 */
export interface CommandTimeoutFallbackInput {
  command: string;
  cwd: string;
  sessionId: string;
  runId: string;
}

/** 后台任务服务返回的任务标识，供 Agent 继续轮询。 */
export interface CommandTimeoutFallbackResult {
  taskId: string;
  title: string;
}

/** 由后台任务服务注册的前台超时兜底回调；返回 null 表示当前无可用后台能力。 */
export type CommandTimeoutHandler = (
  input: CommandTimeoutFallbackInput,
) => Promise<CommandTimeoutFallbackResult | null>;

/** 中间件拿到的本次调用信息；around 可替换执行上下文（例如换上带超时的 signal）。 */
export interface ToolMiddlewareInfo {
  name: string;
  args: Record<string, unknown>;
  context: ToolExecutionContext;
}

/**
 * 逐次沙箱策略：按工具与调用上下文决定本次使用的沙箱模式；返回 undefined 表示沿用调用方。
 * 策略插件（如 sandbox-policy）通过 ToolsService.setSandboxResolver 注册。
 */
export type SandboxModeResolver = (
  name: string,
  args: Record<string, unknown>,
  context: ToolExecutionContext,
) => ToolExecutionContext["sandboxMode"] | undefined;

/**
 * 工具执行中间件，供超时策略、结果精简与长结果落盘等策略插件接入。
 * aroundExecute 包裹真实执行（按注册顺序由外到内），afterExecute 按顺序改写结果。
 */
export interface ToolExecutionMiddleware {
  id: string;
  aroundExecute?: (
    next: (context?: ToolExecutionContext) => Promise<ToolExecutionResult>,
    info: ToolMiddlewareInfo,
  ) => Promise<ToolExecutionResult>;
  afterExecute?: (
    result: ToolExecutionResult,
    info: ToolMiddlewareInfo,
  ) => Promise<ToolExecutionResult> | ToolExecutionResult;
}
