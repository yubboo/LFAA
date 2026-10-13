/**
 * 功能：按平台选择终端会话使用的默认 Shell。
 * 作用：terminal 会话创建时据此决定启动哪个可执行文件与初始参数。
 * Windows 适配（重要）：DSH 面向 Linux/macOS 用 bash；本仓库运行在 Windows，
 *  - 优先使用 PATH 中的 PowerShell 7，其次系统 Windows PowerShell，最后 cmd.exe；
 *  - 不依赖 bash（Windows 上未必安装），避免会话起不来。
 * 关联文件：packages/terminal/terminal/src/index.ts。
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Context } from "@deepseek-ai/cordis";

export interface ShellLaunch {
  readonly executable: string;
  readonly args: readonly string[];
}

/** 探测一个命令是否在 PATH 中可用。 */
async function which(command: string): Promise<string | null> {
  try {
    const { stdout } = await promisify(execFile)(process.platform === "win32" ? "where.exe" : "which", [command], { windowsHide: true, timeout: 3000 });
    return stdout.trim().split(/\r?\n/u)[0] || null;
  } catch {
    return null;
  }
}

/** 返回当前平台默认 Shell 启动方式。 */
export async function resolveDefaultShell(): Promise<ShellLaunch> {
  if (process.platform === "win32") {
    // Windows：优先 pwsh（PowerShell 7），其次自带 powershell.exe，最后 cmd.exe。
    const pwsh = await which("pwsh");
    if (pwsh) return { executable: pwsh, args: ["-NoLogo", "-NoProfile"] };
    const powershell = await which("powershell");
    if (powershell) return { executable: powershell, args: ["-NoLogo", "-NoProfile"] };
    return { executable: "cmd", args: ["/Q", "/K"] };
  }
  // 非 Windows：直接用 bash。
  return { executable: "bash", args: ["--noprofile", "--norc"] };
}

/** 读取设置中的 Shell 选择；显式选择不可用时由执行端报错，不悄悄替换。 */
export async function resolveTerminalShell(shell: string): Promise<ShellLaunch> {
  if (shell === "system") return resolveDefaultShell();
  if (shell === "powershell") return { executable: process.platform === "win32" ? "powershell.exe" : "pwsh", args: ["-NoLogo", "-NoProfile"] };
  if (shell === "cmd" && process.platform === "win32") return { executable: "cmd.exe", args: ["/Q", "/K"] };
  if (shell === "bash") return { executable: "bash", args: ["--noprofile", "--norc"] };
  if (shell === "zsh") return { executable: "zsh", args: ["-f"] };
  throw new Error("所选 Shell 不适用于当前节点。");
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    lfaaTerminalBash: { readonly resolveDefaultShell: typeof resolveDefaultShell };
  }
}

export const name = "lfaaTerminalBash";
export const inject: readonly string[] = [];

/** 提供默认 Shell 解析服务。 */
export function apply(ctx: Context): void {
  ctx.provide(name, { resolveDefaultShell });
}
