/**
 * 文件：helper.ts
 * 功能：客户端结构化远程命令执行（退出码哨兵协议）。
 * 作用：在 SshSession 之上，用 helper-entry 的远端包装把任意命令的 stdout/stderr 与退出码
 *       解析为结构化 RemoteCommandResult；替代 DSH 远端 Node helper 的 JSON RPC。
 * 关联文件：packages/ssh/ssh/src/session.ts、helper-entry.ts、protocol.ts、stream-security.ts。
 * 移植参考：DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84）
 *          packages/ssh/ssh/src/helper.ts 的“一次远程调用返回结构化结果”职责。
 */
import type { SshSession, SshExecOptions } from "./session.js";
import { buildRemoteWrappedCommand, EXIT_SENTINEL } from "./helper-entry.js";
import { StreamCollector } from "./stream-security.js";
import type { RemoteCommandRequest, RemoteCommandResult } from "./protocol.js";

/**
 * 执行一条结构化远程命令：远端把命令输出与退出码哨兵一起返回，客户端解析。
 * 说明：stdout/stderr 已在远端合并（2>&1），因此本结果的 stderr 字段为空，
 *       退出码来自哨兵而不是 ssh 本身（ssh 对远端命令通常总是返回 0，故必须解析哨兵）。
 */
export async function runStructured(
  session: SshSession,
  request: RemoteCommandRequest,
  options: SshExecOptions = {}
): Promise<RemoteCommandResult> {
  const collector = new StreamCollector(options.maxBytes ?? 1024 * 1024);
  const handle = session.stream(buildRemoteWrappedCommand(request.command, request.cwd), options);
  handle.stdout.on("data", (chunk: Buffer) => collector.addStdout(chunk));
  handle.stderr.on("data", (chunk: Buffer) => collector.addStderr(chunk));
  const close = await handle.done;
  const out = collector.finish();

  // 从尾部解析哨兵行，剥离后得到真正的命令输出。
  const sentinelIndex = out.stdout.lastIndexOf(`${EXIT_SENTINEL}=`);
  let stdout = out.stdout;
  let exitCode: number | null = close.exitCode;
  if (sentinelIndex >= 0) {
    const lineEnd = out.stdout.indexOf("\n", sentinelIndex);
    const line = lineEnd === -1 ? out.stdout.slice(sentinelIndex) : out.stdout.slice(sentinelIndex, lineEnd);
    const match = /=(-?\d+)\s*$/u.exec(line);
    if (match) exitCode = Number(match[1]);
    stdout = out.stdout.slice(0, sentinelIndex).replace(/\n?$/u, "");
  }
  return {
    stdout,
    stderr: out.stderr,
    exitCode,
    signal: close.signal,
    timedOut: close.timedOut,
    truncated: out.truncated,
    ok: exitCode === 0
  };
}
