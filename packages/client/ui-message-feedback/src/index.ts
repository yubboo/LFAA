/**
 * 功能：声明并导出消息反馈界面组件。
 * 作用：由 lfaa-client-ui-chat 作为唯一聊天消费者静态加载。
 * 关联文件：MessageFeedbackControls.tsx、MessageFeedbackDialog.tsx、message-feedback.css。
 */
import "./message-feedback.css";

export { MessageFeedbackControls } from "./MessageFeedbackControls.js";
export { MessageFeedbackDialog } from "./MessageFeedbackDialog.js";
export { AI_MESSAGE_FEEDBACK_REASONS } from "./feedback-reasons.js";
export type { AiMessageFeedbackRating, AiMessageFeedbackRecord, MessageFeedbackControlsProps, MessageFeedbackDialogProps } from "./message-feedback-types.js";
