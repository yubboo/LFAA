// 记忆库的纯筛选与展示辅助：供设置中心记忆页与单测共用，不触碰 DOM 与网络。
import type { ChatLocaleMessages } from "../locales";
import type { LongTermMemoryItem, MemoryKindItem, MemoryStatsItem } from "../store/chat-types";

/** 记忆类型在界面上的固定展示顺序，与 Host 的 kind 白名单一致。 */
export const MEMORY_KIND_ORDER: readonly MemoryKindItem[] = ["preference", "fact", "decision", "pitfall", "convention"];

/** 记忆库的筛选条件：空关键词表示不过滤。 */
export interface MemoryFilter {
  query: string;
  kind: MemoryKindItem | "all";
}

/** 按类型与关键词过滤，并按最近更新时间倒序；关键词同时匹配正文与标签。 */
export function filterMemories(
  memories: readonly LongTermMemoryItem[],
  filter: MemoryFilter,
): LongTermMemoryItem[] {
  const query = filter.query.trim().toLowerCase();
  return memories
    .filter((memory) => filter.kind === "all" || memory.kind === filter.kind)
    .filter((memory) => {
      if (!query) return true;
      return memory.content.toLowerCase().includes(query)
        || memory.tags.some((tag) => tag.toLowerCase().includes(query));
    })
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

/** 把更新时间压成紧凑的本地时间，窄屏也不占太多横向空间。 */
export function formatMemoryTime(timestamp: number, isZh: boolean): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "";
  return new Date(timestamp).toLocaleString(isZh ? "zh-CN" : "en-US", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
/** 记忆类型对应的本地化名称。 */
export function memoryKindLabel(locale: ChatLocaleMessages, kind: MemoryKindItem): string {
  switch (kind) {
    case "preference":
      return locale.memoryKindPreference;
    case "decision":
      return locale.memoryKindDecision;
    case "pitfall":
      return locale.memoryKindPitfall;
    case "convention":
      return locale.memoryKindConvention;
    default:
      return locale.memoryKindFact;
  }
}

/** 作用域名称：团队/会话记忆只在当前会话内共享，界面要标出来。 */
export function memoryScopeLabel(locale: ChatLocaleMessages, scope: LongTermMemoryItem["scope"]): string {
  if (scope === "project") return locale.projectScope;
  if (scope === "team") return locale.memoryScopeTeam;
  if (scope === "session") return locale.memoryScopeSession;
  return locale.globalScope;
}

/** 一条记忆的摘要：类型、作用域、命中次数与来源。 */
export function memoryMetaText(locale: ChatLocaleMessages, memory: LongTermMemoryItem): string {
  const parts = [memoryKindLabel(locale, memory.kind), memoryScopeLabel(locale, memory.scope), `${locale.memoryHitsLabel} ${memory.hits}`];
  const sourceSession = memory.source?.sessionId;
  if (memory.agentId?.startsWith("subagent:")) {
    parts.push(`${locale.memorySourceLabel} ${locale.memorySubagentSource} ${memory.agentId.slice("subagent:".length)}`);
  } else if (sourceSession) {
    parts.push(`${locale.memorySourceLabel} ${sourceSession.slice(0, 8)}`);
  }
  const time = formatMemoryTime(memory.updatedAt, locale.isZh);
  if (time) parts.push(time);
  return parts.join(" · ");
}

/** 统计行：优先用 Host 给的统计，缺失时用当前列表兜底。 */
export function memoryStatsText(
  locale: ChatLocaleMessages,
  memories: readonly LongTermMemoryItem[],
  stats: MemoryStatsItem | null,
): string {
  const active = stats?.active ?? memories.filter((memory) => !memory.supersededBy).length;
  const superseded = stats?.superseded ?? memories.filter((memory) => memory.supersededBy).length;
  const archived = stats?.archived ?? 0;
  return [
    `${active} ${locale.memoryStatsActive}`,
    `${superseded} ${locale.memoryStatsSuperseded}`,
    `${archived} ${locale.memoryStatsArchived}`,
  ].join(" · ");
}