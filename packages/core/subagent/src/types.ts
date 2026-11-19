// 定义 @lfaa/subagent 进程内子智能体状态、协作参数与配置契约。
import type { AgentStepTrace } from "@lfaa/memory";

export type SubagentStatus = "running" | "done" | "error" | "stopped";
export type SubagentMode = "read" | "write";

export interface SubagentSummaryItem {
  id: string;
  sessionId: string;
  role: string;
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
}

export interface SubagentPluginConfig {
  maxConcurrentPerSession?: number;
  defaultMaxSteps?: number;
}
