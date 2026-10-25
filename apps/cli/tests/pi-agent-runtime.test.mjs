/**
 * 功能：回归 Pi Agent Core 与 LFAA Provider/Tool 消息合同。
 * 作用：用合成 Provider 验证单一回合执行器、顺序工具调用和错误传播，不访问真实账户或数据。
 * 关联文件：packages/core/agent-loop/src/pi-runtime.ts、execute-turn.ts。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { runLfaaPiAgent } from "../../../packages/core/agent-loop/src/pi-runtime.ts";

const usage = { promptTokens: 12, completionTokens: 4, cacheReadTokens: null };
const model = {
  id: "fixture-model", name: "fixture-model", api: "openai-completions", provider: "fixture-provider",
  baseUrl: "https://fixture.invalid/v1", input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, reasoning: false,
  contextWindow: 8192, maxTokens: 1024
};
const tool = name => ({
  type: "function",
  function: { name, description: "只用于适配器隔离回归。", parameters: { type: "object", properties: { value: { type: "string" } }, required: ["value"] } }
});

test("Pi Agent Core 串行调度 LFAA 工具并把原始参数和真实结果交回 LFAA Provider", async () => {
  const calls = [];
  let active = 0;
  let peak = 0;
  let requestCount = 0;
  const inputMessages = [{ role: "user", content: "run both tools" }];
  await runLfaaPiAgent({
    model,
    messages: inputMessages,
    getTools: () => [tool("first_tool"), tool("second_tool")],
    stream: async request => {
      requestCount += 1;
      if (requestCount === 1) {
        const toolCalls = [
          { id: "call-1", name: "first_tool", arguments: '{"value":"one"}' },
          { id: "call-2", name: "second_tool", arguments: '{"value":"two"}' }
        ];
        return { text: "", toolCalls, usage };
      }
      assert.equal(request.messages.filter(message => message.role === "tool").length, 2);
      assert.deepEqual(request.messages.filter(message => message.role === "tool").map(message => Array.isArray(message.content)
        ? message.content.map(part => part.text ?? "").join("")
        : message.content), [
        "result:first_tool:one", "result:second_tool:two"
      ]);
      request.onDelta("done");
      return { text: "done", toolCalls: [], usage };
    },
    executeTool: async call => {
      active += 1;
      peak = Math.max(peak, active);
      calls.push(call);
      await new Promise(resolve => setTimeout(resolve, 5));
      active -= 1;
      return { content: `result:${call.name}:${JSON.parse(call.arguments).value}` };
    },
    prepareRequest: async ({ messages }) => ({ messages }),
    prepareNextTurn: async ({ messages }) => ({ messages }),
    finishTurn: async ({ message }) => ({ action: message.content.some(part => part.type === "toolCall") ? "continue" : "end" }),
    signal: new AbortController().signal
  });
  assert.equal(requestCount, 2);
  assert.equal(peak, 1);
  assert.deepEqual(calls.map(call => [call.id, call.name, call.arguments]), [
    ["call-1", "first_tool", '{"value":"one"}'],
    ["call-2", "second_tool", '{"value":"two"}']
  ]);
});

test("Pi 适配器在本轮含未知工具时拒绝整批调用且保留未知名称供 LFAA 纠正", async () => {
  let executed = 0;
  let rejected;
  let assistantMessages = [];
  await runLfaaPiAgent({
    model,
    messages: [{ role: "user", content: "try a tool" }],
    getTools: () => [tool("known_tool")],
    stream: async () => ({
      text: "I will check.",
      toolCalls: [
        { id: "known-call", name: "known_tool", arguments: '{"value":"x"}' },
        { id: "unknown-call", name: "ghost_tool", arguments: "{}" }
      ],
      usage
    }),
    onRejectedToolCalls: names => { rejected = names; },
    onAssistantMessage: message => { assistantMessages.push(message); },
    executeTool: async () => { executed += 1; return { content: "must not run" }; },
    prepareRequest: async ({ messages }) => ({ messages }),
    prepareNextTurn: async ({ messages }) => ({ messages }),
    finishTurn: async () => ({ action: "end" }),
    signal: new AbortController().signal
  });
  assert.deepEqual(rejected, ["ghost_tool"]);
  assert.equal(executed, 0);
  assert.equal(assistantMessages.length, 1);
  assert.equal(assistantMessages[0].tool_calls, undefined);
  assert.equal(assistantMessages[0].content, "I will check.");
});

test("Pi StreamFn 不吞掉 LFAA Provider 的原始错误对象", async () => {
  const failure = Object.assign(new Error("provider request failed"), { name: "AiRecoverableRequestError" });
  await assert.rejects(runLfaaPiAgent({
    model,
    messages: [{ role: "user", content: "hello" }],
    getTools: () => [],
    stream: async () => { throw failure; },
    executeTool: async () => ({ content: "unused" }),
    prepareRequest: async ({ messages }) => ({ messages }),
    prepareNextTurn: async ({ messages }) => ({ messages }),
    signal: new AbortController().signal
  }), error => error === failure);
});
