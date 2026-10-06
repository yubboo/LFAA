/**
 * 功能：回归执行控制的持久化、身份绑定与配置消费。
 * 作用：所有合成账户/节点/任务只存在临时数据目录，验证后关闭数据库并清理。
 * 关联文件：jobs/ai-host-tasks.ts、games/minecraft/service.ts、api/remotes、host/daemon/node-credentials.ts。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, basename, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
const parent = resolve(tmpdir()), data = mkdtempSync(join(parent, "lfaa-execution-control-"));
process.env.LFAA_DATA_DIR = data; process.env.NODE_ENV = "test"; process.env.JWT_SECRET = "";
const { database, closeDatabase } = await import("lfaa-storage-sqlite/src/database.js");
const { EASYTIER_RUNTIME_RELEASE } = await import("lfaa-game-connectivity/src/easytier-release.mjs");
const userId = randomUUID(), precedenceUserId = randomUUID(), nodeId = randomUUID();
database.prepare("INSERT INTO users(id,username,password_salt,password_hash,role) VALUES(?,?,'fixture-salt','fixture-hash','admin')").run(userId, `fixture-${userId}`);
database.prepare("INSERT INTO users(id,username,password_salt,password_hash,role) VALUES(?,?,'fixture-salt','fixture-hash','admin')").run(precedenceUserId, `fixture-${precedenceUserId}`);
const { configuration } = await import("lfaa-storage-domain/src/configuration.js");
configuration.save("user_settings", { user_id: userId, category: "ai-runtime", value_json: JSON.stringify({ speed: "deep", maxOutputTokens: 3456, minecraftDefaultMemoryMb: 3072, minecraftDefaultPort: 25577, minecraftReadyTimeoutSeconds: 64, minecraftExecutionMode: "native" }) });
configuration.save("user_settings", { user_id: precedenceUserId, category: "ai-runtime", value_json: JSON.stringify({ speed: "fast", minecraftDefaultMemoryMb: 8192, minecraftDefaultPort: 25577 }) });
configuration.save("user_settings", { user_id: precedenceUserId, category: "minecraft-runtime", value_json: JSON.stringify({ minecraftDefaultPort: 25678 }) });
const settings = await import("lfaa-settings/src/service.js");
const { retireLegacyFileTables } = await import("lfaa-storage-domain/src/migration.js");
// 文件配置协调器先迁移旧配置，之后才可升级版本 34 的控制面字段。
await import("lfaa-session/src/sessions.js"); retireLegacyFileTables();
const tasks = await import("lfaa-jobs/src/ai-host-tasks.js");
const mcTasks = await import("lfaa-jobs/src/minecraft-queue.js");
const mc = await import("lfaa-games-minecraft/src/service.js");
const identity = await import("lfaa-host-daemon/src/node-credentials.js");
const { recordDaemonHeartbeat } = await import("lfaa-host-daemon/src/local-daemon.js");
const { requireLocalDaemon, aiRuntimeSettingsSchema, minecraftRuntimeSettingsSchema, daemonHeartbeatSchema, aiHostTaskCompletionSchema } = await import("lfaa-api-remotes/src/route-contracts.js");
recordDaemonHeartbeat({ id: nodeId, displayName: "测试隔离节点", platform: "win32", architecture: "x64", version: "test", dataRoot: data, capabilities: ["agent-shell-v1", "project-files-v1", "minecraft-native-v1", "app-sandbox-windows-appcontainer-v1", "minecraft-vanilla", EASYTIER_RUNTIME_RELEASE.installCapability], javaRuntimes: [] });
const newTask = () => tasks.createAiHostTask({ nodeId, createdBy: userId, appId: "workspace", shell: "system", workingDirectory: "", command: "fixture-only", timeoutSeconds: 0 });
const output = { stdout: "运行中", stderr: "", exitCode: null, timedOut: false, outputTruncated: false };
test.after(() => { closeDatabase(); assert.equal(dirname(resolve(data)), parent); assert.ok(basename(data).startsWith("lfaa-execution-control-")); rmSync(data, { recursive: true, force: true }); });

test("升级时原子拆分旧 AI Runtime 中的 Minecraft 值并保留原值", async () => {
  const saved = settings.getUserSettings(userId);
  assert.equal(saved.aiRuntime.speed, "deep");
  assert.equal(saved.aiRuntime.maxOutputTokens, 3456);
  assert.equal("minecraftDefaultMemoryMb" in saved.aiRuntime, false);
  assert.equal(saved.minecraftRuntime.minecraftDefaultMemoryMb, 3072);
  assert.equal(saved.minecraftRuntime.minecraftDefaultPort, 25577);
  assert.equal(saved.minecraftRuntime.minecraftReadyTimeoutSeconds, 64);
  const rows = configuration.all("user_settings", row => row.user_id === userId);
  const aiRowRecord = rows.find(row => row.category === "ai-runtime");
  const minecraftRowRecord = rows.find(row => row.category === "minecraft-runtime");
  assert.ok(aiRowRecord);
  assert.ok(minecraftRowRecord);
  const aiRow = JSON.parse(aiRowRecord.value_json);
  const minecraftRow = JSON.parse(minecraftRowRecord.value_json);
  assert.equal(Object.hasOwn(aiRow, "minecraftDefaultMemoryMb"), false);
  assert.equal(minecraftRow.minecraftDefaultMemoryMb, 3072);
  assert.equal(settings.getUserSettings(precedenceUserId).aiRuntime.speed, "fast");
  assert.equal(settings.getUserSettings(precedenceUserId).minecraftRuntime.minecraftDefaultMemoryMb, 8192);
  assert.equal(settings.getUserSettings(precedenceUserId).minecraftRuntime.minecraftDefaultPort, 25678);
  assert.equal(settings.getUserSettings(userId).minecraftRuntime.minecraftDefaultPort, 25577);
  const repeatedImport = await import(new URL("../../../packages/settings/settings/src/service.ts?migration-repeat=1", import.meta.url).href);
  assert.equal(repeatedImport.getUserSettings(userId).minecraftRuntime.minecraftDefaultMemoryMb, 3072);
  const afterRepeat = configuration.all("user_settings", row => row.user_id === userId);
  assert.deepEqual(JSON.parse(afterRepeat.find(row => row.category === "minecraft-runtime").value_json), minecraftRow);
});

test("排队取消不执行，跨账户取消被拒绝", () => {
  const task = newTask(); assert.equal(tasks.requestAiHostTaskCancellation(task.id, "another-owner"), false); assert.equal(tasks.requestAiHostTaskCancellation(task.id, userId), true);
  assert.equal(tasks.getAiHostTask(task.id).result.cancelled, true); assert.equal(tasks.claimNextAiHostTask(nodeId), null);
});
test("运行取消等待节点确认，输出序列和节点归属不能覆盖", () => {
  const task = newTask(); tasks.claimNextAiHostTask(nodeId);
  assert.equal(tasks.updateAiHostTaskOutput(task.id, nodeId, 2, output), true); assert.equal(tasks.updateAiHostTaskOutput(task.id, nodeId, 1, { ...output, stdout: "旧输出" }), false); assert.equal(tasks.updateAiHostTaskOutput(task.id, randomUUID(), 3, output), false);
  tasks.requestAiHostTaskCancellation(task.id, userId); assert.equal(tasks.getAiHostTask(task.id).status, "running"); assert.deepEqual(tasks.listAiHostCancellationRequests(nodeId), [task.id]);
  assert.equal(tasks.completeAiHostTask({ taskId: task.id, nodeId, succeeded: true, message: "取消夹具", result: { ...output, exitCode: 0, cancelled: true } }), true);
  assert.equal(tasks.getAiHostTask(task.id).status, "failed");
});
test("过期租约不能续回、接收晚到完成或重放副作用", () => {
  const task = newTask(); tasks.claimNextAiHostTask(nodeId); database.prepare("UPDATE ai_host_tasks SET lease_expires_at=? WHERE id=?").run(new Date(Date.now() - 1000).toISOString(), task.id);
  assert.equal(tasks.renewAiHostTaskLeases(nodeId, [task.id]), 0); assert.equal(tasks.completeAiHostTask({ taskId: task.id, nodeId, succeeded: true, message: "晚到", result: { ...output, exitCode: 0 } }), false);
  assert.equal(tasks.getAiHostTask(task.id).status, "failed"); assert.equal(tasks.claimNextAiHostTask(nodeId), null); assert.match(tasks.getAiHostTask(task.id).message, /未知/u);
});
test("远程身份只保存摘要，轮换撤销失效，拒绝 HTTP 和冒领其他节点", () => {
  const issued = identity.issueDaemonCredential("隔离远程测试");
  assert.equal(identity.authenticateDaemonCredential(issued.token).nodeId, issued.nodeId);
  assert.notEqual(database.prepare("SELECT token_hash FROM daemon_credentials WHERE node_id=?").get(issued.nodeId).token_hash, issued.token);
  const authenticate = (id, secure) => { let result; requireLocalDaemon({ header: () => `Bearer ${issued.token}`, body: { nodeId: id }, secure }, { status: code => ({ json: () => { result = code; } }) }, () => { result = 200; }); return result; };
  assert.equal(authenticate(issued.nodeId, true), 200); assert.equal(authenticate(nodeId, true), 401); assert.equal(authenticate(issued.nodeId, false), 403);
  const rotated = identity.issueDaemonCredential(issued.displayName, issued.nodeId); assert.equal(identity.authenticateDaemonCredential(issued.token), null); assert.ok(identity.authenticateDaemonCredential(rotated.token)); identity.revokeDaemonCredential(issued.nodeId); assert.equal(identity.authenticateDaemonCredential(rotated.token), null);
});
test("远程密钥经受保护文件一次导出，撤销文件不可导出", () => {
  const issued = identity.issueDaemonCredential("连接文件测试", undefined, "https://fixture.example");
  const file = join(data, "fixture-export.json"), source = join(data, "credentials", "node-connections", `${issued.nodeId}.json`);
  identity.exportDaemonConnection(issued.nodeId, file); assert.equal(JSON.parse(readFileSync(file, "utf8")).token, issued.token); assert.equal(existsSync(source), false);
  const revoked = identity.issueDaemonCredential("撤销文件测试", undefined, "https://fixture.example"); identity.revokeDaemonCredential(revoked.nodeId); assert.throws(() => identity.exportDaemonConnection(revoked.nodeId, join(data, "revoked-export.json")), /撤销/u);
});
test("节点真实能力合同接受已接入能力，拒绝虚构能力", () => {
  const value = { id: nodeId, displayName: "测试节点", platform: "win32", architecture: "x64", version: "test", dataRoot: data, capabilities: ["minecraft-vanilla", "minecraft-native-v1", "minecraft-multicore-v1", "app-sandbox-windows-appcontainer-v1", "java-environment-manager-v1", "minecraft-java-runtime-selection-v1", "node-filesystem-v1", "steamcmd-ready-v1", "agent-shell-v1", "project-files-v1", EASYTIER_RUNTIME_RELEASE.installCapability, EASYTIER_RUNTIME_RELEASE.runtimeCapability], javaRuntimes: [], instances: [] };
  assert.equal(daemonHeartbeatSchema.validate(value).error, undefined);
  assert.ok(daemonHeartbeatSchema.validate({ ...value, capabilities: ["fictional-desktop-driver"] }).error);
});
test("真实命令允许空 stdout/stderr，未知退出码仍按实际结果接收", () => {
  assert.equal(aiHostTaskCompletionSchema.validate({ nodeId, succeeded: false, message: "运行中夹具", result: { ...output, stdout: "" } }).error, undefined);
});
test("账户时限保存后进入真实任务，备份/启动互斥且心跳不回退过渡状态", () => {
  assert.ok(minecraftRuntimeSettingsSchema.validate({ ...settings.defaultSettings.minecraftRuntime, minecraftReadyTimeoutSeconds: 0 }).error);
  assert.equal(aiRuntimeSettingsSchema.validate({ ...settings.defaultSettings.aiRuntime, minecraftReadyTimeoutSeconds: 42 }).error, undefined, "过渡期仅接受旧客户端的已知字段");
  // 旧客户端把 Minecraft 字段随 ai-runtime 提交时，保存层仍会拆入新分类。
  settings.saveUserSettings(userId, "ai-runtime", { ...settings.defaultSettings.aiRuntime, commandTimeoutSeconds: 60, minecraftReadyTimeoutSeconds: 42, minecraftStopTimeoutSeconds: 19 });
  assert.equal(settings.getUserSettings(userId).aiRuntime.commandTimeoutSeconds, 60);
  assert.equal("minecraftReadyTimeoutSeconds" in settings.getUserSettings(userId).aiRuntime, false);
  assert.equal(settings.getUserSettings(userId).minecraftRuntime.minecraftReadyTimeoutSeconds, 42);
  assert.equal(settings.getUserSettings(userId).minecraftRuntime.minecraftStopTimeoutSeconds, 19);
  const id = randomUUID(); database.prepare("INSERT INTO minecraft_instances(id,node_id,created_by,name,release_id,java_major,memory_mb,state,eula_accepted_at) VALUES(?,?,?,?, 'fixture-release',21,2048,'stopped',?)").run(id, nodeId, userId, `fixture-${id}`, new Date().toISOString());
  const backup = mc.backupMinecraftWorld(id, userId); assert.throws(() => mc.startMinecraftInstance(id, userId), /未完成/u); mcTasks.claimNextMinecraftTask(nodeId, true); mcTasks.completeMinecraftTask(backup.id, nodeId, true, "测试备份夹具", {});
  const start = mc.startMinecraftInstance(id, userId); assert.equal(start.payload.readyTimeoutSeconds, 42); assert.equal(start.payload.stopTimeoutSeconds, 19);
  mc.updateInstanceStatesFromDaemon(nodeId, [{ id, state: "stopped", sandboxStatus: "prepared" }]); assert.equal(mc.getMinecraftInstance(id).state, "starting");
  mcTasks.claimNextMinecraftTask(nodeId, true); mcTasks.completeMinecraftTask(start.id, nodeId, false, "夹具尚未就绪", {}); assert.equal(mc.getMinecraftInstance(id).state, "unknown");
});
test("模型读取配置时限、三种模式都可选择工具，取消工具仍校验归属", async () => {
  const { findAiBusinessTool } = await import("lfaa-tools/src/business-tools.js");
  for (const mode of ["ask", "approve_remembered", "full_access"]) {
    const tool = findAiBusinessTool("workspace", "member", "host_execute_command", null, mode); assert.ok(tool);
    assert.equal(tool.prepare({ nodeId, command: "fixture-only", timeoutSeconds: 1800 }, { userId }).timeoutSeconds, 60);
    assert.equal(tool.prepare({ nodeId, command: "fixture-only" }, { userId }).timeoutSeconds, 60);
    assert.equal(tool.prepare({ nodeId, command: "fixture-only", timeoutSeconds: 10 }, { userId }).timeoutSeconds, 10);
  }
  const task = newTask(), tool = findAiBusinessTool("workspace", "member", "host_cancel_task");
  const context = { userId, userRole: "member", applicationId: "workspace", signal: new AbortController().signal, onProgress: () => {} };
  await assert.rejects(tool.execute({ taskId: task.id }, { ...context, userId: "different-user" }), /找不到/u);
  await assert.rejects(tool.execute({ taskId: task.id }, { ...context, applicationId: "minecraft" }), /找不到/u);
  assert.equal((await tool.execute({ taskId: task.id }, context)).task.result.cancelled, true);
});
test("任务摘要不读取或解析大段输出，正文单独读取并保持账户隔离", () => {
  const task = newTask();
  const result = JSON.stringify({ ...output, stdout: "隔离长输出".repeat(100000) });
  database.prepare("UPDATE ai_host_tasks SET result_json=? WHERE id=?").run(result, task.id);
  const parse = JSON.parse;
  JSON.parse = function(value, ...args) { assert.notEqual(value, result, "摘要不得解析正文"); return parse(value, ...args); };
  try {
    const summaries = tasks.listUserAiHostTasks(userId);
    assert.ok(summaries.some(summary => summary.id === task.id));
    assert.ok(summaries.every(summary => !("result" in summary) && !("command" in summary)));
    assert.deepEqual(tasks.listUserAiHostTasks(randomUUID()), []);
  } finally { JSON.parse = parse; }
  assert.equal(tasks.getAiHostTask(task.id).result.stdout, parse(result).stdout);
});

test("版本 33 升级保留既有任务/日志与外键，迁移可重复调用", async () => {
  const { migrateExecutionControlSchema } = await import("lfaa-storage-sqlite/src/database.js");
  const existing = database.prepare("SELECT id,instance_id FROM minecraft_tasks WHERE instance_id IS NOT NULL LIMIT 1").get();
  database.prepare("INSERT INTO minecraft_task_logs(instance_id,task_id,stream,line) VALUES(?,?,'stdout','旧日志迁移夹具')").run(existing.instance_id, existing.id);
  const oldTasks = database.prepare("SELECT * FROM minecraft_tasks ORDER BY id").all();
  const schema = database.prepare("SELECT sql FROM sqlite_master WHERE name='minecraft_tasks'").get().sql;
  const indexes = database.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='minecraft_tasks' AND sql IS NOT NULL").all();
  // 仅在本文件的临时数据库重建旧合同，用真实迁移验证数据完整性。
  database.exec("PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE;");
  try {
    database.exec(schema.replace(/^CREATE TABLE\s+"?minecraft_tasks"?/u, "CREATE TABLE minecraft_tasks_old_fixture").replace(", 'restart', 'console'", ""));
    database.exec("INSERT INTO minecraft_tasks_old_fixture SELECT * FROM minecraft_tasks; DROP TABLE minecraft_tasks; ALTER TABLE minecraft_tasks_old_fixture RENAME TO minecraft_tasks;");
    for (const index of indexes) database.exec(index.sql);
    database.exec("DROP TABLE daemon_credentials; ALTER TABLE ai_host_tasks DROP COLUMN cancel_requested; ALTER TABLE ai_host_tasks DROP COLUMN output_sequence; PRAGMA user_version=33; COMMIT;");
  } catch (error) { database.exec("ROLLBACK;"); throw error; } finally { database.exec("PRAGMA foreign_keys=ON;"); }
  migrateExecutionControlSchema(); migrateExecutionControlSchema();
  assert.equal(database.prepare("PRAGMA user_version").get().user_version, 34);
  assert.deepEqual(database.prepare("SELECT * FROM minecraft_tasks ORDER BY id").all(), oldTasks);
  assert.equal(database.prepare("SELECT line FROM minecraft_task_logs WHERE task_id=?").get(existing.id).line, "旧日志迁移夹具");
  assert.deepEqual(database.prepare("PRAGMA foreign_key_check").all(), []);
  assert.ok(database.prepare("SELECT sql FROM sqlite_master WHERE name='minecraft_tasks'").get().sql.includes("'console'"));
});
