// Agent 运行记录类型：活动运行、待审批请求与步骤增量/任务结算辅助，供服务层与运行启动器共用。
import type { AgentStepTrace, TodoItem } from "@lfaa/memory";
import type { AgentPermissionMode, AgentRunEvent, AgentRunStatus, ApprovalAnswer } from "../types";
import type { RunChunkRecord } from "../stream-journal";

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

/** 将流式思考增量同步追加到对应轮次的 think 步骤，确保断线重连快照也携带当前思维链。 */
export function appendReasoningToThinkStep(
  steps: AgentStepTrace[],
  text: string,
  iteration?: number,
): void {
  let thinkIdx = -1;
  if (iteration !== undefined) {
    thinkIdx = steps.findIndex((s) => s.id === `think-${iteration}`);
  } else {
    for (let i = steps.length - 1; i >= 0; i -= 1) {
      const candidate = steps[i];
      if (candidate && candidate.phase === "think" && candidate.status === "running") {
        thinkIdx = i;
        break;
      }
    }
  }
  if (thinkIdx < 0) return;
  const prev = steps[thinkIdx]!;
  const nextDetail = `${prev.detail ?? ""}${text}`;
  steps[thinkIdx] = {
    ...prev,
    detail: nextDetail.length > 24_000 ? nextDetail.slice(-24_000) : nextDetail,
  };
}

/** 运行正常收尾时结算残留的 in_progress 任务，避免模型遗漏最后一次 todo_write 导致界面永久转圈。 */
export function settleRemainingInProgressTodos(todos?: TodoItem[]): TodoItem[] | undefined {
  if (!todos || !todos.some((item) => item.status === "in_progress")) return undefined;
  return todos.map((item) => (item.status === "in_progress" ? { ...item, status: "completed" as const } : item));
}