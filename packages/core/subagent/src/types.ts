// 定义 @lfaa/subagent 进程内子智能体状态、流式事件、协作参数与配置契约。
import type { AgentStepTrace } from "@lfaa/memory";
import type { ToolExecutionContext } from "@lfaa/tools";

export type SubagentStatus = "running" | "done" | "error" | "stopped";
export type SubagentMode = "read" | "write" | "browser";
export type SubagentKind = "general" | "research" | "coder" | "browser" | "reviewer";

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
  /** 子智能体当前累计的思考链文本（流式增量写入，供右侧标签舞台实时展示）。 */
  reasoning?: string;
  output: string;
  error?: string;
  stepsCount: number;
  steps: AgentStepTrace[];
  startedAt: number;
  endedAt?: number;
}

/** 子智能体 SSE 流式事件协议：与主聊天 AssistantTimeline 完全同构。 */
export type SubagentStreamEvent =
  | { type: "snapshot"; subagent: SubagentSummaryItem }
  | { type: "delta"; channel: "text" | "reasoning"; delta: string; timestamp: number }
  | { type: "step_update"; step: AgentStepTrace; timestamp: number }
  | { type: "run_finished"; subagent: SubagentSummaryItem; timestamp: number };

export interface InvokeSubagentInput {
  sessionId: string;
  role: string;
  prompt: string;
  kind?: SubagentKind;
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
