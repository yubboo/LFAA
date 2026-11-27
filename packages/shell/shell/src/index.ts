// LFAA Host 的 Shell 服务，统一前台命令的执行时限、取消、增量输出及结算。
import { exec, execFile } from "node:child_process";
import { promisify } from "node:util";
import { type Context, Service } from "@deepseek-ai/cordis";
import { formatCommandOutput } from "./env/command-output";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);
/** 前台命令默认时限：10 分钟，覆盖首次构建、依赖安装等长命令。 */
export const DEFAULT_COMMAND_TIMEOUT_MS = 600_000;
/** 单条命令允许的最大时限：30 分钟；更长任务应使用后台任务。 */
export const MAX_COMMAND_TIMEOUT_MS = 1_800_000;
const byteLimit = 512 * 1024;
const textLimit = 16_000;

function normalizeTimeLimit(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_COMMAND_TIMEOUT_MS;
  return Math.min(MAX_COMMAND_TIMEOUT_MS, Math.max(1_000, Math.floor(value)));
}

/** 子进程不应继承的模型供应商密钥，避免被命令或日志带出。 */
const SENSITIVE_ENV_KEYS = [
  /^OPENAI_API_KEY$/iu,
  /^ANTHROPIC_API_KEY$/iu,
  /^DEEPSEEK_API_KEY$/iu,
  /^ARK_API_KEY$/iu,
  /^GEMINI_API_KEY$/iu,
  /^GOOGLE_API_KEY$/iu,
  /^AZURE_OPENAI_API_KEY$/iu,
  /^AWS_SECRET_ACCESS_KEY$/iu,
  /^AWS_SESSION_TOKEN$/iu,
  /^HF_TOKEN$/iu,
];

/** 复制当前环境并移除供应商密钥；构建与包管理器需要的其余变量保持不变。 */
export function sanitizeCommandEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(base)) {
    if (value === undefined) continue;
    if (SENSITIVE_ENV_KEYS.some((pattern) => pattern.test(key))) continue;
    env[key] = value;
  }
  return env;
}

/** 终止整棵进程树：Windows 用 taskkill /T，其他平台优先尝试进程组再退回单进程。 */
export function terminateProcessTree(pid: number | undefined): void {
  if (!pid) return;
  if (process.platform === "win32") {
    execFile("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true }, () => {
      // taskkill 在进程已退出时返回非零，这里无需处理。
    });
    return;
  }
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // 进程已退出。
    }
  }
}

export interface ShellInvocation {
  file: string;
  args: string[];
  windowsVerbatimArguments?: boolean;
}

export interface ShellRequest {
  command: string;
  cwd: string;
  signal: AbortSignal;
  /** 本次命令的时限毫秒数，缺省使用默认 10 分钟。 */
  timeoutMs?: number;
  onOutput?: ((output: string) => void) | undefined;
}

export interface ShellResult {
  output: string;
  exitCode?: number;
  ok: boolean;
  /** 命令因达到时限被终止时标记，供上层决定是否转后台任务。 */
  timedOut?: boolean;
}

export interface ShellPluginConfig {
  /** 装配层注入的命令方言解析；缺省时由 setResolveInvocation 延迟补齐。 */
  resolveInvocation?: (command: string, cwd: string) => Promise<ShellInvocation>;
  /** 应用级默认时限，缺省 10 分钟。 */
  timeLimitMs?: number;
}

