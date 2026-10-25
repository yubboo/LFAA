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
import { EXECUTION_SANDBOX_MODES, type ExecutionSandboxMode } from "lfaa-util-values/src/sandbox-contract.js";
import { win32 } from "node:path";

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
  cancelled?: boolean;
  sandbox?: {
    mode: ExecutionSandboxMode;
    enforcement: "full" | "none";
    denied: boolean;
    providerId: string;
    hostVerified?: boolean;
    runnerFailed?: boolean;
  };
}

export interface AiHostTask {
  id: string;
  nodeId: string;
  createdBy: string;
  appId: ApplicationId;
  shell: AiHostShell;
  workingDirectory: string;
  sandboxMode: ExecutionSandboxMode;
  workspaceRoot: string;
  command: string;
  timeoutSeconds: number;
  status: AiHostTaskStatus;
  message: string;
  result: AiHostTaskResult | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  cancelRequested: boolean;
  outputSequence: number;
}

interface AiHostTaskRow {
  id: string;
  node_id: string;
  created_by: string;
  app_id: ApplicationId;
  shell: AiHostShell;
  working_directory: string;
  sandbox_mode: ExecutionSandboxMode;
  workspace_root: string;
  command: string;
  timeout_seconds: number;
  status: AiHostTaskStatus;
  message: string;
  result_json: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  cancel_requested: number;
  output_sequence: number;
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
    const sandbox = record.sandbox;
    const sandboxRecord = typeof sandbox === "object" && sandbox !== null && !Array.isArray(sandbox)
      ? sandbox as Record<string, unknown> : null;
    if (sandboxRecord && (!EXECUTION_SANDBOX_MODES.includes(sandboxRecord.mode as ExecutionSandboxMode)
      || (sandboxRecord.enforcement !== "full" && sandboxRecord.enforcement !== "none")
      || typeof sandboxRecord.denied !== "boolean" || typeof sandboxRecord.providerId !== "string"
      || (sandboxRecord.hostVerified !== undefined && typeof sandboxRecord.hostVerified !== "boolean")
      || (sandboxRecord.runnerFailed !== undefined && typeof sandboxRecord.runnerFailed !== "boolean"))) return null;
    return {
      stdout: record.stdout,
      stderr: record.stderr,
      exitCode: record.exitCode,
      timedOut: record.timedOut,
      outputTruncated: record.outputTruncated,
      cancelled: record.cancelled === true,
      ...(sandboxRecord ? { sandbox: {
        mode: sandboxRecord.mode as ExecutionSandboxMode,
        enforcement: sandboxRecord.enforcement as "full" | "none",
        denied: sandboxRecord.denied as boolean,
        providerId: sandboxRecord.providerId as string,
        ...(typeof sandboxRecord.hostVerified === "boolean" ? { hostVerified: sandboxRecord.hostVerified } : {}),
        ...(sandboxRecord.runnerFailed === true ? { runnerFailed: true } : {})
      } } : {})
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
    sandboxMode: row.sandbox_mode,
    workspaceRoot: row.workspace_root,
    command: row.command,
    timeoutSeconds: row.timeout_seconds,
    status: row.status,
    message: row.message,
    result: parseResult(row.result_json),
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    cancelRequested: row.cancel_requested === 1,
    outputSequence: row.output_sequence ?? 0
  };
}

export function listAiHostNodes(): Array<{ id: string; displayName: string; status: "online" | "offline"; platform: string; architecture: string; version: string; shellSupported: boolean; projectFilesSupported: boolean; sandboxSupported: boolean }> {
  return listDaemonNodes().map(({ id, displayName, status, platform, architecture, version, capabilities }) => ({
    id,
    displayName,
    status,
    platform,
    architecture,
    version,
    shellSupported: capabilities.includes("agent-shell-v1"),
    projectFilesSupported: capabilities.includes("project-files-v1"),
    sandboxSupported: platform === "win32" && architecture === "x64" && capabilities.includes("app-sandbox-windows-appcontainer-v1")
  }));
}

