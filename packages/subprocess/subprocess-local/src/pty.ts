/** 功能：提供唯一的原生 PTY 适配。作用：原生启动/缩放在独立线程执行，父进程持有有界输出、取消和退出合同。关联文件：pty-worker.mjs、spawn.ts、host/daemon/src/terminal-channel.mjs。 */
import { Worker } from "node:worker_threads";
import { killProcessTree } from "lfaa-win32-process";
import type { ProcessOutcome, TerminalHandle, TerminalSpawnSpec } from "lfaa-subprocess";
import { AsyncChunkQueue } from "./async-queue.js";

/** 终端只继承 OS 运行环境，不继承控制端/Provider 密钥及开发加载器。 */
export function terminalEnvironment(source = process.env): Record<string, string> {
  const keys = new Set(["path", "pathext", "systemroot", "windir", "comspec", "temp", "tmp", "userprofile", "home", "homedrive", "homepath", "username", "userdomain", "appdata", "localappdata", "programfiles", "programfiles(x86)", "programdata", "lang", "lc_all"]);
  return { ...Object.fromEntries(Object.entries(source).filter((entry): entry is [string, string] => keys.has(entry[0].toLowerCase()) && typeof entry[1] === "string")), TERM: "xterm-256color", COLORTERM: "truecolor" };
}

export async function spawnNativeTerminal(spec: TerminalSpawnSpec): Promise<TerminalHandle> {
  spec.signal?.throwIfAborted();
  if (spec.target.kind !== "local" || spec.platform !== process.platform) throw new Error("PTY 必须由目标节点的本机运行时执行。");
  const queue = new AsyncChunkQueue(spec.maxQueuedOutputBytes);
  const env = spec.env ?? terminalEnvironment();
  const worker = new Worker(new URL("./pty-worker.mjs", import.meta.url), {
    execArgv: [], env: { ...env }, workerData: { executable: spec.executable, args: [...spec.args], cwd: spec.cwd, env: { ...env }, cols: spec.columns, rows: spec.rows, moduleUrl: import.meta.resolve("node-pty") }
  });
  let pid: number | undefined, offset = 0, cancelled = false, truncated = false, exited = false, sequence = 0;
  let settle!: (value: ProcessOutcome) => void, ready!: () => void, failReady!: (error: Error) => void;
  const done = new Promise<ProcessOutcome>(resolve => { settle = resolve; });
  const started = new Promise<void>((resolve, reject) => { ready = resolve; failReady = reject; });
  const pending = new Map<number, { resolve: () => void; reject: (error: Error) => void }>();
  let killTimer: ReturnType<typeof setTimeout> | undefined;
  const finish = (exitCode: number | null, signal: string | null = null) => {
    if (exited) return; exited = true;
    clearTimeout(killTimer); clearTimeout(startTimer); spec.signal?.removeEventListener("abort", onAbort);
    for (const request of pending.values()) request.reject(new Error("终端已退出。")); pending.clear();
    queue.end(); settle({ exitCode, signal, cancelled, timedOut: false, outputTruncated: truncated });
    void worker.terminate();
  };
  const onAbort = () => {
    if (exited || cancelled) return; cancelled = true; worker.postMessage({ type: "kill" });
    killTimer = setTimeout(() => {
      void (async () => { if (pid) await killProcessTree(pid, spec.terminationGraceMs); finish(null); })().catch(error => { failReady(error); finish(null); });
    }, 10_000); killTimer.unref();
  };
  const startTimer = setTimeout(() => { failReady(new Error("原生终端启动超时。")); onAbort(); }, 15_000); startTimer.unref();
  worker.on("message", message => {
    if (message.type === "ready") { pid = message.pid; clearTimeout(startTimer); ready(); }
    else if (message.type === "output") {
      const bytes = Buffer.from(message.data, "utf8");
      if (!queue.push({ stream: "stdout", offset, bytes })) { truncated = true; onAbort(); }
      worker.postMessage({ type: "output-consumed", bytes: bytes.byteLength });
      offset += bytes.byteLength;
    } else if (message.type === "exit") finish(message.exitCode, message.signal ? String(message.signal) : null);
    else if (message.type === "error") { failReady(new Error(message.message)); finish(null); }
    else if (message.type === "ack") {
      const request = pending.get(message.id); pending.delete(message.id);
      if (message.error) request?.reject(new Error(message.error)); else request?.resolve();
    }
  });
  worker.on("error", error => { failReady(error); finish(null); });
  worker.on("exit", code => { failReady(new Error("终端线程提前退出。")); finish(code); });
  spec.signal?.addEventListener("abort", onAbort, { once: true });
  if (spec.signal?.aborted) onAbort();
  try { await started; } catch (error) { onAbort(); await done; throw error; }
  function request(type: string, value: Record<string, unknown> = {}): Promise<void> {
    if (exited || cancelled) return Promise.reject(new Error("终端已退出。"));
    if (pending.size >= 64) return Promise.reject(new Error("终端输入队列已满。"));
    const id = ++sequence;
    return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); worker.postMessage({ type, id, ...value }); });
  }
  return {
    ...(pid ? { pid } : {}), output: queue, done,
    writeStdin(bytes) {
      if (bytes.byteLength > 64 * 1024) return Promise.reject(new Error("单次终端输入超过容量。"));
      return request("input", { data: Buffer.from(bytes).toString("utf8") });
    },
    closeStdin() { return request("input", { data: "\x04" }); },
    resize(columns, rows) {
      if (!Number.isInteger(columns) || !Number.isInteger(rows) || columns < 2 || columns > 500 || rows < 1 || rows > 300) return Promise.reject(new Error("终端尺寸无效。"));
      return request("resize", { columns, rows });
    },
    async sendSignal(signal) {
      if (signal === "SIGINT") await request("input", { data: "\x03" });
      else if (signal === "SIGTERM" || signal === "SIGKILL") onAbort();
      else throw new Error("不支持的终端信号。");
    },
    async terminate() { onAbort(); return done; }
  };
}
