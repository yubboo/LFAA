/**
 * 功能：以 JSONL 追加日志保存 AI 会话及消息、用量的变更。
 * 作用：重放权威事件并幂等恢复跨文件事务；文件路径使用会话 ID 的摘要，拒绝路径穿越。
 * 关联文件：storage-domain 的控制域事务、storage-json 的值编码与 core/session。
 */
import { createHash, randomUUID } from "node:crypto";
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, truncateSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { decode, encode, FileLease } from "lfaa-storage-json/src/index.js";

/** session_events 与消息/用量共用同一条受控 JSONL 持久化事务流。 */
export type SessionTable = "ai_sessions" | "ai_messages" | "ai_usage" | "session_events";
export interface SessionChange { table: SessionTable; key: string; value: Record<string, unknown> | null }
export interface SessionCommit { sessionId: string; transaction: string; changes: SessionChange[] }
interface SessionEvent { format: 1; sessionId: string; transaction: string; changes: SessionChange[]; sequence: number; previous: string; checksum: string }
export interface SessionRewriteResult { rewrittenTransactions: number; commits: SessionCommit[] }

export class JsonlSessionPersistence {
  private readonly applied = new Map<string, Set<string>>();
  private readonly revisions = new Map<string, { sequence: number; checksum: string }>();
  private readonly lease: FileLease;
  constructor(readonly root: string, exclusive?: (action: () => void) => void) { mkdirSync(root, { recursive: true, mode: 0o700 }); this.lease = new FileLease(resolve(root, ".writer.lock"), exclusive); }
  private directory(sessionId: string): string {
    if (!sessionId || sessionId.length > 256) throw new Error("会话 ID 无效。");
    return resolve(this.root, createHash("sha256").update(sessionId).digest("hex"));
  }
  readAll(): SessionCommit[] {
    const events: SessionCommit[] = [];
    this.applied.clear();
    this.revisions.clear();
    for (const entry of readdirSync(this.root, { withFileTypes: true })) {
      if (entry.name === ".writer.lock") continue;
      if (!entry.isDirectory() || !/^[a-f0-9]{64}$/u.test(entry.name)) throw new Error("会话存储中存在未知目录项。");
      const directory = resolve(this.root, entry.name);
      for (const item of readdirSync(directory, { withFileTypes: true })) {
        if (item.name === "events.jsonl") continue;
        if (item.isFile() && /^events-[0-9a-f-]{36}\.tmp$/u.test(item.name)) rmSync(resolve(directory, item.name), { force: true });
        else throw new Error("会话存储目录中存在未知文件。");
      }
      const path = resolve(directory, "events.jsonl");
      if (!existsSync(path)) continue;
      const bytes = readFileSync(path);
      const boundary = bytes.lastIndexOf(10) + 1;
      // 断电留下的未完成末行从未提交；保留完整事件并截掉末行后由事务记录恢复。
      if (boundary !== bytes.length) truncateSync(path, boundary);
      for (const line of bytes.subarray(0, boundary).toString("utf8").split("\n").filter(Boolean)) {
        const event = decode(line) as SessionEvent;
        if (event?.format !== 1 || typeof event.sessionId !== "string" || typeof event.transaction !== "string" || !Array.isArray(event.changes) || this.directory(event.sessionId) !== resolve(this.root, entry.name)) throw new Error("会话 JSONL 事件损坏或版本不支持。");
        const previous = this.revisions.get(event.sessionId) ?? { sequence: 0, checksum: "" };
        const { checksum, ...content } = event;
        if (event.sequence !== previous.sequence + 1 || event.previous !== previous.checksum || checksum !== createHash("sha256").update(encode(content)).digest("hex")) throw new Error("会话事件顺序或完整性校验失败。");
        this.revisions.set(event.sessionId, { sequence: event.sequence, checksum });
        const applied = this.applied.get(event.sessionId) ?? new Set<string>();
        if (applied.has(event.transaction)) throw new Error("会话 JSONL 存在重复事务。");
        applied.add(event.transaction); this.applied.set(event.sessionId, applied);
        events.push(event);
      }
    }
    return events;
  }
  append(commit: SessionCommit): void {
    const applied = this.applied.get(commit.sessionId) ?? new Set<string>();
    if (applied.has(commit.transaction)) return;
    const directory = this.directory(commit.sessionId);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const path = resolve(directory, "events.jsonl");
    const descriptor = openSync(path, "a", 0o600);
    try {
      const previous = this.revisions.get(commit.sessionId) ?? { sequence: 0, checksum: "" };
      const content = { format: 1 as const, ...commit, sequence: previous.sequence + 1, previous: previous.checksum };
      const event: SessionEvent = { ...content, checksum: createHash("sha256").update(encode(content)).digest("hex") };
      writeFileSync(descriptor, `${encode(event).replace(/\n\s*/gu, "")}\n`);
      fsyncSync(descriptor);
      this.revisions.set(commit.sessionId, { sequence: event.sequence, checksum: event.checksum });
    } finally { closeSync(descriptor); }
    applied.add(commit.transaction); this.applied.set(commit.sessionId, applied);
  }
  /** 重写单个会话日志并重新计算哈希链；调用方必须先校验账户归属并持有仓库事务锁。 */
  rewrite(sessionId: string, transform: (commit: SessionCommit) => SessionCommit): SessionRewriteResult {
    const directory = this.directory(sessionId);
    const path = resolve(directory, "events.jsonl");
    if (!existsSync(path)) return { rewrittenTransactions: 0, commits: [] };
    const bytes = readFileSync(path);
    const boundary = bytes.lastIndexOf(10) + 1;
    if (boundary !== bytes.length) truncateSync(path, boundary);
    const originalEvents: SessionEvent[] = [];
    const seenTransactions = new Set<string>();
    let previous = { sequence: 0, checksum: "" };
    for (const line of bytes.subarray(0, boundary).toString("utf8").split("\n").filter(Boolean)) {
      const event = decode(line) as SessionEvent;
      if (event?.format !== 1 || event.sessionId !== sessionId || typeof event.transaction !== "string" || !Array.isArray(event.changes)
        || this.directory(event.sessionId) !== directory) throw new Error("会话 JSONL 事件损坏或身份不匹配。");
      const { checksum, ...content } = event;
      if (event.sequence !== previous.sequence + 1 || event.previous !== previous.checksum || checksum !== createHash("sha256").update(encode(content)).digest("hex")
        || seenTransactions.has(event.transaction)) throw new Error("会话事件顺序、事务唯一性或完整性校验失败。");
      previous = { sequence: event.sequence, checksum };
      seenTransactions.add(event.transaction);
      originalEvents.push(event);
    }
    const commits = originalEvents;
    const rewritten = commits.map(commit => {
      const next = transform(structuredClone(commit));
      if (next.sessionId !== sessionId || next.transaction !== commit.transaction) throw new Error("会话重写不得改变日志身份或事务顺序。");
      return next;
    });
    if (!rewritten.some((commit, index) => encode(commit.changes) !== encode(commits[index]!.changes))) {
      return { rewrittenTransactions: 0, commits: originalEvents };
    }

    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const temporaryPath = resolve(directory, `events-${randomUUID()}.tmp`);
    previous = { sequence: 0, checksum: "" };
    const nextEvents: SessionEvent[] = [];
    const lines = rewritten.map(commit => {
      const content = { format: 1 as const, sessionId: commit.sessionId, transaction: commit.transaction, changes: commit.changes, sequence: previous.sequence + 1, previous: previous.checksum };
      const checksum = createHash("sha256").update(encode(content)).digest("hex");
      previous = { sequence: content.sequence, checksum };
      const event = { ...content, checksum };
      nextEvents.push(event);
      return `${encode(event).replace(/\n\s*/gu, "")}\n`;
    });
    let descriptor: number | undefined;
    try {
      descriptor = openSync(temporaryPath, "wx", 0o600);
      writeFileSync(descriptor, lines.join(""));
      fsyncSync(descriptor);
      closeSync(descriptor);
      descriptor = undefined;
      renameSync(temporaryPath, path);
    } catch (error) {
      if (descriptor !== undefined) closeSync(descriptor);
      rmSync(temporaryPath, { force: true });
      throw error;
    }
    this.applied.set(sessionId, new Set(rewritten.map(commit => commit.transaction)));
    this.revisions.set(sessionId, previous);
    return { rewrittenTransactions: rewritten.length, commits: nextEvents };
  }
  hasTransaction(sessionId: string, transaction: string): boolean { return this.applied.get(sessionId)?.has(transaction) ?? false; }
  remove(sessionId: string): void { rmSync(this.directory(sessionId), { recursive: true, force: true }); this.applied.delete(sessionId); this.revisions.delete(sessionId); }
  close(): void { this.lease.close(); }
}
