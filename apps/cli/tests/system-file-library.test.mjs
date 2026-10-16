/** 功能：回归统一文件库在无 Daemon 时的真实磁盘操作、账户边界与 API 鉴权。作用：隔离目录、数据库和账户只存在于测试生命周期。关联文件：fs/library、managed-files、workspace-files、knowledge-controller/file-mount。 */
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { storageFileManagerPath } from "../../../packages/client/connection/src/file-manager-location.ts";
const base = resolve(tmpdir());
await mkdir(base, { recursive: true });
const root = await mkdtemp(join(base, "system-files-test-"));
const dataRoot = join(root, "data");
const volumeRoot = dataRoot;
await mkdir(dataRoot);
process.env.LFAA_DATA_DIR = dataRoot;
process.env.NODE_ENV = "test";
const { SystemFileLibrary } = await import("lfaa-fs/src/library.js");
const { database, closeDatabase } = await import("lfaa-storage-sqlite/src/database.js");
const { retireLegacyFileTables } = await import("lfaa-storage-domain/src/migration.js");
const { configuration } = await import("lfaa-storage-domain/src/configuration.js");
const { sessionRecords } = await import("lfaa-session-persistence-jsonl/src/repository.js");
retireLegacyFileTables();
const library = new SystemFileLibrary(dataRoot);
const actor = { userId: "file-owner", role: "super_admin" };
database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES ('file-owner',8801,'file-owner','test','test','admin',1),('other',8802,'file-other','test','test','admin',0)").run();
const { saveUserSettings } = await import("lfaa-settings/src/service.js");
saveUserSettings(actor.userId, "permissions", { mode: "full_access" });
after(async () => { configuration.close(); sessionRecords.close(); closeDatabase(); assert.equal(root.startsWith(base), true); await rm(root, { recursive: true, force: true }); });

test("无节点时浏览当前 data并完成创建、摘要编辑、移动、回收与恢复；不写节点任务", async () => {
  assert.equal(database.prepare("SELECT COUNT(*) AS n FROM daemon_nodes").get().n, 0);
  const before = database.prepare("SELECT COUNT(*) AS n FROM node_file_tasks").get().n;
  const overview = await library.operate(actor, "list", { path: "" });
  assert.equal(overview.rootDirectory, dataRoot);
  const volumes = await library.operate(actor, "list", {path:"local-drives"});
  assert.ok(volumes.entries.length > 0);
  for (const volume of volumes.entries) assert.equal(overview.entries.some(entry => entry.path === volume.path), false, "真实 data 列表不混入磁盘来源");
  assert.equal(overview.entries.some(entry => entry.path === "local-drives" || entry.path === ".lfaa-library"), false);
  assert.ok(library.listLocations(actor).locations.some(location => location.path === "local-drives"));
  await library.operate(actor, "create-folder", { path: "docs" });
  await library.operate(actor, "create-file", { path: "file.txt" });
  const read = await library.operate(actor, "read", { path: "file.txt" });
  await library.operate(actor, "write", { path: read.path, content: "真实文件内容", expectedSha256: read.sha256 });
  assert.equal(await readFile(join(volumeRoot, "file.txt"), "utf8"), "真实文件内容");
  await assert.rejects(library.operate(actor, "write", { path: read.path, content: "不能覆盖", expectedSha256: read.sha256 }), /其他操作修改/u);
  await library.operate(actor, "rename", { path: read.path, name: "renamed.txt" });
  await library.operate(actor, "move", { path: "renamed.txt", destinationPath: "docs" });
  await library.operate(actor, "delete", { path: "docs/renamed.txt" });
  const trash = await library.operate(actor, "trash-list", { path: "" });
  assert.equal(trash.entries[0].path, "docs/renamed.txt");
  await assert.rejects(library.operate({ userId: "other", role: "admin" }, "trash-list", { path: "" }), /超级管理员/u);
  await library.operate(actor, "trash-restore", { path: "", name: trash.entries[0].trashId });
  assert.equal(await readFile(join(volumeRoot, "docs/renamed.txt"), "utf8"), "真实文件内容");
  assert.equal(database.prepare("SELECT COUNT(*) AS n FROM node_file_tasks").get().n, before);
});

