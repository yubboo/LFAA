// 验证强制压缩请求：一次性消费、真实压缩生效、未请求时不强压；工具端到端登记请求。
import assert from "node:assert/strict";
import { Context } from "@deepseek-ai/cordis";
import test from "node:test";
import { COMPACTION_MARKER } from "@lfaa/context";
import type { LlmMessage } from "@lfaa/llm";
import { toolsPlugin, type ToolExecutionContext } from "@lfaa/tools";
import { CompactionService } from "../src/basic";
import commandCompactPlugin, { compactRequestedMessage } from "../src/command";

function execContext(): ToolExecutionContext {
  return { workspaceRoots: [process.cwd()], sessionId: "s1", runId: "r1", signal: new AbortController().signal };
}

/** 构造一段未超默认预算、但超过强制预算的对话。 */
function mediumConversation(): LlmMessage[] {
  const messages: LlmMessage[] = [{ role: "system", content: "rules" }];
  for (let round = 0; round < 4; round += 1) {
    messages.push({ role: "user", content: `request ${round}` });
    messages.push({ role: "assistant", content: "", toolCalls: [{ id: `c${round}`, name: "read_file", argumentsJson: "{}" }] });
    messages.push({ role: "tool", content: "x".repeat(1_500), toolCallId: `c${round}` });
  }
  messages.push({ role: "user", content: "latest" });
  return messages;
}

test("未请求时不强制压缩（默认预算远大于内容）", () => {
  const service = new CompactionService(new Context());
  const result = service.compact(mediumConversation());
  assert.equal(result.compacted, false);
  assert.equal(service.hasPendingRequest, false);
});

test("请求强制压缩后立即生效，且请求只消费一次", () => {
  const service = new CompactionService(new Context());
  service.requestCompaction();
  assert.equal(service.hasPendingRequest, true);
  const forced = service.compact(mediumConversation());
  assert.equal(forced.compacted, true);
  assert.ok(forced.messages.some((message) => message.content.startsWith(COMPACTION_MARKER)));
  assert.equal(service.hasPendingRequest, false);
  const again = service.compact(mediumConversation());
  assert.equal(again.compacted, false);
});

test("工具端到端：调用 compact_context 登记请求并返回说明", async () => {
  const ctx = new Context();
  await ctx.plugin(toolsPlugin, { includeBuiltins: false });
  const service = new CompactionService(ctx);
  await ctx.plugin(commandCompactPlugin);
  const result = await ctx.tools.executeTool("compact_context", {}, execContext());
  assert.equal(result.ok, true);
  assert.equal(result.metadata?.compactionRequested, true);
  assert.equal(service.hasPendingRequest, true);
  assert.match(result.output, /下一次模型调用前/u);
  assert.match(compactRequestedMessage(), /强制压缩/u);
});