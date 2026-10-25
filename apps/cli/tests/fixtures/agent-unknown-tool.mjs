/**
 * 功能：隔离验证真实模型臆造工具名时 Agent 循环是否可恢复。
 * 作用：合成 Provider 先返回一个本轮未提供的工具调用（模拟懒加载名写错），再返回最终答复；
 *       断言 Run 不被会话内核致命终止、不产生伪造 tool/call 证据、模型收到纠正信息后完成。
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
  const host = createAiPluginHost(ctx);
  const owner = randomUUID();
  database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role) VALUES(?,?,?,'fixture','fixture','admin')").run(owner, 87003, "agent-unknown-tool-fixture");

  const sse = delta => new Response(`data: ${JSON.stringify({ choices: [{ delta }], usage: { prompt_tokens: 9, completion_tokens: 3 } })}\n\ndata: [DONE]\n\n`, { headers: { "Content-Type": "text/event-stream" } });
  const requests = [];
  globalThis.fetch = async (url, options) => {
    if (String(url).endsWith("/models")) return Response.json({ data: [{ id: "fixture-unknown-tool-model", context_window: 40_000, max_output_tokens: 4096 }] });
    requests.push(JSON.parse(options.body));
    if (requests.length === 1) {
      return sse({
        content: "我先查一下能力状态。",
        tool_calls: [{ index: 0, id: "hallucinated-tool-1", type: "function", function: { name: "totally_unregistered_agent_tool", arguments: "{}" } }]
      });
    }
    return sse({ content: "已按本轮真实提供的工具重新选择并完成。" });
  };

  const account = await settings.saveAiAccount(owner, { providerId: "openai", secret: "fixture-invalid-key", options: {}, displayName: "unknown tool fixture", modelId: "fixture-unknown-tool-model", reasoningMode: "default" });
  settings.activateAiAccount(owner, account.id);
  settings.saveUserSettings(owner, "permissions", { mode: "full_access" });
  settings.saveUserSettings(owner, "ai-runtime", { ...settings.defaultSettings.aiRuntime, autoCompaction: false, contextWindowTokens: 40_000, requestRetries: 0, maxModelRequests: 8, maxToolCalls: 16 });

  const content = "查一下能力状态然后完成任务";
  const turn = sessions.createAiTurn(owner, "workspace", null, content);
  await executeAiTurn({ userId: owner, userRole: "admin", body: { appId: "workspace", sessionId: turn.session.id, content }, turn, aiPluginHost: host, abortController: new AbortController(), emit() {}, modelResolver: ctx.lfaaAgentDefaultModel, approvalNotifications: ctx.lfaaUserApproval });

  const run = sessions.getAiRun(owner, turn.assistantMessage.id);
  assert.equal(run?.status, "complete", `臆造工具名不得让整轮 Run 致命失败：${JSON.stringify(run?.message)}`);
  assert.match(run.message.content, /已按本轮真实提供的工具重新选择并完成/u);
  assert.equal(requests.length, 2, "未知工具轮不派发工具，只让模型重选一次");
  assert.ok(requests[1].messages.some(message => message.role === "user" && typeof message.content === "string" && message.content.includes("totally_unregistered_agent_tool") && message.content.includes("没有提供")),
    "第二次请求必须把未提供的工具名作为可恢复纠正交给模型");
  const unknownCallPersisted = requests[1].messages.some(message => Array.isArray(message.tool_calls) && message.tool_calls.some(call => call.function?.name === "totally_unregistered_agent_tool"));
  assert.equal(unknownCallPersisted, false, "未提供的调用不能以 assistant.tool_calls 形式进入下一次请求");

  const events = sessionRecords.allForSession("session_events", turn.session.id).filter(event => event.data?.runId === turn.assistantMessage.id);
  assert.equal(events.filter(event => event.type === "tool/call").length, 0, "未提供的工具不得写入 tool/call 证据");
  assert.ok(run.message.activity.some(activity => activity.title === "拒绝未提供的工具"), "活动记录应说明拒绝原因");
  assert.equal(run.message.content.includes("request/header 中缺少唯一工具定义"), false, "不得再出现会话内核的致命错误文案");
  console.log("verified:agent-unknown-tool");
  await host.close();
} finally {
  await ctx.fiber.dispose();
}
