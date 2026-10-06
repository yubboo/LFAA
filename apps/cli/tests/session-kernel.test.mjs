/**
 * 功能：验证 LFAA Session 内核事件不变量、派生视图、fork 修复与 Store 生命周期。
 * 作用：使用内存内核覆盖与 Provider、账户数据无关的纯行为；JSONL/Owner 集成由专用存储回归覆盖。
 */
import test from "node:test";
import assert from "node:assert/strict";

const { SessionKernel, SessionStore, SessionPreparation, snapshotSessionJson, encodeSessionSeqRanges, decodeSessionSeqRanges } = await import("lfaa-session/src/kernel.js");

function fixture() {
  const session = new SessionKernel("kernel-source");
  session.append("session/created", { ownerId: "owner", appId: "workspace", createdAt: "2026-10-04T00:00:00.000Z" });
  session.append("session/title", { title: "内核测试" });
  session.append("turn/start", { turnId: "run-1", userMessageId: "user-1", assistantMessageId: "run-1" });
  session.append("user/message", { messageId: "user-1", content: "读取状态" });
  session.append("step/start", { turnId: "run-1", step: 1 });
  session.append("request/header", {
    runId: "run-1", appId: "workspace", providerId: "provider-a", modelId: "model-a", permissionMode: "ask",
    settings: { maxTokens: 4096 }, tools: [{ type: "function", function: { name: "read_status", description: "读取状态", parameters: { type: "object", properties: {} } } }]
  });
  session.append("request/context", { runId: "run-1", messages: [{ role: "system", content: "工作区系统消息" }, { role: "user", content: "读取状态" }] });
  session.append("assistant/response", { runId: "run-1", message: { role: "assistant", content: null, tool_calls: [{ id: "call-1", type: "function", function: { name: "read_status", arguments: "{}" } }] } });
  session.append("tool/call", { runId: "run-1", callId: "call-1", name: "read_status", arguments: "{}", dispatched: true, headerSeq: 6 });
  return session;
}

test("Session 事件做 JSON 快照、不可变且要求连续序号", () => {
  const session = new SessionKernel("kernel-copy");
  const content = { nested: { text: "原始内容" } };
  const event = session.append("user/message", { messageId: "user-1", content: content.nested.text });
  const observed = [];
  const unsubscribe = session.subscribe(item => observed.push(item.seq));
  session.append("assistant/message", { messageId: "run-1", content: "回复", status: "complete" });
  unsubscribe();
  session.append("turn/end", { turnId: "run-1", status: "complete" });
  assert.deepEqual(observed, [2]);
  content.nested.text = "后来修改";
  assert.equal(event.data.content, "原始内容");
  assert.equal(Object.isFrozen(event), true);
  assert.equal(Object.isFrozen(event.data), true);
  assert.throws(() => session.append("user/message", { messageId: "bad", content: undefined }), /JSON/);
  assert.throws(() => snapshotSessionJson(Number.NaN), /JSON/);
  const cyclic = {}; cyclic.self = cyclic;
  assert.throws(() => snapshotSessionJson(cyclic), /循环引用/);
  assert.throws(() => new SessionKernel("broken", [{ ...event, seq: 2 }]), /序号/);
  assert.throws(() => new SessionKernel("kernel-copy", [{ ...event, data: { messageId: "x" } }]), /载荷/);
});

test("计划模式使用类型化事件并在恢复时保留最新状态", () => {
  const session = new SessionKernel("plan-mode");
  session.append("session/plan-mode", { active: true });
  session.append("session/plan-mode", { active: false });
  assert.equal(new SessionKernel("plan-mode", session.events).events.at(-1).data.active, false);
  assert.throws(() => session.append("session/plan-mode", { active: "yes" }), /载荷/);
});

test("公开 lfaa-session 包导出完整的内核 API", async () => {
  const api = await import("lfaa-session");
  assert.equal(api.SessionKernel, SessionKernel);
  assert.equal(api.SessionStore, SessionStore);
  assert.equal(typeof api.foldSessionSurface, "function");
  assert.equal(typeof api.SessionPreparation, "function");
});

test("请求上下文、历史工具定义、Surface replacement 与精确前缀恢复", () => {
  const session = fixture();
  const sourceCount = session.length;
  assert.equal(session.requestHeader.data.modelId, "model-a");
  assert.equal(session.requestContext.length, 2);
  assert.equal(session.toolHistory.length, 1);
  assert.equal(session.toolDefinitionsForCall("call-1")[0].function.name, "read_status");
  const fork = session.fork(sourceCount, "kernel-fork");
  const result = fork.events.find(event => event.type === "tool/result");
  assert.equal(result.data.executionState, "unconfirmed");
  assert.equal(result.data.repaired, true);
  assert.equal(fork.inheritedEventCount, sourceCount);
  assert.equal(fork.isOwnSeq(sourceCount), false);
  assert.equal(fork.isOwnSeq(sourceCount + 1), true);
  assert.equal(fork.events.some(event => event.type === "step/end"), true);
  assert.equal(fork.events.some(event => event.type === "turn/end"), true);
  assert.equal(session.length, sourceCount);
  assert.equal(session.events.some(event => event.type === "tool/result"), false);

  session.append("tool/result", { runId: "run-1", callId: "call-1", content: "{\"state\":\"ready\"}", isError: false, executionState: "complete" });
  session.append("step/end", { turnId: "run-1", step: 1 });
  session.append("turn/end", { turnId: "run-1", status: "complete" });
  assert.deepEqual(session.deriveMessages().slice(-2), [
    { role: "assistant", content: null, tool_calls: [{ id: "call-1", type: "function", function: { name: "read_status", arguments: "{}" } }] },
    { role: "tool", tool_call_id: "call-1", content: "{\"state\":\"ready\"}" }
  ]);
  const before = session.surface.find(item => item.id === "user-1");
  session.append("user/message", { messageId: "user-1-replacement", content: "已更新" }, new Date().toISOString(), {
    surfaceOp: { op: "replace", startSeq: before.seq, endSeq: before.seq }, sourceEventSeqs: [before.seq]
  });
  assert.equal(session.surface.find(item => item.id === "user-1-replacement").seq > before.seq, true);
  assert.equal(session.surface.find(item => item.id === "user-1-replacement").data.content, "已更新");
});

