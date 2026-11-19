// 验证模型请求静默退出、长推理限制及工具参数增量。
import assert from "node:assert/strict";
import test from "node:test";
import {
  completeAgentRound,
  modelRoundLimits,
  reasoningModelRoundLimits,
  resolveModelRoundLimits,
} from "../src/model-round";

const reply = { model: "mock", provider: "openai-compatible", content: "收到", toolCalls: [], finishReason: "stop" } as const;

test("按模型能力放宽轮次时限，纯推理不再沿用 55 秒阈值", () => {
  assert.deepEqual(resolveModelRoundLimits({ supportsReasoning: false }), modelRoundLimits);
  assert.deepEqual(resolveModelRoundLimits({ supportsReasoning: true }), reasoningModelRoundLimits);
  assert.ok(modelRoundLimits.reasoningMs >= 180_000, "普通模型连续纯推理至少保留 3 分钟");
  assert.ok(modelRoundLimits.totalMs >= 600_000, "普通模型单轮总时长至少 10 分钟");
  assert.ok(reasoningModelRoundLimits.reasoningMs >= 600_000, "思考型模型连续推理念少保留 10 分钟");
  assert.ok(reasoningModelRoundLimits.totalMs > modelRoundLimits.totalMs);
});

test("静默模型会停止并向底层请求发送取消", async () => {
  let signal: AbortSignal | undefined;
  const promise = completeAgentRound({
    complete: (input) => {
      signal = input.signal;
      return new Promise(() => {});
    },
  }, { messages: [] }, { idleMs: 20, totalMs: 300, reasoningChars: 30 });
  await assert.rejects(promise, /长时间未收到新的内容/u);
  assert.equal(signal?.aborted, true);
});

test("长时间只有推理时停止，实际参数增量能刷新进度", async () => {
  let activity = 0;
  const promise = completeAgentRound({
    complete: (input) => {
      input.onDelta?.({ type: "reasoning", text: "前三个" });
      input.onActivity?.();
      input.onDelta?.({ type: "reasoning", text: "再一直推理" });
      return new Promise(() => {});
    },
  }, { messages: [], onActivity: () => { activity += 1; } }, { idleMs: 1000, totalMs: 2000, reasoningChars: 4 });
  await assert.rejects(promise, /仅输出推理/u);
  assert.equal(activity, 1);
});

test("推理超过上限时只重试当前请求，并提示基于已完成的工具结果继续", async () => {
  let attempts = 0;
  let firstSignal: AbortSignal | undefined;
  const result = await completeAgentRound({
    complete: async (input) => {
      attempts += 1;
      if (attempts === 1) {
        firstSignal = input.signal;
        input.onDelta?.({ type: "reasoning", text: "持续推理没有进展" });
        return new Promise(() => {});
      }
      assert.ok(firstSignal?.aborted);
      assert.equal(input.messages[2]?.content, "已读取文件");
      assert.match(input.messages[0]?.content ?? "", /直接/u);
      return { ...reply, toolCalls: [] };
    },
  }, { messages: [
    { role: "system", content: "原始规则" },
    { role: "user", content: "继续" },
    { role: "tool", toolCallId: "existing", content: "已读取文件" },
  ] }, { idleMs: 1000, totalMs: 2000, reasoningChars: 4 });
  assert.equal(attempts, 2);
  assert.equal(result.content, reply.content);
});

test("同一数据块中的大量思考及后续正文不会误触发推理上限", async () => {
  const chunks: string[] = [];
  const result = await completeAgentRound({
    complete: async (input) => {
      input.onDelta?.({ type: "reasoning", text: "大量推理和正文同批到达" });
      input.onDelta?.({ type: "text", text: reply.content });
      return { ...reply, toolCalls: [] };
    },
  }, { messages: [], onDelta: (delta) => { if (delta.type === "text") chunks.push(delta.text ?? ""); } },
  { idleMs: 1000, totalMs: 2000, reasoningChars: 4 });
  assert.equal(result.content, reply.content);
  assert.deepEqual(chunks, [reply.content]);
});

test("临时连接失败只重试一次，并在持续失败时给出明确诊断", async () => {
  let attempts = 0;
  const networkError = new TypeError("fetch failed", { cause: Object.assign(new Error("socket"), { code: "ECONNRESET" }) });
  await assert.rejects(completeAgentRound({
    complete: async () => { attempts += 1; throw networkError; },
  }, { messages: [] }), /模型连接.*ECONNRESET/u);
  assert.equal(attempts, 2);
});

test("已经发送可见正文的请求发生连接失败时保留进度且不重放", async () => {
  let attempts = 0;
  await assert.rejects(completeAgentRound({
    complete: async (input) => {
      attempts += 1;
      input.onDelta?.({ type: "text", text: "已收到部分正文" });
      throw new TypeError("terminated");
    },
  }, { messages: [] }), /模型连接/u);
  assert.equal(attempts, 1);
});

test("连续低速纯推理也能提前重试，并报告真实重试原因", async () => {
  let calls = 0;
  const retries: string[] = [];
  const result = await completeAgentRound({
    complete: async (input) => {
      if (++calls > 1) return { ...reply, toolCalls: [] };
      input.onDelta?.({ type: "reasoning", text: "仍在生成" });
      return new Promise(() => {});
    },
  }, { messages: [], onRetry: (reason: string) => retries.push(reason) },
  { idleMs: 80, totalMs: 200, reasoningChars: 10_000, reasoningMs: 15 });
  assert.equal(result.content, reply.content);
  assert.deepEqual(retries, ["reasoning"]);
});
