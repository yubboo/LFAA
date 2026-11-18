// 管理长期事实记忆存储（~/.lfaa/memory.json），支持按项目/全局写入、列表管理与关键词召回。
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AddMemoryInput, MemoryEntry } from "./types";

function tokenizeQuery(text: string): string[] {
  const normalized = text.toLowerCase().trim();
  if (!normalized) return [];
  const words = normalized.split(/[\s,.;:!?，。；：！？、/\\()[\]{}"']+/u).filter((w) => w.length >= 2);
  const cjk = normalized.match(/[\u4e00-\u9fff]{2,4}/gu) ?? [];
  return [...new Set([...words, ...cjk])];
}

/** 读写按项目或全局范围保存的长期记忆，提供会话恢复所需的查询入口。 */
export class LongTermMemoryStore {
  constructor(private filePath: string) {}

  setFilePath(nextPath: string): void {
    this.filePath = nextPath;
  }

  getFilePath(): string {
    return this.filePath;
  }

  private async readEntries(): Promise<MemoryEntry[]> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (item): item is MemoryEntry =>
          typeof item === "object" && item !== null && typeof (item as MemoryEntry).id === "string",
      );
    } catch {
      return [];
    }
  }

  private async writeEntries(entries: MemoryEntry[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(entries, null, 2), "utf8");
  }

  async list(options: { projectId?: string | null; query?: string } = {}): Promise<MemoryEntry[]> {
    const entries = await this.readEntries();
    const q = options.query?.trim().toLowerCase() ?? "";
    return entries
      .filter((entry) => {
        if (options.projectId !== undefined && entry.scope === "project" && entry.projectId !== options.projectId) {
          return false;
        }
        if (q && !entry.content.toLowerCase().includes(q) && !entry.tags.some((t) => t.toLowerCase().includes(q))) {
          return false;
        }
        return true;
      })
      .sort((left, right) => right.updatedAt - left.updatedAt);
  }

  async add(input: AddMemoryInput): Promise<MemoryEntry> {
    const content = input.content.trim();
    if (!content) {
      throw new Error("记忆内容不能为空。");
    }
    const entries = await this.readEntries();
    const scope = input.scope ?? (input.projectId ? "project" : "global");
    const projectId = scope === "project" ? (input.projectId ?? null) : null;
    const duplicate = entries.find(
      (item) =>
        item.scope === scope
        && item.projectId === projectId
        && item.content.toLowerCase() === content.toLowerCase(),
    );
    const now = Date.now();
    if (duplicate) {
      const refreshed: MemoryEntry = {
        ...duplicate,
        tags: [...new Set([...duplicate.tags, ...(input.tags ?? [])])],
        updatedAt: now,
      };
      await this.writeEntries(entries.map((e) => (e.id === duplicate.id ? refreshed : e)));
      return refreshed;
    }

    const entry: MemoryEntry = {
      id: randomUUID(),
      scope,
      projectId,
      content,
      tags: (input.tags ?? []).map((t) => t.trim()).filter(Boolean),
      ...(input.sourceSessionId ? { sourceSessionId: input.sourceSessionId } : {}),
      createdAt: now,
      updatedAt: now,
    };
    await this.writeEntries([entry, ...entries]);
    return entry;
  }

  async remove(memoryId: string): Promise<boolean> {
    const entries = await this.readEntries();
    const next = entries.filter((item) => item.id !== memoryId);
    if (next.length === entries.length) return false;
    await this.writeEntries(next);
    return true;
  }

  // 根据作用域与关键词相关度召回最匹配的长期记忆条目，注入本轮系统上下文。
  async recall(options: { query: string; projectId?: string | null; limit?: number }): Promise<MemoryEntry[]> {
    const entries = await this.readEntries();
    const tokens = tokenizeQuery(options.query);
    const limit = options.limit ?? 6;

    const scored = entries
      .filter((entry) => entry.scope === "global" || (options.projectId && entry.projectId === options.projectId))
      .map((entry, idx) => {
        const haystack = `${entry.content} ${entry.tags.join(" ")}`.toLowerCase();
        let score = entry.scope === "project" && entry.projectId === options.projectId ? 2 : 0.5;
        for (const token of tokens) {
          if (haystack.includes(token)) score += 3;
        }
        score += Math.max(0, 1 - idx * 0.02);
        return { entry, score };
      })
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map((item) => item.entry);
  }
}
