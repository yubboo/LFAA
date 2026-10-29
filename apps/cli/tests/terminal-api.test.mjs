/** 功能：验证节点终端 HTTP/PTY 全链及统一权限。作用：隔离数据覆盖真实输入输出、账户隔离、节点凭据/TLS和断线清理。关联文件：terminal-controller、daemon/terminal-channel.mjs、permission-presets。 */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { randomUUID } from "node:crypto";
const parent = resolve("../../dist/.tmp/terminal-regression"); mkdirSync(parent, { recursive: true });
const data = mkdtempSync(resolve(parent, "run-"));
process.env.LFAA_DATA_DIR = data; process.env.NODE_ENV = "test"; process.env.JWT_SECRET = "terminal-test-signing-secret-at-least-32";
const [{ default: express }, { default: jwt }, { config }, { database, closeDatabase }, identity, settings, permissions, { TerminalRegistry }, { registerTerminalRoutes }, { startTerminalChannel }, { validateDaemonRequest }, credentials] = await Promise.all([
  import("express"), import("jsonwebtoken"), import("lfaa-launch-environment/src/config.js"), import("lfaa-storage-sqlite/src/database.js"), import("lfaa-identity-auth/src/service.js"),
  import("lfaa-settings/src/service.js"), import("lfaa-permission-presets/src/permissions.js"), import("lfaa-api-terminal-controller/src/registry.js"), import("lfaa-api-terminal-controller/src/routes.js"), import("lfaa-host-daemon/src/terminal-channel.mjs"), import("lfaa-api-remotes/src/route-contracts.js"), import("lfaa-host-daemon/src/node-credentials.js")
]);
const { retireLegacyFileTables } = await import("lfaa-storage-domain/src/migration.js"); retireLegacyFileTables();
const { configuration } = await import("lfaa-storage-domain/src/configuration.js"), { sessionRecords } = await import("lfaa-session-persistence-jsonl/src/repository.js");
const users = [randomUUID(), randomUUID()];
for (const [index, id] of users.entries()) database.prepare("INSERT INTO users(id,username,password_salt,password_hash,role) VALUES(?,?,'fixture','fixture','admin')").run(id, `terminal-regression-${index}`);
const cookies = users.map(userId => {
  const session = identity.createSession(userId);
  return `lfaa_session=${jwt.sign({ sid: session.sessionId }, config.jwtSecret, { algorithm: "HS256", audience: "lfaa-web", issuer: "lfaa-server", expiresIn: identity.sessionLifetimeSeconds })}`;
});
const nodeId = randomUUID();
database.prepare("INSERT INTO daemon_nodes(id,display_name,platform,architecture,daemon_version,data_root,status,capabilities_json,last_seen_at) VALUES(?,'PTY 验收节点','win32','x64','test',?,'online','[]',?)").run(nodeId, data, new Date().toISOString());
const registry = new TerminalRegistry(), app = express(), router = express.Router();
app.use(express.json()); registerTerminalRoutes(router, registry, {}, {}); app.use("/api", router);
app.use((error, _req, res, _next) => res.status(error.statusCode ?? 500).json({ error: error.errorCode ?? "internal_error", message: error.message }));
const server = app.listen(0, "127.0.0.1"); await new Promise(resolveReady => server.once("listening", resolveReady));
const base = `http://127.0.0.1:${server.address().port}/api`, controller = new AbortController();
const channel = startTerminalChannel({ apiBase: base, nodeId, readToken: async () => config.daemonToken, signal: controller.signal });
async function waitFor(check) { const deadline = Date.now() + 10_000; while (!check() && Date.now() < deadline) await new Promise(resolveWait => setTimeout(resolveWait, 20)); assert.ok(check()); }
await waitFor(() => registry.connected(nodeId));
const mode = value => settings.saveUserSettings(users[0], "permissions", { ...settings.getUserSettings(users[0]).permissions, mode: value });
const request = (path, body, user = 0, method = "POST") => fetch(`${base}${path}`, { method, headers: { Cookie: cookies[user], "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
const create = (extra = {}) => ({ id: randomUUID(), nodeId, appId: "minecraft", cols: 80, rows: 24, ...extra });
test.after(async () => {
  controller.abort(); await channel.done; registry.dispose(); server.closeAllConnections();
  await new Promise(resolveClose => server.close(resolveClose)); configuration.close(); sessionRecords.close(); closeDatabase();
  assert.equal(dirname(resolve(data)), parent); rmSync(data, { recursive: true, force: true });
});

test("真实 Daemon 通道创建 PTY，中文输出经 SSE 回传；其它账户无法输入", { timeout: 15_000 }, async () => {
  mode("full_access"); const body = create();
  const response = await request("/terminals", body); assert.equal(response.status, 201, await response.clone().text());
  const { terminal } = await response.json(); assert.equal(terminal.nodeId, nodeId); assert.equal(terminal.cwd.toLowerCase(), data.toLowerCase());
  assert.equal((await request(`/terminals/${body.id}/input`, { data: "echo no\r" }, 1)).status, 404);
  const followController = new AbortController(), follow = await fetch(`${base}/terminals/${body.id}/follow`, { headers: { Cookie: cookies[0] }, signal: followController.signal });
  let text = ""; const drain = (async () => { try { for await (const chunk of follow.body) text += Buffer.from(chunk).toString(); } catch {} })();
  assert.equal((await request(`/terminals/${body.id}/input`, { data: "Write-Output '节点中文验收'\r" })).status, 204);
  await waitFor(() => text.includes("节点中文验收")); assert.match(text, /event: output/u);
  assert.equal((await request(`/terminals/${body.id}/resize`, { cols: 100, rows: 30 })).status, 204);
  assert.equal((await request(`/terminals/${body.id}/resize`, { cols: 1000, rows: 30 })).status, 400);
  assert.equal((await request(`/terminals/${body.id}`, undefined, 0, "DELETE")).status, 204);
  await waitFor(() => text.includes("event: exit")); followController.abort(); await drain;
});

test("Minecraft 终端目标复用节点中继并把原始输入、尺寸、输出交给受管 PTY", { timeout: 15_000 }, async () => {
  const minecraftNodeId = randomUUID(), instanceId = randomUUID(), minecraftController = new AbortController();
  database.prepare("INSERT INTO daemon_nodes(id,display_name,platform,architecture,daemon_version,data_root,status,capabilities_json,last_seen_at) VALUES(?,'Minecraft PTY 验收节点','win32','x64','test',?,'online',?,?)")
    .run(minecraftNodeId, data, JSON.stringify(["minecraft-interactive-console-v1"]), new Date().toISOString());
  let attachedInstance = "", attachedTerminal = "", input = "", resized = {}, detached = 0, onOutput;
  const minecraftChannel = startTerminalChannel({ apiBase: base, nodeId: minecraftNodeId, readToken: async () => config.daemonToken, signal: minecraftController.signal,
    async attachMinecraftConsole(targetInstanceId, terminalId, callbacks) {
      attachedInstance = targetInstanceId; attachedTerminal = terminalId; onOutput = callbacks.onOutput;
      return { writeStdin: data => { input = Buffer.from(data).toString("utf8"); }, resize: (cols, rows) => { resized = { cols, rows }; }, detach: () => { detached++; } };
    }
  });
  try {
    await waitFor(() => registry.connected(minecraftNodeId));
    mode("full_access");
    const terminal = await registry.create({ userId: users[0], loginSessionId: "test-login", appId: "minecraft", permissionMode: "full_access", approved: true, scopeKey: `minecraft-console:${minecraftNodeId}:${instanceId}` },
      { id: randomUUID(), nodeId: minecraftNodeId, title: "Minecraft PTY", cwd: "Minecraft · 测试实例", target: { kind: "minecraft", instanceId }, cols: 80, rows: 24, state: "starting", exitCode: null });
    assert.equal(terminal.state, "running"); assert.equal(attachedInstance, instanceId); assert.equal(attachedTerminal, terminal.id);
    await registry.command(minecraftNodeId, { type: "input", id: terminal.id, data: "list\t\r" }); assert.equal(input, "list\t\r");
    await registry.command(minecraftNodeId, { type: "resize", id: terminal.id, cols: 132, rows: 42 }); assert.deepEqual(resized, { cols: 132, rows: 42 });
    onOutput("\u001b[32mserver completion\u001b[0m\r\n"); await waitFor(() => registry.get(users[0], terminal.id).replay.join("").includes("server completion"));
    await registry.close(users[0], terminal.id); await waitFor(() => detached === 1);
  } finally { minecraftController.abort(); await minecraftChannel.done; }
});

test("请求审批不提前执行，批准仅能消费一次，权限变化结束会话", { timeout: 15_000 }, async () => {
  mode("ask"); const body = create();
  let response = await request("/terminals", body); assert.equal(response.status, 202);
  const { approval } = await response.json(); assert.equal(registry.list(users[0]).length, 0);
  assert.equal(permissions.decideAiToolApproval(users[1], approval.id, "approved"), null);
  permissions.decideAiToolApproval(users[0], approval.id, "approved");
  response = await request("/terminals", { ...body, approvalId: approval.id }); assert.equal(response.status, 201, await response.clone().text());
  mode("full_access"); assert.equal((await request(`/terminals/${body.id}/input`, { data: "echo blocked\r" })).status, 403);
  await waitFor(() => registry.list(users[0]).length === 0);
  mode("ask"); response = await request("/terminals", { ...body, approvalId: approval.id }); assert.equal(response.status, 202); assert.notEqual((await response.json()).approval.id, approval.id);
});

test("替我审批累计两次同范围明确批准，后续会话按 Owner 记忆放行", { timeout: 20_000 }, async () => {
  mode("approve_remembered");
  for (let index = 0; index < 2; index++) {
    const body = create(), response = await request("/terminals", body); assert.equal(response.status, 202);
    const { approval } = await response.json(); permissions.decideAiToolApproval(users[0], approval.id, "approved");
    assert.equal((await request("/terminals", { ...body, approvalId: approval.id })).status, 201);
    await request(`/terminals/${body.id}`, undefined, 0, "DELETE");
  }
  const body = create(), response = await request("/terminals", body); assert.equal(response.status, 201, await response.clone().text());
  const grant = permissions.listAiToolPermissionGrants(users[0]).find(grant => grant.toolId === "lfaa_interactive_terminal"); assert.ok(grant);
  permissions.revokeAiToolPermissionGrant(users[0], grant.id);
  assert.equal((await request(`/terminals/${body.id}/input`, { data: "echo blocked\r" })).status, 403);
});

test("远程凭据绑定节点且要求 TLS，撤销后失效；通道断开关闭现有会话", { timeout: 15_000 }, async () => {
  const remote = credentials.issueDaemonCredential("远程终端测试");
  const req = { header: () => `Bearer ${remote.token}`, body: { nodeId: remote.nodeId }, secure: false };
  assert.throws(() => validateDaemonRequest(req), error => error.errorCode === "daemon_tls_required");
  req.secure = true; assert.doesNotThrow(() => validateDaemonRequest(req));
  req.body.nodeId = nodeId; assert.throws(() => validateDaemonRequest(req)); req.body.nodeId = remote.nodeId;
  credentials.revokeDaemonCredential(remote.nodeId); assert.throws(() => validateDaemonRequest(req));
  mode("full_access"); const body = create(); assert.equal((await request("/terminals", body)).status, 201);
  controller.abort(); await channel.done;
  await waitFor(() => !registry.connected(nodeId)); assert.equal(registry.get(users[0], body.id).info.state, "exited");
});
