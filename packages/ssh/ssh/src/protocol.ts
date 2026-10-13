/**
 * 文件：protocol.ts
 * 功能：SSH 远程命令的结构化请求/结果类型与 JSON 行编解码。
 * 作用：DSH 用长度帧 JSON RPC 与远端 Node helper 通信；LFAA 用 ssh.exe + 远端 shell，
 *       等价物是“一行 JSON 请求进 stdin、一行 JSON 结果出 stdout”的结构化协议。
 * 边界：本文件只定义类型与纯函数编解码，不负责子进程。
 * 关联文件：packages/ssh/ssh/src/helper-entry.ts、helper.ts、session.ts。
 * 移植参考：DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84）
 *          packages/ssh/ssh/src/protocol.ts 的命令/流/退出码结构化语义。
 */

/** 一次结构化远程命令请求。 */
export interface RemoteCommandRequest {
  readonly command: string;
  readonly cwd?: string;
  readonly timeoutMs?: number;
  readonly maxBytes?: number;
}

/** 一次结构化远程命令结果。 */
export interface RemoteCommandResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
  readonly signal: string | null;
  readonly timedOut: boolean;
  readonly truncated: boolean;
  readonly ok: boolean;
}

/** 合法结果字段的最小集合。 */
export interface RemoteExitStatus {
  readonly exitCode: number | null;
  readonly signal: string | null;
}

/** 把请求编码为一行 JSON（供远端入口脚本从 stdin 读取）。 */
export function encodeRequest(request: RemoteCommandRequest): string {
  return JSON.stringify(request);
}

/** 把远端入口脚本写出的一行 JSON 解码为结果；非法行抛错。 */
export function decodeResult(line: string): RemoteCommandResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    throw new Error(`远端结果不是合法 JSON：${line.slice(0, 200)}`);
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("远端结果结构无效。");
  }
  const obj = parsed as Record<string, unknown>;
  const exitCode = typeof obj.exitCode === "number" ? obj.exitCode : null;
  const signal = typeof obj.signal === "string" ? obj.signal : null;
  return {
    stdout: typeof obj.stdout === "string" ? obj.stdout : "",
    stderr: typeof obj.stderr === "string" ? obj.stderr : "",
    exitCode,
    signal,
    timedOut: obj.timedOut === true,
    truncated: obj.truncated === true,
    ok: exitCode === 0
  };
}

/** 由退出码/信号构造状态对象。 */
export function exitStatus(exitCode: number | null, signal: string | null): RemoteExitStatus {
  return { exitCode, signal };
}
