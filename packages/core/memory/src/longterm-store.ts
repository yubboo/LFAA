// 管理长期事实记忆存储（<dataRoot>/long-term-memory.json）：结构化条目、去重合并、冲突替代、上限归档与关键词召回。
import { randomUUID } from "node:crypto";
import {
  clampConfidence,
  evictionScore,
  normalizeMemoryEntries,
  resolveArchivePath,
} from "./memory-entry";
import {
  contentKey,
  rankMemories,
  selectWithinBudget,
  sharedTokenCount,
  textSimilarity,
} from "./memory-ranking";
import { JsonFileQueue } from "./memory-write-queue";
import type {
  AddMemoryInput,
  ListMemoriesOptions,
  MemoryEntry,
  MemoryKind,
  MemoryStats,
  RecallMemoriesOptions,
} from "./types";

/** 内容近似到该阈值视为同一条记忆，只更新元数据，不再新增。 */
const DUPLICATE_SIMILARITY = 0.86;
/** 低于该相似度且没有共享词的条目不再考虑冲突替代，避免把无关记忆串成替代链。 */
const SUPERSEDE_MIN_SIMILARITY = 0.55;
/** 中文改写常把 Jaccard 拉到 0.5 以下；出现修正词且共享 3 个检索词时也允许替代。 */
const SUPERSEDE_SHARED_TOKENS = 3;
/** 出现这些词说明用户在修正旧结论，允许触发替代。 */
const REPLACEMENT_MARKER = /(?:改用|改成|换成|不再|不要|取消|废弃|替代|改为|instead|switch to|no longer)/iu;

export { normalizeMemoryEntry, resolveArchivePath } from "./memory-entry";

/** 读写按项目、团队或全局范围保存的长期记忆，提供会话恢复所需的查询入口。 */
export class LongTermMemoryStore {
  private readonly entries: JsonFileQueue<MemoryEntry[]>;
  private readonly archive: JsonFileQueue<MemoryEntry[]>;
  private maxEntries = 800;

  constructor(filePath: string, archiveFilePath = resolveArchivePath(filePath)) {
    this.entries = new JsonFileQueue<MemoryEntry[]>(filePath, () => [], normalizeMemoryEntries);
    this.archive = new JsonFileQueue<MemoryEntry[]>(archiveFilePath, () => [], normalizeMemoryEntries);
  }

  setFilePath(nextPath: string): void {
    this.entries.setFilePath(nextPath);
    this.archive.setFilePath(resolveArchivePath(nextPath));
  }

  getFilePath(): string {
    return this.entries.getFilePath();
  }

  /** 由设置在读取后同步上限，超出时归档最弱条目。 */
  setMaxEntries(value: number): void {
    if (Number.isFinite(value) && value >= 1) this.maxEntries = Math.round(value);
  }

  async list(options: ListMemoriesOptions = {}): Promise<MemoryEntry[]> {
    const entries = await this.entries.read();
    const q = options.query?.trim().toLowerCase() ?? "";
    return entries
      .filter((entry) => {
        if (!options.includeSuperseded && entry.supersededBy) return false;
        if (options.kind && entry.kind !== options.kind) return false;
        if (entry.scope === "team" || entry.scope === "session") {
          if (options.sessionId && entry.ownerId !== options.sessionId) return false;
        }
        if (entry.scope === "run" && (!options.runId || entry.ownerId !== options.runId)) return false;
        if (options.projectId !== undefined && entry.scope === "project" && entry.projectId !== options.projectId) {
          return false;
        }
        if (q && !entry.content.toLowerCase().includes(q) && !entry.tags.some((tag) => tag.toLowerCase().includes(q))) {
          return false;
        }
        return true;
      })
      .sort((left, right) => right.updatedAt - left.updatedAt);
  }

