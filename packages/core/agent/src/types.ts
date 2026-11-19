// 定义 @lfaa/agent 的运行契约：权限模式、运行输入、Think/Act/Check 流式事件与人工审批句柄。
import type { AgentStepTrace, ChatMessageRecord } from "@lfaa/memory";

/** 定义输入栏与 Host 审批策略共用的三种权限模式。 */
export type AgentPermissionMode = "ask" | "smart" | "full";
export type ApprovalAnswer = boolean | "mode_changed";
/** 指定智能审批放行普通操作前必须累计的人工批准次数。 */
export const SMART_APPROVAL_THRESHOLD = 3;

/** 本轮运行解析到的技能正文摘要，仅注入当轮模型上下文。 */
export interface ResolvedSkillContext {
  id: string;
  name: string;
  revision: number;
  content: string;
}

/** 描述创建运行接收的用户消息、会话上下文与配置。 */
export interface StartAgentRunInput {
  sessionId: string;
  userMessage: string;
  profileId?: string;
  reasoningEffort?: "minimal" | "low" | "medium" | "high" | "max";
  projectId?: string | null;
  workspaceRoots?: string[];
  skillIds?: string[];
  maxSteps?: number;
  permissionMode?: AgentPermissionMode;
  autoApproveTools?: boolean;
}

/** 定义流式运行可发给浏览器的事件变体。 */
export type AgentRunEvent =
  | { type: "run_started"; runId: string; sessionId: string; assistantMessageId: string }
  | { type: "delta"; runId: string; seq: number; kind: "reasoning" | "text"; text: string }
  | { type: "step_update"; runId: string; step: AgentStepTrace }
  | { type: "approval_resolved"; runId: string; approvalId: string }
  | {
      type: "approval_required";
      runId: string;
      approvalId: string;
      toolName: string;
      permissionLevel: "write" | "exec";
      argsPreview: string;
      permissionMode?: AgentPermissionMode;
      approvalPattern?: string;
      approvalCount?: number;
      approvalThreshold?: number;
      highRisk?: boolean;
      riskReason?: string;
    }
  | { type: "run_finished"; runId: string; sessionId: string; assistantMessageId: string; status: "done" | "error" | "aborted"; message?: ChatMessageRecord; error?: string };

/** 收集暂停执行时向用户展示和恢复所需的工具请求信息。 */
export interface PendingToolApproval {
  approvalId: string;
  toolName: string;
  permissionLevel: "write" | "exec";
  argsPreview: string;
  permissionMode?: AgentPermissionMode;
  approvalPattern?: string;
  approvalCount?: number;
  approvalThreshold?: number;
  highRisk?: boolean;
  riskReason?: string;
}

/** 描述浏览器查询时可恢复的运行阶段、会话标识和待审批信息。 */
export interface AgentRunStatus {
  runId: string;
  sessionId: string;
  assistantMessageId: string;
  status: "running" | "done" | "error" | "aborted";
  steps: AgentStepTrace[];
  content: string;
  reasoning: string;
  lastSeq: number;
  pendingApprovals?: PendingToolApproval[];
  message?: ChatMessageRecord;
  error?: string;
}
