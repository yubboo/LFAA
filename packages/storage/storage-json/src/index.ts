/**
 * 功能：提供 JSON 文件存储后端与二进制值编码。
 * 作用：以同步刷盘和原子替换发布完整文档；读取损坏文件时拒绝运行，避免覆盖用户数据。
 * 关联文件：storage-domain 的事务提交、session-persistence-jsonl 的追加记录与 bundle/base。
 */
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import type { Context } from "@deepseek-ai/cordis";

export function encode(value: unknown): string {
  return JSON.stringify(value, function (key, item: unknown) {
    const original: unknown = key ? (this as Record<string, unknown>)[key] : value;
    return original instanceof Uint8Array ? { $lfaaBinary: Buffer.from(original).toString("base64") } : item;
  }, 2);
}

export function decode(text: string): unknown {
  return JSON.parse(text, (_key, value: unknown) => {
    if (value && typeof value === "object" && Object.keys(value).length === 1 && "$lfaaBinary" in value) {
      const encoded = (value as { $lfaaBinary: unknown }).$lfaaBinary;
      if (typeof encoded !== "string" || Buffer.from(encoded, "base64").toString("base64") !== encoded) throw new Error("存储中的二进制值损坏。");
      return Buffer.from(encoded, "base64");
    }
    return value;
  });
}

// 临时文件与目标文件位于同一目录；先刷盘，再替换，读者不会看到半份 JSON。
export function atomicWrite(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${randomUUID()}.tmp`;
  const descriptor = openSync(temporary, "wx", 0o600);
  try { writeFileSync(descriptor, `${encode(value)}\n`); fsyncSync(descriptor); }
  finally { closeSync(descriptor); }
  renameSync(temporary, path);
  // POSIX 还需要刷目录项；Windows 不支持以同样方式打开目录。
  if (process.platform !== "win32") {
    const directory = openSync(dirname(path), "r");
    try { fsyncSync(directory); } finally { closeSync(directory); }
  }
}

export class JsonStorageBackend {
  constructor(readonly root: string) { mkdirSync(root, { recursive: true, mode: 0o700 }); }
  path(name: string): string {
    if (!/^[a-z][a-z0-9_-]*$/u.test(name)) throw new Error("存储单元名称无效。");
    return resolve(this.root, `${name}.json`);
  }
  read(name: string): unknown { const path = this.path(name); return existsSync(path) ? decode(readFileSync(path, "utf8")) : undefined; }
  write(name: string, value: unknown): void { atomicWrite(this.path(name), value); }
  remove(name: string): void { const path = this.path(name); if (existsSync(path)) unlinkSync(path); }
}

/** 文件配置与会话由单个控制端写入；多个 Agent 的请求在同一进程中提交。 */
export class FileLease {
  private readonly identity = randomUUID();
  private closed = false;
  constructor(private readonly path: string, exclusive?: (action: () => void) => void) {
    const claim = () => {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    if (existsSync(path)) {
      const previous = decode(readFileSync(path, "utf8")) as { pid?: unknown };
      if (!Number.isSafeInteger(previous.pid) || Number(previous.pid) < 1) throw new Error(`存储写锁损坏：${path}`);
      let alive = true;
      try { process.kill(Number(previous.pid), 0); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ESRCH") alive = false; else throw error; }
      if (alive) throw new Error("此数据目录已由另一个控制端使用；请连接已有服务或选择独立数据目录。");
      // 崩溃遗留锁只在确认原进程不存在后回收；wx 仍负责并发重启的最终互斥。
      if (!exclusive) throw new Error("上次存储进程异常退出，必须通过控制端协调回收写锁。");
      unlinkSync(path);
    }
    writeFileSync(path, encode({ pid: process.pid, identity: this.identity }), { flag: "wx", mode: 0o600 });
    };
    if (exclusive) exclusive(claim); else claim();
  }
  close(): void {
    if (this.closed) return;
    const record = decode(readFileSync(this.path, "utf8")) as { identity?: unknown };
    if (record.identity !== this.identity) throw new Error("存储写锁归属发生变化，拒绝释放其他进程的锁。");
    unlinkSync(this.path); this.closed = true;
  }
}

export const name = "storage-json";
export function apply(ctx: Context): void { ctx.provide("lfaaStorageJson", { JsonStorageBackend }); }
