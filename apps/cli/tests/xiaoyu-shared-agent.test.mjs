/** 共享工作入口、真实会话关联/项目及认证能力目录；仅使用隔离账户和数据。 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { isolateData } from "./isolated-data.mjs";

isolateData(test, "xiaoyu-shared-agent");
const { APPLICATION_IDS, normalizeWorkRoute } = await import("lfaa-util-values/src/application-id.js");
const { isAgentAssociations } = await import("lfaa-util-values/src/agent-associations.js");
const sessions = await import("lfaa-session/src/sessions.js");
const { database } = await import("lfaa-storage-sqlite/src/database.js");
const { retireLegacyFileTables } = await import("lfaa-storage-domain/src/migration.js"); retireLegacyFileTables();

test("所有旧工作入口归一，App 常规路由保持，关联只接受有界引用", () => {
  assert.equal(normalizeWorkRoute("/"), "/work");
  assert.equal(normalizeWorkRoute("/tasks"), "/work");
  for (const app of APPLICATION_IDS) {
    assert.equal(normalizeWorkRoute(`/apps/${app}/ai-work`), "/work");
    assert.equal(normalizeWorkRoute(`/apps/${app}/ai-work/history`), "/work");
    const normalRoute = app === "steamcmd" || app === "minecraft" ? `/games/${app}/overview` : `/apps/${app}/normal/overview`;
    assert.equal(normalizeWorkRoute(`/apps/${app}/normal/overview`), normalRoute);
  }
  assert.ok(isAgentAssociations({ applicationIds: [], capabilityIds: [] }));
  assert.ok(!isAgentAssociations({ applicationIds: ["minecraft", "minecraft"], capabilityIds: [] }));
  assert.ok(!isAgentAssociations({ applicationIds: [], capabilityIds: Array.from({ length: 17 }, (_, index) => `skill.${index}`) }));
  assert.ok(!isAgentAssociations({ applicationIds: [], capabilityIds: ["ignore\nsystem"] }));
});

test("真实节点新增实例/平台文件能力通过心跳合同，未登记能力仍拒绝", async () => {
  const { daemonHeartbeatSchema } = await import("lfaa-api-remotes/src/route-contracts.js");
  const heartbeat = { id: randomUUID(), displayName: "隔离节点", platform: "win32", architecture: "x64", version: "fixture", dataRoot: "C:\\fixture-data", capabilities: ["node-filesystem-v1", "node-filesystem-v2", "node-filesystem-instance-v1", "node-filesystem-game-storage-v1"], javaRuntimes: [], instances: [] };
  assert.equal(daemonHeartbeatSchema.validate(heartbeat).error, undefined);
  assert.ok(daemonHeartbeatSchema.validate({ ...heartbeat, capabilities: [...heartbeat.capabilities, "unknown-unregistered-capability"] }).error);
});

test("原 JSONL 保存关联、旧会话来源不变，活动任务不能换关联，记忆分支继承所选时点", () => {
  const owner = randomUUID(), stranger = randomUUID();
  database.prepare("INSERT INTO users(id,username,password_salt,password_hash,role) VALUES(?,?,'fixture','fixture','admin')").run(owner, owner);
  const references = { applicationIds: ["minecraft"], capabilityIds: ["skill.registry/minecraft-server-setup"] };
  const turn = sessions.createAiTurn(owner, "writing", null, "共享工作核对目标", false, null, references);
  assert.equal(turn.session.appId, "writing"); assert.deepEqual(turn.session.associations, references);
  assert.equal(sessions.setAiSessionAssociations(owner, turn.session.id, { applicationIds: [], capabilityIds: [] }), null);
  assert.equal(sessions.setAiSessionAssociations(stranger, turn.session.id, references), null);
  sessions.finishAiAssistantMessage(owner, turn.session.id, turn.assistantMessage.id, "已核对，不执行游戏变更。", "complete");
  const seed = sessions.prepareAiSessionBranchSeed(owner, turn.session.id, turn.assistantMessage.id, 200000);
  assert.deepEqual(seed.associations, references);
  const cleared = sessions.setAiSessionAssociations(owner, turn.session.id, { applicationIds: [], capabilityIds: [] });
  assert.deepEqual(cleared.associations, { applicationIds: [], capabilityIds: [] });
  const branch = sessions.createAiSessionBranchWithMemory(owner, seed, "用户要求核对游戏能力，没有操作授权变化。", [{ providerId: "fixture", modelId: "fixture", promptTokens: 1, completionTokens: 1 }]);
  assert.deepEqual(branch.associations, references);
  assert.equal(sessions.getAiSession(stranger, branch.id), null);
  assert.ok(sessions.listAiSessions(owner, false).some(item => item.id === turn.session.id));
  assert.throws(() => sessions.createAiTurn(owner, "workspace", turn.session.id, "不能伪造来源"), /此应用/);
});

test("节点详情和列表使用同一心跳有效期，过期能力不能因读取顺序而保持在线", async () => {
  const { recordDaemonHeartbeat, getDaemonNode, listDaemonNodes } = await import("lfaa-host-daemon/src/local-daemon.js");
  const id = randomUUID();
  const heartbeat = { id, displayName: "心跳回归", platform: "win32", architecture: "x64", version: "fixture", dataRoot: "C:\\fixture-data", capabilities: ["agent-shell-v1"], javaRuntimes: [] };
  recordDaemonHeartbeat(heartbeat);
  assert.equal(getDaemonNode(id).status, "online");
  database.prepare("UPDATE daemon_nodes SET last_seen_at=? WHERE id=?").run(new Date(Date.now() - 21_000).toISOString(), id);
  assert.equal(getDaemonNode(id).status, "offline");
  let notifications = 0;
  assert.equal(listDaemonNodes(() => notifications++).find(node => node.id === id).status, "offline");
  assert.equal(notifications, 1);
  listDaemonNodes(() => notifications++);
  assert.equal(notifications, 1);
  recordDaemonHeartbeat(heartbeat);
  assert.equal(getDaemonNode(id).status, "online");
});

