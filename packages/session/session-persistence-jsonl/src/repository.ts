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
// 增量对齐：把现有 JSONL 仓库声明为实现 session-persistence 协议（仅类型校验，不改变运行行为）。
import type { SessionPersistenceBackend } from "lfaa-session-persistence";

export type SessionRecord = Record<string, unknown>;
const tables: SessionTable[] = ["ai_sessions", "ai_messages", "ai_usage", "session_events"];
function digest(value: unknown): string { return createHash("sha256").update(encode(value)).digest("hex"); }
export class SessionRepository {
  private readonly persistence = new JsonlSessionPersistence(resolve(config.dataDirectory, "sessions"), action => withControlLock(database, action));
  private readonly metadata = new JsonStorageBackend(resolve(config.dataDirectory, "storages"));
  private records = new Map<SessionTable, Map<string, SessionRecord>>(tables.map(table => [table, new Map()]));
  private readonly sessionEventsBySession = new Map<string, Map<string, SessionRecord>>();
  // 只保留轻量会话头和消息定位；正文缓存受会话数与编码字节预算约束。
  private readonly recordSessions = new Map<SessionTable, Map<string, string>>(tables.map(table => [table, new Map()]));
  private readonly loadedSessions = new Map<string, number>();
  private cachedBytes = 0;
  private readonly cacheMaxSessions = 8;
  private readonly cacheMaxBytes = 32 * 1024 * 1024;
  private readonly interruptedMessages = new Map<string, SessionRecord>();
  private readonly planEvents = new Map<string, Map<string, { seq: number; active: boolean }>>();
  private readonly sessionRemovalListeners = new Set<(sessionIds: readonly string[]) => void>();
  private replaying = false;
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
      const interrupted = [...this.interruptedMessages.values()];
      this.interruptedMessages.clear();
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
    const sessionId = table === "ai_sessions" ? key : String((value ?? old)?.session_id ?? this.recordSessions.get(table)!.get(key) ?? "");
    if (sessionId) {
      const before = old ? Buffer.byteLength(encode(old)) : 0;
      const after = value ? Buffer.byteLength(encode(value)) : 0;
      if (table !== "ai_sessions") {
        const size = (this.loadedSessions.get(sessionId) ?? 0) + after - before;
        this.loadedSessions.set(sessionId, size); this.cachedBytes += after - before;
      }
      if (value) this.recordSessions.get(table)!.set(key, sessionId);
      else this.recordSessions.get(table)!.delete(key);
      if (this.replaying && table === "ai_messages") {
        if (value?.status === "streaming") this.interruptedMessages.set(key, value);
        else this.interruptedMessages.delete(key);
      }
    }
    if (value === null || value === undefined) records.delete(key);
    else records.set(key, structuredClone(value));
    if (table !== "session_events" || !sessionId) return;
    const plans = this.planEvents.get(sessionId) ?? new Map<string, { seq: number; active: boolean }>();
    if (value?.type === "session/plan-mode") {
      const data = value.data as { active?: unknown } | undefined;
      if (typeof data?.active === "boolean" && typeof value.seq === "number") plans.set(key, { seq: value.seq, active: data.active });
    } else plans.delete(key);
    if (plans.size) this.planEvents.set(sessionId, plans);
    else this.planEvents.delete(sessionId);
    const rows = this.sessionEventsBySession.get(sessionId) ?? new Map<string, SessionRecord>();
    if (value === null || value === undefined) rows.delete(key);
    else rows.set(key, records.get(key)!);
    if (rows.size) this.sessionEventsBySession.set(sessionId, rows);
    else this.sessionEventsBySession.delete(sessionId);
  }
  private evictSession(sessionId: string): void {
    for (const table of tables) {
      if (table === "ai_sessions") continue;
      for (const [key, row] of this.records.get(table)!) if (row.session_id === sessionId) this.records.get(table)!.delete(key);
    }
    this.sessionEventsBySession.delete(sessionId);
    this.cachedBytes -= this.loadedSessions.get(sessionId) ?? 0;
    this.loadedSessions.delete(sessionId);
  }
  private trimCache(): void {
    while (this.loadedSessions.size > this.cacheMaxSessions || this.cachedBytes > this.cacheMaxBytes) {
      const oldest = this.loadedSessions.keys().next().value;
      if (oldest === undefined) break;
      this.evictSession(oldest);
    }
  }
  private loadSession(sessionId: string): void {
    if (this.loadedSessions.has(sessionId)) {
      const bytes = this.loadedSessions.get(sessionId)!;
      this.loadedSessions.delete(sessionId); this.loadedSessions.set(sessionId, bytes); return;
    }
    this.loadedSessions.set(sessionId, 0);
    try { for (const event of this.persistence.readSession(sessionId)) this.apply(sessionId, event.changes); }
    catch (error) { this.evictSession(sessionId); this.failed = true; throw error; }
  }
  /** 诊断仅给出缓存工作量，不包含消息、账户或路径。 */
  cacheStats(): { sessions: number; bytes: number } { return { sessions: this.loadedSessions.size, bytes: this.cachedBytes }; }
  /** 消息页直接按行扫描经重放登记的单会话事务，不把超长会话正文装入热缓存。 */
  readMessagePage(sessionId: string, before: { createdAt: string; order: number } | undefined, limit: number, observeEvent?: Parameters<JsonlSessionPersistence["readMessagePage"]>[3]): ReturnType<JsonlSessionPersistence["readMessagePage"]> {
    this.assertReady();
    return this.persistence.readMessagePage(sessionId, before, limit, observeEvent);
  }
  /** 权限及字段投影由 Session Owner 提供，持久化层只负责单遍完整性与有界分页。 */
  readEventPage(...parameters: Parameters<JsonlSessionPersistence["readEventPage"]>): ReturnType<JsonlSessionPersistence["readEventPage"]> {
    this.assertReady();
    return this.persistence.readEventPage(...parameters);
  }
  private replay(): void {
    this.records = new Map(tables.map(table => [table, new Map()]));
    this.sessionEventsBySession.clear(); this.loadedSessions.clear(); this.cachedBytes = 0;
    for (const index of this.recordSessions.values()) index.clear();
    this.interruptedMessages.clear(); this.replaying = true;
    this.planEvents.clear();
    let previousSession: string | undefined;
    try {
      for (const event of this.persistence.readAll()) {
        if (previousSession && event.sessionId !== previousSession) this.trimCache();
        this.apply(event.sessionId, event.changes); previousSession = event.sessionId;
      }
    } finally { this.replaying = false; this.trimCache(); }
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
        this.loadSession(sessionId);
        const actual = changes.map(change => ({ ...change, value: this.records.get(change.table)!.get(change.key) ?? null }));
        if (digest(actual) !== digest(changes)) throw new Error(`会话迁移回读校验失败：${sessionId}`);
        this.trimCache();
      }
      this.metadata.write("session-migration", { version: 1, sessions: headers.length, messages: this.recordSessions.get("ai_messages")!.size, usage: this.recordSessions.get("ai_usage")!.size, migratedAt: new Date().toISOString() });
    });
  }
  all(table: SessionTable, predicate: (record: SessionRecord) => boolean = () => true, fields?: readonly string[]): unknown[] {
    this.assertReady();
    const rows: SessionRecord[] = [];
    const collect = (record: SessionRecord) => { if (predicate(record)) rows.push(structuredClone(fields ? Object.fromEntries(fields.map(field => [field, record[field]])) : record)); };
    if (table === "ai_sessions") for (const record of this.records.get(table)!.values()) collect(record);
    else for (const sessionId of this.records.get("ai_sessions")!.keys()) {
      this.loadSession(sessionId);
      for (const record of this.records.get(table)!.values()) if (record.session_id === sessionId) collect(record);
      this.trimCache();
    }
    return rows;
  }
  allForSession(table: SessionTable, sessionId: string, fields?: readonly string[]): unknown[] {
    this.assertReady();
    if (table !== "ai_sessions") this.loadSession(sessionId);
    const rows = table === "session_events"
      ? [...(this.sessionEventsBySession.get(sessionId)?.values() ?? [])]
      : [...this.records.get(table)!.values()].filter(record => table === "ai_sessions" ? record.id === sessionId : record.session_id === sessionId);
    const result = structuredClone(fields ? rows.map(record => Object.fromEntries(fields.map(field => [field, record[field]]))) : rows);
    this.trimCache(); return result;
  }
  /** SQLite 只选择已投影的身份键，返回值仍从 JSONL 会话头取得。 */
  listHeaders(userId: string, archived: boolean, appId?: string): unknown[] {
    this.assertReady();
    const rows = appId
      ? database.prepare("SELECT id FROM ai_sessions WHERE user_id = ? AND archived = ? AND app_id = ? ORDER BY updated_at DESC, id LIMIT 200").all(userId, Number(archived), appId)
      : database.prepare("SELECT id FROM ai_sessions WHERE user_id = ? AND archived = ? ORDER BY updated_at DESC, id LIMIT 200").all(userId, Number(archived));
    return rows.flatMap(row => { const header = this.records.get("ai_sessions")!.get(String(row.id)); return header?.user_id === userId ? [structuredClone(header)] : []; });
  }
  /** 列表只读取已校验事件的轻量计划投影，避免为两百条标题恢复正文和完整 Kernel。 */
  planMode(sessionId: string): boolean {
    this.assertReady();
    let latest = { seq: -1, active: false };
    for (const event of this.planEvents.get(sessionId)?.values() ?? []) if (event.seq > latest.seq) latest = event;
    return latest.active;
  }
  onSessionsRemoved(listener: (sessionIds: readonly string[]) => void): () => void {
    this.sessionRemovalListeners.add(listener);
    return () => this.sessionRemovalListeners.delete(listener);
  }
  get(table: SessionTable, id: string): unknown {
    this.assertReady();
    const sessionId = this.recordSessions.get(table)!.get(id);
    if (sessionId && table !== "ai_sessions") this.loadSession(sessionId);
    const result = structuredClone(this.records.get(table)!.get(id));
    this.trimCache(); return result;
  }
  assertReady(): void { if (this.failed) throw new Error("会话提交失败，必须重启并重放日志后再继续。"); }
  commit(sessionId: string, changes: SessionChange[]): void {
    this.assertReady();
    this.loadSession(sessionId);
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
    } finally { this.trimCache(); }
  }
  rewriteSession(sessionId: string, transform: (commit: SessionCommit) => SessionCommit): number {
    this.assertReady();
    try {
      this.loadSession(sessionId);
      return withControlLock(database, () => {
        const rewrite = this.persistence.rewrite(sessionId, transform);
        if (!rewrite.rewrittenTransactions) return 0;
        for (const event of rewrite.commits) this.apply(sessionId, event.changes);
        return rewrite.rewrittenTransactions;
      });
    } catch (error) {
      this.failed = true;
      throw error;
    } finally { this.trimCache(); }
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
      this.evictSession(sessionId);
      this.planEvents.delete(sessionId);
      for (const index of this.recordSessions.values()) for (const [key, owner] of index) if (owner === sessionId) index.delete(key);
      for (const table of tables) for (const [id, record] of this.records.get(table)!) if ((table === "ai_sessions" ? record.id : record.session_id) === sessionId) this.storeRecord(table, id, null);
    }
  }
  close(): void { this.persistence.close(); }
}
export const sessionRecords = new SessionRepository() satisfies SessionPersistenceBackend;
