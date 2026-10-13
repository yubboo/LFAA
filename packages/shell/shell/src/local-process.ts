/**
 * 功能：本地命令的 child_process 执行引擎（无 pty）。
 * 作用：把「执行规格 + 方言 argv」落到 node:child_process.spawn，统一实现流收集（尾部落点预算）、
 *       墙钟超时（按 onExpiry 处置）、外部中止（AbortSignal）与 stdin 写入，返回 ShellExecution 句柄。
 * 说明：LFAA store 不含 node-pty，故本地执行一律走非交互 child_process；pwsh/bash 方言只负责拼 argv 与环境。
 * 关联文件：types.ts（句柄契约）、pwsh-local、bash-local。
 */
import { spawn, type ChildProcess } from "node:child_process";
import type { ShellExecution, ShellProcessRead, ShellRunResult, ShellExecSpec } from "./types.js";

/** 单个流通道的尾部落点缓冲：保留尾部至多 maxBytes，早期字节记为丢弃。 */
class TailBuffer {
  private chunks: Buffer[] = [];
  private total = 0;
  private dropped = 0;
  private readPos = 0;
  constructor(private readonly maxBytes: number) {}

  push(text: string): void {
    const bytes = Buffer.from(text, "utf8");
    this.chunks.push(bytes);
    this.total += bytes.length;
    // 单个大数据块也必须裁掉；预算是 UTF-8 字节，不能把汉字按 JS 字符数计算。
    while (this.total - this.dropped > this.maxBytes) {
      const oldest = this.chunks[0]!;
      const discard = Math.min(oldest.length, this.total - this.dropped - this.maxBytes);
      this.dropped += discard;
      if (discard === oldest.length) this.chunks.shift();
      else this.chunks[0] = Buffer.from(oldest.subarray(discard));
    }
    // 裁剪点可能落在多字节字符中间；移除不完整前缀，保持模型收到的中文可读。
    const first = this.chunks[0];
    if (first) {
      let prefix = 0;
      while (prefix < first.length && (first[prefix]! & 0xc0) === 0x80) prefix++;
      if (prefix) { this.dropped += prefix; this.chunks[0] = Buffer.from(first.subarray(prefix)); }
    }
  }

  /** 自上次读取以来的增量；若尾部已被环形缓冲裁掉早期字节则标记 lossy。 */
  readDelta(): ShellProcessRead {
    const full = Buffer.concat(this.chunks);
    const lossy = this.readPos < this.dropped;
    const start = Math.max(this.readPos, this.dropped);
    const delta = full.subarray(start - this.dropped).toString("utf8");
    this.readPos = this.total;
    return { delta, lossy };
  }

  snapshot(): string {
    return Buffer.concat(this.chunks).toString("utf8");
  }

  get truncated(): boolean {
    return this.dropped > 0;
  }
}

/** 方言层提供的启动参数（可执行体与参数、工作目录、环境变量）。 */
export interface LocalProcessLaunch {
  argv: string[];
  cwd?: string | undefined;
  env?: Record<string, string> | undefined;
}

function mergeEnv(launchEnv: Record<string, string> | undefined, spec: ShellExecSpec): Record<string, string> {
  // 本地执行默认继承父进程环境；方言/规格再叠加 LFAA_* 托管变量与显式 env。
  const base: Record<string, string> = { ...process.env } as Record<string, string>;
  if (launchEnv !== undefined) Object.assign(base, launchEnv);
  if (spec.lfaaEnv !== undefined) Object.assign(base, spec.lfaaEnv);
  if (spec.env !== undefined) Object.assign(base, spec.env);
  return base;
}

/**
 * 以 child_process 启动一条命令并返回 ShellExecution。
 * @param launch 方言 argv（含解释器路径与 -Command/-c）。
 * @param spec   已 resolve 的执行规格（超时/落点/中止信号）。
 */
export function spawnLocalProcess(launch: LocalProcessLaunch, spec: ShellExecSpec): ShellExecution {
  // 已取消的任务不得再创建进程；监听器注册前的取消也在下方重新核对。
  spec.signal?.throwIfAborted();
  let status: ShellExecution["status"] = "running";
  let exitCode: number | null = null;
  let signal: NodeJS.Signals | null = null;
  let timedOut = false;
  let aborted = false;
  let timer: NodeJS.Timeout | undefined;
  const stdout = new TailBuffer(spec.stdoutMaxBytes);
  const stderr = new TailBuffer(8 * 1024); // stderr 保留小尾部即可

  const child: ChildProcess = spawn(launch.argv[0]!, launch.argv.slice(1), {
    cwd: launch.cwd ?? spec.workdir,
    env: mergeEnv(launch.env, spec),
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });

  const onAbort = (): void => {
    aborted = true;
    try { child.kill(); } catch { /* 进程已经退出。 */ }
  };

  const settle = new Promise<ShellRunResult>((resolveResult) => {
    let settled = false;
    const finish = (code: number | null, sig: NodeJS.Signals | null): void => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      spec.signal?.removeEventListener("abort", onAbort);
      exitCode = code;
      signal = sig;
      if (sig !== null || code === null) status = "killed";
      else status = "completed";
      resolveResult({
        exitCode: code,
        signal: sig,
        timedOut,
        aborted,
        timeoutMs: spec.timeoutMs,
        stdout: { text: stdout.snapshot(), truncated: stdout.truncated },
        stderr: { text: stderr.snapshot(), truncated: stderr.truncated },
      });
    };

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => stdout.push(chunk));
    child.stderr?.on("data", (chunk: string) => stderr.push(chunk));

    child.on("error", (err) => {
      // 启动失败（如可执行体不存在）：视为非零退出，错误信息进 stderr。
      stderr.push(`[lfaa-shell] failed to spawn: ${err.message}\n`);
      finish(127, null);
    });
    child.on("close", (code, sig) => finish(code, sig as NodeJS.Signals | null));

    // 墙钟超时：kill 时按 onExpiry；none 不主动杀（交上层转后台，本地直接放行直到进程自然结束）。
    if (Number.isFinite(spec.timeoutMs) && spec.timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        if (spec.onExpiry === "kill") {
          try { child.kill(); } catch { /* 已退出 */ }
        }
      }, spec.timeoutMs);
      timer.unref?.();
    }

    // 调用方中止：立即杀死。
    spec.signal?.addEventListener("abort", onAbort, { once: true });
    if (spec.signal?.aborted) onAbort();

    // 一次性命令没有交互式输入通道：未提供 stdin 也必须发送 EOF，避免读取输入的命令等到超时。
    if (child.stdin) {
      child.stdin.on("error", () => { /* 子进程提前关闭输入管道不影响其真实退出结果。 */ });
      if (spec.stdin !== undefined) child.stdin.end(spec.stdin, "utf8");
      else child.stdin.end();
    }
  });

  const done = settle.then(() => undefined);

  return {
    get status() { return status; },
    get exitCode() { return exitCode; },
    get signal() { return signal; },
    done,
    result: () => settle,
    readOutput: () => stdout.readDelta(),
    kill: () => {
      if (status !== "running") return false;
      try { child.kill(); } catch { /* 已退出 */ }
      return true;
    },
  };
}
