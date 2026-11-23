// 验证目标文字编辑：PATCH 携带 sessionId 与 objective，成功后更新当前目标，空值不发请求。
import assert from "node:assert/strict";
import test from "node:test";
import type { ChatGoalItem, ChatStoreSnapshot } from "../client/store/chat-types";
import type { ChatStorePort } from "../client/store/chat-store-port";
import { ChatSessionActions } from "../client/store/chat-session-actions";

const GOAL: ChatGoalItem = {
  id: "g1",
  title: "重组包",
  objective: "旧目标文字",
  status: "active",
  progress: { done: 1, total: 7 },
  updatedAt: 1,
  rounds: 0,
  maxRounds: 10,
  autoContinue: true,
};

function createPort() {
  const state = {
    activeSessionId: "s1",
    activeSession: { id: "s1", messages: [] },
    activeGoal: GOAL,
    errorMessage: "",
  } as unknown as ChatStoreSnapshot;
  const port = {
    getState: () => state,
    patchState: (patch: Partial<ChatStoreSnapshot>) => Object.assign(state, patch),
    refreshMeta: async () => undefined,
  } as unknown as ChatStorePort;
  return { port, state };
}

test("编辑目标文字通过 PATCH 提交并用服务端回读更新当前目标", async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl = "";
  let requestBody = "";
  let requestMethod = "";
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    requestUrl = String(url);
    requestMethod = init?.method ?? "";
    requestBody = String(init?.body ?? "");
    return new Response(JSON.stringify({ goal: { ...GOAL, objective: "新目标文字" } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  try {
    const { port, state } = createPort();
    const actions = new ChatSessionActions(port);
    assert.equal(await actions.editGoal("  新目标文字  "), true);
    assert.equal(requestMethod, "PATCH");
    assert.match(requestUrl, /\/api\/goals\/g1$/u);
    assert.deepEqual(JSON.parse(requestBody), { sessionId: "s1", objective: "新目标文字" });
    assert.equal(state.activeGoal?.objective, "新目标文字");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("空目标文字不发请求并给出提示", async () => {
  const originalFetch = globalThis.fetch;
  let called = 0;
  globalThis.fetch = (async () => {
    called += 1;
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  try {
    const { port, state } = createPort();
    const actions = new ChatSessionActions(port);
    assert.equal(await actions.editGoal("   "), false);
    assert.equal(called, 0);
    assert.match(state.errorMessage, /不能为空/u);
  } finally {
    globalThis.fetch = originalFetch;
  }
});