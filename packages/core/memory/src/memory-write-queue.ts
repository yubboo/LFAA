// 长期记忆文件的安全读写层：进程内串行写队列、临时文件原子替换、按 mtime 热重载，避免并发写互相覆盖。
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

/** 按顺序执行的任务链：所有写入排在同一条 promise 链上，天然避免「读全量→改数组→覆写」的竞态。 */
export class JsonFileQueue<T> {
  private chain: Promise<unknown> = Promise.resolve();
  private cache: { mtimeMs: number; value: T } | null = null;
  private filePath: string;

  constructor(
    filePath: string,
    private readonly empty: () => T,
    private readonly normalize: (raw: unknown) => T,
  ) {
    this.filePath = filePath;
  }

  getFilePath(): string {
    return this.filePath;
  }

  /** 迁移资料库后切换文件地址，并丢弃旧路径缓存。 */
  setFilePath(nextPath: string): void {
    this.filePath = nextPath;
    this.cache = null;
  }

  /** 读取当前值：文件 mtime 变化（其它进程写入）时重新解析，否则命中缓存。 */
  async read(): Promise<T> {
    try {
      const info = await stat(this.filePath);
      if (this.cache && this.cache.mtimeMs === info.mtimeMs) return this.cache.value;
      const value = await this.parseFile();
      this.cache = { mtimeMs: info.mtimeMs, value };
      return value;
    } catch {
      const value = this.empty();
      this.cache = { mtimeMs: 0, value };
      return value;
    }
  }

  /** 整表写入：排在写队列末尾，写临时文件后原子替换。 */
  async write(next: T): Promise<T> {
    const run = this.enqueue(() => this.commit(next));
    return run;
  }

  /** 读改写：读取与写入都在队列内完成，避免丢失中间发生的其它写入。 */
  async update(mutator: (current: T) => T | Promise<T>): Promise<T> {
    return this.enqueue(async () => {
      const current = await this.read();
      const next = await mutator(current);
      await this.commit(next);
      return next;
    });
  }

  private enqueue<R>(task: () => Promise<R>): Promise<R> {
    const run = this.chain.then(task);
    // 链上保留失败态会阻塞后续写入，这里吞掉错误只用于续链。
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async parseFile(): Promise<T> {
    const raw = await readFile(this.filePath, "utf8");
    if (!raw.trim()) return this.empty();
    try {
      return this.normalize(JSON.parse(raw) as unknown);
    } catch {
      return this.empty();
    }
  }

  private async commit(next: T): Promise<T> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.${randomUUID().slice(0, 8)}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    await rename(tempPath, this.filePath);
    try {
      const info = await stat(this.filePath);
      this.cache = { mtimeMs: info.mtimeMs, value: next };
    } catch {
      this.cache = null;
    }
    return next;
  }
}