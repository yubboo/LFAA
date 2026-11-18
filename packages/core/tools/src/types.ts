// 定义 @lfaa/tools 的无 DOM 领域契约：工具权限级别、参数协议、执行上下文及结果结构。
export type ToolPermissionLevel = "read" | "write" | "exec";

export interface ToolExecutionContext {
  workspaceRoots: string[];
  sessionId: string;
  runId: string;
  signal: AbortSignal;
  allowOutsideWorkspace?: boolean;
}

export interface ToolExecutionResult {
  ok: boolean;
  output: string;
  summary: string;
  metadata?: Record<string, unknown>;
}

export interface AgentToolDefinition {
  name: string;
  title: string;
  description: string;
  permissionLevel: ToolPermissionLevel;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>, context: ToolExecutionContext) => Promise<ToolExecutionResult>;
}

export interface PublicToolSummary {
  name: string;
  title: string;
  description: string;
  permissionLevel: ToolPermissionLevel;
  parameters: Record<string, unknown>;
}
