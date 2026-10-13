/**
 * 文件：session.ts
 * 功能：基于系统 OpenSSH（Windows 10+ 自带 ssh.exe）的非交互 SSH 会话协议。
 * 作用：会话建立（连通性自检）、远程命令执行、流式输出、退出码采集。
 * 背景：pnpm store 无 ssh2 依赖，故不引入 Node 侧 SSH 库，改为通过 child_process 调用
 *       系统 ssh.exe；端口/身份文件/已知主机等全部由 OpenSSH 自身负责。
 * 权限边界（重要）：
 *   - 本包只“引用”私钥文件路径（identityFile）或主机别名，绝不读取、复制或持久化私钥内容；
 *   - 口令/私钥若来自 LFAA credentials 模型，也只读取“引用/路径”这类元数据，不把私钥正文落库；
 *   - 非交互式口令注入依赖 ssh-agent 或预先部署的密钥，本包不实现交互式密码提示。
 * 关联文件：packages/ssh/ssh/src/index.ts、packages/credentials/credentials/src/index.ts。
 * 移植参考：DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84）
 *          packages/ssh/ssh/src/index.ts 的会话语义；传输实现改为 LFAA 自写（系统 ssh.exe）。
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

/** 连接配置。 */
export interface SshConnectionConfig {
  /** 主机别名或 user@hostname；OpenSSH ~/.ssh/config 中的 Host 别名亦可。 */
  readonly host: string;
  /** 端口（省略则由 ssh 配置/默认 22 决定）。 */
  readonly port?: number;
  /** 私钥文件路径：只引用该路径，本包不读取私钥内容。 */
  readonly identityFile?: string;
  /** 已知主机文件路径（省略用 ssh 默认）。 */
  readonly knownHostsFile?: string;
  /** 主机密钥检查策略，默认 accept-new（首次连接自动记录，后续变更拒绝）。 */
  readonly strictHostKeyChecking?: "yes" | "no" | "accept-new";
  /** 连接超时（毫秒）。 */
  readonly connectTimeoutMs?: number;
  /** 显式指定 ssh.exe 路径；省略则从 PATH 解析。 */
  readonly sshPath?: string;
  /** 远端默认工作目录（仅作为提示传给远端 shell，实际由远端配置决定）。 */
  readonly remoteCwd?: string;
}

/** 一次命令执行的结果。 */
export interface SshExecResult {
  readonly stdout: string;
  readonly stderr: string;
  /** 远端命令退出码；连接层失败时为 null。 */
  readonly exitCode: number | null;
  readonly signal: string | null;
  readonly timedOut: boolean;
  readonly outputTruncated: boolean;
}

export interface SshExecOptions {
  /** 命令超时（毫秒）；默认 60s，0 表示不限。 */
  readonly timeoutMs?: number;
  /** collect 模式下 stdout/stderr 各自最大保留字节数，默认 1 MiB。 */
  readonly maxBytes?: number;
  readonly signal?: AbortSignal;
}

/** 流式句柄：直接消费子进程 stdout/stderr，并在结束时给出退出码。 */
export interface SshStreamHandle {
  readonly stdout: ChildProcessWithoutNullStreams["stdout"];
  readonly stderr: ChildProcessWithoutNullStreams["stderr"];
  readonly done: Promise<SshExecResult>;
  /** 强制终止本地 ssh 进程（远端进程是否终止取决于远端 shell）。 */
  kill(): void;
}

const DEFAULT_MAX_BYTES = 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 60_000;

