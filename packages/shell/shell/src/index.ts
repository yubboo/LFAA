// LFAA Host 的 Shell 服务，统一前台命令的执行时限、取消、增量输出及结算。
import { exec, execFile } from "node:child_process";
import { promisify } from "node:util";
import { type Context, Service } from "@deepseek-ai/cordis";
import { formatCommandOutput } from "@lfaa/shell-env";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);
const timeLimitMs = 15_000;
const byteLimit = 512 * 1024;
const textLimit = 16_000;

export interface ShellInvocation {
  file: string;
  args: string[];
  windowsVerbatimArguments?: boolean;
}

export interface ShellRequest {
  command: string;
  cwd: string;
  signal: AbortSignal;
  onOutput?: ((output: string) => void) | undefined;
}

export interface ShellResult {
  output: string;
  exitCode?: number;
  ok: boolean;
}

export interface ShellPluginConfig {
  resolveInvocation: (command: string, cwd: string) => Promise<ShellInvocation>;
}

/** 保留原始字节，按固定频率向观察者提供当前命令的完整有界快照。 */
export async function executeShell(request: ShellRequest, invocation?: ShellInvocation): Promise<ShellResult> {
  request.signal.throwIfAborted();
  const options = { cwd: request.cwd, timeout: timeLimitMs, maxBuffer: byteLimit, signal: request.signal,
    encoding: "buffer" as const, windowsHide: true };
  const execution = invocation
    ? execFileAsync(invocation.file, invocation.args, { ...options, windowsVerbatimArguments: invocation.windowsVerbatimArguments ?? false })
    : execAsync(request.command, options);

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
            request.onOutput?.(output.slice(0, textLimit));
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
    const failure = error as Error & { code?: number | string; stdout?: Buffer; stderr?: Buffer };
    const output = await formatCommandOutput(failure.stdout, failure.stderr);
    return {
      ok: false,
      output: (output || failure.message).slice(0, textLimit),
      ...(typeof failure.code === "number" ? { exitCode: failure.code } : {}),
    };
  } finally {
    clearTimeout(update);
  }
}

/** Host 装配层提供 Shell 方言，Agent 与 Tools 共用同一执行入口。 */
export class ShellService extends Service {
  constructor(ctx: Context, private readonly config: ShellPluginConfig) {
    super(ctx, "shell");
  }

  async execute(request: ShellRequest): Promise<ShellResult> {
    request.signal.throwIfAborted();
    const invocation = await this.config.resolveInvocation(request.command, request.cwd);
    return executeShell(request, invocation);
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
