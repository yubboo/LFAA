// 定义 @lfaa/tools 的无 DOM 领域契约：工具权限级别、参数协议、执行上下文及结果结构。
export type ToolPermissionLevel = "read" | "write" | "exec";

/** 子运行通过父工具上下文报告真实状态和已完成工作。 */
export interface SubagentActivityUpdate {
  id: string;
  role: string;
  status: "running" | "done" | "error" | "stopped";
  activity?: { id: string; name: string; status: "preparing" | "running" | "waiting_approval" | "done" | "error" };
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
