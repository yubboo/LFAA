/**
 * 移植自 deepseek-harness packages/compaction/compaction-tool-result-pruner（MIT, commit 639ed01）。
 * 工具结果裁剪策略：工具（尤其 shell / 文件读取）常常返回超长 stdout；历史里这类巨型结果占掉大量上下文。
 * 把历史中超过阈值的 tool 消息内容截断为“前 N 字符 + 省略说明”，保留头尾以便模型仍能判断。
 *
 * 文件：index.ts
 * 功能：裁剪超长历史工具结果。
 * 作用：作为 compaction 的轻量前置；在完整摘要之前先做便宜的截断。
 * 不负责：把内容外置到磁盘（spill 的职责）。
 */
import type { AiCompletionMessage } from "lfaa-llm/src/completion.js";

/** 单条 tool 消息内容字符超过该值即被裁剪。 */
export const DEFAULT_TOOL_RESULT_LIMIT_CHARS = 12_000;

/**
 * 裁剪历史超长工具结果。保留最近 keepRecent 条 tool 结果不裁（刚产生的结果模型正要用）。
 * 返回新数组；无可裁剪则原样返回。
 */
export function pruneLargeToolResults(
  messages: readonly AiCompletionMessage[],
  limitChars = DEFAULT_TOOL_RESULT_LIMIT_CHARS,
  keepRecent = 2,
): AiCompletionMessage[] {
  const keep = new Set<number>();
  let seen = 0;
  for (let i = messages.length - 1; i >= 0 && seen < keepRecent; i--) {
    if (messages[i]!.role === "tool") { keep.add(i); seen += 1; }
  }

  return messages.map((message, index) => {
    if (keep.has(index) || message.role !== "tool" || typeof message.content !== "string") return message;
    if (message.content.length <= limitChars) return message;
    const head = message.content.slice(0, Math.floor(limitChars * 0.7));
    const tail = message.content.slice(-Math.floor(limitChars * 0.2));
    return {
      ...message,
      content: `${head}\n…[工具结果过长，已裁剪 ${message.content.length - limitChars} 字符]…\n${tail}`
    };
  });
}
