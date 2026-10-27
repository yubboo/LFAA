/**
 * 功能：回归本机命令输出编码、标准输入与取消生命周期。
 * 作用：仅启动有界的合成子进程，不读取用户数据或操作桌面。
 * 关联文件：shell/shell/src/local-process.ts、shell/pwsh-local/src/index.ts。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { getEventListeners } from "node:events";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnLocalProcess } from "../../../packages/shell/shell/src/local-process.ts";
import { PwshLocalShellExecutor } from "../../../packages/shell/pwsh-local/src/index.ts";
import { DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS } from "../../../packages/shell/shell/src/index.ts";
import { killProcessTree } from "../../../packages/subprocess/win32-process/src/index.ts";

const spec = (overrides = {}) => ({ command: "fixture", workdir: process.cwd(), timeoutMs: 2000, onExpiry: "kill", stdoutMaxBytes: 4096, ...overrides });
const launch = code => ({ argv: [process.execPath, "-e", code] });

test("PowerShell Shell 缺省或零值时使用有限默认值，显式时限仍受 Shell 上限约束", () => {
  const executor = new PwshLocalShellExecutor({ get: () => undefined });
  assert.equal(executor.resolve({ command: "fixture" }).timeoutMs, DEFAULT_TIMEOUT_MS);
  assert.equal(executor.resolve({ command: "fixture", timeoutMs: 0 }).timeoutMs, DEFAULT_TIMEOUT_MS);
  assert.equal(executor.resolve({ command: "fixture", timeoutMs: 45_000 }).timeoutMs, 45_000);
  assert.equal(executor.resolve({ command: "fixture", timeoutMs: MAX_TIMEOUT_MS + 10_000 }).timeoutMs, MAX_TIMEOUT_MS);
});

test("无 stdin 的一次性命令立即收到 EOF，不耗尽命令超时", async () => {
  const execution = spawnLocalProcess(launch("process.stdin.resume(); process.stdin.on('end',()=>process.stdout.write('EOF'));"), spec({ timeoutMs: 500 }));
  const result = await execution.result();
  assert.equal(result.timedOut, false);
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout.text, "EOF");
});

test("Windows PowerShell 5.1 的中文 stdout/stderr 可由统一 UTF-8 执行器读取", { skip: process.platform !== "win32" }, async () => {
  const legacyDirectory = join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0");
  assert.ok(existsSync(join(legacyDirectory, "powershell.exe")));
  const originalPath = process.env.PATH;
  try {
    // 强制覆盖有问题的 5.1 回退路径；只改变此隔离测试进程，不修改系统环境。
    process.env.PATH = legacyDirectory;
    const executor = new PwshLocalShellExecutor({ get: () => undefined });
    const execution = await executor.execute(executor.resolve({ command: "[Console]::Out.Write('中文应用：豆包 PCL2'); [Console]::Error.Write('中文错误')", timeoutMs: 5000 }));
    const result = await execution.result();
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout.text, "中文应用：豆包 PCL2");
    assert.equal(result.stderr.text, "中文错误");
  } finally { process.env.PATH = originalPath; }
});

test("已取消的命令拒绝派发，完成后的命令撤销 abort 监听器", async () => {
  const cancelled = new AbortController(); cancelled.abort();
  assert.throws(() => spawnLocalProcess(launch("process.stdout.write('不应执行')"), spec({ signal: cancelled.signal })), { name: "AbortError" });
  const controller = new AbortController();
  for (let index = 0; index < 3; index++) {
    const result = await spawnLocalProcess(launch("process.stdout.write('ok')"), spec({ signal: controller.signal })).result();
    assert.equal(result.exitCode, 0);
    assert.equal(getEventListeners(controller.signal, "abort").length, 0);
  }
});

test("运行中取消保留真实终态，显式 stdin 仍完整传递", async () => {
  const controller = new AbortController();
  const execution = spawnLocalProcess(launch("setInterval(()=>{},1000)"), spec({ signal: controller.signal }));
  controller.abort();
  assert.equal((await execution.result()).aborted, true);
  assert.equal(getEventListeners(controller.signal, "abort").length, 0);
  const echo = await spawnLocalProcess(launch("process.stdin.setEncoding('utf8'); process.stdin.on('data',x=>process.stdout.write(x));"), spec({ stdin: "中文输入" })).result();
  assert.equal(echo.stdout.text, "中文输入");
  assert.equal(echo.exitCode, 0);
});

test("异步平台停止回调收到 PID，拒绝接管时回退停止直接进程", async () => {
  const controller = new AbortController();
  let requested;
  const execution = spawnLocalProcess({
    ...launch("setInterval(()=>{},1000)"),
    requestStop: async (reason, pid) => {
      requested = { reason, pid };
      await new Promise(resolve => setTimeout(resolve, 20));
      return false;
    },
  }, spec({ signal: controller.signal }));
  controller.abort();
  const result = await execution.result();
  assert.equal(result.aborted, true);
  assert.equal(requested.reason, "cancel");
  assert.ok(Number.isInteger(requested.pid) && requested.pid > 0);
});

test("Windows 取消通过进程树 Owner 终止本机命令及其后代", { skip: process.platform !== "win32", timeout: 10_000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), "lfaa-shell-tree-"));
  const marker = join(root, "descendant-survived.txt");
  const childCode = `setTimeout(()=>require('node:fs').writeFileSync(${JSON.stringify(marker)},'survived'),1200)`;
  const parentCode = `const {spawn}=require('node:child_process');const child=spawn(process.execPath,['-e',${JSON.stringify(childCode)}],{stdio:'ignore',windowsHide:true});process.stdout.write(String(child.pid));setInterval(()=>{},1000);`;
  const controller = new AbortController();
  let processPid;
  const execution = spawnLocalProcess({
    ...launch(parentCode),
    requestStop: async (reason, pid) => {
      assert.equal(reason, "cancel");
      processPid = pid;
      return (await killProcessTree(pid, 250)).stopped;
    },
  }, spec({ signal: controller.signal, timeoutMs: 5000 }));
  try {
    let output = "";
    for (let index = 0; index < 100 && !/^\d+$/u.test(output.trim()); index++) {
      output += execution.readOutput().delta;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.match(output.trim(), /^\d+$/u, "父进程应先启动并报告后代 PID");
    controller.abort();
    assert.equal((await execution.result()).aborted, true);
    await new Promise(resolve => setTimeout(resolve, 1400));
    assert.equal(existsSync(marker), false, "取消后代不得在后台继续运行");
  } finally {
    if (processPid) await killProcessTree(processPid, 0);
    await rm(root, { recursive: true, force: true });
  }
});

test("PowerShell 执行器取消时调用已装配的 Windows 进程树 Owner", { skip: process.platform !== "win32", timeout: 10_000 }, async () => {
  const controller = new AbortController();
  const executor = new PwshLocalShellExecutor({ get: () => undefined });
  const started = performance.now();
  const execution = await executor.execute(executor.resolve({ command: "while ($true) { Start-Sleep -Milliseconds 100 }", signal: controller.signal }));
  controller.abort();
  const result = await execution.result();
  assert.equal(result.aborted, true);
  assert.ok(performance.now() - started < 4000, "取消应等待进程树 Owner 确认，而不是无限等待 PowerShell");
});

test("直接命令退出后，继承输出管道的后代不拖住返回或伪造超时", async () => {
  const started = performance.now();
  const code = "const {spawn}=require('node:child_process'); const child=spawn(process.execPath,['-e','setTimeout(()=>{},2500)'],{stdio:['ignore',1,2],windowsHide:true});child.unref();process.stdout.write('命令已退出');process.exit(0);";
  const result = await spawnLocalProcess(launch(code), spec({ timeoutMs: 700 })).result();
  assert.equal(result.exitCode, 0);
  assert.equal(result.timedOut, false, "已退出的直接命令不应再被墙钟计时器标记超时");
  assert.match(result.stdout.text, /命令已退出/u);
  assert.ok(performance.now() - started < 1800, "不能等后代关闭管道才返回");
});

test("输出尾部按 UTF-8 字节有界，重复增量读取不会漏报已丢失的输出", async () => {
  const execution = spawnLocalProcess(launch("process.stdout.write('中'.repeat(40000)+'尾');"), spec({ stdoutMaxBytes: 64 }));
  const result = await execution.result();
  assert.ok(Buffer.byteLength(result.stdout.text, 'utf8') <= 64);
  assert.ok(result.stdout.text.endsWith('尾'));
  assert.ok(!result.stdout.text.includes('\ufffd'));
  assert.equal(result.stdout.truncated, true);
  assert.equal(execution.readOutput().lossy, true);
  assert.deepEqual(execution.readOutput(), { delta: '', lossy: false });
});
