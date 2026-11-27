// 定义 @lfaa/jobs 后台任务契约：任务状态、快照结构与启动参数。
import type { ShellInvocation } from "@lfaa/shell";

export type BackgroundJobStatus = "running" | "done" | "error" | "killed";

/** 描述供前端右侧栏与 Agent 查询的后台任务快照。 */
export interface BackgroundJobItem {
  id: string;
  sessionId: string;
  title: string;
  command: string;
  cwd: string;
  status: BackgroundJobStatus;
  exitCode?: number;
  output: string;
  startedAt: number;
  endedAt?: number;
}

export interface StartBackgroundJobInput {
  sessionId: string;
  command: string;
  title?: string;
  cwd: string;
  timeoutMs?: number;
}

export interface JobsPluginConfig {
  /** 命令方言解析；未装配或未注入时回落到本地 Shell 默认执行。 */
  resolveInvocation?: (command: string, cwd: string) => Promise<ShellInvocation | undefined>;
  resolveSessionRoots?: (sessionId: string) => Promise<string[]>;
  defaultTimeoutMs?: number;
}
