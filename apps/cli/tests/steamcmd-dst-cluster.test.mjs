/** 验证饥荒集群双分片共用安装、更新门禁以及节点配置文件/启动参数合同。 */
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, lstat, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const root = await mkdtemp(join(tmpdir(), "lfaa-steamcmd-dst-"));
const home = join(root, "home");
const data = join(root, "data");
await mkdir(home, { recursive: true });
await mkdir(data, { recursive: true });
const envNames = ["LFAA_HOME", "LFAA_DATA_DIR", "LFAA_DATA_DIR_CONFIGURED", "LFAA_DATA_DIR_MANAGED_BY_LAUNCHER", "LFAA_DATA_DIR_MANAGED_BY_DESKTOP", "LFAA_HARNESS_HOME", "NODE_ENV", "JWT_SECRET"];
const oldEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
process.env.LFAA_HOME = home;
process.env.LFAA_DATA_DIR = data;
process.env.LFAA_DATA_DIR_CONFIGURED = "1";
delete process.env.LFAA_DATA_DIR_MANAGED_BY_LAUNCHER;
delete process.env.LFAA_DATA_DIR_MANAGED_BY_DESKTOP;
process.env.LFAA_HARNESS_HOME = "";
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "steamcmd-dst-isolated-regression-secret";

const { database, closeDatabase } = await import("lfaa-storage-sqlite/src/database.js");
const { configuration } = await import("lfaa-storage-domain/src/configuration.js");
const { sessionRecords } = await import("lfaa-session-persistence-jsonl/src/repository.js");
const { retireLegacyFileTables } = await import("lfaa-storage-domain/src/migration.js");
retireLegacyFileTables();
const { recordDaemonHeartbeat } = await import("lfaa-host-daemon/src/local-daemon.js");
const { createSteamcmdDstCluster, createSteamcmdServer, createSteamcmdServerTask, createSteamcmdTask, listSteamcmdServers, steamcmdServerIdsForNode, updateSteamcmdServerStatesFromDaemon, claimNextSteamcmdTask, completeSteamcmdTask, saveSteamcmdNodeStorageSettings } = await import("lfaa-games-steamcmd/src/service.js");
const { steamcmdCompletionSchema } = await import("lfaa-api-remotes/src/route-contracts.js");
const { assertSteamcmdDstClusterFiles, buildSteamcmdDstLaunchArguments } = await import("lfaa-host-daemon/src/steamcmd-dst.mjs");

const nodeId = randomUUID();
const userId = randomUUID();
database.prepare("INSERT INTO users(id, uid, username, password_salt, password_hash, role, is_super_admin) VALUES (?, ?, ?, 'test', 'test', 'admin', 1)")
  .run(userId, Math.floor(Math.random() * 1_000_000) + 1, `steamcmd-dst-${userId.slice(0, 8)}`);
recordDaemonHeartbeat({
  id: nodeId, displayName: "隔离饥荒测试节点", platform: "win32", architecture: "x64", version: "test",
  dataRoot: data, capabilities: ["node-filesystem-v1", "node-filesystem-game-storage-v1", "steamcmd-ready-v1"], javaRuntimes: []
});
saveSteamcmdNodeStorageSettings({ nodeId, gameDirectory: "games/steamcmd" });

after(async () => {
  configuration.close();
  sessionRecords.close();
  closeDatabase();
  for (const [name, value] of Object.entries(oldEnv)) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
  assert.equal(resolve(root).startsWith(resolve(tmpdir())), true);
  await rm(root, { recursive: true, force: true });
});