  /** 写入一条记忆：精确重复合并、近似重复去重、同结论修正则替代旧条目。 */
  async add(input: AddMemoryInput): Promise<MemoryEntry> {
    const content = input.content.trim();
    if (!content) throw new Error("记忆内容不能为空。");
    const scope = input.scope ?? (input.projectId ? "project" : "global");
    const sourceSessionId = input.source?.sessionId ?? input.sourceSessionId;
    const ownerId = scope === "team" || scope === "session" || scope === "run"
      ? (input.ownerId ?? sourceSessionId ?? null)
      : null;
    if ((scope === "team" || scope === "session" || scope === "run") && !ownerId) {
      throw new Error("团队/会话/运行记忆需要归属 ID。");
    }
    const projectId = scope === "project" ? (input.projectId ?? null) : null;
    const kind = input.kind ?? "fact";
    const now = Date.now();
    const key = contentKey(content);
    const tags = (input.tags ?? []).map((tag) => tag.trim()).filter(Boolean);
    const confidence = clampConfidence(input.confidence);
    const source = { ...input.source, ...(sourceSessionId ? { sessionId: sourceSessionId } : {}) };
    const inScope = (entry: MemoryEntry): boolean => entry.scope === scope
      && entry.projectId === projectId
      && entry.ownerId === ownerId
      && entry.kind === kind;

    const outcome: { entry?: MemoryEntry } = {};
    const evicted: MemoryEntry[] = [];
    await this.entries.update((entries) => {
      const exact = entries.find((entry) => inScope(entry) && contentKey(entry.content) === key);
      if (exact) {
        outcome.entry = {
          ...exact,
          tags: [...new Set([...exact.tags, ...tags])],
          confidence: Math.max(exact.confidence, confidence),
          updatedAt: now,
        };
        return entries.map((entry) => (entry.id === exact.id ? outcome.entry ?? entry : entry));
      }

      const similar = entries
        .filter((entry) => !entry.supersededBy && inScope(entry))
        .map((entry) => ({
          entry,
          similarity: textSimilarity(entry.content, content),
          shared: sharedTokenCount(entry.content, content),
        }))
        .sort((left, right) => right.similarity - left.similarity)[0];

      if (similar && similar.similarity >= DUPLICATE_SIMILARITY) {
        outcome.entry = {
          ...similar.entry,
          tags: [...new Set([...similar.entry.tags, ...tags])],
          confidence: Math.max(similar.entry.confidence, confidence),
          updatedAt: now,
        };
        return entries.map((entry) => (entry.id === outcome.entry?.id ? outcome.entry ?? entry : entry));
      }

      const nextEntry: MemoryEntry = {
        id: randomUUID(),
        kind,
        scope,
        projectId,
        ownerId,
        ...(input.agentId ? { agentId: input.agentId } : {}),
        content,
        tags,
        ...(input.source || sourceSessionId ? { source } : {}),
        confidence,
        hits: 0,
        lastUsedAt: now,
        createdAt: now,
        updatedAt: now,
        ...(sourceSessionId ? { sourceSessionId } : {}),
      };
      const superseded = similar
        && REPLACEMENT_MARKER.test(content)
        && (similar.similarity >= SUPERSEDE_MIN_SIMILARITY || similar.shared >= SUPERSEDE_SHARED_TOKENS)
        ? similar.entry
        : undefined;
      const withSupersede = superseded
        ? entries.map((entry) => (entry.id === superseded.id ? { ...entry, supersededBy: nextEntry.id, updatedAt: now } : entry))
        : entries;
      outcome.entry = superseded ? { ...nextEntry, supersedes: superseded.id } : nextEntry;
      return this.applyCapacity([outcome.entry, ...withSupersede], nextEntry.id, now, evicted);
    });
    if (evicted.length > 0) await this.archive.update((current) => [...evicted, ...current]);
    if (!outcome.entry) throw new Error("记忆写入失败。");
    return outcome.entry;
  }

  /** 界面编辑：只允许改内容、类型与标签，保留来源与生命周期字段。 */
  async updateEntry(memoryId: string, patch: { content?: string; kind?: MemoryKind; tags?: string[] }): Promise<MemoryEntry | null> {
    const now = Date.now();
    const outcome: { entry: MemoryEntry | null } = { entry: null };
    await this.entries.update((entries) => entries.map((entry) => {
      if (entry.id !== memoryId) return entry;
      outcome.entry = {
        ...entry,
        content: patch.content?.trim() || entry.content,
        kind: patch.kind ?? entry.kind,
        tags: patch.tags ? patch.tags.map((tag) => tag.trim()).filter(Boolean) : entry.tags,
        updatedAt: now,
      };
      return outcome.entry;
    }));
    return outcome.entry;
  }

