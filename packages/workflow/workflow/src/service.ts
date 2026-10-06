/**
 * 功能：提供账户与 App 隔离的工作流图、运行记录和插件执行协调。
 * 作用：持有唯一持久化 Owner，并将节点/引擎执行委派给已登记的适配器。
 * 边界：不导入 Agent、Minecraft、Tool、权限或 Daemon 领域实现。
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, lstatSync, readFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import type { ApplicationId } from "lfaa-util-values/src/application-id.js";
import { database } from "lfaa-storage-sqlite/src/database.js";
import { config } from "lfaa-launch-environment/src/config.js";
import { resolveUserDataPaths } from "lfaa-home-paths/src/data-layout.mjs";
import { atomicWrite } from "lfaa-storage-json/src/index.js";
import { withControlLock } from "lfaa-storage-domain/src/control-lock.js";
import { DEFAULT_WORKFLOW_ENGINE_ID, normalizeWorkflowDefinition, type WorkflowDefinitionShape } from "./graph.js";
import {
  executeWorkflowNode,
  getWorkflowEngine,
  listWorkflowEngines,
  listWorkflowNodes,
  resolveWorkflowNodeType,
  validateWorkflowRun,
  type WorkflowEngineContext,
  type WorkflowNodeExecutionContext,
  type WorkflowNodeRunStatus
} from "./registry.js";

const MAX_WORKFLOWS_PER_APP = 50;
const MAX_RUNS_PER_WORKFLOW = 50;
const MAX_ACTIVE_RUNS_PER_USER = 2;
const MAX_NODE_INPUT_CHARS = 12_000;
const MAX_NODE_OUTPUT_PREVIEW_CHARS = 700;

export type WorkflowStatus = "queued" | "running" | "succeeded" | "failed" | "interrupted";
export type WorkflowNodeStatus = WorkflowNodeRunStatus;
export interface WorkflowDefinition extends WorkflowDefinitionShape { id: string; createdAt: string; updatedAt: string }
export interface WorkflowRunNode {
  nodeId: string;
  type: string;
  title: string;
  startedAt: string | null;
  completedAt: string | null;
  status: WorkflowNodeStatus;
  output?: string;
  outputTruncated?: boolean;
  references?: Array<{ kind: string; id: string }>;
  progress?: Record<string, unknown>;
  error?: string;
}
export interface WorkflowRun {
  id: string;
  appId: ApplicationId;
  workflowId: string;
  status: WorkflowStatus;
  nodes: WorkflowRunNode[];
  currentNodeId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface WorkflowRow { id: string; user_id: string; application_id: ApplicationId; title: string; definition_json: string; created_at: string; updated_at: string }
interface WorkflowRunRow {
  id: string; workflow_id: string; application_id: ApplicationId; status: WorkflowStatus; nodes_json: string;
  current_node_id: string | null; created_at: string; updated_at: string;
}
interface LiveWorkflowRun {
  userId: string;
  appId: ApplicationId;
  controller: AbortController;
  state: Map<string, unknown>;
  currentNodeId: string | null;
}
const liveRuns = new Map<string, LiveWorkflowRun>();

function fail(message: string): never { throw new Error(message); }
function rowQuery(): string { return "SELECT id, user_id, application_id, title, definition_json, created_at, updated_at FROM workflow_definitions"; }

function definitionPath(row: Pick<WorkflowRow, "id" | "user_id" | "application_id">): string {
  const directory = resolveUserDataPaths(config.dataDirectory, row.user_id).workflows(row.application_id);
  return resolve(directory, `${createHash("sha256").update(row.id, "utf8").digest("hex")}.json`);
}

function readDefinitionFile(row: WorkflowRow): WorkflowDefinition {
  const path = definitionPath(row);
  const inline = row.definition_json !== "{}" ? JSON.parse(row.definition_json) as unknown : undefined;
  let saved: unknown;
  if (inline !== undefined) {
    const normalizedInline = normalizeWorkflowDefinition({ ...(inline as Record<string, unknown>), title: row.title }, row.application_id, resolveWorkflowNodeType);
    if (existsSync(path)) {
      const file = lstatSync(path);
      if (!file.isFile() || file.isSymbolicLink()) throw new Error("工作流文件类型无效；拒绝跟随链接读取。");
      const existing = JSON.parse(readFileSync(path, "utf8")) as unknown;
      if (JSON.stringify(existing) !== JSON.stringify(normalizedInline)) throw new Error("工作流文件与待迁移 SQLite 定义冲突；两份来源均保留。");
    } else atomicWrite(path, normalizedInline);
    const readback = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (JSON.stringify(readback) !== JSON.stringify(normalizedInline)) throw new Error("工作流文件回读校验失败；SQLite 定义仍保留。");
    withControlLock(database, () => {
      const updated = database.prepare("UPDATE workflow_definitions SET definition_json = '{}' WHERE user_id = ? AND application_id = ? AND id = ? AND definition_json = ?")
        .run(row.user_id, row.application_id, row.id, row.definition_json);
      if (Number(updated.changes) !== 1) throw new Error("工作流迁移期间定义发生变化；请重试。");
    });
    saved = readback;
  } else {
    if (!existsSync(path)) throw new Error("工作流定义文件缺失；SQLite 只保留了索引，未返回空白定义。");
    const file = lstatSync(path);
    if (!file.isFile() || file.isSymbolicLink()) throw new Error("工作流文件类型无效；拒绝跟随链接读取。");
    saved = JSON.parse(readFileSync(path, "utf8")) as unknown;
  }
  const savedRecord = saved as Record<string, unknown>;
  const savedTitle = typeof savedRecord.title === "string" ? savedRecord.title : row.title;
  const normalized = normalizeWorkflowDefinition({ ...savedRecord, title: savedTitle }, row.application_id, resolveWorkflowNodeType);
  const current = database.prepare("SELECT title, created_at, updated_at FROM workflow_definitions WHERE user_id = ? AND application_id = ? AND id = ?").get(row.user_id, row.application_id, row.id) as { title: string; created_at: string; updated_at: string } | undefined;
  if (!current) throw new Error("工作流索引在读取期间已删除。");
  const storedUpdatedAt = typeof savedRecord.updatedAt === "string" && Number.isFinite(Date.parse(savedRecord.updatedAt)) ? savedRecord.updatedAt : current.updated_at;
  if (inline === undefined && (current.title !== normalized.title || current.updated_at !== storedUpdatedAt)) {
    const updated = database.prepare("UPDATE workflow_definitions SET title = ?, updated_at = ? WHERE user_id = ? AND application_id = ? AND id = ? AND updated_at = ?")
      .run(normalized.title, storedUpdatedAt, row.user_id, row.application_id, row.id, current.updated_at);
    if (Number(updated.changes) !== 1) throw new Error("工作流索引在回读期间发生变化；请重试。");
  }
  return { ...normalized, id: row.id, createdAt: current.created_at, updatedAt: storedUpdatedAt };
}

function findDefinitionRow(userId: string, appId: ApplicationId, workflowId: string): WorkflowRow | undefined {
  return database.prepare(`${rowQuery()} WHERE user_id = ? AND application_id = ? AND id = ?`).get(userId, appId, workflowId) as WorkflowRow | undefined;
}

function normalizeForApp(appId: ApplicationId, input: unknown): WorkflowDefinitionShape {
  return normalizeWorkflowDefinition(input, appId, resolveWorkflowNodeType);
}

export function listWorkflows(userId: string, appId: ApplicationId): WorkflowDefinition[] {
  const rows = database.prepare(`${rowQuery()} WHERE user_id = ? AND application_id = ? ORDER BY updated_at DESC, id`).all(userId, appId) as unknown as WorkflowRow[];
  return rows.map(readDefinitionFile);
}

export function getWorkflow(userId: string, appId: ApplicationId, workflowId: string): WorkflowDefinition | null {
  const row = findDefinitionRow(userId, appId, workflowId);
  return row ? readDefinitionFile(row) : null;
}

export function createWorkflow(userId: string, appId: ApplicationId, input: unknown): WorkflowDefinition {
  const count = Number((database.prepare("SELECT COUNT(*) AS count FROM workflow_definitions WHERE user_id = ? AND application_id = ?").get(userId, appId) as { count: number }).count);
  if (count >= MAX_WORKFLOWS_PER_APP) return fail(`每个账户在此 App 最多保存 ${MAX_WORKFLOWS_PER_APP} 个工作流。`);
  const definition = normalizeForApp(appId, input);
  const id = randomUUID();
  const now = new Date().toISOString();
  const stored: WorkflowDefinition = { ...definition, id, createdAt: now, updatedAt: now };
  const path = definitionPath({ id, user_id: userId, application_id: appId });
  atomicWrite(path, stored);
  const readback = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (JSON.stringify(readback) !== JSON.stringify(stored)) throw new Error("工作流文件回读校验失败；索引尚未创建。");
  try {
    database.prepare("INSERT INTO workflow_definitions (id, user_id, application_id, title, definition_json, created_at, updated_at) VALUES (?, ?, ?, ?, '{}', ?, ?)")
      .run(id, userId, appId, definition.title, now, now);
  } catch (error) {
    if (existsSync(path)) unlinkSync(path);
    throw error;
  }
  return getWorkflow(userId, appId, id)!;
}

export function updateWorkflow(userId: string, appId: ApplicationId, workflowId: string, input: unknown): WorkflowDefinition | null {
  const current = getWorkflow(userId, appId, workflowId);
  if (!current) return null;
  const definition = normalizeForApp(appId, input);
  const stored: WorkflowDefinition = { ...definition, id: workflowId, createdAt: current.createdAt, updatedAt: new Date().toISOString() };
  const path = definitionPath({ id: workflowId, user_id: userId, application_id: appId });
  atomicWrite(path, stored);
  const readback = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (JSON.stringify(readback) !== JSON.stringify(stored)) throw new Error("工作流文件回读校验失败；旧索引仍保留。");
  const updated = database.prepare("UPDATE workflow_definitions SET title = ?, definition_json = '{}', updated_at = ? WHERE user_id = ? AND application_id = ? AND id = ? AND updated_at = ?")
    .run(definition.title, stored.updatedAt, userId, appId, workflowId, current.updatedAt);
  if (Number(updated.changes) !== 1) throw new Error("工作流已被其他操作更新，请重新加载后再保存。");
  return getWorkflow(userId, appId, workflowId)!;
}

export async function listWorkflowNodeTypes(appId: ApplicationId, userId: string, userRole: string) {
  return listWorkflowNodes(appId, userId, userRole);
}

export function listWorkflowEngineTypes(appId: ApplicationId) {
  return listWorkflowEngines(appId);
}

function findRunRow(userId: string, appId: ApplicationId, runId: string): WorkflowRunRow | undefined {
  return database.prepare(`SELECT r.id, r.workflow_id, d.application_id, r.status, r.nodes_json, r.current_node_id, r.created_at, r.updated_at
    FROM workflow_runs r JOIN workflow_definitions d ON d.user_id = r.user_id AND d.id = r.workflow_id
    WHERE r.user_id = ? AND d.application_id = ? AND r.id = ?`).get(userId, appId, runId) as WorkflowRunRow | undefined;
}

function parseRun(row: WorkflowRunRow): WorkflowRun {
  return {
    id: row.id, appId: row.application_id, workflowId: row.workflow_id, status: row.status,
    nodes: JSON.parse(row.nodes_json) as WorkflowRunNode[], currentNodeId: row.current_node_id,
    createdAt: row.created_at, updatedAt: row.updated_at
  };
}

export function getWorkflowRun(userId: string, appId: ApplicationId, runId: string): WorkflowRun | null {
  const row = findRunRow(userId, appId, runId);
  return row ? parseRun(row) : null;
}

export function listWorkflowRuns(userId: string, appId: ApplicationId, workflowId: string): WorkflowRun[] {
  if (!getWorkflow(userId, appId, workflowId)) return [];
  const rows = database.prepare(`SELECT r.id, r.workflow_id, d.application_id, r.status, r.nodes_json, r.current_node_id, r.created_at, r.updated_at
    FROM workflow_runs r JOIN workflow_definitions d ON d.user_id = r.user_id AND d.id = r.workflow_id
    WHERE r.user_id = ? AND d.application_id = ? AND r.workflow_id = ? ORDER BY r.created_at DESC, r.id DESC LIMIT 20`)
    .all(userId, appId, workflowId) as unknown as WorkflowRunRow[];
  return rows.map(parseRun);
}

function saveRun(userId: string, runId: string, update: (row: WorkflowRunRow) => Partial<Pick<WorkflowRunRow, "status" | "nodes_json" | "current_node_id">>): void {
  const row = database.prepare(`SELECT r.id, r.workflow_id, d.application_id, r.status, r.nodes_json, r.current_node_id, r.created_at, r.updated_at
    FROM workflow_runs r JOIN workflow_definitions d ON d.user_id = r.user_id AND d.id = r.workflow_id
    WHERE r.user_id = ? AND r.id = ?`).get(userId, runId) as WorkflowRunRow | undefined;
  if (!row) return;
  const next = { ...row, ...update(row) };
  database.prepare("UPDATE workflow_runs SET status = ?, nodes_json = ?, current_node_id = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE user_id = ? AND id = ?")
    .run(next.status, next.nodes_json, next.current_node_id, userId, runId);
}

export function deleteWorkflow(userId: string, appId: ApplicationId, workflowId: string): boolean {
  const active = database.prepare(`SELECT 1 AS found FROM workflow_runs r JOIN workflow_definitions d ON d.user_id = r.user_id AND d.id = r.workflow_id
    WHERE r.user_id = ? AND d.application_id = ? AND r.workflow_id = ? AND r.status IN ('queued', 'running') LIMIT 1`).get(userId, appId, workflowId);
  if (active) return fail("此工作流仍有运行中的任务，请先取消并等待任务结束。");
  const path = definitionPath({ id: workflowId, user_id: userId, application_id: appId });
  const removed = database.prepare("DELETE FROM workflow_definitions WHERE user_id = ? AND application_id = ? AND id = ?").run(userId, appId, workflowId).changes > 0;
  if (removed && existsSync(path)) {
    const file = lstatSync(path);
    if (!file.isFile() || file.isSymbolicLink()) throw new Error("工作流文件类型无效；拒绝删除链接目标。");
    unlinkSync(path);
  }
  return removed;
}

function pruneRuns(userId: string, workflowId: string): void {
  database.prepare(`DELETE FROM workflow_runs WHERE user_id = ? AND workflow_id = ? AND status NOT IN ('queued', 'running') AND id IN (
    SELECT id FROM workflow_runs WHERE user_id = ? AND workflow_id = ? AND status NOT IN ('queued', 'running') ORDER BY created_at DESC, id DESC LIMIT -1 OFFSET ?
  )`).run(userId, workflowId, userId, workflowId, MAX_RUNS_PER_WORKFLOW - 1);
}

function encodeRunNodes(nodes: WorkflowRunNode[]): string {
  let encoded = JSON.stringify(nodes);
  for (const node of nodes) {
    if (encoded.length <= 60_000) break;
    if (!node.output) continue;
    const excess = encoded.length - 60_000;
    const nextLength = Math.max(0, node.output.length - excess - 48);
    node.output = node.output.slice(0, nextLength);
    node.outputTruncated = true;
    encoded = JSON.stringify(nodes);
  }
  if (encoded.length > 65_000) {
    for (const node of nodes) {
      if (encoded.length <= 65_000) break;
      if (node.references && node.references.length > 1) { node.references = node.references.slice(0, 1); encoded = JSON.stringify(nodes); }
      if (encoded.length > 65_000 && node.progress) { delete node.progress; encoded = JSON.stringify(nodes); }
    }
  }
  if (encoded.length > 65_536) return fail("工作流运行快照超过存储上限。");
  return encoded;
}

function setNodeState(userId: string, runId: string, nodeId: string, status: WorkflowNodeStatus, details: { output?: string; references?: Array<{ kind: string; id: string }>; progress?: Record<string, unknown>; error?: string } = {}): void {
  saveRun(userId, runId, (row) => {
    const nodes = JSON.parse(row.nodes_json) as WorkflowRunNode[];
    const now = new Date().toISOString();
    const timing = status === "running" ? { startedAt: now } : status === "succeeded" || status === "failed" || status === "interrupted" ? { completedAt: now } : {};
    const safeReferences = (details.references ?? []).slice(0, 2).map((reference) => ({ kind: reference.kind.slice(0, 80), id: reference.id.slice(0, 240) }));
    const progressJson = details.progress === undefined ? undefined : JSON.stringify(details.progress);
    const progress = progressJson === undefined ? undefined : progressJson.length <= 4_000
      ? JSON.parse(progressJson) as Record<string, unknown>
      : { truncated: true };
    const updated = nodes.map((node) => {
      if (node.nodeId !== nodeId) return node;
      const { progress: previousProgress, ...base } = node;
      const nextProgress = progress ?? (status === "running" ? previousProgress : undefined);
      return {
        ...base, ...timing, status,
        ...(details.output === undefined ? {} : { output: details.output.slice(0, MAX_NODE_OUTPUT_PREVIEW_CHARS), outputTruncated: details.output.length > MAX_NODE_OUTPUT_PREVIEW_CHARS }),
        ...(details.references === undefined ? {} : { references: safeReferences }),
        ...(nextProgress === undefined ? {} : { progress: nextProgress }),
        ...(details.error === undefined ? {} : { error: details.error.slice(0, 700) })
      };
    });
    return { nodes_json: encodeRunNodes(updated), current_node_id: status === "running" ? nodeId : row.current_node_id === nodeId ? null : row.current_node_id };
  });
}

function setRunState(userId: string, runId: string, status: WorkflowStatus, currentNodeId: string | null = null): void {
  saveRun(userId, runId, () => ({ status, current_node_id: currentNodeId }));
}

async function executeWorkflow(userId: string, userRole: string, definition: WorkflowDefinition, runId: string, options: Record<string, unknown>, runtimeServices: unknown, live: LiveWorkflowRun): Promise<void> {
  const engine = getWorkflowEngine(definition.appId, definition.engineId);
  if (!engine) {
    saveRun(userId, runId, (row) => ({
      status: "failed",
      nodes_json: JSON.stringify((JSON.parse(row.nodes_json) as WorkflowRunNode[]).map((node) => ({ ...node, status: "failed" as const, completedAt: new Date().toISOString(), error: "此工作流所需的执行引擎未启用。" })))
    }));
    if (liveRuns.get(runId) === live) liveRuns.delete(runId);
    return;
  }
  const context: WorkflowEngineContext = {
    definition,
    signal: live.controller.signal,
    reportNodeState(nodeId, status, details) {
      live.currentNodeId = status === "running" ? nodeId : live.currentNodeId === nodeId ? null : live.currentNodeId;
      setNodeState(userId, runId, nodeId, status, details);
      setRunState(userId, runId, "running", live.currentNodeId);
    },
    async executeNode(nodeId, inputs) {
      live.controller.signal.throwIfAborted();
      const node = definition.nodes.find((item) => item.id === nodeId);
      if (!node) return fail("执行引擎引用了不存在的节点。");
      if (JSON.stringify(inputs).length > MAX_NODE_INPUT_CHARS) return fail(`节点“${node.title}”的输入超过 ${MAX_NODE_INPUT_CHARS} 个字符。`);
      const nodeContext: WorkflowNodeExecutionContext = {
        userId, userRole, appId: definition.appId, workflowId: definition.id, runId, node, inputs,
        options, signal: live.controller.signal, state: live.state, runtimeServices,
        reportReference(reference) {
          const current = getWorkflowRun(userId, definition.appId, runId)?.nodes.find((item) => item.nodeId === nodeId);
          const references = [...(current?.references ?? []), reference].slice(-8);
          setNodeState(userId, runId, nodeId, "running", { references });
        },
        updateNodeStatus(status, details) { setNodeState(userId, runId, nodeId, status, details); }
      };
      const result = await executeWorkflowNode(nodeContext);
      if (JSON.stringify(result.outputs).length > MAX_NODE_INPUT_CHARS) return fail(`节点“${node.title}”的输出超过 ${MAX_NODE_INPUT_CHARS} 个字符。`);
      return { nodeId, outputs: result.outputs, ...(result.references ? { references: result.references } : {}) };
    }
  };
  try {
    live.controller.signal.throwIfAborted();
    await engine.execute(context);
    live.controller.signal.throwIfAborted();
    const run = getWorkflowRun(userId, definition.appId, runId);
    if (run?.nodes.some((node) => node.status !== "succeeded")) throw new Error("执行引擎结束时仍有未完成节点。");
    setRunState(userId, runId, "succeeded");
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 700) : "工作流执行失败。";
    if (live.currentNodeId) setNodeState(userId, runId, live.currentNodeId, live.controller.signal.aborted ? "interrupted" : "failed", { error: message });
    setRunState(userId, runId, live.controller.signal.aborted ? "interrupted" : "failed");
  } finally {
    if (liveRuns.get(runId) === live) liveRuns.delete(runId);
  }
}

export function startWorkflowRun(
  userId: string,
  userRole: string,
  appId: ApplicationId,
  workflowId: string,
  options: Record<string, unknown> = {},
  runtimeServices?: unknown
): WorkflowRun {
  const definition = getWorkflow(userId, appId, workflowId);
  if (!definition) return fail("找不到当前账户和 App 的工作流。");
  if (!definition.nodes.length) return fail("请先向工作流添加节点，再运行。");
  if (!getWorkflowEngine(appId, definition.engineId)) return fail(`工作流引擎“${definition.engineId}”未启用。`);
  validateWorkflowRun({ userId, userRole, appId, definition, options });
  const activeCount = Number((database.prepare("SELECT COUNT(*) AS count FROM workflow_runs WHERE user_id = ? AND status IN ('queued', 'running')").get(userId) as { count: number }).count);
  if (activeCount >= MAX_ACTIVE_RUNS_PER_USER) return fail(`每个账户最多同时运行 ${MAX_ACTIVE_RUNS_PER_USER} 个工作流。`);
  pruneRuns(userId, workflowId);
  const id = randomUUID();
  const initialNodes = definition.nodes.map((node) => ({ nodeId: node.id, type: node.type, title: node.title, status: "waiting" as const, startedAt: null, completedAt: null }));
  database.prepare("INSERT INTO workflow_runs (id, user_id, workflow_id, status, nodes_json) VALUES (?, ?, ?, 'queued', ?)")
    .run(id, userId, workflowId, JSON.stringify(initialNodes));
  const live: LiveWorkflowRun = { userId, appId, controller: new AbortController(), state: new Map(), currentNodeId: null };
  liveRuns.set(id, live);
  setRunState(userId, id, "running");
  void executeWorkflow(userId, userRole, definition, id, options, runtimeServices, live);
  return getWorkflowRun(userId, appId, id)!;
}

export function cancelWorkflowRun(userId: string, appId: ApplicationId, runId: string): WorkflowRun | null {
  const row = findRunRow(userId, appId, runId);
  if (!row) return null;
  if (row.status === "queued" || row.status === "running") {
    const live = liveRuns.get(runId);
    if (live?.userId === userId && live.appId === appId) live.controller.abort();
    else setRunState(userId, runId, "interrupted");
  }
  return getWorkflowRun(userId, appId, runId);
}

export function closeWorkflowRuns(): void {
  for (const live of liveRuns.values()) live.controller.abort();
}

// 重启后不重放副作用；Agent/领域 Owner 保留其自身真实运行和中断状态。
for (const row of database.prepare("SELECT id, user_id, nodes_json FROM workflow_runs WHERE status IN ('queued', 'running')").all() as Array<{ id: string; user_id: string; nodes_json: string }>) {
  const nodes = (JSON.parse(row.nodes_json) as WorkflowRunNode[]).map((node) => node.status === "running" ? { ...node, status: "interrupted" as const } : node);
  database.prepare("UPDATE workflow_runs SET status = 'interrupted', nodes_json = ?, current_node_id = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE user_id = ? AND id = ?")
    .run(JSON.stringify(nodes), row.user_id, row.id);
}

export { DEFAULT_WORKFLOW_ENGINE_ID, normalizeWorkflowDefinition, resolveWorkflowNodeType };
