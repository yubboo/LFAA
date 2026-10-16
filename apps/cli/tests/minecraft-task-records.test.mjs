/**
 * 功能：验证 Minecraft 任务详情证据和终态记录清理。
 * 作用：保证异常任务的真实节点日志可查，单项/批量删除事务安全且不影响实例数据。
 * 关联文件：packages/jobs/jobs/src/minecraft-queue.ts、packages/games/minecraft/src/service.ts。
 */
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import test from "node:test";

const dataParent = resolve("dist/.tmp");
mkdirSync(dataParent, { recursive: true });
const dataDirectory = mkdtempSync(join(dataParent, "minecraft-task-records-"));
process.env.LFAA_DATA_DIR = dataDirectory;
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "";

const { database, closeDatabase } = await import("lfaa-storage-sqlite/src/database.js");
const {
  createMinecraftTask,
  deleteMinecraftTaskRecords,
  getMinecraftTaskDetails
} = await import("lfaa-jobs/src/minecraft-queue.js");

const nodeId = randomUUID();
const userId = randomUUID();
database.prepare("INSERT INTO users(id, username, password_salt, password_hash, role) VALUES(?, ?, 'test-salt', 'test-hash', 'admin')")
  .run(userId, `task-records-${userId}`);
database.prepare("INSERT INTO daemon_nodes(id, display_name, platform, architecture, daemon_version, status, last_seen_at) VALUES(?, '隔离任务节点', 'win32', 'x64', 'test', 'online', ?)")
  .run(nodeId, new Date().toISOString());

function createInstance() {
  const instanceId = randomUUID();
  database.prepare("INSERT INTO minecraft_instances(id, node_id, created_by, name, release_id, java_major, memory_mb, state, eula_accepted_at) VALUES(?, ?, ?, ?, 'test-release', 21, 2048, 'stopped', ?)")
    .run(instanceId, nodeId, userId, `task-${instanceId.slice(0, 12)}`, new Date().toISOString());
  return instanceId;
}

function createTerminalTask(instanceId, status, message = `${status} fixture`, result = {}) {
  const task = createMinecraftTask({ nodeId, instanceId, createdBy: userId, kind: "start", payload: { instanceName: "任务隔离夹具" } });
  database.prepare("UPDATE minecraft_tasks SET status = ?, message = ?, result_json = ?, finished_at = ? WHERE id = ?")
    .run(status, message, JSON.stringify(result), new Date().toISOString(), task.id);
  return task.id;
}

function appendLog(instanceId, taskId, stream, line) {
  database.prepare("INSERT INTO minecraft_task_logs(instance_id, task_id, stream, line) VALUES(?, ?, ?, ?)")
    .run(instanceId, taskId, stream, line);
}

test.after(() => {
  closeDatabase();
  const resolvedDataDirectory = resolve(dataDirectory);
  assert.equal(dirname(resolvedDataDirectory), resolve(dataParent));
  assert.ok(basename(resolvedDataDirectory).startsWith("minecraft-task-records-"));
  rmSync(resolvedDataDirectory, { recursive: true, force: true });
});

test("任务详情返回有限且按时间排序的原始节点日志，并指出截断", () => {
  const instanceId = createInstance();
  const taskId = createTerminalTask(instanceId, "failed", "启动失败", { outcome: "failed", error: "端口冲突" });
  appendLog(instanceId, taskId, "system", "准备运行环境");
  appendLog(instanceId, taskId, "stderr", "Address already in use");
  appendLog(instanceId, taskId, "stdout", "后续清理完成");

  const details = getMinecraftTaskDetails(taskId, 2);
  assert.equal(details.task.id, taskId);
  assert.equal(details.task.status, "failed");
  assert.equal(details.task.result.error, "端口冲突");
  assert.deepEqual(details.logs.map((log) => log.line), ["Address already in use", "后续清理完成"]);
  assert.equal(details.logsTruncated, true);
});

test("删除已完成与异常失败记录及其任务日志，但保留实例与部署登记", () => {
  const instanceId = createInstance();
  const deploymentId = randomUUID();
  database.prepare("INSERT INTO minecraft_deployments(id, node_id, created_by, name, server_type, release_id, java_major, state, instance_id) VALUES(?, ?, ?, 'task-record-fixture', 'vanilla', 'test-release', 21, 'registered', ?)")
    .run(deploymentId, nodeId, userId, instanceId);
  const succeededId = createTerminalTask(instanceId, "succeeded", "开服完成", { serverReady: true });
  const abnormalId = createTerminalTask(instanceId, "failed", "租约过期，执行结果未确认", { outcome: "unknown" });
  const retainedId = createTerminalTask(instanceId, "failed", "保留此任务", { outcome: "failed" });
  appendLog(instanceId, succeededId, "stdout", "Server ready");
  appendLog(instanceId, abnormalId, "stderr", "Node connection lost");
  appendLog(instanceId, retainedId, "system", "仍保留的任务日志");

  assert.equal(deleteMinecraftTaskRecords([succeededId, abnormalId]), 2);
  assert.equal(getMinecraftTaskDetails(succeededId), null);
  assert.equal(getMinecraftTaskDetails(abnormalId), null);
  assert.deepEqual(getMinecraftTaskDetails(retainedId).logs.map((log) => log.line), ["仍保留的任务日志"]);
  assert.ok(database.prepare("SELECT id FROM minecraft_instances WHERE id = ?").get(instanceId));
  assert.ok(database.prepare("SELECT id FROM minecraft_deployments WHERE id = ?").get(deploymentId));
});

test("混合批次遇到排队或执行中记录时整批拒绝且不动任何记录", () => {
  const instanceId = createInstance();
  const terminalId = createTerminalTask(instanceId, "failed", "已失败");
  const queuedId = createMinecraftTask({ nodeId, instanceId: null, createdBy: userId, kind: "java-install", payload: { javaMajor: 21 } }).id;
  const runningId = createTerminalTask(null, "failed", "稍后改为执行中");
  database.prepare("UPDATE minecraft_tasks SET status = 'running', finished_at = NULL WHERE id = ?").run(runningId);
  appendLog(instanceId, terminalId, "stderr", "保留的失败依据");

  for (const activeId of [queuedId, runningId]) {
    assert.throws(() => deleteMinecraftTaskRecords([terminalId, activeId]), (error) => error.code === "task_not_terminal");
    assert.ok(getMinecraftTaskDetails(terminalId));
    assert.ok(getMinecraftTaskDetails(activeId));
    assert.deepEqual(getMinecraftTaskDetails(terminalId).logs.map((log) => log.line), ["保留的失败依据"]);
  }
});

test("批量请求中有不存在的任务时整批拒绝", () => {
  const instanceId = createInstance();
  const terminalId = createTerminalTask(instanceId, "succeeded", "完成");
  assert.throws(() => deleteMinecraftTaskRecords([terminalId, randomUUID()]), (error) => error.code === "task_not_found");
  assert.ok(getMinecraftTaskDetails(terminalId));
});
