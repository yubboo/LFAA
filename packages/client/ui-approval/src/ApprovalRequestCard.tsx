/**
 * 文件：ApprovalRequestCard.tsx
 * 功能：呈现等待处理的审批请求和真实活动说明。
 * 作用：把批准/拒绝动作派发给现有聊天协调层。
 * 不负责：权限判定、授权或执行工具操作。
 * 关联文件：ApprovalActivityRecord.tsx、approval.css。
 */
import { Button } from "antd";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";

export interface ApprovalRequestCardProps {
  question: string;
  summary: string;
  previewLabel?: string;
  preview?: string;
  busy: boolean;
  onApprove: () => void;
  onDeny: () => void;
}

export function ApprovalRequestCard({ question, summary, previewLabel, preview, busy, onApprove, onDeny }: ApprovalRequestCardProps) {
  return (
    <section className="ai-work-chat__interaction-dock ai-work-chat__interaction-dock--approval ai-work-chat__composer-interaction" aria-label="待处理审批">
      <div className="ai-work-chat__interaction-dock-heading">
        <span className="ai-work-chat__interaction-dock-icon"><WorkbenchIcon name="shield" size={15} /></span>
        <strong>需要你审批</strong>
        <span>此决定只适用于当前操作</span>
      </div>
      <p className="ai-work-chat__interaction-dock-question">{question}</p>
      {summary || preview ? <div className="ai-work-chat__activity-output-card ai-work-chat__composer-interaction-detail">
        {summary ? <div className="ai-work-chat__activity-output-summary"><strong>操作说明</strong><p>{summary}</p></div> : null}
        {preview ? <div className="ai-work-chat__activity-output-preview"><strong>{previewLabel}</strong><pre>{preview}</pre></div> : null}
      </div> : null}
      <div className="ai-work-chat__interaction-dock-actions">
        <Button type="primary" disabled={busy} loading={busy} onClick={onApprove}>批准本次操作</Button>
        <Button danger disabled={busy} onClick={onDeny}>拒绝</Button>
      </div>
    </section>
  );
}
