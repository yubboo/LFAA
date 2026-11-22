// 验证交接动作：加载待接手、接手后移除并刷新目标、忽略只本地移除。
import assert from "node:assert/strict";
import test from "node:test";
import type { ChatGoalItem, ChatHandoffItem, ChatStoreSnapshot } from "../client/store/chat-types";
import type { ChatStorePort } from "../client/store/chat-store-port";
import { ChatSessionActions } from "../client/store/chat-session-actions";

const HANDOFF: ChatHandoffItem = {
  id: "h1",
  title: "接手任务",
  summary: "把 B2 做完",
  nextSteps: ["跑门禁"],
  fromSessionId: "s1",
  projectId: "p1",
  createdAt: 1,
};

const GOAL: ChatGoalItem = {
  id: "g1",
  title: "接手任务",
  objective: "把 B2 做完",
  status: "active",
  progress: { done: 0, total: 0 },
  updatedAt: 2,
  rounds: 0,
  maxRounds: 10,
  autoContinue: true,
};

function createPort() {
  const state = {
    activeSessionId: "s2",
    activeSession: { id: "s2", projectId: "p1", messages: [] },
    activeGoal: null,
    handoffs: [],
    errorMessage: "",
  } as unknown as ChatStoreSnapshot;
  const port = {
    getState: () => state,
    patchState: (patch: Partial<ChatStoreSnapshot>) => Object.assign(state, patch),
  } as unknown as ChatStorePort;
  return { port, state };
}

test("加载待接手交接并带项目过滤", async () => {
  const originalFetch = globalThis.fetch;
  let url = "";
  globalThis.fetch = (async (input: string) => {
    url = String(input);
    return new Response(JSON.stringify({ handoffs: [HANDOFF] }), { status: 200 });
  }) as typeof fetch;
  try {
    const { port, state } = createPort();
    const actions = new ChatSessionActions(port);
    await actions.loadHandoffs("s2");
    assert.match(url, /\/api\/handoffs\?sessionId=s2&direction=incoming&projectId=p1$/u);
    assert.deepEqual(state.handoffs.map((item) => item.id), ["h1"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("接手后移除交接并刷新目标", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input: string, init?: RequestInit) => {
    const target = String(input);
    calls.push(`${init?.method ?? "GET"} ${target}`);
    if (target.endsWith("/accept")) {
      return new Response(JSON.stringify({ handoff: { ...HANDOFF, status: "accepted" }, goal: GOAL }), { status: 200 });
    }
    return new Response(JSON.stringify({ goals: [GOAL] }), { status: 200 });
  }) as typeof fetch;
  try {
    const { port, state } = createPort();
    state.handoffs = [HANDOFF];
    const actions = new ChatSessionActions(port);
    assert.equal(await actions.acceptHandoff("h1"), true);
    assert.ok(calls.some((call) => call.startsWith("POST /api/handoffs/h1/accept")));
    assert.deepEqual(state.handoffs, []);
    assert.equal(state.activeGoal?.id, "g1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("忽略只移除本地条目，不发请求", () => {
  const originalFetch = globalThis.fetch;
  let called = 0;
  globalThis.fetch = (async () => {
    called += 1;
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  try {
    const { port, state } = createPort();
    state.handoffs = [HANDOFF];
    new ChatSessionActions(port).dismissHandoff("h1");
    assert.equal(called, 0);
    assert.deepEqual(state.handoffs, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});