/**
 * 移植思路来自 deepseek-harness packages/core/agent-loop/src/runtime-context.ts（MIT，commit 639ed01）。
 * LFAA 适配：DSH 版本基于 session-projection 的事件流投影；LFAA 的 agent-loop 直接操作
 * 内存中的 AiCompletionMessage[]（completionMessages），因此本模块面向该数组提供：
 *   - 上下文压力（token）估算
 *   - compaction / spill 触发点钩子（这是分片要求的关键接线）
 *   - 压缩区间选择（保持 tool_calls / tool_result 成对不被切断）
 *
 * 文件：runtime-context.ts
 * 功能：会话运行时上下文的“规模感知”层，是 agent-loop 在每次发模型请求前决定是否压缩/溢出的唯一入口。
 * 作用：execute-turn 在组装好本次请求消息后调用 assessAndManage()；若压力超阈值，则调用注入的
 *       compaction / spill 钩子对消息数组做就地收缩，返回是否发生了改写。
 * 不负责：真正执行摘要 LLM 调用或写盘；那是 compaction-basic / spill-local 的职责。
 */
import type { AiCompletionMessage } from "lfaa-llm/src/completion.js";
import { logger } from "lfaa-telemetry-logger/src/logger.js";
import {
  CHARS_PER_TOKEN,
  COMPACTION_PRESSURE_RATIO,
  FALLBACK_CONTEXT_WINDOW_TOKENS,
  SPILL_PRESSURE_RATIO,
} from "./constants.js";

/** 一次发模型请求前，运行时上下文观测到的压力快照。 */
export interface ContextPressure {
  /** 估算的已用 token。 */
  usedTokens: number;
  /** 模型上下文窗口（token）。 */
  contextWindow: number;
  /** usedTokens / contextWindow。 */
  ratio: number;
  /** 是否达到触发 compaction 的比例。 */
  needsCompaction: boolean;
  /** 是否达到触发 spill 的更高比例。 */
  needsSpill: boolean;
}

/**
 * 上下文管理钩子：由 compaction / spill 实现包注入。
 * agent-loop 只依赖这个最小接口，不反向 import 具体实现（保持分片解耦）。
 */
export interface ContextManagerHooks {
  /**
   * 自动压缩：当上下文压力达到阈值时，把 messages 中较早的一段替换成一条摘要消息。
   * 实现应保持 tool_calls/tool_result 成对，并返回改写后的新数组；无需改写时原样返回。
   * 返回 null 表示本次未压缩（失败/取消/不满足条件），agent-loop 继续正常请求。
   */
  compact?: (input: {
    messages: AiCompletionMessage[];
    contextWindow: number;
    reason: "pressure" | "manual";
    signal?: AbortSignal;
  }) => Promise<AiCompletionMessage[] | null>;

  /**
   * 溢出：把单条超大消息（典型是工具结果）卸载到外部存储，原位替换为引用提示。
   * 返回改写后的新数组；无需卸载时原样返回。返回 null 表示本次未卸载。
   */
  spill?: (input: {
    messages: AiCompletionMessage[];
    contextWindow: number;
    signal?: AbortSignal;
  }) => Promise<AiCompletionMessage[] | null>;
}

/** 取一条消息的纯文本长度（含 tool_calls 的参数 JSON），用于启发式估算。 */
function messageTextLength(message: AiCompletionMessage): number {
  let length = message.role.length;
  const content = message.content;
  if (typeof content === "string") length += content.length;
  else if (Array.isArray(content)) {
    for (const part of content) if (part.type === "text") length += part.text.length;
  }
  if (Array.isArray(message.tool_calls)) {
    for (const call of message.tool_calls) {
      length += call.function.name.length + call.function.arguments.length;
    }
  }
  if (message.tool_call_id) length += message.tool_call_id.length;
  if (message.providerReplay) length += message.providerReplay.reasoningContent.length;
  return length;
}

/**
 * 启发式 token 估算。LFAA 没有 token-meter（占位包），这里用字符数 / CHARS_PER_TOKEN。
 * 中文场景略偏保守，足以驱动“是否该压缩”的二值判断。
 */
export function estimateMessagesTokens(messages: readonly AiCompletionMessage[]): number {
  let chars = 0;
  for (const message of messages) chars += messageTextLength(message);
  return Math.ceil(chars / CHARS_PER_TOKEN);
}

/** 观测当前消息数组的上下文压力。 */
export function assessContextPressure(
  messages: readonly AiCompletionMessage[],
  contextWindow?: number,
): ContextPressure {
  const window = contextWindow && contextWindow > 0 ? contextWindow : FALLBACK_CONTEXT_WINDOW_TOKENS;
  const usedTokens = estimateMessagesTokens(messages);
  const ratio = window > 0 ? usedTokens / window : 0;
  return {
    usedTokens,
    contextWindow: window,
    ratio,
    needsCompaction: ratio >= COMPACTION_PRESSURE_RATIO,
    needsSpill: ratio >= SPILL_PRESSURE_RATIO,
  };
}

