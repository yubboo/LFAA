/**
 * 功能：保存并派发 daemon 节点文件管理任务。
 * 作用：统一记录文件操作请求、领取状态、结果和超时租约，供所有应用共用。
 * 关联文件：packages/storage/storage-sqlite/src/database.ts、packages/api/gateway/src/index.ts、packages/host/daemon/src/daemon.mjs、packages/client/connection/src/api.ts。
 */
import { randomUUID, createHash } from "node:crypto";
import { database } from "lfaa-storage-sqlite/src/database.js";
import { assertSystemFileAccess } from "./library.js";

const taskLeaseDurationMilliseconds = 30_000;
const taskResultRetentionMilliseconds = 24 * 60 * 60 * 1000;
let lastNodeFileAuditTrimAt = 0;

export type NodeFileOperation = import("lfaa-util-values/src/file-manager-contract.js").FileManagerOperation;
export type NodeFileTaskStatus = "queued" | "running" | "succeeded" | "failed";

export class NodeFileTaskQueueFullError extends Error {
  constructor() { super("此节点的文件任务队列已满；请等待现有操作完成后再试。"); this.name = "NodeFileTaskQueueFullError"; }
}

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
  assertSystemFileAccess(input.createdBy);
  clearExpiredNodeFileTaskResults();
  const queued = database.prepare("SELECT COUNT(*) AS count FROM node_file_tasks WHERE node_id = ? AND status IN ('queued', 'running')").get(input.nodeId) as { count: number };
  if (queued.count >= 100) throw new NodeFileTaskQueueFullError();
  const id = randomUUID();
  database.prepare(`
    INSERT INTO node_file_tasks (id, node_id, created_by, operation, status, progress, message, payload_json)
    VALUES (?, ?, ?, ?, 'queued', 0, '等待 daemon 节点接收文件操作。', ?)
  `).run(id, input.nodeId, input.createdBy, input.operation, JSON.stringify({ ...input.payload, recycleNamespace: createHash("sha256").update(input.createdBy).digest("hex") }));
  return getNodeFileTask(id)!;
}

export function getNodeFileTask(taskId: string): NodeFileTask | null {
  const row = database.prepare("SELECT * FROM node_file_tasks WHERE id = ?").get(taskId) as NodeFileTaskRow | undefined;
  return row ? toTask(row) : null;
}
/** 只取消本账户尚未执行的只读请求；已领取或写入任务保留真实状态，不能伪称已撤销。 */
export function cancelQueuedNodeFileReadTask(taskId: string, createdBy: string): boolean {
  const result = database.prepare(`UPDATE node_file_tasks SET status='failed', message='只读文件请求已取消，节点未执行。',
    payload_json='{}', result_json='{"outcome":"cancelled"}', finished_at=?
    WHERE id=? AND created_by=? AND status='queued' AND operation IN ('list','search','directory-size','preview','read','download','trash-list')`)
    .run(new Date().toISOString(), taskId, createdBy);
  return Number(result.changes) === 1;
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
      SELECT id, created_by FROM node_file_tasks
      WHERE node_id = ? AND status = 'queued'
      ORDER BY created_at, rowid LIMIT 1
    `).get(nodeId) as { id: string; created_by: string } | undefined;
    if (!row) {
      database.exec("COMMIT;");
      return null;
    }
    try { assertSystemFileAccess(row.created_by); }
    catch {
      database.prepare("UPDATE node_file_tasks SET status='failed', message='文件权限已变更，任务未执行。', payload_json='{}', finished_at=? WHERE id=? AND status='queued'").run(now, row.id);
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
  const task = getNodeFileTask(input.taskId);
  if (!task || task.nodeId !== input.nodeId) return false;
  database.exec("BEGIN IMMEDIATE;");
  try {
  const update = database.prepare(`
    UPDATE node_file_tasks
    SET status = ?, progress = ?, message = ?, payload_json = '{}', result_json = ?, finished_at = ?, lease_expires_at = NULL
    WHERE id = ? AND node_id = ? AND status = 'running'
  `).run(status, input.succeeded ? 100 : 0, input.message, JSON.stringify(input.result), now, input.taskId, input.nodeId);
  if (Number(update.changes) !== 1) {
    database.exec("COMMIT;");
    return false;
  }
  const sourcePath = typeof task.payload.path === "string" ? task.payload.path.slice(0, 1024) : "";
  const targetPath = typeof task.payload.destinationPath === "string" ? task.payload.destinationPath.slice(0, 1024) : "";
  const fileName = typeof task.payload.name === "string" ? task.payload.name.slice(0, 255) : "";
  database.prepare(`
    INSERT INTO node_file_audit (id, task_id, node_id, user_id, operation, path, target_path, file_name, succeeded, created_at, finished_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), task.id, task.nodeId, task.createdBy, task.operation, sourcePath, targetPath, fileName, input.succeeded ? 1 : 0, task.createdAt, now);
  if (Date.now() - lastNodeFileAuditTrimAt > 60 * 60 * 1000) {
    database.exec(`DELETE FROM node_file_audit WHERE id IN (
      SELECT id FROM node_file_audit ORDER BY finished_at DESC, id DESC LIMIT -1 OFFSET 20000
    )`);
    lastNodeFileAuditTrimAt = Date.now();
  }
  database.exec("COMMIT;");
  return true;
  } catch (error) {
    if (database.isTransaction) database.exec("ROLLBACK;");
    throw error;
  }
}

export function listNodeFileAudit(input: { query?: string; limit?: number } = {}): Array<{
  id: string; taskId: string; nodeId: string; userId: string; username: string; operation: string;
  path: string; targetPath: string; fileName: string; succeeded: boolean; createdAt: string; finishedAt: string;
}> {
  const query = typeof input.query === "string" ? input.query.trim().slice(0, 120) : "";
  const limit = Number.isSafeInteger(input.limit) ? Math.max(1, Math.min(input.limit!, 200)) : 100;
  const rows = query
    ? database.prepare(`
        SELECT a.*, u.username FROM node_file_audit a JOIN users u ON u.id = a.user_id
        WHERE instr(lower(a.path || ' ' || a.target_path || ' ' || a.file_name || ' ' || a.operation || ' ' || u.username), lower(?)) > 0
        ORDER BY a.finished_at DESC, a.id DESC LIMIT ?
      `).all(query, limit)
    : database.prepare(`
        SELECT a.*, u.username FROM node_file_audit a JOIN users u ON u.id = a.user_id
        ORDER BY a.finished_at DESC, a.id DESC LIMIT ?
      `).all(limit);
  return (rows as Array<{ id: string; task_id: string; node_id: string; user_id: string; username: string; operation: string; path: string; target_path: string; file_name: string; succeeded: number; created_at: string; finished_at: string }>).map(row => ({
    id: row.id, taskId: row.task_id, nodeId: row.node_id, userId: row.user_id, username: row.username,
    operation: row.operation, path: row.path, targetPath: row.target_path, fileName: row.file_name,
    succeeded: row.succeeded === 1, createdAt: row.created_at, finishedAt: row.finished_at
  }));
}

function clearExpiredNodeFileTaskResults(): void {
  // 任务可能带有上传内容、预览/下载结果；只保留 24 小时的任务快照，详细操作记录留在有界审计表。
  const cutoff = new Date(Date.now() - taskResultRetentionMilliseconds).toISOString();
  database.prepare(`
    DELETE FROM node_file_tasks
    WHERE status IN ('succeeded', 'failed') AND finished_at IS NOT NULL AND finished_at < ?
  `).run(cutoff);
}
