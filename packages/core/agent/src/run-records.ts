// Agent 运行记录类型：活动运行、待审批请求与审批摘要，供服务层与运行启动器共用。
import type { AgentPermissionMode, AgentRunEvent, AgentRunStatus, ApprovalAnswer } from "./types";
import type { RunChunkRecord } from "./stream-journal";

export interface PendingApprovalRecord {
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
  resolve: (answer: ApprovalAnswer) => void;
}

export interface ActiveRunRecord {
  status: AgentRunStatus;
  controller: AbortController;
  listeners: Set<(event: AgentRunEvent) => void>;
  pendingApprovals: Map<string, PendingApprovalRecord>;
  permissionMode: AgentPermissionMode;
  chunks: RunChunkRecord[];
  persistChain: Promise<void>;
  lastPersistAt: number;
  /** 运行期间追加的用户消息（插话），下一轮模型调用前由循环取出。 */
  steering: string[];
}

/** 对外暴露待审批请求时去掉内部的 resolve 回调。 */
export function pendingApprovalSummary(pending: PendingApprovalRecord): Omit<PendingApprovalRecord, "resolve"> {
  const { resolve: _resolve, ...rest } = pending;
  return rest;
}