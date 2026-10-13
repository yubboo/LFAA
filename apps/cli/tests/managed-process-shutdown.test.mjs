/** 功能：回归受管进程退出确认。作用：覆盖正常 stop、输入失败和无法终止，防止误报安全安装。关联文件：daemon/managed-process-shutdown.mjs。 */
import test from "node:test";
import assert from "node:assert/strict";
import { stopManagedProcess } from "../../../packages/host/daemon/src/managed-process-shutdown.mjs";

function runtime(write = (_command, done) => done()) {
  return { exitCode: null, signalCode: null, stdin: { write } };
}
test("正常停服等待账户时限，不调用强制终止", async () => {
  const child = runtime(); let stopped = false;
  assert.equal(await stopManagedProcess({ child, command: "stop\n", timeoutMilliseconds: 30_000,
    waitForExit: async (value, time) => { assert.equal(value, child); assert.equal(time, 30_000); return true; },
    terminate: async () => { stopped = true; } }), true);
  assert.equal(stopped, false);
});
test("控制台失败后执行既有终止策略并确认退出，不伪装成正常 stop", async () => {
  const child = runtime((_command, done) => done(new Error("输入失效"))); let terminated = false;
  assert.equal(await stopManagedProcess({ child, command: "stop\n", timeoutMilliseconds: 30_000,
    terminate: async value => { assert.equal(value, child); terminated = true; },
    waitForExit: async (_value, time) => { assert.equal(terminated, true); assert.equal(time, 5_000); return true; } }), false);
});
test("终止请求不等于退出，超时或终止失败必须拒绝成功确认", async () => {
  const child = runtime(); const calls = [];
  await assert.rejects(stopManagedProcess({ child, command: "stop\n", timeoutMilliseconds: 300_000,
    waitForExit: async (_value, time) => { calls.push(time); return false; }, terminate: async () => {} }), /尚未确认退出/);
  assert.deepEqual(calls, [300_000, 5_000]);
  await assert.rejects(stopManagedProcess({ child, command: "stop\n", timeoutMilliseconds: 1,
    waitForExit: async () => false, terminate: async () => { throw new Error("结束失败"); } }), /结束失败/);
});
