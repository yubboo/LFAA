/**
 * 文件：MessageFeedbackDialog.tsx
 * 功能：呈现受控的消息评价原因与补充说明对话框。
 * 作用：所有数据和提交/取消动作由聊天协调层传入。
 * 不负责：消息查询、认证 API、反馈持久化或权限授权。
 * 关联文件：message-feedback-types.ts、feedback-reasons.ts、packages/client/ui-chat/src/AiWorkChat.tsx。
 */
import { Alert, Button, Input, Modal } from "antd";
import { AI_MESSAGE_FEEDBACK_REASONS } from "./feedback-reasons.js";
import type { MessageFeedbackDialogProps } from "./message-feedback-types.js";

export function MessageFeedbackDialog({ open, rating, selectedReasons, detail, error, busy, getContainer, onClose, onSubmit, onToggleReason, onDetailChange }: MessageFeedbackDialogProps) {
  return <Modal
    className="ai-work-chat__feedback-modal"
    open={open}
    title="提交反馈"
    width={760}
    getContainer={getContainer}
    closable={!busy}
    maskClosable={!busy}
    keyboard={!busy}
    onCancel={() => { if (!busy) onClose(); }}
    footer={<div className="ai-work-chat__feedback-footer">
      <Button disabled={busy} onClick={onClose}>取消</Button>
      <Button type="primary" loading={busy} disabled={!selectedReasons.length && !detail.trim()} onClick={onSubmit}>提交</Button>
    </div>}
  >
    {error ? <Alert className="ai-work-chat__feedback-error" type="error" showIcon message={error} /> : null}
    <p className="ai-work-chat__feedback-prompt">{rating === "positive" ? "这条回复哪些方面做得好？" : "这条回复哪些方面需要改进？"}</p>
    <div className="ai-work-chat__feedback-reasons" role="group" aria-label="选择反馈原因">
      {rating ? AI_MESSAGE_FEEDBACK_REASONS[rating].map(reason => <button
        key={reason}
        type="button"
        aria-pressed={selectedReasons.includes(reason)}
        className={selectedReasons.includes(reason) ? "is-selected" : ""}
        disabled={busy}
        onClick={() => onToggleReason(reason)}
      ><span aria-hidden="true">+</span>{reason}</button>) : null}
    </div>
    <Input.TextArea
      className="ai-work-chat__feedback-detail"
      value={detail}
      maxLength={2000}
      showCount
      rows={5}
      aria-label="反馈详情，可选"
      placeholder="填写详情（选填）"
      disabled={busy}
      onChange={event => onDetailChange(event.target.value)}
    />
    <p className="ai-work-chat__feedback-note">可选择一个原因，或直接填写补充说明。反馈会保存在此会话中。</p>
  </Modal>;
}
