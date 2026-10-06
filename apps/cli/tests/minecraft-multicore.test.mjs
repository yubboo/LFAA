/**
 * 功能：自动开服领域与迁移的长期回归。
 * 作用：只在临时目录生成合成账户、节点和来源响应，验证配置快照、原子提交与就绪证据。
 * 关联文件：games/minecraft/deployment-service.ts、core-sources.ts、storage-domain/migration.ts、jobs/minecraft-queue.ts。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, basename, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
const parent = resolve(tmpdir()), data = mkdtempSync(join(parent, 'lfaa-multicore-'));
process.env.LFAA_DATA_DIR = data; process.env.NODE_ENV = 'test'; process.env.JWT_SECRET = '';
const { database, closeDatabase, migrateMinecraftCoreSchema } = await import('lfaa-storage-sqlite/src/database.js');
const settings = await import('lfaa-settings/src/service.js');
await import('lfaa-session/src/sessions.js');
const { retireLegacyFileTables } = await import('lfaa-storage-domain/src/migration.js');
retireLegacyFileTables();
const { provisionMinecraftServer, retryMinecraftProvision } = await import('lfaa-games-minecraft/src/deployment-service.js');
const { validateCoreCoordinate, resolveMinecraftCoreArtifact } = await import('lfaa-games-minecraft/src/core-sources.js');
const queue = await import('lfaa-jobs/src/minecraft-queue.js');
const { recordDaemonHeartbeat } = await import('lfaa-host-daemon/src/local-daemon.js');
const userId = randomUUID(), nodeId = randomUUID();
database.prepare("INSERT INTO users(id,username,password_salt,password_hash,role) VALUES(?,?,'fixture-salt','fixture-hash','admin')").run(userId, `fixture-${userId}`);
recordDaemonHeartbeat({ id: nodeId, displayName: '隔离测试节点', platform: 'win32', architecture: 'x64', version: 'fixture', dataRoot: data, capabilities: ['minecraft-vanilla', 'minecraft-native-v1', 'minecraft-multicore-v1'], javaRuntimes: [] });
const originalFetch = globalThis.fetch;
globalThis.fetch = async input => {
  const url = String(input);
  if (url.endsWith('/api/v3')) return Response.json({ success: true, data: [{ name: 'Paper', tag: 'pure', homepage: 'https://papermc.io', mc_versions: ['fixture-version'] }, { name: 'SpongeNeo', tag: 'mod', homepage: 'https://spongepowered.org', mc_versions: ['fixture-version'] }] });
  if (url.includes('mohistmc.cn/download/youer')) return new Response('"projectName":"youer","availableVersions":["fixture-version"]');
  if (url.includes('version_manifest')) return Response.json({ versions: [{ id: 'fixture-version', url: 'https://piston-meta.mojang.com/fixture/detail' }] });
  if (url.endsWith('/fixture/detail')) return Response.json({ javaVersion: { majorVersion: 21 } });
  if (url.endsWith('/Paper/fixture-version/fixture-build')) return Response.json({ success: true, data: { name: 'Paper', mc_version: 'fixture-version', core_version: 'fixture-build', sha1: 'a'.repeat(40), filename: '../untrusted.jar', download_url: 'https://download.fastmirror.net/download/Paper/fixture-version/fixture-build' } });
  if (url.includes('/SpongeNeo/fixture-version/')) return Response.json({ success: true, data: { name: 'SpongeNeo', mc_version: 'fixture-version', core_version: url.split('/').pop(), sha1: 'b'.repeat(40), filename: 'sponge.jar', download_url: 'https://download.fastmirror.net/download/SpongeNeo/fixture-version/fixture' } });
  if (url.startsWith('https://maven.neoforged.net/releases/') && url.endsWith('.sha1')) return new Response('c'.repeat(40));
  throw new Error(`未登记测试来源 ${url}`);
};
test.after(() => { globalThis.fetch = originalFetch; closeDatabase(); assert.equal(dirname(resolve(data)), parent); assert.ok(basename(data).startsWith('lfaa-multicore-')); rmSync(data, { recursive: true, force: true }); });
test('迁移保持旧 Vanilla 记录并可重复执行', () => {
  const id = randomUUID(), deploymentId = randomUUID(), taskId = randomUUID();
  database.prepare("INSERT INTO minecraft_instances(id,node_id,created_by,name,release_id,java_major,memory_mb,state,eula_accepted_at) VALUES(?,?,?,'legacy-fixture','fixture',21,2048,'stopped',?)").run(id, nodeId, userId, new Date().toISOString());
  database.prepare("INSERT INTO minecraft_deployments(id,node_id,created_by,name,server_type,release_id,java_major,state,instance_id) VALUES(?,?,?,'legacy-deployment','vanilla','fixture',21,'registered',?)").run(deploymentId,nodeId,userId,id);
  database.prepare("INSERT INTO minecraft_tasks(id,node_id,instance_id,deployment_id,created_by,kind,status,message,payload_json) VALUES(?,?,?,?,?,'start','succeeded','legacy-task','{}')").run(taskId,nodeId,id,deploymentId,userId);
  queue.appendMinecraftTaskLogs(id,taskId,'system',['legacy-log']);
  // 在独立测试数据库还原真实 v34 的列/约束，然后执行正式 v35 升级。
  database.exec("PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE;");
  for (const column of ['core_build','artifact_json','automatic']) database.exec(`ALTER TABLE minecraft_deployments DROP COLUMN ${column}`);
  for (const column of ['core_type','core_build','execution_mode']) database.exec(`ALTER TABLE minecraft_instances DROP COLUMN ${column}`);
  const indexes = database.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='minecraft_deployments' AND sql IS NOT NULL").all();
  const schema = database.prepare("SELECT sql FROM sqlite_master WHERE name='minecraft_deployments'").get().sql.replace(/^CREATE TABLE\s+"?minecraft_deployments"?/u,'CREATE TABLE minecraft_deployments_fixture_v34').replace('CHECK (length(server_type) BETWEEN 1 AND 32)', "CHECK (server_type IN ('vanilla'))");
  database.exec(schema);
  database.exec("INSERT INTO minecraft_deployments_fixture_v34 SELECT * FROM minecraft_deployments; DROP TABLE minecraft_deployments; ALTER TABLE minecraft_deployments_fixture_v34 RENAME TO minecraft_deployments;");
  for (const index of indexes) database.exec(index.sql);
  database.exec("PRAGMA user_version=34; COMMIT; PRAGMA foreign_keys=ON;");
  migrateMinecraftCoreSchema(); migrateMinecraftCoreSchema(); retireLegacyFileTables();
  const instance = database.prepare('SELECT * FROM minecraft_instances WHERE id=?').get(id);
  assert.equal(instance.core_type, 'Vanilla'); assert.equal(instance.execution_mode, 'appcontainer');
  assert.equal(database.prepare('PRAGMA user_version').get().user_version, 35);
  assert.equal(database.prepare('SELECT instance_id FROM minecraft_deployments WHERE id=?').get(deploymentId).instance_id,id);
  assert.equal(queue.getMinecraftTask(taskId).status,'succeeded');
  assert.equal(database.prepare('SELECT line FROM minecraft_task_logs WHERE task_id=?').get(taskId).line,'legacy-log');
  assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(), []);
});
test('配置持久化并进入任务；重名冲突不产生额外实例', async () => {
  settings.saveUserSettings(userId, 'minecraft-runtime', { ...settings.defaultSettings.minecraftRuntime, minecraftDefaultMemoryMb: 3072, minecraftDefaultPort: 25577, minecraftReadyTimeoutSeconds: 64, minecraftDownloadTimeoutSeconds: 77, minecraftInstallTimeoutSeconds: 88 });
  const input = { nodeId, userId, name: '自动测试实例', core: 'Paper', version: 'fixture-version', build: 'fixture-build', eulaAccepted: true };
  const created = await provisionMinecraftServer(input);
  assert.equal(created.instance.memoryMb, 3072); assert.equal(created.instance.coreType, 'Paper');
  assert.equal(created.task.payload.properties.serverPort, 25577); assert.equal(created.task.payload.downloadTimeoutSeconds, 77); assert.equal(created.task.payload.installTimeoutSeconds, 88); assert.equal(created.task.payload.readyTimeoutSeconds, 64);
  const count = database.prepare('SELECT count(*) AS count FROM minecraft_instances').get().count;
  await assert.rejects(provisionMinecraftServer(input), /已存在/u);
  assert.equal(database.prepare('SELECT count(*) AS count FROM minecraft_instances').get().count, count);
  assert.equal(queue.claimNextMinecraftTask(nodeId, true).id, created.task.id);
  queue.completeMinecraftTask(created.task.id, nodeId, true, '缺少就绪证据夹具', {});
  assert.equal(queue.getMinecraftTask(created.task.id).status, 'failed');
  assert.equal(database.prepare('SELECT state FROM minecraft_deployments WHERE id=?').get(created.deployment.id).state, 'failed');
  const { minecraftCompletionSchema } = await import('lfaa-api-remotes/src/route-contracts.js');
  assert.equal(minecraftCompletionSchema.validate({ nodeId, succeeded: true, message: '就绪证据夹具', result: { coreType: 'Paper', coreBuild: 'fixture', executionMode: 'native', processStarted: true, serverReady: true, locallyListening: true, externallyReachable: null, serverPort: 25577, properties: { serverPort: 25577 }, javaMajor: 21, evidence: '核心真实日志' } }).error, undefined);
  assert.equal(minecraftCompletionSchema.validate({ nodeId, succeeded: true, message: '停服证据夹具', result: { stopped: true, forced: false, exitCode: 0, worldSaveConfirmed: null } }).error, undefined);
  assert.ok(minecraftCompletionSchema.validate({ nodeId, succeeded: true, message: '假证据', result: { fictionalResult: true } }).error);
  const retry = await retryMinecraftProvision(created.deployment.id,userId);
  assert.equal(retry.instanceId,created.instance.id); assert.equal(retry.payload.resume,true);
  assert.equal(queue.claimNextMinecraftTask(nodeId,true).id,retry.id);
  queue.completeMinecraftTask(retry.id,nodeId,false,'执行结果未知夹具',{outcome:'unknown'});
  await assert.rejects(retryMinecraftProvision(created.deployment.id,userId),/未确认/u);
  const { installMinecraftJava } = await import('lfaa-games-minecraft/src/service.js');
  assert.equal(installMinecraftJava(nodeId, userId, 25).payload.downloadTimeoutSeconds, 77);
});
test('EULA、执行边界和路径坐标拒绝无效输入', async () => {
  const input = { nodeId, userId, name: 'fixture-two', core: 'Paper', version: 'fixture-version', build: 'fixture-build', eulaAccepted: false };
  await assert.rejects(provisionMinecraftServer(input), /EULA/u);
  for (const value of ['../x', 'a/b', 'a\\b', '.', 'build\nstop']) assert.throws(() => validateCoreCoordinate(value));
  settings.saveUserSettings(userId, 'minecraft-runtime', { ...settings.getUserSettings(userId).minecraftRuntime, minecraftExecutionMode: 'appcontainer' });
  await assert.rejects(provisionMinecraftServer({ ...input, eulaAccepted: true }), /不会静默降级/u);
});

test('SpongeNeo 正式版和 RC 构建都解析同一官方加载器坐标', async () => {
  for (const build of ['21.8.31-16.0.0','21.8.31-16.0.1-RC2506']) {
    const artifact = await resolveMinecraftCoreArtifact('SpongeNeo','fixture-version',build);
    assert.equal(artifact.loaderArtifact.url,'https://maven.neoforged.net/releases/net/neoforged/neoforge/21.8.31/neoforge-21.8.31-installer.jar');
    assert.equal(artifact.loaderArtifact.digest,'c'.repeat(40));
  }
});
