/**
 * 功能：提供 JSONL 会话仓库并迁移既有历史。
 * 作用：追加消息、活动和真实用量；SQLite 仅保存权限外键需要的会话头投影。
 * 关联文件：persistence.ts、core/session/sessions.ts、storage-domain/migration.ts。
 */
import { createHash, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { database } from "lfaa-storage-sqlite/src/database.js";
import { config } from "lfaa-launch-environment/src/config.js";
import { encode, JsonStorageBackend } from "lfaa-storage-json/src/index.js";
import { withControlLock } from "lfaa-storage-domain/src/control-lock.js";
import { JsonlSessionPersistence, type SessionChange, type SessionCommit, type SessionTable } from "./persistence.js";

export type SessionRecord = Record<string, unknown>;
const tables: SessionTable[] = ["ai_sessions", "ai_messages", "ai_usage", "session_events"];
function digest(value: unknown): string { return createHash("sha256").update(encode(value)).digest("hex"); }
export class SessionRepository {
  private readonly persistence = new JsonlSessionPersistence(resolve(config.dataDirectory, "sessions"), action => withControlLock(database, action));
  private readonly metadata = new JsonStorageBackend(resolve(config.dataDirectory, "storages"));
  private records = new Map<SessionTable, Map<string, SessionRecord>>(tables.map(table => [table, new Map()]));
  private readonly sessionEventsBySession = new Map<string, Map<string, SessionRecord>>();
  private readonly sessionRemovalListeners = new Set<(sessionIds: readonly string[]) => void>();
  private failed = false;
  constructor() {
    try {
      this.replay();
      const migration = this.metadata.read("session-migration") as { version?: unknown } | undefined;
      if (migration === undefined) this.migrate();
      else if (migration.version !== 1) throw new Error("会话迁移标记版本不支持。");
      if (Number(database.prepare("PRAGMA user_version").get()!.user_version) >= 31) {
        const cached = database.prepare("SELECT id, jsonl_revision FROM ai_sessions").all();
        for (const row of cached) if (!this.records.get("ai_sessions")!.has(String(row.id)) || typeof row.jsonl_revision === "string" && !this.persistence.hasTransaction(String(row.id), row.jsonl_revision)) throw new Error("会话日志缺失已提交历史，拒绝用不完整文件覆盖投影。");
      }
      withControlLock(database, () => { for (const header of this.records.get("ai_sessions")!.values()) this.project(header); });
      // 进程退出后尚未结束的回复不能继续表现为推理中；恢复也必须留下权威事件。
      const interrupted = [...this.records.get("ai_messages")!.values()].filter(row => row.status === "streaming");
      for (const message of interrupted) this.commit(String(message.session_id), [{ table: "ai_messages", key: String(message.id), value: { ...message, status: "interrupted" } }]);
    } catch (error) { this.persistence.close(); throw error; }
  }
  private apply(sessionId: string, changes: SessionChange[]): void {
    for (const change of changes) {
      if (!tables.includes(change.table) || typeof change.key !== "string" || !change.key) throw new Error("会话事件记录无效。");
      const record = change.value;
      if (record !== null && (!record || typeof record !== "object" || Array.isArray(record) || record.id !== change.key || (change.table === "ai_sessions" ? record.id : record.session_id) !== sessionId)) throw new Error("会话事件所属 ID 不一致。");
      this.storeRecord(change.table, change.key, record);
    }
  }
  private storeRecord(table: SessionTable, key: string, value: SessionRecord | null | undefined): void {
    const records = this.records.get(table)!;
    const old = records.get(key);
    const sessionId = String((value ?? old)?.session_id ?? "");
    if (value === null || value === undefined) records.delete(key);
    else records.set(key, structuredClone(value));
    if (table !== "session_events" || !sessionId) return;
    const rows = this.sessionEventsBySession.get(sessionId) ?? new Map<string, SessionRecord>();
    if (value === null || value === undefined) rows.delete(key);
    else rows.set(key, records.get(key)!);
    if (rows.size) this.sessionEventsBySession.set(sessionId, rows);
    else this.sessionEventsBySession.delete(sessionId);
  }
  private replay(): void {
    this.records = new Map(tables.map(table => [table, new Map()]));
    this.sessionEventsBySession.clear();
    for (const event of this.persistence.readAll()) this.apply(event.sessionId, event.changes);
  }
  private project(header: SessionRecord): void {
    if (!database.prepare("SELECT id FROM users WHERE id = ?").get(String(header.user_id))) return;
    database.prepare(`INSERT INTO ai_sessions (id, user_id, app_id, title, archived, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET title = excluded.title,
      archived = excluded.archived, updated_at = excluded.updated_at`).run(String(header.id), String(header.user_id), String(header.app_id), String(header.title), Number(header.archived), String(header.created_at), String(header.updated_at));
    if (Number(database.prepare("PRAGMA user_version").get()!.user_version) >= 31 && typeof header._revision === "string") database.prepare("UPDATE ai_sessions SET jsonl_revision = ? WHERE id = ?").run(header._revision, String(header.id));
  }
  private migrate(): void {
    const version = Number(database.prepare("PRAGMA user_version").get()!.user_version);
    if (version > 30) throw new Error("会话迁移标记缺失，旧消息表已退役；请恢复完整数据备份。");
    withControlLock(database, () => {
      const headers = database.prepare("SELECT * FROM ai_sessions ORDER BY rowid").all();
      const expected = new Map<string, SessionChange[]>();
      for (const header of headers) {
        const sessionId = String(header.id);
        const messages = database.prepare("SELECT *, rowid AS _order FROM ai_messages WHERE session_id = ? ORDER BY rowid").all(sessionId);
        const usage = database.prepare("SELECT * FROM ai_usage WHERE session_id = ? ORDER BY rowid").all(sessionId);
        const changes: SessionChange[] = [{ table: "ai_sessions", key: sessionId, value: header }, ...messages.map(value => ({ table: "ai_messages" as const, key: String(value.id), value })), ...usage.map(value => ({ table: "ai_usage" as const, key: String(value.id), value }))];
        expected.set(sessionId, changes);
        this.persistence.append({ sessionId, transaction: `migration-${digest(changes)}`, changes });
      }
      this.replay();
      for (const [sessionId, changes] of expected) {
        const actual = changes.map(change => ({ ...change, value: this.records.get(change.table)!.get(change.key) ?? null }));
        if (digest(actual) !== digest(changes)) throw new Error(`会话迁移回读校验失败：${sessionId}`);
      }
      this.metadata.write("session-migration", { version: 1, sessions: headers.length, messages: this.records.get("ai_messages")!.size, usage: this.records.get("ai_usage")!.size, migratedAt: new Date().toISOString() });
    });
  }
  all(table: SessionTable, predicate: (record: SessionRecord) => boolean = () => true, fields?: readonly string[]): unknown[] {
    this.assertReady();
    const rows: SessionRecord[] = [];
    for (const record of this.records.get(table)!.values()) if (predicate(record)) {
      rows.push(fields ? Object.fromEntries(fields.map(field => [field, record[field]])) : record);
    }
    return structuredClone(rows);
  }
  allForSession(table: SessionTable, sessionId: string, fields?: readonly string[]): unknown[] {
    this.assertReady();
    const rows = table === "session_events"
      ? [...(this.sessionEventsBySession.get(sessionId)?.values() ?? [])]
      : [...this.records.get(table)!.values()].filter(record => table === "ai_sessions" ? record.id === sessionId : record.session_id === sessionId);
    return structuredClone(fields ? rows.map(record => Object.fromEntries(fields.map(field => [field, record[field]]))) : rows);
  }
  onSessionsRemoved(listener: (sessionIds: readonly string[]) => void): () => void {
    this.sessionRemovalListeners.add(listener);
    return () => this.sessionRemovalListeners.delete(listener);
  }
  get(table: SessionTable, id: string): unknown { this.assertReady(); return structuredClone(this.records.get(table)!.get(id)); }
  assertReady(): void { if (this.failed) throw new Error("会话提交失败，必须重启并重放日志后再继续。"); }
  commit(sessionId: string, changes: SessionChange[]): void {
    this.assertReady();
    // 提交只替换涉及的记录；按键保留回滚值，不能为一条活动复制所有账户的历史索引。
    const previous = new Map<SessionTable, Map<string, SessionRecord | undefined>>();
    try {
      for (const change of [...changes, { table: "ai_sessions" as const, key: sessionId }]) {
        const records = this.records.get(change.table);
        if (!records) throw new Error("会话事件记录无效。");
        let saved = previous.get(change.table);
        if (!saved) { saved = new Map(); previous.set(change.table, saved); }
        if (!saved.has(change.key)) saved.set(change.key, records.get(change.key));
      }
      this.apply(sessionId, changes);
      const header = this.records.get("ai_sessions")!.get(sessionId);
      if (!header || typeof header.user_id !== "string" || typeof header.app_id !== "string" || typeof header.title !== "string" || ![0, 1].includes(Number(header.archived))) throw new Error("会话头无效。");
      const transaction = randomUUID();
      const committedHeader = { ...header, _revision: transaction };
      const committedChanges = [...changes.filter(change => change.table !== "ai_sessions"), { table: "ai_sessions" as const, key: sessionId, value: committedHeader }];
      this.apply(sessionId, committedChanges);
      withControlLock(database, () => {
        if (!database.prepare("SELECT id FROM users WHERE id = ?").get(header.user_id as string)) throw new Error("会话所属账户不存在。");
        this.project(committedHeader);
        this.persistence.append({ sessionId, transaction, changes: committedChanges });
      });
    } catch (error) {
      for (const [table, saved] of previous) for (const [key, value] of saved) {
        this.storeRecord(table, key, value);
      }
      this.failed = true;
      throw error;
    }
  }
  rewriteSession(sessionId: string, transform: (commit: SessionCommit) => SessionCommit): number {
    this.assertReady();
    try {
      return withControlLock(database, () => {
        const rewrite = this.persistence.rewrite(sessionId, transform);
        if (!rewrite.rewrittenTransactions) return 0;
        for (const event of rewrite.commits) this.apply(sessionId, event.changes);
        return rewrite.rewrittenTransactions;
      });
    } catch (error) {
      this.failed = true;
      throw error;
    }
  }
  removeUser(userId: string): void {
    const headers = [...this.records.get("ai_sessions")!.values()].filter(row => row.user_id === userId);
    const sessionIds = headers.map(header => String(header.id));
    for (const listener of [...this.sessionRemovalListeners]) {
      try { listener(sessionIds); }
      catch { this.sessionRemovalListeners.delete(listener); }
    }
    for (const header of headers) {
      const sessionId = String(header.id); this.persistence.remove(sessionId);
      for (const table of tables) for (const [id, record] of this.records.get(table)!) if ((table === "ai_sessions" ? record.id : record.session_id) === sessionId) this.storeRecord(table, id, null);
    }
  }
  close(): void { this.persistence.close(); }
}
export const sessionRecords = new SessionRepository();
