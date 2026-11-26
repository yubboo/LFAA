// 长期记忆的纯函数检索与去重工具：中文 bi-gram 分词、BM25 打分、时间衰减、作用域加权与预算截断。
import type { MemoryEntry, MemoryScope } from "./types";

/** 中文单字停用集合：这些字单独出现不携带检索信息，切词时先剔除。 */
const STOP_CHARS = new Set("的了是在和与及或也就都而并不很太更最把被给让使得之其该各每这那有".split(""));

/** 作用域权重：项目记忆最贴近当前任务，全局次之，会话级临时记忆最低。 */
const SCOPE_WEIGHT: Record<MemoryScope, number> = {
  project: 1,
  team: 0.9,
  global: 0.6,
  session: 0.5,
  run: 0.4,
};

/** 无词法命中时仍允许进入召回的作用域，用于同一会话/项目的工作上下文。 */
const CONTEXT_SCOPES: ReadonlySet<MemoryScope> = new Set(["project", "team"]);

/** 无词法命中时最多保留的上下文条目数，避免提示词被无关项目记忆占满。 */
const MAX_CONTEXT_ONLY = 2;

/**
 * 把文本切成检索词：英文/数字按词，中文按相邻两字（bi-gram）展开。
 * 相比原先 2–4 字正则切块，能覆盖「记忆库 / 忆库」这类跨词边界命中。
 */
export function tokenize(text: string): string[] {
  const normalized = text.toLowerCase();
  const tokens = new Set<string>();
  for (const run of normalized.match(/[\u4e00-\u9fff]+/gu) ?? []) {
    const chars = [...run].filter((char) => !STOP_CHARS.has(char));
    if (chars.length === 0) continue;
    if (chars.length === 1) {
      tokens.add(chars[0] ?? "");
      continue;
    }
    for (let index = 0; index + 1 < chars.length; index += 1) {
      tokens.add(`${chars[index]}${chars[index + 1]}`);
    }
  }
  for (const word of normalized.match(/[a-z0-9][a-z0-9._-]*/gu) ?? []) {
    // 单字符数字（编号、版本号）携带区分度，不能像英文虚词那样被丢掉。
    if (word.length >= 2 || /^\d$/u.test(word)) tokens.add(word);
  }
  tokens.delete("");
  return [...tokens];
}

