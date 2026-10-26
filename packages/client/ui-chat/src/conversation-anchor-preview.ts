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
  // 锚点标题只保留 38 个字符；处理固定短前缀即可，长提问不会在每帧重复压缩全文。
  const compactContent = content.slice(0, 512).replace(/\s+/gu, " ").trim();
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
  // 预览卡只显示三行，限制格式化长度，避免每次流式更新都压缩整条长回复。
  const content = reply.content.slice(0, 512).replace(/\s+/gu, " ").trim();
  const preview = reply.content.length > 512 ? `${content.slice(0, 320)}…` : content;
  if (preview) return preview;
  if (reply.status === "queued") return "回复排队中";
  if (reply.status === "streaming") return "正在生成回复";
  if (reply.status === "error") return "回复失败";
  if (reply.status === "interrupted") return "回复已中断";
  return "回复没有文字内容";
}
