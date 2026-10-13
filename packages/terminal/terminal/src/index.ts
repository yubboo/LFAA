/**
 * 功能：本机终端会话管理器。
 * 作用：基于 lfaaSubprocess.spawnTerminal 创建有界的 Shell 会话，支持写入命令、读取增量输出、关闭。
 * 原生 PTY 由 subprocess-local 提供：
 *  - 输出按 UTF-8 解码后放入有界环形缓冲（默认 64 KiB），超出丢弃最旧内容，防止无界增长；
 * 关联文件：packages/subprocess/subprocess/src/index.ts、packages/terminal/terminal-bash/src/index.ts。
 */
import { randomUUID } from "node:crypto";
import type { Context } from "@deepseek-ai/cordis";
import type { SubprocessRuntime, TerminalHandle } from "lfaa-subprocess";
import { resolveDefaultShell, type ShellLaunch } from "lfaa-terminal-bash";

/** 会话输出缓冲上限（字节），防止长时间运行的命令把输出无限堆积。 */
const SESSION_BUFFER_BYTES = 64 * 1024;

export interface TerminalSession {
  readonly id: string;
  /** 读取当前缓冲的全部输出（已消费不清空，重复读取返回累积内容）。 */
  read(): string;
  /** 向会话标准输入写入一段文本（命令需自行加换行）。 */
  write(data: string): Promise<void>;
  /** 终止会话进程树。 */
  close(): Promise<void>;
  /** 等待会话退出，返回退出码。 */
  waitExit(): Promise<number | null>;
}

class ManagedSession implements TerminalSession {
  readonly id = randomUUID();
  private buffer = "";
  private handle: TerminalHandle;
  private exited: Promise<number | null>;

  constructor(handle: TerminalHandle) {
    this.handle = handle;
    this.exited = handle.done.then((outcome) => outcome.exitCode);
    // 后台排空输出流，解码并做有界缓冲。
    void this.drain();
  }

  private async drain(): Promise<void> {
    try {
      for await (const chunk of this.handle.output) {
        const text = Buffer.from(chunk.bytes).toString("utf8");
        this.buffer += text;
        // 超出上限时丢弃最旧内容，只保留尾部。
        if (Buffer.byteLength(this.buffer, "utf8") > SESSION_BUFFER_BYTES) {
          this.buffer = this.buffer.slice(-Math.floor(SESSION_BUFFER_BYTES / 2));
        }
      }
    } catch {
      // 流异常：会话结束，忽略。
    }
  }

  read(): string {
    return this.buffer;
  }

  async write(data: string): Promise<void> {
    await this.handle.writeStdin(new TextEncoder().encode(data));
  }

  async close(): Promise<void> {
    await this.handle.terminate("session closed");
  }

  waitExit(): Promise<number | null> {
    return this.exited;
  }
}

/** 终端会话服务：创建/查找/关闭会话。 */
export interface TerminalService {
  createSession(cwd: string, shell?: ShellLaunch): Promise<TerminalSession>;
  getSession(id: string): TerminalSession | undefined;
}

export class TerminalManager implements TerminalService {
  private sessions = new Map<string, ManagedSession>();
  constructor(private readonly runtime: SubprocessRuntime) {}

  async createSession(cwd: string, shell?: ShellLaunch): Promise<TerminalSession> {
    const launch = shell ?? await resolveDefaultShell();
    const handle: TerminalHandle = await this.runtime.spawnTerminal({
      target: { kind: "local" },
      platform: process.platform === "win32" ? "win32" : process.platform === "darwin" ? "darwin" : "linux",
      executable: launch.executable,
      args: launch.args,
      cwd,
      columns: 120,
      rows: 30,
      maxQueuedOutputBytes: SESSION_BUFFER_BYTES,
      terminationGraceMs: 2000
    });
    const session = new ManagedSession(handle);
    this.sessions.set(session.id, session);
    void session.waitExit().then(() => { this.sessions.delete(session.id); }, () => { this.sessions.delete(session.id); });
    return session;
  }

  async dispose(): Promise<void> {
    const sessions = [...this.sessions.values()];
    this.sessions.clear();
    await Promise.allSettled(sessions.map(session => session.close()));
  }

  getSession(id: string): TerminalSession | undefined {
    return this.sessions.get(id);
  }
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    lfaaTerminal: TerminalService;
    lfaaSubprocess: SubprocessRuntime;
  }
}

export const name = "lfaaTerminal";
export const inject = ["lfaaSubprocess", "lfaaTerminalBash"] as const;

/** 提供终端会话服务。 */
export function apply(ctx: Context): void {
  const runtime = ctx.lfaaSubprocess;
  const manager = new TerminalManager(runtime);
  ctx.provide(name, manager);
  ctx.effect(() => () => manager.dispose());
}