test("DST 集群原子登记 Master/Caves，共用同一 SteamCMD 安装目录", () => {
  const created = createSteamcmdDstCluster({
    nodeId, createdBy: userId, clusterName: "Unit_Cluster", toolAppId: 999999,
    installDirectory: "dst/server", stopCommand: "fixture_stop()", stopTimeoutSeconds: 30, eulaAccepted: true
  });
  assert.equal(created.servers.length, 2);
  assert.deepEqual(created.servers.map(server => server.dstShard), ["Master", "Caves"]);
  assert.ok(created.servers.every(server => server.dstClusterId === created.clusterId));
  assert.ok(created.servers.every(server => server.dstClusterName === "Unit_Cluster"));
  assert.ok(created.servers.every(server => server.installDirectory === "dst/server"));
  assert.ok(created.servers.every(server => server.executablePath === "bin64/dontstarve_dedicated_server_nullrenderer_x64.exe"));
  assert.equal(listSteamcmdServers(nodeId).length, 2);
  assert.throws(() => createSteamcmdServer({
    nodeId, createdBy: userId, name: "same directory", toolAppId: 999999, installDirectory: "DST/SERVER",
    executablePath: "server.exe", launchArguments: [], stopCommand: "quit", stopTimeoutSeconds: 30, eulaAccepted: true
  }), /安装目录已被其他记录使用/u);
  assert.throws(() => createSteamcmdDstCluster({
    nodeId, createdBy: userId, clusterName: "unit_cluster", toolAppId: 999999,
    installDirectory: "dst/second", stopCommand: "fixture_stop()", stopTimeoutSeconds: 30, eulaAccepted: true
  }), /同名饥荒集群/u);
});

test("一次安装任务携带 Master 配置并同时完成两条记录；运行或未知分片阻止共享目录更新", () => {
  const master = listSteamcmdServers(nodeId).find(server => server.dstShard === "Master");
  const caves = listSteamcmdServers(nodeId).find(server => server.dstShard === "Caves");
  assert.ok(master && caves);
  const queued = createSteamcmdServerTask({ serverId: master.id, nodeId, createdBy: userId, kind: "install-server" });
  assert.equal(queued.payload.server?.dstShard, "Master");
  assert.equal(queued.payload.server?.dstClusterName, "Unit_Cluster");
  assert.deepEqual(listSteamcmdServers(nodeId).map(server => server.installationStatus), ["installing", "installing"]);
  const claimed = claimNextSteamcmdTask(nodeId);
  assert.equal(claimed?.id, queued.id);
  assert.equal(completeSteamcmdTask({ taskId: queued.id, nodeId, succeeded: true, message: "fixture install", result: { installed: true } }), true);
  let members = listSteamcmdServers(nodeId);
  assert.ok(members.every(server => server.installationStatus === "installed" && server.status === "stopped"));

  database.prepare("UPDATE steamcmd_servers SET status = 'running', process_id = 12345 WHERE id = ?").run(caves.id);
  assert.throws(() => createSteamcmdServerTask({ serverId: master.id, nodeId, createdBy: userId, kind: "update-server" }), /Master 或 Caves/u);
  database.prepare("UPDATE steamcmd_servers SET status = 'unknown', process_id = NULL WHERE id = ?").run(caves.id);
  assert.throws(() => createSteamcmdServerTask({ serverId: master.id, nodeId, createdBy: userId, kind: "update-server" }), /Master 或 Caves/u);
  database.prepare("UPDATE steamcmd_servers SET status = 'stopped' WHERE id IN (?, ?)").run(master.id, caves.id);
  const update = createSteamcmdServerTask({ serverId: master.id, nodeId, createdBy: userId, kind: "update-server" });
  assert.equal(update.payload.server?.dstClusterId, master.dstClusterId);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM steamcmd_tasks WHERE node_id = ? AND status = 'queued'").get(nodeId).count, 1);
});

test("Daemon 状态按 Master/Caves 服务端 ID 分别更新", () => {
  const members = listSteamcmdServers(nodeId);
  const master = members.find(server => server.dstShard === "Master");
  const caves = members.find(server => server.dstShard === "Caves");
  assert.ok(master && caves);
  database.prepare("UPDATE steamcmd_servers SET status = 'unknown', process_id = NULL WHERE node_id = ? AND dst_cluster_id = ?").run(nodeId, master.dstClusterId);
  assert.deepEqual(steamcmdServerIdsForNode(nodeId).sort(), [master.id, caves.id].sort());
  assert.equal(updateSteamcmdServerStatesFromDaemon(nodeId, [
    { id: master.id, status: "running", processId: 11101 },
    { id: caves.id, status: "stopped", processId: null }
  ]), 2);
  const states = listSteamcmdServers(nodeId);
  assert.equal(states.find(server => server.dstShard === "Master")?.processId, 11101);
  assert.equal(states.find(server => server.dstShard === "Caves")?.status, "stopped");
  assert.equal(updateSteamcmdServerStatesFromDaemon(nodeId, [
    { id: master.id, status: "stopped", processId: null },
    { id: caves.id, status: "stopped", processId: null }
  ]), 1);
});

