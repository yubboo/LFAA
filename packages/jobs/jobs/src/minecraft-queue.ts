/**
 * 功能：保存并派发 Minecraft 节点任务及控制台日志。
 * 作用：提供事务化任务领取、进度回报、结果归档和实例状态联动，避免重复派发。
 * 关联文件：packages/storage/storage-sqlite/src/database.ts、packages/games/minecraft/src/service.ts、apps/daemon/src/index.mjs。
 */
import { randomUUID } from "node:crypto";
import { database } from "lfaa-storage-sqlite/src/database.js";

const taskLeaseDurationMilliseconds = 30_000;
export function requestMinecraftTaskCancellation(taskId:string,userId:string):MinecraftTask {
  const task=getMinecraftTask(taskId);
  if(!task||task.createdBy!==userId)throw new Error("找不到当前账户的 Minecraft 任务。");
  if(!["install","start"].includes(task.kind)||task.payload.executionMode!=="native")throw new Error("此操作没有接入安全取消；请等待结果后按真实状态处理。");
  if(task.status==="queued") {
    database.exec("BEGIN IMMEDIATE;");
    try {const changed=database.prepare("UPDATE minecraft_tasks SET status='failed',cancel_requested=1,message='任务尚未开始，已取消。',result_json=?,finished_at=? WHERE id=? AND status='queued'").run(JSON.stringify({outcome:"cancelled",executed:false}),new Date().toISOString(),taskId);
      if(changed.changes===1){if(task.instanceId)database.prepare("UPDATE minecraft_instances SET state=? WHERE id=?").run(task.kind==="install"?"error":"stopped",task.instanceId);if(task.deploymentId)database.prepare("UPDATE minecraft_deployments SET state='failed' WHERE id=?").run(task.deploymentId);}
      else database.prepare("UPDATE minecraft_tasks SET cancel_requested=1,message='已请求取消，等待节点确认安全退出。' WHERE id=? AND status='running'").run(taskId);
      database.exec("COMMIT;");
    }catch(error){if(database.isTransaction)database.exec("ROLLBACK;");throw error;}
  }else if(task.status==="running")database.prepare("UPDATE minecraft_tasks SET cancel_requested=1,message='已请求取消，等待节点确认安全退出。' WHERE id=? AND status='running'").run(taskId);
  return getMinecraftTask(taskId)!;
}
export function listMinecraftCancellationRequests(nodeId:string):string[]{return (database.prepare("SELECT id FROM minecraft_tasks WHERE node_id=? AND status='running' AND cancel_requested=1").all(nodeId) as Array<{id:string}>).map(row=>row.id);}

export type MinecraftTaskKind = "install" | "start" | "stop" | "properties" | "properties-read" | "backup" | "java-install" | "restart" | "console" | "delete";
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

export interface MinecraftTaskLog {
  id: number;
  stream: "stdout" | "stderr" | "system";
  line: string;
  createdAt: string;
}

export interface MinecraftTaskDetails {
  task: MinecraftTask;
  logs: MinecraftTaskLog[];
  logsTruncated: boolean;
}

