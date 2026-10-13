/**
 * 功能：回归通用能力开启与动态目录、会话范围及 Skill 读取。
 * 作用：仅在隔离数据与合成 Provider 中调用真实 Agent/Settings/Permission/Session Owner，不操作桌面。
 * 关联文件：core/tools/capability-settings、agent-loop、skill/tool-skill、session-query/tool-session-query。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { isolateData } from "./isolated-data.mjs";
isolateData(test, "general-agent-capabilities");
const { database } = await import("lfaa-storage-sqlite/src/database.js");
const { retireLegacyFileTables } = await import("lfaa-storage-domain/src/migration.js");
const settings = await import("lfaa-settings/src/service.js");
const sessions = await import("lfaa-session/src/sessions.js");
const { sessionRecords } = await import("lfaa-session-persistence-jsonl/src/repository.js");
retireLegacyFileTables();
const { executeAiTurn } = await import("lfaa-agent-loop/src/execute-turn.js");
const { registerAiBusinessTool } = await import("lfaa-tools/src/registry.js");
const { capabilitySettingsTools } = await import("lfaa-tools/src/capability-settings.js");
const permissions = await import("lfaa-permission-presets/src/permissions.js");
const { Context } = await import("@deepseek-ai/cordis");
const ctx = new Context();
const approvalFiber = await ctx.plugin(await import("lfaa-user-approval/src/index.js"));
const owner = randomUUID(), other = randomUUID();
for (const [id, uid] of [[owner, 1], [other, 2]]) database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role) VALUES(?, ?, ?, 'fixture', 'fixture', 'admin')").run(id, uid, `fixture-${uid}`);
const disposers = [];
let executions = 0;
const candidateTool = { id: "fixture.computer", name: "fixture_computer", description: "隔离桌面动作夹具", coreManaged: true, requiresComputerControl: true, applicationIds: ["workspace"], schema: { type: "object", properties: {}, additionalProperties: false }, parse: value => value, risk: () => "read", approval: () => ({ scopeKey: "fixture", scopeSummary: "fixture", summary: "fixture" }), execute: async (_, context) => { executions++; assert.ok(context.sessionId); return { observed: "真实夹具计数", executions }; } };
registerAiBusinessTool({ effect: setup => { const dispose = setup(); disposers.push(dispose); return dispose; } }, candidateTool);
const host = { listPlugins: () => [], listExtensions: () => [], listInstructionExtensions: () => [], listHooks: () => [], getSystemInstructions: () => [], runBeforeInference: () => ({ failedHookIds: [] }), runAfterInference: () => ({ failedHookIds: [] }) };
const account = { providerId: "openai", modelId: "fixture", chatUrl: "https://provider.example.test/chat", secret: "invalid-fixture-key", keyHeader: "Authorization", keyPrefix: "Bearer ", maxTokensField: "max_completion_tokens", reasoningMode: "default" };
const modelResolver = { resolve: () => account };
const call = (name, argumentsValue, id = name) => ({ tool_calls: [{ index: 0, id, type: "function", function: { name, arguments: JSON.stringify(argumentsValue) } }] });
const sse = delta => new Response(`data: ${JSON.stringify({ choices: [{ delta }] })}\n\ndata: [DONE]\n\n`, { headers: { "Content-Type": "text/event-stream" } });
test.after(async () => { for (const dispose of disposers) dispose(); await approvalFiber.dispose(); });

async function runFixture(mode, decide = "approved", remember = false, scope) {
  settings.saveUserSettings(owner, "permissions", { mode });
  settings.saveUserSettings(owner, "computer-control", { enabled: false });
  settings.saveUserSettings(owner, "ai-runtime", { ...settings.defaultSettings.aiRuntime, retryDelaySeconds: 0 });
  const turn = sessions.createAiTurn(owner, "workspace", null, "打开指定应用的合成测试目标");
  const native = globalThis.fetch, bodies = [], events = [];
  let approvals = 0;
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), account.chatUrl);
    const body = JSON.parse(options.body); bodies.push(body);
    if (settings.getUserSettings(owner).aiRuntime.maxOutputTokens === 0) assert.equal(Object.hasOwn(body, "max_completion_tokens"), false, "模型目录未知且自动模式下不发送猜测的输出上限");
    const names = body.tools?.map(tool => tool.function.name) ?? [];
    const results = body.messages.filter(message => message.role === "tool");
    if (!results.length) {
      assert.ok(!names.includes("fixture_computer"));
      return sse(call("lfaa_set_capability_enabled", { capability: "computerControl", enabled: true }));
    }
    if (scope || decide === "denied") { assert.ok(!settings.getUserSettings(owner).computerControl.enabled); return sse({ content: "未执行被拒绝的操作" }); }
    if (results.length === 1) { assert.ok(names.includes("fixture_computer")); return sse(call("fixture_computer", {})); }
    if (results.length === 2) return sse(call("lfaa_set_capability_enabled", { capability: "computerControl", enabled: false }, "disable"));
    assert.ok(!names.includes("fixture_computer"));
    return sse({ content: "能力已开启、调用并关闭的测试证据" });
  };
  try {
    await executeAiTurn({ userId: owner, userRole: "admin", body: { appId: "workspace", sessionId: turn.session.id, content: "fixture" }, turn, aiPluginHost: host, abortController: new AbortController(), emit(event, data) {
      events.push({ event, data });
      if (event === "activity" && data.activity.status === "approval_required") {
        approvals++;
        const approval = permissions.listAiToolApprovals(owner, "pending").find(row => row.id === data.activity.approvalId);
        assert.ok(approval);
        if (approval.summary.startsWith("开启")) assert.equal(settings.getUserSettings(owner).computerControl.enabled, false, "审批之前不能改设置");
        assert.ok(permissions.decideAiToolApproval(owner, approval.id, decide, remember));
        ctx.lfaaUserApproval.notify(owner, approval.id);
      }
    }, modelResolver, approvalNotifications: ctx.lfaaUserApproval, ...(scope ? { allowedToolNames: scope } : {}) });
    return { bodies, events, approvals, turn };
  } finally { globalThis.fetch = native; }
}

test("ask、记忆授权和完全权限可在同一运行启用/调用/撤销能力", async () => {
  const before = executions;
  assert.equal((await runFixture("ask")).approvals, 2);
  assert.equal((await runFixture("approve_remembered", "approved", true)).approvals, 2);
  assert.equal((await runFixture("approve_remembered")).approvals, 0, "范围相同的开启/关闭使用真实记忆授权");
  const full = await runFixture("full_access");
  assert.equal(full.approvals, 0);
  assert.equal(executions - before, 4);
  assert.ok(full.events.some(item => item.event === "capability-settings"));
  assert.equal(settings.getUserSettings(owner).computerControl.enabled, false);
});

test("拒绝审批和继承工具范围不能被开关工具绕过", async () => {
  const before = executions;
  assert.equal((await runFixture("ask", "denied")).approvals, 1);
  const restricted = await runFixture("full_access", "approved", false, ["fixture_computer"]);
  assert.equal(restricted.approvals, 0);
  assert.equal(executions, before);
  assert.equal(settings.getUserSettings(owner).computerControl.enabled, false);
  const tool = capabilitySettingsTools.find(tool => tool.name === "lfaa_set_capability_enabled");
  assert.throws(() => tool.parse({ capability: "permissions", enabled: true }));
  assert.throws(() => tool.parse({ capability: "mcpServer", enabled: true, serverId: "test", command: "unknown" }));
});

test("空响应只重试模型请求，已有工具不重放；JSON message 格式正常返回", async () => {
  settings.saveUserSettings(owner, "permissions", { mode: "full_access" });
  settings.saveUserSettings(owner, "computer-control", { enabled: true });
  settings.saveUserSettings(owner, "ai-runtime", { ...settings.defaultSettings.aiRuntime, requestRetries: 1, retryDelaySeconds: 0 });
  const turn = sessions.createAiTurn(owner, "workspace", null, "fixture retry");
  const native = globalThis.fetch, before = executions;
  let attempts = 0;
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body); attempts++;
    if (attempts === 1) return sse(call("fixture_computer", {}));
    assert.equal(body.messages.filter(row => row.role === "tool").length, 1);
    if (attempts === 2) return sse({ reasoning_content: "不会公开的合成推理" });
    return Response.json({ choices: [{ message: { role: "assistant", content: "JSON 真实协议解析结果" }, finish_reason: "stop" }], usage: { prompt_tokens: 3, completion_tokens: 5 } });
  };
  try {
    await executeAiTurn({ userId: owner, userRole: "admin", body: { appId: "workspace", sessionId: turn.session.id, content: "fixture" }, turn, aiPluginHost: host, abortController: new AbortController(), emit() {}, modelResolver, approvalNotifications: ctx.lfaaUserApproval });
    assert.equal(attempts, 3); assert.equal(executions - before, 1);
    assert.equal(sessions.getAiRun(owner, turn.assistantMessage.id).message.content, "JSON 真实协议解析结果");
  } finally { globalThis.fetch = native; }
});

test("Session 查询账户/App/项目隔离、有界事件页不暴露内部请求", async () => {
  const project = { id: randomUUID(), appId: "workspace", nodeId: randomUUID(), path: "H:/fixture-project", title: "合成目录" };
  const caller = sessions.createAiTurn(owner, "workspace", null, "caller", false, project);
  const same = sessions.createAiTurn(owner, "workspace", null, "same", false, project);
  const different = sessions.createAiTurn(owner, "workspace", null, "different", false, { ...project, id: randomUUID() });
  const foreign = sessions.createAiTurn(other, "workspace", null, "foreign", false, project);
  const noProject = sessions.createAiTurn(owner, "workspace", null, "no-project");
  const otherApp = sessions.createAiTurn(owner, "writing", null, "different-app");
  sessions.recordAiSessionRequest(owner, same.session.id, same.assistantMessage.id, { providerId: "fixture", modelId: "fixture", permissionMode: "ask", settings: {}, tools: [{ type: "function", function: { name: "fixture", description: "隔离协议夹具", parameters: { type: "object", properties: {} } } }] }, [{ role: "system", content: "内部提示不得查询" }]);
  sessions.recordAiToolCall(owner, same.session.id, same.assistantMessage.id, "call", "fixture", '{"secret":"不要返回"}', true);
  sessions.recordAiToolResult(owner, same.session.id, same.assistantMessage.id, "call", "不要返回的工具输出", false, "complete");
  assert.ok(sessions.listAiQuerySessions(owner, caller.session.id).some(row => row.id === same.session.id));
  for (const target of [different, foreign, otherApp]) assert.throws(() => sessions.assertAiSessionQueryScope(owner, caller.session.id, target.session.id));
  assert.deepEqual(sessions.listAiQuerySessions(owner, noProject.session.id).map(row => row.id), [noProject.session.id]);
  let after = 0, rows = [];
  do { const page = await sessions.getAiQueryEventsPage(owner, caller.session.id, same.session.id, { after, limit: 1 }); assert.ok(page.events.length <= 1); rows.push(...page.events); after = page.nextAfter; } while (after !== null);
  assert.ok(rows.some(row => row.type === "tool/result"));
  assert.doesNotMatch(JSON.stringify(rows), /内部提示|secret|不要返回/u);
  const { sessionQueryTools } = await import("lfaa-tool-session-query");
  await assert.rejects(sessionQueryTools[1].execute({ sessionId: foreign.session.id, limit: 20 }, { userId: owner, applicationId: "workspace", sessionId: caller.session.id, signal: new AbortController().signal }), /范围/u);
});

test("Skill 正文按需读取；项目 Skill 风险仍由项目 Owner 决定", async () => {
  const { skillTools } = await import("lfaa-tool-skill");
  const context = { userId: owner, applicationId: "workspace", signal: new AbortController().signal };
  const list = await skillTools[0].execute(skillTools[0].parse({ source: "writing" }), context);
  assert.ok(list.skills.length); assert.equal(list.skills[0].instructions, undefined);
  const body = await skillTools[1].execute(skillTools[1].parse({ source: "writing", name: list.skills[0].id }), context);
  assert.ok(body.instructions);
  assert.throws(() => skillTools[1].parse({ source: "project", path: "../../secret" }));
  assert.equal(skillTools[1].parse({ source: "project", path: ".agents\\skills\\example\\SKILL.md" }).path, ".agents/skills/example/SKILL.md");
  const parameters = skillTools[1].prepare(skillTools[1].parse({ source: "project", path: ".agents/skills/example/SKILL.md" }), { userId: owner, workspaceProject: { nodeId: randomUUID(), path: "H:/fixture-project", title: "fixture" } });
  assert.equal(skillTools[1].risk(parameters), "dangerous", "未设置为默认任务目录的项目读取保持原审批");
});

test("模型思考期间撤销能力，返回的旧调用不再派发", async () => {
  settings.saveUserSettings(owner, "permissions", { mode: "full_access" });
  settings.saveUserSettings(owner, "computer-control", { enabled: true });
  const turn = sessions.createAiTurn(owner, "workspace", null, "fixture revoke");
  const native = globalThis.fetch, before = executions;
  let attempts = 0;
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    if (++attempts === 1) {
      assert.ok(body.tools.some(tool => tool.function.name === "fixture_computer"));
      settings.saveUserSettings(owner, "computer-control", { enabled: false });
      return sse(call("fixture_computer", {}));
    }
    assert.ok(!body.tools.some(tool => tool.function.name === "fixture_computer"));
    assert.match(body.messages.find(row => row.role === "tool").content, /未派发/u);
    return sse({ content: "尊重能力撤销" });
  };
  try {
    await executeAiTurn({ userId: owner, userRole: "admin", body: { appId: "workspace", sessionId: turn.session.id, content: "fixture" }, turn, aiPluginHost: host, abortController: new AbortController(), emit() {}, modelResolver, approvalNotifications: ctx.lfaaUserApproval });
    assert.equal(executions, before);
  } finally { globalThis.fetch = native; }
});
