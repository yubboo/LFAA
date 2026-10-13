/**
 * 文件：store.ts
 * 功能：定时任务的 SQLite 持久化与 CRUD。
 * 作用：复用 LFAA 控制端共享 SQLite（lfaa-storage-sqlite 的 database 单例），用
 *       CREATE TABLE IF NOT EXISTS 幂等地建立本域表，不改动已有迁移版本号，避免与运行中服务冲突。
 * 边界：只存任务元数据与“下一次触发时刻”，不存会话正文；触发后的会话派发由 session 分片接线。
 * 关联文件：packages/storage/storage-sqlite/src/database.ts、packages/schedule/schedule/src/runtime.ts。
 */
import { randomUUID } from "node:crypto";
import { database } from "lfaa-storage-sqlite/src/database.js";
import {
  MIN_EVERY_INTERVAL_SECONDS,
  ScheduleRuleError,
  isoWeekdayToCron,
  nextCronOccurrence,
  parseWallClockTime
} from "./cron.js";

/** 任务规则选择器：恰好一个生效。 */
export type ScheduleRule =
  | { readonly kind: "at"; readonly atMs: number }
  | { readonly kind: "every"; readonly seconds: number }
  | { readonly kind: "daily"; readonly time: string; readonly timeZone: string }
  | { readonly kind: "weekly"; readonly time: string; readonly weekdays: readonly number[]; readonly timeZone: string }
  | { readonly kind: "cron"; readonly expression: string; readonly timeZone: string };

export type ScheduleTaskStatus = "active" | "paused" | "done" | "failed";

export interface ScheduleTask {
  readonly id: string;
  readonly ownerId: string;
  readonly title: string;
  readonly prompt: string;
  readonly rule: ScheduleRule;
  /** 下一次触发的 UTC 毫秒（由本域维护）。 */
  readonly nextFireAtMs: number;
  readonly status: ScheduleTaskStatus;
  readonly fireCount: number;
  readonly lastFiredAtMs: number | null;
  readonly lastError: string | null;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
}