  async remove(memoryId: string): Promise<boolean> {
    const before = await this.entries.read();
    if (!before.some((item) => item.id === memoryId)) return false;
    await this.entries.update((entries) => entries.filter((item) => item.id !== memoryId));
    return true;
  }

  /** 按作用域与相关度召回记忆，并回写命中次数与最近使用时间。 */
  async recall(options: RecallMemoriesOptions): Promise<MemoryEntry[]> {
    const entries = await this.entries.read();
    const ranked = rankMemories(entries, {
      query: options.query,
      ...(options.projectId !== undefined ? { projectId: options.projectId } : {}),
      ...(options.sessionId !== undefined ? { sessionId: options.sessionId } : {}),
      ...(options.runId !== undefined ? { runId: options.runId } : {}),
    });
    const selected = selectWithinBudget(ranked, {
      limit: options.limit ?? 8,
      budgetChars: options.budgetChars ?? 1200,
    });
    if (selected.length > 0) await this.markRecalled(selected.map((entry) => entry.id)).catch(() => undefined);
    return selected;
  }

  async markRecalled(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const now = Date.now();
    const wanted = new Set(ids);
    await this.entries.update((entries) => entries.map((entry) => (wanted.has(entry.id) && !entry.supersededBy
      ? { ...entry, hits: entry.hits + 1, lastUsedAt: now }
      : entry)));
  }

  /**
   * 归档一次 crew 运行的 run 记忆：先提炼成一条 team 记忆留给后续会话，
   * 再删除 run 条目并写入归档文件，保证运行期细节不会进入长期召回。
   */
  async archiveRunMemories(runId: string, sessionId: string): Promise<number> {
    const entries = await this.entries.read();
    const runs = entries.filter((entry) => entry.scope === "run" && entry.ownerId === runId);
    if (runs.length === 0) return 0;
    const digest = runs.map((entry) => entry.content).join("；");
    try {
      await this.add({
        kind: "fact",
        scope: "team",
        ownerId: sessionId,
        agentId: "crew",
        content: `[任务流水线] ${digest}`.slice(0, 200),
        tags: ["crew"],
        confidence: 0.7,
        source: { sessionId },
      });
    } catch {
      // 汇总失败不阻塞清理：run 条目仍归档，细节可从归档文件恢复。
    }
    await this.entries.update((current) => current.filter(
      (entry) => !(entry.scope === "run" && entry.ownerId === runId),
    ));
    void this.archive.update((current) => [...runs, ...current]).catch(() => undefined);
    return runs.length;
  }

  async stats(): Promise<MemoryStats> {
    const entries = await this.entries.read();
    const archived = await this.archive.read();
    const byKind = { preference: 0, fact: 0, decision: 0, pitfall: 0, convention: 0 } satisfies Record<MemoryKind, number>;
    for (const entry of entries) byKind[entry.kind] += 1;
    return {
      total: entries.length,
      active: entries.filter((entry) => !entry.supersededBy).length,
      superseded: entries.filter((entry) => entry.supersededBy).length,
      archived: archived.length,
      byKind,
    };
  }

  /** 超出上限时把最弱条目移入归档文件，只归档不删除。 */
  private applyCapacity(entries: MemoryEntry[], protectedId: string, now: number, evicted: MemoryEntry[]): MemoryEntry[] {
    const active = entries.filter((entry) => !entry.supersededBy);
    if (active.length <= this.maxEntries) return entries;
    const evictCount = active.length - this.maxEntries;
    const victims = new Set(active
      .filter((entry) => entry.id !== protectedId)
      .sort((left, right) => evictionScore(left, now) - evictionScore(right, now))
      .slice(0, evictCount)
      .map((entry) => entry.id));
    if (victims.size === 0) return entries;
    evicted.push(...entries.filter((entry) => victims.has(entry.id)));
    return entries.filter((entry) => !victims.has(entry.id));
  }
}