/** 内容归一化：小写、去标点与空白，用于「是否同一条记忆」的精确判定。 */
export function contentKey(content: string): string {
  return content.toLowerCase().replace(/[\s,，.。;；:：!！?？、"'“”‘’()（）[\]{}<>《》/\\|~`-]+/gu, "");
}

/** 文本相似度（0–1）：两边检索词的 Jaccard 系数，供去重与冲突替代判定。 */
export function textSimilarity(left: string, right: string): number {
  const a = new Set(tokenize(left));
  const b = new Set(tokenize(right));
  if (a.size === 0 || b.size === 0) return 0;
  return sharedTokenCount(left, right) / (a.size + b.size - sharedTokenCount(left, right));
}

/** 两边共有的检索词数量：中文改写后相似度会被拉低，替代判定需要这个绝对量兜底。 */
export function sharedTokenCount(left: string, right: string): number {
  const a = new Set(tokenize(left));
  const b = new Set(tokenize(right));
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared;
}

/** 作用域是否对当前查询可见：全局始终可见，项目/团队/会话/运行按归属匹配。 */
export function isScopeVisible(
  entry: Pick<MemoryEntry, "scope" | "projectId" | "ownerId">,
  options: { projectId?: string | null; sessionId?: string | null; runId?: string | null },
): boolean {
  switch (entry.scope) {
    case "global":
      return true;
    case "project":
      return Boolean(options.projectId) && entry.projectId === options.projectId;
    case "team":
    case "session":
      return Boolean(options.sessionId) && entry.ownerId === options.sessionId;
    case "run":
      return Boolean(options.runId) && entry.ownerId === options.runId;
    default:
      return false;
  }
}

/** 时间衰减：以 30 天为半衰期，命中过的条目按 lastUsedAt 续期。 */
export function recencyScore(entry: Pick<MemoryEntry, "lastUsedAt" | "createdAt">, now: number): number {
  const anchor = entry.lastUsedAt > 0 ? entry.lastUsedAt : entry.createdAt || now;
  const days = Math.max(0, now - anchor) / 86_400_000;
  return 0.5 ** (days / 30);
}

/** 命中加权：召回次数越多越靠前，5 次封顶，避免热门条目长期霸榜。 */
export function hitScore(entry: Pick<MemoryEntry, "hits">): number {
  return Math.min(Math.max(entry.hits, 0), 5) / 5;
}

/** 单条记忆的固定附加开销：作用域/类型标签与换行，用于预算估算。 */
const ENTRY_OVERHEAD_CHARS = 16;

/** 单条记忆注入所需的字符数。 */
export function entryCost(entry: Pick<MemoryEntry, "content">): number {
  return entry.content.length + ENTRY_OVERHEAD_CHARS;
}

interface ScoredEntry {
  entry: MemoryEntry;
  score: number;
  lexical: number;
}

/** BM25 计算所需的文档统计量，只对候选集合计算一次。 */
function buildBm25Stats(candidates: MemoryEntry[]): {
  docTokens: Map<string, Map<string, number>>;
  docLengths: Map<string, number>;
  averageLength: number;
  documentFrequency: Map<string, number>;
} {
  const docTokens = new Map<string, Map<string, number>>();
  const docLengths = new Map<string, number>();
  const documentFrequency = new Map<string, number>();
  let totalLength = 0;
  for (const entry of candidates) {
    const tokens = tokenize(`${entry.content} ${entry.tags.join(" ")}`);
    const termFrequency = new Map<string, number>();
    for (const token of tokens) termFrequency.set(token, (termFrequency.get(token) ?? 0) + 1);
    docTokens.set(entry.id, termFrequency);
    docLengths.set(entry.id, tokens.length);
    totalLength += tokens.length;
    for (const token of termFrequency.keys()) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }
  return {
    docTokens,
    docLengths,
    averageLength: candidates.length > 0 ? totalLength / candidates.length : 0,
    documentFrequency,
  };
}

/**
 * 给候选记忆打分并排序：词法 BM25 为主，叠加作用域、时效、命中与置信度。
 * 纯函数，不读写文件，便于单测与后续替换为向量混合打分。
 */
export function rankMemories(
  candidates: MemoryEntry[],
  options: { query: string; projectId?: string | null; sessionId?: string | null; runId?: string | null; now?: number },
): ScoredEntry[] {
  const now = options.now ?? Date.now();
  const queryTokens = [...new Set(tokenize(options.query))];
  const visible = candidates.filter(
    (entry) => !entry.supersededBy
      && (entry.expiresAt === undefined || entry.expiresAt === null || entry.expiresAt > now)
      && isScopeVisible(entry, options),
  );
  if (visible.length === 0) return [];

  const stats = buildBm25Stats(visible);
  const total = visible.length;
  const queryIdf = new Map<string, number>();
  for (const token of queryTokens) {
    const df = stats.documentFrequency.get(token) ?? 0;
    queryIdf.set(token, Math.log(1 + (total - df + 0.5) / (df + 0.5)));
  }
  const maxIdfSum = [...queryIdf.values()].reduce((sum, value) => sum + Math.max(value, 0), 0);

  const scored: ScoredEntry[] = visible.map((entry) => {
    const termFrequency = stats.docTokens.get(entry.id) ?? new Map<string, number>();
    const length = stats.docLengths.get(entry.id) ?? 0;
    let raw = 0;
    for (const token of queryTokens) {
      const frequency = termFrequency.get(token) ?? 0;
      if (frequency === 0) continue;
      const idf = queryIdf.get(token) ?? 0;
      const k1 = 1.4;
      const b = 0.6;
      const denominator = frequency + k1 * (1 - b + b * (length / Math.max(stats.averageLength, 1)));
      raw += idf * ((frequency * (k1 + 1)) / denominator);
    }
    const lexical = maxIdfSum > 0 ? Math.min(1, raw / (maxIdfSum * 1.6)) : 0;
    const score = 2.2 * lexical
      + 0.8 * SCOPE_WEIGHT[entry.scope]
      + 0.6 * recencyScore(entry, now)
      + 0.4 * hitScore(entry)
      + 0.1 * clamp01(entry.confidence);
    return { entry, score, lexical };
  });

  const lexicalHits = scored.filter((item) => item.lexical > 0);
  const contextOnly = scored
    .filter((item) => item.lexical === 0 && CONTEXT_SCOPES.has(item.entry.scope))
    .sort((left, right) => right.score - left.score)
    .slice(0, MAX_CONTEXT_ONLY);
  return [...lexicalHits, ...contextOnly].sort((left, right) => right.score - left.score);
}

/** 把打分结果按条数与字符预算截断，保证注入提示词的体量可控。 */
export function selectWithinBudget(
  ranked: ScoredEntry[],
  options: { limit: number; budgetChars: number },
): MemoryEntry[] {
  const selected: MemoryEntry[] = [];
  let used = 0;
  for (const { entry } of ranked) {
    if (selected.length >= options.limit) break;
    const cost = entryCost(entry);
    if (selected.length > 0 && used + cost > options.budgetChars) break;
    selected.push(entry);
    used += cost;
  }
  return selected;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}