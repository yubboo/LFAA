/**
 * 功能：隔离验证 Agent Loop 在“重复被拦调用使整批停止”时仍为同批未派发调用回传配对结果。
 * 作用：只在测试进程内登记夹具工具与合成 Provider 流，不进入产品装配。
 * 关联文件：packages/core/agent-loop/src/execute-turn.ts、packages/core/session/src/kernel.ts。
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { randomUUID } from "node:crypto";

const reservation = createServer(); reservation.listen(0, "127.0.0.1"); await once(reservation, "listening");
process.env.SERVER_PORT = String(reservation.address().port); await new Promise(resolve => reservation.close(resolve));
const { boot } = await import("lfaa-app-boot/src/index.js");
const ctx = await boot(["--profile", "web"]);
try {
  const { database } = await import("lfaa-storage-sqlite/src/database.js");
  const settings = await import("lfaa-settings/src/service.js");
  const sessions = await import("lfaa-session/src/sessions.js");
  const { sessionRecords } = await import("lfaa-session-persistence-jsonl/src/repository.js");
  const { executeAiTurn } = await import("lfaa-agent-loop/src/execute-turn.js");
  const { createAiPluginHost } = await import("lfaa-app-boot/src/ai-host.js");
  const registry = await import("lfaa-tools/src/registry.js");
  const host = createAiPluginHost(ctx);
  const owner = randomUUID();
  database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role) VALUES(?,?,?,'fixture','fixture','admin')").run(owner, 87002, "agent-tool-pairing-fixture");

  const sse = delta => new Response(`data: ${JSON.stringify({ choices: [{ delta }], usage: { prompt_tokens: 7, completion_tokens: 2 } })}\n\ndata: [DONE]\n\n`, { headers: { "Content-Type": "text/event-stream" } });
  const batch = calls => sse({
    tool_calls: calls.map((item, index) => ({ index, id: item.id, type: "function", function: { name: item.name, arguments: "{}" } }))
  });
  let providerResponse = () => sse({ content: "不应到达" });
  globalThis.fetch = async (url, options) => String(url).endsWith("/models")
    ? Response.json({ data: [{ id: "fixture-pairing-model", context_window: 40_000, max_output_tokens: 4096 }] })
    : providerResponse(JSON.parse(options.body));

  const account = await settings.saveAiAccount(owner, { providerId: "openai", secret: "fixture-invalid-key", options: {}, displayName: "pairing fixture", modelId: "fixture-pairing-model", reasoningMode: "default" });
  settings.activateAiAccount(owner, account.id);
  settings.saveUserSettings(owner, "permissions", { mode: "full_access" });
  settings.saveUserSettings(owner, "ai-runtime", { ...settings.defaultSettings.aiRuntime, autoCompaction: false, contextWindowTokens: 40_000, requestRetries: 0, maxModelRequests: 8, maxToolCalls: 16 });

  const disposers = [];
  let failureExecutions = 0;
  let readExecutions = 0;
  registry.registerAiBusinessTool({ effect: setup => disposers.push(setup()) }, {
    id: "fixture.pairing-failure", name: "fixture_pairing_failure", description: "仅测试重复失败停止", applicationIds: ["workspace"], coreManaged: true,
    schema: { type: "object", properties: {}, additionalProperties: false },
    parse: value => value,
    risk: () => "read",
    approval: () => ({ scopeKey: "fixture-pairing", scopeSummary: "隔离配对", summary: "验证停止时的配对" }),
    execute: async () => { failureExecutions += 1; return { error: "合成夹具返回失败", executionState: "failed", executed: true }; }
  });
  registry.registerAiBusinessTool({ effect: setup => disposers.push(setup()) }, {
    id: "fixture.pairing-read", name: "fixture_pairing_read", description: "仅测试同批剩余调用", applicationIds: ["workspace"], coreManaged: true,
    schema: { type: "object", properties: {}, additionalProperties: false },
    parse: value => value,
    risk: () => "read",
    approval: () => ({ scopeKey: "fixture-pairing-read", scopeSummary: "隔离配对", summary: "验证同批剩余只读调用" }),
    execute: async () => { readExecutions += 1; return { observed: true, executions: readExecutions }; }
  });

  let requestCount = 0;
  providerResponse = () => {
    requestCount += 1;
    // 第 1、2、3 批都是同一失败签名 + 一个正常只读调用；第 2 批首次拦截，第 3 批停止。
    return batch([
      { id: `pair-failure-${requestCount}`, name: "fixture_pairing_failure" },
      { id: `pair-read-${requestCount}`, name: "fixture_pairing_read" }
    ]);
  };

  const content = "重复失败后停止时闭合同批剩余调用";
  const turn = sessions.createAiTurn(owner, "workspace", null, content);
  await executeAiTurn({ userId: owner, userRole: "admin", body: { appId: "workspace", sessionId: turn.session.id, content }, turn, aiPluginHost: host, abortController: new AbortController(), emit() {}, modelResolver: ctx.lfaaAgentDefaultModel, approvalNotifications: ctx.lfaaUserApproval });

  const run = sessions.getAiRun(owner, turn.assistantMessage.id);
  assert.equal(run?.status, "error", JSON.stringify(run?.message));
  assert.equal(requestCount, 3, `重复被拦调用第二次出现时应停止，不再请求模型：${run.message.content}`);
  assert.equal(failureExecutions, 1, "失败夹具只派发一次");
  assert.equal(readExecutions, 2, "同批正常调用在停止批之前各派发一次");
  assert.match(run.message.content, /重复请求先前已失败或结果未知/u);

  const events = sessionRecords.allForSession("session_events", turn.session.id).filter(event =>
    (event.type === "tool/call" || event.type === "tool/result") && event.data.runId === turn.assistantMessage.id);
  const calls = events.filter(event => event.type === "tool/call");
  const results = events.filter(event => event.type === "tool/result");
  for (const result of results) {
    assert.ok(calls.some(call => call.data.callId === result.data.callId), `每个工具结果都必须有同 ID 调用事件：${result.data.callId}`);
  }
  for (const call of calls) {
    assert.ok(results.some(result => result.data.callId === call.data.callId), `每个工具调用都必须有同 ID 结果：${call.data.callId}`);
  }
  const failureCalls = calls.filter(call => call.data.name === "fixture_pairing_failure");
  assert.deepEqual(failureCalls.map(call => call.data.dispatched), [true, false, false], "失败签名首次拦截后再次出现即停止");
  const readCalls = calls.filter(call => call.data.name === "fixture_pairing_read");
  assert.deepEqual(readCalls.map(call => call.data.dispatched), [true, true, false], "停止批中的同批剩余调用必须记录为未派发");
  const stoppedRead = results.find(result => result.data.callId === "pair-read-3");
  assert.ok(stoppedRead, "停止批中的同批剩余调用必须有配对结果");
  assert.equal(stoppedRead.data.executionState, "not_started");
  assert.notEqual(stoppedRead.data.repaired, true, "同批剩余调用应由 Agent Loop 记录，而不是只靠会话修复合成");
  console.log("verified:agent-tool-pairing");
  for (const dispose of disposers) dispose();
  await host.close();
} finally {
  await ctx.fiber.dispose();
}
