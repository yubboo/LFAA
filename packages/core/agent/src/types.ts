// 定义 @lfaa/agent 的运行契约：运行输入、Think/Act/Check 流式事件与人工审批句柄。
import type { AgentStepTrace } from "@lfaa/memory";

export interface StartAgentRunInput {
  sessionId: string;
  userMessage: string;
  profileId?: string;
  projectId?: string | null;
  workspaceRoots?: string[];
  maxSteps?: number;
  autoApproveTools?: boolean;
}

export type AgentRunEvent =
  | { type: "run_started"; runId: string; sessionId: string; assistantMessageId: string }
  | { type: "delta"; runId: string; kind: "reasoning" | "text"; text: string }
  | { type: "step_update"; runId: string; step: AgentStepTrace }
  | {
      type: "approval_required";
      runId: string;
      approvalId: string;
      toolName: string;
      permissionLevel: "write" | "exec";
      argsPreview: string;
    }
  | { type: "run_finished"; runId: string; sessionId: string; assistantMessageId: string; status: "done" | "error" | "aborted"; error?: string };

export interface PendingToolApproval {
  approvalId: string;
  toolName: string;
  permissionLevel: "write" | "exec";
  argsPreview: string;
}

export interface AgentRunStatus {
  runId: string;
  sessionId: string;
  assistantMessageId: string;
  status: "running" | "done" | "error" | "aborted";
  steps: AgentStepTrace[];
  content: string;
  reasoning: string;
  pendingApprovals?: PendingToolApproval[];
  error?: string;
}
