/** 功能：回归长 Shell 对节点运维的影响。作用：验证有界调度、轮转和卸载收尾。关联文件：host/daemon/src/task-lanes.mjs。 */
import test from "node:test";
import assert from "node:assert/strict";
import { createDaemonTaskLanes } from "../../../packages/host/daemon/src/task-lanes.mjs";

const turn = () => new Promise(resolve => setImmediate(resolve));
test("无限时 Shell 不占用 Minecraft 停服槽，运维并发有界并轮转", async () => {
  const ids = new Set(), errors = [], executed = [], queues = new Map();
  let finishShell, finishStop;
  const scheduler = createDaemonTaskLanes({ activeTaskIds: ids, onError: error => errors.push(error) });
  const shellDone = new Promise(resolve => { finishShell = resolve; });
  const stopDone = new Promise(resolve => { finishStop = resolve; });
  const options = {
    claim: async path => queues.get(path)?.shift() ?? null,
    maintenance: [
      { path: "minecraft", execute: async task => { executed.push(task.id); await stopDone; } },
      { path: "files", execute: async task => { executed.push(task.id); } }
    ],
    shell: { path: "shell", execute: async task => { executed.push(task.id); await shellDone; } }
  };
  queues.set("shell", [{ id: "long-shell" }, { id: "second-shell" }]);
  await scheduler.poll(options);
  queues.set("minecraft", [{ id: "stop" }, { id: "second-stop" }]);
  queues.set("files", [{ id: "file" }]);
  await scheduler.poll(options); await turn();
  assert.deepEqual([...ids].sort(), ["long-shell", "stop"]);
  await scheduler.poll(options);
  assert.deepEqual(executed, ["long-shell", "stop"]);
  finishStop(); await turn();
  await scheduler.poll(options); await turn();
  assert.deepEqual(executed, ["long-shell", "stop", "file"]);
  scheduler.stop(); finishShell(); await scheduler.drain();
  assert.equal(ids.size, 0); assert.deepEqual(errors, []);
  await scheduler.poll(options);
  assert.equal(executed.includes("second-shell"), false);
});

test("领取请求未完成时不重叠轮询，关闭后不执行刚返回的租约", async () => {
  let resolveClaim, claims = 0, executions = 0;
  const ids = new Set();
  const scheduler = createDaemonTaskLanes({ activeTaskIds: ids, onError: error => { throw error; } });
  const options = {
    claim: () => { claims++; return new Promise(resolve => { resolveClaim = resolve; }); },
    maintenance: [{ path: "minecraft", execute: () => { executions++; } }],
    shell: { path: "shell", execute: () => { executions++; } }
  };
  const polling = scheduler.poll(options);
  await scheduler.poll(options); assert.equal(claims, 1);
  scheduler.stop(); resolveClaim({ id: "late-task" }); await polling;
  assert.equal(executions, 0); assert.equal(ids.size, 0);
});

test("执行失败撤销任务槽，错误进入诊断而不触发自动重放", async () => {
  const ids = new Set(), errors = [];
  let claims = 0;
  const scheduler = createDaemonTaskLanes({ activeTaskIds: ids, onError: error => errors.push(error) });
  await scheduler.poll({
    claim: async () => ++claims === 1 ? { id: "failed" } : null,
    maintenance: [{ path: "files", execute: async () => { throw new Error("执行失败"); } }],
    shell: { path: "shell", execute: async () => {} }
  });
  await scheduler.drain(); assert.equal(ids.size, 0); assert.equal(errors.length, 1);
});
