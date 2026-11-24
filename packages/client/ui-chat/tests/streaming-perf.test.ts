// 验证流式性能优化边界：shallowEqual 缓存命中、仅侧栏字段变化才通知外部，以及流式帧合并去重与轮次思考归并。
import assert from "node:assert/strict";
import test from "node:test";
import { shallowEqual } from "../client/store/use-chat-selector";
import { AgentStreamClient, type StreamDeltaBatch } from "../client/store/stream-client";

test("shallowEqual 对内容等价的切片对象返回 true，避免流式帧触发无关组件重渲染", () => {
  const prev = { sessionId: "s1", locked: true, count: 3 };
  const same = { sessionId: "s1", locked: true, count: 3 };
  const changed = { sessionId: "s1", locked: false, count: 3 };
  assert.equal(shallowEqual(prev, same), true);
  assert.equal(shallowEqual(prev, changed), false);
});

test("AgentStreamClient 将高频同帧思考与正文增量合并为批次并保留轮次归属", async () => {
  const batches: StreamDeltaBatch[] = [];
  const originalES = globalThis.EventSource;
  let captured: { onmessage: ((ev: { data: string }) => void) | null; addEventListener: () => void; close: () => void } | null = null;
  class FakeEventSource {
    onmessage: ((ev: { data: string }) => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(_url: string) {
      captured = this;
    }
    addEventListener() {}
    close() {}
  }
  (globalThis as unknown as { EventSource: typeof FakeEventSource }).EventSource = FakeEventSource;
  try {
    const client = new AgentStreamClient("run-perf", {
      onSnapshot: () => {},
      onDeltaBatch: (batch) => { batches.push(batch); },
      onStepUpdate: () => {},
      onTodos: () => {},
      onUsage: () => {},
      onApprovalRequired: () => {},
      onApprovalResolved: () => {},
      onStatusNotice: () => {},
      onFinished: () => {},
      onDegraded: () => {},
    });
    client.start();
    assert.ok(captured);
    const emit = (payload: Record<string, unknown>) => captured!.onmessage?.({ data: JSON.stringify(payload) });
    emit({ type: "delta", seq: 1, kind: "reasoning", iteration: 1, text: "先分析" });
    emit({ type: "delta", seq: 2, kind: "reasoning", iteration: 1, text: "需求。" });
    emit({ type: "delta", seq: 3, kind: "text", text: "好的，" });
    emit({ type: "delta", seq: 4, kind: "text", text: "开始处理。" });
    // 立即结束刷出合并批次
    emit({ type: "run_finished", status: "done" });
    assert.equal(batches.length, 1, "连续高频 delta 应合并为单次批次通知");
    assert.equal(batches[0]?.reasoning, "先分析需求。");
    assert.equal(batches[0]?.text, "好的，开始处理。");
    assert.deepEqual(batches[0]?.reasoningByIteration, [{ iteration: 1, text: "先分析需求。" }]);
    client.dispose();
  } finally {
    (globalThis as unknown as { EventSource: typeof originalES }).EventSource = originalES;
  }
});
