/**
 * 功能：回归简单回答的请求数、Provider 阶段与本机命令执行事实。
 * 作用：使用隔离账户、合成流和 Shell 执行器验证真实 Agent/Permission/Session 路径，不调用外部模型或桌面。
 * 关联文件：core/agent-loop/execute-turn.ts、shell/tool-shell、core/system-prompt。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { isolateData } from "./isolated-data.mjs";
isolateData(test, "agent-response-latency");
process.env.LFAA_LOCAL_MODE = "true";
process.env.SERVER_HOST = "127.0.0.1";
const { database } = await import("lfaa-storage-sqlite/src/database.js");
const { retireLegacyFileTables } = await import("lfaa-storage-domain/src/migration.js");
const settings = await import("lfaa-settings/src/service.js");
const sessions = await import("lfaa-session/src/sessions.js");
const { sessionRecords } = await import("lfaa-session-persistence-jsonl/src/repository.js");
retireLegacyFileTables();
const { executeAiTurn } = await import("lfaa-agent-loop/src/execute-turn.js");
const { createAiCompletionService } = await import("lfaa-llm/src/completion.js");
const { assessContextPressure } = await import("lfaa-agent-loop/src/runtime-context.js");
const { registerAiBusinessTool } = await import("lfaa-tools/src/registry.js");
const shellTools = await import("lfaa-tool-shell/src/index.js");
const owner = randomUUID();
database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role) VALUES(?,1,'fixture-latency','fixture','fixture','admin')").run(owner);
settings.saveUserSettings(owner, "permissions", { mode: "full_access" });
const workspaceRoot = join(process.env.LFAA_DATA_DIR, "agent-workspace");
mkdirSync(workspaceRoot, { recursive: true });
settings.saveUserSettings(owner, "general", { ...settings.getUserSettings(owner).general, taskFolder: workspaceRoot });
settings.saveUserSettings(owner, "ai-runtime", { ...settings.defaultSettings.aiRuntime, commandTimeoutSeconds: 10, maxModelRequests: 4, maxToolCalls: 4, requestRetries: 0 });
const host = { llm: createAiCompletionService(), listPlugins: () => [], listExtensions: () => [], listInstructionExtensions: () => [], getSystemInstructions: () => [], listHooks: () => [], runBeforeInference: () => ({ failedHookIds: [] }), runAfterInference: () => ({ failedHookIds: [] }) };
const account = { accountId: "fixture-account", providerId: "fixture", modelId: "fixture-selected-model", chatUrl: "https://provider.example.test/chat", secret: "invalid-fixture-key", keyHeader: "Authorization", keyPrefix: "Bearer ", maxTokensField: "max_tokens", reasoningMode: "high", thinking: { kind: "effort", parameter: "reasoning_effort", values: ["high"] } };
const line = delta => `data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`;
const response = delta => new Response(line(delta) + "data: [DONE]\n\n", { headers: { "Content-Type": "text/event-stream" } });
const call = (id, parameters = { command: "fixture bounded command" }) => ({ tool_calls: [{ index: 0, id, type: "function", function: { name: "local_execute_command", arguments: JSON.stringify(parameters) } }] });
const capturedTools = [], disposers = [];
let shellResult, shellExecutions = 0, lastSpec;
shellTools.apply({ lfaaTools: { registerTool: (_ctx, tool) => capturedTools.push(tool) }, get: () => ({ resolve: input => { lastSpec = input; return input; }, execute: async () => { shellExecutions++; return { result: async () => shellResult }; } }) });
const localTool = capturedTools.find(tool => tool.name === "local_execute_command");
assert.ok(localTool);
registerAiBusinessTool({ effect: setup => { const dispose = setup(); disposers.push(dispose); return dispose; } }, localTool);
test.after(() => { for (const dispose of disposers) dispose(); });

async function run(decide, abortController = new AbortController(), sessionId = null, maxModelRequests = 4, promptSuggestions = false) {
  const originalFetch = globalThis.fetch, bodies = [], emitted = [];
  let decisionError;
  const originalAiRuntime = settings.getUserSettings(owner).aiRuntime;
  settings.saveUserSettings(owner, "ai-runtime", { ...originalAiRuntime, maxModelRequests, promptSuggestions });
  const turn = sessions.createAiTurn(owner, "workspace", sessionId, "合成简单目标");
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body); bodies.push(body);
    assert.equal(body.model, account.modelId);
    assert.equal(body.reasoning_effort, "high", "不能通过降低用户思考力度来缩短耗时");
    try { return await decide(body, bodies.length); }
    catch (error) { decisionError = error; throw error; }
  };
  try {
    await executeAiTurn({ userId: owner, userRole: "admin", body: { appId: "workspace", sessionId: turn.session.id, content: "合成简单目标" }, turn, aiPluginHost: host, abortController, emit: (event, data) => emitted.push({ event, data }), modelResolver: { resolve: () => account }, approvalNotifications: {}, allowedToolNames: [localTool.name] });
    return { bodies, emitted, turn, result: sessions.getAiRun(owner, turn.assistantMessage.id), decisionError };
  } finally {
    globalThis.fetch = originalFetch;
    settings.saveUserSettings(owner, "ai-runtime", originalAiRuntime);
  }
}

test("简单回答只请求一次；推理、正文阶段真实结束且耗时不归零", async () => {
  const before = shellExecutions;
  const result = await run(() => new Response(new ReadableStream({ async start(controller) {
    const write = delta => controller.enqueue(new TextEncoder().encode(line(delta)));
    await delay(20); write({ reasoning_content: "隐藏的合成推理，不能公开" });
    await delay(20); write({ content: "简短回答" });
    await delay(20); controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n")); controller.close();
  } }), { headers: { "Content-Type": "text/event-stream" } }));
  assert.equal(result.bodies.length, 1);
  assert.equal(shellExecutions, before);
  assert.equal(result.result.status, "complete");
  assert.equal(result.result.message.content, "简短回答");
  assert.ok(!result.result.message.activity.some(activity => activity.status === "running"));
  const stages = result.result.message.activity.filter(activity => /请求 fixture|模型推理中|流式接收回答/u.test(activity.title));
  assert.equal(stages.length, 3);
  for (const stage of stages) { assert.ok(stage.completedAt); assert.ok(stage.durationMs >= 10); }
  assert.doesNotMatch(JSON.stringify(result.emitted), /隐藏的合成推理/u);
});

test("最终答复的上下文建议共用同一 Provider 请求并以公开消息元数据保存", async () => {
  const suggestions = ["为这段改动补一条失败路径回归。", "再检查窄分栏下按钮是否换行。"];
  const answer = "核心改动已完成，接下来可以核对边界和布局。";
  const privateTail = `<lfaa-prompt-suggestions>${JSON.stringify({ items: suggestions })}</lfaa-prompt-suggestions>`;
  const result = await run(() => response({ content: `${answer}\n${privateTail}` }), new AbortController(), null, 4, true);

  assert.equal(result.bodies.length, 1, "建议不得额外触发 Provider 请求");
  assert.equal(result.result.status, "complete");
  assert.equal(result.result.message.content, `${answer}\n`);
  assert.deepEqual(result.result.message.promptSuggestions, suggestions);
  assert.ok(!result.result.message.activity.some(activity => activity.kind === "prompt-suggestions"));
  assert.deepEqual(result.emitted.filter(event => event.event === "prompt-suggestions").map(event => event.data.suggestions), [suggestions]);
  assert.doesNotMatch(JSON.stringify(result.emitted.filter(event => event.event === "delta")), /lfaa-prompt-suggestions/u);

  const page = await sessions.getAiSessionMessagesPage(owner, result.turn.session.id, undefined, 100);
  const persisted = page.messages.find(message => message.id === result.turn.assistantMessage.id);
  assert.equal(persisted.content, `${answer}\n`);
  assert.deepEqual(persisted.promptSuggestions, suggestions);
  const sessionEvents = sessionRecords.allForSession("session_events", result.turn.session.id);
  const modelResponses = sessionEvents.filter(event => event.type === "assistant/response");
  assert.doesNotMatch(JSON.stringify(modelResponses), /lfaa-prompt-suggestions|建议一|建议二/u);
  assert.doesNotMatch(JSON.stringify(sessionEvents.filter(event => event.type === "activity/change")), /prompt-suggestions|建议一|建议二/u);
});

test("模型漏写建议协议但正文明确列出后续问题时仍发送建议事件", async () => {
  const suggestions = [
    "Cache-Control 的 max-age 与 s-maxage 分别控制哪一层缓存？",
    "浏览器如何用 ETag 发起协商缓存请求？"
  ];
  const answer = [
    "HTTP 缓存能减少传输、降低服务器压力，并通过缓存策略平衡性能与新鲜度。",
    "",
    "两个后续学习问题：",
    `1. ${suggestions[0]}`,
    `2. ${suggestions[1]}`
  ].join("\n");
  const result = await run(() => response({ content: answer }), new AbortController(), null, 4, true);

  assert.equal(result.bodies.length, 1, "恢复建议不得发起额外 Provider 请求");
  assert.equal(result.result.message.content, answer);
  assert.deepEqual(result.result.message.promptSuggestions, suggestions);
  assert.deepEqual(result.emitted.filter(event => event.event === "prompt-suggestions").map(event => event.data.suggestions), [suggestions]);
});

test("主回复漏写建议时使用同账户的一次无工具补充请求并只保存私有建议", async () => {
  const answer = "HTTP 206 表示服务器返回了资源的一部分，常用于断点续传。";
  const suggestions = ["如何用 Range 请求下载文件的一部分？", "哪些场景会返回 416 Range Not Satisfiable？"];
  const privateTail = `<lfaa-prompt-suggestions>${JSON.stringify({ items: suggestions })}</lfaa-prompt-suggestions>`;
  const result = await run((_body, count) => {
    if (count === 1) return response({ content: answer });
    assert.equal(count, 2);
    assert.equal(_body.model, account.modelId, "补充请求必须沿用本轮已选模型");
    assert.equal(_body.tools, undefined, "补充请求不得向 Provider 提供工具");
    assert.equal(_body.messages.filter(message => message.role === "user").length, 1);
    assert.ok(!_body.messages.some(message => message.role === "tool"));
    const current = _body.messages.at(-1).content;
    const source = JSON.parse(current.slice(current.indexOf("\n") + 1));
    assert.equal(source.userRequest, "合成简单目标");
    assert.equal(source.finalAnswer, answer);
    assert.match(_body.messages[0].content, /仅生成私有建议元数据/u);
    return response({ content: privateTail });
  }, new AbortController(), null, 4, true);

  assert.equal(result.decisionError, undefined);
  assert.equal(result.bodies.length, 2);
  assert.equal(result.result.status, "complete");
  assert.equal(result.result.message.content, answer, "补充响应不能拼进公开答复");
  assert.deepEqual(result.result.message.promptSuggestions, suggestions);
  assert.deepEqual(result.emitted.filter(event => event.event === "prompt-suggestions").map(event => event.data.suggestions), [suggestions]);
  assert.doesNotMatch(JSON.stringify(result.emitted.filter(event => event.event === "delta")), /lfaa-prompt-suggestions|Range Not Satisfiable/u);
  const usage = result.emitted.find(event => event.event === "usage");
  assert.equal(usage.data.models[0].requestCount, 2, "补充请求必须计入本轮请求数");

  const events = sessionRecords.allForSession("session_events", result.turn.session.id);
  assert.equal(events.filter(event => event.type === "assistant/response").length, 1, "补充响应不能进入模型历史");
  assert.doesNotMatch(JSON.stringify(events.filter(event => event.type === "assistant/response")), /Range Not Satisfiable|lfaa-prompt-suggestions/u);
});

test("补充请求用尽预算时保留原答复且不生成伪建议", async () => {
  const answer = "HTTP 206 表示返回了部分内容。";
  const result = await run(() => response({ content: answer }), new AbortController(), null, 1, true);

  assert.equal(result.bodies.length, 1);
  assert.equal(result.result.status, "complete");
  assert.equal(result.result.message.content, answer);
  assert.deepEqual(result.result.message.promptSuggestions ?? [], []);
  assert.ok(result.result.message.activity.some(activity => activity.title === "后续建议未生成" && /预算已用完/u.test(activity.detail)));
});

test("补充请求失败不改变已经生成的主答复", async () => {
  const answer = "HTTP 206 表示返回了部分内容。";
  const result = await run((_body, count) => count === 1 ? response({ content: answer }) : Promise.reject(new Error("合成 Provider 故障")), new AbortController(), null, 4, true);

  assert.equal(result.bodies.length, 2);
  assert.equal(result.result.status, "complete");
  assert.equal(result.result.message.content, answer);
  assert.deepEqual(result.result.message.promptSuggestions ?? [], []);
  assert.ok(result.result.message.activity.some(activity => activity.title === "后续建议未生成"));
});

test("合成 Provider 单次工具调用与结果续接记录当前端到端 P50/P95", async t => {
  shellResult = { exitCode: 0, timedOut: false, aborted: false, stdout: { text: "合成工具结果", truncated: false }, stderr: { text: "", truncated: false } };
  const warmupCount = 5, sampleCount = 31, before = shellExecutions, samples = [];
  for (let index = 0; index < warmupCount + sampleCount; index++) {
    const startedAt = performance.now();
    const result = await run((_body, requestCount) => {
      if (requestCount === 1) return response(call(`perf-${index}`));
      assert.equal(requestCount, 2, "每轮应在一次工具结果后续接一次 Provider 请求");
      const toolMessage = _body.messages.findLast(message => message.role === "tool");
      assert.ok(toolMessage);
      assert.equal(JSON.parse(toolMessage.content).executionState, "complete");
      return response({ content: "合成续接完成" });
    });
    const elapsedMs = performance.now() - startedAt;
    assert.equal(result.bodies.length, 2);
    assert.equal(result.result.status, "complete");
    assert.equal(result.result.message.content, "合成续接完成");
    assert.equal(shellExecutions, before + index + 1);
    if (index >= warmupCount) samples.push(elapsedMs);
  }
  samples.sort((left, right) => left - right);
  const percentile = value => samples[Math.ceil(value * samples.length) - 1];
  t.diagnostic(`合成 Agent 请求→工具→续接，n=${sampleCount}，P50=${percentile(0.5).toFixed(3)} ms，P95=${percentile(0.95).toFixed(3)} ms；含隔离 Session 写入，不含真实 Provider 网络及真实 Shell 进程`);
});

test("推理阶段流失败时结束活动，不残留正在思考", async () => {
  const result = await run(() => new Response(new ReadableStream({ async start(controller) {
    controller.enqueue(new TextEncoder().encode(line({ reasoning_content: "合成推理" })));
    await delay(10); controller.error(new Error("合成传输失败"));
  } }), { headers: { "Content-Type": "text/event-stream" } }));
  assert.equal(result.result.status, "error");
  assert.ok(!result.result.message.activity.some(activity => activity.status === "running"));
});

test("Shell 非零退出、超时、取消与未知退出码保持事实，并阻止同一失败调用重放", async () => {
  for (const [exitCode, timedOut, aborted, expected] of [[1, false, false, "failed"], [null, true, false, "unconfirmed"], [null, false, true, "unconfirmed"], [null, false, false, "unconfirmed"]]) {
    shellResult = { exitCode, timedOut, aborted, stdout: { text: "", truncated: false }, stderr: { text: "", truncated: false } };
    const before = shellExecutions;
    const result = await run((body, count) => {
      if (count === 2) {
        const returned = JSON.parse(body.messages.find(message => message.role === "tool").content);
        assert.equal(returned.executionState, expected);
        assert.equal(returned.isError, true);
      }
      if (count === 3) {
        const returned = JSON.parse(body.messages.findLast(message => message.role === "tool").content);
        assert.equal(returned.executionState, "not_started");
        assert.equal(returned.executed, false);
        return response({ content: "已收到失败证据，没有再次执行命令。" });
      }
      return response(call(`call-${count}`));
    });
    assert.equal(result.bodies.length, 3, JSON.stringify({ status: result.result.status, content: result.result.message.content, toolStates: sessionRecords.allForSession("session_events", result.turn.session.id).filter(event => event.type === "tool/result").map(event => event.data.executionState) }));
    assert.equal(shellExecutions - before, 1);
    assert.equal(result.result.status, "complete");
    const toolResults = sessionRecords.allForSession("session_events", result.turn.session.id).filter(event => event.type === "tool/result");
    assert.deepEqual(toolResults.map(event => event.data.executionState), [expected, "not_started"]);
    assert.ok(result.result.message.activity.some(activity => activity.title === "执行本机命令" && activity.status === (expected === "unconfirmed" ? "unavailable" : "error")));
    assert.equal(lastSpec.timeoutMs, undefined, "节点命令的默认时限不能传给本机 Shell；缺省由 Shell 自己补有界时限");
  }
});

test("本机命令成功保持 complete，后续模型根据真实结果完成", async () => {
  shellResult = { exitCode: 0, timedOut: false, aborted: false, stdout: { text: "中文结果", truncated: false }, stderr: { text: "", truncated: false } };
  const result = await run((body, count) => {
    if (count === 1) return response(call("success", { command: "fixture bounded command", timeoutSeconds: 45 }));
    const returned = JSON.parse(body.messages.find(message => message.role === "tool").content);
    assert.equal(returned.executionState, "complete"); assert.equal(returned.isError, false);
    assert.equal(returned.stdout, "中文结果");
    return response({ content: "根据真实结果完成" });
  });
  assert.equal(result.result.status, "complete");
  assert.equal(result.bodies.length, 2);
  assert.equal(lastSpec.timeoutMs, 45_000, "模型本次明确指定的本机超时按工具合同传递，不受节点设置影响");
});

test("一次真实 Agent 运行记录阶段正文、工具落点和最终答案，分页恢复分段且不泄露私有协议", async () => {
  shellResult = { exitCode: 0, timedOut: false, aborted: false, stdout: { text: "已核实", truncated: false }, stderr: { text: "", truncated: false } };
  const result = await run((_body, count) => count === 1
    ? response({ content: "先核对。", reasoning_content: "private-timeline", ...call("timeline-call") })
    : response({ content: "已完成。" }));
  const message = result.result.message;
  assert.equal(message.content, "先核对。已完成。");
  assert.deepEqual(message.parts.map(({ start, end, kind }) => ({ start, end, kind })), [{ start: 0, end: 4, kind: "commentary" }, { start: 4, end: 8, kind: "final" }]);
  assert.equal(message.activity.find(item => item.title === "执行本机命令").contentOffset, 4);
  const page = await sessions.getAiSessionMessagesPage(owner, result.turn.session.id, undefined);
  assert.deepEqual(page.messages.at(-1).parts, message.parts);
  const events = sessionRecords.allForSession("session_events", result.turn.session.id);
  assert.deepEqual(events.filter(event => event.type === "assistant/message").at(-1).data.parts, message.parts);
  assert.doesNotMatch(JSON.stringify([page, result.emitted]), /private-timeline/u);
  const delta = result.emitted.filter(event => event.event === "delta");
  assert.notEqual(delta[0].data.partId, delta[1].data.partId);
});

test("模型思考经真实工具结果续接，跨轮恢复私有协议且所有展示投影无隐藏推理", async () => {
  shellResult = { exitCode: 0, timedOut: false, aborted: false, stdout: { text: '真实合成命令结果', truncated: false }, stderr: { text: '', truncated: false } };
  const result = await run((body, count) => {
    if (count === 1) return response({ reasoning_content: 'private-tool-reasoning', ...call('reasoned-call') });
    assert.equal(body.messages.find(message => message.role === 'assistant').reasoning_content, 'private-tool-reasoning');
    assert.match(body.messages.find(message => message.role === 'tool').content, /真实合成命令结果/u);
    return response({ reasoning_content: 'private-final-reasoning', content: '已读取真实结果并完成' });
  });
  assert.equal(result.result.status, 'complete');
  const next = await run(body => {
    const prior = body.messages.find(message => message.role === 'assistant');
    assert.equal(prior.reasoning_content, 'private-final-reasoning');
    assert.equal(body.messages.some(message => message.role === 'tool'), false, '已完成普通工具大结果不重复发送');
    return response({ content: '后续回答' });
  }, new AbortController(), result.turn.session.id);
  assert.equal(next.result.status, 'complete');
  assert.doesNotMatch(JSON.stringify([result.emitted, result.result, next.emitted, next.result]), /private-(tool|final)-reasoning/u);
  const events = sessionRecords.allForSession('session_events', result.turn.session.id);
  assert.equal(events.filter(event => event.type === 'assistant/response').some(event => event.data.message.providerReplay?.reasoningContent === 'private-final-reasoning'), true);
});

test("传输截断的工具选择不会派发，也不重试部分响应", async () => {
  const before = shellExecutions;
  const result = await run(() => new Response(line(call('truncated-call')), { headers: { 'Content-Type': 'text/event-stream' } }));
  assert.equal(result.result.status, 'error');
  assert.equal(result.bodies.length, 1);
  assert.equal(shellExecutions, before);
});

test("上下文压力计入真实思考续接数据，不能只计算可见正文", () => {
  const message = { role: 'assistant', content: '简短正文', providerReplay: { accountId: account.accountId, providerId: account.providerId, modelId: account.modelId, reasoningContent: '长思考'.repeat(4000) } };
  const pressure = assessContextPressure([message], 1000);
  assert.ok(pressure.usedTokens > 1000);
  assert.equal(pressure.needsCompaction, true);
});
