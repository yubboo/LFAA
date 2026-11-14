/**
 * 文件：MessageFeedbackControls.tsx
 * 功能：呈现助手消息的反馈按钮或已经提交的反馈状态。
 * 作用：派发评级回调，不决定能否反馈，也不发起 API 请求。
 * 关联文件：message-feedback-types.ts、packages/client/ui-chat/src/components/AiWorkMessageRow.tsx。
 */
import { Button, Tooltip } from "antd";
import type { MessageFeedbackControlsProps } from "./message-feedback-types.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";

export function MessageFeedbackControls({ feedback, disabled, onRate }: MessageFeedbackControlsProps) {
  if (feedback) return <span className={`ai-work-chat__feedback-status ai-work-chat__feedback-status--${feedback.rating}`} aria-label={feedback.rating === "positive" ? "已提交正向反馈" : "已提交改进反馈"} title={feedback.detail || feedback.reasons.join("、") || "已提交反馈"}>
    <WorkbenchIcon name={feedback.rating === "positive" ? "thumbUp" : "thumbDown"} size={15} /><span>已反馈</span>
  </span>;

  return <>
    <Tooltip title="回答有帮助"><Button className="ai-work-chat__message-action" type="text" size="small" aria-label="评价回复：有帮助" disabled={disabled} icon={<WorkbenchIcon name="thumbUp" size={15} />} onClick={() => onRate("positive")} /></Tooltip>
    <Tooltip title="回答需要改进"><Button className="ai-work-chat__message-action" type="text" size="small" aria-label="评价回复：需要改进" disabled={disabled} icon={<WorkbenchIcon name="thumbDown" size={15} />} onClick={() => onRate("negative")} /></Tooltip>
  </>;
}
