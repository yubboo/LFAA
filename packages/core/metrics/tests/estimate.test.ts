// 验证上下文 token 估算与 DSH token-meter 的固定密度口径一致。
import assert from "node:assert/strict";
import test from "node:test";
import { estimateMessageTokens, estimateSystemPromptTokens, estimateToolsTokens } from "../src/estimate";

test("与 DSH token-meter 源码实测值一致", () => {
  // 直接运行 @deepseek-ai/dsh-token-meter/estimate 的源码得到 11。
  assert.equal(estimateMessageTokens({ role: "user", content: "hello world" }), 11);
  assert.equal(estimateSystemPromptTokens("abcd"), 5);
  assert.equal(estimateSystemPromptTokens(""), 0);
  assert.equal(estimateToolsTokens([]), 0);
  assert.ok(estimateToolsTokens([{ name: "read_file", description: "Read a file", parameters: { type: "object" } }]) > 0);
});

test("工具调用与推理内容计入块开销", () => {
  const plain = estimateMessageTokens({ role: "assistant", content: "done" });
  const withCall = estimateMessageTokens({
    role: "assistant",
    content: "done",
    toolCalls: [{ id: "c1", name: "read_file", argumentsJson: '{"path":"a.ts"}' }],
  });
  const withReasoning = estimateMessageTokens({ role: "assistant", content: "done", reasoningContent: "思考一下" });
  assert.ok(withCall > plain);
  assert.ok(withReasoning > plain);
  assert.equal(estimateMessageTokens({ role: "assistant", content: "" }), 4);
});
