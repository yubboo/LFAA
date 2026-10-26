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
const { validateCoreCoordinate, resolveMinecraftCoreArtifact, getMinecraftCoreCompatibility, listMinecraftCores, minecraftCoreNames } = await import('lfaa-games-minecraft/src/core-sources.js');
const queue = await import('lfaa-jobs/src/minecraft-queue.js');
const { recordDaemonHeartbeat } = await import('lfaa-host-daemon/src/local-daemon.js');
const { createDomainToolTestHost } = await import('./fixtures/domain-tools.mjs');
const domainToolHost = await createDomainToolTestHost(['minecraft']);
test.after(async () => { await domainToolHost.close(); });
const userId = randomUUID(), nodeId = randomUUID();
database.prepare("INSERT INTO users(id,username,password_salt,password_hash,role) VALUES(?,?,'fixture-salt','fixture-hash','admin')").run(userId, `fixture-${userId}`);
recordDaemonHeartbeat({ id: nodeId, displayName: '隔离测试节点', platform: 'win32', architecture: 'x64', version: 'fixture', dataRoot: data, capabilities: ['minecraft-vanilla', 'minecraft-native-v1', 'minecraft-multicore-v1','java-environment-manager-v1'], javaRuntimes: [] });
const originalFetch = globalThis.fetch;
globalThis.fetch = async input => {
  const url = String(input);
  if (url === 'https://fill.papermc.io/v3/projects/paper') return Response.json({versions:{fixture:['fixture-version','1.12.2']}});
  if (url.endsWith('/paper/versions/1.12.2')) return Response.json({version:{id:'1.12.2',java:{version:{minimum:8}}}});
  if (url.endsWith('/paper/versions/1.12.2/builds/1620')) return Response.json({id:1620,channel:'STABLE',downloads:{'server:default':{name:'paper.jar',url:'https://fill-data.papermc.io/v1/objects/fixture/paper.jar',checksums:{sha256:'a'.repeat(64)}}}});
  if (url.endsWith('/paper/versions/fixture-version')) return Response.json({version:{id:'fixture-version',java:{version:{minimum:21}}}});
  if (url.endsWith('/paper/versions/fixture-version/builds')) return Response.json([{id:2,time:'fixture',channel:'STABLE',downloads:{'server:default':{checksums:{sha256:'a'.repeat(64)}}}}]);
  if (url.includes('/paper/versions/fixture-version/builds/')) return Response.json({id:url.endsWith('/fixture-build')?'fixture-build':2,time:'fixture',channel:'STABLE',downloads:{'server:default':{name:'server.jar',url:'https://fill-data.papermc.io/v1/objects/fixture/server.jar',checksums:{sha256:'a'.repeat(64)}}}});
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
test('核心 Owner 明确区分插件、模组、混合、代理和基岩兼容类型', async () => {
  for (const core of minecraftCoreNames) {
    const profile = getMinecraftCoreCompatibility(core);
    assert.ok(profile.serverType, `${core} 有服务端类型`);
    assert.ok(profile.compatibleContent.length, `${core} 有兼容内容说明`);
  }
  const catalog = await listMinecraftCores();
  const paper = catalog.cores.find(core => core.name === 'Paper');
  const spongeNeo = catalog.cores.find(core => core.name === 'SpongeNeo');
  const youer = catalog.cores.find(core => core.name === 'Youer');
  assert.equal(paper?.category, 'pure', '保留来源目录分类，避免改变原行为');
  assert.equal(paper?.serverType, 'plugin');
  assert.match(paper?.compatibleContent.join(' '), /Bukkit\/Spigot\/Paper 插件/u);
  assert.equal(spongeNeo?.serverType, 'hybrid');
  assert.match(spongeNeo?.compatibleContent.join(' '), /SpongeAPI 插件与 NeoForge 模组/u);
  assert.equal(youer?.serverType, 'hybrid');
  const tools = await import('lfaa-tools/src/business-tools.js');
  const list = tools.findAiBusinessTool('workspace', 'admin', 'minecraft_list_cores', null, 'full_access');
  assert.ok(list);
  const selected = await list.execute(list.parse({ core: 'paper' }), {});
  assert.equal(selected.cores[0].serverType, 'plugin', '模型读取到核心能力分类');
});
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
  // 当前测试数据库已含 v36+ 项目表；只对合成 v34 Minecraft 表执行 v35 迁移，
  // 不将 user_version 回退后再把较新表误当作 v34 数据库重新迁移。
  migrateMinecraftCoreSchema(); migrateMinecraftCoreSchema();
  const instance = database.prepare('SELECT * FROM minecraft_instances WHERE id=?').get(id);
  assert.equal(instance.core_type, 'Vanilla'); assert.equal(instance.execution_mode, 'appcontainer');
  assert.equal(database.prepare('PRAGMA user_version').get().user_version, 35);
  assert.equal(database.prepare('SELECT instance_id FROM minecraft_deployments WHERE id=?').get(deploymentId).instance_id,id);
  assert.equal(queue.getMinecraftTask(taskId).status,'succeeded');
  assert.equal(database.prepare('SELECT line FROM minecraft_task_logs WHERE task_id=?').get(taskId).line,'legacy-log');
  assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(), []);
});
test('工件准备连接失败不创建实例或任务，并向模型返回可核验的未开始结果', async () => {
  const fixtureFetch = globalThis.fetch;
  const counts = () => ['minecraft_instances','minecraft_deployments','minecraft_tasks'].map(table=>database.prepare('SELECT count(*) AS count FROM '+table).get().count);
  const before = counts();
  globalThis.fetch = async (input, init) => String(input).endsWith('/builds/preflight-build') ? Promise.reject(new Error('合成网络超时')) : fixtureFetch(input, init);
  try {
    const input = {nodeId,userId,name:'preflight-failure',core:'Paper',version:'fixture-version',build:'preflight-build',eulaAccepted:true};
    await assert.rejects(provisionMinecraftServer(input), error=>error.executionState==='not_started'&&error.errorCode==='minecraft_source_connection_failed');
    const { listAiBusinessTools } = await import('lfaa-tools/src/business-tools.js');
    const tool = listAiBusinessTools('minecraft','admin').find(tool=>tool.id==='minecraft.provision');
    const {userId:unused,...parameters}=input;
    const result = await tool.execute(parameters,{userId,userRole:'admin',applicationId:'minecraft',signal:new AbortController().signal});
    assert.equal(result.executionState,'not_started');assert.equal(result.executed,false);assert.equal(result.retryable,true);
    assert.deepEqual(counts(),before,'元数据错误发生在事务前，没有实例、部署或节点任务');
  } finally { globalThis.fetch = fixtureFetch; }
});
test('用户在工件读取期间停止，迟到的元数据不能创建实例或派发任务', async () => {
  const fixtureFetch = globalThis.fetch, controller = new AbortController();
  const count = () => database.prepare('SELECT count(*) AS count FROM minecraft_tasks').get().count;
  const before = count();
  globalThis.fetch = async (input, init) => {
    if (String(input).endsWith('/builds/cancelled-build')) {
      controller.abort(new DOMException('用户停止','AbortError'));
      const response = await fixtureFetch(String(input).replace('/cancelled-build','/fixture-build'),init);
      return Response.json({...await response.json(),id:'cancelled-build'});
    }
    return fixtureFetch(input,init);
  };
  try {
    await assert.rejects(provisionMinecraftServer({nodeId,userId,name:'cancel-preparation',core:'Paper',version:'fixture-version',build:'cancelled-build',eulaAccepted:true,signal:controller.signal}),error=>error.name==='AbortError');
    assert.equal(count(),before);
    assert.equal(database.prepare("SELECT 1 FROM minecraft_instances WHERE name='cancel-preparation'").get(),undefined);
  } finally { globalThis.fetch = fixtureFetch; }
});
test('指定核心的工具只返回目标版本目录，不将无关核心塞入模型上下文', async () => {
  const { listAiBusinessTools } = await import('lfaa-tools/src/business-tools.js');
  const tool = listAiBusinessTools('minecraft','admin').find(tool=>tool.id==='minecraft.list-cores');
  const catalog = await tool.execute({core:'SpongeNeo'});
  assert.deepEqual(catalog.cores.map(item=>item.name),['SpongeNeo']);
  assert.deepEqual(catalog.cores[0].versions,['fixture-version']);
  await assert.rejects(tool.execute({core:'未登记核心'}),/尚未登记/u);
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
test('省略构建和端口由领域 Owner 选择；已登记端口不重复分配', async () => {
  const input = {nodeId,userId,name:'automatic-defaults',core:'Paper',version:'fixture-version',eulaAccepted:true};
  const first = await provisionMinecraftServer(input);
  assert.equal(first.instance.coreBuild,'2');
  assert.equal(first.task.payload.artifact.source,'papermc');
  assert.equal(first.task.payload.artifact.algorithm,'sha256');
  assert.equal(first.task.payload.artifact.javaMajor,21);
  const second = await provisionMinecraftServer({...input,name:'automatic-defaults-2'});
  assert.equal(second.task.payload.properties.serverPort,first.task.payload.properties.serverPort+1);
  await assert.rejects(provisionMinecraftServer({...input,name:'explicit-port-conflict',serverPort:first.task.payload.properties.serverPort}),/端口/u);
});
test('Paper 旧版本最低字节码为 8 时复用官方推荐 Java 11，不重复安装 Java 8', async () => {
  recordDaemonHeartbeat({ id: nodeId, displayName: '隔离测试节点', platform: 'win32', architecture: 'x64', version: 'fixture', dataRoot: data, capabilities: ['minecraft-multicore-v1'], javaRuntimes: [{runtimeId:'temurin-11',major:11,managed:true,vendor:'Eclipse Temurin'}] });
  const artifact = await resolveMinecraftCoreArtifact('Paper','1.12.2','1620');
  assert.equal(artifact.javaMajor,11);
  const created = await provisionMinecraftServer({nodeId,userId,name:'paper-java11-reuse',core:'Paper',version:'1.12.2',build:'1620',eulaAccepted:true,javaRuntimeId:'temurin-11'});
  assert.equal(created.task.payload.javaMajor,11);
  assert.equal(created.task.payload.javaRuntimeId,'temurin-11');
  assert.equal(created.instance.javaMajor,11);
});

test('模型可读取核心 Java 要求并将指定运行时传入部署；不匹配时不创建任务', async () => {
  recordDaemonHeartbeat({ id: nodeId, displayName: '隔离测试节点', platform: 'win32', architecture: 'x64', version: 'fixture', dataRoot: data, capabilities: ['minecraft-multicore-v1'], javaRuntimes: [{runtimeId:'temurin-11',major:11,managed:true,vendor:'Eclipse Temurin'}] });
  const tools = await import('lfaa-tools/src/business-tools.js');
  const read = tools.findAiBusinessTool('workspace','admin','minecraft_resolve_core_artifact',null,'full_access');
  assert.ok(read, '模型需要真实工件和运行时要求证据，不能凭版本名称猜测');
  const requirement = await read.execute(read.parse({core:'Paper',version:'1.12.2',build:'1620'}),{});
  assert.equal(requirement.javaMajor,11);
  assert.equal(requirement.serverType,'plugin');
  assert.match(requirement.compatibleContent.join(' '),/Bukkit\/Spigot\/Paper 插件/u);
  const provision = tools.findAiBusinessTool('workspace','admin','minecraft_provision_server',null,'full_access');
  assert.equal(provision.schema.properties.javaRuntimeId.type,'string');
  const input = {nodeId,name:'model-selected-java',core:'Paper',version:'1.12.2',build:'1620',eulaAccepted:true,javaRuntimeId:'temurin-11'};
  const context = {userId,userRole:'admin',applicationId:'workspace',signal:new AbortController().signal,onProgress(){}};
  const before = database.prepare('SELECT count(*) AS count FROM minecraft_tasks').get().count;
  const rejected = await provision.execute(provision.parse({...input,javaRuntimeId:'missing-runtime'}),context);
  assert.equal(rejected.executionState,'not_started');
  assert.equal(rejected.errorCode,'minecraft_java_mismatch');
  assert.equal(database.prepare('SELECT count(*) AS count FROM minecraft_tasks').get().count,before);
  // 派发后取消等待，只核查服务创建的真实任务载荷；不把替身节点称为就绪。
  const controller = new AbortController();
  const completion = provision.execute(provision.parse(input),{...context,signal:controller.signal});
  await new Promise(resolve=>setTimeout(resolve,10));
  controller.abort();
  await assert.rejects(completion);
  const task = database.prepare('SELECT payload_json FROM minecraft_tasks ORDER BY rowid DESC LIMIT 1').get();
  assert.equal(JSON.parse(task.payload_json).javaRuntimeId,'temurin-11');
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
