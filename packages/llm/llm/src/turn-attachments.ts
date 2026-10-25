/**
 * 功能：把一次请求携带的附件 ID 解析成模型可见的图片消息。
 * 作用：账户归属、数量与类型边界在这一处集中判断；不读会话、不写日志、失败不阻断本轮。
 * 关联文件：attachment/attachment（合同）、llm/llm/src/attachment-message.ts、agent-loop/execute-turn.ts。
 */
import type { AiCompletionMessage } from "./completion.js";
import { buildAttachmentImageMessage } from "./attachment-message.js";
import type { AttachmentStore } from "lfaa-attachment/src/index.js";

/** 单轮最多解析的附件数；超出的 ID 不处理，也不静默丢正文。 */
export const MAX_TURN_ATTACHMENTS = 4;
/** 单轮附件总字节上限：防止 4×8 MiB 一次灌进上下文与请求体。 */
export const MAX_TURN_ATTACHMENT_BYTES = 12 * 1024 * 1024;

export interface TurnAttachmentResolution {
  /** 已成功构造的图片消息，按输入顺序。 */
  messages: AiCompletionMessage[];
  /** 未能转成图片的附件说明（类型不符、已删除、不属于当前账户等）。 */
  skipped: Array<{ id: string; reason: string }>;
}

/**
 * 逐个解析附件 ID：只接受当前账户、可读、内容与声明类型一致的图片。
 * 任何一个附件失败只记录原因，不抛出，避免附件问题打断整轮对话。
 */
export async function resolveTurnAttachmentMessages(input: {
  store: AttachmentStore | undefined;
  userId: string;
  ids: readonly string[];
  max?: number;
}): Promise<TurnAttachmentResolution> {
  const messages: AiCompletionMessage[] = [];
  const skipped: Array<{ id: string; reason: string }> = [];
  const limit = Math.min(input.max ?? MAX_TURN_ATTACHMENTS, MAX_TURN_ATTACHMENTS);
  if (!input.store) return { messages, skipped: input.ids.slice(0, limit).map(id => ({ id, reason: "当前部署没有挂载附件服务。" })) };
  let totalBytes = 0;
  for (const id of input.ids.slice(0, limit)) {
    try {
      const content = await input.store.get(input.userId, id);
      if (totalBytes + content.data.byteLength > MAX_TURN_ATTACHMENT_BYTES) {
        skipped.push({ id, reason: "超过单轮附件总大小上限（" + MAX_TURN_ATTACHMENT_BYTES + " 字节）。" });
        continue;
      }
      const message = buildAttachmentImageMessage({ record: content.record, data: content.data });
      totalBytes += content.data.byteLength;
      messages.push(message);
    } catch (error) {
      skipped.push({ id, reason: error instanceof Error ? error.message : "附件不可用。" });
    }
  }
  return { messages, skipped };
}
