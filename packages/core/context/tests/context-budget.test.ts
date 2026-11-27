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

test("极低预算裁剪早期工具调用组时整组移除，不留下孤儿 tool 消息", () => {
  const messages: LlmMessage[] = [
    { role: "system", content: "S".repeat(200) },
    {
      role: "assistant",
      content: "第一组",
      toolCalls: [
        { id: "c1", name: "read_file", argumentsJson: "{}" },
        { id: "c2", name: "read_file", argumentsJson: "{}" },
      ],
    },
    { role: "tool", toolCallId: "c1", name: "read_file", content: "A".repeat(4_000) },
    { role: "tool", toolCallId: "c2", name: "read_file", content: "B".repeat(4_000) },
    {
      role: "assistant",
      content: "第二组",
      toolCalls: [{ id: "c3", name: "read_file", argumentsJson: "{}" }],
    },
    { role: "tool", toolCallId: "c3", name: "read_file", content: "C".repeat(4_000) },
    { role: "user", content: "最终任务" },
  ];
  const result = compactConversation(messages, { budgetChars: 4_000, toolCapChars: 200, keepRecentRounds: 1 });
  assert.equal(result.compacted, true);
  // 校验不存在任何前置不是对应 assistant(toolCalls) 的孤儿 tool 消息
  for (let i = 0; i < result.messages.length; i += 1) {
    const msg = result.messages[i]!;
    if (msg.role === "tool") {
      let ownerIdx = i - 1;
      while (ownerIdx >= 0 && result.messages[ownerIdx]!.role === "tool") ownerIdx -= 1;
      const owner = ownerIdx >= 0 ? result.messages[ownerIdx] : undefined;
      assert.equal(owner?.role, "assistant", `位置 ${i} 出现孤儿 tool 消息`);
      assert.ok(owner?.toolCalls?.some((c) => c.id === msg.toolCallId));
    }
  }
});

test("滞回压缩：触发后压至低水位且压缩标记使用静态 user 消息，后续追加新轮次不再连续改写前缀", () => {
  const messages = buildConversation(12);
  const first = compactConversation(messages, { budgetChars: 30_000, toolCapChars: 400, keepRecentRounds: 2 });
  assert.equal(first.compacted, true);
  // 只有 messages[0] 是 system，压缩标记使用 user 角色避免污染 Anthropic / Responses / Gemini 顶层 system 缓存。
  assert.equal(first.messages.filter((m) => m.role === "system").length, 1);
  const marker = first.messages.find((m) => m.content.startsWith(COMPACTION_MARKER));
  assert.equal(marker?.role, "user");
  assert.doesNotMatch(marker?.content ?? "", /\d+/u);

  // 追加一轮新工具交互后，由于已压到低水位，不应再次触发压缩改写前缀。
  const nextRound: LlmMessage[] = [
    ...first.messages,
    { role: "assistant", content: "继续处理", toolCalls: [{ id: "call-next", name: "read_file", argumentsJson: "{}" }] },
    { role: "tool", toolCallId: "call-next", name: "read_file", content: "Y".repeat(2_000) },
  ];
  const second = compactConversation(nextRound, { budgetChars: 30_000, toolCapChars: 400, keepRecentRounds: 2 });
  assert.equal(second.compacted, false);
});
