/**
 * 功能：沙箱化 bash 执行器。
 * 作用：与 pwsh-sandbox 同构——spawn 前把 bash argv 交给 lfaaSandbox 做受限隔离；
 *       未加载提供方则失败即关闭。bash 本机不可用时同样明确报错。注册为 ctx.sandboxedBash。
 * 关联文件：lfaa-sandbox、bash-local、shell（引擎）。
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
import { resolveBash } from "lfaa-bash-local/src/index.js";

interface SandboxAwareContext {
  lfaaSandbox?: SandboxProvider;
}

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

function bashArgv(command: string): string[] {
  const bash = resolveBash();
  if (!bash.available || bash.exe === undefined) throw new Error(bash.reason ?? "bash 不可用。");
  return [bash.exe, "--noprofile", "--norc", "-c", command];
}

/** 沙箱化 bash 执行器。 */
export class BashSandboxShellExecutor implements ShellExecutor {
  readonly sandboxMode: SandboxMode = "workspace-write";

  constructor(private readonly ctx: Context) {}

  resolve(request: ShellExecRequest): ShellExecSpec {
    return defaultResolve(request);
  }

  async execute(spec: ShellExecSpec): Promise<ShellExecution> {
    const provider = (this.ctx as unknown as SandboxAwareContext).lfaaSandbox;
    if (provider === undefined) {
      throw new SandboxUnavailableError("本地未加载 lfaaSandbox 提供方，已拒绝受限命令执行。");
    }
    const requested = bashArgv(spec.command);
    const policy: SandboxExecutionPolicy = spec.sandboxPolicy ?? createSandboxExecutionPolicy({
      mode: "workspace-write",
      platform: process.platform === "win32" ? "win32" : process.platform === "darwin" ? "darwin" : "linux",
      target: { kind: "local" },
      workspaceRoot: spec.workdir ?? process.cwd(),
      workingDirectory: spec.workdir ?? process.cwd(),
    });
    let confined: ConfinedCommand;
    try {
      confined = await provider.confine(requested, policy, spec.signal);
    } catch (error) {
      if (error instanceof SandboxUnavailableError) throw error;
      throw new SandboxUnavailableError(`沙箱提供方拒绝执行：${error instanceof Error ? error.message : String(error)}`);
    }
    const verified = assertSandboxResult(requested, policy, confined);
    const execution = await spawnLocalProcess({
      argv: [...verified.argv],
      cwd: spec.workdir,
      ...(verified.requestStop ? { requestStop: verified.requestStop } : {}),
    }, spec);
    return withSandboxResult(execution, verified);
  }
}

export const name = "lfaa-bash-sandbox";

export function apply(ctx: Context): void {
  registerShellExecutor(ctx, new BashSandboxShellExecutor(ctx), "sandboxedBash");
}