/**
 * 选择压缩区间：保留尾部最近 N 轮（按 user 消息切分），从最早一条可压缩消息开始，
 * 保证起点不切断一个 tool_calls/tool_result 对。
 * 返回 [startIndex, endIndexExclusive]；无可压缩区间返回 null。
 *
 * 规则（对齐 DSH selectCompactionRange）：
 *   - 不保留 leading system 消息在被压缩段内（system 通常是系统提示，压缩段从其后开始）；
 *   - 保留尾部最近若干个 user 回合；
 *   - 起点对齐：若起点是 tool 消息（孤儿结果），向后退到其配对的 assistant tool_calls 之前；
 *     若起点是 assistant 且带 tool_calls，则把这些未闭合调用一起纳入压缩段。
 */
export function selectCompactionRange(
  messages: readonly AiCompletionMessage[],
  preserveRecentUserTurns = 4,
): { start: number; end: number } | null {
  const total = messages.length;
  if (total < 4) return null;

  // 找到尾部保留边界：从末尾往前数 preserveRecentUserTurns 个 user 消息，它们及其之后全部保留。
  let userSeen = 0;
  let retainFrom = total;
  for (let i = total - 1; i >= 0; i--) {
    if (messages[i]!.role === "user") {
      userSeen += 1;
      if (userSeen > preserveRecentUserTurns) {
        retainFrom = i + 1;
        break;
      }
    }
  }
  if (userSeen <= preserveRecentUserTurns) return null; // 历史太短，没必要压

  // 压缩段候选从 index 0 开始；跳过开头的 system 消息（系统提示不压）。
  let start = 0;
  while (start < retainFrom && messages[start]!.role === "system") start += 1;
  if (start >= retainFrom) return null;

  // 对齐起点：如果 start 落在 tool 消息上，说明它配对的 assistant tool_calls 在被丢弃段更前面，
  // 这种“孤儿结果”应随其调用一起压缩——向后退到该 tool 消息之前最近的 assistant。
  if (messages[start]!.role === "tool") {
    // tool 消息必须紧跟在带 tool_calls 的 assistant 之后；若它前面就是 user/system，则直接从该 tool 起压也安全。
    // 我们把起点前移到它前面的 assistant（若存在且未在 system 区）。
    for (let j = start - 1; j >= 0; j--) {
      if (messages[j]!.role === "assistant" && Array.isArray(messages[j]!.tool_calls)) {
        start = j;
        break;
      }
      if (messages[j]!.role === "user") break;
    }
  }

  const end = retainFrom;
  if (end - start < 2) return null;
  return { start, end };
}

/**
 * 在组装请求前执行上下文管理钩子。这是分片要求的“compaction/spill 调用钩子”实际接线点。
 *
 * 行为：
 *   1. 估算压力；
 *   2. 若 needsSpill 且注入了 spill 钩子，先做溢出（把超大工具结果外置）；
 *   3. 若 needsCompaction 且注入了 compact 钩子，做压缩；
 *   4. 返回新的消息数组与是否发生改写（用于让 execute-turn 决定是否重算请求上下文）。
 *
 * 注意：这是“按上下文规模触发”的机制，不是写死流程——没有钩子注入时它原样返回，行为与现状完全一致。
 */
export async function manageContextBeforeRequest(input: {
  messages: AiCompletionMessage[];
  contextWindow?: number;
  hooks?: ContextManagerHooks;
  signal?: AbortSignal;
}): Promise<{ messages: AiCompletionMessage[]; pressure: ContextPressure; rewritten: boolean }> {
  const pressure = assessContextPressure(input.messages, input.contextWindow);
  const hooks = input.hooks;
  if (!hooks) return { messages: input.messages, pressure, rewritten: false };

  let messages = input.messages;
  let rewritten = false;

  if (input.signal?.aborted) return { messages, pressure, rewritten };

  if (pressure.needsSpill && hooks.spill) {
    try {
      const spilled = await hooks.spill({
        messages,
        contextWindow: pressure.contextWindow,
        ...(input.signal ? { signal: input.signal } : {})
      });
      if (spilled && spilled !== messages) { messages = spilled; rewritten = true; }
    } catch (error) {
      // spill 失败不阻断主循环，但必须留下可诊断记录；静默失败会让“未压缩/未溢出”看起来像已生效。
      if (!input.signal?.aborted) logger.warn("Agent 上下文溢出钩子失败；继续主循环", { stage: "spill", errorName: error instanceof Error ? error.name : "UnknownError" });
    }
  }

  if (pressure.needsCompaction && hooks.compact) {
    try {
      const compacted = await hooks.compact({
        messages,
        contextWindow: pressure.contextWindow,
        reason: "pressure",
        ...(input.signal ? { signal: input.signal } : {})
      });
      if (compacted && compacted !== messages) { messages = compacted; rewritten = true; }
    } catch (error) {
      // 压缩失败同样不阻断主循环；保留诊断，避免把失败的压缩误认为已完成。
      if (!input.signal?.aborted) logger.warn("Agent 上下文压缩钩子失败；继续主循环", { stage: "compact", errorName: error instanceof Error ? error.name : "UnknownError" });
    }
  }

  return { messages, pressure, rewritten };
}
