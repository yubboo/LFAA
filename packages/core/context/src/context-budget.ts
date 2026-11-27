// 运行内上下文预算：压缩早期工具结果、必要时丢弃过老轮次，并在供应商报上下文超限时提供降级依据。
import type { LlmMessage } from "@lfaa/llm";

/** 单次运行默认允许发送给模型的上下文字符高水位（约 60k–80k tokens）：留足安全余量，让常规多轮任务全程 Append-Only 吃满 KV Cache。 */
export const DEFAULT_CONTEXT_BUDGET_CHARS = 240_000;
/** 触发压缩后一次性压到的低水位比例：避免后续每轮连续撞线反复改写前缀砸穿 KV Cache。 */
const COMPACTION_TARGET_RATIO = 0.55;
/** 压缩时始终完整保留的最近轮次数（一轮 = assistant 工具调用 + 对应工具结果）。 */
export const KEEP_RECENT_ROUNDS = 4;
/** 压缩标记：文案保持完全静态（不含变化计数），保证压缩后后续轮次前缀字节级一致。 */
export const COMPACTION_MARKER = "【上下文压缩】";
const STATIC_COMPACTION_NOTE = `${COMPACTION_MARKER} 较早的部分历史消息与工具结果已压缩或省略以释放上下文空间。需要具体细节时请重新读取对应文件或行号，不要凭记忆推测。`;

export interface CompactOptions {
  budgetChars: number;
  /** 早期工具结果压缩后保留的字符数。 */
  toolCapChars?: number;
  keepRecentRounds?: number;
}

export interface CompactResult {
  messages: LlmMessage[];
  compacted: boolean;
  truncatedResults: number;
  droppedMessages: number;
}

function messageChars(message: LlmMessage): number {
  const toolCallChars = message.toolCalls?.reduce(
    (sum, call) => sum + call.name.length + call.argumentsJson.length,
    0,
  ) ?? 0;
  return message.content.length + (message.reasoningContent?.length ?? 0) + toolCallChars;
}

function countChars(messages: ReadonlyArray<LlmMessage>): number {
  let total = 0;
  for (const message of messages) total += messageChars(message);
  return total;
}

function tail(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : `…${text.slice(text.length - maxChars)}`;
}

// 把 assistant 工具调用与其后续工具结果视为不可拆分的组，避免破坏工具调用配对协议。
function buildGroups(messages: ReadonlyArray<LlmMessage>, end: number): Array<{ start: number; end: number }> {
  const groups: Array<{ start: number; end: number }> = [];
  let index = 1;
  while (index < end) {
    const message = messages[index]!;
    if (message.role === "assistant" && (message.toolCalls?.length ?? 0) > 0) {
      let groupEnd = index + 1;
      while (groupEnd < end && messages[groupEnd]!.role === "tool") groupEnd += 1;
      groups.push({ start: index, end: groupEnd });
      index = groupEnd;
      continue;
    }
    groups.push({ start: index, end: index + 1 });
    index += 1;
  }
  return groups;
}

/** 判断错误是否属于“输入超过模型上下文长度”，供强制压缩后重试。 */
export function isContextOverflowError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : "";
  return /context[ _-]?length|maximum context|too many tokens|prompt is too long|reduce the length|token[s]? (?:exceed|limit)|超出.{0,8}(?:上下文|长度)|(?:上下文|长度).{0,8}(?:超限|超出|过长)/iu
    .test(`${message} ${cause}`);
}

/**
 * 按字符预算压缩一次运行的对话：先截断早期工具结果，仍超预算时从最早处整组丢弃，
 * 并插入一行可复用的压缩说明。system 首条与最近一轮、最后一条用户请求始终保留。
 */
export function compactConversation(input: ReadonlyArray<LlmMessage>, options: CompactOptions): CompactResult {
  const budget = Math.max(4_000, Math.floor(options.budgetChars));
  const keepRecent = Math.max(1, options.keepRecentRounds ?? KEEP_RECENT_ROUNDS);
  const toolCap = Math.max(200, options.toolCapChars ?? 1_200);
  const messages = input.map((message) => ({ ...message }));
  let truncatedResults = 0;
  let droppedMessages = 0;

  if (countChars(messages) <= budget) {
    return { messages, compacted: false, truncatedResults: 0, droppedMessages: 0 };
  }

  // 高/低水位滞回压缩：一旦触发就一次性压到低水位（默认 55% 预算），
  // 防止紧接着下一轮又超预算导致每轮改写前缀、持续砸穿大模型 KV Prompt Cache。
  const targetBudget = Math.max(4_000, Math.floor(budget * COMPACTION_TARGET_RATIO));
  const lastUserIndex = messages.reduce((last, message, index) => (message.role === "user" ? index : last), 0);
  const groups = buildGroups(messages, lastUserIndex);
  const recentStart = groups.length > keepRecent ? groups[groups.length - keepRecent]!.start : lastUserIndex;

  // 第一步：保留结构，压缩最近轮次之前的工具结果、过长正文及历史大体积写文件参数。
  for (let index = 1; index < recentStart; index += 1) {
    const message = messages[index]!;
    if (message.role === "tool" && message.content.length > toolCap) {
      message.content = `${tail(message.content, toolCap)}\n…[较早工具结果已压缩]`;
      truncatedResults += 1;
    } else if (message.role === "assistant" && message.toolCalls?.length) {
      let shrunkCalls = false;
      const nextCalls = message.toolCalls.map((call) => {
        if (call.argumentsJson.length <= toolCap * 2) return call;
        shrunkCalls = true;
        return { ...call, argumentsJson: `${call.argumentsJson.slice(0, Math.min(400, toolCap))}…[较早参数已压缩]` };
      });
      if (shrunkCalls) {
        message.toolCalls = nextCalls;
        truncatedResults += 1;
      }
    } else if (message.role === "assistant" && !message.toolCalls?.length && message.content.length > 2_000) {
      message.content = `${message.content.slice(0, 2_000)}…[较早回复已压缩]`;
    }
  }

  // 第二步：仍高于低水位目标时，从最早处按组丢弃直到回落到 targetBudget 以下（至少保留最近轮次）。
  if (countChars(messages) > targetBudget) {
    const keepFrom = groups.length > keepRecent ? groups[groups.length - keepRecent]!.start : lastUserIndex;
    const removed = new Set<number>();
    let currentChars = countChars(messages);
    for (const group of groups) {
      if (group.start >= keepFrom || currentChars <= targetBudget) break;
      // 整组删除（含 assistant 工具调用及其对应的全部 tool 消息），避免留下孤儿 tool 触发提供商 HTTP 400。
      for (let i = group.start; i < group.end; i += 1) {
        removed.add(i);
        currentChars -= messageChars(messages[i]!);
      }
    }
    const kept = messages.filter((_, index) => index === 0 || !removed.has(index));
    droppedMessages = messages.length - kept.length;
    messages.length = 0;
    messages.push(...kept);
  }

  const compacted = truncatedResults > 0 || droppedMessages > 0;
  if (compacted) {
    // 压缩说明使用完全静态文案且使用 user 角色（仅 messages[0] 保留为唯一 system），
    // 确保 Anthropic / Responses / Gemini 的顶层 system 缓存不受影响，且后续轮次前缀字节级一致。
    const existing = messages.findIndex((message) => message.content.startsWith(COMPACTION_MARKER));
    if (existing >= 0) messages[existing] = { role: "user", content: STATIC_COMPACTION_NOTE };
    else messages.splice(1, 0, { role: "user", content: STATIC_COMPACTION_NOTE });
  }

  return { messages, compacted, truncatedResults, droppedMessages };
}
