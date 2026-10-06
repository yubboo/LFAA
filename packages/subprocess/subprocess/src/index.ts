/**
 * 功能：定义本机或节点执行器使用的受管子进程服务接口。
 * 作用：要求调用方提交完整 argv、工作目录、环境、输出边界和取消语义，不隐式使用 Shell 或父进程密钥。
 * 关联文件：packages/host/daemon/src/process-control.mjs、packages/jobs/jobs/src/ai-host-tasks.ts 与未来的本机/节点执行插件。
 */
export type ProcessTarget = { readonly kind: "local" } | { readonly kind: "node"; readonly nodeId: string };
export type OutputMode = "stream" | "collect" | "discard";
export const SUBPROCESS_MAX_ARGUMENTS = 256;
export const SUBPROCESS_MAX_ARGUMENT_BYTES = 32 * 1024;
export const SUBPROCESS_MAX_TOTAL_ARGUMENT_BYTES = 256 * 1024;
export const SUBPROCESS_MAX_COLLECTED_OUTPUT_BYTES = 16 * 1024 * 1024;
export const SUBPROCESS_MAX_TERMINAL_QUEUE_BYTES = 16 * 1024 * 1024;

export interface ProcessOutputPolicy {
  readonly stdout: OutputMode;
  readonly stderr: OutputMode;
  /** collect 模式下 stdout 与 stderr 各自的最大保留字节数；必须显式填写。 */
  readonly maxBytesPerStream?: number;
}

export interface SubprocessSpawnSpec {
  readonly target: ProcessTarget;
  readonly platform: "win32" | "linux" | "darwin";
  readonly executable: string;
  readonly args: readonly string[];
  readonly cwd: string;
  /** 只表示显式环境覆盖；提供方不得默认继承父进程环境。 */
  readonly env?: Readonly<Record<string, string>>;
  readonly stdin: "pipe" | "discard";
  readonly output: ProcessOutputPolicy;
  /** 终止主进程树时等待优雅退出的毫秒数；超时与取消由调用方通过 AbortSignal 决定。 */
  readonly terminationGraceMs: number;
  readonly signal?: AbortSignal;
}

export interface ProcessOutputChunk {
  readonly stream: "stdout" | "stderr";
  readonly offset: number;
  readonly bytes: Uint8Array;
}

export interface ProcessOutcome {
  readonly exitCode: number | null;
  readonly signal: string | null;
  readonly cancelled: boolean;
  readonly timedOut: boolean;
  readonly outputTruncated: boolean;
}

export interface SubprocessHandle {
  readonly pid?: number;
  readonly output: AsyncIterable<ProcessOutputChunk>;
  readonly done: Promise<ProcessOutcome>;
  writeStdin(chunk: Uint8Array): Promise<void>;
  closeStdin(): Promise<void>;
  /** 必须终止同一受管进程树并等待其静默；重复调用应安全。 */
  terminate(reason?: string): Promise<ProcessOutcome>;
}

export interface TerminalSpawnSpec extends Omit<SubprocessSpawnSpec, "stdin" | "output"> {
  readonly columns: number;
  readonly rows: number;
  readonly maxQueuedOutputBytes: number;
}

export interface TerminalHandle extends SubprocessHandle {
  resize(columns: number, rows: number): Promise<void>;
  sendSignal(signal: string): Promise<void>;
}

/** 校验终端尺寸及队列上限，避免终端尺寸或未消费输出造成资源无界增长。 */
export function validateTerminalSpawnSpec(spec: TerminalSpawnSpec): TerminalSpawnSpec {
  const base = validateSubprocessSpawnSpec({
    ...spec,
    stdin: "pipe",
    output: { stdout: "stream", stderr: "stream" }
  });
  if (!Number.isSafeInteger(spec.columns) || spec.columns < 1 || spec.columns > 500
    || !Number.isSafeInteger(spec.rows) || spec.rows < 1 || spec.rows > 300) {
    throw new SubprocessSpecError("终端行列尺寸超出允许范围。");
  }
  if (!Number.isSafeInteger(spec.maxQueuedOutputBytes) || spec.maxQueuedOutputBytes < 1024
    || spec.maxQueuedOutputBytes > SUBPROCESS_MAX_TERMINAL_QUEUE_BYTES) {
    throw new SubprocessSpecError("终端输出队列必须限制在 1 KiB 至 16 MiB。");
  }
  return Object.freeze({ ...base, columns: spec.columns, rows: spec.rows, maxQueuedOutputBytes: spec.maxQueuedOutputBytes });
}

