/**
 * 移植自 deepseek-harness packages/spill/spill-policy（MIT, commit 639ed01）。
 * 溢出策略：决定哪些消息该被外置。规则很简单——历史中（保留最近若干条）单条 tool 消息的纯文本
 * 超过字符阈值，就交给 SpillStore 外置，原位替换为引用。
 *
 * 文件：index.ts
 * 功能：扫描消息数组，对超长历史工具结果执行溢出。
 * 作用：这是 agent-loop 上下文管理钩子中 spill 的策略实现。
 * 不负责：具体写盘（spill-local）。
 */
import type { AiCompletionMessage } from "lfaa-llm/src/completion.js";
import { formatSpillReference, type SpillStore } from "lfaa-spill/src/index.js";

/** 超过该字符数的历史工具结果会被外置。 */
export const DEFAULT_SPILL_RESULT_CHARS = 24_000;

/** 保留最近 N 条 tool 结果不外置（刚产生的结果模型正要用）。 */
export const DEFAULT_KEEP_RECENT_RESULTS = 2;

/**
 * 对消息数组应用溢出策略。返回新数组与实际外置的条数。
 * 单条溢出失败（写盘错误）不阻断——保留原文继续。
 */
export async function applySpillPolicy(input: {
  messages: readonly AiCompletionMessage[];
  sessionId: string;
  store: SpillStore;
  thresholdChars?: number;
  keepRecent?: number;
}): Promise<{ messages: AiCompletionMessage[]; spilledCount: number }> {
  const threshold = input.thresholdChars ?? DEFAULT_SPILL_RESULT_CHARS;
  const keepRecent = input.keepRecent ?? DEFAULT_KEEP_RECENT_RESULTS;

  // 标记最近 N 条 tool 结果为保留。
  const keep = new Set<number>();
  let seen = 0;
  for (let i = input.messages.length - 1; i >= 0 && seen < keepRecent; i--) {
    if (input.messages[i]!.role === "tool") { keep.add(i); seen += 1; }
  }

  let spilledCount = 0;
  const out: AiCompletionMessage[] = [];
  for (let i = 0; i < input.messages.length; i++) {
    const message = input.messages[i]!;
    if (message.role !== "tool" || keep.has(i) || typeof message.content !== "string" || message.content.length <= threshold) {
      out.push(message);
      continue;
    }
    try {
      const ref = await input.store.spill({ sessionId: input.sessionId, content: message.content });
      out.push({ ...message, content: formatSpillReference(ref) });
      spilledCount += 1;
    } catch {
      out.push(message); // 外置失败，保留原文
    }
  }
  return { messages: out, spilledCount };
}
