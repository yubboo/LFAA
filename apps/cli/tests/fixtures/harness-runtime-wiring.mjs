/** 功能：完整 Profile 的隔离执行夹具；仅由 harness-runtime-wiring.test.mjs 启动。 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";

const reservation = createServer(); reservation.listen(0, "127.0.0.1"); await once(reservation, "listening");
process.env.SERVER_PORT = String(reservation.address().port); await new Promise(resolve => reservation.close(resolve));
const { boot } = await import("lfaa-app-boot/src/index.js");
const ctx = await boot(["--profile", "web"]);
const { database, migrateHostTaskTimeoutSchema } = await import("lfaa-storage-sqlite/src/database.js");
const { configuration } = await import("lfaa-storage-domain/src/configuration.js");
const { sessionRecords } = await import("lfaa-session-persistence-jsonl/src/repository.js");
const settings = await import("lfaa-settings/src/service.js");
const sessions = await import("lfaa-session/src/sessions.js");
const runs = await import("lfaa-agent-loop/src/runs.js");
const { executeAiTurn } = await import("lfaa-agent-loop/src/execute-turn.js");
const { createAiPluginHost } = await import("lfaa-app-boot/src/ai-host.js");
const host = createAiPluginHost(ctx);
const owner = randomUUID(), other = randomUUID();
for (const [id, uid] of [[owner, 1], [other, 2]]) database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role) VALUES(?,?,?,'fixture','fixture','admin')").run(id, uid, `fixture-${uid}`);
const nativeFetch = globalThis.fetch;
const sse = delta => new Response(`data: ${JSON.stringify({ choices: [{ delta }], usage: { prompt_tokens: 1, completion_tokens: 1 } })}\n\ndata: [DONE]\n\n`, { headers: { "Content-Type": "text/event-stream" } });
let callId = 0;
const call = (name, args) => sse({ tool_calls: [{ index: 0, id: `fixture-${++callId}`, type: "function", function: { name, arguments: JSON.stringify(args) } }] });
let respond = () => sse({ content: "fixture complete" });
globalThis.fetch = async (url, options) => String(url).endsWith("/models") ? Response.json({ data: [{ id: "fixture-parent", context_window: 1_000_000, max_output_tokens: 262_144 }, { id: "fixture-child", context_window: 1_000_000 }] }) : respond(JSON.parse(options.body));
const account = await settings.saveAiAccount(owner, { providerId: "openai", secret: "fixture-invalid-key", options: {}, displayName: "parent", modelId: "fixture-parent", reasoningMode: "default" });
const childAccount = await settings.saveAiAccount(owner, { providerId: "openai", secret: "fixture-invalid-child", options: {}, displayName: "child", modelId: "fixture-child", reasoningMode: "default" });
settings.activateAiAccount(owner, account.id);
settings.saveUserSettings(owner, "permissions", { mode: "full_access" });
configuration.save("user_settings", { user_id: owner, category: "ai-runtime", value_json: JSON.stringify({ ...settings.defaultSettings.aiRuntime, speed: "balanced", maxOutputTokens: 2048, maxModelRequests: 12, maxToolCalls: 24 }) });
configuration.save("user_settings", { user_id: other, category: "ai-runtime", value_json: JSON.stringify({ ...settings.defaultSettings.aiRuntime, maxOutputTokens: 4096, maxModelRequests: 12, maxToolCalls: 24 }) });
settings.migrateLegacyAiRuntimeDefaults();
assert.deepEqual(
  (({ maxOutputTokens, maxModelRequests, maxToolCalls }) => ({ maxOutputTokens, maxModelRequests, maxToolCalls }))(settings.getUserSettings(owner).aiRuntime),
  { maxOutputTokens: 0, maxModelRequests: 0, maxToolCalls: 0 },
  "完整匹配旧默认预算的账户只迁移一次"
);
assert.equal(settings.getUserSettings(other).aiRuntime.maxOutputTokens, 4096, "自定义输出长度必须保留");
settings.saveUserSettings(owner, "ai-runtime", { ...settings.getUserSettings(owner).aiRuntime, maxModelRequests: 37 });
settings.migrateLegacyAiRuntimeDefaults();
assert.equal(settings.getUserSettings(owner).aiRuntime.maxModelRequests, 37, "迁移标记不得覆盖用户之后保存的预算");
settings.saveUserSettings(owner, "ai-runtime", { ...settings.defaultSettings.aiRuntime, requestRetries: 0, contextWindowTokens: 4096 });
console.log("verified:settings-migration");
const tools = () => ctx.lfaaTools.listAiBusinessTools("workspace", "admin", null, "full_access", true);
const tool = name => { const found = tools().find(item => item.name === name); assert.ok(found, name); return found; };
  const { APPLICATION_IDS } = await import("lfaa-util-values/src/application-id.js");
  for (const applicationId of APPLICATION_IDS) {
    assert.ok(ctx.lfaaTools.listAiBusinessTools(applicationId, "admin", null, "full_access", true).some(item => item.name === "lfaa_delete_file"), `跨 App 删除工具：${applicationId}`);
  }
const waitFor = async fn => { const until = Date.now() + 30000; while (Date.now() < until) { const value = fn(); if (value) return value; await new Promise(resolve => setTimeout(resolve, 20)); } throw new Error("fixture timeout"); };
const finish = id => waitFor(() => { const run = runs.getAiRun(owner, id); return run && ["complete", "error", "interrupted"].includes(run.status) ? run : null; });
const execute = async (content, overrides = {}) => {
  const turn = overrides.turn ?? sessions.createAiTurn(owner, "workspace", null, content);
  const events = [];
  await executeAiTurn({ userId: owner, userRole: "admin", body: { appId: "workspace", sessionId: turn.session.id, content }, turn, aiPluginHost: host, abortController: new AbortController(), emit(event, data) { events.push({ event, data }); }, modelResolver: ctx.lfaaAgentDefaultModel, approvalNotifications: ctx.lfaaUserApproval, ...overrides });
  return { turn, run: sessions.getAiRun(owner, turn.assistantMessage.id), events };
};
try {
  let observedOutputRequest;
  respond = body => { observedOutputRequest = body; return sse({ content: "model-sized output fixture" }); };
  const modelDefaultOutput = await execute("follow model output capability");
  assert.equal(modelDefaultOutput.run.status, "complete");
  assert.equal(observedOutputRequest.max_completion_tokens, 262_144, "自动默认采用模型目录输出上限，不把 1m 上下文误当成输出上限");
  settings.activateAiAccount(owner, childAccount.id);
  await execute("follow provider default when output capability is unknown");
  assert.equal(Object.hasOwn(observedOutputRequest, "max_completion_tokens"), false, "目录未报告输出能力时遵循 Provider 默认，不猜固定值");
  settings.saveUserSettings(owner, "ai-runtime", { ...settings.getUserSettings(owner).aiRuntime, maxOutputTokens: 1_000_000 });
  await execute("allow a 1m explicit output preference without model metadata");
  assert.equal(observedOutputRequest.max_completion_tokens, 1_000_000, "用户可以设置超过旧 16384 固定上限的数值");
  settings.saveUserSettings(owner, "ai-runtime", { ...settings.getUserSettings(owner).aiRuntime, speed: "deep", maxOutputTokens: 1024 });
  await execute("preserve explicit maximum under deep strategy");
  assert.equal(observedOutputRequest.max_completion_tokens, 1024, "深入策略不能越过用户显式输出上限");
  settings.saveUserSettings(owner, "ai-runtime", { ...settings.getUserSettings(owner).aiRuntime, speed: "balanced", maxOutputTokens: 1_000_000 });
  settings.activateAiAccount(owner, account.id);
  await execute("clamp a custom value to the verified model maximum");
  assert.equal(observedOutputRequest.max_completion_tokens, 262_144, "自定义值仍受真实模型输出能力约束");
  settings.saveUserSettings(owner, "ai-runtime", { ...settings.defaultSettings.aiRuntime, requestRetries: 0, contextWindowTokens: 4096 });
  console.log("verified:model-output-capability");
  // Skill 配置 -> 首个 Provider 请求 -> 模型按需发现目录 -> 按需加载正文；账户目录缓存不能串用。
  const skillRoot = join(process.env.LFAA_DATA_DIR, "fixture-skills"), skillDir = join(skillRoot, "runtime-fixture");
  await mkdir(skillDir, { recursive: true });
  await writeFile(join(skillDir, "SKILL.md"), "---\nname: runtime-fixture\ndescription: 运行链路专用隔离方法\n---\nBODY-ONLY-AFTER-LOAD\n");
  settings.saveUserSettings(owner, "plugins", { enabled: true, mcpServers: [], skillDirectories: [skillRoot] });
  let step = 0;
  respond = body => {
    const text = JSON.stringify(body.messages);
    if (step++ === 0) {
      assert.doesNotMatch(text, /runtime-fixture|BODY-ONLY-AFTER-LOAD/u, "目录发现不能成为首次模型请求的同步前置条件");
      assert.ok(body.tools.some(item => item.function.name === "lfaa_skill_list"));
      assert.ok(body.tools.some(item => item.function.name === "lfaa_skill_load"));
      return call("lfaa_skill_list", { source: "registry" });
    }
    if (step === 2) { assert.match(text, /runtime-fixture/u); assert.doesNotMatch(text, /BODY-ONLY-AFTER-LOAD/u); return call("lfaa_skill_load", { source: "registry", name: "runtime-fixture" }); }
    assert.match(text, /BODY-ONLY-AFTER-LOAD/u); return sse({ content: "skill loaded" });
  };
  const skillAnswer = await execute("use fixture skill");
  assert.equal(skillAnswer.run.status, "complete");
  assert.equal(skillAnswer.run.message.content, "skill loaded", "Provider 最终文字必须进入助手消息");
  assert.equal((await ctx.skills.list({ userId: other, customSkillDirs: [], allowHostFilesystem: true })).some(item => item.name === "runtime-fixture"), false);
  settings.saveUserSettings(owner, "plugins", { ...settings.getUserSettings(owner).plugins, disabledSkillNames: ["runtime-fixture", "outline-planning"] });
  let disabledStep = 0;
  respond = body => {
    const text = JSON.stringify(body.messages);
    if (disabledStep++ === 0) return call("lfaa_skill_list", { source: "registry" });
    assert.doesNotMatch(text, /runtime-fixture|outline-planning|BODY-ONLY-AFTER-LOAD/u, "UI 登记的 skillId 与 Registry 规范名相同，已停用 Skill 不再出现在模型目录中");
    return sse({ content: "disabled skill hidden" });
  };
  assert.equal((await execute("check available skills")).run.status, "complete");
  disabledStep = 0;
  respond = body => {
    const text = JSON.stringify(body.messages);
    if (disabledStep++ === 0) return call("lfaa_skill_load", { source: "registry", name: "runtime-fixture" });
    assert.match(text, /当前账户可见目录没有该 Skill/u, "已停用 Skill 的正文加载会被拒绝");
    assert.doesNotMatch(text, /BODY-ONLY-AFTER-LOAD/u);
    return sse({ content: "disabled skill blocked" });
  };
  assert.equal((await execute("check disabled skill load")).run.status, "complete");
  const { apply: registerSkillTools } = await import("lfaa-tool-skill/src/index.js");
  const capturedSkillTools = [];
  registerSkillTools({ skills: { registerProvider() {} }, get() { return undefined; }, lfaaTools: { registerTool(_context, registeredTool) { capturedSkillTools.push(registeredTool); } } });
  const writingSkillTool = capturedSkillTools.find(item => item.name === "writing_load_skill");
  assert.ok(writingSkillTool, "Writing Skill 工具已登记");
  await assert.rejects(
    () => writingSkillTool.execute({ skillId: "outline-planning" }, { userId: owner, signal: new AbortController().signal }),
    /该 Skill 已在设置中心停用/u,
    "专用 Writing Skill 加载也遵循逐项停用"
  );
  settings.saveUserSettings(owner, "plugins", { enabled: true, mcpServers: [] });
  assert.deepEqual(settings.getUserSettings(owner).plugins.skillDirectories, [skillRoot], "旧客户端保存不能擦除新目录设置");
  assert.deepEqual(settings.getUserSettings(owner).plugins.disabledSkillNames, ["runtime-fixture", "outline-planning"], "旧客户端保存不能擦除逐项 Skill 停用设置");
  console.log("verified:skill");

  // 未被模型选择的目录摘要不得拖住普通回答；无 Provider 前置异常时应保留准确活动诊断。
  const originalSkillList = host.listSkills;
  host.listSkills = async () => { throw new Error("fixture optional skill listing failure"); };
  respond = () => sse({ content: "answer despite optional skill failure" });
  const ordinaryAnswer = await execute("ordinary answer without skill lookup");
  assert.equal(ordinaryAnswer.run.status, "complete");
  assert.equal(ordinaryAnswer.run.message.content, "answer despite optional skill failure");
  host.listSkills = originalSkillList;
  const originalHookList = host.listHooks;
  host.listHooks = () => { throw new Error("fixture optional hook registry failure"); };
  respond = () => sse({ content: "answer despite optional hook failure" });
  const hookFallback = await execute("ordinary answer without hook registry");
  assert.equal(hookFallback.run.status, "complete");
  assert.equal(hookFallback.run.message.content, "answer despite optional hook failure");
  assert.ok(hookFallback.run.message.activity.some(item => item.title === "推理前钩子不可用" && item.status === "unavailable"));
  host.listHooks = originalHookList;
  const originalAfterHook = host.runAfterInference;
  host.runAfterInference = () => { throw new Error("fixture optional after-hook failure"); };
  respond = () => sse({ content: "answer survives after-hook failure" });
  const afterHookFallback = await execute("ordinary answer without after-hook");
  assert.equal(afterHookFallback.run.status, "complete");
  assert.equal(afterHookFallback.run.message.content, "answer survives after-hook failure");
  assert.ok(afterHookFallback.run.message.activity.some(item => item.title === "推理后钩子不可用" && item.status === "unavailable"));
  host.runAfterInference = originalAfterHook;
  const originalInstructions = host.getSystemInstructions;
  host.getSystemInstructions = () => { throw new Error("fixture preflight diagnostic"); };
  const preflightFailure = await execute("preflight diagnostic fixture");
  assert.equal(preflightFailure.run.status, "error");
  assert.ok(preflightFailure.run.message.activity.some(item => item.title === "模型请求尚未发出" && item.detail.includes("fixture preflight diagnostic")));
  assert.match(preflightFailure.run.message.content, /本轮未能生成完整答复/u, "失败也必须写入可见的助手最终消息");
  host.getSystemInstructions = originalInstructions;
  console.log("verified:preflight-recovery");

  // Provider delta 经 Agent Run 事件订阅逐段交付，最终正文同时落入助手消息。
  respond = () => sse({ content: "streamed answer fixture" });
  const streamed = runs.startAiRun(owner, "admin", { appId: "workspace", sessionId: null, content: "stream fixture" }, host);
  const streamedDeltas = [];
  const unsubscribeStream = runs.subscribeAiRun(owner, streamed.id, (event, data) => { if (event === "delta") streamedDeltas.push(data.delta); });
  const streamedFinished = await finish(streamed.id);
  unsubscribeStream();
  assert.equal(streamedFinished.status, "complete");
  assert.deepEqual(streamedDeltas, ["streamed answer fixture"], "Provider 正文应作为 Agent Run delta 流交付");
  assert.equal(streamedFinished.message.content, "streamed answer fixture");
  console.log("verified:reply-stream");

  const { createWorkspaceProject } = await import("lfaa-workspace-workspace/src/index.js");
  const { recordDaemonHeartbeat: registerProjectNode } = await import("lfaa-host-daemon/src/local-daemon.js");
  const registeredNodeId = randomUUID();
  registerProjectNode({ id: registeredNodeId, displayName: "isolated project node", platform: process.platform, architecture: "x64", version: "fixture", dataRoot: process.env.LFAA_DATA_DIR, capabilities: ["project-files-v1"], javaRuntimes: [] });
  const project = createWorkspaceProject({ userId: owner, appId: "workspace", nodeId: registeredNodeId, path: join(process.env.LFAA_DATA_DIR, "project"), platform: process.platform, title: "isolated project" });
  let fixtureScopeExecutions = 0;
  ctx.lfaaTools.registerTool(ctx, { id: "fixture.probe", name: "fixture_scope_probe", coreManaged: true, applicationIds: ["workspace"], description: "scope fixture", schema: { type: "object", properties: {} }, parse: () => ({}), risk: () => "read", approval: () => ({ scopeKey: "fixture", scopeSummary: "fixture", summary: "fixture" }), async execute(_parameters, context) { fixtureScopeExecutions++; assert.equal(context.workspaceProject.path, project.path); return { inherited: true }; } });

  // Provider 明确截断时不得以相同参数重试；预算到顶时不派发工具并把失败写入最终消息。
  settings.saveUserSettings(owner, "ai-runtime", { ...settings.getUserSettings(owner).aiRuntime, requestRetries: 1, maxModelRequests: 0, maxToolCalls: 0 });
  let truncatedRequests = 0;
  respond = () => {
    truncatedRequests++;
    return new Response([
      `data: ${JSON.stringify({ choices: [{ delta: { content: "partial response" }, finish_reason: null }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "length" }], usage: { prompt_tokens: 8, completion_tokens: 2048 } })}\n\n`,
      "data: [DONE]\n\n"
    ].join(""), { headers: { "Content-Type": "text/event-stream" } });
  };
  const truncated = await execute("truncated response fixture");
  assert.equal(truncatedRequests, 1, "finish_reason=length 不得重试相同输出上限");
  assert.equal(truncated.run.status, "error");
  assert.match(truncated.run.message.content, /partial response[\s\S]*本轮未完成[\s\S]*输出 token 上限/u);
  assert.ok(truncated.events.some(item => item.event === "delta" && String(item.data.delta).includes("本轮未完成")), "失败说明也应通过当前 Agent Run 流发送给客户端");
  assert.ok(truncated.events.some(item => item.event === "done" && item.data.status === "error"));
  settings.saveUserSettings(owner, "ai-runtime", { ...settings.getUserSettings(owner).aiRuntime, maxModelRequests: 1 });
  let budgetRequests = 0;
  respond = () => { budgetRequests++; return call("fixture_scope_probe", {}); };
  const budgetTurn = sessions.createAiTurn(owner, "workspace", null, "budget fixture", false, project);
  const executionsBeforeBudget = fixtureScopeExecutions;
  const exhausted = await execute("budget fixture", { turn: budgetTurn, allowedToolNames: ["fixture_scope_probe"] });
  assert.equal(budgetRequests, 1);
  assert.equal(fixtureScopeExecutions, executionsBeforeBudget, "请求预算耗尽时工具必须保持未派发");
  assert.equal(exhausted.run.status, "error");
  assert.match(exhausted.run.message.content, /本轮未完成[\s\S]*模型请求预算[\s\S]*尚未派发/u);
  settings.saveUserSettings(owner, "ai-runtime", { ...settings.getUserSettings(owner).aiRuntime, maxModelRequests: 0 });
  console.log("verified:response-failures");

  // 新委派工具必须继承原 Run 的模型、范围、项目、深度与共享预算。
  settings.saveUserSettings(owner, "ai-runtime", { ...settings.getUserSettings(owner).aiRuntime, maxDelegationDepth: 1 });
  let childRequests = 0;
  respond = body => {
    const results = body.messages.filter(message => message.role === "tool");
    if (body.model === "fixture-child") {
      childRequests++;
      assert.deepEqual(body.tools.map(item => item.function.name).sort(), ["fixture_scope_probe", "lfaa_delegate_subagent"].sort());
      if (!results.length) return call("fixture_scope_probe", {});
      if (results.length === 1) return call("lfaa_delegate_subagent", { description: "too deep", prompt: "nested fixture" });
      assert.match(results.at(-1).content, /深度限制/u);
      return sse({ content: "child inherited scope" });
    }
    if (!results.length) return call("lfaa_delegate_subagent", { description: "child fixture", prompt: "child fixture", model: childAccount.id });
    assert.match(results.at(-1).content, /child inherited scope/u);
    return sse({ content: "parent complete" });
  };
  const parent = runs.startAiRun(owner, "admin", { appId: "workspace", sessionId: null, content: "parent fixture" }, host, { workspaceProject: project, allowedToolNames: ["lfaa_delegate_subagent", "fixture_scope_probe"] });
  const parentResult = await finish(parent.id);
  assert.equal(parentResult.status, "complete", JSON.stringify(parentResult.message)); assert.equal(childRequests, 3);
  const { SubagentManager } = await import("lfaa-subagent/src/manager.js");
  const manager = new SubagentManager();
  manager.registerDriver({ name: "fixture", displayName: "fixture", async run() { return { runId: "fixture", stopReason: "completed", answer: "done" }; } });
  for (let i = 0; i < 70; i++) await manager.start({ driver: "fixture", description: "fixture", prompt: "fixture", appId: "workspace" }, { userId: owner, userRole: "admin", signal: new AbortController().signal, onProgress() {} }).done;
  assert.ok(manager.listRuns(owner).length <= 32); manager.close();
  console.log("verified:subagent");

  // 专家由模型显式选择，跨界面复用真实子 Run；角色正文只进入该子任务。
  let expertChildRequests = 0;
  respond = body => {
    const results = body.messages.filter(message => message.role === "tool");
    const task = body.messages.find(message => message.role === "user")?.content;
    if (task === "explicit minecraft expert task") {
      expertChildRequests++;
      assert.match(body.messages.find(message => message.role === "system").content, /你是 LFAA Minecraft 领域顾问/u);
      assert.equal(body.tools, undefined, "专家方法不能扩大明确为空的继承工具范围");
      return sse({ content: "selected expert evidence" });
    }
    assert.doesNotMatch(body.messages.find(message => message.role === "system").content, /你是 LFAA Minecraft 领域顾问/u);
    if (!results.length) return call("delegate_domain_expert", { task: "explicit minecraft expert task", expertId: "expert.minecraft-hosting", toolNames: [] });
    assert.match(results.at(-1).content, /selected expert evidence/u);
    return sse({ content: "explicit expert complete" });
  };
  const selectedExpert = runs.startAiRun(owner, "admin", { appId: "workspace", sessionId: null, content: "select a minecraft expert" }, host, { allowedToolNames: ["delegate_domain_expert"] });
  const selectedExpertResult = await finish(selectedExpert.id);
  assert.equal(selectedExpertResult.status, "complete", JSON.stringify(selectedExpertResult));
  assert.equal(expertChildRequests, 1);
  console.log("verified:lazy-expert");

  // 自动摘要请求也走同一请求计数；压缩后本轮的新消息不能因旧索引丢失。
  const storedParent = configuration.get("ai_accounts", row => row.id === account.id);
  const compactionCatalog = JSON.parse(storedParent.models_json).map(model => model.id === account.modelId ? { ...model, contextWindow: 4096 } : model);
  configuration.update("ai_accounts", row => row.id === account.id, { models_json: JSON.stringify(compactionCatalog) });
  const history = [];
  for (let i = 0; i < 12; i++) history.push({ role: "user", content: `past ${i} ` + "早期事实".repeat(1000) }, { role: "assistant", content: "prior answer" });
  history.push({ role: "user", content: "current task" });
  let summaries = 0, normal = 0;
  respond = body => {
    if (JSON.stringify(body.messages).includes("你是会话压缩器")) { summaries++; assert.equal(body.tools, undefined); return sse({ content: "早期任务已完成，继续当前目标。" }); }
    normal++; assert.ok(JSON.stringify(body.messages).length < JSON.stringify(history).length);
    return sse({ content: "compacted final answer" });
  };
  const compactTurn = sessions.createAiTurn(owner, "workspace", null, "current task"); compactTurn.history = history;
  const compacted = await execute("current task", { turn: compactTurn });
  assert.equal(compacted.run.status, "complete", JSON.stringify(compacted.run.message)); assert.equal(summaries, 1); assert.equal(normal, 1);
  const persisted = sessionRecords.allForSession("ai_messages", compactTurn.session.id);
  assert.match(JSON.stringify(persisted), /compacted final answer/u);
  const { manageContextBeforeRequest } = await import("lfaa-agent-loop/src/runtime-context.js");
  const unchanged = await manageContextBeforeRequest({ messages: history, contextWindow: 4096, hooks: { compact: async input => input.messages } });
  assert.equal(unchanged.rewritten, false);
  const { selectCompactableRange } = await import("lfaa-compaction-basic/src/region.js");
  const { toolPairingBalancedBefore } = await import("lfaa-compaction/src/tool-pairing.js");
  const longTask = [{ role: "user", content: "one long task" }];
  for (let i = 0; i < 15; i++) longTask.push({ role: "assistant", content: null, tool_calls: [{ id: String(i), type: "function", function: { name: "probe", arguments: "{}" } }] }, { role: "tool", tool_call_id: String(i), content: "result" });
  const range = selectCompactableRange(longTask, 8);
  assert.ok(range && range.end > range.start);
  assert.ok(toolPairingBalancedBefore(longTask, range.start)); assert.ok(toolPairingBalancedBefore(longTask, range.end));
  // 0 表示不限次数，执行 14 次真实循环请求不能被旧 12 次上限截断。
  let repeated = 0;
  respond = () => ++repeated <= 13 ? call("fixture_scope_probe", {}) : sse({ content: "unlimited loop finished" });
  const unlimited = runs.startAiRun(owner, "admin", { appId: "workspace", sessionId: null, content: "loop fixture" }, host, { workspaceProject: project, allowedToolNames: ["fixture_scope_probe"] });
  assert.equal((await finish(unlimited.id)).status, "complete"); assert.equal(repeated, 14);
  console.log("verified:compaction");

  // 通用文件工具经真实节点队列调用同一 Daemon 执行器，不能读控制端同名相对文件。
  const nodeId = randomUUID(), root = join(process.env.LFAA_DATA_DIR, "fixture-node-project"); await mkdir(root);
  const { recordDaemonHeartbeat } = await import("lfaa-host-daemon/src/local-daemon.js");
  recordDaemonHeartbeat({ id: nodeId, displayName: "fixture", platform: process.platform, architecture: "x64", version: "fixture", dataRoot: "", capabilities: ["project-files-v1"], javaRuntimes: [] });
  const tasks = await import("lfaa-jobs/src/ai-host-tasks.js");
  const { executeProjectFile } = await import("../../../../packages/host/daemon/src/project-files.mjs");
  const fileContext = { userId: owner, userRole: "admin", applicationId: "workspace", agentRunId: randomUUID(), signal: new AbortController().signal, onProgress() {}, workspaceProject: { id: randomUUID(), appId: "workspace", nodeId, path: root, title: "fixture" } };
  const fileCall = async (name, args) => {
    const current = tool(name), parsed = current.prepare(current.parse(args), fileContext);
    const pending = current.execute(parsed, fileContext), queued = tasks.claimNextAiHostTask(nodeId); assert.ok(queued);
    let result;
    try { result = { stdout: JSON.stringify(await executeProjectFile(JSON.parse(queued.command))), stderr: "", exitCode: 0, timedOut: false, outputTruncated: false }; }
    catch (error) { result = { stdout: "", stderr: error.message, exitCode: 1, timedOut: false, outputTruncated: false }; }
    tasks.completeAiHostTask({ taskId: queued.id, nodeId, succeeded: result.exitCode === 0, message: "fixture receipt", result });
    return pending;
  };
  await fileCall("lfaa_write_file", { path: "fixture.txt", content: "first\nsecond\n" });
  const read = await fileCall("lfaa_read_file", { path: "fixture.txt", offset: 2, limit: 1 }); assert.match(read.result.content, /second/u);
  await assert.rejects(fileCall("lfaa_str_replace", { path: "fixture.txt", old_string: "second", new_string: "changed" }), /sha256|摘要/u);
  await fileCall("lfaa_str_replace", { path: "fixture.txt", old_string: "second", new_string: "changed", sha256: read.result.sha256 });
  assert.match(await readFile(join(root, "fixture.txt"), "utf8"), /changed/u);
  const found = await fileCall("lfaa_search_files", { pattern: "*.txt" }); assert.match(JSON.stringify(found), /fixture.txt/u);
  await assert.rejects(fileCall("lfaa_read_file", { path: "../secret.txt" }), /根目录/u);
  await fileCall("lfaa_write_file", { path: "agent-delete.txt", content: "由工具创建后再删除" });
  let deleteRequests = 0;
  respond = body => {
    if (deleteRequests++ === 0) {
      assert.ok(body.tools.some(item => item.function.name === "lfaa_delete_file"));
      return call("lfaa_delete_file", { path: "agent-delete.txt" });
    }
    const deleteResult = body.messages.filter(item => item.role === "tool").at(-1)?.content ?? "";
    assert.match(deleteResult, /deleted[\s\S]*true/u, "Daemon 删除回执应进入下一次模型请求");
    return sse({ content: "已删除目标文件。" });
  };
  const deleteTurn = sessions.createAiTurn(owner, "workspace", null, "删除 agent-delete.txt", false, fileContext.workspaceProject);
  const deleteResponse = execute("删除 agent-delete.txt", { turn: deleteTurn, allowedToolNames: ["lfaa_delete_file"] });
  const queuedDelete = await waitFor(() => tasks.claimNextAiHostTask(nodeId));
  const deleted = await executeProjectFile(JSON.parse(queuedDelete.command));
  tasks.completeAiHostTask({ taskId: queuedDelete.id, nodeId, succeeded: true, message: "fixture delete receipt", result: { stdout: JSON.stringify(deleted), stderr: "", exitCode: 0, timedOut: false, outputTruncated: false } });
  const deletedAnswer = await deleteResponse;
  assert.equal(deletedAnswer.run.status, "complete", JSON.stringify(deletedAnswer.run));
  assert.equal(deletedAnswer.run.message.content, "已删除目标文件。", "模型最终文字应保存为助手回答");
  await assert.rejects(readFile(join(root, "agent-delete.txt")), { code: "ENOENT" });
  const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1cAAAAASUVORK5CYII=";
  await writeFile(join(root, "pixel.png"), Buffer.from(png, "base64"));
  let imageRequests = 0;
  respond = body => {
    if (++imageRequests === 1) return call("lfaa_read_image", { path: "pixel.png" });
    assert.match(JSON.stringify(body.messages), /data:image\/png;base64/u);
    return sse({ content: "image forwarded" });
  };
  const imageTurn = sessions.createAiTurn(owner, "workspace", null, "image fixture", false, fileContext.workspaceProject);
  const imageRun = execute("image fixture", { turn: imageTurn, allowedToolNames: ["lfaa_read_image"] });
  const queuedImage = await waitFor(() => tasks.claimNextAiHostTask(nodeId));
  const imageResult = await executeProjectFile(JSON.parse(queuedImage.command));
  tasks.completeAiHostTask({ taskId: queuedImage.id, nodeId, succeeded: true, message: "image fixture", result: { stdout: JSON.stringify(imageResult), stderr: "", exitCode: 0, timedOut: false, outputTruncated: false } });
  const imageFinished = await imageRun;
  assert.equal(imageFinished.run.status, "complete", JSON.stringify(imageFinished.run)); assert.equal(imageRequests, 2);
  assert.doesNotMatch(JSON.stringify(sessionRecords.allForSession("ai_messages", imageTurn.session.id)), /data:image|iVBORw0KGgo/u);
  console.log("verified:files");

  // 到点创建真实 Run，交付历史保存 Run ID；缺少消费者必须失败。
  const { listDeliveries } = await import("lfaa-schedule/src/delivery-history.js");
  const { createDefaultFireHandler } = await import("lfaa-schedule/src/client.js");
  const source = sessions.createAiTurn(owner, "workspace", null, "schedule source");
  sessions.finishAiAssistantMessage(owner, source.session.id, source.assistantMessage.id, "schedule set", "complete");
  let scheduledRequests = 0;
  respond = body => { scheduledRequests++; assert.equal(body.tools.length, 1); return sse({ content: "scheduled real run" }); };
  const scheduled = await tool("schedule_create").execute({ title: "fixture", prompt: "scheduled fixture prompt", after_seconds: 1 }, { ...fileContext, sessionId: source.session.id, allowedToolNames: ["fixture_scope_probe"] });
  assert.equal(scheduled.isError, undefined, JSON.stringify(scheduled));
  const receipt = await waitFor(() => listDeliveries(scheduled.id)[0]);
  assert.equal(receipt.status, "success", JSON.stringify(receipt));
  assert.ok(receipt.messageId); const scheduledRun = await finish(receipt.messageId); assert.equal(scheduledRun.status, "complete", JSON.stringify(scheduledRun)); assert.equal(scheduledRequests, 1);
  await assert.rejects(createDefaultFireHandler(ctx)({ id: scheduled.id, ownerId: owner }), /没有交付/u);
  console.log("verified:schedule");

  // 三种权限对同一写作应用动作一致生效；不会被额外的界面应用门槛挡住。
  const writing = await import("lfaa-document-writing/src/service.js");
  const permissions = await import("lfaa-permission-presets/src/permissions.js");
  const book = writing.createWritingBook(owner, "fixture book"), bookId = book.activeBookId;
  const { listAiBusinessTools } = await import("lfaa-tools/src/business-tools.js");
  const apply = listAiBusinessTools("writing", "admin", { bookId, chapterId: null }, "full_access").find(item => item.name === "writing_apply_edit_proposal");
  const proposal = writing.createWritingEditProposal(owner, bookId, "outline", bookId, { operation: "append", content: "saved by unified permission" });
  const prepared = apply.prepare(apply.parse({ proposalId: proposal.id }), { userId: owner });
  const scopeKey = apply.approval(prepared, { userId: owner, applicationId: "writing" }).scopeKey;
  const policy = { userId: owner, activeApplicationId: "writing", toolApplicationIds: ["writing"], toolId: apply.id, toolVersion: "1.0.0", risk: "write", scopeKey, executable: true };
  const writingTurn = sessions.createAiTurn(owner, "writing", null, "save fixture");
  settings.saveUserSettings(owner, "permissions", { mode: "ask" }); assert.equal(permissions.authorizeAiTool(policy), "approval_required");
  settings.saveUserSettings(owner, "permissions", { mode: "approve_remembered" });
  for (let i = 0; i < 2; i++) { const approval = permissions.requestAiToolApproval({ ...policy, sessionId: writingTurn.session.id, appId: "writing", summary: "fixture", scopeSummary: "fixture", parameters: prepared }); permissions.decideAiToolApproval(owner, approval.id, "approved"); }
  assert.equal(permissions.authorizeAiTool(policy), "allow");
  settings.saveUserSettings(owner, "permissions", { mode: "full_access" }); assert.equal(permissions.authorizeAiTool(policy), "allow");
  assert.equal((await apply.execute(prepared, { userId: owner })).status, "applied");
  assert.throws(() => apply.prepare({ proposalId: proposal.id }, { userId: other }), /当前作品/u);
  const { composeLfaaSystemPrompt } = await import("lfaa-system-prompt");
  const prompt = composeLfaaSystemPrompt({ applicationId: "minecraft", permissionMode: "full_access", extensions: [] });
  assert.doesNotMatch(prompt, /任何.*权限模式都不能代替|EULA 是独立|不能用控制台指令代替/u);
  console.log("verified:permissions");

  // 聊天模型通过独立 Workflow 工具包发现、保存并启动真实工作流；节点再通过 Minecraft Owner 的只读工具运行。
  const workflowToolNames = new Set(tools().map(item => item.name));
  for (const name of ["lfaa_workflow_catalog", "lfaa_workflow_save", "lfaa_workflow_run", "lfaa_workflow_get_run", "lfaa_workflow_cancel_run"]) assert.ok(workflowToolNames.has(name), `Workflow 工具未注册：${name}`);
  const workflowOwner = await import("lfaa-workflow/src/service.js");
  assert.deepEqual(workflowOwner.listWorkflowSummaries(other, "minecraft"), [], "工作流列表按账户隔离");
  let workflowPhase = 0, workflowDefinition, childToolResult, childOfferedTool = false, workflowResult, workflowFixtureError;
  respond = body => {
    try {
      const messages = body.messages;
      const childNode = JSON.stringify(messages).includes("工作流节点：Harness 自动化回归节点");
      const toolResults = messages.filter(message => message.role === "tool");
      if (childNode) {
        childOfferedTool ||= body.tools.some(item => item.function.name === "minecraft_list_nodes");
        if (!toolResults.length) return call("minecraft_list_nodes", {});
        childToolResult = JSON.parse(toolResults.at(-1).content);
        return sse({ content: "子 Agent 已依据实际 Minecraft 节点查询结果完成本节点。" });
      }
      if (workflowPhase === 0) { workflowPhase++; return call("lfaa_workflow_catalog", {}); }
      if (workflowPhase === 1) {
        const catalog = JSON.parse(toolResults.at(-1).content);
        if (!catalog.nodes.some(node => node.type === "minecraft.agent") || !catalog.engines.some(engine => engine.id === "lfaa.workflow.dag-sequential")) throw new Error("工作流目录缺少已登记的 Minecraft Agent 节点或 DAG 引擎。");
        workflowPhase++;
        return call("lfaa_workflow_save", {
          title: "Harness 自动化回归工作流",
          nodes: [{ id: "harness-agent", type: "minecraft.agent", version: 1, title: "Harness 自动化回归节点", data: { prompt: "读取当前 Minecraft 节点列表并总结真实结果。", toolNames: ["minecraft_list_nodes"] }, x: 0, y: 0 }],
          edges: []
        });
      }
      if (workflowPhase === 2) {
        const saved = JSON.parse(toolResults.at(-1).content);
        if (saved.runnable !== true) throw new Error(`工作流没有通过 Owner 校验：${JSON.stringify(saved)}`);
        workflowDefinition = saved.workflow;
        workflowPhase++;
        return call("lfaa_workflow_run", { workflowId: workflowDefinition.id, expectedUpdatedAt: workflowDefinition.updatedAt });
      }
      if (workflowPhase === 3) {
        workflowResult = JSON.parse(toolResults.at(-1).content);
        workflowPhase++;
        return sse({ content: "工作流已由当前对话创建、运行并核实完成。" });
      }
      throw new Error(`意外的工作流模型请求阶段：${workflowPhase}`);
    } catch (error) {
      workflowFixtureError = error instanceof Error ? error.message : String(error);
      return sse({ content: "工作流回归夹具遇到异常并停止继续选择工具。" });
    }
  };
  const workflowParent = runs.startAiRun(owner, "admin", { appId: "minecraft", sessionId: null, content: "创建并运行一个节点查询工作流" }, host);
  const workflowParentResult = await finish(workflowParent.id);
  assert.equal(workflowParentResult.status, "complete", `${workflowFixtureError ?? ""}\n${JSON.stringify(workflowResult)}\n${JSON.stringify(workflowParentResult.message)}`);
  assert.equal(workflowPhase, 4);
  assert.equal(workflowFixtureError, undefined);
  assert.equal(childOfferedTool, true, "工作流子 Agent 获得已选 Minecraft 工具");
  assert.equal(workflowResult.status, "succeeded", JSON.stringify(workflowResult));
  assert.equal(workflowResult.nodes[0].status, "succeeded");
  assert.match(workflowResult.nodes[0].output, /子 Agent 已依据实际 Minecraft 节点查询结果/u);
  assert.ok(Array.isArray(childToolResult), `Minecraft 节点查询返回了实际数组结果：${JSON.stringify(childToolResult)}`);
  assert.ok(workflowOwner.listWorkflowSummaries(owner, "minecraft").some(item => item.id === workflowDefinition.id));
  assert.deepEqual(workflowOwner.listWorkflowSummaries(owner, "workspace"), [], "工作流列表按 App 隔离");

  // 开服工作流必须先通过当前 Run 的问题通道明确取得 EULA 同意；拒绝时不得创建运行记录。
  const eulaWorkflow = workflowOwner.createWorkflow(owner, "minecraft", {
    title: "EULA 拒绝保护回归",
    nodes: [{ id: "eula-agent", type: "minecraft.agent", version: 1, title: "开服节点", data: { prompt: "部署服务器。", toolNames: ["minecraft_provision_server"] }, x: 0, y: 0 }],
    edges: []
  });
  const eulaRunTool = tool("lfaa_workflow_run");
  assert.equal(eulaRunTool.requiresQuestionChannel, true);
  const runsBeforeEulaDenial = workflowOwner.listWorkflowRuns(owner, "minecraft", eulaWorkflow.id).length;
  await assert.rejects(eulaRunTool.execute(eulaRunTool.parse({ workflowId: eulaWorkflow.id, expectedUpdatedAt: eulaWorkflow.updatedAt }), {
    userId: owner, userRole: "admin", applicationId: "minecraft", agentRunId: randomUUID(), signal: new AbortController().signal,
    onProgress() {}, askUser: async () => ({ answer: "不同意", skipped: false })
  }), /没有明确同意 Minecraft EULA/u);
  assert.equal(workflowOwner.listWorkflowRuns(owner, "minecraft", eulaWorkflow.id).length, runsBeforeEulaDenial, "EULA 拒绝前不创建工作流运行");
  console.log("verified:workflow-chat-automation");

  // 终端服务从闭包注入、绑定账户和父 Run，运行清理会关闭进程。
  const { createTerminalTool } = await import("lfaa-tool-terminal");
  let closed = 0, written = "", cleanup;
  const fakeSession = { id: randomUUID(), write: async value => { written = value; }, read: () => written, close: async () => { closed++; } };
  const terminal = createTerminalTool({ createSession: async () => fakeSession, getSession: () => fakeSession });
  const terminalContext = { ...fileContext, onRunDispose: fn => { cleanup = fn; } };
  const created = await terminal.execute({ action: "create" }, terminalContext);
  await terminal.execute({ action: "send", sessionId: created.sessionId, input: "fixture\n" }, terminalContext);
  assert.equal((await terminal.execute({ action: "read", sessionId: created.sessionId }, terminalContext)).output, "fixture\n");
  await assert.rejects(terminal.execute({ action: "read", sessionId: created.sessionId }, { ...terminalContext, userId: other }), /当前账户/u);
  cleanup(); await new Promise(resolve => setImmediate(resolve)); assert.equal(closed, 1);
  console.log("verified:terminal");

  // 从隔离数据库模拟旧 v48 约束；迁移需保留记录/索引/外键并允许 0 超时。
  database.prepare("UPDATE ai_host_tasks SET timeout_seconds = 60 WHERE timeout_seconds = 0").run();
  database.prepare("INSERT INTO ai_host_tasks (id,node_id,created_by,app_id,shell,working_directory,command,timeout_seconds,status,message) VALUES(?,?,?,?,?,?,?,?,?,?)")
    .run("timeout-migration-fixture", nodeId, owner, "steamcmd", "system", root, "fixture", 60, "succeeded", "before migration");
  const beforeMigrationRows = database.prepare("SELECT id, timeout_seconds FROM ai_host_tasks ORDER BY id").all();
  const beforeMigrationIndexes = database.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'ai_host_tasks' AND sql IS NOT NULL ORDER BY name").all().map(item => item.name);
  const currentTaskDdl = database.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'ai_host_tasks'").get().sql;
  const legacyTaskDdl = currentTaskDdl.replace("BETWEEN 0 AND 1800", "BETWEEN 1 AND 1800").replace(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:["]ai_host_tasks["]|ai_host_tasks)(?=\s|\()/iu, "CREATE TABLE ai_host_tasks_v48");
  assert.match(legacyTaskDdl, /CREATE TABLE ai_host_tasks_v48/iu, "fixture must create a temporary old v48 table");
  const savedTaskIndexes = database.prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'ai_host_tasks' AND sql IS NOT NULL").all().map(item => item.sql);
  database.exec("PRAGMA foreign_keys = OFF; BEGIN IMMEDIATE;");
  try {
    database.exec(legacyTaskDdl);
    database.exec("INSERT INTO ai_host_tasks_v48 SELECT * FROM ai_host_tasks;");
    database.exec("DROP TABLE ai_host_tasks; ALTER TABLE ai_host_tasks_v48 RENAME TO ai_host_tasks;");
    for (const indexSql of savedTaskIndexes) database.exec(indexSql);
    database.exec("PRAGMA user_version = 48; COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  } finally {
    database.exec("PRAGMA foreign_keys = ON;");
  }
  migrateHostTaskTimeoutSchema();
  assert.equal(Number(database.prepare("PRAGMA user_version").get().user_version), 49);
  assert.deepEqual(database.prepare("SELECT id, timeout_seconds FROM ai_host_tasks ORDER BY id").all(), beforeMigrationRows);
  assert.deepEqual(database.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'ai_host_tasks' AND sql IS NOT NULL ORDER BY name").all().map(item => item.name), beforeMigrationIndexes);
  assert.deepEqual(database.prepare("PRAGMA foreign_key_check(ai_host_tasks)").all(), []);
  database.prepare("INSERT INTO ai_host_tasks (id,node_id,created_by,app_id,shell,working_directory,command,timeout_seconds,status,message) VALUES(?,?,?,?,?,?,?,?,?,?)")
    .run("timeout-zero-fixture", nodeId, owner, "steamcmd", "system", root, "fixture", 0, "queued", "zero is unlimited");
  console.log("verified:host-task-timeout-migration");
} finally {
  globalThis.fetch = nativeFetch;
  await ctx.fiber.dispose();
}
