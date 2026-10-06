/**
 * 功能：管理节点子进程的输出、取消和真实就绪等待。
 * 作用：供原生主机任务与持久游戏实例复用；本模块不宣称提供 OS 沙盒。
 * 关联文件：daemon.mjs、jobs/ai-host-tasks.ts、cli/tests/process-control.test.mjs。
 */
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { StringDecoder } from "node:string_decoder";
const execFileAsync = promisify(execFile);

/** Windows 先请求终止整个任务进程树，POSIX 使用独立进程组；等待 close 才报告终止结果。 */
export async function terminateProcessTree(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (!Number.isInteger(child.pid)) return;
  if (process.platform === "win32") {
    await execFileAsync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, timeout: 5000 }).catch(() => child.kill());
  } else {
    try { process.kill(-child.pid, "SIGKILL"); } catch { child.kill("SIGKILL"); }
  }
}

export function startCommand({ executable, args, cwd, input, env, timeoutSeconds, onOutput, outputLimitBytes = 128 * 1024 }) {
  const child = spawn(executable, args, { cwd, env, windowsHide: true, detached: process.platform !== "win32", shell: false, stdio: ["pipe", "pipe", "pipe"] });
  let cancelled = false, timedOut = false, spawnError = "", truncated = false;
  const output = { stdout: "", stderr: "" }, counts = { stdout: 0, stderr: 0 };
  const capture = (name, chunk) => {
    const remaining = Math.max(0, outputLimitBytes - counts[name]);
    // 按 UTF-8 字节约束保存，避免非 ASCII 日志绕过输出上限。
    let value = chunk;
    if (Buffer.byteLength(value) > remaining) {
      // StringDecoder 留下截断尾部的不完整字符，避免替代符本身突破字节上限。
      value = new StringDecoder("utf8").write(Buffer.from(value).subarray(0, remaining)); truncated = true;
    }
    counts[name] += Buffer.byteLength(value); output[name] += value;
    onOutput?.({ ...output, exitCode: null, timedOut, outputTruncated: truncated, cancelled });
  };
  for (const name of ["stdout", "stderr"]) {
    const decoder = new StringDecoder("utf8");
    child[name].on("data", chunk => capture(name, decoder.write(chunk)));
    child[name].on("end", () => capture(name, decoder.end()));
  }
  child.stdin.on("error", () => {});
  child.stdin.end(input ?? "");
  const kill = () => terminateProcessTree(child);
  const timer = timeoutSeconds > 0 ? setTimeout(() => { timedOut = true; void kill(); }, timeoutSeconds * 1000) : undefined;
  const done = new Promise(resolve => {
    child.once("error", error => { spawnError = error.message; });
    child.once("close", code => {
      clearTimeout(timer);
      resolve({ ...output, stderr: [output.stderr, spawnError].filter(Boolean).join("\n"), exitCode: typeof code === "number" ? code : null, timedOut, outputTruncated: truncated, cancelled });
    });
  });
  return { child, done, cancel: async () => { cancelled = true; await kill(); } };
}

/** AppContainer 启动握手和 Vanilla 就绪日志是两项事实；就绪后仍需上层报告可连接性的验证范围。 */
export function waitForMinecraftReady(child, runtime, timeoutSeconds) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = error => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      child.off("error", onError); child.off("exit", onExit); runtime.onReady = undefined;
      error ? reject(error) : resolve();
    };
    const onError = error => finish(error);
    const onExit = code => finish(new Error(`Minecraft 在服务就绪前退出（退出码 ${code ?? "未知"}）。`));
    const timer = setTimeout(() => finish(new Error("Minecraft 服务就绪超时；尚未确认开服成功。")), timeoutSeconds * 1000);
    runtime.onReady = () => { if (runtime.sandboxReady && runtime.serverReady) finish(); };
    child.once("error", onError); child.once("exit", onExit);
    if (child.exitCode !== null || child.signalCode !== null) onExit(child.exitCode);
    else runtime.onReady();
  });
}

export function isVanillaReadyLine(line) {
  return /\bDone \([\d.,]+s\)! For help, type ["“]help["”]/u.test(line);
}