/** 保留原始字节，按固定频率向观察者提供当前命令的完整有界快照。 */
export async function executeShell(request: ShellRequest, invocation?: ShellInvocation): Promise<ShellResult> {
  request.signal.throwIfAborted();
  const timeLimitMs = normalizeTimeLimit(request.timeoutMs);
  const options = { cwd: request.cwd, maxBuffer: byteLimit, signal: request.signal,
    encoding: "buffer" as const, windowsHide: true, env: sanitizeCommandEnv() };
  const execution = invocation
    ? execFileAsync(invocation.file, invocation.args, { ...options, windowsVerbatimArguments: invocation.windowsVerbatimArguments ?? false })
    : execAsync(request.command, options);
  const pid = execution.child.pid;
  let timedOut = false;
  // 自行计时并终止整棵进程树：Node 的 exec 超时只结束 shell，Windows 子进程会残留。
  const killTimer = setTimeout(() => {
    timedOut = true;
    terminateProcessTree(pid);
    setTimeout(() => {
      try {
        execution.child.kill("SIGKILL");
      } catch {
        // 进程已退出。
      }
    }, 3_000);
  }, timeLimitMs);
  const onAbort = () => terminateProcessTree(pid);
  request.signal.addEventListener("abort", onAbort, { once: true });

  let update: ReturnType<typeof setTimeout> | undefined;
  let settled = false;
  let observed = 0;
  let published = 0;
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  if (request.onOutput) {
    const observe = (target: Buffer[]) => (bytes: Buffer) => {
      target.push(bytes);
      if (update) return;
      update = setTimeout(() => {
        const sequence = ++observed;
        const current = formatCommandOutput(Buffer.concat(stdout), Buffer.concat(stderr), true);
        void current.then((output) => {
          if (!settled && sequence > published) {
            published = sequence;
            // 运行中只展示尾部快照，长时间构建不会让观察者一直停在开头。
            request.onOutput?.(output.slice(-textLimit));
          }
        });
        update = undefined;
      }, 125);
    };
    execution.child.stdout?.on("data", observe(stdout));
    execution.child.stderr?.on("data", observe(stderr));
  }

  try {
    const result = await execution;
    settled = true;
    return { ok: true, exitCode: 0, output: (await formatCommandOutput(result.stdout, result.stderr)).slice(0, textLimit) };
  } catch (error) {
    settled = true;
    if (!(error instanceof Error)) throw error;
    const failure = error as Error & {
      code?: number | string; stdout?: Buffer; stderr?: Buffer; killed?: boolean; signal?: string;
    };
    const output = await formatCommandOutput(failure.stdout, failure.stderr);
    // 时限到达由本函数的计时器标记；用户主动取消不算超时。
    const timedOutFlag = timedOut && !request.signal.aborted;
    return {
      ok: false,
      output: (output || failure.message).slice(0, textLimit),
      ...(typeof failure.code === "number" ? { exitCode: failure.code } : {}),
      ...(timedOutFlag ? { timedOut: true } : {}),
    };
  } finally {
    settled = true;
    clearTimeout(update);
    clearTimeout(killTimer);
    request.signal.removeEventListener("abort", onAbort);
  }
}

/** Host 装配层提供 Shell 方言，Agent 与 Tools 共用同一执行入口。 */
export class ShellService extends Service {
  private readonly timeLimitMs: number | undefined;
  private resolveInvocationHook: ShellPluginConfig["resolveInvocation"] | undefined;

  constructor(ctx: Context, config: ShellPluginConfig = {}) {
    super(ctx, "shell");
    this.timeLimitMs = config.timeLimitMs;
    this.resolveInvocationHook = config.resolveInvocation;
  }

  /** 装配完成后注入或替换命令解析器；返回注销函数，卸载后恢复原值。 */
  setResolveInvocation(hook: NonNullable<ShellPluginConfig["resolveInvocation"]>): () => void {
    const previous = this.resolveInvocationHook;
    this.resolveInvocationHook = hook;
    return () => {
      this.resolveInvocationHook = previous;
    };
  }

  private requireResolver(): NonNullable<ShellPluginConfig["resolveInvocation"]> {
    if (!this.resolveInvocationHook) throw new Error("Shell 命令解析器尚未装配。");
    return this.resolveInvocationHook;
  }

  resolveInvocation(command: string, cwd: string): Promise<ShellInvocation> {
    return this.requireResolver()(command, cwd);
  }

  async execute(request: ShellRequest): Promise<ShellResult> {
    request.signal.throwIfAborted();
    const invocation = await this.requireResolver()(request.command, request.cwd);
    const timeoutMs = request.timeoutMs ?? this.timeLimitMs;
    return executeShell({ ...request, ...(timeoutMs === undefined ? {} : { timeoutMs }) }, invocation);
  }
}

export function shellPlugin(ctx: Context, config: ShellPluginConfig): void {
  new ShellService(ctx, config);
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    shell: ShellService;
  }
}
// 与执行入口同包的本地 Shell 方言与输出解码，供 bundle / jobs 直接引用。
export { resolveBash } from "./bash/resolve-bash";
export { resolveCmd, resolvePowerShell } from "./pwsh/resolve-pwsh";
export { formatCommandOutput } from "./env/command-output";

/** 默认导出插件本体，供 Cordis Loader 以包名直接装载。 */
export default shellPlugin;