interface TaskRow {
  id: string;
  owner_id: string;
  title: string;
  prompt: string;
  rule_json: string;
  next_fire_at: string;
  status: ScheduleTaskStatus;
  fire_count: number;
  last_fired_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

// 幂等建表：IF NOT EXISTS 保证重复加载不报错，且不占用 storage-sqlite 的迁移版本号。
database.exec(`
  CREATE TABLE IF NOT EXISTS lfaa_schedule_tasks (
    id TEXT PRIMARY KEY NOT NULL,
    owner_id TEXT NOT NULL,
    title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
    prompt TEXT NOT NULL,
    rule_json TEXT NOT NULL,
    next_fire_at INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active','paused','done','failed')),
    fire_count INTEGER NOT NULL DEFAULT 0,
    last_fired_at INTEGER,
    last_error TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  ) STRICT;
`);
database.exec(`CREATE INDEX IF NOT EXISTS lfaa_schedule_next_fire_idx ON lfaa_schedule_tasks(status, next_fire_at);`);
database.exec(`CREATE INDEX IF NOT EXISTS lfaa_schedule_owner_idx ON lfaa_schedule_tasks(owner_id, status);`);

function validateRule(rule: ScheduleRule): void {
  switch (rule.kind) {
    case "at":
      if (!Number.isFinite(rule.atMs) || rule.atMs <= 0) throw new ScheduleRuleError("绝对触发时刻无效。");
      break;
    case "every":
      if (!Number.isInteger(rule.seconds) || rule.seconds < MIN_EVERY_INTERVAL_SECONDS) {
        throw new ScheduleRuleError(`周期间隔不得小于 ${MIN_EVERY_INTERVAL_SECONDS} 秒。`);
      }
      break;
    case "daily":
      parseWallClockTime(rule.time);
      break;
    case "weekly": {
      parseWallClockTime(rule.time);
      if (!Array.isArray(rule.weekdays) || rule.weekdays.length === 0) {
        throw new ScheduleRuleError("每周任务必须至少选择一个星期。");
      }
      for (const day of rule.weekdays) isoWeekdayToCron(day);
      break;
    }
    case "cron":
      // 仅做可解析性校验，真正换算在 computeNextFireAt 中。
      nextCronOccurrence(rule.expression, rule.timeZone, Date.now());
      break;
  }
}

/**
 * 根据规则与锚点时刻，计算下一次触发 UTC 毫秒。
 * @param rule 任务规则
 * @param anchorMs 基准时刻（创建时为当前时间；周期任务触发后为本次触发时刻）
 */
export function computeNextFireAt(rule: ScheduleRule, anchorMs: number): number {
  switch (rule.kind) {
    case "at":
      // 一次性任务：固定时刻；过期则立即触发。
      return rule.atMs;
    case "every":
      return anchorMs + rule.seconds * 1000;
    case "daily": {
      const { hour, minute } = parseWallClockTime(rule.time);
      return nextCronOccurrence(`${minute} ${hour} * * *`, rule.timeZone, anchorMs) ?? anchorMs + 24 * 3600 * 1000;
    }
    case "weekly": {
      const { hour, minute } = parseWallClockTime(rule.time);
      const dowList = [...new Set(rule.weekdays.map(isoWeekdayToCron))].sort((a, b) => a - b).join(",");
      return nextCronOccurrence(`${minute} ${hour} * * ${dowList}`, rule.timeZone, anchorMs) ?? anchorMs + 7 * 24 * 3600 * 1000;
    }
    case "cron":
      return nextCronOccurrence(rule.expression, rule.timeZone, anchorMs) ?? anchorMs + 24 * 3600 * 1000;
  }
}

function rowToTask(row: TaskRow): ScheduleTask {
  let rule: ScheduleRule;
  try {
    rule = JSON.parse(row.rule_json) as ScheduleRule;
  } catch {
    // 规则损坏不阻断读路径；标记为 failed 由运维处理。
    rule = { kind: "at", atMs: Number(row.next_fire_at) };
  }
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    prompt: row.prompt,
    rule,
    nextFireAtMs: Number(row.next_fire_at),
    status: row.status,
    fireCount: Number(row.fire_count),
    lastFiredAtMs: row.last_fired_at === null ? null : Number(row.last_fired_at),
    lastError: row.last_error,
    createdAtMs: Number(row.created_at),
    updatedAtMs: Number(row.updated_at)
  };
}

export interface CreateTaskInput {
  readonly ownerId: string;
  readonly title: string;
  readonly prompt: string;
  readonly rule: ScheduleRule;
}

/** 创建一个定时任务并立即计算其首次触发时刻。 */
export function createTask(input: CreateTaskInput): ScheduleTask {
  const title = input.title.trim();
  const prompt = input.prompt.trim();
  if (title.length === 0 || title.length > 120) throw new ScheduleRuleError("任务标题必须为 1-120 个非空字符。");
  if (prompt.length === 0) throw new ScheduleRuleError("任务提示内容不能为空。");
  validateRule(input.rule);
  const now = Date.now();
  const id = `schedule-${randomUUID()}`;
  const nextFireAtMs = computeNextFireAt(input.rule, now);
  database.prepare(`
    INSERT INTO lfaa_schedule_tasks (id, owner_id, title, prompt, rule_json, next_fire_at, status, fire_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'active', 0, ?, ?)
  `).run(id, input.ownerId, title, prompt, JSON.stringify(input.rule), nextFireAtMs, now, now);
  return getTask(id)!;
}

export function getTask(id: string): ScheduleTask | null {
  const row = database.prepare("SELECT * FROM lfaa_schedule_tasks WHERE id = ?").get(id) as TaskRow | undefined;
  return row ? rowToTask(row) : null;
}

export function listTasks(ownerId?: string): ScheduleTask[] {
  const rows = ownerId === undefined
    ? database.prepare("SELECT * FROM lfaa_schedule_tasks ORDER BY next_fire_at ASC").all() as unknown as TaskRow[]
    : database.prepare("SELECT * FROM lfaa_schedule_tasks WHERE owner_id = ? ORDER BY next_fire_at ASC").all(ownerId) as unknown as TaskRow[];
  return rows.map(rowToTask);
}

