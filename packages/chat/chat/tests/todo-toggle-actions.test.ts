// 验证手动勾选任务：PATCH 携带完整清单，成功以服务端回读为准，仅当前会话生效。
import assert from "node:assert/strict";
import test from "node:test";
import type { ChatStoreSnapshot } from "../client/store/chat-types";
import type { ChatStorePort } from "../client/store/chat-store-port";
import { ChatSessionActions } from "../client/store/chat-session-actions";

const TODOS = [
  { id: "1", content: "读源码", status: "completed" as const },
  { id: "2", content: "写测试", status: "pending" as const },
];

function createPort(activeSessionId: string) {
  const state = {
    activeSessionId,
    activeSession: { id: "s1", messages: [], todos: TODOS },
  } as unknown as ChatStoreSnapshot;
  const port = {
    getState: () => state,
    patchState: (patch: Partial<ChatStoreSnapshot>) => Object.assign(state, patch),
    refreshMeta: async () => undefined,
    openSession: async () => undefined,
  } as unknown as ChatStorePort;
  return { port, state };
}

test("勾选任务通过 PATCH 提交完整清单，并用服务端回读更新当前会话", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody = "";
  let requestMethod = "";
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    requestMethod = init?.method ?? "";
    requestBody = String(init?.body ?? "");
    return new Response(JSON.stringify({ session: { id: "s1", messages: [], todos: TODOS } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  try {
    const { port, state } = createPort("s1");
    const actions = new ChatSessionActions(port);
    await actions.updateSessionTodos("s1", TODOS);
    assert.equal(requestMethod, "PATCH");
    assert.deepEqual(JSON.parse(requestBody).todos, TODOS);
    assert.deepEqual(state.activeSession?.todos, TODOS);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("非当前会话的勾选不会覆盖正在查看的会话", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({
    session: { id: "other", messages: [], todos: [] },
  }), { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch;
  try {
    const { port, state } = createPort("s1");
    const actions = new ChatSessionActions(port);
    await actions.updateSessionTodos("other", []);
    assert.deepEqual(state.activeSession?.todos, TODOS);
  } finally {
    globalThis.fetch = originalFetch;
  }
});