test("SessionStore flush 等待持久层屏障并按容量淘汰最久未用对象", async () => {
  let flushed = 0;
  const store = new SessionStore(() => { flushed += 1; }, 1);
  store.create("first");
  store.create("second");
  assert.deepEqual(store.list(), ["second"]);
  await store.flush();
  assert.equal(flushed, 1);

  const branching = new SessionStore(undefined, 4);
  const source = branching.create("branch-source");
  source.append("session/created", { ownerId: "owner", appId: "writing", createdAt: "2026-10-04T00:00:00.000Z" });
  const fork = branching.fork("branch-source", 1, "branch-child");
  assert.equal(fork.events.at(-1).type, "session/end-seed");
  assert.equal(branching.list().includes("branch-child"), true);
  assert.throws(() => branching.fork("missing", 0), error => error.code === "SESSION_NOT_FOUND");
  assert.throws(() => branching.fork("branch-source", 99), error => error.code === "INVALID_BOUNDARY");
});

test("Surface 支持引用校验、精确连续区间替换与替换代数", () => {
  const session = new SessionKernel("surface-range");
  const first = session.append("user/message", { messageId: "u1", content: "旧输入" });
  const response = session.append("assistant/response", { runId: "r1", message: { role: "assistant", content: "旧回答" } });
  session.append("user/message", { messageId: "u2", content: "保留输入" });
  assert.throws(() => session.append("user/message", { messageId: "bad", content: "缺少来源" }, new Date().toISOString(), {
    surfaceOp: { op: "replace", startSeq: first.seq, endSeq: response.seq }
  }), /全部节点/);
  assert.equal(session.length, 3);
  session.append("user/message", { messageId: "u3", content: "压缩后的输入" }, new Date().toISOString(), {
    surfaceOp: { op: "replace", startSeq: first.seq, endSeq: response.seq }, sourceEventSeqs: [first.seq, response.seq]
  });
  assert.deepEqual(session.surface.map(item => item.id), ["u2", "u3"]);
  assert.equal(session.surfaceReplaceGeneration, 1);
  assert.deepEqual(session.deriveSurfaceMessages(), [
    { role: "user", content: "保留输入" }, { role: "user", content: "压缩后的输入" }
  ]);

  const prompt = new SessionKernel("system-head");
  const head = prompt.append("system/message", { content: "原系统提示" });
  assert.throws(() => prompt.append("user/message", { messageId: "bad", content: "越权替换" }, new Date().toISOString(), {
    surfaceOp: { op: "replace", startSeq: head.seq, endSeq: head.seq }, sourceEventSeqs: [head.seq]
  }), /首个 system\/message/);
  prompt.append("system/message", { content: "新系统提示" }, new Date().toISOString(), {
    surfaceOp: { op: "replace", startSeq: head.seq, endSeq: head.seq }, sourceEventSeqs: [head.seq]
  });
  assert.deepEqual(prompt.deriveMessages(), [{ role: "system", content: "新系统提示" }]);
});

test("动态 Tool History 保留历史 Header 定义，JSON 与序号范围验证 fail closed", () => {
  const session = new SessionKernel("tool-history");
  const tools = [
    { type: "function", function: { name: "read", description: "read", parameters: { type: "object", properties: {} } } },
    { type: "function", function: { name: "write", description: "write", parameters: { type: "object", properties: {} } } }
  ];
  const header = session.append("request/header", {
    runId: "run", appId: "workspace", providerId: "provider", modelId: "model", permissionMode: "ask", settings: {}, tools, reason: "initial"
  });
  session.append("developer/message", {
    messageId: "update", content: "", blocks: [{ type: "tool-removal", toolName: "write" }, { type: "tool-addition", toolName: "write" }], headerSeq: header.seq
  });
  assert.equal(session.resolvedToolHistory.tools.length, 2);
  assert.equal(session.resolvedToolHistory.updates[0].additions[0].function.name, "write");
  assert.throws(() => snapshotSessionJson(-0), /JSON/);
  const sparse = []; sparse[1] = "x";
  assert.throws(() => snapshotSessionJson(sparse), /稀疏/);
  assert.deepEqual(encodeSessionSeqRanges([1, 2, 3, 6]), [[1, 3], 6]);
  assert.deepEqual(decodeSessionSeqRanges([[1, 3], 6]), [1, 2, 3, 6]);
  assert.throws(() => decodeSessionSeqRanges([[4, 3]]), /倒置/);
});

test("SessionPreparation 发布后不会释放已交接资源", () => {
  let released = 0;
  const preparation = SessionPreparation.create(new SessionKernel("prepared"), () => { released += 1; });
  preparation.dispose();
  preparation.dispose();
  assert.equal(released, 1);
  const published = SessionPreparation.create(new SessionKernel("published"), () => { released += 1; });
  published.publish();
  published.dispose();
  assert.equal(released, 1);
});
