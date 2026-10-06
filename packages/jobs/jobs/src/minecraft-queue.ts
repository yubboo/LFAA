/**
 * 功能：保存并派发 Minecraft 节点任务及控制台日志。
 * 作用：提供事务化任务领取、进度回报、结果归档和实例状态联动，避免重复派发。
 * 关联文件：packages/storage/storage-sqlite/src/database.ts、packages/games/minecraft/src/service.ts、apps/daemon/src/index.mjs。
 */
import { randomUUID } from "node:crypto";
import { database } from "lfaa-storage-sqlite/src/database.js";

const taskLeaseDurationMilliseconds = 30_000;

export type MinecraftTaskKind = "install" | "start" | "stop" | "properties" | "backup" | "java-install" | "restart" | "console";
export type MinecraftTaskStatus = "queued" | "running" | "succeeded" | "failed";

export interface MinecraftTask {
  id: string;
  nodeId: string;
  instanceId: string | null;
  deploymentId: string | null;
  createdBy: string;
  kind: MinecraftTaskKind;
  status: MinecraftTaskStatus;
  progress: number;
  message: string;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

interface TaskRow {
  id: string;
  node_id: string;
  instance_id: string | null;
  deployment_id: string | null;
  created_by: string;
  kind: MinecraftTaskKind;
  status: MinecraftTaskStatus;
  progress: number;
  message: string;
  payload_json: string;
  storage_directory?: string | null;
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

function toTask(row: TaskRow): MinecraftTask {
  const payload = parseJsonObject(row.payload_json) ?? {};
  // 旧版排队任务也从部署/实例记录补上原目录，避免默认目录变更后落到新位置。
  if (row.storage_directory && typeof payload.storageDirectory !== "string") payload.storageDirectory = row.storage_directory;
  return {
    id: row.id,
    nodeId: row.node_id,
    instanceId: row.instance_id,
    deploymentId: row.deployment_id,
    createdBy: row.created_by,
    kind: row.kind,
    status: row.status,
    progress: row.progress,
    message: row.message,
    payload,
    result: parseJsonObject(row.result_json),
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at
  };
}

export function createMinecraftTask(input: {
  nodeId: string;
  instanceId: string | null;
  deploymentId?: string | null;
  createdBy: string;
  kind: MinecraftTaskKind;
  payload: Record<string, unknown>;
  message?: string;
}): MinecraftTask {
  if (input.instanceId && database.prepare("SELECT 1 FROM minecraft_tasks WHERE instance_id = ? AND status IN ('queued', 'running') LIMIT 1").get(input.instanceId)) {
    throw new Error("实例已有排队或运行中的操作，不能同时修改配置或启动备份。");
  }
  const id = randomUUID();
  database.prepare(`
    INSERT INTO minecraft_tasks (id, node_id, instance_id, deployment_id, created_by, kind, status, progress, message, payload_json)
    VALUES (?, ?, ?, ?, ?, ?, 'queued', 0, ?, ?)
  `).run(id, input.nodeId, input.instanceId, input.deploymentId ?? null, input.createdBy, input.kind, input.message ?? "等待本机 Daemon 接单。", JSON.stringify(input.payload));
  return getMinecraftTask(id)!;
}

export function renewMinecraftTaskLeases(nodeId: string, taskIds: string[]): number {
  if (taskIds.length === 0) return 0;
  const expiresAt = new Date(Date.now() + taskLeaseDurationMilliseconds).toISOString();
  const placeholders = taskIds.map(() => "?").join(", ");
  const result = database.prepare(`
    UPDATE minecraft_tasks SET lease_expires_at = ?
    WHERE node_id = ? AND status = 'running' AND id IN (${placeholders}) AND lease_expires_at > ?
  `).run(expiresAt, nodeId, ...taskIds, new Date().toISOString());
  return Number(result.changes);
}

function failExpiredMinecraftTasks(nodeId?: string): void {
  const now = new Date().toISOString();
  const nodeClause = nodeId ? " AND node_id = ?" : "";
  const parameters = nodeId ? [now, nodeId] : [now];
  const expired = database.prepare(`
    SELECT id, instance_id, deployment_id, kind, payload_json FROM minecraft_tasks
    WHERE status = 'running' AND (lease_expires_at IS NULL OR lease_expires_at <= ?)${nodeClause}
  `).all(...parameters) as Array<{ id: string; instance_id: string | null; deployment_id: string | null; kind: MinecraftTaskKind; payload_json: string }>;
  if (expired.length === 0) return;

  database.exec("BEGIN IMMEDIATE;");
  try {
    const updateTask = database.prepare(`
      UPDATE minecraft_tasks
      SET status = 'failed', progress = 0, message = ?, result_json = ?, finished_at = ?, lease_expires_at = NULL
      WHERE id = ? AND status = 'running' AND (lease_expires_at IS NULL OR lease_expires_at <= ?)
    `);
    const updateInstance = database.prepare(`
      UPDATE minecraft_instances SET state = 'unknown', updated_at = ?
      WHERE id = ? AND state IN ('installing', 'starting', 'stopping')
    `);

    for (const task of expired) {
      const result = updateTask.run(
        "Daemon 任务租约已过期，操作结果未确认；请检查目标实例后再手动决定后续操作。",
        JSON.stringify({ outcome: "unknown" }),
        now,
        task.id,
        now
      );
      if (Number(result.changes) === 1 && task.instance_id && ["install", "start", "stop", "restart"].includes(task.kind)) {
        updateInstance.run(now, task.instance_id);
      }
      if (Number(result.changes) === 1 && task.deployment_id) {
        const payload = parseJsonObject(task.payload_json);
        const state = payload?.operation === "register" ? "ready" : "failed";
        database.prepare("UPDATE minecraft_deployments SET state = ?, updated_at = ? WHERE id = ?")
          .run(state, now, task.deployment_id);
      }
    }
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

export function claimNextMinecraftTask(nodeId: string, sandboxAvailable = false): MinecraftTask | null {
  failExpiredMinecraftTasks(nodeId);
  database.exec("BEGIN IMMEDIATE;");
  try {
    const row = database.prepare(`
      SELECT id, deployment_id FROM minecraft_tasks
      WHERE node_id = ? AND status = 'queued' AND (kind NOT IN ('start', 'restart') OR ? = 1)
      ORDER BY created_at LIMIT 1
    `).get(nodeId, sandboxAvailable ? 1 : 0) as { id: string; deployment_id: string | null } | undefined;
    if (!row) {
      database.exec("COMMIT;");
      return null;
    }
    const startedAt = new Date().toISOString();
    const leaseExpiresAt = new Date(Date.now() + taskLeaseDurationMilliseconds).toISOString();
    const update = database.prepare(`
      UPDATE minecraft_tasks SET status = 'running', progress = 1, message = '本机 Daemon 已接单。', started_at = ?, lease_expires_at = ?
      WHERE id = ? AND status = 'queued'
    `).run(startedAt, leaseExpiresAt, row.id);
    if (Number(update.changes) !== 1) {
      database.exec("COMMIT;");
      return null;
    }
    if (row.deployment_id) {
      database.prepare("UPDATE minecraft_deployments SET state = 'downloading', updated_at = ? WHERE id = ? AND state = 'queued'")
        .run(startedAt, row.deployment_id);
    }
    database.exec("COMMIT;");
    return getMinecraftTask(row.id);
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

export function updateMinecraftTaskProgress(taskId: string, progress: number, message: string): boolean {
  const leaseExpiresAt = new Date(Date.now() + taskLeaseDurationMilliseconds).toISOString();
  const result = database.prepare(`
    UPDATE minecraft_tasks SET progress = ?, message = ?, lease_expires_at = ? WHERE id = ? AND status = 'running'
  `).run(progress, message.slice(0, 240), leaseExpiresAt, taskId);
  return Number(result.changes) === 1;
}

export function getMinecraftTask(taskId: string): MinecraftTask | null {
  const row = database.prepare(`
    SELECT task.*, COALESCE(instance.storage_directory, deployment.storage_directory) AS storage_directory
    FROM minecraft_tasks task
    LEFT JOIN minecraft_instances instance ON instance.id = task.instance_id
    LEFT JOIN minecraft_deployments deployment ON deployment.id = task.deployment_id
    WHERE task.id = ?
  `).get(taskId) as TaskRow | undefined;
  return row ? toTask(row) : null;
}

export function appendMinecraftTaskLogs(instanceId: string, taskId: string | null, stream: "stdout" | "stderr" | "system", lines: string[]): void {
  const insert = database.prepare("INSERT INTO minecraft_task_logs (instance_id, task_id, stream, line) VALUES (?, ?, ?, ?)");
  for (const line of lines.slice(-200)) insert.run(instanceId, taskId, stream, line.slice(0, 4096));
  database.prepare(`
    DELETE FROM minecraft_task_logs WHERE instance_id = ? AND id NOT IN (
      SELECT id FROM minecraft_task_logs WHERE instance_id = ? ORDER BY id DESC LIMIT 5000
    )
  `).run(instanceId, instanceId);
}

export function completeMinecraftTask(taskId: string, nodeId: string, succeeded: boolean, message: string, result: Record<string, unknown> = {}): boolean {
  failExpiredMinecraftTasks(nodeId);
  const task = database.prepare("SELECT kind, instance_id, deployment_id, payload_json FROM minecraft_tasks WHERE id = ? AND node_id = ? AND status = 'running'").get(taskId, nodeId) as { kind: MinecraftTaskKind; instance_id: string | null; deployment_id: string | null; payload_json: string } | undefined;
  if (!task) return false;
  if (succeeded && (parseJsonObject(task.payload_json)?.operation === "provision" || task.kind === "start" || task.kind === "restart") && result.serverReady !== true) {
    succeeded = false;
    message = "节点未提供服务就绪证据，开服未确认成功，请查看实例日志。";
  }
  const status: MinecraftTaskStatus = succeeded ? "succeeded" : "failed";
  const finishTime = new Date().toISOString();

  database.exec("BEGIN IMMEDIATE;");
  try {
    const update = database.prepare(`
      UPDATE minecraft_tasks SET status = ?, progress = ?, message = ?, result_json = ?, finished_at = ?, lease_expires_at = NULL
      WHERE id = ? AND node_id = ? AND status = 'running'
    `).run(status, succeeded ? 100 : 0, message.slice(0, 240), JSON.stringify(result), finishTime, taskId, nodeId);
    if (Number(update.changes) !== 1) {
      database.exec("COMMIT;");
      return false;
    }
    if (task.instance_id) {
      const payload = parseJsonObject(task.payload_json);
      const automatic = payload?.operation === "provision";
      const nextState = task.kind === "install" ? (succeeded ? automatic && result.serverReady === true ? "running" : "stopped" : "error")
        : task.kind === "start" || task.kind === "restart" ? (succeeded ? "running" : "unknown")
          : task.kind === "stop" ? (succeeded ? "stopped" : "unknown")
            : undefined;
      if (nextState) {
        database.prepare("UPDATE minecraft_instances SET state = ?, updated_at = ? WHERE id = ?")
          .run(nextState, finishTime, task.instance_id);
      }
      if (succeeded && ["install", "stop"].includes(task.kind) && payload?.executionMode !== "native") {
        database.prepare("UPDATE minecraft_instances SET sandbox_status = 'prepared', updated_at = ? WHERE id = ?")
          .run(finishTime, task.instance_id);
      }
      if (succeeded && (task.kind === "start" || task.kind === "restart") && payload?.executionMode !== "native") {
        database.prepare("UPDATE minecraft_instances SET sandbox_status = 'running', updated_at = ? WHERE id = ?")
          .run(finishTime, task.instance_id);
      }
      if (task.kind === "properties" && succeeded) {
        const payload = parseJsonObject(task.payload_json);
        const properties = payload?.properties;
        if (typeof properties === "object" && properties !== null && !Array.isArray(properties)) {
          database.prepare("UPDATE minecraft_instances SET server_properties_json = ?, updated_at = ? WHERE id = ?")
            .run(JSON.stringify(properties), finishTime, task.instance_id);
        }
      }
      if (payload?.executionMode === "native") database.prepare("UPDATE minecraft_instances SET sandbox_status = 'unsupported', execution_mode = 'native' WHERE id = ?").run(task.instance_id);
    }
    if (task.deployment_id && task.kind === "install") {
      const payload = parseJsonObject(task.payload_json);
      const nextState = payload?.operation === "provision" ? (succeeded && result.serverReady === true ? "registered" : "failed") : payload?.operation === "register" ? (succeeded ? "registered" : "ready") : (succeeded ? "ready" : "failed");
      database.prepare("UPDATE minecraft_deployments SET state = ?, updated_at = ? WHERE id = ?")
        .run(nextState, finishTime, task.deployment_id);
    }
    database.exec("COMMIT;");
    return true;
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

export function listMinecraftTasks(limit = 100): MinecraftTask[] {
  failExpiredMinecraftTasks();
  const rows = database.prepare("SELECT * FROM minecraft_tasks ORDER BY created_at DESC LIMIT ?").all(limit) as unknown as TaskRow[];
  return rows.map(toTask);
}

export function listMinecraftLogs(instanceId: string, limit = 500): Array<{ id: number; stream: string; line: string; createdAt: string }> {
  const rows = database.prepare(`
    SELECT id, stream, line, created_at FROM minecraft_task_logs WHERE instance_id = ? ORDER BY id DESC LIMIT ?
  `).all(instanceId, limit) as Array<{ id: number; stream: string; line: string; created_at: string }>;
  return rows.reverse().map((row) => ({ id: row.id, stream: row.stream, line: row.line, createdAt: row.created_at }));
}
