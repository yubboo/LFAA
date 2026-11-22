// 持久化工作树索引：只保存创建记录，真实目录与变更状态每次向文件系统和 Git 询问。
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { WorktreeRecord } from "../contract";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** 校验记录完整性，丢弃手改文件造成的脏数据。 */
export function isValidWorktreeRecord(item: unknown): item is WorktreeRecord {
  if (typeof item !== "object" || item === null) return false;
  const record = item as Record<string, unknown>;
  return isNonEmptyString(record.id)
    && isNonEmptyString(record.projectId)
    && isNonEmptyString(record.repositoryRoot)
    && isNonEmptyString(record.path)
    && isNonEmptyString(record.branch)
    && isNonEmptyString(record.baseCommit)
    && typeof record.createdAt === "number";
}

/** 工作树索引文件读写；目录不存在时自动创建。 */
export class WorktreeStore {
  constructor(private readonly storeFilePath: string) {}

  async read(): Promise<WorktreeRecord[]> {
    try {
      const raw = await readFile(this.storeFilePath, "utf8");
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(isValidWorktreeRecord) : [];
    } catch {
      return [];
    }
  }

  async write(records: WorktreeRecord[]): Promise<void> {
    await mkdir(dirname(this.storeFilePath), { recursive: true });
    await writeFile(this.storeFilePath, JSON.stringify(records, null, 2), "utf8");
  }
}