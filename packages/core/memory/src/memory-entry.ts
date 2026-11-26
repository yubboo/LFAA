// 长期记忆条目的读取归一化与生命周期辅助函数：旧格式兼容、归档路径推导与淘汰打分。
import type { MemoryEntry, MemoryKind, MemoryScope } from "./types";
import { hitScore, recencyScore } from "./memory-ranking";

/** 允许的记忆类型，非法值写入时回落为事实。 */
export const MEMORY_KINDS: readonly MemoryKind[] = ["preference", "fact", "decision", "pitfall", "convention"];
/** 允许的记忆作用域，非法值写入时回落为全局。 */
export const MEMORY_SCOPES: readonly MemoryScope[] = ["global", "project", "team", "session"];

export function isMemoryKind(value: unknown): value is MemoryKind {
  return typeof value === "string" && (MEMORY_KINDS as readonly string[]).includes(value);
}

export function isMemoryScope(value: unknown): value is MemoryScope {
  return typeof value === "string" && (MEMORY_SCOPES as readonly string[]).includes(value);
}

/** 置信度归一化：非法值回落 0.7（人工/提炼写入的默认），越界夹到 0–1。 */
export function clampConfidence(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.7;
}

/** 归档文件与主文件同目录：`long-term-memory.json` → `long-term-memory.archive.json`。 */
export function resolveArchivePath(filePath: string): string {
  return filePath.replace(/\.json$/u, ".archive.json");
}

/** 兼容旧条目的读取归一化：缺字段补默认值，未知 scope/kind 回落到全局与事实。 */
export function normalizeMemoryEntry(raw: unknown): MemoryEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Partial<MemoryEntry>;
  if (typeof item.id !== "string" || typeof item.content !== "string" || !item.content.trim()) return null;
  const scope: MemoryScope = isMemoryScope(item.scope) ? item.scope : "global";
  const sourceSessionId = typeof item.sourceSessionId === "string" ? item.sourceSessionId : undefined;
  const source = item.source && typeof item.source === "object"
    ? item.source
    : sourceSessionId
      ? { sessionId: sourceSessionId }
      : undefined;
  const ownerId = typeof item.ownerId === "string"
    ? item.ownerId
    : scope === "team" || scope === "session"
      ? (source?.sessionId ?? null)
      : null;
  const createdAt = typeof item.createdAt === "number" ? item.createdAt : Date.now();
  const updatedAt = typeof item.updatedAt === "number" ? item.updatedAt : createdAt;
  return {
    id: item.id,
    kind: isMemoryKind(item.kind) ? item.kind : "fact",
    scope,
    projectId: typeof item.projectId === "string" ? item.projectId : null,
    ownerId,
    ...(typeof item.agentId === "string" ? { agentId: item.agentId } : {}),
    content: item.content.trim(),
    tags: Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === "string") : [],
    ...(source ? { source } : {}),
    confidence: typeof item.confidence === "number" ? clampConfidence(item.confidence) : 0.6,
    hits: typeof item.hits === "number" && item.hits > 0 ? Math.floor(item.hits) : 0,
    lastUsedAt: typeof item.lastUsedAt === "number" ? item.lastUsedAt : createdAt,
    ...(typeof item.supersedes === "string" ? { supersedes: item.supersedes } : {}),
    ...(typeof item.supersededBy === "string" ? { supersededBy: item.supersededBy } : {}),
    ...(item.expiresAt === null || typeof item.expiresAt === "number" ? { expiresAt: item.expiresAt } : {}),
    createdAt,
    updatedAt,
    ...(sourceSessionId ? { sourceSessionId } : {}),
  };
}

/** 解析整份文件：过滤无法识别的条目，保持数组顺序。 */
export function normalizeMemoryEntries(raw: unknown): MemoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => normalizeMemoryEntry(item))
    .filter((item): item is MemoryEntry => item !== null);
}

/** 归档淘汰打分：命中与新鲜度为主，项目/团队记忆与偏好类记忆获得保护。 */
export function evictionScore(entry: MemoryEntry, now: number): number {
  const scopeProtection = entry.scope === "project" || entry.scope === "team" ? 0.4 : 0;
  const kindProtection = entry.kind === "preference" || entry.kind === "convention" ? 0.3 : 0;
  return recencyScore(entry, now) * 0.6 + hitScore(entry) * 0.3 + scopeProtection + kindProtection;
}