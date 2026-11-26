// 验证流式性能优化边界：shallowEqual 缓存命中、仅侧栏字段变化才通知外部、流式帧合并去重与轮次思考归并、
// 以及历史建议前缀在内容未变时复用旧引用（否则消息行的 memo 会被新数组打穿）。
import assert from "node:assert/strict";
import test from "node:test";
import { shallowEqual } from "../client/store/use-chat-selector";
import { AgentStreamClient, type StreamDeltaBatch } from "../client/store/stream-client";
import { collectPriorSuggestions, stabilizePriorSuggestions } from "../client/conversation/prior-suggestions";
import type { ChatMessageItem } from "../client/store/chat-types";

/** 构造只带建议解析所需字段的消息，供前缀计算用例复用。 */
function message(id: string, role: "user" | "assistant", content: string): ChatMessageItem {
  return { id, role, content, createdAt: 0, status: "done" } as ChatMessageItem;
}

test("shallowEqual 对内容等价的切片对象返回 true，避免流式帧触发无关组件重渲染", () => {
  const prev = { sessionId: "s1", locked: true, count: 3 };
  const same = { sessionId: "s1", locked: true, count: 3 };
  const changed = { sessionId: "s1", locked: false, count: 3 };
  assert.equal(shallowEqual(prev, same), true);
  assert.equal(shallowEqual(prev, changed), false);
});

test("历史建议前缀在内容未变时复用旧引用，内容变化时才换新数组", () => {
  const history = [
    message("u1", "user", "先看下性能"),
    message("a1", "assistant", "已定位热点。<!--suggestions:[\"继续优化\"]-->"),
    message("u2", "user", "继续"),
    message("a2", "assistant", "下一步做虚拟列表。"),
  ];
  const first = collectPriorSuggestions(history);
  assert.deepEqual(first[0], []);
  assert.deepEqual(first[1], []);
  assert.deepEqual(first[2], ["继续优化"], "第三条消息应看到上一轮给出的建议");
  assert.deepEqual(first[3], ["继续优化"]);

  // 同一份内容重新算一遍：数组身份不同，但稳定化后必须复用第一次的引用。
  const second = collectPriorSuggestions(history);
  const stable = stabilizePriorSuggestions(first, second);
  assert.equal(stable[0], first[0]);
  assert.equal(stable[1], first[1]);
  assert.equal(stable[2], first[2], "建议内容相同时应沿用旧数组，保住消息行的 memo");
  assert.equal(stable[3], first[3]);

  // 建议内容真的变了：只允许受影响的那一条换新引用。
  const changed = collectPriorSuggestions([
    history[0]!,
    message("a1", "assistant", "已定位热点。<!--suggestions:[\"改成虚拟列表\"]-->"),
    history[2]!,
    history[3]!,
  ]);
  const afterChange = stabilizePriorSuggestions(first, changed);
  assert.equal(afterChange[0], first[0]);
  assert.equal(afterChange[1], first[1]);
  assert.notEqual(afterChange[2], first[2]);
  assert.deepEqual(afterChange[2], ["改成虚拟列表"]);
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
