/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），
 * 包名 @deepseek-ai/dsh-compaction。
 *
 * 文件：tool-pairing.ts
 * 功能：在消息数组上校验"tool_calls / tool 结果"成对，并据此对齐压缩区间边界。
 *
 * 背景：压缩会删掉/替换中间一段历史，安全切点不能落在一个"assistant 带 tool_calls
 * 但其 tool 结果还没出现"的位置上——否则下一次请求里那个 tool_call_id 就悬空了。
 * DSH 在 Session.surface 上用 WeakMap 缓存代际平衡；LFAA 直接在 AiCompletionMessage[]
 * 上现算（数组通常几百条，O(n) 可接受，且 LFAA 没有 surface 代际概念）。
 *
 * 本模块同时容纳第一轮已有的 alignCompactionStart/alignCompactionEnd 工具
 * （从 index.ts 迁入并扩展），保持外部导入路径兼容。
 */
import type { AiCompletionMessage } from "lfaa-llm/src/completion.js";

/**
 * 一条消息对"未闭合 tool_calls 计数"的增量。
 * - assistant 带 tool_calls：每条 tool_call 都要等一个 tool 结果，+n；
 * - tool 消息：配对一个未闭合调用，-1；
 * - 其他（system/user 纯文本）：0。
 */
function eventDelta(message: AiCompletionMessage): number {
  if (message.role === "assistant") {
    return Array.isArray(message.tool_calls) ? message.tool_calls.length : 0;
  }
  if (message.role === "tool") return -1;
  return 0;
}

/**
 * 计算 messages[0, index) 这个切分点处的"未闭合 tool_calls 数"。
 * 中途变负说明消息流本身损坏（tool 结果没有前置 assistant tool_calls），直接抛错。
 *
 * @param messages - 当前完整消息数组。
 * @param index - 切分点（messages[index] 之前）。
 */
export function openToolCallsBefore(
  messages: readonly AiCompletionMessage[],
  index: number,
): number {
  let open = 0;
  const stop = Math.min(Math.max(0, index), messages.length);
  for (let i = 0; i < stop; i++) {
    open += eventDelta(messages[i]!);
    if (open < 0) {
      throw new Error(
        `tool-pairing: 第 ${i} 条 tool 消息没有配对的 assistant tool_calls（消息流损坏）`,
      );
    }
  }
  return open;
}

/** messages[0, index] 切分点处（即 message[index] 之后）的未闭合 tool_calls 数。 */
export function openToolCallsAfter(
  messages: readonly AiCompletionMessage[],
  index: number,
): number {
  return openToolCallsBefore(messages, index + 1);
}

/**
 * 切在 message[index] 之前是否"工具对闭合"：跨过这个切分没有悬空 tool_call。
 * 压缩段起点必须落在 balancedBefore 上，否则会把"调用-结果"切开。
 */
export function toolPairingBalancedBefore(
  messages: readonly AiCompletionMessage[],
  index: number,
): boolean {
  return openToolCallsBefore(messages, index) === 0;
}

/**
 * 切在 message[index] 之后是否"工具对闭合"。
 * 压缩段终点必须落在 balancedAfter 上，否则段尾会留一个未闭合的 assistant tool_calls。
 */
export function toolPairingBalancedAfter(
  messages: readonly AiCompletionMessage[],
  index: number,
): boolean {
  return openToolCallsAfter(messages, index) === 0;
}

/** 一条消息是否携带未闭合的 tool_calls（其后必须跟 tool 结果）。 */
export function hasOpenToolCalls(message: AiCompletionMessage): boolean {
  return message.role === "assistant"
    && Array.isArray(message.tool_calls)
    && message.tool_calls.length > 0;
}

/**
 * 把候选压缩段的终点（exclusive）对齐到"工具对闭合"之后。
 * 若 end 之前最后一条是带 tool_calls 的 assistant（其结果在段外），把 end 前移到该 assistant 之前，
 * 避免把"调用-结果"切开导致下一次请求引用悬空 tool_call_id。
 *
 * @returns 对齐后的 endIndexExclusive（可能小于入参 end）。
 */
export function alignCompactionEnd(
  messages: readonly AiCompletionMessage[],
  end: number,
): number {
  const stop = Math.min(Math.max(0, end), messages.length);
  let open = 0, aligned = 0;
  for (let i = 0; i < stop; i++) {
    open += eventDelta(messages[i]!);
    if (open < 0) throw new Error("tool-pairing: 工具结果缺少前置调用。");
    if (open === 0) aligned = i + 1;
  }
  return aligned;
}

/**
 * 把候选压缩段的起点对齐到"工具对闭合"之前。
 * 若 start 落在 tool 消息上（它配对的 assistant tool_calls 在更前面），把 start 前移到该 assistant 之前，
 * 保证压缩段要么整对包含，要么整对排除。
 */
export function alignCompactionStart(
  messages: readonly AiCompletionMessage[],
  start: number,
): number {
  let aligned = start;
  if (messages[aligned]?.role !== "tool") return aligned;
  for (let j = aligned - 1; j >= 0; j--) {
    const candidate = messages[j]!;
    if (hasOpenToolCalls(candidate)) {
      aligned = j;
      break;
    }
    // 已经退到一个 user 消息还没找到配对的 assistant，说明这是孤儿 tool 结果，
    // 保留原对齐点（让上层 invariant 校验去报损坏）。
    if (candidate.role === "user") break;
  }
  return aligned;
}
