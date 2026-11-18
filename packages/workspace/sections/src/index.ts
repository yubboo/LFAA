// 声明自定义分区包的 Host 侧 Cordis 服务与无 DOM 领域契约，严禁导入 React、DOM 或 CSS。
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { type Context, Service } from "@deepseek-ai/cordis";
import type { CreateSectionInput, UpdateSectionInput, WorkspaceSectionSummary } from "./types";

export * from "./types";
export { createSectionsHttpHandler } from "./http-handler";

export interface SectionsPluginConfig {
  storeFilePath?: string;
}

const DEFAULT_SECTIONS_PATH = join(homedir(), ".lfaa", "sections.json");

function isValidSectionRecord(item: unknown): item is WorkspaceSectionSummary {
  if (typeof item !== "object" || item === null) return false;
  const record = item as Record<string, unknown>;
  return typeof record.id === "string"
    && typeof record.name === "string"
    && typeof record.createdAt === "number";
}

// Host 侧分区服务：管理用户自定义分区的增删改、重名检查与本地持久化。
export class SectionsService extends Service {
  private readonly storeFilePath: string;
  private readonly removedListeners = new Set<(sectionId: string) => void | Promise<void>>();

  constructor(ctx: Context, config: SectionsPluginConfig = {}) {
    super(ctx, "sections");
    this.storeFilePath = config.storeFilePath ? resolve(config.storeFilePath) : DEFAULT_SECTIONS_PATH;
  }

  onSectionRemoved(listener: (sectionId: string) => void | Promise<void>): () => void {
    this.removedListeners.add(listener);
    return () => {
      this.removedListeners.delete(listener);
    };
  }

  private async readStoredSections(): Promise<WorkspaceSectionSummary[]> {
    try {
      const raw = await readFile(this.storeFilePath, "utf8");
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isValidSectionRecord);
    } catch {
      return [];
    }
  }

  private async writeStoredSections(sections: WorkspaceSectionSummary[]): Promise<void> {
    await mkdir(dirname(this.storeFilePath), { recursive: true });
    await writeFile(this.storeFilePath, JSON.stringify(sections, null, 2), "utf8");
  }

  private assertUniqueName(sections: WorkspaceSectionSummary[], rawName: string, excludeId?: string): string {
    const trimmed = rawName.trim();
    if (!trimmed) {
      throw new Error("请输入分区名称。");
    }
    const key = trimmed.toLowerCase();
    if (sections.some((item) => item.id !== excludeId && item.name.trim().toLowerCase() === key)) {
      throw new Error(`分区名称“${trimmed}”已存在，请更换其他名称。`);
    }
    return trimmed;
  }

  async listSections(): Promise<WorkspaceSectionSummary[]> {
    const sections = await this.readStoredSections();
    return sections.sort((left, right) => left.createdAt - right.createdAt);
  }

  async createSection(input: CreateSectionInput): Promise<WorkspaceSectionSummary> {
    const existing = await this.readStoredSections();
    const name = this.assertUniqueName(existing, input.name);
    const created: WorkspaceSectionSummary = {
      id: randomUUID(),
      name,
      createdAt: Date.now(),
    };
    await this.writeStoredSections([...existing, created]);
    return created;
  }

  async updateSection(sectionId: string, input: UpdateSectionInput): Promise<WorkspaceSectionSummary | null> {
    const existing = await this.readStoredSections();
    const index = existing.findIndex((item) => item.id === sectionId);
    if (index < 0) return null;
    const name = this.assertUniqueName(existing, input.name, sectionId);
    const updated: WorkspaceSectionSummary = {
      ...existing[index]!,
      name,
    };
    const next = [...existing];
    next[index] = updated;
    await this.writeStoredSections(next);
    return updated;
  }

  async removeSection(sectionId: string): Promise<boolean> {
    const existing = await this.readStoredSections();
    const next = existing.filter((item) => item.id !== sectionId);
    if (next.length === existing.length) return false;
    await this.writeStoredSections(next);
    for (const listener of this.removedListeners) {
      await listener(sectionId);
    }
    return true;
  }
}

export function sectionsPlugin(context: Context, config: SectionsPluginConfig = {}): void {
  new SectionsService(context, config);
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    sections: SectionsService;
  }
}