/** 取出所有到点（或早于 nowMs）的活动任务，供 runtime 扫描。 */
export function listDueTasks(nowMs: number): ScheduleTask[] {
  const rows = database.prepare(`
    SELECT * FROM lfaa_schedule_tasks
    WHERE status = 'active' AND next_fire_at <= ?
    ORDER BY next_fire_at ASC LIMIT 100
  `).all(nowMs) as unknown as TaskRow[];
  return rows.map(rowToTask);
}

/** 取出所有活动任务中最近的下一次触发时刻，用于重设定时器。 */
export function nextActiveFireAt(nowMs: number): number | null {
  const row = database.prepare(`
    SELECT MIN(next_fire_at) AS next_at FROM lfaa_schedule_tasks WHERE status = 'active'
  `).get() as { next_at: number | null } | undefined;
  if (row?.next_at === null || row?.next_at === undefined) return null;
  return Math.max(Number(row.next_at), nowMs);
}

/**
 * 任务触发后的落库：推进周期任务的下一次时刻，或把一次性任务置为 done。
 * @param firedMs 本次实际触发时刻
 * @param error 派发失败原因（若有）
 */
export function markFired(id: string, firedMs: number, error: string | null): ScheduleTask | null {
  const current = getTask(id);
  if (current === null) return null;
  const recurring = current.rule.kind !== "at";
  const nextFireAtMs = recurring ? computeNextFireAt(current.rule, firedMs) : firedMs;
  const status: ScheduleTaskStatus = recurring ? "active" : error === null ? "done" : "failed";
  database.prepare(`
    UPDATE lfaa_schedule_tasks
    SET next_fire_at = ?, status = ?, fire_count = fire_count + 1, last_fired_at = ?, last_error = ?, updated_at = ?
    WHERE id = ?
  `).run(nextFireAtMs, status, firedMs, error, Date.now(), id);
  return getTask(id);
}

/**
 * 就地更新标题/提示/计时规则（保留 id 与 owner）。
 * @param fields 任一为空则保留原值；提供新 rule 时按“当前时间”重算下次触发。
 */
export function updateTaskFields(
  id: string,
  fields: { title?: string; prompt?: string; rule?: ScheduleRule }
): ScheduleTask | null {
  const current = getTask(id);
  if (current === null) return null;
  const title = fields.title ?? current.title;
  const prompt = fields.prompt ?? current.prompt;
  const rule = fields.rule ?? current.rule;
  // 仅当规则真正变化时重算，避免无关的文案修改导致触发时刻漂移。
  const nextFireAtMs = fields.rule === undefined
    ? current.nextFireAtMs
    : computeNextFireAt(rule, Date.now());
  database.prepare(`
    UPDATE lfaa_schedule_tasks
    SET title = ?, prompt = ?, rule_json = ?, next_fire_at = ?, updated_at = ?
    WHERE id = ? AND status IN ('active','paused')
  `).run(title, prompt, JSON.stringify(rule), nextFireAtMs, Date.now(), id);
  return getTask(id);
}

export function updateTaskStatus(id: string, status: ScheduleTaskStatus): boolean {
  const result = database.prepare("UPDATE lfaa_schedule_tasks SET status = ?, updated_at = ? WHERE id = ?")
    .run(status, Date.now(), id);
  return Number(result.changes) === 1;
}

/** 删除任务（含其历史），返回是否命中。 */
export function deleteTask(id: string): boolean {
  const result = database.prepare("DELETE FROM lfaa_schedule_tasks WHERE id = ?").run(id);
  return Number(result.changes) === 1;
}

/** 按 owner 删除其全部活动任务（会话归档时调用）。 */
export function deleteOwnerActiveTasks(ownerId: string): number {
  const result = database.prepare("DELETE FROM lfaa_schedule_tasks WHERE owner_id = ? AND status = 'active'").run(ownerId);
  return Number(result.changes);
}
