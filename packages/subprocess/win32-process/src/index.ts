/**
 * 功能：Windows 进程控制能力（进程树终止）。
 * 作用：被 subprocess-local 在取消/超时时调用，确保杀掉整棵受管子进程树而非只杀直接子进程。
 * 实现说明（重要限制）：
 *  - DSH 原版用 koffi FFI 调用 Windows Job Object 做精确的进程树隔离与终止；
 *    本仓库 pnpm store 无 koffi，故改用系统自带 taskkill /T /F 实现“尽力而为”的进程树终止；
 *  - taskkill 在正常 Win32 上随系统自带（C:\Windows\System32\taskkill.exe），无需额外安装；
 *  - 局限：无法做 Job Object 那样“子进程再拉起脱离树”的强隔离；若目标自行 detach 出树，可能残留。
 * 关联文件：packages/subprocess/subprocess-local/src/spawn.ts。
 */
import { execFile } from "node:child_process";
import type { Context } from "@deepseek-ai/cordis";

export interface KillTreeResult {
  /** taskkill 是否报告成功（exitCode 0）。 */
  readonly stopped: boolean;
  readonly detail: string;
}

/** 包裹 execFile 为 Promise，拿退出码。 */
function run(args: string[]): Promise<number> {
  return new Promise((resolve) => {
    execFile("taskkill", args, { windowsHide: true, timeout: 10_000 }, (error) => {
      resolve(error ? 1 : 0);
    });
  });
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * 终止一个进程及其整棵子进程树。
 * 先温和终止（taskkill /T），等待 graceMs 后仍存活则强制 /T /F。
 */
export async function killProcessTree(pid: number, graceMs = 2000): Promise<KillTreeResult> {
  if (!Number.isInteger(pid) || pid <= 0) return { stopped: false, detail: "无效的进程 ID。" };
  if (process.platform !== "win32") {
    try {
      process.kill(pid, "SIGKILL");
      return { stopped: true, detail: "非 Windows：已直接 SIGKILL。" };
    } catch {
      return { stopped: false, detail: "非 Windows：进程已不存在。" };
    }
  }
  // 第一步：温和终止整棵树（不强制）。
  const gentleStatus = await run(["/PID", String(pid), "/T"]);
  if (gentleStatus === 0 && graceMs <= 0) return { stopped: true, detail: "taskkill 温和终止成功。" };
  if (gentleStatus === 0) await sleep(Math.max(0, Math.min(graceMs, 5000)));
  // 第二步：强制终止整棵树。
  const forcedStatus = await run(["/PID", String(pid), "/T", "/F"]);
  return forcedStatus === 0
    ? { stopped: true, detail: "taskkill /T /F 强制终止成功。" }
    : { stopped: false, detail: "强制终止时进程已退出或无权访问。" };
}

/** 进程控制服务形状。 */
export interface Win32ProcessService {
  readonly killProcessTree: typeof killProcessTree;
}

const service: Win32ProcessService = { killProcessTree };

declare module "@deepseek-ai/cordis" {
  interface Context {
    lfaaWin32Process: Win32ProcessService;
  }
}

export const name = "lfaaWin32Process";
export const inject: readonly string[] = [];

/** 提供 Windows 进程树终止服务。 */
export function apply(ctx: Context): void {
  ctx.provide(name, service);
}