test("DST 分片启动使用固定参数；配置门禁只检查三个普通文件的元数据", async () => {
  const clusterRoot = join(data, "dst-fixture", "DoNotStarveTogether", "Unit_Cluster");
  await mkdir(join(clusterRoot, "Master"), { recursive: true });
  await mkdir(join(clusterRoot, "Caves"), { recursive: true });
  await writeFile(join(clusterRoot, "cluster.ini"), "[GAMEPLAY]\nmax_players = 6\n");
  await writeFile(join(clusterRoot, "cluster_token.txt"), "secret-fixture-token");
  await writeFile(join(clusterRoot, "Master", "server.ini"), "[NETWORK]\nserver_port = 10999\n");
  const safeMetadata = async path => {
    const info = await lstat(path);
    if (info.isSymbolicLink() || !info.isFile() || info.nlink > 1) throw new Error("unsafe file");
    return info;
  };
  await assert.rejects(assertSteamcmdDstClusterFiles(clusterRoot, "Caves", safeMetadata), /Caves\/server\.ini/u);
  await writeFile(join(clusterRoot, "Caves", "server.ini"), "[NETWORK]\nserver_port = 11000\n");
  assert.equal(await assertSteamcmdDstClusterFiles(clusterRoot, "Master", safeMetadata), true);
  assert.equal(await assertSteamcmdDstClusterFiles(clusterRoot, "Caves", safeMetadata), true);
  assert.deepEqual(buildSteamcmdDstLaunchArguments("C:\\test\\dst-clusters\\cluster", "Unit_Cluster", "Master"), [
    "-persistent_storage_root", "C:\\test\\dst-clusters\\cluster", "-conf_dir", "DoNotStarveTogether", "-cluster", "Unit_Cluster", "-shard", "Master", "-console"
  ]);
  assert.deepEqual(buildSteamcmdDstLaunchArguments("C:\\test\\dst-clusters\\cluster", "Unit_Cluster", "Caves").slice(-3), ["-shard", "Caves", "-console"]);
  assert.throws(() => buildSteamcmdDstLaunchArguments("C:\\test", "../escape", "Master"), /启动参数无效/u);
});

test("完整卸载任务经数据库保存和 Daemon 领取后仍保留 uninstall 类型", () => {
  const uninstallNodeId = randomUUID();
  recordDaemonHeartbeat({
    id: uninstallNodeId, displayName: "隔离 SteamCMD 卸载节点", platform: "win32", architecture: "x64", version: "test",
    dataRoot: data, capabilities: ["node-filesystem-v1"], javaRuntimes: []
  });
  const queued = createSteamcmdTask({ nodeId: uninstallNodeId, createdBy: userId, kind: "uninstall" });
  assert.equal(queued.kind, "uninstall");
  assert.equal(queued.payload.operation, "uninstall");
  const claimed = claimNextSteamcmdTask(uninstallNodeId);
  assert.equal(claimed?.kind, "uninstall");
  assert.equal(claimed?.payload.operation, "uninstall");
  assert.equal(completeSteamcmdTask({ taskId: queued.id, nodeId: uninstallNodeId, succeeded: false, message: "isolated task cleanup", result: { uninstalled: false } }), true);
});

test("SteamCMD 完整卸载 Daemon 回执接受真实移除结果并继续拒绝未登记字段", () => {
  const payload = {
    nodeId,
    succeeded: true,
    message: "SteamCMD 工具目录已完整卸载，游戏目录和服务器文件已保留。",
    result: {
      steamcmdDirectory: "lib/steamcmd",
      gameDirectory: "games",
      removed: true,
      uninstalled: true
    }
  };
  assert.equal(steamcmdCompletionSchema.validate(payload).error, undefined);
  assert.ok(steamcmdCompletionSchema.validate({ ...payload, result: { ...payload.result, arbitrary: true } }).error);
});
