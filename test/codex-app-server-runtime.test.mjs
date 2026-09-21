/**
 * 文件：codex-app-server-runtime.test.mjs
 * 作用：锁定 ChatGPT/Codex 套餐从 model/list 继续进入 thread/turn 的真实 Runtime 契约。
 * 负责：验证多轮 thread 复用、流式 Agent Message、最终文本、reasoning effort 与 turn/interrupt。
 * 不负责：启动真实 Codex CLI、OAuth 登录、网络请求、UI 视觉验收。
 * 状态归属：测试内 Fake Client，无持久状态。
 * 对外接口：`node --test --experimental-strip-types test/codex-app-server-runtime.test.mjs`。
 * 关联文件：packages/harness/codex-app-server/src/codex-app-server.ts、packages/api/agent-controller/src/agent-runtime-bridge.ts。
 * 修改注意事项：不得用静态字符串断言替代 thread/turn 行为测试；新增 Codex Runtime 生命周期必须补对应 Fake Client 场景。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { CodexAppServerTextRuntime } from "../packages/harness/codex-app-server/src/codex-app-server.ts";

class FakeCodexClient {
  generation = 1;
  listeners = new Set();
  calls = [];
  turnNumber = 0;
  completeTurns = true;
  turnStartGate = null;

  async ensureStarted() {}

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(method, params) {
    for (const listener of this.listeners) listener(method, params);
  }

  async request(method, params = {}) {
    this.calls.push({ method, params });
    if (method === "thread/start") return { thread: { id: "thr_test" } };
    if (method === "turn/start") {
      const turnId = `turn_${++this.turnNumber}`;
      if (this.turnStartGate) await this.turnStartGate;
      if (this.completeTurns) {
        queueMicrotask(() => {
          this.emit("item/agentMessage/delta", { threadId: params.threadId, turnId, itemId: "msg_1", delta: "你" });
          this.emit("item/agentMessage/delta", { threadId: params.threadId, turnId, itemId: "msg_1", delta: "好" });
          this.emit("item/completed", { threadId: params.threadId, turnId, item: { type: "agentMessage", id: "msg_1", text: "你好！", phase: "final_answer" } });
          this.emit("turn/completed", { turn: { id: turnId, status: "completed", items: [], error: null } });
        });
      }
      return { turn: { id: turnId, status: "inProgress", items: [], error: null } };
    }
    if (method === "turn/interrupt") return {};
    throw new Error(`unexpected method: ${method}`);
  }

  dispose() {}
}

test("Codex text runtime creates one thread and reuses it across turns", async () => {
  const client = new FakeCodexClient();
  const runtime = new CodexAppServerTextRuntime(client);
  const deltas = [];
  const first = await runtime.runText({
    sessionKey: "workspace:account:model",
    modelId: "gpt-5.6-luna",
    input: "你好",
    cwd: "/tmp/lfaa",
    reasoningEffort: "medium",
    signal: new AbortController().signal,
    onTextDelta: (delta) => deltas.push(delta),
  });
  const second = await runtime.runText({
    sessionKey: "workspace:account:model",
    modelId: "gpt-5.6-luna",
    input: "继续",
    cwd: "/tmp/lfaa",
    signal: new AbortController().signal,
  });

  assert.equal(first.threadId, "thr_test");
  assert.equal(first.text, "你好！");
  assert.equal(second.threadId, "thr_test");
  assert.deepEqual(deltas, ["你", "好"]);
  assert.equal(client.calls.filter((call) => call.method === "thread/start").length, 1);
  assert.equal(client.calls.filter((call) => call.method === "turn/start").length, 2);
  const firstTurn = client.calls.find((call) => call.method === "turn/start");
  assert.equal(firstTurn.params.model, "gpt-5.6-luna");
  assert.equal(firstTurn.params.effort, "medium");
  assert.equal(firstTurn.params.approvalPolicy, "never");
  assert.deepEqual(firstTurn.params.sandboxPolicy, { type: "readOnly", access: { type: "fullAccess" } });
});

test("Codex text runtime converts AbortSignal into turn/interrupt", async () => {
  const client = new FakeCodexClient();
  client.completeTurns = false;
  const runtime = new CodexAppServerTextRuntime(client);
  const abort = new AbortController();
  const running = runtime.runText({
    sessionKey: "abort-session",
    modelId: "gpt-5.6-luna",
    input: "等待取消",
    cwd: "/tmp/lfaa",
    signal: abort.signal,
  });
  await new Promise((resolve) => setImmediate(resolve));
  abort.abort();
  await assert.rejects(running, (error) => error?.name === "AbortError");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(client.calls.some((call) => call.method === "turn/interrupt" && call.params.turnId === "turn_1"), true);
});

test("Codex cancellation before turn/start responds does not leave an unhandled rejection", async () => {
  const client = new FakeCodexClient();
  client.completeTurns = false;
  let releaseTurnStart;
  client.turnStartGate = new Promise((resolve) => { releaseTurnStart = resolve; });
  const runtime = new CodexAppServerTextRuntime(client);
  const abort = new AbortController();
  const running = runtime.runText({
    sessionKey: "delayed-turn-start",
    modelId: "gpt-5.6-luna",
    input: "等待取消",
    cwd: "/tmp/lfaa",
    signal: abort.signal,
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(client.calls.some((call) => call.method === "turn/start"), true);
  abort.abort();
  await new Promise((resolve) => setImmediate(resolve));
  releaseTurnStart();
  await assert.rejects(running, (error) => error?.name === "AbortError");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(client.calls.some((call) => call.method === "turn/interrupt" && call.params.turnId === "turn_1"), true);
});
