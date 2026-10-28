/**
 * 功能：提供 JSONL 会话仓库并迁移既有历史。
 * 作用：追加消息、活动和真实用量；SQLite 仅保存权限外键需要的会话头投影。
 * 关联文件：persistence.ts、core/session/sessions.ts、storage-domain/migration.ts。
 */
import { createHash, randomUUID } from "node:crypto";
import { lstatSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { database } from "lfaa-storage-sqlite/src/database.js";
import { config } from "lfaa-launch-environment/src/config.js";
import { encode, JsonStorageBackend } from "lfaa-storage-json/src/index.js";
import { withControlLock } from "lfaa-storage-domain/src/control-lock.js";
import { JsonlSessionPersistence, sessionStorageIndexFileName, sessionStorageIndexTempName, type SessionChange, type SessionCommit, type SessionTable } from "./persistence.js";
// 增量对齐：把现有 JSONL 仓库声明为实现 session-persistence 协议（仅类型校验，不改变运行行为）。
import type { SessionPersistenceBackend } from "lfaa-session-persistence";
import { applySessionSummaryEvent, createSessionSummaryAccumulator, projectSessionUsage, type SessionContextUsage, type SessionSummaryAccumulator } from "./session-summary.js";

export type SessionRecord = Record<string, unknown>;
const tables: SessionTable[] = ["ai_sessions", "ai_messages", "ai_usage", "session_events"];
function digest(value: unknown): string { return createHash("sha256").update(encode(value)).digest("hex"); }
type RecentMessagePage = {
  rows: Map<string, SessionRecord>;
  orderedRows: SessionRecord[];
  rowBytes: Map<string, number>;
  feedback: Map<string, SessionRecord>;
  feedbackBytes: Map<string, number>;
  usage: Map<string, SessionRecord>;
  usageBytes: Map<string, number>;
  count: number;
  bytes: number;
  complete: boolean;
  branchParentSessionId?: string;
  summary: SessionSummaryAccumulator;
};
type RecentMessagePageResult = { items: Array<{ message: SessionRecord; feedback?: SessionRecord; usage?: SessionRecord }>; hasMore: boolean; branchParentSessionId?: string; usageSummary: ReturnType<typeof projectSessionUsage>; contextUsage: SessionContextUsage | null };
type UsageAggregateGroup = { providerId: string; modelId: string; requestCount: number; promptTokens: number; promptTokenCount: number; completionTokens: number; completionTokenCount: number; latestAt: string };
type UsageAggregate = { requestCount: number; promptTokens: number; promptTokenCount: number; completionTokens: number; completionTokenCount: number; groups: Map<string, UsageAggregateGroup> };
const recentMessagePageSize = 100;
const recentMessagePageMaxSessions = 128;
const recentMessagePageMaxBytes = 16 * 1024 * 1024;
const storageIndexField = (value: unknown) => String(value ?? "").replace(/[\u0000-\u001f\u007f\u2028\u2029]/gu, " ").trim();
const displayMessageFields = ["id", "session_id", "_order", "role", "content", "status", "created_at", "activity_json", "parts", "attachments_json"] as const;
const emptyAssociationProjection = (): { seq: number; value: unknown } => ({ seq: -1, value: { applicationIds: [], capabilityIds: [] } });
const compareMessages = (left: SessionRecord, right: SessionRecord) => String(left.created_at).localeCompare(String(right.created_at)) || Number(left._order) - Number(right._order);
export class SessionRepository {
  private readonly persistence = new JsonlSessionPersistence(resolve(config.homeDirectory, "sessions"), action => withControlLock(database, action));
  private readonly metadata = new JsonStorageBackend(resolve(config.homeDirectory, "storages"));
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
  // 关联引用只附着在仓库本来就持有的会话头上；不保留完整事件或另建无界键表。
  private associationByHeader = new WeakMap<SessionRecord, { seq: number; value: unknown }>();
  private readonly recentMessagePages = new Map<string, RecentMessagePage>();
  private recentMessagePageBytes = 0;
  // 用量汇总只保留账户和 Provider/模型粒度；历史记录仍只在 JSONL 中保存。
  private readonly usageAggregates = new Map<string, UsageAggregate>();
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
        for (const row of cached) {
          const sessionId = String(row.id);
          // SQLite 只保存可重建的列表/授权投影。会话日志被删除后，不应让无权威记录的缓存头阻塞整个服务启动。
          if (!this.records.get("ai_sessions")!.has(sessionId)) continue;
          // 日志仍存在但缺少 SQLite 已提交的修订时，仍按不完整历史拒绝启动，保护可恢复数据。
          if (typeof row.jsonl_revision === "string" && !this.persistence.hasTransaction(sessionId, row.jsonl_revision)) throw new Error("会话日志缺失已提交历史，拒绝用不完整文件覆盖投影。");
        }
      }
      withControlLock(database, () => { for (const header of this.records.get("ai_sessions")!.values()) this.project(header); });
      // 进程退出后尚未结束的回复不能继续表现为推理中；恢复也必须留下权威事件。
      const interrupted = [...this.interruptedMessages.values()];
      this.interruptedMessages.clear();
      for (const message of interrupted) this.commit(String(message.session_id), [{ table: "ai_messages", key: String(message.id), value: { ...message, status: "interrupted" } }]);
      withControlLock(database, () => {
        this.cleanupStorageIndexTemps();
        this.refreshStorageIndex();
      });
    } catch (error) { this.persistence.close(); throw error; }
  }
  /** Session Owner 已校验归属后，用于回答会话日志的实际路径；不读取文件内容。 */
  storageLocation(sessionId: string) { return this.persistence.storageLocation(sessionId); }
  private cleanupStorageIndexTemps(): void {
    const root = resolve(config.homeDirectory, "sessions");
    for (const name of readdirSync(root)) {
      if (!sessionStorageIndexTempName.test(name)) continue;
      const path = resolve(root, name);
      try { if (lstatSync(path).isFile()) rmSync(path, { force: true }); }
      catch { /* 临时文件可能已被并发清理；下次启动会再尝试。 */ }
    }
  }
  /** 从轻量会话头生成可重建的标题映射，不读取 JSONL 正文。 */
  private refreshStorageIndex(): void {
    const root = resolve(config.homeDirectory, "sessions");
    let temporaryPath: string | undefined;
    try {
      const rows = [...this.records.get("ai_sessions")!.values()]
        .map(header => ({
          title: storageIndexField(header.title),
          directory: basename(this.persistence.storageLocation(String(header.id)).sessionDirectory)
        }))
        .sort((left, right) => left.title.localeCompare(right.title, "zh-CN") || left.directory.localeCompare(right.directory));
      const content = `\uFEFFLFAA 会话目录索引\r\n会话标题\t哈希目录名\r\n${rows.map(row => `${row.title}\t${row.directory}`).join("\r\n")}${rows.length ? "\r\n" : ""}`;
      temporaryPath = resolve(root, `.session-index-${randomUUID()}.tmp`);
      writeFileSync(temporaryPath, content, { encoding: "utf8", flag: "wx", mode: 0o600 });
      renameSync(temporaryPath, resolve(root, sessionStorageIndexFileName));
      temporaryPath = undefined;
    } catch (error) {
      if (temporaryPath) { try { rmSync(temporaryPath, { force: true }); } catch { /* 下次启动会清理未完成的替换文件。 */ } }
      console.error("LFAA 会话目录索引更新失败。", error);
    }
  }
  private apply(sessionId: string, changes: SessionChange[]): void {
    let hasHeaderChange = false;
    for (const change of changes) {
      if (!tables.includes(change.table) || typeof change.key !== "string" || !change.key) throw new Error("会话事件记录无效。");
      const record = change.value;
      if (record !== null && (!record || typeof record !== "object" || Array.isArray(record) || record.id !== change.key || (change.table === "ai_sessions" ? record.id : record.session_id) !== sessionId)) throw new Error("会话事件所属 ID 不一致。");
      if (change.table === "ai_sessions") hasHeaderChange = true;
    }
    // 仅首笔事务可能把会话头放在事件后；先完整校验，再为它调整应用顺序。
    if (hasHeaderChange && !this.records.get("ai_sessions")!.has(sessionId)) {
      for (const change of changes) if (change.table === "ai_sessions") this.storeRecord(change.table, change.key, change.value);
      for (const change of changes) if (change.table !== "ai_sessions") this.storeRecord(change.table, change.key, change.value);
    } else for (const change of changes) this.storeRecord(change.table, change.key, change.value);
  }
  private storeRecord(table: SessionTable, key: string, value: SessionRecord | null | undefined): void {
    const records = this.records.get(table)!;
    const old = records.get(key);
    const knownMessage = table === "ai_messages" && this.recordSessions.get(table)!.has(key);
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
    if (table === "ai_usage") {
      if (old) this.adjustUsageAggregate(old, -1);
      if (value) this.adjustUsageAggregate(value, 1);
    }
    if (value === null || value === undefined) records.delete(key);
    else records.set(key, structuredClone(value));
    if (table === "ai_sessions") {
      const header = records.get(key);
      if (header) this.associationByHeader.set(header, old ? this.associationByHeader.get(old) ?? emptyAssociationProjection() : emptyAssociationProjection());
    }
    // 日志事务允许会话头位于末尾；apply 已先归一会话头，再建立首批事件投影。
    if (sessionId && table !== "ai_sessions" && !this.recentMessagePages.has(sessionId)) this.createRecentMessagePage(sessionId);
    if (table === "ai_sessions" && value && !old) this.createRecentMessagePage(sessionId);
    if (table === "ai_messages") this.updateRecentMessagePage(sessionId, key, value, knownMessage);
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
    this.updateAssociationProjection(sessionId, value, old, rows);
    this.updateRecentSessionEventProjection(sessionId, value, old, rows);
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
  private createRecentMessagePage(sessionId: string): void {
    if (this.recentMessagePages.has(sessionId)) return;
    const page: RecentMessagePage = { rows: new Map(), orderedRows: [], rowBytes: new Map(), feedback: new Map(), feedbackBytes: new Map(), usage: new Map(), usageBytes: new Map(), count: 0, bytes: 128, complete: true, summary: createSessionSummaryAccumulator() };
    this.recentMessagePages.set(sessionId, page);
    this.recentMessagePageBytes += page.bytes;
    this.trimRecentMessagePages();
  }
  private touchRecentMessagePage(sessionId: string, page: RecentMessagePage): void {
    this.recentMessagePages.delete(sessionId);
    this.recentMessagePages.set(sessionId, page);
  }
  private removeRecentMessagePage(sessionId: string): void {
    const page = this.recentMessagePages.get(sessionId);
    if (!page) return;
    this.recentMessagePageBytes -= page.bytes;
    this.recentMessagePages.delete(sessionId);
  }
  private trimRecentMessagePages(): void {
    while (this.recentMessagePages.size > recentMessagePageMaxSessions || this.recentMessagePageBytes > recentMessagePageMaxBytes) {
      const oldest = this.recentMessagePages.keys().next().value;
      if (oldest === undefined) break;
      this.removeRecentMessagePage(oldest);
    }
  }
  private adjustUsageAggregate(row: SessionRecord, change: 1 | -1): void {
    const userId = typeof row.user_id === "string" ? row.user_id : "";
    const providerId = typeof row.provider_id === "string" ? row.provider_id : "";
    const modelId = typeof row.model_id === "string" ? row.model_id : "";
    if (!userId) return;
    let aggregate = this.usageAggregates.get(userId);
    if (!aggregate && change > 0) {
      aggregate = { requestCount: 0, promptTokens: 0, promptTokenCount: 0, completionTokens: 0, completionTokenCount: 0, groups: new Map() };
      this.usageAggregates.set(userId, aggregate);
    }
    if (!aggregate) return;
    const key = JSON.stringify([providerId, modelId]);
    let group = aggregate.groups.get(key);
    if (!group && change > 0) {
      group = { providerId, modelId, requestCount: 0, promptTokens: 0, promptTokenCount: 0, completionTokens: 0, completionTokenCount: 0, latestAt: "" };
      aggregate.groups.set(key, group);
    }
    if (!group) return;
    aggregate.requestCount += change;
    group.requestCount += change;
    if (typeof row.prompt_tokens === "number") {
      aggregate.promptTokens += change * row.prompt_tokens;
      aggregate.promptTokenCount += change;
      group.promptTokens += change * row.prompt_tokens;
      group.promptTokenCount += change;
    }
    if (typeof row.completion_tokens === "number") {
      aggregate.completionTokens += change * row.completion_tokens;
      aggregate.completionTokenCount += change;
      group.completionTokens += change * row.completion_tokens;
      group.completionTokenCount += change;
    }
    if (change > 0 && typeof row.created_at === "string" && row.created_at > group.latestAt) group.latestAt = row.created_at;
    if (group.requestCount <= 0) aggregate.groups.delete(key);
    if (aggregate.requestCount <= 0) this.usageAggregates.delete(userId);
  }
  private updateRecentMessagePage(sessionId: string, key: string, value: SessionRecord | null | undefined, wasKnown: boolean): void {
    const page = this.recentMessagePages.get(sessionId);
    if (!page) return;
    const previousBytes = page.bytes;
    const existing = page.rows.get(key);
    if (!value) {
      if (wasKnown) page.count = Math.max(0, page.count - 1);
      if (existing) {
        const index = page.orderedRows.indexOf(existing);
        if (index >= 0) page.orderedRows.splice(index, 1);
        page.bytes -= page.rowBytes.get(key) ?? 0;
        page.rows.delete(key); page.rowBytes.delete(key);
        const feedbackBytes = page.feedbackBytes.get(key) ?? 0;
        page.bytes -= feedbackBytes; page.feedback.delete(key); page.feedbackBytes.delete(key);
        const usageBytes = page.usageBytes.get(key) ?? 0;
        page.bytes -= usageBytes; page.usage.delete(key); page.usageBytes.delete(key);
        // 缺少下一条旧消息时不返回残缺首屏，回退到完整分页读取。
        page.complete = false;
      }
    } else if (!wasKnown || existing) {
      const projected = Object.fromEntries(displayMessageFields.filter(field => field in value).map(field => [field, value[field]]));
      if (existing) {
        const index = page.orderedRows.indexOf(existing);
        if (index >= 0) page.orderedRows.splice(index, 1);
        page.bytes -= page.rowBytes.get(key) ?? 0;
      } else {
        page.count += 1;
      }
      const row = structuredClone(projected);
      const bytes = Buffer.byteLength(encode(row));
      page.rows.set(key, row); page.rowBytes.set(key, bytes); page.bytes += bytes;
      let low = 0, high = page.orderedRows.length;
      while (low < high) {
        const middle = (low + high) >>> 1;
        if (compareMessages(page.orderedRows[middle]!, row) <= 0) low = middle + 1;
        else high = middle;
      }
      page.orderedRows.splice(low, 0, row);
      while (page.orderedRows.length > recentMessagePageSize) {
        const removed = page.orderedRows.shift()!;
        const removedId = String(removed.id);
        page.bytes -= page.rowBytes.get(removedId) ?? 0;
        page.rows.delete(removedId); page.rowBytes.delete(removedId);
        page.bytes -= page.feedbackBytes.get(removedId) ?? 0;
        page.feedback.delete(removedId); page.feedbackBytes.delete(removedId);
        page.bytes -= page.usageBytes.get(removedId) ?? 0;
        page.usage.delete(removedId); page.usageBytes.delete(removedId);
      }
    }
    this.recentMessagePageBytes += page.bytes - previousBytes;
    this.touchRecentMessagePage(sessionId, page);
    this.trimRecentMessagePages();
  }
  private updateRecentSessionEventProjection(sessionId: string, value: SessionRecord | null | undefined, old: SessionRecord | undefined, rows: Map<string, SessionRecord>): void {
    const page = this.recentMessagePages.get(sessionId);
    if (page) {
      const beforeBytes = Buffer.byteLength(encode({ usage: projectSessionUsage(page.summary), context: page.summary.contextUsage }));
      if (old) applySessionSummaryEvent(page.summary, old, -1);
      if (value) applySessionSummaryEvent(page.summary, value);
      if (!value && old?.type === "request/context" && Number(old.seq) === page.summary.contextSeq) {
        const latestContext = [...rows.values()]
          .filter(event => event.type === "request/context")
          .sort((left, right) => Number(right.seq) - Number(left.seq))[0];
        page.summary.contextUsage = null;
        page.summary.contextRunId = null;
        page.summary.contextSeq = -1;
        if (latestContext) applySessionSummaryEvent(page.summary, latestContext);
        const response = latestContext ? [...rows.values()]
          .filter(event => event.type === "assistant/response" && (event.data as Record<string, unknown> | undefined)?.runId === (latestContext.data as Record<string, unknown> | undefined)?.runId)
          .sort((left, right) => Number(left.seq) - Number(right.seq)) : [];
        for (const event of response) applySessionSummaryEvent(page.summary, event);
      }
      const afterBytes = Buffer.byteLength(encode({ usage: projectSessionUsage(page.summary), context: page.summary.contextUsage }));
      page.bytes += afterBytes - beforeBytes;
      this.recentMessagePageBytes += afterBytes - beforeBytes;
    }
    if (!value) {
      const data = old?.data as Record<string, unknown> | undefined;
      if (old?.type === "message/feedback" && typeof data?.messageId === "string" && page?.feedback.has(data.messageId)) {
        const bytes = page.feedbackBytes.get(data.messageId) ?? 0;
        page.bytes -= bytes; this.recentMessagePageBytes -= bytes;
        page.feedback.delete(data.messageId); page.feedbackBytes.delete(data.messageId);
      }
      if (old?.type === "usage/record" && typeof data?.runId === "string" && data.purpose !== "memory" && data.purpose !== "subagent" && page?.usage.has(data.runId)) {
        const bytes = page.usageBytes.get(data.runId) ?? 0;
        page.bytes -= bytes; this.recentMessagePageBytes -= bytes;
        page.usage.delete(data.runId); page.usageBytes.delete(data.runId);
      }
      if (page && (old?.type === "session/end-seed" || old?.type === "session/branch-memory") && page.branchParentSessionId === data?.sourceSessionId) {
        delete page.branchParentSessionId; page.bytes -= 128; page.complete = false;
        this.recentMessagePageBytes -= 128;
      }
      this.trimRecentMessagePages();
      return;
    }
    const data = value.data as Record<string, unknown> | undefined;
    if (value.type === "message/feedback" && typeof data?.messageId === "string" && page?.rows.has(data.messageId)) {
      const previousBytes = page.bytes;
      const feedback = structuredClone(value);
      const bytes = Buffer.byteLength(encode(feedback));
      page.bytes += bytes - (page.feedbackBytes.get(data.messageId) ?? 0);
      this.recentMessagePageBytes += page.bytes - previousBytes;
      page.feedback.set(data.messageId, feedback); page.feedbackBytes.set(data.messageId, bytes);
    } else if (value.type === "usage/record" && typeof data?.runId === "string" && data.purpose !== "memory" && data.purpose !== "subagent" && page?.rows.has(data.runId)) {
      const previousBytes = page.bytes;
      const usage = structuredClone(value);
      const bytes = Buffer.byteLength(encode(usage));
      page.bytes += bytes - (page.usageBytes.get(data.runId) ?? 0);
      this.recentMessagePageBytes += page.bytes - previousBytes;
      page.usage.set(data.runId, usage); page.usageBytes.set(data.runId, bytes);
    } else if ((value.type === "session/end-seed" || value.type === "session/branch-memory") && typeof data?.sourceSessionId === "string" && page) {
      if (!page.branchParentSessionId) { page.bytes += 128; this.recentMessagePageBytes += 128; }
      page.branchParentSessionId = data.sourceSessionId;
    }
    this.trimRecentMessagePages();
  }
  private updateAssociationProjection(sessionId: string, value: SessionRecord | null | undefined, old: SessionRecord | undefined, rows: Map<string, SessionRecord>): void {
    const header = this.records.get("ai_sessions")!.get(sessionId);
    if (!header) return;
    const current = this.associationByHeader.get(header) ?? emptyAssociationProjection();
    if (value?.type === "session/associations" && Number.isSafeInteger(value.seq)) {
      if (Number(value.seq) >= current.seq) this.associationByHeader.set(header, { seq: Number(value.seq), value: structuredClone(value.data) });
      return;
    }
    if (!value && old?.type === "session/associations") {
      let latest = emptyAssociationProjection();
      for (const event of rows.values()) if (event.type === "session/associations" && Number.isSafeInteger(event.seq) && Number(event.seq) > latest.seq) latest = { seq: Number(event.seq), value: structuredClone(event.data) };
      this.associationByHeader.set(header, latest);
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
  /** 日志版本未变化时复用重放建立的有界首屏；失效或超预算时回退到完整链扫描。 */
  readRecentMessagePage(sessionId: string, limit: number): RecentMessagePageResult | null {
    this.assertReady();
    if (!Number.isInteger(limit) || limit < 1 || limit > recentMessagePageSize || !this.persistence.isCurrentRevision(sessionId)) return null;
    const page = this.recentMessagePages.get(sessionId);
    if (!page?.complete) return null;
    this.touchRecentMessagePage(sessionId, page);
    const rows = page.orderedRows.slice(Math.max(0, page.orderedRows.length - limit));
    return {
      items: rows.map(message => {
        const feedback = page.feedback.get(String(message.id));
        const usage = page.usage.get(String(message.id));
        return {
          message: structuredClone(message),
          ...(feedback ? { feedback: structuredClone(feedback) } : {}),
          ...(usage ? { usage: structuredClone(usage) } : {})
        };
      }),
      hasMore: page.count > rows.length,
      ...(page.branchParentSessionId ? { branchParentSessionId: page.branchParentSessionId } : {}),
      usageSummary: projectSessionUsage(page.summary),
      contextUsage: page.summary.contextUsage
    };
  }
  /** 返回已验证会话最近消息页维护的累计 Provider 用量；冷会话只恢复一次该会话日志。 */
  usageSummaryForSession(sessionId: string): RecentMessagePageResult["usageSummary"] {
    this.assertReady();
    if (!this.recentMessagePages.has(sessionId)) this.loadSession(sessionId);
    const page = this.recentMessagePages.get(sessionId);
    return page ? projectSessionUsage(page.summary) : { requestCount: 0, requestCountExact: true, promptTokens: 0, completionTokens: 0, cacheReadTokens: 0, models: [] };
  }
  /** 首屏缓存未命中或加载更早消息时，完整校验 JSONL 哈希链。 */
  async readMessagePage(sessionId: string, before: { createdAt: string; order: number } | undefined, limit: number, observeEvent?: Parameters<JsonlSessionPersistence["readMessagePage"]>[3], signal?: AbortSignal): Promise<Awaited<ReturnType<JsonlSessionPersistence["readMessagePage"]>>> {
    this.assertReady();
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("会话消息分页大小无效。");
    const cached = await this.readValidatedCachePage(sessionId, before, limit, observeEvent, signal);
    return cached ?? this.persistence.readMessagePage(sessionId, before, limit, observeEvent, signal);
  }
  /** 仅对当前进程完整重放且文件指纹未变的有界缓存分页；任何竞态都丢弃结果并回退完整链扫描。 */
  private async readValidatedCachePage(sessionId: string, before: { createdAt: string; order: number } | undefined, limit: number,
    observeEvent: Parameters<JsonlSessionPersistence["readMessagePage"]>[3], signal?: AbortSignal): Promise<RecentMessagePageResult | null> {
    if (!this.loadedSessions.has(sessionId)) return null;
    const revision = this.persistence.validatedRevisionToken(sessionId);
    if (!revision) return null;
    const summaryPage = this.recentMessagePages.get(sessionId);
    const sessionSummary = summaryPage?.summary ?? createSessionSummaryAccumulator();
    const candidates: SessionRecord[] = [];
    const compare = (left: SessionRecord, right: SessionRecord) => compareMessages(left, right);
    let processed = 0;
    for (const row of this.records.get("ai_messages")!.values()) {
      signal?.throwIfAborted();
      if (row.session_id === sessionId && typeof row.id === "string" && typeof row.created_at === "string" && Number.isFinite(Number(row._order))
        && (!before || row.created_at < before.createdAt || row.created_at === before.createdAt && Number(row._order) < before.order)) {
        let low = 0, high = candidates.length;
        while (low < high) {
          const middle = (low + high) >>> 1;
          if (compare(candidates[middle]!, row) <= 0) low = middle + 1;
          else high = middle;
        }
        candidates.splice(low, 0, row);
        if (candidates.length > limit + 1) candidates.shift();
      }
      if (++processed % 256 === 0) await new Promise<void>(resume => setImmediate(resume));
    }

    const candidateIds = new Set(candidates.map(row => String(row.id)));
    const feedback = new Map<string, SessionRecord>();
    const usage = new Map<string, SessionRecord>();
    const events = this.sessionEventsBySession.get(sessionId)?.values() ?? [];
    for (const event of events) {
      signal?.throwIfAborted();
      if (!summaryPage) applySessionSummaryEvent(sessionSummary, event);
      observeEvent?.(event);
      const data = event.data;
      if (data && typeof data === "object" && !Array.isArray(data)) {
        const value = data as Record<string, unknown>;
        if (event.type === "message/feedback" && typeof value.messageId === "string" && candidateIds.has(value.messageId)) feedback.set(value.messageId, event);
        else if (event.type === "usage/record" && typeof value.runId === "string" && value.purpose !== "memory" && value.purpose !== "subagent" && candidateIds.has(value.runId)) usage.set(value.runId, event);
      }
      if (++processed % 256 === 0) await new Promise<void>(resume => setImmediate(resume));
    }
    signal?.throwIfAborted();
    if (this.persistence.validatedRevisionToken(sessionId) !== revision) return null;

    const loadedBytes = this.loadedSessions.get(sessionId) ?? 0;
    this.loadedSessions.delete(sessionId);
    this.loadedSessions.set(sessionId, loadedBytes);
    if (summaryPage) this.touchRecentMessagePage(sessionId, summaryPage);
    const hasMore = candidates.length > limit;
    const page = candidates.slice(Math.max(0, candidates.length - limit));
    return {
      items: page.map(message => {
        const projected = Object.fromEntries(displayMessageFields.filter(field => field in message).map(field => [field, message[field]]));
        const feedbackEvent = feedback.get(String(message.id));
        const usageEvent = usage.get(String(message.id));
        return { message: projected, ...(feedbackEvent ? { feedback: feedbackEvent } : {}), ...(usageEvent ? { usage: usageEvent } : {}) };
      }),
      hasMore,
      ...(summaryPage?.branchParentSessionId ? { branchParentSessionId: summaryPage.branchParentSessionId } : {}),
      usageSummary: projectSessionUsage(sessionSummary),
      contextUsage: sessionSummary.contextUsage
    };
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
    this.associationByHeader = new WeakMap(); this.recentMessagePages.clear(); this.recentMessagePageBytes = 0;
    this.usageAggregates.clear();
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
    const result: SessionRecord[] = [];
    const seen = new Set<string>();
    let cursor: { updatedAt: string; id: string } | undefined;
    while (result.length < 200) {
      const cursorClause = cursor ? " AND (updated_at < ? OR (updated_at = ? AND id > ?))" : "";
      const query = `SELECT id, updated_at FROM ai_sessions WHERE user_id = ? AND archived = ?${appId ? " AND app_id = ?" : ""}${cursorClause} ORDER BY updated_at DESC, id LIMIT 200`;
      const parameters: Array<string | number> = [userId, Number(archived)];
      if (appId) parameters.push(appId);
      if (cursor) parameters.push(cursor.updatedAt, cursor.updatedAt, cursor.id);
      const rows = database.prepare(query).all(...parameters) as Array<{ id: string; updated_at: string }>;
      for (const row of rows) {
        const id = String(row.id);
        const header = this.records.get("ai_sessions")!.get(id);
        if (header?.user_id === userId && !seen.has(id)) { result.push(structuredClone(header)); seen.add(id); }
        if (result.length >= 200) break;
      }
      if (rows.length < 200 || result.length >= 200) break;
      const last = rows.at(-1)!;
      cursor = { updatedAt: String(last.updated_at), id: String(last.id) };
    }
    return result;
  }
  /** 列表只读取已校验事件的轻量计划投影，避免为两百条标题恢复正文和完整 Kernel。 */
  planMode(sessionId: string): boolean {
    this.assertReady();
    let latest = { seq: -1, active: false };
    for (const event of this.planEvents.get(sessionId)?.values() ?? []) if (event.seq > latest.seq) latest = event;
    return latest.active;
  }
  /** 返回重放/提交期间同步维护的用量汇总，不恢复历史会话或逐行用量记录。 */
  usageSummary(userId: string): { requestCount: number; promptTokens: number | null; completionTokens: number | null; providers: Array<{ providerId: string; modelId: string; requestCount: number; promptTokens: number | null; completionTokens: number | null }> } {
    this.assertReady();
    const aggregate = this.usageAggregates.get(userId);
    if (!aggregate) return { requestCount: 0, promptTokens: null, completionTokens: null, providers: [] };
    const providers = [...aggregate.groups.values()]
      .sort((left, right) => right.latestAt.localeCompare(left.latestAt))
      .map(group => ({
        providerId: group.providerId, modelId: group.modelId, requestCount: group.requestCount,
        promptTokens: group.promptTokenCount ? group.promptTokens : null,
        completionTokens: group.completionTokenCount ? group.completionTokens : null
      }));
    return {
      requestCount: aggregate.requestCount,
      promptTokens: aggregate.promptTokenCount ? aggregate.promptTokens : null,
      completionTokens: aggregate.completionTokenCount ? aggregate.completionTokens : null,
      providers
    };
  }
  /** 关联引用来自已验证的轻量事件投影，不为会话列表恢复完整 Kernel。 */
  associations(sessionId: string): unknown {
    this.assertReady();
    const header = this.records.get("ai_sessions")!.get(sessionId);
    const projection = header ? this.associationByHeader.get(header) : undefined;
    return structuredClone(projection?.value ?? emptyAssociationProjection().value);
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
    const previousTitle = this.records.get("ai_sessions")!.get(sessionId)?.title;
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
        if (previousTitle !== header.title) this.refreshStorageIndex();
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
        const previousTitle = this.records.get("ai_sessions")!.get(sessionId)?.title;
        const rewrite = this.persistence.rewrite(sessionId, transform);
        if (!rewrite.rewrittenTransactions) return 0;
        for (const event of rewrite.commits) this.apply(sessionId, event.changes);
        if (previousTitle !== this.records.get("ai_sessions")!.get(sessionId)?.title) this.refreshStorageIndex();
        return rewrite.rewrittenTransactions;
      });
    } catch (error) {
      this.failed = true;
      throw error;
    } finally { this.trimCache(); }
  }
  removeUser(userId: string): void {
    this.usageAggregates.delete(userId);
    const headers = [...this.records.get("ai_sessions")!.values()].filter(row => row.user_id === userId);
    const sessionIds = headers.map(header => String(header.id));
    for (const listener of [...this.sessionRemovalListeners]) {
      try { listener(sessionIds); }
      catch { this.sessionRemovalListeners.delete(listener); }
    }
    for (const header of headers) {
      const sessionId = String(header.id); this.persistence.remove(sessionId);
      this.removeRecentMessagePage(sessionId);
      this.evictSession(sessionId);
      this.planEvents.delete(sessionId);
      for (const index of this.recordSessions.values()) for (const [key, owner] of index) if (owner === sessionId) index.delete(key);
      for (const table of tables) for (const [id, record] of this.records.get(table)!) if ((table === "ai_sessions" ? record.id : record.session_id) === sessionId) this.storeRecord(table, id, null);
    }
    withControlLock(database, () => {
      this.cleanupStorageIndexTemps();
      this.refreshStorageIndex();
    });
  }
  close(): void { this.persistence.close(); }
}
export const sessionRecords = new SessionRepository() satisfies SessionPersistenceBackend;
