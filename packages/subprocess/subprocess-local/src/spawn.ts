/**
 * 功能：本机受管子进程运行时，实现 lfaa-subprocess 定义的 SubprocessRuntime 接口。
 * 作用：按完整 argv（绝不走 shell 拼字符串）创建子进程，管理 stdin/stdout/stderr、退出码、取消与进程树终止。
 * 关键语义（对齐协议包）：
 *  - env 只表示显式覆盖：调用方不给 env 时使用空环境，绝不默认继承父进程环境（防密钥泄漏到子进程）；
 *  - stdout/stderr 三种模式：stream 实时推流、collect 收集到上限后截断、discard 直接丢弃；
 *  - 取消通过 AbortSignal 触发；terminate 走 win32-process 杀整棵进程树；
 *  - Windows 编码：这里只透传原始字节（Uint8Array），具体文本解码由消费方负责，避免误判 GBK/UTF-8。
 * 关联文件：packages/subprocess/subprocess/src/index.ts（接口）、packages/subprocess/win32-process/src/index.ts。
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, isAbsolute, join } from "node:path";
import { killProcessTree } from "lfaa-win32-process";
import type {
  ProcessOutcome,
  ProcessOutputChunk,
  SubprocessHandle,
  SubprocessRuntime,
  SubprocessSpawnSpec,
  TerminalHandle,
  TerminalSpawnSpec,
} from "lfaa-subprocess";
import { validateSubprocessSpawnSpec, validateTerminalSpawnSpec } from "lfaa-subprocess";
import { AsyncChunkQueue } from "./async-queue.js";
import { spawnNativeTerminal } from "./pty.js";

/** 把一个 stream 接入队列：按模式决定推流/收集截断/丢弃。返回是否发生截断。 */
function wireStream(
  stream: NodeJS.ReadableStream | null,
  kind: "stdout" | "stderr",
  queue: AsyncChunkQueue,
  mode: "stream" | "collect" | "discard",
  maxBytes: number,
  state: { offset: number; truncated: boolean }
): void {
  if (!stream) return;
  if (mode === "discard") {
    stream.resume(); // 立即排空，不消费内容。
    return;
  }
  stream.on("data", (chunk: Buffer) => {
    const bytes = new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
    if (mode === "collect") {
      if (state.offset >= maxBytes) {
        state.truncated = true;
        return; // 达到上限后丢弃后续字节。
      }
      const room = maxBytes - state.offset;
      const slice = bytes.byteLength > room ? bytes.subarray(0, room) : bytes;
      queue.push({ stream: kind, offset: state.offset, bytes: slice });
      state.offset += slice.byteLength;
      if (slice.byteLength < bytes.byteLength) state.truncated = true;
    } else {
      queue.push({ stream: kind, offset: state.offset, bytes });
      state.offset += bytes.byteLength;
    }
  });
}

interface ManagedState {
  cancelled: boolean;
  done: Promise<ProcessOutcome>;
}

/** 按已校验的 spec 创建受管句柄。 */
function spawnManaged(spec: SubprocessSpawnSpec, stdio: ("pipe" | "ignore" | "inherit")[]): SubprocessHandle {
  // env：协议规定只表示显式覆盖；缺省给空对象，绝不继承父进程环境（含密钥）。
  const env = spec.env ? Object.fromEntries(Object.entries(spec.env)) : {};
  const child = spawn(spec.executable, [...spec.args], {
    cwd: spec.cwd,
    env,
    stdio,
    windowsHide: true,
    // 不在本层用 shell；命令行注入风险由完整 argv 与禁继承环境共同控制。
    shell: false
  });

  const queue = new AsyncChunkQueue();
  const stdoutState = { offset: 0, truncated: false };
  const stderrState = { offset: 0, truncated: false };
  const maxBytes = spec.output.maxBytesPerStream ?? 0;

  wireStream(child.stdout, "stdout", queue, spec.output.stdout, maxBytes, stdoutState);
  wireStream(child.stderr, "stderr", queue, spec.output.stderr, maxBytes, stderrState);

  let settle!: (outcome: ProcessOutcome) => void;
  const done = new Promise<ProcessOutcome>((resolve) => { settle = resolve; });

  const state: ManagedState = { cancelled: false, done };
  let settled = false;

  const finalize = (partial: Omit<ProcessOutcome, "outputTruncated">): void => {
    if (settled) return;
    settled = true;
    queue.end();
    settle({ ...partial, outputTruncated: stdoutState.truncated || stderrState.truncated });
  };

  child.on("error", (error) => {
    finalize({ exitCode: null, signal: null, cancelled: state.cancelled, timedOut: false });
    // 触发未捕获错误处理：保留原始信息但不让进程崩。
    void error;
  });

  child.on("close", (code, signal) => {
    finalize({ exitCode: code, signal: signal, cancelled: state.cancelled, timedOut: false });
  });

  const handle: SubprocessHandle = {
    ...(child.pid ? { pid: child.pid } : {}),
    output: queue as AsyncIterable<ProcessOutputChunk>,
    done,
    async writeStdin(chunk) {
      if (!child.stdin) throw new Error("标准输入不可写。");
      await new Promise<void>((resolve, reject) => {
        child.stdin!.write(chunk, (error) => (error ? reject(error) : resolve()));
      });
    },
    async closeStdin() {
      await new Promise<void>((resolve) => child.stdin?.end(resolve));
    },
    async terminate(_reason?: string): Promise<ProcessOutcome> {
      state.cancelled = true;
      if (child.pid) await killProcessTree(child.pid, spec.terminationGraceMs);
      child.kill();
      return done;
    }
  };

  // 取消信号：外部 AbortSignal 触发即杀进程树。
  if (spec.signal) {
    if (spec.signal.aborted) void handle.terminate("aborted");
    spec.signal.addEventListener("abort", () => void handle.terminate("aborted"), { once: true });
  }

  return handle;
}

/** 本机子进程运行时实现。 */
export class LocalSubprocessRuntime implements SubprocessRuntime {
  async resolveExecutable(_target: unknown, command: string, env?: Readonly<Record<string, string>>): Promise<string> {
    if (!command) throw new Error("可执行文件名为空。");
    if (isAbsolute(command) && existsSync(command)) return command;
    // 解析时允许从环境 PATH（若提供）或系统 PATH 查找，返回绝对路径；不猜相对路径基准。
    const pathValue = env?.PATH ?? env?.Path ?? process.env.PATH ?? "";
    const exts = process.platform === "win32" ? [".exe", ".cmd", ".bat", ".ps1", ""] : [""];
    for (const dir of pathValue.split(delimiter).filter(Boolean)) {
      for (const ext of exts) {
        const candidate = join(dir, command + ext);
        if (existsSync(candidate)) return candidate;
      }
    }
    return command; // 找不到就原样返回，由 spawn 报错。
  }

  async spawn(spec: SubprocessSpawnSpec): Promise<SubprocessHandle> {
    const valid = validateSubprocessSpawnSpec(spec);
    const stdio: ("pipe" | "ignore")[] = [valid.stdin === "pipe" ? "pipe" : "ignore", valid.output.stdout === "discard" ? "ignore" : "pipe", valid.output.stderr === "discard" ? "ignore" : "pipe"];
    return spawnManaged(valid, stdio);
  }

  async spawnTerminal(spec: TerminalSpawnSpec): Promise<TerminalHandle> {
    const valid = validateTerminalSpawnSpec(spec);
    return spawnNativeTerminal(valid);
  }
}
