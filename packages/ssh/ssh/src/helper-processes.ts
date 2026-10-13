/**
 * 文件：helper-processes.ts
 * 功能：启动/终止 ssh.exe 子进程的统一封装。
 * 作用：DSH 的 helper-processes 管理远端 Node 子进程池、心跳与租约；LFAA 没有远端 helper，
 *       这里把“本地 ssh 子进程的启动、错误归一、强制终止”收敛到一处，供 session/helper 复用。
 * 边界：每个 ssh 命令都是一次性子进程；连接复用（ControlMaster）在 Windows OpenSSH 不稳，
 *       不做进程池。
 * 关联文件：packages/ssh/ssh/src/session.ts、helper.ts。
 * 移植参考：DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84）
 *          packages/ssh/ssh/src/helper-processes.ts 的进程生命周期职责。
 */
import { spawn, type ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";

/** stdin 为 ignore，stdout/stderr 为管道。 */
export type SshChild = ChildProcessByStdio<null, Readable, Readable>;

/** 启动一个 ssh 子进程；stdio 为 ignore/pipe/pipe。 */
export function spawnSsh(sshPath: string, args: readonly string[]): SshChild {
  return spawn(sshPath, [...args], { stdio: ["ignore", "pipe", "pipe"] });
}

/** 把子进程 error 事件归一为可读中文错误。 */
export function normalizeSpawnError(error: NodeJS.ErrnoException): string {
  if (error.code === "ENOENT") {
    return `找不到 ssh 可执行文件（${error.path ?? "ssh"}）；请确认 Windows OpenSSH 已安装或配置 sshPath。`;
  }
  if (error.code === "EACCES") {
    return `没有权限执行 ssh 可执行文件。`;
  }
  return `启动 ssh 失败：${error.message}`;
}

/** 强制终止子进程（先 SIGTERM，失败由调用方兜底）。 */
export function killChild(child: SshChild): void {
  if (!child.killed) child.kill("SIGTERM");
}
