/**
 * 文件：feedback-reasons.ts
 * 功能：维护消息反馈表单允许选择的展示理由。
 * 作用：理由值仍作为原 Session 反馈 API 的 reasons 字段提交。
 * 关联文件：MessageFeedbackDialog.tsx、message-feedback-types.ts。
 */
import type { AiMessageFeedbackRating } from "./message-feedback-types.js";

export const AI_MESSAGE_FEEDBACK_REASONS: Record<AiMessageFeedbackRating, string[]> = {
  positive: ["解决了我的问题", "遵循了我的指示", "代码/输出质量好", "快速高效", "有帮助的自主行为", "其他"],
  negative: ["没有解决问题", "没有遵循我的指示", "回答不够准确", "代码/输出质量需要改进", "不够有帮助", "其他"]
};