export class MinecraftTaskRecordError extends Error {
  constructor(readonly code: "invalid_task_ids" | "task_not_found" | "task_not_terminal", message: string) {
    super(message);
    this.name = "MinecraftTaskRecordError";
  }
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

const minecraftPropertyFields = new Set([
  "motd", "difficulty", "gamemode", "maxPlayers", "serverPort", "viewDistance",
  "simulationDistance", "levelName", "levelSeed", "pvp", "onlineMode", "whiteList"
]);

function normalizeMinecraftPropertiesResult(result: Record<string, unknown>): {
  serverProperties: Record<string, string | number | boolean>;
  fileSnapshot: { source: "node"; observedAt: string; entries: Array<{ key: string; value: string | null; sensitive: boolean }> };
} | null {
  const rawProperties = result.serverProperties;
  const rawSnapshot = result.fileSnapshot;
  if (!rawProperties || typeof rawProperties !== "object" || Array.isArray(rawProperties)
    || !rawSnapshot || typeof rawSnapshot !== "object" || Array.isArray(rawSnapshot)) return null;
  const snapshot = rawSnapshot as Record<string, unknown>;
  const observedAt = typeof snapshot.observedAt === "string" && Number.isFinite(Date.parse(snapshot.observedAt)) ? snapshot.observedAt : null;
  if (snapshot.source !== "node" || !observedAt || !Array.isArray(snapshot.entries) || snapshot.entries.length > 256) return null;

  const entries: Array<{ key: string; value: string | null; sensitive: boolean }> = [];
  let totalCharacters = 0;
  for (const rawEntry of snapshot.entries) {
    if (!rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) return null;
    const entry = rawEntry as Record<string, unknown>;
    if (typeof entry.key !== "string" || !/^[A-Za-z0-9._-]{1,128}$/u.test(entry.key)) return null;
    const hasStringValue = typeof entry.value === "string" && entry.value.length <= 4096;
    if (entry.value !== null && !hasStringValue) return null;
    totalCharacters += entry.key.length + (typeof entry.value === "string" ? entry.value.length : 0);
    if (totalCharacters > 64 * 1024) return null;
    const sensitive = entry.sensitive === true || /password|secret|token|credential|api[-_.]?key|private[-_.]?key|^resource-pack$/iu.test(entry.key);
    entries.push({ key: entry.key, value: sensitive ? null : entry.value as string | null, sensitive });
  }

  const normalizedProperties: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(rawProperties)) {
    if (!minecraftPropertyFields.has(key)) continue;
    if ((key === "motd" || key === "difficulty" || key === "gamemode" || key === "levelName" || key === "levelSeed") && typeof value === "string" && value.length <= 2048) {
      normalizedProperties[key] = value;
    } else if (["maxPlayers", "serverPort", "viewDistance", "simulationDistance"].includes(key) && typeof value === "number" && Number.isSafeInteger(value)) {
      normalizedProperties[key] = value;
    } else if (["pvp", "onlineMode", "whiteList"].includes(key) && typeof value === "boolean") {
      normalizedProperties[key] = value;
    }
  }
  return {
    serverProperties: normalizedProperties,
    fileSnapshot: { source: "node", observedAt, entries }
  };
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
    throw new Error("实例已有排队或运行中的操作，请等待当前操作完成后重试。");
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
      WHERE node_id = ? AND status = 'queued'
        AND (kind NOT IN ('start', 'restart') OR ? = 1 OR json_extract(payload_json, '$.executionMode') = 'native')
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

export function getMinecraftTaskDetails(taskId: string, limit = 1_000): MinecraftTaskDetails | null {
  const task = getMinecraftTask(taskId);
  if (!task) return null;
  const boundedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(1_000, Math.trunc(limit))) : 1_000;
  const rows = database.prepare(`
    SELECT id, stream, line, created_at FROM minecraft_task_logs WHERE task_id = ? ORDER BY id DESC LIMIT ?
  `).all(taskId, boundedLimit + 1) as Array<{ id: number; stream: MinecraftTaskLog["stream"]; line: string; created_at: string }>;
  const logsTruncated = rows.length > boundedLimit;
  return {
    task,
    logs: rows.slice(0, boundedLimit).reverse().map((row) => ({ id: row.id, stream: row.stream, line: row.line, createdAt: row.created_at })),
    logsTruncated
  };
}

