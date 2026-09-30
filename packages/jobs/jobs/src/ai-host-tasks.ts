/**
 * 功能：保存 AI Work 的主机 Shell 命令并通过在线 Daemon 节点派发执行。
 * 作用：提供排队、一次性租约、心跳续租、真实结果回传和过期清理；Shell 命令与项目文件任务分别校验对应的 Daemon 能力。
 * 不负责：权限审批、命令解释或直接在 server 上启动进程。
 * 关联文件：packages/storage/storage-sqlite/src/database.ts、packages/api/gateway/src/index.ts、packages/core/tools/src/business-tools.ts、packages/host/daemon/src/daemon.mjs。
 */
import { randomUUID } from "node:crypto";
import { database } from "lfaa-storage-sqlite/src/database.js";
import { getDaemonNode, listDaemonNodes } from "lfaa-host-daemon/src/local-daemon.js";
import type { ApplicationId } from "lfaa-settings/src/preferences/service.js";

const leaseDurationMilliseconds = 30_000;
const resultRetentionMilliseconds = 24 * 60 * 60 * 1000;
let lastResultCleanupAt = 0;

export type AiHostShell = "system" | "powershell" | "cmd" | "bash" | "zsh" | "project-files";
export type AiHostTaskStatus = "queued" | "running" | "succeeded" | "failed";

export interface AiHostTaskResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  outputTruncated: boolean;
}

export interface AiHostTask {
  id: string;
  nodeId: string;
  createdBy: string;
  appId: ApplicationId;
  shell: AiHostShell;
  workingDirectory: string;
  command: string;
  timeoutSeconds: number;
  status: AiHostTaskStatus;
  message: string;
  result: AiHostTaskResult | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

interface AiHostTaskRow {
  id: string;
  node_id: string;
  created_by: string;
  app_id: ApplicationId;
  shell: AiHostShell;
  working_directory: string;
  command: string;
  timeout_seconds: number;
  status: AiHostTaskStatus;
  message: string;
  result_json: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

function parseResult(value: string | null): AiHostTaskResult | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    if (typeof record.stdout !== "string" || typeof record.stderr !== "string"
      || !(typeof record.exitCode === "number" || record.exitCode === null)
      || typeof record.timedOut !== "boolean" || typeof record.outputTruncated !== "boolean") return null;
    return {
      stdout: record.stdout,
      stderr: record.stderr,
      exitCode: record.exitCode,
      timedOut: record.timedOut,
      outputTruncated: record.outputTruncated
    };
  } catch {
    return null;
  }
}

function toTask(row: AiHostTaskRow): AiHostTask {
  return {
    id: row.id,
    nodeId: row.node_id,
    createdBy: row.created_by,
    appId: row.app_id,
    shell: row.shell,
    workingDirectory: row.working_directory,
    command: row.command,
    timeoutSeconds: row.timeout_seconds,
    status: row.status,
    message: row.message,
    result: parseResult(row.result_json),
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at
  };
}

export function listAiHostNodes(): Array<{ id: string; displayName: string; status: "online" | "offline"; platform: string; architecture: string; version: string; shellSupported: boolean; projectFilesSupported: boolean }> {
  return listDaemonNodes().map(({ id, displayName, status, platform, architecture, version, capabilities }) => ({
    id,
    displayName,
    status,
    platform,
    architecture,
    version,
    shellSupported: capabilities.includes("agent-shell-v1"),
    projectFilesSupported: capabilities.includes("project-files-v1")
  }));
}

export function createAiHostTask(input: {
  nodeId: string;
  createdBy: string;
  appId: ApplicationId;
  shell: AiHostShell;
  workingDirectory: string;
  command: string;
  timeoutSeconds: number;
}): AiHostTask {
  const node = getDaemonNode(input.nodeId);
  if (!node || node.status !== "online" || Date.parse(node.lastSeenAt) < Date.now() - 20_000 || !node.capabilities.includes(input.shell === "project-files" ? "project-files-v1" : "agent-shell-v1")) {
    throw new Error(`目标 Daemon 节点离线或尚未报告 ${input.shell === "project-files" ? "project-files-v1" : "agent-shell-v1"} 能力。请先读取主机节点列表。`);
  }
  clearExpiredAiHostTaskResults();
  const id = randomUUID();
  database.prepare(`
    INSERT INTO ai_host_tasks (id, node_id, created_by, app_id, shell, working_directory, command, timeout_seconds, status, message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', '等待 Daemon 节点接收主机命令。')
  `).run(id, input.nodeId, input.createdBy, input.appId, input.shell, input.workingDirectory, input.command, input.timeoutSeconds);
  return getAiHostTask(id)!;
}

export function getAiHostTask(taskId: string): AiHostTask | null {
  const row = database.prepare("SELECT * FROM ai_host_tasks WHERE id = ?").get(taskId) as AiHostTaskRow | undefined;
  return row ? toTask(row) : null;
}

