/**
 * 文件：message-types.ts
 * 功能：定义聊天消息协调层与消息展示组件共用的内部状态/动作合同。
 * 作用：让 AiWorkChat 保持消息状态 Owner，同时允许 components 只消费窄 props。
 * 不负责：会话持久化、请求、运行授权或消息格式转换。
 * 关联文件：AiWorkChat.tsx、components/AiWorkMessageRow.tsx。
 */
import type { AiActivityItem, AiMessage } from "lfaa-client-connection/src/api.js";
import type { AiMessageFeedbackRating } from "lfaa-client-ui-message-feedback";

export type MessageUsage = { promptTokens: number | null; completionTokens: number | null; cacheReadTokens: number | null; providerId: string; modelId: string; models?: Array<{ providerId: string; modelId: string; requestCount: number }> };
export type EditingMessage = { messageId: string; content: string; phase: "stopping" | "ready" | "sending" };
export type ExpandedActivitySteps = { messageId: string; activityIds: ReadonlySet<string> };
export type PendingAiInteraction = { kind: "approval" | "question"; runId: string; activity: AiActivityItem };

export type AiWorkMessageActions = {
  copyMessage: (message: AiMessage) => Promise<void>;
  editUserMessage: (message: AiMessage, pairedAssistant: AiMessage) => Promise<void>;
  submitEditedMessage: () => Promise<void>;
  cancelMessageEditing: () => void;
  openMessageFeedback: (messageId: string, rating: AiMessageFeedbackRating) => void;
  toggleActivityStep: (messageId: string, activityId: string) => void;
  openWritingProposal: (proposalId: string) => Promise<void>;
  submitPromptSuggestion: (messageId: string, suggestion: string) => void;
};
