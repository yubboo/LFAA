/**
 * 移植自 deepseek-harness packages/compaction/compaction-image-offload（MIT, commit 639ed01）。
 * 图像卸载策略：历史消息里的图像（base64 data URL）是上下文大户；把它们从发给模型的消息里摘除，
 * 原位替换为一句引用说明，既省 token 又不丢失“这里曾经有一张图”的事实。
 *
 * 文件：index.ts
 * 功能：扫描消息数组，把非尾部的图像内容替换为占位文本。
 * 作用：作为 compaction 的前置轻量策略，或独立的上下文管理钩子。
 * 不负责：把图像持久化到外部存储（那是 spill 的职责）；只做“从发给模型的上下文里拿掉”。
 */
import type { AiCompletionContentPart, AiCompletionMessage } from "lfaa-llm/src/completion.js";

/** 保留最近 N 条带图消息不卸载（当前正在观察的屏幕截图必须留在上下文里）。 */
export const DEFAULT_KEEP_RECENT_IMAGES = 1;

/**
 * 卸载历史图像。返回新的消息数组；若没有可卸载图像则原样返回。
 * @param keepRecentImages 保留末尾最近 N 条带图消息不动。
 */
export function offloadHistoricalImages(
  messages: readonly AiCompletionMessage[],
  keepRecentImages = DEFAULT_KEEP_RECENT_IMAGES,
): AiCompletionMessage[] {
  // 从右往左数带图消息，标记最近 N 条为“保留”。
  const keep = new Set<number>();
  let seen = 0;
  for (let i = messages.length - 1; i >= 0 && seen < keepRecentImages; i--) {
    if (hasImage(messages[i]!)) { keep.add(i); seen += 1; }
  }

  return messages.map((message, index) => {
    if (keep.has(index)) return message;
    if (!Array.isArray(message.content)) return message;
    if (!message.content.some((part) => part.type === "image_url")) return message;
    const textParts = message.content.filter((part): part is Extract<AiCompletionContentPart, { type: "text" }> => part.type === "text");
    const text = textParts.map((part) => part.text).join("\n");
    return {
      ...message,
      content: [text, "[历史图像已从上下文卸载；恢复会话后如需重新观察，请重新截图。]"].filter(Boolean).join("\n")
    };
  });
}

function hasImage(message: AiCompletionMessage): boolean {
  return Array.isArray(message.content) && message.content.some((part) => part.type === "image_url");
}
