/**
 * 文件：message-feedback-types.ts
 * 功能：声明反馈界面的评级和受控组件属性合同。
 * 作用：类型直接派生 Connection 的反馈数据，不定义持久化或授权规则。
 * 关联文件：MessageFeedbackControls.tsx、MessageFeedbackDialog.tsx、client/connection/src/api.ts。
 */
import type { AiMessage, AiMessageFeedbackInput } from "lfaa-client-connection/src/api.js";

export type AiMessageFeedbackRating = AiMessageFeedbackInput["rating"];
export type AiMessageFeedbackRecord = NonNullable<AiMessage["feedback"]>;

export interface MessageFeedbackControlsProps {
  feedback: AiMessage["feedback"];
  disabled: boolean;
  onRate: (rating: AiMessageFeedbackRating) => void;
}

export interface MessageFeedbackDialogProps {
  open: boolean;
  rating: AiMessageFeedbackRating | null;
  selectedReasons: readonly string[];
  detail: string;
  error: string;
  busy: boolean;
  getContainer: () => HTMLElement;
  onClose: () => void;
  onSubmit: () => void;
  onToggleReason: (reason: string) => void;
  onDetailChange: (detail: string) => void;
}
