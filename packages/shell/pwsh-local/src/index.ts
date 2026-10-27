/**
 * 功能：本机 PowerShell 执行器（主 shell）。
 * 作用：实现 ShellExecutor 接缝，用 child_process 以非交互 -Command 模式执行命令，
 *       统一处理有界默认超时/落点/中止，并注入 LFAA_* 托管环境；停止时委托 Windows 进程树 Owner。
 *       注册为 ctx.shell。
 * 关联文件：shell（协议/引擎）、resolve.ts（解释器选择）、tool-shell（模型工具）。
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-pwsh-local。
 */
import type { Context } from "@deepseek-ai/cordis";
import {
  DEFAULT_STDOUT_MAX_BYTES,
  DEFAULT_TIMEOUT_MS,
  MAX_TIMEOUT_MS,
  registerShellExecutor,
  spawnLocalProcess,
  type ShellExecRequest,
  type ShellExecSpec,
  type ShellExecution,
  type ShellExecutor,
} from "lfaa-shell";
import { killProcessTree } from "lfaa-win32-process";
import { resolvePwsh } from "./resolve.js";

/** PowerShell 本地执行器（非受限）。 */
export class PwshLocalShellExecutor implements ShellExecutor {
  constructor(private readonly ctx: Context) {}

  resolve(request: ShellExecRequest): ShellExecSpec {
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

  async execute(spec: ShellExecSpec): Promise<ShellExecution> {
    const pwsh = resolvePwsh();
    // 非交互执行：禁 logo/profile、绕过执行策略（本机脚本为受控命令），-Command 跑整段。
    const argv = [
      pwsh.exe,
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy", "Bypass",
      // Windows PowerShell 5.1 默认按系统代码页写管道；与统一 UTF-8 收集器对齐，避免中文名称/错误变成乱码。
      "-Command", "$OutputEncoding = [System.Text.UTF8Encoding]::new($false); [Console]::InputEncoding = $OutputEncoding; [Console]::OutputEncoding = $OutputEncoding;\n" + spec.command,
    ];
    // 合并 shell-env 托管变量（若已挂载），再叠加规格显式 env。
    const shellEnv = this.ctx.get("shellEnv");
    const collected = shellEnv !== undefined ? shellEnv.collect() : {};
    const merged: ShellExecSpec = {
      ...spec,
      lfaaEnv: { ...collected, ...(spec.lfaaEnv ?? {}) },
    };
    return spawnLocalProcess({
      argv,
      cwd: merged.workdir,
      requestStop: async (_reason, pid) => {
        if (typeof pid !== "number") return false;
        return (await killProcessTree(pid, 250)).stopped;
      },
    }, merged);
  }
}

export const name = "lfaa-pwsh-local";

export function apply(ctx: Context): void {
  registerShellExecutor(ctx, new PwshLocalShellExecutor(ctx), "shell");
}
