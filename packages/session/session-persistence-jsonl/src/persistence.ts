/**
 * 功能：以 JSONL 追加日志保存 AI 会话及消息、用量的变更。
 * 作用：重放权威事件并幂等恢复跨文件事务；文件路径使用会话 ID 的摘要，拒绝路径穿越。
 * 关联文件：storage-domain 的控制域事务、storage-json 的值编码与 core/session。
 */
import { createHash, randomUUID } from "node:crypto";
import { closeSync, constants as fsConstants, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, truncateSync, writeFileSync } from "node:fs";
import { open as openFile } from "node:fs/promises";
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
  *readAll(): IterableIterator<SessionCommit> {
    this.applied.clear(); this.revisions.clear();
    for (const entry of readdirSync(this.root, { withFileTypes: true })) {
      if (entry.name === ".writer.lock") continue;
      if (!entry.isDirectory() || !/^[a-f0-9]{64}$/u.test(entry.name)) throw new Error("会话存储中存在未知目录项。");
      yield* this.readDirectory(resolve(this.root, entry.name));
    }
  }
  /** 冷会话按需恢复；每次仍验证完整哈希链，不能相信内存淘汰前的文件内容。 */
  *readSession(sessionId: string): IterableIterator<SessionCommit> {
    this.applied.delete(sessionId); this.revisions.delete(sessionId);
    yield* this.readDirectory(this.directory(sessionId));
  }
  /** 消息页保持完整哈希链单遍校验；工作集只含读取缓冲、当前事件与请求页。 */
  async readMessagePage(sessionId: string, before: { createdAt: string; order: number } | undefined, limit: number, observeEvent?: (event: SessionChange["value"]) => void): Promise<{ items: Array<{ message: SessionChange["value"]; feedback?: SessionChange["value"] }>; hasMore: boolean }> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("会话消息分页大小无效。");
    const candidates = new Map<string, Record<string, unknown>>();
    const orderedCandidates: Array<Record<string, unknown>> = [];
    const feedback = new Map<string, SessionChange["value"]>();
    const compare = (left: Record<string, unknown>, right: Record<string, unknown>) => String(left.created_at).localeCompare(String(right.created_at))
      || Number(left._order) - Number(right._order);
    const retainCandidate = (row: Record<string, unknown>) => {
      const id = String(row.id);
      const existing = candidates.get(id);
      const candidate = { ...row };
      if (existing) {
        const existingIndex = orderedCandidates.findIndex(item => String(item.id) === id);
        if (existingIndex >= 0) orderedCandidates.splice(existingIndex, 1);
      }
      let low = 0, high = orderedCandidates.length;
      while (low < high) {
        const middle = (low + high) >>> 1;
        if (compare(orderedCandidates[middle]!, candidate) <= 0) low = middle + 1;
        else high = middle;
      }
      orderedCandidates.splice(low, 0, candidate);
      candidates.set(id, candidate);
      while (orderedCandidates.length > limit + 1) {
        const removedId = String(orderedCandidates.shift()!.id);
        candidates.delete(removedId);
        feedback.delete(removedId);
      }
    };
    await this.scanChanges(sessionId, change => {
            if (change.table === "ai_messages" && change.value) {
              const row = change.value;
              if (row.session_id !== sessionId || typeof row.id !== "string" || typeof row.created_at !== "string" || !Number.isFinite(Number(row._order))) return;
              if (before && (row.created_at > before.createdAt || row.created_at === before.createdAt && Number(row._order) >= before.order)) return;
              retainCandidate(row);
            } else if (change.table === "session_events" && change.value) {
              observeEvent?.(change.value);
              if (change.value.type === "message/feedback") {
                const data = change.value.data;
                if (data && typeof data === "object" && "messageId" in data && candidates.has(String(data.messageId))) {
                  feedback.set(String(data.messageId), change.value);
                }
              }
            }
    });

    const ordered = orderedCandidates;
    const hasMore = ordered.length > limit;
    const page = ordered.slice(Math.max(0, ordered.length - limit));
    if (!page.length) return { items: [], hasMore: false };
    return {
      items: page.map(message => {
        const event = feedback.get(String(message.id));
        return event ? { message, feedback: event } : { message };
      }),
      hasMore
    };
  }
  /** 有界事件页复用消息页的完整哈希链扫描；投影函数只保留调用 Owner 允许的字段。 */
  async readEventPage(sessionId: string, after: number, limit: number, project: (event: Record<string, unknown>) => Record<string, unknown> | null, signal?: AbortSignal): Promise<{ items: Record<string, unknown>[]; hasMore: boolean }> {
    if (!Number.isSafeInteger(after) || after < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("会话事件分页参数无效。");
    const rows: Record<string, unknown>[] = [];
    await this.scanChanges(sessionId, change => {
      const event = change.table === "session_events" ? change.value : null;
      if (!event || !Number.isSafeInteger(event.seq) || Number(event.seq) <= after) return;
      const projected = project(event);
      if (!projected) return;
      const existing = rows.findIndex(row => row.seq === event.seq);
      if (existing >= 0) rows.splice(existing, 1);
      const index = rows.findIndex(row => Number(row.seq) > Number(event.seq));
      rows.splice(index < 0 ? rows.length : index, 0, projected);
      if (rows.length > limit + 1) rows.pop();
    }, signal);
    return { items: rows.slice(0, limit), hasMore: rows.length > limit };
  }
  /** 单遍异步校验同时服务消息页和事件页，不恢复整份正文或建立第二套日志。 */
  private async scanChanges(sessionId: string, onChange: (change: SessionChange) => void, signal?: AbortSignal): Promise<void> {
    const directory = this.directory(sessionId);
    const path = resolve(directory, "events.jsonl");
    if (!existsSync(path)) return;
    const entries = readdirSync(directory, { withFileTypes: true });
    for (const item of entries) {
      if (item.name === "events.jsonl" && item.isFile() && !item.isSymbolicLink()) continue;
      if (item.isFile() && /^events-[0-9a-f-]{36}\.tmp$/u.test(item.name)) continue;
      throw new Error("会话存储目录中存在未知文件。");
    }
    if (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink()) throw new Error("会话事件文件必须是普通文件。");

    let descriptor: Awaited<ReturnType<typeof openFile>> | undefined;
    let appliedTransactions: Set<string> | undefined;
    let expectedTransactionCount = 0;
    let fileSize = 0;
    for (let attempt = 0; attempt < 3; attempt++) {
      const candidate = await openFile(path, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
      try {
        const openedStat = await candidate.stat();
        const currentPathStat = lstatSync(path);
        if (!openedStat.isFile() || currentPathStat.isSymbolicLink()) throw new Error("会话事件文件必须是普通文件。");
        // 并发原子改写可能替换文件；流开始前固定同一代文件及事务快照。
        if (openedStat.dev !== currentPathStat.dev || openedStat.ino !== currentPathStat.ino) {
          await candidate.close();
          continue;
        }
        descriptor = candidate;
        fileSize = openedStat.size;
        appliedTransactions = this.applied.get(sessionId);
        expectedTransactionCount = appliedTransactions?.size ?? 0;
        break;
      } catch (error) {
        await candidate.close().catch(() => undefined);
        throw error;
      }
    }
    if (!descriptor) throw new Error("会话日志在分页读取期间持续变化，请稍后重试。");
    try {
      if (fileSize === 0) {
        if (expectedTransactionCount !== 0) throw new Error("会话事件事务索引与日志不一致。");
        return;
      }
      const stream = descriptor.createReadStream({ autoClose: false, highWaterMark: 64 * 1024, start: 0, end: fileSize - 1 });
      try {
        let fragments: Buffer[] = [], fragmentBytes = 0;
        let previous = { sequence: 0, checksum: "" };
        let lineCount = 0;
        const readLine = (parts: Buffer[], bytes: number) => {
          const line = (parts.length === 1 ? parts[0]! : Buffer.concat(parts, bytes)).toString("utf8");
          if (!line) return;
          const event = decode(line) as SessionEvent;
          if (event?.format !== 1 || event.sessionId !== sessionId || typeof event.transaction !== "string" || !Array.isArray(event.changes)
            || this.directory(event.sessionId) !== directory) throw new Error("会话 JSONL 事件损坏或版本不支持。");
          const { checksum, ...content } = event;
          if (event.sequence !== previous.sequence + 1 || event.previous !== previous.checksum
            || checksum !== createHash("sha256").update(encode(content)).digest("hex")
            || !appliedTransactions?.has(event.transaction)) throw new Error("会话事件顺序或完整性校验失败。");
          previous = { sequence: event.sequence, checksum };
          lineCount += 1;
          for (const change of event.changes) onChange(change);
        };
        for await (const rawChunk of stream) {
          signal?.throwIfAborted();
          const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk);
          let start = 0;
          while (start < chunk.length) {
            const end = chunk.indexOf(10, start);
            if (end < 0) {
              fragments.push(Buffer.from(chunk.subarray(start))); fragmentBytes += chunk.length - start;
              break;
            }
            if (end > start) { fragments.push(Buffer.from(chunk.subarray(start, end))); fragmentBytes += end - start; }
            readLine(fragments, fragmentBytes);
            fragments = []; fragmentBytes = 0; start = end + 1;
          }
        }
        // 未提交的尾行与恢复规则一致，忽略；已登记事务仍必须全部校验。
        if (lineCount !== expectedTransactionCount) throw new Error("会话事件事务索引与日志不一致。");
      } finally { stream.destroy(); }
    } finally { await descriptor.close(); }

  }
  private *readDirectory(directory: string): IterableIterator<SessionCommit> {
    if (!existsSync(directory)) return;
    for (const item of readdirSync(directory, { withFileTypes: true })) {
      if (item.name === "events.jsonl" && item.isFile() && !item.isSymbolicLink()) continue;
      if (item.isFile() && /^events-[0-9a-f-]{36}\.tmp$/u.test(item.name)) rmSync(resolve(directory, item.name), { force: true });
      else throw new Error("会话存储目录中存在未知文件。");
    }
    const path = resolve(directory, "events.jsonl");
    if (!existsSync(path)) return;
    const bytes = readFileSync(path);
    const boundary = bytes.lastIndexOf(10) + 1;
    // 断电留下的未完成末行从未提交；保留完整事件并截掉末行后由事务记录恢复。
    if (boundary !== bytes.length) truncateSync(path, boundary);
    for (const line of bytes.subarray(0, boundary).toString("utf8").split("\n").filter(Boolean)) {
      const event = decode(line) as SessionEvent;
      if (event?.format !== 1 || typeof event.sessionId !== "string" || typeof event.transaction !== "string" || !Array.isArray(event.changes) || this.directory(event.sessionId) !== directory) throw new Error("会话 JSONL 事件损坏或版本不支持。");
      const previous = this.revisions.get(event.sessionId) ?? { sequence: 0, checksum: "" };
      const { checksum, ...content } = event;
      if (event.sequence !== previous.sequence + 1 || event.previous !== previous.checksum || checksum !== createHash("sha256").update(encode(content)).digest("hex")) throw new Error("会话事件顺序或完整性校验失败。");
      this.revisions.set(event.sessionId, { sequence: event.sequence, checksum });
      const applied = this.applied.get(event.sessionId) ?? new Set<string>();
      if (applied.has(event.transaction)) throw new Error("会话 JSONL 存在重复事务。");
      applied.add(event.transaction); this.applied.set(event.sessionId, applied);
      yield event;
    }
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
