/** 功能：回归真实 PTY 与异步输出时序。作用：验证等待中的消费方不丢块、队列容量及交互/缩放/退出。关联文件：subprocess-local/src。 */
import assert from "node:assert/strict";
import test from "node:test";
import { stripVTControlCharacters } from "node:util";
import { AsyncChunkQueue } from "lfaa-subprocess-local/src/async-queue.js";
import { LocalSubprocessRuntime } from "lfaa-subprocess-local/src/spawn.js";
import { terminalEnvironment } from "lfaa-host-daemon/src/terminal-channel.mjs";

test("等待中的输出消费方收到首块，结束不会吞掉末块", async () => {
  const queue = new AsyncChunkQueue();
  const iterator = queue[Symbol.asyncIterator]();
  const pending = iterator.next();
  queue.push({ stream: "stdout", offset: 0, bytes: Buffer.from("中文") });
  queue.end();
  const item = await pending;
  assert.equal(item.done, false);
  assert.equal(Buffer.from(item.value.bytes).toString(), "中文");
  assert.equal((await iterator.next()).done, true);
});

test("输出队列达到容量时拒绝新块，已有数据仍可完整排空", async () => {
  const queue = new AsyncChunkQueue(4);
  const item = { stream: "stdout", offset: 0, bytes: Buffer.from("1234") };
  assert.equal(queue.push(item), true); assert.equal(queue.push(item), false);
  queue.end(); const values = [];
  for await (const value of queue) values.push(Buffer.from(value.bytes).toString());
  assert.deepEqual(values, ["1234"]);
});

test("真实 PTY 的慢消费者超出容量会停止进程，缓冲保持有界", { timeout: 20_000 }, async () => {
  const handle = await new LocalSubprocessRuntime().spawnTerminal({ target: { kind: "local" }, platform: process.platform, executable: process.execPath,
    args: ["-e", "setInterval(()=>process.stdout.write('x'.repeat(4096)+'\\r\\n'),1)"], cwd: process.cwd(),
    columns: 80, rows: 24, maxQueuedOutputBytes: 8192, terminationGraceMs: 1000, signal: AbortSignal.timeout(10_000) });
  try {
    const outcome = await handle.done;
    assert.equal(outcome.outputTruncated, true);
    let bytes = 0; for await (const chunk of handle.output) bytes += chunk.bytes.byteLength;
    assert.ok(bytes <= 8192); assert.throws(() => process.kill(handle.pid, 0));
  } finally { await handle.terminate(); }
});

test("真实 PTY 支持 TTY、中文、尺寸变化和 Ctrl+C，隔离宿主密钥", { timeout: 20_000 }, async () => {
  process.env.LFAA_TEST_TERMINAL_SECRET = "must-not-reach-child";
  const runtime = new LocalSubprocessRuntime();
  const handle = await runtime.spawnTerminal({ target: { kind: "local" }, platform: process.platform, executable: process.execPath,
    args: ["-e", `process.stdin.setEncoding('utf8'); process.stdout.write('\\x1b[32m中文终端\\x1b[0m\\n'); console.log('TTY',process.stdin.isTTY,process.stdout.isTTY,'SECRET',process.env.LFAA_TEST_TERMINAL_SECRET ?? 'absent'); console.log('SIZE',...process.stdout.getWindowSize());process.stdin.on('data',data=>{console.log('INPUT',JSON.stringify(data));console.log('SIZE',...process.stdout.getWindowSize())});process.on('SIGINT',()=>{console.log('INTERRUPTED');process.exit(0)});`],
    cwd: process.cwd(), env: terminalEnvironment(), columns: 80, rows: 24, maxQueuedOutputBytes: 65536, terminationGraceMs: 1000 });
  let output = "";
  const drain = (async () => { for await (const chunk of handle.output) output += Buffer.from(chunk.bytes).toString(); })();
  const waitFor = async pattern => {
    const plain = () => stripVTControlCharacters(output.replace(/\x1b\[(\d*)C/gu, (_match, count) => " ".repeat(Number(count) || 1)));
    const deadline = Date.now() + 5000;
    while (!pattern.test(plain()) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert.match(plain(), pattern);
  };
  try {
    await waitFor(/TTY true true SECRET absent/u); assert.match(output, /\x1b\[32m.*中文终端/su);
    await handle.writeStdin(Buffer.from("输入验收\r")); await waitFor(/INPUT.*输入验收/u);
    await handle.sendSignal("SIGINT"); const outcome = await handle.done; await drain;
    assert.equal(outcome.exitCode, 0); assert.match(output, /INTERRUPTED/u); assert.equal(outcome.outputTruncated, false);
    assert.throws(() => process.kill(handle.pid, 0));
  } finally { delete process.env.LFAA_TEST_TERMINAL_SECRET; await handle.terminate(); await drain; }
});

test("ConPTY 缩放真实改变前台程序读取的控制台尺寸", { timeout: 15_000, skip: process.platform !== "win32" }, async () => {
  const handle = await new LocalSubprocessRuntime().spawnTerminal({ target: { kind: "local" }, platform: process.platform, executable: "powershell.exe", args: ["-NoLogo", "-NoProfile", "-Command", "[Console]::WriteLine('READY'); while (($line=[Console]::ReadLine()) -ne 'exit') { [Console]::WriteLine(('SIZE {0} {1}' -f [Console]::WindowWidth,[Console]::WindowHeight)) }"], cwd: process.cwd(), env: terminalEnvironment(), columns: 80, rows: 24, maxQueuedOutputBytes: 65536, terminationGraceMs: 1000 });
  let output = ""; const drain = (async () => { for await (const chunk of handle.output) output += Buffer.from(chunk.bytes).toString(); })();
  const deadline = Date.now() + 8000;
  try {
    while (!output.includes("READY") && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert.match(output, /READY/u); await handle.resize(101, 31);
    while (!/SIZE.*101.*31/su.test(output) && Date.now() < deadline) { await handle.writeStdin(Buffer.from("size\r")); await new Promise(resolve => setTimeout(resolve, 100)); }
    assert.match(output, /SIZE.*101.*31/su); await handle.writeStdin(Buffer.from("exit\r")); assert.equal((await handle.done).exitCode, 0); await drain;
  } finally { await handle.terminate(); await drain; }
});

test("终端取消会确认进程退出，错误程序不能返回启动成功", { timeout: 20_000 }, async () => {
  const runtime = new LocalSubprocessRuntime(), controller = new AbortController();
  const spec = { target: { kind: "local" }, platform: process.platform, executable: process.execPath, args: ["-e", "setInterval(()=>{},1000)"], cwd: process.cwd(), env: terminalEnvironment(), columns: 80, rows: 24, maxQueuedOutputBytes: 65536, terminationGraceMs: 1000 };
  const handle = await runtime.spawnTerminal({ ...spec, signal: controller.signal });
  controller.abort(); assert.equal((await handle.done).cancelled, true); assert.throws(() => process.kill(handle.pid, 0));
  await assert.rejects(runtime.spawnTerminal({ ...spec, executable: "lfaa-no-such-terminal-executable.exe" }));
});
