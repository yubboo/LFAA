// 记忆行为设置：自动提炼、条目上限与召回预算，存于 ~/.lfaa/memory-settings.json，与资料库数据分离。
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { MemorySettings } from "./types";

/** 默认记忆设置：自动提炼开启，800 条上限，每轮最多 8 条 / 1200 字。 */
export const DEFAULT_MEMORY_SETTINGS: MemorySettings = {
  autoExtract: true,
  maxEntries: 800,
  recallLimit: 8,
  recallBudgetChars: 1200,
};

/** 解析记忆设置文件地址，允许隔离测试覆盖默认路径。 */
export function getMemorySettingsFilePath(overridePath?: string): string {
  if (overridePath) return resolve(overridePath);
  return join(resolve(homedir() || process.env.USERPROFILE || process.env.HOME || "."), ".lfaa", "memory-settings.json");
}

/** 逐字段校验设置，非法值回落到默认值。 */
export function normalizeMemorySettings(raw: unknown): MemorySettings {
  const base = DEFAULT_MEMORY_SETTINGS;
  if (!raw || typeof raw !== "object") return { ...base };
  const item = raw as Partial<MemorySettings>;
  const clampInt = (value: unknown, fallback: number, min: number, max: number): number =>
    typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
  return {
    autoExtract: typeof item.autoExtract === "boolean" ? item.autoExtract : base.autoExtract,
    maxEntries: clampInt(item.maxEntries, base.maxEntries, 50, 5000),
    recallLimit: clampInt(item.recallLimit, base.recallLimit, 1, 24),
    recallBudgetChars: clampInt(item.recallBudgetChars, base.recallBudgetChars, 200, 8000),
  };
}

/** 读取并持久化记忆设置；文件缺失或损坏时回落到默认值并重写。 */
export class MemorySettingsStore {
  private cached: MemorySettings | null = null;

  constructor(private readonly filePath: string = getMemorySettingsFilePath()) {}

  getFilePath(): string {
    return this.filePath;
  }

  async get(): Promise<MemorySettings> {
    if (this.cached) return this.cached;
    try {
      const raw = await readFile(this.filePath, "utf8");
      this.cached = normalizeMemorySettings(JSON.parse(raw) as unknown);
    } catch {
      // 首次运行或文件损坏时只用默认值，不在读取阶段落盘，避免测试或只读挂载产生副作用。
      this.cached = { ...DEFAULT_MEMORY_SETTINGS };
    }
    return this.cached;
  }

  async update(patch: Partial<MemorySettings>): Promise<MemorySettings> {
    const current = await this.get();
    this.cached = normalizeMemorySettings({ ...current, ...patch });
    await this.persist(this.cached);
    return this.cached;
  }

  private async persist(next: MemorySettings): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  }
}