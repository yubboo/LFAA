/**
 * 功能：Minecraft 实时指标认证只读接口回归。
 * 作用：验证成员可读、未登录拒绝、响应禁用缓存，且查询不触发实例生命周期操作。
 * 关联文件：minecraft-controller、games/minecraft Service、Daemon heartbeat。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

test("Minecraft 实时指标接口要求登录、禁用缓存并只读返回真实 Owner 快照", { timeout: 30_000 }, async () => {
  const temporaryParent = resolve(dirname(fileURLToPath(import.meta.url)), "../../../dist/.tmp");
  mkdirSync(temporaryParent, { recursive: true });
  const data = mkdtempSync(join(temporaryParent, "lfaa-minecraft-telemetry-api-"));
  process.env.LFAA_DATA_DIR = data;
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "";
  process.env.LFAA_HARNESS_HOME = "";
  process.env.LFAA_LOCAL_MODE = "true";
  process.env.SERVER_HOST = "127.0.0.1";
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  process.env.SERVER_PORT = String(reservation.address().port);
  await new Promise(resolveClose => reservation.close(resolveClose));

  const { boot } = await import("lfaa-app-boot/src/index.js");
  const { database } = await import("lfaa-storage-sqlite/src/database.js");
  const { recordDaemonHeartbeat } = await import("lfaa-host-daemon/src/local-daemon.js");
  const minecraft = await import("lfaa-games-minecraft/src/service.js");
  const context = await boot(["--profile", "web"]);
  const base = `http://127.0.0.1:${process.env.SERVER_PORT}/api`;
  const nodeId = randomUUID();
  const instanceId = randomUUID();
  try {
    const login = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "123456" })
    });
    assert.equal(login.status, 200);
    const headers = { Cookie: login.headers.get("set-cookie").split(";")[0] };
    const userId = database.prepare("SELECT id FROM users WHERE username='admin'").get().id;
    recordDaemonHeartbeat({ id: nodeId, displayName: "指标接口夹具节点", platform: "win32", architecture: "x64", version: "fixture", dataRoot: "C:\\LFAA-telemetry-fixture", capabilities: ["minecraft-native-v1"], javaRuntimes: [] });
    database.prepare("INSERT INTO minecraft_instances(id,node_id,created_by,name,release_id,java_major,memory_mb,core_type,core_build,execution_mode,state,eula_accepted_at) VALUES(?,?,?,?,'1.20.4',21,2048,'Paper','fixture-build','native','stopped',?)")
      .run(instanceId, nodeId, userId, `telemetry-${instanceId}`, new Date().toISOString());
    const telemetry = {
      onlinePlayers: 2, maxPlayers: 20, pingMs: 4, advertisedVersion: "Paper 1.20.4",
      observedAt: new Date().toISOString(), processStartedAt: new Date(Date.now() - 120_000).toISOString(),
      tps: null, tpsObservedAt: null, tpsStatus: "pending"
    };
    minecraft.updateInstanceStatesFromDaemon(nodeId, [{ id: instanceId, state: "running", sandboxStatus: "prepared", telemetry }]);

    const anonymous = await fetch(`${base}/minecraft/instances/${instanceId}/telemetry`);
    assert.equal(anonymous.status, 401);
    const response = await fetch(`${base}/minecraft/instances/${instanceId}/telemetry`, { headers });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual((await response.json()).telemetry, {
      ...telemetry,
      availability: "available",
      reason: null
    });
    assert.equal(minecraft.getMinecraftInstance(instanceId).state, "running", "只读请求不得改变实例状态");
  } finally {
    await context.fiber.dispose();
    if (dirname(data) !== temporaryParent) throw new Error("拒绝清理测试根以外的路径。");
    rmSync(data, { recursive: true, force: true });
  }
});