export function deleteMinecraftTaskRecords(taskIds: string[]): number {
  if (!Array.isArray(taskIds) || taskIds.length < 1 || taskIds.length > 200 || new Set(taskIds).size !== taskIds.length) {
    throw new MinecraftTaskRecordError("invalid_task_ids", "请选择 1 至 200 条不同的 Minecraft 任务记录。");
  }
  const placeholders = taskIds.map(() => "?").join(", ");
  database.exec("BEGIN IMMEDIATE;");
  try {
    const rows = database.prepare(`SELECT id, status FROM minecraft_tasks WHERE id IN (${placeholders})`).all(...taskIds) as Array<{ id: string; status: MinecraftTaskStatus }>;
    if (rows.length !== taskIds.length) throw new MinecraftTaskRecordError("task_not_found", "部分任务记录已不存在，请刷新任务列表后重试；本批没有删除。");
    if (rows.some((row) => row.status !== "succeeded" && row.status !== "failed")) {
      throw new MinecraftTaskRecordError("task_not_terminal", "排队中或执行中的任务不能删除；请等待任务结束后刷新列表，本批没有删除。");
    }
    database.prepare(`DELETE FROM minecraft_task_logs WHERE task_id IN (${placeholders})`).run(...taskIds);
    const deleted = database.prepare(`DELETE FROM minecraft_tasks WHERE id IN (${placeholders}) AND status IN ('succeeded', 'failed')`).run(...taskIds);
    if (Number(deleted.changes) !== taskIds.length) throw new MinecraftTaskRecordError("task_not_terminal", "任务状态已变化，本批没有删除；请刷新任务列表后重试。");
    database.exec("COMMIT;");
    return Number(deleted.changes);
  } catch (error) {
    if (database.isTransaction) database.exec("ROLLBACK;");
    throw error;
  }
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
  let propertySync = succeeded && (task.kind === "properties" || task.kind === "properties-read") ? normalizeMinecraftPropertiesResult(result) : null;
  if (succeeded && (task.kind === "properties" || task.kind === "properties-read") && !propertySync) {
    succeeded = false;
    message = "节点未返回有效的 server.properties 文件快照，操作未确认成功。";
  }
  if(succeeded&&task.kind==="delete"&&result.archived!==true){succeeded=false;message="节点未确认实例归档，保留实例登记。";}
  if (succeeded && (parseJsonObject(task.payload_json)?.operation === "provision" || task.kind === "start" || task.kind === "restart") && result.serverReady !== true) {
    succeeded = false;
    message = "节点未提供服务就绪证据，开服未确认成功，请查看实例日志。";
  }
  const status: MinecraftTaskStatus = succeeded ? "succeeded" : "failed";
  const finishTime = new Date().toISOString();
  const historyResult = task.kind === "properties" || task.kind === "properties-read"
    ? propertySync ? {
      fileEntries: propertySync.fileSnapshot.entries.length,
      observedAt: propertySync.fileSnapshot.observedAt,
      propertiesSynced: succeeded
    } : { propertiesSynced: succeeded, fileSnapshotAvailable: false }
    : result;

  database.exec("BEGIN IMMEDIATE;");
  try {
    const update = database.prepare(`
      UPDATE minecraft_tasks SET status = ?, progress = ?, message = ?, result_json = ?, finished_at = ?, lease_expires_at = NULL
      WHERE id = ? AND node_id = ? AND status = 'running'
    `).run(status, succeeded ? 100 : 0, message.slice(0, 240), JSON.stringify(historyResult), finishTime, taskId, nodeId);
    if (Number(update.changes) !== 1) {
      database.exec("COMMIT;");
      return false;
    }
    if (task.instance_id) {
      const payload = parseJsonObject(task.payload_json);
      const automatic = payload?.operation === "provision";
      const nextState = result.outcome==="unknown"?"unknown":task.kind === "install" ? (succeeded ? automatic && result.serverReady === true ? "running" : "stopped" : "error")
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
      if ((task.kind === "properties" || task.kind === "properties-read") && succeeded) {
        if (propertySync) {
          database.prepare("UPDATE minecraft_instances SET server_properties_json = ?, updated_at = ? WHERE id = ?")
            .run(JSON.stringify({ ...propertySync.serverProperties, fileSnapshot: propertySync.fileSnapshot }), finishTime, task.instance_id);
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
    if(task.kind==="delete"&&succeeded&&task.instance_id){
      database.prepare("DELETE FROM minecraft_deployments WHERE instance_id=?").run(task.instance_id);
      database.prepare("DELETE FROM minecraft_instances WHERE id=?").run(task.instance_id);
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
