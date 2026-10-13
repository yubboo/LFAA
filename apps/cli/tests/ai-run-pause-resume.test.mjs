/**
 * 功能：验证 Agent Run 暂停门闩的状态、恢复与取消清理。
 * 作用：覆盖安全检查点等待及显式取消仍可终止暂停中的 Run。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { AiRunPauseGate } from "../../../packages/core/agent-loop/src/run-pause.ts";

test("暂停在安全检查点挂起，并继续后唤醒原等待者", async () => {
  const states = [];
  const gate = new AiRunPauseGate(state => states.push(state));
  const controller = new AbortController();
  let continued = false;

  assert.equal(gate.requestPause(), "pausing");
  const waiting = gate.checkpoint(controller.signal).then(() => { continued = true; });
  assert.equal(gate.state, "paused");
  assert.equal(continued, false);
  assert.deepEqual(states, ["pausing", "paused"]);

  assert.equal(gate.resume(), true);
  await waiting;
  assert.equal(continued, true);
  assert.equal(gate.state, "running");
  assert.deepEqual(states, ["pausing", "paused", "running"]);
});

test("检查点到达前可以撤回暂停请求", async () => {
  const states = [];
  const gate = new AiRunPauseGate(state => states.push(state));
  const controller = new AbortController();

  gate.requestPause();
  assert.equal(gate.resume(), true);
  await gate.checkpoint(controller.signal);
  assert.equal(gate.state, "running");
  assert.deepEqual(states, ["pausing", "running"]);
});

test("显式取消会解除暂停等待并拒绝为已恢复运行", async () => {
  const gate = new AiRunPauseGate(() => undefined);
  const controller = new AbortController();
  gate.requestPause();
  const waiting = gate.checkpoint(controller.signal);
  assert.equal(gate.state, "paused");
  controller.abort(new DOMException("用户已取消", "AbortError"));
  await assert.rejects(waiting, error => error.name === "AbortError");
  assert.equal(gate.resume(), true);
  await assert.rejects(gate.checkpoint(controller.signal), error => error.name === "AbortError");
});