export function createAiHostTask(input: {
  nodeId: string;
  createdBy: string;
  appId: ApplicationId;
  shell: AiHostShell;
  workingDirectory: string;
  sandboxMode?: ExecutionSandboxMode;
  workspaceRoot?: string;
  command: string;
  timeoutSeconds: number;
}): AiHostTask {
  const node = getDaemonNode(input.nodeId);
  const requiredCapability = input.shell === "project-files" ? "project-files-v1" : "agent-shell-v1";
  if (!node || node.status !== "online" || Date.parse(node.lastSeenAt) < Date.now() - 20_000 || !node.capabilities.includes(requiredCapability)) {
    throw new Error(`目标 Daemon 节点离线或尚未报告 ${requiredCapability} 能力。请先读取主机节点列表。`);
  }
  const sandboxMode = input.sandboxMode ?? "danger-full-access";
  const workspaceRoot = input.workspaceRoot ?? "";
  if (sandboxMode !== "danger-full-access") {
    if (input.shell === "project-files") throw new Error("项目文件任务不能借用 Agent Shell 沙箱策略，请使用其专属文件工具。");
    if (node.platform !== "win32" || node.architecture !== "x64" || !node.capabilities.includes("app-sandbox-windows-appcontainer-v1")) {
      throw new Error("目标节点未报告可用的 Windows x64 AppContainer Provider；受限命令已拒绝排队。");
    }
    if (!workspaceRoot || !win32.isAbsolute(workspaceRoot) || !win32.isAbsolute(input.workingDirectory)) {
      throw new Error("受限节点命令需要来自当前目标节点项目的绝对工作区与命令目录。");
    }
    const relativePath = win32.relative(workspaceRoot, input.workingDirectory);
    if (relativePath === ".." || relativePath.startsWith(`..${win32.sep}`) || win32.isAbsolute(relativePath)) {
      throw new Error("节点命令工作目录必须位于当前项目工作区内。");
    }
  }
  clearExpiredAiHostTaskResults();
  const id = randomUUID();
  database.prepare(`
    INSERT INTO ai_host_tasks (id, node_id, created_by, app_id, shell, working_directory, sandbox_mode, workspace_root, command, timeout_seconds, status, message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', '等待 Daemon 节点接收主机命令。')
  `).run(id, input.nodeId, input.createdBy, input.appId, input.shell, input.workingDirectory, sandboxMode, workspaceRoot, input.command, input.timeoutSeconds);
  return getAiHostTask(id)!;
}

export function getAiHostTask(taskId: string): AiHostTask | null {
  failExpiredAiHostTasks();
  const row = database.prepare("SELECT * FROM ai_host_tasks WHERE id = ?").get(taskId) as AiHostTaskRow | undefined;
  return row ? toTask(row) : null;
}