export class SubprocessSpecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SubprocessSpecError";
  }
}

function isAbsoluteForPlatform(platform: SubprocessSpawnSpec["platform"], path: string): boolean {
  if (platform === "win32") return /^(?:[A-Za-z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+)/u.test(path);
  return path.startsWith("/");
}

function assertText(value: string, label: string): void {
  if (!value || value.includes("\0")) throw new SubprocessSpecError(`${label} 不能为空或包含空字符。`);
}

/** 校验并复制进程请求，阻止调用方在派发后改变 argv 或环境。 */
export function validateSubprocessSpawnSpec(spec: SubprocessSpawnSpec): SubprocessSpawnSpec {
  assertText(spec.executable, "可执行文件");
  assertText(spec.cwd, "工作目录");
  if (!isAbsoluteForPlatform(spec.platform, spec.cwd)) throw new SubprocessSpecError("工作目录必须是执行目标上的绝对路径。");
  if (!Array.isArray(spec.args) || spec.args.some(arg => typeof arg !== "string" || arg.includes("\0"))) {
    throw new SubprocessSpecError("argv 参数必须是无空字符的字符串列表。");
  }
  if (spec.args.length > SUBPROCESS_MAX_ARGUMENTS
    || spec.args.some(arg => Buffer.byteLength(arg, "utf8") > SUBPROCESS_MAX_ARGUMENT_BYTES)
    || spec.args.reduce((total, arg) => total + Buffer.byteLength(arg, "utf8"), 0) > SUBPROCESS_MAX_TOTAL_ARGUMENT_BYTES) {
    throw new SubprocessSpecError("argv 参数数量或总字节数超过系统上限。");
  }
  if (spec.target.kind === "node") assertText(spec.target.nodeId, "目标节点 ID");
  else if (spec.target.kind !== "local") throw new SubprocessSpecError("子进程目标无效。");
  if (!Number.isSafeInteger(spec.terminationGraceMs) || spec.terminationGraceMs < 0) {
    throw new SubprocessSpecError("进程树终止宽限时间必须是非负整数。");
  }
  const output = spec.output;
  if (!(output.stdout === "stream" || output.stdout === "collect" || output.stdout === "discard")
    || !(output.stderr === "stream" || output.stderr === "collect" || output.stderr === "discard")) {
    throw new SubprocessSpecError("标准输出策略无效。");
  }
  if ((output.stdout === "collect" || output.stderr === "collect")
    && (!Number.isSafeInteger(output.maxBytesPerStream) || (output.maxBytesPerStream ?? 0) < 1
      || (output.maxBytesPerStream ?? 0) > SUBPROCESS_MAX_COLLECTED_OUTPUT_BYTES)) {
    throw new SubprocessSpecError("收集输出时必须设置 1 字节至 16 MiB 的显式上限。");
  }
  const env = spec.env === undefined ? undefined : Object.freeze(Object.fromEntries(Object.entries(spec.env).map(([key, value]) => {
    assertText(key, "环境变量名称");
    if (key.includes("=")) throw new SubprocessSpecError("环境变量名称不能包含等号。");
    if (typeof value !== "string" || value.includes("\0")) throw new SubprocessSpecError("环境变量值必须是无空字符的字符串。");
    return [key, value];
  })));
  return Object.freeze({
    ...spec,
    target: Object.freeze({ ...spec.target }),
    args: Object.freeze([...spec.args]),
    output: Object.freeze({ ...output }),
    ...(env === undefined ? {} : { env })
  });
}

/** 由本机或 Daemon 插件实现的受管子进程服务。 */
export interface SubprocessRuntime {
  /** 在与文件提供方相同的执行目标上解析程序；禁止猜测相对路径基准。 */
  resolveExecutable(target: ProcessTarget, command: string, env?: Readonly<Record<string, string>>, signal?: AbortSignal): Promise<string>;

  /** 按完整请求创建受管进程；终止和释放必须覆盖整棵进程树。 */
  spawn(spec: SubprocessSpawnSpec): Promise<SubprocessHandle>;

  /** 创建有界伪终端会话；不在宿主接口内添加 Shell 或启动默认值。 */
  spawnTerminal(spec: TerminalSpawnSpec): Promise<TerminalHandle>;
}

/** 将真实实现登记到 Cordis 宿主；实现包拥有进程句柄、任务绑定和卸载清理责任。 */
export function registerSubprocessProvider(
  ctx: { provide(name: string, service: SubprocessRuntime): unknown },
  provider: SubprocessRuntime
): void {
  ctx.provide("lfaaSubprocess", provider);
}
