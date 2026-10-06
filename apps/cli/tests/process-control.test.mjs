/**
 * 功能：回归节点原生命令进程和 Minecraft 就绪证据。
 * 作用：实际启动隔离的 Node 子进程验证运行中输出、超时、进程树取消与 UTF-8 限额；就绪夹具只用于单元测试。
 * 关联文件：packages/host/daemon/src/process-control.mjs。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { startCommand, isVanillaReadyLine, waitForMinecraftReady } from "../../../packages/host/daemon/src/process-control.mjs";
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const run = (script, options = {}) => startCommand({ executable: process.execPath, args: ["-e", script], cwd: process.cwd(), env: process.env, timeoutSeconds: 5, ...options });

test("真实命令在退出前回传输出，正常退出码来自进程", async () => {
  let outputReceived;
  const output = new Promise(resolve => { outputReceived = resolve; });
  const command = run("console.log('运行中'); setTimeout(()=>console.log('完成'),200)", { onOutput: value => { if (value.stdout.includes("运行中")) outputReceived(value); } });
  try { const early = await output; assert.equal(early.exitCode, null); const result = await command.done; assert.equal(result.exitCode, 0); assert.match(result.stdout, /完成/u); }
  finally { await command.cancel(); }
});
test("超时等待进程实际结束后回传失败事实", async () => {
  const command = run("setInterval(()=>{},1000)", { timeoutSeconds: 0.2 });
  try { const result = await command.done; assert.equal(result.timedOut, true); assert.notEqual(result.exitCode, 0); assert.ok(command.child.exitCode !== null || command.child.signalCode !== null); }
  finally { await command.cancel(); }
});
test("取消结束真实父子进程，不仅停止等待", async () => {
  let childPid;
  const command = run("const {spawn}=require('node:child_process'); const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'}); console.log(child.pid); setInterval(()=>{},1000)", { onOutput: value => { const pid = Number(value.stdout.trim()); if (Number.isInteger(pid) && pid > 0) childPid = pid; } });
  try {
    for (let i = 0; i < 100 && !childPid; i++) await delay(20);
    assert.ok(childPid); await command.cancel(); const result = await command.done; assert.equal(result.cancelled, true);
    for (let i = 0; i < 100; i++) { try { process.kill(childPid, 0); } catch { return; } await delay(20); }
    assert.fail("子进程仍然存活");
  } finally { await command.cancel(); if (childPid) { try { process.kill(childPid, "SIGKILL"); } catch {} } }
});
test("中文日志截断不越过字节上限，也不生成不完整字符", async () => {
  const command = run("process.stdout.write('中文日志'.repeat(1000))", { outputLimitBytes: 101 });
  const result = await command.done; assert.ok(Buffer.byteLength(result.stdout) <= 101); assert.equal(result.outputTruncated, true); assert.ok(!result.stdout.includes("\ufffd"));
});
test("只有握手和当次服务就绪两项证据齐全才成功", async () => {
  const child = Object.assign(new EventEmitter(), { exitCode: null, signalCode: null });
  const runtime = { sandboxReady: true, serverReady: false };
  const ready = waitForMinecraftReady(child, runtime, 1);
  assert.equal(await Promise.race([ready.then(() => "ready"), delay(25).then(() => "waiting")]), "waiting");
  runtime.serverReady = true; runtime.onReady(); await ready; assert.equal(child.listenerCount("exit"), 0);
  assert.equal(isVanillaReadyLine('[Server thread/INFO]: Done (2.123s)! For help, type "help"'), true);
  assert.equal(isVanillaReadyLine("Starting minecraft server"), false);
});
test("握手后就绪超时或进程提前退出仍失败", async () => {
  const child = Object.assign(new EventEmitter(), { exitCode: null, signalCode: null });
  await assert.rejects(waitForMinecraftReady(child, { sandboxReady: true, serverReady: false }, 0.02), /未确认开服成功/u);
  const pending = waitForMinecraftReady(child, { sandboxReady: true, serverReady: false }, 1); child.emit("exit", 1); await assert.rejects(pending, /服务就绪前退出/u);
});
