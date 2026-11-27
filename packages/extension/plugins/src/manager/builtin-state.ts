// 内置插件的启停持久化：记录被停用的模块名，启动时据此给对应 Loader 条目置 disabled。
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

/** profile 内的内置插件启停记录。 */
export class BuiltinStateStore {
  constructor(private readonly filePath: string) {}

  /** 读取停用清单；文件不存在或损坏时按空清单处理。 */
  async read(): Promise<Set<string>> {
    if (!existsSync(this.filePath)) return new Set();
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8")) as { disabled?: unknown };
      return new Set(Array.isArray(parsed.disabled) ? parsed.disabled.filter((item): item is string => typeof item === "string") : []);
    } catch {
      return new Set();
    }
  }

  /** 原子写入停用清单。 */
  async write(disabled: Set<string>): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${randomUUID()}.tmp`;
    await writeFile(tmp, `${JSON.stringify({ disabled: [...disabled].sort() }, null, 2)}\n`, "utf8");
    await rename(tmp, this.filePath);
  }
}