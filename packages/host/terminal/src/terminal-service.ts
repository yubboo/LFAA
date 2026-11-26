// @lfaa/terminal Host 服务：按聊天会话维护一个真实 PTY（node-pty），负责输入、窗口尺寸与进程回收。
// 终端等于本机 shell 权限，所以这里只做「本机 + 令牌 + shell 白名单 + cwd 限项目根」四件事。
import { existsSync } from "node:fs";
import { basename, resolve, sep } from "node:path";
import { type Context, Service } from "@deepseek-ai/cordis";
import { spawn, type IPty } from "node-pty";
import type {
  TerminalOpenOptions,
  TerminalServiceConfig,
  TerminalSessionInfo,
} from "./types";

const DEFAULT_REPLAY_BYTES = 32 * 1024;

/** 按平台挑默认 shell：Windows 优先 PowerShell，其余用 $SHELL 或 bash。 */
function platformShell(): string {
  if (process.platform === "win32") return "powershell.exe";
  return process.env.SHELL || "/bin/bash";
}

interface TerminalEntry {
  info: TerminalSessionInfo;
  pty: IPty;
  tail: string;
  listeners: Set<(data: string) => void>;
  exitListeners: Set<(code: number | undefined) => void>;
}

/** Host 侧终端池：一个聊天会话一个 PTY，断开重连复用同一进程。 */
export class TerminalService extends Service {
  private readonly entries = new Map<string, TerminalEntry>();
  private readonly config: Required<Pick<TerminalServiceConfig, "allowedShells" | "maxSessions" | "replayBytes">> & {
    projectRoot: string | undefined;
  };

  constructor(ctx: Context, config: TerminalServiceConfig = {}) {
    super(ctx, "terminal");
    this.config = {
      projectRoot: config.projectRoot ? resolve(config.projectRoot) : undefined,
      allowedShells: config.allowedShells ?? ["powershell.exe", "pwsh.exe", "cmd.exe", "bash", "sh", "zsh", "wsl.exe"],
      maxSessions: config.maxSessions ?? 4,
      replayBytes: config.replayBytes ?? DEFAULT_REPLAY_BYTES,
    };
    // 进程比页面活得久：插件卸载/宿主退出时必须自己收尸，不能靠浏览器关窗。
    ctx.effect(() => () => this.disposeAll());
  }

  /** 列出当前终端（诊断用）。 */
  list(): TerminalSessionInfo[] {
    return [...this.entries.values()].map((entry) => entry.info);
  }

  /** 起一个终端，或复用该会话已有的那个。 */
  open(options: TerminalOpenOptions): TerminalSessionInfo {
    const existing = this.entries.get(options.sessionId);
    if (existing && existing.info.running) {
      if (options.cols && options.rows) this.resize(options.sessionId, options.cols, options.rows);
      return existing.info;
    }
    if (this.entries.size >= this.config.maxSessions) {
      throw new Error(`终端数量已达上限（${this.config.maxSessions}），请先关闭一个`);
    }
    const shell = this.resolveShell(options.shell);
    const cwd = this.resolveCwd(options.cwd);
    const cols = Math.max(20, Math.min(400, options.cols ?? 100));
    const rows = Math.max(4, Math.min(200, options.rows ?? 30));
    const child = spawn(shell, shellArgs(shell), {
      name: "xterm-256color",
      cols,
      rows,
      cwd,
      env: { ...process.env, TERM: "xterm-256color", LFAA_TERMINAL: "1" },
    });
    const info: TerminalSessionInfo = {
      id: `${options.sessionId}:${child.pid ?? 0}`,
      sessionId: options.sessionId,
      title: basename(shell),
      cwd,
      shell,
      cols,
      rows,
      startedAt: Date.now(),
      running: true,
    };
    const entry: TerminalEntry = { info, pty: child, tail: "", listeners: new Set(), exitListeners: new Set() };
    child.onData((data) => {
      entry.tail = (entry.tail + data).slice(-this.config.replayBytes);
      for (const listener of entry.listeners) listener(data);
    });
    child.onExit(({ exitCode }) => {
      entry.info = { ...entry.info, running: false };
      this.entries.delete(options.sessionId);
      for (const listener of entry.exitListeners) listener(exitCode);
    });
    this.entries.set(options.sessionId, entry);
    return info;
  }

  /** 最近一次输出（重连补屏）。 */
  replay(sessionId: string): string {
    return this.entries.get(sessionId)?.tail ?? "";
  }

  /** 是否有可复用的活终端。 */
  has(sessionId: string): boolean {
    return this.entries.get(sessionId)?.info.running === true;
  }

  write(sessionId: string, data: string): void {
    const entry = this.entries.get(sessionId);
    if (!entry?.info.running) return;
    entry.pty.write(data);
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const entry = this.entries.get(sessionId);
    if (!entry?.info.running) return;
    const nextCols = Math.max(20, Math.min(400, Math.round(cols)));
    const nextRows = Math.max(4, Math.min(200, Math.round(rows)));
    if (nextCols === entry.info.cols && nextRows === entry.info.rows) return;
    entry.info = { ...entry.info, cols: nextCols, rows: nextRows };
    try {
      entry.pty.resize(nextCols, nextRows);
    } catch {
      // PTY 刚退出时 resize 会抛错，忽略即可，下一次 open 会重建。
    }
  }

  /** 订阅输出；返回退订函数。 */
  subscribe(sessionId: string, onData: (data: string) => void, onExit: (code: number | undefined) => void): () => void {
    const entry = this.entries.get(sessionId);
    if (!entry) return () => {};
    entry.listeners.add(onData);
    entry.exitListeners.add(onExit);
    return () => {
      entry.listeners.delete(onData);
      entry.exitListeners.delete(onExit);
    };
  }

  /** 结束某个会话的终端（关标签 / 结束会话时调用）。 */
  kill(sessionId: string): void {
    const entry = this.entries.get(sessionId);
    if (!entry) return;
    this.entries.delete(sessionId);
    entry.info = { ...entry.info, running: false };
    try {
      entry.pty.kill();
    } catch {
      // 已经退出的进程 kill 会抛错，忽略。
    }
  }

  /** 宿主退出：全部收掉。 */
  disposeAll(): void {
    for (const sessionId of [...this.entries.keys()]) this.kill(sessionId);
  }

  /** shell 白名单：只按可执行文件名判断，拒绝任意命令。 */
  private resolveShell(requested?: string): string {
    const candidate = requested?.trim() || platformShell();
    const name = basename(candidate).toLowerCase();
    if (!this.config.allowedShells.some((allowed) => allowed.toLowerCase() === name)) {
      throw new Error(`不允许的 shell：${candidate}`);
    }
    return candidate;
  }

  /** cwd 必须落在项目根内；越界与不存在的目录一律回退项目根。 */
  private resolveCwd(requested: string): string {
    const root = this.config.projectRoot;
    const fallback = root ?? process.cwd();
    if (!requested) return fallback;
    const target = resolve(requested);
    if (root && target !== root && !target.startsWith(root + sep)) return fallback;
    return existsSync(target) ? target : fallback;
  }
}

/** PowerShell 不需要额外参数；其余 shell 用 -i 让提示符正常出现。 */
function shellArgs(shell: string): string[] {
  const name = basename(shell).toLowerCase();
  if (name.startsWith("powershell") || name === "pwsh.exe" || name === "pwsh") return ["-NoLogo"];
  if (name === "cmd.exe") return [];
  return ["-i"];
}