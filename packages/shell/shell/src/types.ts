/**
 * 功能：shell 执行协议的中立类型（会话/命令/退出码/环境变量）。
 * 作用：定义「请求 → 规格 → 执行句柄」的抽象接缝，具体方言（pwsh/bash）在各自包内用 child_process 实现。
 * 关联文件：pwsh-local、bash-local（实现方）；tool-shell（模型工具调用方）。
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-shell/types。
 */
import type { SandboxMode, SandboxEnforcement } from "lfaa-sandbox";
import type { SandboxExecutionPolicy } from "lfaa-sandbox-policy";

/** LFAA 托管环境变量前缀（对应 DSH 的 DSH_ENV_PREFIX）；子进程仅白名单继承此前缀变量。 */
export const LFAA_ENV_PREFIX = "LFAA_";

/** 前台命令到达时限时的处置：kill 直接杀死；none 交由上层把命令转为后台任务（本地无任务表时等同于不动作）。 */
export type ShellExpiryPolicy = "kill" | "none";

/** 一个流通道的收集结果。 */
export interface CollectedOutput {
  text: string;
  truncated: boolean;
}

/** 调用方发起命令的原始请求，字段可缺省；resolve 补默认值。 */
export interface ShellExecRequest {
  command: string;
  workdir?: string;
  /** 墙钟上限毫秒；executor 补默认与上限。 */
  timeoutMs?: number;
  onExpiry?: ShellExpiryPolicy;
  /** stdout 保留的尾部落点（字节），超出即截断。 */
  stdoutMaxBytes?: number;
  signal?: AbortSignal;
  /** 写入进程 stdin 的文本。 */
  stdin?: string;
  /** 额外环境变量（与 LFAA_* 托管变量合并）。 */
  env?: Record<string, string>;
  /** shell-env 收集到的 LFAA_* 托管环境变量。 */
  lfaaEnv?: Record<string, string>;
  /** 沙箱执行策略；未提供表示非受限执行。 */
  sandboxPolicy?: SandboxExecutionPolicy;
}

/** resolve 补全后的不可变执行规格。 */
export interface ShellExecSpec {
  command: string;
  workdir: string | undefined;
  timeoutMs: number;
  onExpiry: ShellExpiryPolicy;
  stdoutMaxBytes: number;
  signal: AbortSignal | undefined;
  stdin: string | undefined;
  env: Record<string, string> | undefined;
  lfaaEnv: Record<string, string> | undefined;
  sandboxPolicy: SandboxExecutionPolicy | undefined;
}

/** 进程观察状态。 */
export type ShellProcessStatus = "running" | "completed" | "killed";

/** 一次非消费式输出读取的增量。 */
export interface ShellProcessRead {
  delta: string;
  /** 缓冲因取舍而丢失了早期字节。 */
  lossy: boolean;
}

/** 一次受限执行的沙箱事实。 */
export interface ShellSandboxInfo {
  mode: SandboxMode;
  /** 命令被策略拒绝（未运行）。 */
  denied: boolean;
  /** 受限执行的落实强度。 */
  enforcement?: SandboxEnforcement;
  /** 沙箱运行器自身失败（命令未运行，属于沙箱问题而非命令失败）。 */
  runnerFailed?: boolean;
}

/** 一次命令执行的最终结果。 */
export interface ShellRunResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  aborted: boolean;
  timeoutMs: number;
  stdout: CollectedOutput;
  stderr: CollectedOutput;
  sandbox?: ShellSandboxInfo;
}

/** 观察中的进程句柄。 */
export interface ShellProcess {
  readonly status: ShellProcessStatus;
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly sandbox?: ShellSandboxInfo;
  /** 进程退出并完成流收集后 resolve。 */
  done: Promise<void>;
  /** 非消费式读取自上次以来的增量（合并 stdout 后接 [stderr] 段）。 */
  readOutput(): ShellProcessRead;
  /** 外部杀死进程；已退出返回 false。 */
  kill(): boolean;
}

/** 可 await 结果的执行句柄。 */
export interface ShellExecution extends ShellProcess {
  result(): Promise<ShellRunResult>;
}

/**
 * shell 执行器接缝。具体方言（pwsh/bash）实现本接口并经 registerShellExecutor 注册到 ctx.shell。
 * 若 executor 本身即受限（如 pwsh-sandbox），应暴露 sandboxMode。
 */
export interface ShellExecutor {
  /** executor 自身强制的默认沙箱模式（非受限则省略）。 */
  readonly sandboxMode?: SandboxMode;
  /** 补全请求为执行规格（默认值/上限/校验），不启动进程。 */
  resolve(request: ShellExecRequest): ShellExecSpec;
  /** 启动命令并返回执行句柄。 */
  execute(spec: ShellExecSpec): Promise<ShellExecution>;
}
