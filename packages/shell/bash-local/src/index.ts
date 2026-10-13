/**
 * 功能：本机 bash 执行器（平行 shell，Windows 上为可选能力）。
 * 作用：实现 ShellExecutor 接缝，用 child_process 以 `bash -c` 执行命令。
 * Windows 限制：Windows 原生不带 bash；仅当检测到 Git Bash / WSL bash 时可用，
 *   否则 execute 明确报错（不静默回退 pwsh——bash 与 PowerShell 命令语法不兼容，静默替换会误导模型）。
 *   主 shell 在 Windows 上始终是 pwsh-local（ctx.shell）；本执行器注册为 ctx.shellBash。
 * 关联文件：shell（协议/引擎）、pwsh-local（主 shell）。
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-bash-local。
 */
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";
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

/** bash 解析结果。 */
interface BashResolution {
  available: boolean;
  exe?: string;
  reason?: string;
}

function findOnPath(names: readonly string[]): string | undefined {
  const dirs = (process.env.PATH ?? "").split(delimiter);
  for (const dir of dirs) {
    if (!dir) continue;
    for (const name of names) {
      const candidate = join(dir, name);
      try {
        if (existsSync(candidate)) return candidate;
      } catch { /* 忽略 */ }
    }
  }
  return undefined;
}

// Windows 上常见的 Git Bash 安装位置（PATH 未包含时兜底探测）。
const WINDOWS_BASH_HINTS = [
  "C:\\Program Files\\Git\\bin\\bash.exe",
  "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
];

let cached: BashResolution | undefined;

/** 解析本机 bash（带缓存）。 */
export function resolveBash(): BashResolution {
  if (cached !== undefined) return cached;
  const fromPath = findOnPath(["bash.exe", "bash"]);
  if (fromPath !== undefined) {
    cached = { available: true, exe: fromPath };
    return cached;
  }
  for (const hint of WINDOWS_BASH_HINTS) {
    try {
      if (existsSync(hint)) {
        cached = { available: true, exe: hint };
        return cached;
      }
    } catch { /* 忽略 */ }
  }
  cached = {
    available: false,
    reason: "本机未检测到 bash（PATH 无 bash.exe，且未找到 Git Bash）。Windows 主 shell 请使用 pwsh（ctx.shell）。",
  };
  return cached;
}

/** bash 本地执行器。 */
export class BashLocalShellExecutor implements ShellExecutor {
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
    const bash = resolveBash();
    if (!bash.available || bash.exe === undefined) {
      // 明确报告而非静默回退：bash 与 PowerShell 语法不兼容。
      throw new Error(bash.reason ?? "bash 不可用。");
    }
    const shellEnv = this.ctx.get("shellEnv");
    const collected = shellEnv !== undefined ? shellEnv.collect() : {};
    const argv = [bash.exe, "--noprofile", "--norc", "-c", spec.command];
    return spawnLocalProcess({ argv, cwd: spec.workdir }, { ...spec, lfaaEnv: { ...collected, ...(spec.lfaaEnv ?? {}) } });
  }
}

export const name = "lfaa-bash-local";

export function apply(ctx: Context): void {
  registerShellExecutor(ctx, new BashLocalShellExecutor(ctx), "shellBash");
}
