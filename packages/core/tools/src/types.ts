// 定义 @lfaa/tools 的无 DOM 领域契约：工具权限级别、参数协议、执行上下文及结果结构。
export type ToolPermissionLevel = "read" | "write" | "exec";

/** 为工具执行提供工作目录、权限和取消上下文。 */
export interface ToolExecutionContext {
  workspaceRoots: string[];
  sessionId: string;
  runId: string;
  signal: AbortSignal;
  allowOutsideWorkspace?: boolean;
  onCommandOutput?: (output: string) => void;
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
