// 验证模型请求静默退出、长推理限制及工具参数增量。
import assert from "node:assert/strict";
import test from "node:test";
import { completeAgentRound } from "../src/model-round";

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
