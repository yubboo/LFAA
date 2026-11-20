// 验证压缩服务：参数合并与回落、超预算时真的压缩、未超预算原样返回、溢出识别。
import assert from "node:assert/strict";
import { Context } from "@deepseek-ai/cordis";
import test from "node:test";
import { COMPACTION_MARKER, DEFAULT_CONTEXT_BUDGET_CHARS } from "@lfaa/context";
import type { LlmMessage } from "@lfaa/llm";
import { CompactionService, resolveCompactionOptions } from "../src/index";

function conversation(toolChars: number): LlmMessage[] {
  const messages: LlmMessage[] = [{ role: "system", content: "rules" }];
  for (let round = 0; round < 8; round += 1) {
    messages.push({ role: "user", content: `request ${round}` });
    messages.push({
      role: "assistant",
      content: "",
      toolCalls: [{ id: `c${round}`, name: "read_file", argumentsJson: "{}" }],
    });
    messages.push({ role: "tool", content: "x".repeat(toolChars), toolCallId: `c${round}` });
  }
  messages.push({ role: "user", content: "latest" });
  return messages;
}

test("参数合并：覆盖生效，非法值回落默认", () => {
  assert.equal(resolveCompactionOptions({}, {}).budgetChars, DEFAULT_CONTEXT_BUDGET_CHARS);
  assert.equal(resolveCompactionOptions({ budgetChars: 50_000 }, {}).budgetChars, 50_000);
  assert.equal(resolveCompactionOptions({ budgetChars: 1_000 }, {}).budgetChars, DEFAULT_CONTEXT_BUDGET_CHARS);
  assert.equal(resolveCompactionOptions({}, { budgetChars: 80_000 }).budgetChars, 80_000);
  assert.equal(resolveCompactionOptions({ toolCapChars: 300 }, {}).toolCapChars, 300);
});

test("超出预算时压缩早期工具结果并插入压缩标记", () => {
  const service = new CompactionService(new Context(), { budgetChars: 10_000, toolCapChars: 200 });
  const result = service.compact(conversation(2_000));
  assert.equal(result.compacted, true);
  assert.ok(result.truncatedResults > 0 || result.droppedMessages > 0);
  assert.ok(result.messages.some((message) => message.content.startsWith(COMPACTION_MARKER)));
  assert.equal(result.messages[0]?.content, "rules");
  assert.equal(result.messages.at(-1)?.content, "latest");
});

test("未超预算时原样返回，不插入压缩标记", () => {
  const service = new CompactionService(new Context());
  const result = service.compact(conversation(10));
  assert.equal(result.compacted, false);
  assert.equal(result.messages.some((message) => message.content.startsWith(COMPACTION_MARKER)), false);
});

test("单次调用参数可以覆盖服务默认值", () => {
  const service = new CompactionService(new Context(), { budgetChars: 1_000_000 });
  const small = service.compact(conversation(2_000));
  assert.equal(small.compacted, false);
  const forced = service.compact(conversation(2_000), { budgetChars: 10_000 });
  assert.equal(forced.compacted, true);
});

test("识别上下文超限错误", () => {
  const service = new CompactionService(new Context());
  assert.equal(service.isOverflow(new Error("prompt is too long: 200000 tokens")), true);
  assert.equal(service.isOverflow(new Error("network down")), false);
});