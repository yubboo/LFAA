/*
 * 功能：验证 Minecraft Socket.IO 的会话认证、事件范围和会话撤销。
 * 作用：在隔离临时数据目录中确认只有有效 HttpOnly Cookie 会话可接收最小变更通知。
 * 关联文件：packages/api/remotes/src/socket-server.ts、packages/credentials/authorization/src/middleware.ts。
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import test from "node:test";
import express from "express";
import jwt from "jsonwebtoken";
import { io } from "socket.io-client";

const temporaryParent = resolve(tmpdir());
const dataDirectory = mkdtempSync(join(temporaryParent, "lfaa-realtime-socket-"));
process.env.LFAA_DATA_DIR = dataDirectory;
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "realtime-test-secret-0123456789abcdef-0123456789";

const { config } = await import("lfaa-launch-environment/src/config.js");
const { database, closeDatabase } = await import("lfaa-storage-sqlite/src/database.js");
const { createSession, revokeSession } = await import("lfaa-identity-auth/src/service.js");
const { recordDaemonHeartbeat } = await import("lfaa-host-daemon/src/local-daemon.js");
const { createRealtimeSocketServer } = await import("lfaa-api-remotes/src/socket-server.js");
const { createApiRouter } = await import("lfaa-test-support-api/src/router.js");

const app = express();
app.use(express.json());
const server = createServer(app);
const realtime = createRealtimeSocketServer(server);
app.use("/api", createApiRouter({}, realtime));
await new Promise((resolveListen, rejectListen) => {
  server.once("error", rejectListen);
  server.listen(0, "127.0.0.1", resolveListen);
});
const address = server.address();
assert.ok(address && typeof address !== "string");
const baseUrl = `http://127.0.0.1:${address.port}`;

const userId = randomUUID();
database.prepare(`
  INSERT INTO users (id, username, password_salt, password_hash, role)
  VALUES (?, ?, 'test-salt', 'test-hash', 'admin')
`).run(userId, `realtime-test-${userId}`);
const session = createSession(userId);
const nodeId = randomUUID();
recordDaemonHeartbeat({
  id: nodeId,
  displayName: "Socket.IO 测试节点",
  platform: "win32",
  architecture: "x64",
  version: "test",
  dataRoot: dataDirectory,
  capabilities: ["minecraft-vanilla", "app-sandbox-windows-appcontainer-v1"],
  javaRuntimes: []
});
const token = jwt.sign({ sid: session.sessionId }, config.jwtSecret, {
  algorithm: "HS256",
  audience: "lfaa-web",
  issuer: "lfaa-server",
  expiresIn: "1h"
});

function openSocket(cookie) {
  const socket = io(baseUrl, {
    path: "/socket.io",
    transports: ["websocket"],
    reconnection: false,
    timeout: 2000,
    ...(cookie ? { extraHeaders: { cookie } } : {})
  });
  return new Promise((resolveConnect, rejectConnect) => {
    socket.once("connect", () => resolveConnect(socket));
    socket.once("connect_error", (error) => {
      socket.disconnect();
      rejectConnect(error);
    });
  });
}

test.after(async () => {
  await new Promise((resolveClose) => realtime.close(resolveClose));
  closeDatabase();
  const resolvedDataDirectory = resolve(dataDirectory);
  assert.equal(dirname(resolvedDataDirectory), temporaryParent);
  assert.ok(basename(resolvedDataDirectory).startsWith("lfaa-realtime-socket-"));
  rmSync(resolvedDataDirectory, { recursive: true, force: true });
});

test("没有 Cookie 或 Cookie 无效时拒绝 Socket 握手", async () => {
  await assert.rejects(openSocket(undefined), /登录会话无效/u);
  await assert.rejects(openSocket("lfaa_session=invalid-token"), /登录会话无效/u);
});

test("有效活动会话只接收最小 Minecraft 变更通知，撤销后立即断开", async () => {
  const socket = await openSocket(`lfaa_session=${token}`);
  const receivedChange = new Promise((resolveChange) => socket.once("minecraft:changed", resolveChange));
  realtime.publishMinecraftChange(["logs"], "instance-123");
  assert.deepEqual(await receivedChange, { scopes: ["logs"], instanceId: "instance-123" });

  const receivedTaskChange = new Promise((resolveChange) => socket.once("minecraft:changed", resolveChange));
  const response = await fetch(`${baseUrl}/api/minecraft/java/install`, {
    method: "POST",
    headers: { cookie: `lfaa_session=${token}`, "content-type": "application/json" },
    body: JSON.stringify({ nodeId, major: 21 })
  });
  assert.equal(response.status, 202);
  assert.deepEqual(await receivedTaskChange, { scopes: ["tasks"] });

  const disconnected = new Promise((resolveDisconnect) => socket.once("disconnect", resolveDisconnect));
  revokeSession(session.sessionId);
  realtime.disconnectSession(session.sessionId);
  await disconnected;
  await assert.rejects(openSocket(`lfaa_session=${token}`), /登录会话无效/u);
});