/** 命令面板仅返回当前账户最近的真实任务摘要，正文按任务独立查询。 */
export function listUserAiHostTasks(userId: string): Array<Omit<AiHostTask, "command" | "result">> {
  const rows = database.prepare("SELECT * FROM ai_host_tasks WHERE created_by = ? ORDER BY created_at DESC LIMIT 50").all(userId) as unknown as AiHostTaskRow[];
  return rows.map(row => { const { command: _command, result: _result, ...summary } = toTask(row); return summary; });
}

export function renewAiHostTaskLeases(nodeId: string, taskIds: string[]): number {
  if (Date.now() - lastResultCleanupAt >= 60_000) {
    clearExpiredAiHostTaskResults();
    lastResultCleanupAt = Date.now();
  }
  if (taskIds.length === 0) return 0;
  const expiresAt = new Date(Date.now() + leaseDurationMilliseconds).toISOString();
  const placeholders = taskIds.map(() => "?").join(", ");
  const result = database.prepare(`
    UPDATE ai_host_tasks SET lease_expires_at = ?
    WHERE node_id = ? AND status = 'running' AND id IN (${placeholders})
  `).run(expiresAt, nodeId, ...taskIds);
  return Number(result.changes);
}

export function claimNextAiHostTask(nodeId: string): AiHostTask | null {
  const node = getDaemonNode(nodeId);
  if (!node || node.status !== "online") return null;
  const canRunShell = node.capabilities.includes("agent-shell-v1");
  const canRunProjectFiles = node.capabilities.includes("project-files-v1");
  if (!canRunShell && !canRunProjectFiles) return null;

  const now = new Date().toISOString();
  // 命令可能已产生任意主机副作用；租约失效时不重放，只记录结果未知并清除待执行命令。
  database.prepare(`
    UPDATE ai_host_tasks
    SET status = 'failed', message = 'Daemon 命令任务租约已过期，执行结果未知；命令不会自动重放。',
        command = '', working_directory = '', result_json = '{"stdout":"","stderr":"执行结果未知；请检查节点状态后再决定是否重试。","exitCode":null,"timedOut":false,"outputTruncated":false}',
        finished_at = ?, lease_expires_at = NULL
    WHERE node_id = ? AND status = 'running' AND (lease_expires_at IS NULL OR lease_expires_at <= ?)
  `).run(now, nodeId, now);

  database.exec("BEGIN IMMEDIATE;");
  try {
    // 按任务实际需要的能力挑选最早可执行项；文件能力不再被 Shell 能力捆绑。
    const row = database.prepare(`
      SELECT id FROM ai_host_tasks
      WHERE node_id = ? AND status = 'queued'
        AND ((shell = 'project-files' AND ? = 1) OR (shell <> 'project-files' AND ? = 1))
      ORDER BY created_at, rowid LIMIT 1
    `).get(nodeId, canRunProjectFiles ? 1 : 0, canRunShell ? 1 : 0) as { id: string } | undefined;
    if (!row) {
      database.exec("COMMIT;");
      return null;
    }
    const startedAt = new Date().toISOString();
    const leaseExpiresAt = new Date(Date.now() + leaseDurationMilliseconds).toISOString();
    const update = database.prepare(`
      UPDATE ai_host_tasks SET status = 'running', message = 'Daemon 节点已接收主机命令。', started_at = ?, lease_expires_at = ?
      WHERE id = ? AND status = 'queued'
    `).run(startedAt, leaseExpiresAt, row.id);
    if (Number(update.changes) !== 1) {
      database.exec("COMMIT;");
      return null;
    }
    database.exec("COMMIT;");
    return getAiHostTask(row.id);
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

export function completeAiHostTask(input: {
  taskId: string;
  nodeId: string;
  succeeded: boolean;
  message: string;
  result: AiHostTaskResult;
}): boolean {
  const status: AiHostTaskStatus = input.succeeded ? "succeeded" : "failed";
  const now = new Date().toISOString();
  const update = database.prepare(`
    UPDATE ai_host_tasks
    SET status = ?, message = ?, command = '', working_directory = '', result_json = ?, finished_at = ?, lease_expires_at = NULL
    WHERE id = ? AND node_id = ? AND status = 'running'
  `).run(status, input.message, JSON.stringify(input.result), now, input.taskId, input.nodeId);
  return Number(update.changes) === 1;
}

function clearExpiredAiHostTaskResults(): void {
  const cutoff = new Date(Date.now() - resultRetentionMilliseconds).toISOString();
  database.prepare(`
    UPDATE ai_host_tasks SET result_json = NULL, command = '', working_directory = ''
    WHERE status IN ('succeeded', 'failed') AND finished_at IS NOT NULL AND finished_at < ?
  `).run(cutoff);
}
