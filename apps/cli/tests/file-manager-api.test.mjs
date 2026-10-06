/*
 * 功能：验证文件管理接口接受完整操作参数和合法空文件内容。
 * 作用：覆盖文件任务 HTTP 路由的请求校验，避免零字节文件或空文本被误判为格式错误。
 * 关联文件：packages/api/gateway/src/index.ts、packages/fs/fs/src/queue.ts、packages/storage/storage-sqlite/src/database.ts。
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import test from "node:test";

const temporaryParent = resolve(tmpdir());
const dataDirectory = mkdtempSync(join(temporaryParent, "lfaa-file-manager-api-"));
process.env.LFAA_DATA_DIR = dataDirectory;
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "file-manager-integration-test-secret-32";

const [{ default: express }, { default: jwt }, { config }, { database, closeDatabase }, { createSession, sessionLifetimeSeconds }, { createApiRouter }] = await Promise.all([
  import("express"),
  import("jsonwebtoken"),
  import("lfaa-launch-environment/src/config.js"),
  import("lfaa-storage-sqlite/src/database.js"),
  import("lfaa-identity-auth/src/service.js"),
  import("lfaa-test-support-api/src/router.js")
]);

// 使用与正式启动相同的文件存储迁移，再执行包含独立节点身份表的后续版本链。
const { retireLegacyFileTables } = await import("lfaa-storage-domain/src/migration.js");
const { configuration } = await import("lfaa-storage-domain/src/configuration.js");
const { sessionRecords } = await import("lfaa-session-persistence-jsonl/src/repository.js");
retireLegacyFileTables();

const userId = randomUUID();
const nodeId = randomUUID();
const emptyResultNodeId = randomUUID();
database.prepare(`
  INSERT INTO users (id, username, password_salt, password_hash, role)
  VALUES (?, ?, 'test-salt', 'test-hash', 'admin')
`).run(userId, `file-manager-test-${userId}`);
database.prepare(`
  INSERT INTO daemon_nodes (id, display_name, platform, architecture, daemon_version, status, capabilities_json, last_seen_at)
  VALUES (?, '测试节点', 'win32', 'x64', 'test', 'online', '["node-filesystem-v1"]', ?)
`).run(nodeId, new Date().toISOString());
database.prepare(`
  INSERT INTO daemon_nodes (id, display_name, platform, architecture, daemon_version, status, capabilities_json, last_seen_at)
  VALUES (?, '空文件测试节点', 'win32', 'x64', 'test', 'online', '["node-filesystem-v1"]', ?)
`).run(emptyResultNodeId, new Date().toISOString());

const session = createSession(userId);
const token = jwt.sign({ sid: session.sessionId }, config.jwtSecret, {
  algorithm: "HS256",
  audience: "lfaa-web",
  issuer: "lfaa-server",
  expiresIn: sessionLifetimeSeconds
});
const app = express();
app.use(express.json({ limit: "5mb" }));
app.use("/api", createApiRouter({}, { publishMinecraftChange: () => undefined, disconnectSession: () => undefined }));
const server = app.listen(0, "127.0.0.1");
await new Promise((resolveServer, rejectServer) => {
  server.once("listening", resolveServer);
  server.once("error", rejectServer);
});

test.after(async () => {
  await new Promise((resolveServer, rejectServer) => server.close((error) => error ? rejectServer(error) : resolveServer()));
  configuration.close();
  sessionRecords.close();
  closeDatabase();
  const resolvedDataDirectory = resolve(dataDirectory);
  assert.equal(dirname(resolvedDataDirectory), temporaryParent);
  assert.ok(basename(resolvedDataDirectory).startsWith("lfaa-file-manager-api-"));
  rmSync(resolvedDataDirectory, { recursive: true, force: true });
});

test("文件管理的合法操作及空文本、零字节上传均可提交", async () => {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const endpoint = `http://127.0.0.1:${address.port}/api/files/tasks`;
  const requests = [
    { operation: "list", path: "" },
    { operation: "search", path: "", query: "server" },
    { operation: "read", path: "sample.txt" },
    { operation: "write", path: "sample.txt", content: "" },
    { operation: "create-file", path: "new.txt" },
    { operation: "create-folder", path: "new-folder" },
    { operation: "rename", path: "sample.txt", name: "renamed.txt" },
    { operation: "delete", path: "sample.txt" },
    { operation: "upload", path: "", name: "empty.txt", dataBase64: "" },
    { operation: "upload", path: "", name: "sample.txt", dataBase64: "YQ==" },
    { operation: "download", path: "sample.txt" }
  ];

  for (const request of requests) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `lfaa_session=${token}` },
      body: JSON.stringify({ nodeId, ...request })
    });
    const body = await response.json();
    assert.equal(response.status, 202, `${request.operation}: ${body.message ?? JSON.stringify(body)}`);
    assert.equal(body.task.operation, request.operation);
  }
});

test("Daemon 可成功回报数据根目录列表", async () => {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const api = `http://127.0.0.1:${address.port}/api`;
  const claimResponse = await fetch(`${api}/daemon/files/tasks/claim`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.daemonToken}`
    },
    body: JSON.stringify({ nodeId })
  });
  assert.equal(claimResponse.status, 200, await claimResponse.clone().text());
  const { task } = await claimResponse.json();
  assert.ok(task);
  assert.equal(task.operation, "list");

  const completionResponse = await fetch(`${api}/daemon/files/tasks/${encodeURIComponent(task.id)}/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.daemonToken}`
    },
    body: JSON.stringify({
      nodeId,
      succeeded: true,
      message: "文件操作已完成。",
      result: { path: "", entries: [], truncated: false }
    })
  });
  assert.equal(completionResponse.status, 204);

  const taskResponse = await fetch(`${api}/files/tasks/${encodeURIComponent(task.id)}`, {
    headers: { Cookie: `lfaa_session=${token}` }
  });
  assert.equal(taskResponse.status, 200);
  const completed = await taskResponse.json();
  assert.equal(completed.task.status, "succeeded");
  assert.deepEqual(completed.task.result, { path: "", entries: [], truncated: false });
});

test("Daemon 可成功回报空文本文件和零字节下载", async () => {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const api = `http://127.0.0.1:${address.port}/api`;
  const cases = [
    { operation: "read", path: "empty.txt", result: { path: "empty.txt", content: "", size: 0 } },
    { operation: "download", path: "empty.txt", result: { path: "empty.txt", name: "empty.txt", dataBase64: "", size: 0 } }
  ];

  for (const item of cases) {
    const createResponse = await fetch(`${api}/files/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `lfaa_session=${token}` },
      body: JSON.stringify({ nodeId: emptyResultNodeId, operation: item.operation, path: item.path })
    });
    assert.equal(createResponse.status, 202);
    const { task: created } = await createResponse.json();

    const claimResponse = await fetch(`${api}/daemon/files/tasks/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.daemonToken}` },
      body: JSON.stringify({ nodeId: emptyResultNodeId })
    });
    assert.equal(claimResponse.status, 200, await claimResponse.clone().text());
    const { task: claimed } = await claimResponse.json();
    assert.equal(claimed.id, created.id);

    const completionResponse = await fetch(`${api}/daemon/files/tasks/${encodeURIComponent(created.id)}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.daemonToken}` },
      body: JSON.stringify({ nodeId: emptyResultNodeId, succeeded: true, message: "文件操作已完成。", result: item.result })
    });
    assert.equal(completionResponse.status, 204);

    const taskResponse = await fetch(`${api}/files/tasks/${encodeURIComponent(created.id)}`, {
      headers: { Cookie: `lfaa_session=${token}` }
    });
    assert.equal(taskResponse.status, 200);
    const completed = await taskResponse.json();
    assert.equal(completed.task.status, "succeeded");
    assert.deepEqual(completed.task.result, item.result);
  }
});
