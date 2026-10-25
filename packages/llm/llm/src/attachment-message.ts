/**
 * 功能：把已持久化的图片附件转换成模型可看的内容块消息。
 * 作用：单点定义"工具产出图片 → 下一轮模型请求能看到它"的消息形状与边界，不读取存储、不写会话。
 * 关联文件：packages/attachment/attachment（类型与上限）、llm/llm/src/completion.ts、agent-loop/execute-turn.ts。
 */
import type { AiCompletionContentPart, AiCompletionMessage } from "./completion.js";
import { attachmentDataUrl, sniffImageMediaType, type AttachmentMediaType, type AttachmentRecord } from "lfaa-attachment/src/index.js";

/** 只有这些类型能作为图片块发送；文本附件不进入多模态内容。 */
const IMAGE_MEDIA_TYPES: readonly AttachmentMediaType[] = ["image/png", "image/jpeg", "image/gif", "image/webp"];

/** 一次请求里最多附带一张图片，避免单轮上下文被图片挤爆。 */
export const MAX_ATTACHMENT_IMAGES_PER_MESSAGE = 1;

/**
 * 构造一条 user 消息，让模型在下一轮请求中真正看到这张图片。
 * 内容与声明类型必须一致（按魔数复核），否则拒绝构造，不把不确定字节发给 Provider。
 */
export function buildAttachmentImageMessage(input: {
  record: Pick<AttachmentRecord, "id" | "name" | "mediaType">;
  data: Uint8Array;
  label?: string;
}): AiCompletionMessage {
  const { record, data } = input;
  if (!IMAGE_MEDIA_TYPES.includes(record.mediaType)) throw new Error("该附件不是受支持的图片类型，不能作为图片块发送。");
  const sniffed = sniffImageMediaType(data);
  if (sniffed !== record.mediaType) throw new Error("附件内容与声明类型不一致，已拒绝构造图片块。");
  const parts: AiCompletionContentPart[] = [
    { type: "text", text: input.label?.trim() || `附件图片：${record.name || record.id}` },
    { type: "image_url", image_url: { url: attachmentDataUrl(record, data), detail: "auto" } }
  ];
  return { role: "user", content: parts };
}
