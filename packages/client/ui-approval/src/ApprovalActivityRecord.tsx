/**
 * 文件：ApprovalActivityRecord.tsx
 * 功能：呈现已记录的审批决定和关联公开活动。
 * 作用：按 Connection/Session 返回的真实决定状态展示历史记录。
 * 不负责：生成决定或改变审批状态。
 * 关联文件：ApprovalRequestCard.tsx、approval.css。
 */
import type { ReactNode } from "react";
import type { AiActivityItem } from "lfaa-client-connection/src/api.js";

export interface ApprovalActivityRecordProps {
  activity: AiActivityItem;
  children?: ReactNode;
}

export function ApprovalActivityRecord({ activity, children }: ApprovalActivityRecordProps) {
  if (activity.status === "approval_required" && !activity.approvalAnswer) return null;

  const answer = activity.approvalAnswer === "approved"
    ? "批准本次操作"
    : activity.approvalAnswer === "denied"
      ? "拒绝本次操作"
      : activity.approvalAnswer === "expired" ? "审批已过期" : "未记录审批决定";

  return (
    <section className="ai-work-chat__approval-record" aria-label="审批记录">
      <strong>{activity.approvalQuestion ?? activity.title}</strong>
      <p className="ai-work-chat__question-inline-answer">{answer}</p>
      {children}
    </section>
  );
}