function baseArgs(config: SshConnectionConfig): string[] {
  const args: string[] = ["-T"];
  if (config.port !== undefined) args.push("-p", String(config.port));
  if (config.identityFile !== undefined) args.push("-i", config.identityFile);
  if (config.knownHostsFile !== undefined) args.push("-o", `UserKnownHostsFile=${config.knownHostsFile}`);
  const strict = config.strictHostKeyChecking ?? "accept-new";
  args.push("-o", `StrictHostKeyChecking=${strict}`);
  args.push("-o", "BatchMode=yes");
  args.push("-o", "LogLevel=ERROR");
  const timeoutSec = Math.max(1, Math.ceil((config.connectTimeoutMs ?? 15_000) / 1000));
  args.push("-o", `ConnectTimeout=${timeoutSec}`);
  return args;
}

/** 把远端命令拼成一行（远端由用户登录 shell 解释）。 */
function remoteCommandLine(command: string, remoteCwd?: string): string {
  if (!remoteCwd) return command;
  // 先切目录再执行；失败时切目录错误会出现在 stderr。
  return `cd ${shellQuote(remoteCwd)} && ${command}`;
}

function shellQuote(value: string): string {
  // 远端为 POSIX shell；对路径做最小转义。
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

export class SshSession {
  constructor(private readonly config: SshConnectionConfig) {
    if (!config.host || config.host.includes("\0")) {
      throw new Error("SSH 主机名无效。");
    }
  }

  /** 会话建立：运行远端 `true`，退出码 0 视为连通。 */
  async check(options?: SshExecOptions): Promise<SshExecResult> {
    return this.exec("true", { ...options, timeoutMs: options?.timeoutMs ?? (this.config.connectTimeoutMs ?? 15_000) });
  }

  /** 执行一条远端命令并收集输出。 */
  exec(command: string, options: SshExecOptions = {}): Promise<SshExecResult> {
    const handle = this.spawnRemote(command, options);
    const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let truncated = false;
    handle.stdout.on("data", (chunk: Buffer) => {
      if (stdoutBytes + chunk.length > maxBytes) truncated = true;
      else { stdoutChunks.push(chunk); stdoutBytes += chunk.length; }
    });
    handle.stderr.on("data", (chunk: Buffer) => {
      if (stderrBytes + chunk.length > maxBytes) truncated = true;
      else { stderrChunks.push(chunk); stderrBytes += chunk.length; }
    });
    return handle.done.then((result) => ({
      ...result,
      stdout: Buffer.concat(stdoutChunks).toString("utf8"),
      stderr: Buffer.concat(stderrChunks).toString("utf8"),
      outputTruncated: truncated
    }));
  }

  /** 执行一条远端命令并返回流式句柄，由调用方直接消费 stdout/stderr。 */
  stream(command: string, options: SshExecOptions = {}): SshStreamHandle {
    return this.spawnRemote(command, options);
  }

  private spawnRemote(command: string, options: SshExecOptions): SshStreamHandle {
    const sshPath = this.config.sshPath ?? "ssh";
    const remote = remoteCommandLine(command, this.config.remoteCwd);
    const args = [...baseArgs(this.config), this.config.host, remote];
    const child = spawn(sshPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutMs = options.timeoutMs === undefined ? DEFAULT_TIMEOUT_MS : options.timeoutMs;
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, timeoutMs);
      timer.unref?.();
    }
    const onAbort = (): void => { child.kill("SIGTERM"); };
    options.signal?.addEventListener("abort", onAbort, { once: true });

    const done = new Promise<SshExecResult>((resolve) => {
      child.once("error", (error) => {
        cleanup();
        resolve({ stdout: "", stderr: error.message, exitCode: null, signal: null, timedOut, outputTruncated: false });
      });
      child.once("close", (code, signal) => {
        cleanup();
        resolve({ stdout: "", stderr: "", exitCode: code, signal: signal === null ? null : String(signal), timedOut, outputTruncated: false });
      });
      function cleanup(): void {
        if (timer !== undefined) clearTimeout(timer);
        options.signal?.removeEventListener("abort", onAbort);
      }
    });

    return {
      stdout: child.stdout,
      stderr: child.stderr,
      done,
      kill: () => { child.kill("SIGTERM"); }
    };
  }
}
