/*
 * 功能：验证 Minecraft Daemon 任务租约续期与过期收敛。
 * 作用：确保仍在执行的任务可由节点续租，失联任务标记结果未确认且不会被自动重放。
 * 关联文件：packages/storage/storage-sqlite/src/database.ts、packages/jobs/jobs/src/minecraft-queue.ts。
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import test from "node:test";

const temporaryParent = resolve(tmpdir());
const dataDirectory = mkdtempSync(join(temporaryParent, "lfaa-task-leases-"));
process.env.LFAA_DATA_DIR = dataDirectory;
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "";

const { database, closeDatabase } = await import("lfaa-storage-sqlite/src/database.js");
const {
  claimNextMinecraftTask,
  createMinecraftTask,
  listMinecraftTasks,
  renewMinecraftTaskLeases
} = await import("lfaa-jobs/src/minecraft-queue.js");

const nodeId = randomUUID();
const userId = randomUUID();

database.prepare(`
  INSERT INTO users (id, username, password_salt, password_hash, role)
  VALUES (?, ?, 'test-salt', 'test-hash', 'admin')
`).run(userId, `lease-test-${userId}`);
database.prepare(`
  INSERT INTO daemon_nodes (id, display_name, platform, architecture, daemon_version, status, last_seen_at)
  VALUES (?, '测试节点', 'win32', 'x64', 'test', 'online', ?)
`).run(nodeId, new Date().toISOString());

function createInstance(state) {
  const instanceId = randomUUID();
  database.prepare(`
    INSERT INTO minecraft_instances (id, node_id, created_by, name, release_id, java_major, memory_mb, state, eula_accepted_at)
    VALUES (?, ?, ?, ?, 'test-release', 21, 2048, ?, ?)
  `).run(instanceId, nodeId, userId, `lease-${instanceId}`, state, new Date().toISOString());
  return instanceId;
}

test.after(() => {
  closeDatabase();
  const resolvedDataDirectory = resolve(dataDirectory);
  assert.equal(dirname(resolvedDataDirectory), temporaryParent);
  assert.ok(basename(resolvedDataDirectory).startsWith("lfaa-task-leases-"));
  rmSync(resolvedDataDirectory, { recursive: true, force: true });
});

test("在线节点心跳续租后任务保持运行", () => {
  const task = createMinecraftTask({
    nodeId,
    instanceId: null,
    createdBy: userId,
    kind: "java-install",
    payload: { javaMajor: 21 }
  });
  assert.equal(claimNextMinecraftTask(nodeId)?.id, task.id);

  database.prepare("UPDATE minecraft_tasks SET lease_expires_at = ? WHERE id = ?")
    .run(new Date(Date.now() - 1_000).toISOString(), task.id);
  assert.equal(renewMinecraftTaskLeases(nodeId, [task.id]), 1);

  const renewedExpiry = database.prepare("SELECT lease_expires_at FROM minecraft_tasks WHERE id = ?").get(task.id).lease_expires_at;
  assert.ok(Date.parse(renewedExpiry) > Date.now());
  assert.equal(listMinecraftTasks().find((item) => item.id === task.id)?.status, "running");
});

test("过期任务标记结果未确认并将实例置为未知状态", () => {
  const instanceId = createInstance("starting");
  const task = createMinecraftTask({
    nodeId,
    instanceId,
    createdBy: userId,
    kind: "start",
    payload: {}
  });
  assert.equal(claimNextMinecraftTask(nodeId, true)?.id, task.id);

  database.prepare("UPDATE minecraft_tasks SET lease_expires_at = ? WHERE id = ?")
    .run(new Date(Date.now() - 1_000).toISOString(), task.id);

  const expiredTask = listMinecraftTasks().find((item) => item.id === task.id);
  assert.equal(expiredTask?.status, "failed");
  assert.match(expiredTask?.message ?? "", /结果未确认/u);
  assert.deepEqual(expiredTask?.result, { outcome: "unknown" });
  assert.equal(database.prepare("SELECT state FROM minecraft_instances WHERE id = ?").get(instanceId).state, "unknown");
  assert.equal(claimNextMinecraftTask(nodeId), null);
});
