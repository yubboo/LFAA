// @lfaa/agent-profile 存储层：把配置文件读成 unknown、原子写回；读失败一律当「没有文件」处理。
// 原子写用「同目录临时文件 + rename」，避免进程中断留下半份 JSON 把 agent 配置写坏。
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

/** 单个 JSON 配置文件的最小读写封装；不做形状校验，形状由调用方归一。 */
export class JsonFileStore {
  /** 解析后的绝对路径，供日志与诊断使用。 */
  readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = resolve(filePath);
  }

  /** 读取并解析；文件缺失、为空或 JSON 损坏时返回 undefined，不抛错。 */
  async read(): Promise<unknown> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return JSON.parse(raw.replace(/^\uFEFF/u, ""));
    } catch {
      return undefined;
    }
  }

  /** 原子写入；失败时清理临时文件后把原始错误抛给调用方。 */
  async write(value: unknown): Promise<void> {
    const dir = dirname(this.filePath);
    await mkdir(dir, { recursive: true });
    const tempPath = join(dir, `.${basename(this.filePath)}.${process.pid}.${randomUUID()}.tmp`);
    try {
      await writeFile(tempPath, JSON.stringify(value, null, 2), "utf8");
      await rename(tempPath, this.filePath);
    } catch (error) {
      await unlink(tempPath).catch(() => undefined);
      throw error;
    }
  }
}