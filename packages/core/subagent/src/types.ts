// 定义 @lfaa/subagent 进程内子智能体状态、协作参数与配置契约。
import type { AgentStepTrace } from "@lfaa/memory";
import type { ToolExecutionContext } from "@lfaa/tools";

export type SubagentStatus = "running" | "done" | "error" | "stopped";
export type SubagentMode = "read" | "write" | "browser";
export type SubagentKind = "general" | "browser";

export interface SubagentSummaryItem {
  id: string;
  sessionId: string;
  parentRunId?: string | undefined;
  role: string;
  kind?: SubagentKind;
  browserLabel?: string;
  mode: SubagentMode;
  status: SubagentStatus;
  prompt: string;
  output: string;
  error?: string;
  stepsCount: number;
  steps: AgentStepTrace[];
  startedAt: number;
  endedAt?: number;
}

export interface InvokeSubagentInput {
  sessionId: string;
  role: string;
  prompt: string;
  mode?: SubagentMode;
  workspaceRoots: string[];
  wait?: boolean;
  maxSteps?: number;
  parentSignal?: AbortSignal;
  parentApproval?: ToolExecutionContext["parentApproval"];
  parentRunId?: string | undefined;
  parentProfileId?: string | undefined;
  allowsTool?: ToolExecutionContext["allowsTool"];
  onSubagentActivity?: ToolExecutionContext["onSubagentActivity"];
}

export interface SubagentPluginConfig {
  maxConcurrentPerSession?: number;
  defaultMaxSteps?: number;
}