test("存储位置映射使用保存的本机路径，不跨盘伪装为 data 子目录", () => {
  assert.equal(storageFileManagerPath('games/minecraft','H:/LFAA/data'),'games/minecraft');
  assert.equal(storageFileManagerPath('H:\\LFAA\\data\\logs','h:\\lfaa\\data'),'logs');
  assert.equal(storageFileManagerPath('E:\\Servers\\Minecraft','H:\\LFAA\\data'),'local-drives/E/Servers/Minecraft');
  assert.equal(storageFileManagerPath('/mnt/games','/var/lfaa/data'),'local-drives/root/mnt/games');
  assert.throws(()=>storageFileManagerPath('../secret','H:/LFAA/data'),/无效/u);
});
test("真实字节上传、摘要与同名冲突、串行写入、审计不保存正文", async () => {
  const bytes = Buffer.from("上传正文"); const sha256 = createHash("sha256").update(bytes).digest("hex");
  await library.operate(actor, "upload", { path: "", name: "upload.txt", bytes, sha256 });
  const duplicate = await library.operate(actor, "upload", { path: "", name: "upload.txt", bytes, sha256 });
  assert.equal(duplicate.duplicate, true);
  await assert.rejects(library.operate(actor, "upload", { path: "", name: "bad.txt", bytes, sha256: "0".repeat(64) }), /校验失败/u);
  const read = await library.operate(actor, "read", { path: "upload.txt" });
  const writes = await Promise.allSettled(["one", "two"].map(content => library.operate(actor, "write", { path: read.path, content, expectedSha256: read.sha256 })));
  assert.equal(writes.filter(result => result.status === "fulfilled").length, 1);
  const download = await library.openDownload(actor, read.path); const chunks = [];
  for await (const chunk of download.stream) chunks.push(chunk);
  assert.match(Buffer.concat(chunks).toString(), /^(one|two)$/u);
  const audit = await library.listAudit(actor, "upload.txt");
  assert.ok(audit.length >= 4); assert.equal(JSON.stringify(audit).includes("上传正文"), false);
  await assert.rejects(library.listAudit({ userId: "other", role: "admin" }, ""), /超级管理员/u);
});
test("路径与角色保护、Owner 失败隔离、取消及挂载撤销", async () => {
  await assert.rejects(library.operate({ userId: "other", role: "member" }, "list", { path: "" }), /管理员/u);
  for (const path of ["../", "../outside", "local\\test", "/absolute"]) await assert.rejects(library.operate(actor, "list", { path }));
  const unregister = library.register({ id: "broken-owner", name: "异常业务目录", operate: async () => { throw new Error("真实服务失败"); } });
  await assert.rejects(library.operate(actor, "list", { path: ".lfaa-library/broken-owner" }), /真实服务失败/u);
  assert.ok((await library.operate(actor, "list", { path: "" })).entries.some(entry => entry.name === "upload.txt"));
  unregister();
  assert.equal((await library.operate(actor, "list", { path: "" })).entries.some(entry => entry.path === ".lfaa-library/broken-owner"), false);
  const signal = AbortSignal.abort(); await assert.rejects(library.operate({ ...actor, signal }, "list", { path: "" }));
});
test("data 外路径、源码、私有目录与权限撤销被实时拒绝", async () => {
  await assert.rejects(library.operate({ userId: "other", role: "super_admin" }, "list", { path: "" }), /超级管理员/u);
  for (const path of ["../packages", "H:/LFAA1/packages", "C:/Users", "credentials", "users", "database", "storages", "sessions"]) await assert.rejects(library.operate(actor, "list", { path }));
  saveUserSettings(actor.userId, "permissions", { mode: "ask" });
  await assert.rejects(library.operate(actor, "list", { path: "" }), /完全访问/u);
  saveUserSettings(actor.userId, "permissions", { mode: "approve_remembered" });
  await assert.rejects(library.openDownload(actor, "upload.txt"), /完全访问/u);
  saveUserSettings(actor.userId, "permissions", { mode: "full_access" });
  const list = await library.operate(actor, "list", { path: "" });
  assert.equal(list.entries.some(entry => ["credentials", "users", "database", "storages", "sessions"].includes(entry.name)), false);
});

