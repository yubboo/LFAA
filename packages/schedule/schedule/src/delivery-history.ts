/**
 * 文件：delivery-history.ts
 * 功能：到点触发（投递）历史的持久化与分页。
 * 作用：每次扫描驱动触发任务时落一条 success/failed 记录（含错误信息与退避状态），
 *       用于事后排查“为何没提醒/为何失败”；按天数与条数双阈值裁剪，防止无限增长。
 * 边界：这里只记录“触发事件”，不记录会话正文；消息 id 由会话分片接线后回填（暂为 null）。
 * 关联文件：packages/schedule/schedule/src/runtime.ts、store.ts、types.ts。
 * 移植参考：DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84）
 *          packages/schedule/schedule/src/delivery-history.ts 的保留窗口语义。
 */
import { randomUUID } from "node:crypto";
import { database } from "lfaa-storage-sqlite/src/database.js";
import type { ScheduleDeliveryRecord } from "./types.js";

/** 保留窗口：默认 30 天、每个任务最多 200 条。 */
const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_RETENTION_RECORDS = 200;
const DAY_MS = 86_400_000;

database.exec(`
  CREATE TABLE IF NOT EXISTS lfaa_schedule_deliveries (
    id TEXT PRIMARY KEY NOT NULL,
    task_id TEXT NOT NULL,
    fired_at INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success','failed')),
    error TEXT,
    message_id TEXT
  ) STRICT;
`);
database.exec(`CREATE INDEX IF NOT EXISTS lfaa_schedule_delivery_task_idx ON lfaa_schedule_deliveries(task_id, fired_at DESC);`);

interface DeliveryRow {
  id: string;
  task_id: string;
  fired_at: number;
  status: "success" | "failed";
  error: string | null;
  message_id: string | null;
}

function rowToRecord(row: DeliveryRow): ScheduleDeliveryRecord {
  return {
    id: row.id,
    taskId: row.task_id,
    firedAtMs: Number(row.fired_at),
    status: row.status,
    error: row.error,
    messageId: row.message_id
  };
}

/** 记录一次触发；成功或失败都落库，并立即按窗口裁剪。 */
export function recordDelivery(input: {
  readonly taskId: string;
  readonly firedAtMs: number;
  readonly status: "success" | "failed";
  readonly error?: string | null;
  readonly messageId?: string | null;
}): ScheduleDeliveryRecord {
  const id = `delivery-${randomUUID()}`;
  database.prepare(`
    INSERT INTO lfaa_schedule_deliveries (id, task_id, fired_at, status, error, message_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, input.taskId, input.firedAtMs, input.status, input.error ?? null, input.messageId ?? null);
  pruneDeliveries(input.taskId);
  return {
    id,
    taskId: input.taskId,
    firedAtMs: input.firedAtMs,
    status: input.status,
    error: input.error ?? null,
    messageId: input.messageId ?? null
  };
}

/** 按触发时间倒序列出某任务的最近 N 条投递。 */
export function listDeliveries(taskId: string, limit = 50): ScheduleDeliveryRecord[] {
  const rows = database.prepare(`
    SELECT * FROM lfaa_schedule_deliveries WHERE task_id = ? ORDER BY fired_at DESC LIMIT ?
  `).all(taskId, limit) as unknown as DeliveryRow[];
  return rows.map(rowToRecord);
}

/** 删除某任务的全部投递历史（任务被删除时调用）。 */
export function deleteDeliveriesForTask(taskId: string): void {
  database.prepare("DELETE FROM lfaa_schedule_deliveries WHERE task_id = ?").run(taskId);
}

/**
 * 裁剪：先按天数删除过旧记录，再按条数保留每个任务最近的上限。
 * 仅在单写路径（recordDelivery）调用，避免读路径额外约束。
 */
function pruneDeliveries(taskId: string): void {
  const cutoff = Date.now() - DEFAULT_RETENTION_DAYS * DAY_MS;
  database.prepare("DELETE FROM lfaa_schedule_deliveries WHERE task_id = ? AND fired_at < ?").run(taskId, cutoff);
  // 保留最近 N 条：删除 rowid 不在“最近 N 条”集合内的记录。
  database.prepare(`
    DELETE FROM lfaa_schedule_deliveries
    WHERE task_id = ?
      AND id NOT IN (
        SELECT id FROM lfaa_schedule_deliveries WHERE task_id = ?
        ORDER BY fired_at DESC LIMIT ?
      )
  `).run(taskId, taskId, DEFAULT_RETENTION_RECORDS);
}
