// 验证运行内上下文压缩：保留首条 system、最近轮次与工具调用配对，并识别上下文超限错误。
import assert from "node:assert/strict";
import test from "node:test";
import type { LlmMessage } from "@lfaa/llm";
import { COMPACTION_MARKER, compactConversation, isContextOverflowError } from "../src/context-budget";

function buildConversation(rounds: number): LlmMessage[] {
  const messages: LlmMessage[] = [{ role: "system", content: "系统规则".repeat(200) }];
  for (let index = 1; index <= rounds; index += 1) {
    messages.push({ role: "user", content: `任务 ${index}`.repeat(50) });
    messages.push({
      role: "assistant",
      content: `处理 ${index}`,
      toolCalls: [{ id: `call-${index}`, name: "read_file", argumentsJson: `{"path":"file-${index}.ts"}` }],
    });
    messages.push({ role: "tool", toolCallId: `call-${index}`, name: "read_file", content: "X".repeat(5_000) });
  }
  messages.push({ role: "user", content: "最新请求：继续" });
  return messages;
}

test("超预算时压缩早期工具结果，保留最近轮次、工具配对与最新请求", () => {
  const messages = buildConversation(20);
  const result = compactConversation(messages, { budgetChars: 20_000, toolCapChars: 300, keepRecentRounds: 3 });

  assert.equal(result.compacted, true);
  assert.ok(result.truncatedResults > 0 || result.droppedMessages > 0);
  assert.equal(result.messages[0]!.role, "system");
  assert.ok(result.messages.some((message) => message.content.startsWith(COMPACTION_MARKER)));
  assert.equal(result.messages.at(-1)!.content, "最新请求：继续");

  for (let index = 0; index < result.messages.length; index += 1) {
    const message = result.messages[index]!;
    if (message.role !== "assistant" || (message.toolCalls?.length ?? 0) === 0) continue;
    const ids = message.toolCalls!.map((call) => call.id);
    const following = result.messages.slice(index + 1, index + 1 + ids.length);
    assert.deepEqual(following.map((item) => item.role), ids.map(() => "tool"));
    assert.deepEqual(following.map((item) => item.toolCallId), ids);
  }

  const small = compactConversation(
    [{ role: "system", content: "s" }, { role: "user", content: "u" }],
    { budgetChars: 1_000 },
  );
  assert.equal(small.compacted, false);
});

test("识别供应商上下文超限错误", () => {
  assert.equal(isContextOverflowError(new Error("This model's maximum context length is 65536 tokens")), true);
  assert.equal(isContextOverflowError(new Error("context_length_exceeded")), true);
  assert.equal(isContextOverflowError(new Error("上下文长度超出限制")), true);
  assert.equal(isContextOverflowError(new Error("fetch failed")), false);
});
