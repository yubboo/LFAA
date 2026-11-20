// 插件记录持久化：profile 下 installed.json 的读写、原子替换与 cordis.yml 同步回调。
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { PluginRecord } from "../contract/index";

interface StoredPluginsFile {
  records: PluginRecord[];
}

export class PluginRecordStore {
  constructor(
    private readonly storePath: string,
    private readonly ensureLayout: () => Promise<void>,
    private readonly syncCordisYml: (records: PluginRecord[]) => Promise<void>,
  ) {}

  async read(): Promise<PluginRecord[]> {
    if (!existsSync(this.storePath)) return [];
    try {
      const raw = await readFile(this.storePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<StoredPluginsFile>;
      return Array.isArray(parsed.records) ? parsed.records : [];
    } catch {
      return [];
    }
  }

  async write(records: PluginRecord[]): Promise<void> {
    await this.ensureLayout();
    await mkdir(dirname(this.storePath), { recursive: true });
    const tmp = `${this.storePath}.${randomUUID()}.tmp`;
    await writeFile(tmp, JSON.stringify({ records }, null, 2), "utf8");
    await rename(tmp, this.storePath);
    await this.syncCordisYml(records);
  }
}