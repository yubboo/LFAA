/**
 * 功能：保存并派发 daemon 节点文件管理任务。
 * 作用：统一记录文件操作请求、领取状态、结果和超时租约，供所有应用共用。
 * 关联文件：packages/storage/storage-sqlite/src/database.ts、packages/api/gateway/src/index.ts、packages/host/daemon/src/daemon.mjs、packages/client/connection/src/api.ts。
 */
import { randomUUID } from "node:crypto";
import { database } from "lfaa-storage-sqlite/src/database.js";

const taskLeaseDurationMilliseconds = 30_000;
const taskResultRetentionMilliseconds = 24 * 60 * 60 * 1000;

export type NodeFileOperation = "list" | "search" | "read" | "write" | "create-file" | "create-folder" | "rename" | "delete" | "upload" | "download";
export type NodeFileTaskStatus = "queued" | "running" | "succeeded" | "failed";

export interface NodeFileTask {
  id: string;
  nodeId: string;
  createdBy: string;
  operation: NodeFileOperation;
  status: NodeFileTaskStatus;
  progress: number;
  message: string;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

interface NodeFileTaskRow {
  id: string;
  node_id: string;
  created_by: string;
  operation: NodeFileOperation;
  status: NodeFileTaskStatus;
  progress: number;
  message: string;
  payload_json: string;
  result_json: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

function parseJsonObject(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function toTask(row: NodeFileTaskRow): NodeFileTask {
  return {
    id: row.id,
    nodeId: row.node_id,
    createdBy: row.created_by,
    operation: row.operation,
    status: row.status,
    progress: row.progress,
    message: row.message,
    payload: parseJsonObject(row.payload_json) ?? {},
    result: parseJsonObject(row.result_json),
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at
  };
}

export function createNodeFileTask(input: {
  nodeId: string;
  createdBy: string;
  operation: NodeFileOperation;
  payload: Record<string, unknown>;
}): NodeFileTask {
  clearExpiredNodeFileTaskResults();
  const id = randomUUID();
  database.prepare(`
    INSERT INTO node_file_tasks (id, node_id, created_by, operation, status, progress, message, payload_json)
    VALUES (?, ?, ?, ?, 'queued', 0, '等待 daemon 节点接收文件操作。', ?)
  `).run(id, input.nodeId, input.createdBy, input.operation, JSON.stringify(input.payload));
  return getNodeFileTask(id)!;
}

export function getNodeFileTask(taskId: string): NodeFileTask | null {
  const row = database.prepare("SELECT * FROM node_file_tasks WHERE id = ?").get(taskId) as NodeFileTaskRow | undefined;
  return row ? toTask(row) : null;
}

export function renewNodeFileTaskLeases(nodeId: string, taskIds: string[]): number {
  if (taskIds.length === 0) return 0;
  const expiresAt = new Date(Date.now() + taskLeaseDurationMilliseconds).toISOString();
  const placeholders = taskIds.map(() => "?").join(", ");
  const result = database.prepare(`
    UPDATE node_file_tasks SET lease_expires_at = ?
    WHERE node_id = ? AND status = 'running' AND id IN (${placeholders})
  `).run(expiresAt, nodeId, ...taskIds);
  return Number(result.changes);
}

export function claimNextNodeFileTask(nodeId: string): NodeFileTask | null {
  const now = new Date().toISOString();
  // 文件操作可能已产生副作用；租约失效时标记结果未确认并清除输入，不自动重放。
  database.prepare(`
    UPDATE node_file_tasks
    SET status = 'failed', progress = 0, message = 'Daemon 文件任务租约已过期，操作结果未确认；请检查文件状态后再决定是否重试。',
        payload_json = '{}', result_json = '{"outcome":"unknown"}', finished_at = ?, lease_expires_at = NULL
    WHERE node_id = ? AND status = 'running' AND (lease_expires_at IS NULL OR lease_expires_at <= ?)
  `).run(now, nodeId, now);

  database.exec("BEGIN IMMEDIATE;");
  try {
    const row = database.prepare(`
      SELECT id FROM node_file_tasks
      WHERE node_id = ? AND status = 'queued'
      ORDER BY created_at, rowid LIMIT 1
    `).get(nodeId) as { id: string } | undefined;
    if (!row) {
      database.exec("COMMIT;");
      return null;
    }

    const startedAt = new Date().toISOString();
    const leaseExpiresAt = new Date(Date.now() + taskLeaseDurationMilliseconds).toISOString();
    const update = database.prepare(`
      UPDATE node_file_tasks SET status = 'running', progress = 10, message = 'Daemon 节点已接收文件操作。', started_at = ?, lease_expires_at = ?
      WHERE id = ? AND status = 'queued'
    `).run(startedAt, leaseExpiresAt, row.id);
    if (Number(update.changes) !== 1) {
      database.exec("COMMIT;");
      return null;
    }
    database.exec("COMMIT;");
    return getNodeFileTask(row.id);
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

export function completeNodeFileTask(input: {
  taskId: string;
  nodeId: string;
  succeeded: boolean;
  message: string;
  result: Record<string, unknown>;
}): boolean {
  const status: NodeFileTaskStatus = input.succeeded ? "succeeded" : "failed";
  const now = new Date().toISOString();
  const update = database.prepare(`
    UPDATE node_file_tasks
    SET status = ?, progress = ?, message = ?, payload_json = '{}', result_json = ?, finished_at = ?, lease_expires_at = NULL
    WHERE id = ? AND node_id = ? AND status = 'running'
  `).run(status, input.succeeded ? 100 : 0, input.message, JSON.stringify(input.result), now, input.taskId, input.nodeId);
  return Number(update.changes) === 1;
}

function clearExpiredNodeFileTaskResults(): void {
  // 任务可能带有上传内容或下载结果；新任务入队时清理已结束超过 24 小时的文件数据。
  const cutoff = new Date(Date.now() - taskResultRetentionMilliseconds).toISOString();
  database.prepare(`
    UPDATE node_file_tasks SET result_json = NULL, payload_json = '{}'
    WHERE status IN ('succeeded', 'failed') AND finished_at IS NOT NULL AND finished_at < ?
  `).run(cutoff);
}