/** 命令面板仅返回当前账户最近的真实任务摘要，正文按任务独立查询。 */
export function listUserAiHostTasks(userId: string): Array<Omit<AiHostTask, "command" | "result">> {
  failExpiredAiHostTasks();
  // 摘要只读取元数据；禁止先复制/解析所有任务的 MiB 输出再丢弃，正文仍由单任务接口提供。
  const rows = database.prepare(`SELECT id, node_id, created_by, app_id, shell, working_directory, sandbox_mode, workspace_root,
    timeout_seconds, status, message, created_at, started_at, finished_at, cancel_requested, output_sequence,
    '' AS command, NULL AS result_json
    FROM ai_host_tasks WHERE created_by = ? ORDER BY created_at DESC LIMIT 50`).all(userId) as unknown as AiHostTaskRow[];
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
    WHERE node_id = ? AND status = 'running' AND id IN (${placeholders}) AND lease_expires_at > ?
  `).run(expiresAt, nodeId, ...taskIds, new Date().toISOString());
  return Number(result.changes);
}

export function claimNextAiHostTask(nodeId: string): AiHostTask | null {
  failExpiredAiHostTasks();
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
        command = '', working_directory = '', workspace_root = '', result_json = '{"stdout":"","stderr":"执行结果未知；请检查节点状态后再决定是否重试。","exitCode":null,"timedOut":false,"outputTruncated":false}',
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
  const task = database.prepare("SELECT sandbox_mode FROM ai_host_tasks WHERE id = ? AND node_id = ? AND status = 'running'")
    .get(input.taskId, input.nodeId) as { sandbox_mode: ExecutionSandboxMode } | undefined;
  if (!task) return false;
  const sandboxConfirmed = task.sandbox_mode === "danger-full-access"
    || (input.result.sandbox?.mode === task.sandbox_mode && input.result.sandbox.enforcement === "full"
      && input.result.sandbox.denied === false && input.result.sandbox.hostVerified === true && input.result.sandbox.runnerFailed !== true);
  // 受限结果只有带有当前 Host 的有效回执才可成功；模式、取消或退出码不能替代隔离证据。
  const status: AiHostTaskStatus = input.succeeded && sandboxConfirmed && input.result.exitCode === 0 && !input.result.timedOut && !input.result.cancelled ? "succeeded" : "failed";
  const message = input.succeeded && !sandboxConfirmed
    ? "受限命令缺少有效的 Windows AppContainer Host 回执；执行结果未确认。"
    : input.message;
  const now = new Date().toISOString();
  const update = database.prepare(`
    UPDATE ai_host_tasks
    SET status = ?, message = ?, command = '', working_directory = '', workspace_root = '', result_json = ?, finished_at = ?, lease_expires_at = NULL
    WHERE id = ? AND node_id = ? AND status = 'running' AND lease_expires_at > ?
  `).run(status, message, JSON.stringify(input.result), now, input.taskId, input.nodeId, now);
  return Number(update.changes) === 1;
}

/** 取消排队任务可以确认未执行；运行任务只记录请求，必须等执行器确认 close 后才结束。 */
export function requestAiHostTaskCancellation(taskId: string, userId: string): boolean {
  const task = getAiHostTask(taskId);
  if (!task || task.createdBy !== userId) return false;
  if (task.status === "succeeded" || task.status === "failed") return true;
  if (task.status === "queued") {
    database.prepare("UPDATE ai_host_tasks SET cancel_requested = 1, status = 'failed', command = '', working_directory = '', workspace_root = '', message = '任务在执行前已取消。', result_json = ?, finished_at = ? WHERE id = ? AND created_by = ? AND status = 'queued'")
      .run(JSON.stringify({ stdout: "", stderr: "", exitCode: null, timedOut: false, outputTruncated: false, cancelled: true }), new Date().toISOString(), taskId, userId);
  } else {
    database.prepare("UPDATE ai_host_tasks SET cancel_requested = 1, message = '已请求节点终止进程树；尚未确认终止结果。' WHERE id = ? AND created_by = ? AND status = 'running'").run(taskId, userId);
  }
  return true;
}

export function listAiHostCancellationRequests(nodeId: string): string[] {
  return (database.prepare("SELECT id FROM ai_host_tasks WHERE node_id = ? AND status = 'running' AND cancel_requested = 1").all(nodeId) as Array<{ id: string }>).map(row => row.id);
}

/** 保存单调递增、总量受限的输出快照；重复/乱序传输不能覆盖较新的证据。 */
export function updateAiHostTaskOutput(taskId: string, nodeId: string, sequence: number, result: AiHostTaskResult): boolean {
  if (!Number.isSafeInteger(sequence) || sequence < 1 || Buffer.byteLength(result.stdout) > 1024 * 1024 || Buffer.byteLength(result.stderr) > 1024 * 1024) return false;
  const now = new Date().toISOString();
  const update = database.prepare("UPDATE ai_host_tasks SET result_json = ?, output_sequence = ? WHERE id = ? AND node_id = ? AND status = 'running' AND output_sequence < ? AND lease_expires_at > ?")
    .run(JSON.stringify(result), sequence, taskId, nodeId, sequence, now);
  return Number(update.changes) === 1;
}

function failExpiredAiHostTasks(): void {
  const now = new Date().toISOString();
  database.prepare("UPDATE ai_host_tasks SET status = 'failed', message = '节点任务租约已过期，执行结果未知；不会自动重放。', command = '', working_directory = '', workspace_root = '', finished_at = ?, lease_expires_at = NULL WHERE status = 'running' AND (lease_expires_at IS NULL OR lease_expires_at <= ?)").run(now, now);
}

function clearExpiredAiHostTaskResults(): void {
  const cutoff = new Date(Date.now() - resultRetentionMilliseconds).toISOString();
  database.prepare(`
    UPDATE ai_host_tasks SET result_json = NULL, command = '', working_directory = ''
    WHERE status IN ('succeeded', 'failed') AND finished_at IS NOT NULL AND finished_at < ?
  `).run(cutoff);
}
