import type { AiMessage } from "lfaa-client-connection/src/api.js";

export interface ConversationAnchorPreview {
  question: AiMessage;
  reply: AiMessage | null;
}

export function buildConversationAnchors(messages: AiMessage[]): ConversationAnchorPreview[] {
  const anchors: ConversationAnchorPreview[] = [];
  for (const message of messages) {
    if (message.role === "user") anchors.push({ question: message, reply: null });
    else if (anchors.length) anchors[anchors.length - 1]!.reply = message;
  }
  return anchors;
}

export function conversationAnchorLabel(content: string): string {
  const compactContent = content.replace(/\s+/gu, " ").trim();
  let label = "";
  let characterCount = 0;
  for (const character of compactContent) {
    if (characterCount === 38) return `${label}…`;
    label += character;
    characterCount += 1;
  }
  return label;
}

export function conversationAnchorReply(reply: AiMessage | null): string {
  if (!reply) return "尚无助手回复";
  const content = reply.content.replace(/\s+/gu, " ").trim();
  if (content) return content;
  if (reply.status === "queued") return "回复排队中";
  if (reply.status === "streaming") return "正在生成回复";
  if (reply.status === "error") return "回复失败";
  if (reply.status === "interrupted") return "回复已中断";
  return "回复没有文字内容";
}
