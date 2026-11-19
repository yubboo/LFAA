// 后台任务进程池：维护会话归属、有界字节缓冲、中文编码解码与跨平台进程树终止。
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { formatCommandOutput } from "@lfaa/shell-env";
import { sanitizeCommandEnv, type ShellInvocation } from "@lfaa/shell";
import type { BackgroundJobItem, JobsPluginConfig, StartBackgroundJobInput } from "./types";

const MAX_BYTES = 512 * 1024;
const MAX_TEXT = 16_000;
const DEFAULT_TIMEOUT_MS = 10 * 60_000;

interface JobEntry {
  item: BackgroundJobItem;
  child?: ChildProcess;
  stdout: Buffer[];
  stderr: Buffer[];
  totalBytes: number;
  timer?: ReturnType<typeof setTimeout> | undefined;
  flushTimer?: ReturnType<typeof setTimeout> | undefined;
  stoppedByUser: boolean;
}

function appendBounded(target: Buffer[], chunk: Buffer, entry: JobEntry): void {
  if (entry.totalBytes >= MAX_BYTES) return;
  const remaining = MAX_BYTES - entry.totalBytes;
  const slice = chunk.length > remaining ? chunk.subarray(0, remaining) : chunk;
  target.push(slice);
  entry.totalBytes += slice.length;
}

function killProcessTree(child: ChildProcess): void {
  if (process.platform === "win32" && typeof child.pid === "number") {
    execFile("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true }, () => {
      try {
        child.kill("SIGKILL");
      } catch {
        // 进程已退出时忽略异常。
      }
    });
    return;
  }
  try {
    child.kill("SIGTERM");
  } catch {
    // 忽略已退出进程。
  }
}

/** 管理当前 Host 生命周期内的后台命令行进程及实时输出。 */
export class BackgroundJobManager {
  private readonly jobs = new Map<string, JobEntry>();
  private readonly listeners = new Set<() => void>();

  constructor(private readonly config: JobsPluginConfig = {}) {}

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  private async refreshOutput(entry: JobEntry, partial: boolean): Promise<void> {
    const out = await formatCommandOutput(
      Buffer.concat(entry.stdout),
      Buffer.concat(entry.stderr),
      partial,
    );
    entry.item = {
      ...entry.item,
      output: out.slice(-MAX_TEXT),
    };
    this.notify();
  }

  async start(input: StartBackgroundJobInput): Promise<BackgroundJobItem> {
    const command = input.command.trim();
    if (!command) throw new Error("后台任务命令不能为空。");
    const id = `job-${randomUUID().slice(0, 8)}`;
    const title = (input.title?.trim() || command).slice(0, 72);
    const entry: JobEntry = {
      item: {
        id,
        sessionId: input.sessionId,
        title,
        command,
        cwd: input.cwd,
        status: "running",
        output: "",
        startedAt: Date.now(),
      },
      stdout: [],
      stderr: [],
      totalBytes: 0,
      stoppedByUser: false,
    };
    this.jobs.set(id, entry);

    const invocation: ShellInvocation | undefined = this.config.resolveInvocation
      ? await this.config.resolveInvocation(command, input.cwd)
      : undefined;

    const child = invocation
      ? spawn(invocation.file, invocation.args, {
          cwd: input.cwd,
          windowsHide: true,
          windowsVerbatimArguments: invocation.windowsVerbatimArguments ?? false,
          stdio: ["ignore", "pipe", "pipe"],
          env: sanitizeCommandEnv(),
        })
      : spawn(command, {
          cwd: input.cwd,
          shell: true,
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
          env: sanitizeCommandEnv(),
        });

    entry.child = child;
    const scheduleRefresh = () => {
      if (entry.flushTimer) return;
      entry.flushTimer = setTimeout(() => {
        entry.flushTimer = undefined;
        void this.refreshOutput(entry, true);
      }, 150);
    };

    child.stdout?.on("data", (chunk: Buffer) => {
      appendBounded(entry.stdout, chunk, entry);
      scheduleRefresh();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      appendBounded(entry.stderr, chunk, entry);
      scheduleRefresh();
    });

    const timeoutMs = input.timeoutMs ?? this.config.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (timeoutMs > 0) {
      entry.timer = setTimeout(() => {
        if (entry.item.status === "running") {
          entry.stoppedByUser = true;
          killProcessTree(child);
        }
      }, timeoutMs);
    }

    const finalize = (code: number | null, errMessage?: string) => {
      if (entry.timer) clearTimeout(entry.timer);
      if (entry.flushTimer) clearTimeout(entry.flushTimer);
      entry.timer = undefined;
      entry.flushTimer = undefined;
      void this.refreshOutput(entry, false).then(() => {
        const nextStatus = entry.stoppedByUser
          ? "killed"
          : code === 0 && !errMessage
            ? "done"
            : "error";
        const baseOutput = entry.item.output;
        entry.item = {
          ...entry.item,
          status: nextStatus,
          ...(typeof code === "number" ? { exitCode: code } : {}),
          output: errMessage && !baseOutput ? errMessage : baseOutput,
          endedAt: Date.now(),
        };
        this.notify();
      });
    };

    child.once("error", (err) => finalize(null, err.message));
    child.once("close", (code) => finalize(code));
    this.notify();
    return entry.item;
  }

  get(id: string, sessionId?: string): BackgroundJobItem | null {
    const entry = this.jobs.get(id);
    if (!entry) return null;
    if (sessionId && entry.item.sessionId !== sessionId) return null;
    return entry.item;
  }

  list(sessionId?: string): BackgroundJobItem[] {
    const items = [...this.jobs.values()]
      .map((e) => e.item)
      .filter((item) => !sessionId || item.sessionId === sessionId);
    return items.sort((a, b) => b.startedAt - a.startedAt);
  }

  async stop(id: string, sessionId?: string): Promise<BackgroundJobItem | null> {
    const entry = this.jobs.get(id);
    if (!entry) return null;
    if (sessionId && entry.item.sessionId !== sessionId) return null;
    if (entry.item.status !== "running") return entry.item;
    entry.stoppedByUser = true;
    if (entry.child) killProcessTree(entry.child);
    await new Promise((r) => setTimeout(r, 120));
    return entry.item;
  }

  stopSession(sessionId: string): void {
    for (const entry of this.jobs.values()) {
      if (entry.item.sessionId === sessionId && entry.item.status === "running" && entry.child) {
        entry.stoppedByUser = true;
        killProcessTree(entry.child);
      }
    }
  }

  disposeAll(): void {
    for (const entry of this.jobs.values()) {
      if (entry.timer) clearTimeout(entry.timer);
      if (entry.flushTimer) clearTimeout(entry.flushTimer);
      if (entry.item.status === "running" && entry.child) {
        entry.stoppedByUser = true;
        killProcessTree(entry.child);
      }
    }
    this.jobs.clear();
    this.listeners.clear();
  }
}
