// 验证运行事件归并：增量追加、步骤 upsert、结束时的队列接续与错误落盘、断流降级。
// 用假 ChatStorePort 直接触发回调，不启动 SSE、不依赖浏览器。
import assert from "node:assert/strict";
import test from "node:test";
import type { AgentStepItem, ChatMessageItem, ChatStoreSnapshot } from "../client/store/chat-types";
import type { ChatStorePort } from "../client/store/chat-store-port";
import { createRunStreamHandlers } from "../client/store/run-stream-handler";

/** 等两轮微任务，让 onFinished/onDegraded 里的 promise 链跑完。 */
async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function assistantMessage(): ChatMessageItem {
  return { id: "a1", role: "assistant", content: "", createdAt: 1, steps: [] };
}

function createPort(overrides: Partial<ChatStoreSnapshot> = {}) {
  const state = {
    activeSessionId: "s1",
    activeSession: { id: "s1", messages: [assistantMessage()] },
    generalSettings: { enableApprovalNotification: false, notificationSound: "none", approvalSound: "none" },
    queuedMessages: [],
    pendingApproval: null,
    streamStatusNotice: "",
    degradedStream: null,
    ...overrides,
  } as unknown as ChatStoreSnapshot;
  const patches: Array<Partial<ChatStoreSnapshot>> = [];
  const calls = {
    markRunning: [] as Array<[string, boolean]>,
    notify: 0,
    sent: [] as string[],
    updateMeta: [] as Array<[string, unknown]>,
    opened: [] as string[],
    refreshMeta: 0,
    refreshGoal: 0,
    closed: 0,
  };
  const port = {
    getState: () => state,
    patchState: (patch: Partial<ChatStoreSnapshot>) => {
      Object.assign(state, patch);
      patches.push(patch);
    },
    refreshGoal: async () => { calls.refreshGoal += 1; },
    markSessionRunning: (id: string, running: boolean) => { calls.markRunning.push([id, running]); },
    notifyRunFinished: () => { calls.notify += 1; },
    sendMessage: async (text: string) => { calls.sent.push(text); },
    updateSessionMeta: async (id: string, patch: unknown) => { calls.updateMeta.push([id, patch]); },
    openSession: async (id: string) => { calls.opened.push(id); },
    refreshMeta: async () => { calls.refreshMeta += 1; },
  } as unknown as ChatStorePort;
  return { port, state, patches, calls };
}

function handlersFor(port: ChatStorePort, onStreamClosed: () => void = () => undefined) {
  return createRunStreamHandlers({
    port,
    runId: "r1",
    sessionId: "s1",
    assistantMessageId: "a1",
    onStreamClosed,
  });
}

test("增量批次分别追加到正文与思考内容", () => {
  const { port, state } = createPort();
  const handlers = handlersFor(port);
  handlers.onDeltaBatch({ text: "你好", reasoning: "先想想" });
  handlers.onDeltaBatch({ text: "，世界", reasoning: "" });
  const message = state.activeSession!.messages[0]!;
  assert.equal(message.content, "你好，世界");
  assert.equal(message.reasoning, "先想想");
});

test("步骤更新按 id 覆盖而不是重复追加", () => {
  const { port, state } = createPort();
  const handlers = handlersFor(port);
  handlers.onStepUpdate({ id: "s1", iteration: 1, phase: "think", status: "running", title: "思考", timestamp: 1 });
  handlers.onStepUpdate({ id: "s1", iteration: 1, phase: "think", status: "done", title: "思考完成", timestamp: 2 });
  const steps = state.activeSession!.messages[0]!.steps ?? [];
  assert.equal(steps.length, 1);
  assert.equal(steps[0]!.status, "done");
  assert.equal(steps[0]!.title, "思考完成");
});

test("浏览器预览在 SSE 订阅前完成时，仍从最终消息展开且只消费一次", () => {
  const { port } = createPort();
  const applied: string[] = [];
  port.applyAgentStepWorkbenchAction = (_sessionId, _messageId, step) => { applied.push(step.id); };
  const handlers = handlersFor(port);
  const step: AgentStepItem = { id: "preview", iteration: 1, phase: "act", toolName: "browser_present", status: "done", title: "预览已打开", timestamp: 1 };
  const message = { ...assistantMessage(), steps: [step] };
  handlers.onFinished({ status: "done", message });
  assert.deepEqual(applied, ["preview"]);
  handlers.onStepUpdate(step);
  assert.deepEqual(applied, ["preview"]);
});

test("按轮次流式思考增量实时写入对应 think 步骤，心跳更新不冲掉已累积思考内容", () => {
  const { port, state } = createPort();
  const handlers = handlersFor(port);
  handlers.onStepUpdate({ id: "think-1", iteration: 1, phase: "think", status: "running", title: "第 1 轮思考", timestamp: 1 });
  handlers.onDeltaBatch({
    text: "",
    reasoning: "先看配置文件",
    reasoningByIteration: [{ iteration: 1, text: "先看配置文件" }],
  });
  handlers.onStepUpdate({ id: "think-1", iteration: 1, phase: "think", status: "running", title: "第 1 轮思考", modelStage: "reasoning", timestamp: 2 });
  const thinkStep = state.activeSession!.messages[0]!.steps?.[0];
  assert.equal(thinkStep?.detail, "先看配置文件");
});

test("正常结束：清运行标记、落错误并自动接续排队消息", async () => {
  const { port, state, patches, calls } = createPort({
    queuedMessages: [
      { id: "q1", text: "下一条" },
      { id: "q2", text: "再下一条" },
    ] as ChatStoreSnapshot["queuedMessages"],
  });
  let closed = 0;
  const handlers = handlersFor(port, () => { closed += 1; });
  handlers.onFinished({ status: "error", error: "模型报错" });
  await flush();

  assert.equal(closed, 1, "结束必须回调 onStreamClosed");
  assert.deepEqual(calls.markRunning, [["s1", false]]);
  assert.equal(patches.some((patch) => patch.errorMessage === "模型报错"), true);
  assert.equal(state.runningRunId, null);
  assert.deepEqual(state.queuedMessages.map((item) => item.id), ["q2"], "队首被取走");
  assert.deepEqual(calls.sent, ["下一条"], "队首自动发送");
  assert.deepEqual(calls.updateMeta, [["s1", { unread: false }]]);
});

test("断流降级：记录降级状态并按会话 ID 回读服务端已保存内容", async () => {
  const { port, state } = createPort();
  const originalFetch = globalThis.fetch;
  let requested = "";
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requested = String(input);
    return new Response(JSON.stringify({ session: { id: "s1", title: "已保存", messages: [] } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  try {
    const handlers = handlersFor(port);
    handlers.onDegraded(7, "timeout");
    assert.equal(state.degradedStream?.lastSeq, 7);
    assert.match(state.streamStatusNotice, /流式连接中断/u);
    await flush();
    assert.match(requested, /\/api\/chat\/sessions\/s1/u);
    assert.equal(state.activeSession?.title, "已保存");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
