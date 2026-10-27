/*
 * 功能：验证文件管理接口接受完整操作参数和合法空文件内容。
 * 作用：覆盖文件任务 HTTP 路由的请求校验，避免零字节文件或空文本被误判为格式错误。
 * 关联文件：packages/api/gateway/src/index.ts、packages/fs/fs/src/queue.ts、packages/storage/storage-sqlite/src/database.ts。
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";

const temporaryParent = resolve(tmpdir());
const dataDirectory = mkdtempSync(join(temporaryParent, "lfaa-file-manager-api-"));
const homeDirectory = mkdtempSync(join(temporaryParent, "lfaa-file-manager-home-"));
process.env.LFAA_HOME = homeDirectory;
process.env.LFAA_DATA_DIR = dataDirectory;
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "file-manager-integration-test-secret-32";

const [{ default: express }, { default: jwt }, { config }, { database, closeDatabase }, { createSession, sessionLifetimeSeconds }] = await Promise.all([
  import("express"),
  import("jsonwebtoken"),
  import("lfaa-launch-environment/src/config.js"),
  import("lfaa-storage-sqlite/src/database.js"),
  import("lfaa-identity-auth/src/service.js")
]);

// 使用与正式启动相同的文件存储迁移，再执行包含独立节点身份表的后续版本链。
const { retireLegacyFileTables } = await import("lfaa-storage-domain/src/migration.js");
const { configuration } = await import("lfaa-storage-domain/src/configuration.js");
const { sessionRecords } = await import("lfaa-session-persistence-jsonl/src/repository.js");
const fileTransfers = await import("lfaa-fs/src/file-transfers.mjs");
const { createNodeFileTask } = await import("lfaa-fs/src/queue.js");
const { daemonHeartbeatSchema } = await import("lfaa-api-remotes/src/route-contracts.js");
const { nodeFileTransferLifetimeMilliseconds } = await import("lfaa-util-values/src/file-transfer-contract.mjs");
retireLegacyFileTables();
const { createApiRouter } = await import("lfaa-test-support-api/src/router.js");

const userId = randomUUID();
const nodeId = randomUUID();
const uploadNodeId = randomUUID();
const emptyResultNodeId = randomUUID();
const legacyNodeId = randomUUID();
const outdatedSizeNodeId = randomUUID();
database.prepare(`
  INSERT INTO users (id, username, password_salt, password_hash, role, is_super_admin)
  VALUES (?, ?, 'test-salt', 'test-hash', 'admin', 1)
`).run(userId, `file-manager-test-${userId}`);
database.prepare(`
  INSERT INTO daemon_nodes (id, display_name, platform, architecture, daemon_version, status, capabilities_json, last_seen_at)
  VALUES (?, '测试节点', 'win32', 'x64', 'test', 'online', '["node-filesystem-v1","node-filesystem-v2","node-filesystem-directory-size-v1","node-filesystem-binary-transfer-v1"]', ?)
`).run(nodeId, new Date().toISOString());
database.prepare(`
  INSERT INTO daemon_nodes (id, display_name, platform, architecture, daemon_version, status, capabilities_json, last_seen_at)
  VALUES (?, '原始上传测试节点', 'win32', 'x64', 'test', 'online', '["node-filesystem-v1","node-filesystem-v2","node-filesystem-instance-v1","node-filesystem-binary-transfer-v1"]', ?)
`).run(uploadNodeId, new Date().toISOString());
database.prepare(`
  INSERT INTO daemon_nodes (id, display_name, platform, architecture, daemon_version, status, capabilities_json, last_seen_at)
  VALUES (?, '空文件测试节点', 'win32', 'x64', 'test', 'online', '["node-filesystem-v1","node-filesystem-v2","node-filesystem-directory-size-v1","node-filesystem-binary-transfer-v1"]', ?)
`).run(emptyResultNodeId, new Date().toISOString());
database.prepare(`
  INSERT INTO daemon_nodes (id, display_name, platform, architecture, daemon_version, status, capabilities_json, last_seen_at)
  VALUES (?, '旧版文件节点', 'win32', 'x64', 'test', 'online', '["node-filesystem-v1"]', ?)
`).run(legacyNodeId, new Date().toISOString());
database.prepare(`
  INSERT INTO daemon_nodes (id, display_name, platform, architecture, daemon_version, status, capabilities_json, last_seen_at)
  VALUES (?, '不支持目录大小的节点', 'win32', 'x64', 'test', 'online', '["node-filesystem-v1","node-filesystem-v2"]', ?)
`).run(outdatedSizeNodeId, new Date().toISOString());

const { saveUserSettings } = await import("lfaa-settings/src/service.js");
saveUserSettings(userId, "permissions", { mode: "full_access" });
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
  const resolvedHomeDirectory = resolve(homeDirectory);
  assert.equal(dirname(resolvedHomeDirectory), temporaryParent);
  assert.ok(basename(resolvedHomeDirectory).startsWith("lfaa-file-manager-home-"));
  rmSync(resolvedHomeDirectory, { recursive: true, force: true });
});

test("Daemon 心跳只接受显式登记的二进制文件传输能力", () => {
  const heartbeat = {
    id: randomUUID(), displayName: "传输能力测试节点", platform: "win32", architecture: "x64", version: "test",
    dataRoot: "C:\\test-data", capabilities: ["node-filesystem-binary-transfer-v1"], javaRuntimes: [], instances: []
  };
  assert.equal(daemonHeartbeatSchema.validate(heartbeat).error, undefined);
  assert.ok(daemonHeartbeatSchema.validate({ ...heartbeat, capabilities: ["node-filesystem-unregistered-v1"] }).error);
});

test("Daemon 心跳接受已登记的托管 Java 发行版并拒绝未知字段和值", () => {
  const baseRuntime = {
    runtimeId: "temurin-21", distribution: "temurin", major: 21, version: "21.0.8",
    architecture: "x64", os: "windows", vendor: "Eclipse Temurin", managed: true,
    source: "managed", executablePath: "C:\\test-data\\environments\\Java\\Java21\\bin\\java.exe"
  };
  const heartbeat = {
    id: randomUUID(), displayName: "Java 心跳测试节点", platform: "win32", architecture: "x64", version: "test",
    dataRoot: "C:\\test-data", capabilities: [], javaRuntimes: [baseRuntime], instances: []
  };

  assert.equal(daemonHeartbeatSchema.validate(heartbeat).error, undefined);
  assert.equal(daemonHeartbeatSchema.validate({ ...heartbeat, javaRuntimes: [{ ...baseRuntime, runtimeId: "zulu-21", distribution: "zulu", vendor: "Azul Zulu" }] }).error, undefined);
  assert.ok(daemonHeartbeatSchema.validate({ ...heartbeat, javaRuntimes: [{ ...baseRuntime, distribution: "corretto" }] }).error);
  assert.ok(daemonHeartbeatSchema.validate({ ...heartbeat, javaRuntimes: [{ ...baseRuntime, executable: "unexpected.exe" }] }).error);
});

test("文件任务 Owner 深层拒绝 Buffer 和 Base64 字节字段", () => {
  assert.throws(() => createNodeFileTask({ nodeId, createdBy: userId, operation: "list", payload: { nested: { bytes: Buffer.from("file bytes") } } }), /不接受文件字节/u);
  assert.throws(() => createNodeFileTask({ nodeId, createdBy: userId, operation: "list", payload: { nested: { dataBase64: "Ynl0ZXM=" } } }), /不接受文件字节/u);
});

test("文件管理只提交元数据任务，不接受 JSON 文件字节", async () => {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const endpoint = `http://127.0.0.1:${address.port}/api/files/tasks`;
  const requests = [
    { operation: "list", path: "" },
    { operation: "directory-size", path: "" },
    { operation: "search", path: "", query: "server" },
    { operation: "preview", path: "sample.txt" },
    { operation: "read", path: "sample.txt" },
    { operation: "write", path: "sample.txt", content: "", expectedSha256: "0".repeat(64) },
    { operation: "create-file", path: "new.txt" },
    { operation: "create-folder", path: "new-folder" },
    { operation: "rename", path: "sample.txt", name: "renamed.txt" },
    { operation: "move", path: "sample.txt", destinationPath: "" },
    { operation: "delete", path: "sample.txt" },
    { operation: "download", path: "sample.txt" },
    { operation: "trash-list", path: "" },
    { operation: "trash-restore", path: "", name: "00000000-0000-4000-8000-000000000001" },
    { operation: "trash-purge", path: "", name: "00000000-0000-4000-8000-000000000001" }
  ];

  for (const request of requests) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `lfaa_session=${token}` },
      body: JSON.stringify({ nodeId, ...request })
    });
    const responseText = await response.text();
    let body;
    try { body = JSON.parse(responseText); }
    catch { throw new Error(`${request.operation} returned ${response.status} with a non-JSON response: ${responseText.slice(0, 500)}`); }
    assert.equal(response.status, 202, `${request.operation}: ${body.message ?? JSON.stringify(body)}`);
    assert.equal(body.task.operation, request.operation);
  }
});

test("JSON 文件任务接口拒绝内联 Base64 上传", async () => {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const endpoint = `http://127.0.0.1:${address.port}/api/files/tasks`;
  const base = { nodeId, operation: "upload", path: "", name: "sample.txt", sha256: createHash("sha256").update("a").digest("hex") };
  const encoded = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Cookie: `lfaa_session=${token}` }, body: JSON.stringify({ ...base, dataBase64: "YQ==" }) });
  assert.equal(encoded.status, 400);
  const metadataOnly = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Cookie: `lfaa_session=${token}` }, body: JSON.stringify(base) });
  assert.equal(metadataOnly.status, 415);
});

test("短期传输按单文件 3 MiB 和总预留 20 MiB 限流", async () => {
  await assert.rejects(fileTransfers.receiveUserFileTransfer({ userId, name: "too-large.bin", source: [Buffer.alloc(fileTransfers.maximumNodeFileTransferBytes + 1)] }), error => error.code === "file_transfer_too_large");
  const retained = [];
  try {
    for (let index = 0; index < 6; index += 1) {
      retained.push(await fileTransfers.receiveUserFileTransfer({ userId, name: `empty-${index}.bin`, source: [], contentLength: 0 }));
    }
    assert.equal(fileTransfers.getUserUploadFileTransfer({ transferId: retained[0].id, userId }).bytes.length, 0);
    await assert.rejects(fileTransfers.receiveUserFileTransfer({ userId, name: "capacity.bin", source: [], contentLength: 0 }), error => error.code === "file_transfer_capacity");
  } finally {
    for (const transfer of retained) fileTransfers.discardFileTransfer({ transferId: transfer.id, userId });
  }
  const originalNow = Date.now;
  try {
    Date.now = () => 1_000;
    const expiring = await fileTransfers.receiveUserFileTransfer({ userId, name: "expires.bin", source: [Buffer.from("temporary")] });
    Date.now = () => 1_000 + nodeFileTransferLifetimeMilliseconds + 1;
    assert.throws(() => fileTransfers.getUserFileTransfer({ transferId: expiring.id, userId }), fileTransfers.FileTransferNotFoundError);
  } finally { Date.now = originalNow; }
});

test("远程上传原始字节只经已绑定任务读取，不写入 SQLite JSON", async () => {
  const instanceId = randomUUID();
  database.prepare("INSERT INTO minecraft_instances (id, node_id, created_by, name, release_id, java_major, memory_mb, state, eula_accepted_at, storage_directory) VALUES (?, ?, ?, '上传夹具', 'fixture', 21, 2048, 'stopped', ?, 'games')")
    .run(instanceId, uploadNodeId, userId, new Date().toISOString());
  const [{ systemFiles }, { gameInstanceFileMount }] = await Promise.all([
    import("lfaa-fs/src/library.js"),
    import("lfaa-api-workspace-files/src/index.js")
  ]);
  const disposeMount = systemFiles.register(gameInstanceFileMount);
  try {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const api = `http://127.0.0.1:${address.port}/api`;
  const bytes = Buffer.from("raw upload bytes");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const path = `.lfaa-library/game-instances/${instanceId}`;
  const uploadPromise = fetch(`${api}/files/upload?${new URLSearchParams({ path, name: "sample.txt", sha256 })}`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream", Cookie: `lfaa_session=${token}` },
    body: bytes
  });

  let task;
  for (let attempt = 0; attempt < 100 && !task; attempt += 1) {
    const claim = await fetch(`${api}/daemon/files/tasks/claim`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.daemonToken}` },
      body: JSON.stringify({ nodeId: uploadNodeId })
    });
    assert.equal(claim.status, 200);
    task = (await claim.json()).task;
    if (!task) await new Promise(resolveDelay => setTimeout(resolveDelay, 10));
  }
  assert.ok(task, `the raw upload should enqueue a daemon task: ${JSON.stringify(database.prepare("SELECT node_id, operation, status, message FROM node_file_tasks ORDER BY created_at DESC LIMIT 5").all())}`);
  assert.equal(task.operation, "upload");
  assert.equal(typeof task.payload.transferId, "string");
  assert.equal("dataBase64" in task.payload, false);
  assert.equal("bytes" in task.payload, false);
  const persisted = database.prepare("SELECT payload_json FROM node_file_tasks WHERE id=?").get(task.id);
  const payload = JSON.parse(persisted.payload_json);
  assert.equal(payload.transferId, task.payload.transferId);
  assert.equal("dataBase64" in payload, false);
  assert.equal("bytes" in payload, false);

  const wrongNode = await fetch(`${api}/daemon/files/tasks/${task.id}/input?nodeId=${encodeURIComponent(legacyNodeId)}`, {
    headers: { Authorization: `Bearer ${config.daemonToken}` }
  });
  assert.equal(wrongNode.status, 404);
  const input = await fetch(`${api}/daemon/files/tasks/${task.id}/input?nodeId=${encodeURIComponent(uploadNodeId)}`, {
    headers: { Authorization: `Bearer ${config.daemonToken}` }
  });
  assert.equal(input.status, 200);
  assert.deepEqual(Buffer.from(await input.arrayBuffer()), bytes);

  const completion = await fetch(`${api}/daemon/files/tasks/${task.id}/complete`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.daemonToken}` },
    body: JSON.stringify({ nodeId: uploadNodeId, succeeded: true, message: "文件操作已完成。", result: { path: "sample.txt", duplicate: false } })
  });
  assert.equal(completion.status, 204);
  const uploadResponse = await uploadPromise;
  assert.equal(uploadResponse.status, 200, await uploadResponse.clone().text());
  assert.equal((await uploadResponse.json()).result.duplicate, false);
  const repeatedInput = await fetch(`${api}/daemon/files/tasks/${task.id}/input?nodeId=${encodeURIComponent(uploadNodeId)}`, {
    headers: { Authorization: `Bearer ${config.daemonToken}` }
  });
  assert.equal(repeatedInput.status, 404);
  } finally {
    disposeMount();
    database.prepare("DELETE FROM minecraft_instances WHERE id=?").run(instanceId);
  }
});

test("旧版节点不会领取新文件管理操作", async () => {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const response = await fetch(`http://127.0.0.1:${address.port}/api/files/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `lfaa_session=${token}` },
    body: JSON.stringify({ nodeId: legacyNodeId, operation: "preview", path: "sample.txt" })
  });
  assert.equal(response.status, 409);
});

test("旧版 Daemon 不接收依赖原始字节传输的文件任务", async () => {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const response = await fetch(`http://127.0.0.1:${address.port}/api/files/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `lfaa_session=${token}` },
    body: JSON.stringify({ nodeId: legacyNodeId, operation: "download", path: "server.zip" })
  });
  assert.equal(response.status, 409);
});

test("未报告目录大小能力的节点不会收到该任务", async () => {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const response = await fetch(`http://127.0.0.1:${address.port}/api/files/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `lfaa_session=${token}` },
    body: JSON.stringify({ nodeId: outdatedSizeNodeId, operation: "directory-size", path: "games" })
  });
  assert.equal(response.status, 409);
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
  const auditResponse = await fetch(`${api}/files/audit?q=list`, { headers: { Cookie: `lfaa_session=${token}` } });
  assert.equal(auditResponse.status, 200);
  const audit = await auditResponse.json();
  assert.equal(audit.entries[0].operation, "list");
  assert.equal(audit.entries[0].username, `file-manager-test-${userId}`);
});

test("Daemon 只把下载和图像预览元数据写入任务，并经原始字节路由取回", async () => {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const api = `http://127.0.0.1:${address.port}/api`;
  const cases = [
    { operation: "directory-size", path: "docs", result: { path: "docs", totalSize: 7, fileCount: 1, directoryCount: 2, skippedEntries: 0 } },
    { operation: "preview", path: "preview.md", result: { path: "preview.md", previewKind: "text", content: "preview only", size: 12 } },
    { operation: "read", path: "empty.txt", result: { path: "empty.txt", content: "", size: 0 } },
    { operation: "download", path: "empty.txt", bytes: Buffer.alloc(0), result: { path: "empty.txt", name: "empty.txt" } },
    { operation: "preview", path: "preview.png", bytes: Buffer.from([137, 80, 78, 71]), result: { path: "preview.png", previewKind: "image", mimeType: "image/png", name: "preview.png" } }
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

    if (item.bytes) {
      const binaryTransfer = await fetch(`${api}/daemon/files/tasks/${created.id}/transfer?${new URLSearchParams({ nodeId: emptyResultNodeId, name: item.result.name })}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${config.daemonToken}`, "Content-Type": "application/octet-stream" },
        body: item.bytes
      });
      assert.equal(binaryTransfer.status, 200, await binaryTransfer.clone().text());
      Object.assign(item.result, await binaryTransfer.json());

      const mismatchedResult = { ...item.result, size: item.result.size + 1 };
      const mismatchedCompletion = await fetch(`${api}/daemon/files/tasks/${encodeURIComponent(created.id)}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.daemonToken}` },
        body: JSON.stringify({ nodeId: emptyResultNodeId, succeeded: true, message: "文件操作已完成。", result: mismatchedResult })
      });
      assert.equal(mismatchedCompletion.status, 400, await mismatchedCompletion.clone().text());
    }

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
    assert.equal("dataBase64" in completed.task.result, false);
    if (item.bytes) {
      const otherUserId = randomUUID();
      database.prepare(`INSERT INTO users (id, username, password_salt, password_hash, role, is_super_admin) VALUES (?, ?, 'test-salt', 'test-hash', 'admin', 0)`).run(otherUserId, `file-manager-other-${otherUserId}`);
      saveUserSettings(otherUserId, "permissions", { mode: "full_access" });
      const otherSession = createSession(otherUserId);
      const otherToken = jwt.sign({ sid: otherSession.sessionId }, config.jwtSecret, { algorithm: "HS256", audience: "lfaa-web", issuer: "lfaa-server", expiresIn: sessionLifetimeSeconds });
      const denied = await fetch(`${api}/files/transfers/${created.id}`, { headers: { Cookie: `lfaa_session=${otherToken}` } });
      assert.notEqual(denied.status, 200);
      const transferred = await fetch(`${api}/files/transfers/${created.id}`, { headers: { Cookie: `lfaa_session=${token}` } });
      assert.equal(transferred.status, 200);
      assert.deepEqual(Buffer.from(await transferred.arrayBuffer()), item.bytes);
      const consumed = await fetch(`${api}/files/transfers/${created.id}`, { headers: { Cookie: `lfaa_session=${token}` } });
      assert.equal(consumed.status, 404);
    }
  }
});
