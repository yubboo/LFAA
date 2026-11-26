// 历史追问建议前缀：算出「每条消息之前已经出现过哪些建议」，供消息行去重。
// 流式输出里 messages 每帧都会换数组引用，纯按引用缓存会让 ChatMessageRow 的 memo 全部失效，
// 因此这里以「消息内容」为键做增量复用，内容没变就把上一次的数组引用原样交回。
import type { ChatMessageItem } from "../store/chat-types";
import { splitSuggestionBlock } from "./suggestion-block";

/** 空建议列表的共享引用：没有历史建议时所有行共用同一个数组，保证 memo 命中。 */
export const EMPTY_PRIOR_SUGGESTIONS: readonly string[] = [];

/** 单次解析缓存的上限：防止长时间切换大量会话后无限增长。 */
const PARSE_CACHE_LIMIT = 400;

/** 解析缓存：按消息 id 记住上次解析的内容与结果，正文不变就不重复扫描。 */
export type SuggestionParseCache = Map<string, { content: string; suggestions: string[] }>;

/** 判断两个建议列表内容是否一致；一致就复用旧数组，让下游 memo 继续生效。 */
export function sameSuggestions(prev: readonly string[] | undefined, next: readonly string[]): boolean {
  if (!prev || prev.length !== next.length) return false;
  for (let i = 0; i < next.length; i += 1) {
    if (prev[i] !== next[i]) return false;
  }
  return true;
}

/** 按消息顺序累积历史建议；返回数组与 messages 等长，第 i 项是第 i 条消息之前的所有建议。 */
export function collectPriorSuggestions(
  messages: readonly ChatMessageItem[],
  cache: SuggestionParseCache = new Map(),
): string[][] {
  if (cache.size > PARSE_CACHE_LIMIT) cache.clear();
  const prefixes: string[][] = [];
  let accumulated: string[] = [];
  for (const msg of messages) {
    prefixes.push(accumulated);
    if (msg.role !== "assistant") continue;
    const cached = cache.get(msg.id);
    const suggestions = cached && cached.content === msg.content
      ? cached.suggestions
      : (() => {
          const next = splitSuggestionBlock(msg.content).suggestions;
          cache.set(msg.id, { content: msg.content, suggestions: next });
          return next;
        })();
    if (suggestions.length > 0) accumulated = [...accumulated, ...suggestions];
  }
  return prefixes;
}

/** 与上一次结果逐条比对，内容相同的直接沿用旧引用；返回的数组可安全作为 memo 比较用的 prop。 */
export function stabilizePriorSuggestions(
  previous: readonly string[][],
  next: readonly string[][],
): string[][] {
  return next.map((value, index) => (sameSuggestions(previous[index], value) ? previous[index]! : value));
}