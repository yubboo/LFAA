/**
 * 功能：验证上下文分项估算使用本次实际消息与工具定义。
 * 作用：确保图片请求显式标注并计入保守的固定预算，估算总量由分项相加得到。
 * 关联文件：packages/llm/token-meter/src/estimate.ts。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { estimateContextBreakdown, estimateMessage, estimatePromptTokens } from "../../../packages/llm/token-meter/src/estimate.ts";
import { assessContextPressure, estimateMessagesTokens, manageContextBeforeRequest } from "../../../packages/core/agent-loop/src/runtime-context.ts";

test("上下文估算根据实际请求消息和工具 schema 分项", () => {
  const result = estimateContextBreakdown([
    { role: "system", content: "system" },
    { role: "user", content: [{ type: "text", text: "four" }, { type: "image_url", image_url: { url: "data:image/png;base64,AA==" } }] }
  ], [{ type: "function", function: { name: "read_file", description: "read", parameters: { type: "object", properties: {} } } }]);

  assert.equal(result.systemTokens, 7);
  // 文本 6 tokens + 图片保守折算 1200 tokens：大图请求必须进入预算，不能算 0。
  assert.equal(result.messageTokens, 1206);
  assert.ok(result.toolsTokens > 0);
  assert.equal(result.estimatedPromptTokens, result.systemTokens + result.toolsTokens + result.messageTokens);
  assert.equal(result.includesImages, true);
  assert.equal(estimateMessage({ role: "user", content: [{ type: "text", text: "four" }, { type: "image_url", image_url: { url: "data:image/png;base64,AA==" } }] }), result.messageTokens);
  assert.equal(estimatePromptTokens([
    { role: "system", content: "system" },
    { role: "user", content: [{ type: "text", text: "four" }, { type: "image_url", image_url: { url: "data:image/png;base64,AA==" } }] }
  ], [{ type: "function", function: { name: "read_file", description: "read", parameters: { type: "object", properties: {} } } }]), result.estimatedPromptTokens);
});

test("压缩压力复用请求 Token Meter，覆盖 system、工具、图片与 reasoning replay", () => {
  const messages = [
    { role: "system", content: "system context" },
    { role: "assistant", content: null, tool_calls: [{ id: "call-1", type: "function", function: { name: "read_file", arguments: '{"path":"src/index.ts"}' } }] },
    { role: "tool", tool_call_id: "call-1", content: [{ type: "text", text: "fixture output" }, { type: "image_url", image_url: { url: "data:image/png;base64,AA==" } }] },
    { role: "assistant", content: null, providerReplay: { accountId: "a", providerId: "p", modelId: "m", reasoningContent: "private continuation" } }
  ];
  const tools = [{ type: "function", function: { name: "read_file", description: "Read a project file", parameters: { type: "object", properties: { path: { type: "string" } } } } }];
  const expected = estimateContextBreakdown(messages, tools).estimatedPromptTokens;
  const pressure = assessContextPressure(messages, 4096, tools);
  const messagesWithoutReplay = messages.map(({ providerReplay: _replay, ...message }) => message);
  const withoutReplay = estimateContextBreakdown(messagesWithoutReplay, tools);
  const replayExcluded = estimateContextBreakdown(messages, tools, 0);
  const effectiveReplayCharacters = "private continuation".length;
  const replayIncluded = estimateContextBreakdown(messages, tools, effectiveReplayCharacters);

  assert.equal(estimateMessagesTokens(messages, tools), expected);
  assert.equal(pressure.usedTokens, expected);
  assert.equal(replayExcluded.messageTokens, withoutReplay.messageTokens);
  assert.equal(replayIncluded.messageTokens, withoutReplay.messageTokens + Math.ceil(effectiveReplayCharacters / 4));
  assert.equal(estimatePromptTokens(messages, tools, 0), replayExcluded.estimatedPromptTokens);
  assert.equal(estimatePromptTokens(messages, tools, effectiveReplayCharacters), replayIncluded.estimatedPromptTokens);
  assert.equal(estimateMessagesTokens(messages, tools, 0), replayExcluded.estimatedPromptTokens);
  assert.equal(estimateMessagesTokens(messages, tools, effectiveReplayCharacters), replayIncluded.estimatedPromptTokens);
  assert.equal(assessContextPressure(messages, 4096, tools, 0).usedTokens, replayExcluded.estimatedPromptTokens);
  assert.equal(assessContextPressure(messages, 4096, tools, effectiveReplayCharacters).usedTokens, replayIncluded.estimatedPromptTokens);
  assert.equal(pressure.systemTokens > 0, true);
  assert.equal(pressure.toolsTokens > 0, true);
  assert.equal(pressure.includesImages, true);
});

test("压缩后返回最终上下文压力，而不是压缩前的估算", async () => {
  const messages = [
    { role: "system", content: "s".repeat(3_200) },
    { role: "user", content: "保留当前用户任务" }
  ];
  const tools = [{ type: "function", function: { name: "read_file", description: "Read", parameters: { type: "object", properties: {} } } }];
  const result = await manageContextBeforeRequest({
    messages,
    tools,
    contextWindow: 1_000,
    hooks: {
      compact: async () => [
        { role: "system", content: "精简角色约束" },
        { role: "user", content: "保留当前用户任务" }
      ]
    }
  });

  const expected = assessContextPressure(result.messages, 1_000, tools);
  assert.equal(result.rewritten, true);
  assert.deepEqual(result.pressure, expected);
  assert.equal(result.pressure.needsCompaction, false);
  assert.ok(result.pressure.usedTokens < assessContextPressure(messages, 1_000, tools).usedTokens);
});