test("资料库挂载读写经过原 Owner，保持账户隔离和版本摘要", async () => {
  const { knowledgeFileMount } = await import("lfaa-api-knowledge-controller/src/file-mount.js");
  const unregister = library.register(knowledgeFileMount);
  try {
    const item = await library.operate(actor, "create-file", { path: ".lfaa-library/knowledge/验收资料.md" });
    const initial = await library.operate(actor, "read", { path: item.path });
    await library.operate(actor, "write", { path: item.path, content: "# 修改后的资料", expectedSha256: initial.sha256 });
    assert.equal((await library.operate(actor, "preview", { path: item.path })).content, "# 修改后的资料");
    await assert.rejects(library.operate({ userId: "other", role: "admin" }, "read", { path: item.path }), /超级管理员/u);
  } finally { unregister(); }
});
test("HTTP 无节点可列 data，未认证拒绝；无节点状态查询和任务入队", async () => {
  const { default: express } = await import("express"); const { default: jwt } = await import("jsonwebtoken");
  const { config } = await import("lfaa-launch-environment/src/config.js");
  const { createSession, sessionLifetimeSeconds } = await import("lfaa-identity-auth/src/service.js");
  const { registerRoutes } = await import("lfaa-api-workspace-files/src/index.js");
  const app = express(); app.use(express.json()); const router = express.Router(); registerRoutes(router, {}, { publishMinecraftChange() {} }, library); app.use("/api", router);
  app.use((error, _req, res, _next) => res.status(error.statusCode || error.status || 500).json({ message: error.message }));
  const server = app.listen(0, "127.0.0.1"); await new Promise(done => server.once("listening", done));
  const session = createSession("file-owner");
  const token = jwt.sign({ sid: session.sessionId }, config.jwtSecret, { algorithm: "HS256", audience: "lfaa-web", issuer: "lfaa-server", expiresIn: sessionLifetimeSeconds });
  const url = `http://127.0.0.1:${server.address().port}/api/files/operations`;
  try {
    const payload = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "list", path: "" }) };
    assert.equal((await fetch(url, payload)).status, 401);
    const response = await fetch(url, { ...payload, headers: { ...payload.headers, Cookie: `lfaa_session=${token}` } });
    assert.equal(response.status, 200); assert.ok((await response.json()).result.entries.some(entry => entry.path === "docs"));
    const bytes = Buffer.from("HTTP 字节上传");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const uploadUrl = url.replace("/operations", "/upload?") + new URLSearchParams({ path: "", name: "http.txt", sha256 });
    const upload = await fetch(uploadUrl, { method: "POST", headers: { Cookie: `lfaa_session=${token}`, "Content-Type": "application/octet-stream" }, body: bytes });
    assert.equal(upload.status, 200);
    assert.equal(await readFile(join(volumeRoot, "http.txt"), "utf8"), "HTTP 字节上传");
    const download = await fetch(url.replace("/operations", "/download?") + new URLSearchParams({ path: "http.txt" }), { headers: { Cookie: `lfaa_session=${token}` } });
    assert.equal(download.status, 200); assert.equal(await download.text(), "HTTP 字节上传");
    assert.match(download.headers.get("content-disposition"), /attachment/u);
    const otherSession = createSession("other");
    const otherToken = jwt.sign({ sid: otherSession.sessionId }, config.jwtSecret, { algorithm: "HS256", audience: "lfaa-web", issuer: "lfaa-server", expiresIn: sessionLifetimeSeconds });
    for (const gate of ["/locations", "/operations", "/tasks", "/nodes", "/audit", "/system-audit", "/tasks/missing", "/download?path=http.txt", "/upload?path="]) {
      const method = ["/operations", "/tasks", "/upload?path="].includes(gate) ? "POST" : "GET";
      const endpoint = url.replace("/operations", gate);
      assert.equal((await fetch(endpoint, { method, headers: { Cookie: `lfaa_session=${otherToken}`, "Content-Type": "application/json" }, ...(method === "POST" ? { body: JSON.stringify({ operation: "list", path: "" }) } : {}) })).status, 403);
      saveUserSettings(actor.userId, "permissions", { mode: "ask" });
      assert.equal((await fetch(endpoint, { method, headers: { Cookie: `lfaa_session=${token}`, "Content-Type": "application/json" }, ...(method === "POST" ? { body: JSON.stringify({ operation: "list", path: "" }) } : {}) })).status, 403);
      saveUserSettings(actor.userId, "permissions", { mode: "full_access" });
    }
    assert.equal(database.prepare("SELECT COUNT(*) AS n FROM daemon_nodes").get().n, 0);
    assert.equal(database.prepare("SELECT COUNT(*) AS n FROM node_file_tasks").get().n, 0);
  } finally { await new Promise(done => server.close(done)); }
});
test("排队后撤销完全访问，节点领取时拒绝执行并清除输入", async () => {
  const { randomUUID } = await import("node:crypto");
  const { createNodeFileTask, claimNextNodeFileTask, getNodeFileTask } = await import("lfaa-fs/src/queue.js");
  const nodeId = randomUUID();
  database.prepare("INSERT INTO daemon_nodes(id,display_name,platform,architecture,daemon_version,status,last_seen_at) VALUES (?, 'isolated-node', 'win32', 'x64', 'test', 'online', ?)").run(nodeId, new Date().toISOString());
  const task = createNodeFileTask({ nodeId, createdBy: actor.userId, operation: "create-file", payload: { path: "not-created.txt" } });
  saveUserSettings(actor.userId, "permissions", { mode: "ask" });
  assert.equal(claimNextNodeFileTask(nodeId), null);
  const failed = getNodeFileTask(task.id);
  assert.equal(failed.status, "failed"); assert.deepEqual(failed.payload, {});
  saveUserSettings(actor.userId, "permissions", { mode: "full_access" });
});
test("AI 使用统一服务发现 data 目录，风险与摘要校验继续经过工具合同", async () => {
  const taskCount = database.prepare("SELECT COUNT(*) AS n FROM node_file_tasks").get().n;
  const { listAiBusinessTools } = await import("lfaa-tools/src/business-tools.js");
  const tool = listAiBusinessTools("workspace", "super_admin", null, "full_access").find(tool => tool.name === "system_file_operation");
  assert.ok(tool);
  const input = tool.parse({ operation: "list", path: "" });
  const result = await tool.execute(input, { userId: "file-owner", userRole: "super_admin", applicationId: "workspace", agentRunId: "file-test", signal: new AbortController().signal, onProgress() {} });
  assert.ok(result.result.entries.some(entry => entry.path === "docs"));
  assert.equal(tool.risk({ operation: "delete" }), "dangerous");
  assert.equal(tool.risk({ operation: "write" }), "write");
  assert.throws(() => tool.parse({ operation: "write", path: "a.txt", content: "缺少摘要" }), /版本摘要/u);
  assert.equal(listAiBusinessTools("workspace", "member").some(item => item.name === tool.name), false);
  assert.equal(database.prepare("SELECT COUNT(*) AS n FROM node_file_tasks").get().n, taskCount);
});
