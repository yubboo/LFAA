/**
 * 功能：展示 Agent 生成的写作修改提案并接收审阅动作。
 * 作用：只呈现 Writing Owner 返回的提案快照；读取、应用、拒绝和刷新仍由调用方完成。
 * 不负责：写入作品正文、权限判断、提案持久化或请求生命周期。
 * 关联文件：WritingProposalReviewDialog.css、packages/client/ui-chat/src/AiWorkChat.tsx。
 */
import { Alert, Button, Input, Modal, Spin } from "antd";
import type { WritingEditProposal } from "lfaa-client-connection/src/api.js";
import "./WritingProposalReviewDialog.css";

const operationLabels: Record<WritingEditProposal["operation"], string> = {
  append: "追加",
  prepend: "前置",
  insert_before: "锚点前插入",
  insert_after: "锚点后插入",
  replace_anchor: "锚点替换",
  replace: "整体替换"
};

const statusLabels: Record<WritingEditProposal["status"], string> = {
  pending: "待审阅",
  applied: "已应用",
  rejected: "已拒绝",
  stale: "原文已变化",
  superseded: "已被新提案替代",
  expired: "已过期"
};

interface WritingProposalReviewDialogProps {
  open: boolean;
  proposal: WritingEditProposal | null;
  loading: boolean;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onResolve: (decision: "apply" | "reject") => void;
}

export function WritingProposalReviewDialog({ open, proposal, loading, busy, error, onCancel, onResolve }: WritingProposalReviewDialogProps) {
  const canResolve = proposal?.status === "pending" && proposal.baseContent !== null && proposal.proposedContent !== null;

  return <Modal
    className="writing-proposal-review"
    open={open}
    title={proposal ? `${proposal.bookTitle} · ${proposal.targetTitle}` : "审阅 AI 修改提案"}
    width={1080}
    getContainer={() => document.querySelector<HTMLElement>(".workbench-shell") ?? document.body}
    closable={!busy}
    maskClosable={!busy}
    keyboard={!busy}
    onCancel={onCancel}
    footer={canResolve ? <div className="writing-proposal-review__footer">
      <Button danger disabled={busy || loading} loading={busy} onClick={() => onResolve("reject")}>拒绝提案</Button>
      <Button type="primary" disabled={busy || loading} loading={busy} onClick={() => onResolve("apply")}>确认并应用</Button>
    </div> : <Button disabled={busy} onClick={onCancel}>关闭</Button>}
  >
    {error ? <Alert className="writing-proposal-review__error" type="error" showIcon message={error} /> : null}
    {loading ? <div className="writing-proposal-review__loading"><Spin tip="读取提案正文…" /></div> : proposal ? <div className="writing-proposal-review__body">
      <div className="writing-proposal-review__meta">
        <span>作品：{proposal.bookTitle}</span>
        <span>目标：{proposal.targetTitle}</span>
        <span>操作：{operationLabels[proposal.operation]}</span>
        <span>状态：{statusLabels[proposal.status]}</span>
      </div>
      {canResolve ? <div className="writing-proposal-review__columns">
        <section aria-label="修改前正文"><h3>当前正文</h3><Input.TextArea className="writing-proposal-review__text" value={proposal.baseContent ?? ""} readOnly aria-label="当前正文，只读" /></section>
        <section aria-label="提案正文"><h3>提案正文</h3><Input.TextArea className="writing-proposal-review__text" value={proposal.proposedContent ?? ""} readOnly aria-label="提案正文，只读" /></section>
      </div> : proposal.status === "stale" ? <Alert type="warning" showIcon message="目标正文已在提案生成后发生变化。为保护新内容，此提案不能应用。" />
        : proposal.status === "expired" ? <Alert type="warning" showIcon message="提案已超过 24 小时有效期，不能应用。" />
          : proposal.status === "superseded" ? <Alert type="info" showIcon message="同一目标已有更新的待审提案，这份提案已失效。" />
            : proposal.status === "rejected" ? <Alert type="info" showIcon message="这份提案已被拒绝，作品正文没有因拒绝而修改。" />
              : proposal.status === "applied" ? <Alert type="success" showIcon message="这份提案已应用到作品正文。" />
                : <Alert type="warning" showIcon message="提案正文暂不可用，无法应用。" />}
    </div> : null}
  </Modal>;
}
