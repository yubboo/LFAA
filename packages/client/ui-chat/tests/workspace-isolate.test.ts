// 验证工作区占用后的「用工作树并行」：创建 worktree → 绑定会话 → 清掉冲突提示；未绑定项目时不发请求。
import assert from "node:assert/strict";
import test from "node:test";
import type { ChatSessionDetail, ChatStoreSnapshot } from "../client/store/chat-types";
import type { ChatStorePort } from "../client/store/chat-store-port";
import { ChatSessionActions } from "../client/store/chat-session-actions";

test("创建工作树并把当前会话绑定过去，成功清掉冲突提示", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; method: string; body: string }> = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), method: init?.method ?? "", body: String(init?.body ?? "") });
    if (String(url) === "/api/worktrees") {
      return new Response(JSON.stringify({ worktree: { id: "wt-1", branch: "parallel-x", path: "C:/w" } }), { status: 201 });
    }
    return new Response(JSON.stringify({
      session: {
        id: "s1",
        projectId: "p1",
        messages: [],
        worktree: { id: "wt-1", branch: "parallel-x", path: "C:/w", projectId: "p1" },
      },
    }), { status: 200 });
  }) as typeof fetch;

  const state = {
    activeSessionId: "s1",
    activeSession: { id: "s1", projectId: "p1", messages: [] },
    sessions: [{ id: "s1", title: "会话" }],
    errorMessage: "工作区正被「会话一」占用。",
    workspaceConflict: true,
  } as unknown as ChatStoreSnapshot;
  const port = {
    getState: () => state,
    patchState: (patch: Partial<ChatStoreSnapshot>) => Object.assign(state, patch),
  } as unknown as ChatStorePort;

  try {
    const actions = new ChatSessionActions(port);
    assert.equal(await actions.isolateWorkspace(), true);
    assert.equal(calls.length, 2);
    assert.equal(calls[0]?.url, "/api/worktrees");
    assert.equal(JSON.parse(calls[0]?.body ?? "{}").projectId, "p1");
    assert.match(calls[1]?.url ?? "", /\/api\/chat\/sessions\/s1$/u);
    assert.deepEqual(JSON.parse(calls[1]?.body ?? "{}"), { worktreeId: "wt-1" });
    assert.equal((state.activeSession as ChatSessionDetail).worktree?.id, "wt-1");
    assert.equal(state.workspaceConflict, false);
    assert.equal(state.errorMessage, "");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("未绑定项目时直接提示，不发请求", async () => {
  const originalFetch = globalThis.fetch;
  let called = 0;
  globalThis.fetch = (async () => {
    called += 1;
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  const state = {
    activeSessionId: "s1",
    activeSession: { id: "s1", messages: [] },
    sessions: [],
    errorMessage: "",
    workspaceConflict: true,
  } as unknown as ChatStoreSnapshot;
  const port = {
    getState: () => state,
    patchState: (patch: Partial<ChatStoreSnapshot>) => Object.assign(state, patch),
  } as unknown as ChatStorePort;
  try {
    const actions = new ChatSessionActions(port);
    assert.equal(await actions.isolateWorkspace(), false);
    assert.equal(called, 0);
    assert.match(state.errorMessage, /未绑定项目/u);
  } finally {
    globalThis.fetch = originalFetch;
  }
});