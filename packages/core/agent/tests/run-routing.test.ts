// 验证「本次运行用哪个 agent、哪份绑定」的解析优先级，以及续跑缓存不丢这两个设置。
import assert from "node:assert/strict";
import test from "node:test";
import { pickRunOptions, resolveRunRouting } from "../src/run/run-options";

test("显式入参优先于会话设置", () => {
  const routing = resolveRunRouting(
    { agentId: "reviewer", bindingId: "explicit-binding" },
    { agentId: "session-agent", bindingOverrideId: "session-binding" },
  );
  assert.deepEqual(routing, { agentId: "reviewer", bindingId: "explicit-binding" });
});

test("没有显式入参时继承会话设置", () => {
  assert.deepEqual(
    resolveRunRouting({}, { agentId: "session-agent", bindingOverrideId: "session-binding" }),
    { agentId: "session-agent", bindingId: "session-binding" },
  );
});

test("两边都没有时返回空对象，交由内置默认处理", () => {
  assert.deepEqual(resolveRunRouting({}, null), {});
  assert.deepEqual(resolveRunRouting({}, undefined), {});
  assert.deepEqual(resolveRunRouting({ agentId: "" }, { agentId: "" }), {});
});

test("续跑缓存带上 agent 与绑定，避免自动续跑退回默认模型", () => {
  const cached = pickRunOptions({
    sessionId: "s1",
    agentId: "reviewer",
    bindingId: "group-opus",
    reasoningEffort: "high",
  });
  assert.equal(cached.agentId, "reviewer");
  assert.equal(cached.bindingId, "group-opus");
  assert.equal(cached.reasoningEffort, "high");
});