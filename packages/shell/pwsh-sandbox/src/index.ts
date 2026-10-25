/**
 * 功能：沙箱化 PowerShell 执行器。
 * 作用：在 spawn 前把命令 argv 交给 lfaaSandbox 提供方做受限隔离（文件写边界/权限边界），
 *       未加载合格提供方时按 lfaa-sandbox 约定「失败即关闭」直接拒绝执行，绝不静默回退到不受限 shell。
 * 关联文件：lfaa-sandbox（confine/assertSandboxResult）、pwsh-local（解释器/argv）、shell（引擎）。
 */
import type { Context } from "@deepseek-ai/cordis";
import {
  DEFAULT_STDOUT_MAX_BYTES,
  DEFAULT_TIMEOUT_MS,
  MAX_TIMEOUT_MS,
  registerShellExecutor,
  spawnLocalProcess,
  type ShellExecution,
  type ShellExecRequest,
  type ShellExecSpec,
  type ShellExecutor,
} from "lfaa-shell";
import { withSandboxResult } from "lfaa-shell";
import {
  SandboxUnavailableError,
  assertSandboxResult,
  type ConfinedCommand,
  type SandboxProvider,
} from "lfaa-sandbox";
import { createSandboxExecutionPolicy, type SandboxExecutionPolicy, type SandboxMode } from "lfaa-sandbox-policy";
import { resolvePwsh } from "lfaa-pwsh-local/src/resolve.js";

/** 未在 Context 中声明为固定键，故以结构类型惰性读取（可能未挂载提供方）。 */
interface SandboxAwareContext {
  lfaaSandbox?: SandboxProvider;
}

/** 与 pwsh-local 一致的请求默认补全（避免反向依赖整包）。 */
function defaultResolve(request: ShellExecRequest): ShellExecSpec {
  const timeoutMs = Number.isFinite(request.timeoutMs) && (request.timeoutMs ?? 0) > 0
    ? Math.min(Math.trunc(request.timeoutMs!), MAX_TIMEOUT_MS)
    : DEFAULT_TIMEOUT_MS;
  return {
    command: request.command,
    workdir: request.workdir ?? process.cwd(),
    timeoutMs,
    onExpiry: request.onExpiry ?? "kill",
    stdoutMaxBytes: request.stdoutMaxBytes ?? DEFAULT_STDOUT_MAX_BYTES,
    signal: request.signal,
    stdin: request.stdin,
    env: request.env,
    lfaaEnv: request.lfaaEnv,
    sandboxPolicy: request.sandboxPolicy,
  };
}

/** 以请求规格构造 pwsh argv（与 pwsh-local 一致）。 */
function pwshArgv(command: string, workingDirectory: string): string[] {
  const pwsh = resolvePwsh();
  const argv = [
    pwsh.exe,
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy", "Bypass",
  ];
  // PowerShell 7 runspace location can differ from the process CWD; initialize it from the same validated policy path without rewriting the user's command.
  if (pwsh.edition === "pwsh") argv.push("-WorkingDirectory", workingDirectory);
  argv.push("-Command", command);
  return argv;
}

/** 沙箱化 pwsh 执行器；默认模式 workspace-write。 */
export class PwshSandboxShellExecutor implements ShellExecutor {
  readonly sandboxMode: SandboxMode = "workspace-write";

  constructor(private readonly ctx: Context) {}

  resolve(request: ShellExecRequest): ShellExecSpec {
    return defaultResolve(request);
  }

  async execute(spec: ShellExecSpec): Promise<ShellExecution> {
    const provider = (this.ctx as unknown as SandboxAwareContext).lfaaSandbox;
    if (provider === undefined) {
      // 失败即关闭：没有合格沙箱提供方就不跑受限命令。
      throw new SandboxUnavailableError("本地未加载 lfaaSandbox 提供方，已拒绝受限命令执行。");
    }
    const policy: SandboxExecutionPolicy = spec.sandboxPolicy ?? createSandboxExecutionPolicy({
      mode: "workspace-write",
      platform: process.platform === "win32" ? "win32" : process.platform === "darwin" ? "darwin" : "linux",
      target: { kind: "local" },
      workspaceRoot: spec.workdir ?? process.cwd(),
      workingDirectory: spec.workdir ?? process.cwd(),
    });
    const requested = pwshArgv(spec.command, policy.workingDirectory ?? policy.workspaceRoot);
    let confined: ConfinedCommand;
    try {
      confined = await provider.confine(requested, policy, spec.signal);
    } catch (error) {
      if (error instanceof SandboxUnavailableError) throw error;
      throw new SandboxUnavailableError(`沙箱提供方拒绝执行：${error instanceof Error ? error.message : String(error)}`);
    }
    // 核验提供方没有偷偷放宽模式或替换命令。
    const verified = assertSandboxResult(requested, policy, confined);
    const execution = await spawnLocalProcess(
      {
        argv: [...verified.argv],
        cwd: spec.workdir,
        ...(verified.requestStop ? { requestStop: verified.requestStop } : {}),
      },
      spec,
    );
    return withSandboxResult(execution, verified);
  }
}

export const name = "lfaa-pwsh-sandbox";

export function apply(ctx: Context): void {
  registerShellExecutor(ctx, new PwshSandboxShellExecutor(ctx), "sandboxedShell");
}
