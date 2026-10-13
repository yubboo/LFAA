/** 功能：回归桌面服务 IPC 停机。作用：使用独立 Node 子进程证明请求到达后才退出，并覆盖超时和异常。关联文件：src/service-shutdown.mjs、src/main.mjs。 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once, EventEmitter } from "node:events";
import { requestServiceShutdown } from "../src/service-shutdown.mjs";

test("真实 Node 服务接收 Harness IPC 并完成收尾后，桌面才确认退出", async () => {
  const child = spawn(process.execPath, ["-e", `process.on('message', message => {
    if (message.type === 'lfaa-shutdown') setTimeout(() => { process.disconnect(); process.exitCode = 0; }, 30);
  }); process.send('ready');`], { windowsHide: true, stdio: ["ignore", "ignore", "ignore", "ipc"] });
  try {
    await once(child, "message");
    assert.equal(await requestServiceShutdown(child, 5_000), true);
    assert.equal(child.exitCode, 0);
  } finally { if (child.exitCode === null && child.signalCode === null) child.kill(); }
});

test("超时、断开的 IPC 和非零退出不触发强杀，不报告安全停机", async () => {
  const child = Object.assign(new EventEmitter(), { connected: true, exitCode: null, signalCode: null, send() {}, kill() { throw new Error("不得强杀"); } });
  assert.equal(await requestServiceShutdown(child, 5), false);
  assert.equal(child.listenerCount("exit"), 0); assert.equal(child.listenerCount("error"), 0);
  child.connected = false; assert.equal(await requestServiceShutdown(child, 5), false);
  child.exitCode = 1; assert.equal(await requestServiceShutdown(child, 5), false);
  child.exitCode = 0; assert.equal(await requestServiceShutdown(child, 5), true);
});
