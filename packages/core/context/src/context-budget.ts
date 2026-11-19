// 运行内上下文预算：压缩早期工具结果、必要时丢弃过老轮次，并在供应商报上下文超限时提供降级依据。
import type { LlmMessage } from "@lfaa/llm";

/** 单次运行默认允许发送给模型的上下文字符预算（约 40k–60k tokens 的中英混排文本）。 */
export const DEFAULT_CONTEXT_BUDGET_CHARS = 160_000;
/** 压缩时始终完整保留的最近轮次数（一轮 = assistant 工具调用 + 对应工具结果）。 */
export const KEEP_RECENT_ROUNDS = 4;
/** 压缩标记：调用方据此幂等更新同一提示，不重复插入。 */
export const COMPACTION_MARKER = "【上下文压缩】";

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

  const lastUserIndex = messages.reduce((last, message, index) => (message.role === "user" ? index : last), 0);
  const groups = buildGroups(messages, lastUserIndex);
  const recentStart = groups.length > keepRecent ? groups[groups.length - keepRecent]!.start : lastUserIndex;

  // 第一步：保留结构，只压缩最近轮次之前的工具结果与过长正文。
  for (let index = 1; index < recentStart; index += 1) {
    const message = messages[index]!;
    if (message.role === "tool" && message.content.length > toolCap) {
      message.content = `${tail(message.content, toolCap)}\n…[较早工具结果已压缩]`;
      truncatedResults += 1;
    } else if (message.role === "assistant" && !message.toolCalls?.length && message.content.length > 2_000) {
      message.content = `${message.content.slice(0, 2_000)}…[较早回复已压缩]`;
    }
  }

  // 第二步：仍超预算时，从最早处整组丢弃，直到进入预算或只剩最近轮次。
  if (countChars(messages) > budget) {
    const keepFrom = groups.length > keepRecent ? groups[groups.length - keepRecent]!.start : lastUserIndex;
    const removed = new Set<number>();
    for (const group of groups) {
      if (group.start >= keepFrom) break;
      removed.add(group.start);
    }
    const kept = messages.filter((_, index) => index === 0 || !removed.has(index));
    droppedMessages = messages.length - kept.length;
    messages.length = 0;
    messages.push(...kept);
    // 丢弃后重新压缩剩余早期结果，进一步贴近预算。
    const remainingLastUser = messages.reduce((last, message, index) => (message.role === "user" ? index : last), 0);
    const remainingGroups = buildGroups(messages, remainingLastUser);
    const remainingRecent = remainingGroups.length > keepRecent
      ? remainingGroups[remainingGroups.length - keepRecent]!.start
      : remainingLastUser;
    for (let index = 1; index < remainingRecent; index += 1) {
      const message = messages[index]!;
      if (message.role === "tool" && message.content.length > toolCap) {
        message.content = `${tail(message.content, toolCap)}\n…[较早工具结果已压缩]`;
        truncatedResults += 1;
      }
    }
  }

  const compacted = truncatedResults > 0 || droppedMessages > 0;
  if (compacted) {
    const note = `${COMPACTION_MARKER} 较早的 ${droppedMessages} 条消息已省略，${truncatedResults} 条工具结果已压缩为尾部片段。需要更多细节时请重新读取具体文件或行号，不要凭记忆推测。`;
    const existing = messages.findIndex((message) => message.content.startsWith(COMPACTION_MARKER));
    if (existing >= 0) messages[existing] = { role: "system", content: note };
    else messages.splice(1, 0, { role: "system", content: note });
  }

  return { messages, compacted, truncatedResults, droppedMessages };
}
