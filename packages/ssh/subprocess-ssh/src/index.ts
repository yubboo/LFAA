/**
 * 文件：index.ts
 * 功能：把 argv 形态的子进程请求转发到远端主机执行，形成远程子进程句柄。
 * 作用：复用 SshSession.stream 获得远端 stdout/stderr 流与退出码；不实现 PTY（远端终端需另行接线）。
 * 集成需要（重要）：若要把本包登记为 LFAA 的 lfaaSubprocess 提供方，需要先由 subprocess 分片
 * 扩展 ProcessTarget 联合类型（增加 { kind: "ssh", session }），并对齐 resolveExecutable/
 * spawnTerminal 语义；本包当前只提供“远程执行一条命令”的协议层能力。
 * 关联文件：packages/ssh/ssh/src/session.ts、packages/subprocess/subprocess/src/index.ts。
 * 移植参考：DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84）
 *          packages/ssh/subprocess-ssh/src/index.ts 的能力面；实现改为 LFAA 自写（ssh.exe）。
 */
import type { Context } from "@deepseek-ai/cordis";
import type { SshSession, SshStreamHandle } from "lfaa-ssh";
import type { ProcessOutcome } from "lfaa-subprocess";

export const name = "lfaaSubprocessSsh";

declare module "@deepseek-ai/cordis" {
  interface Context {
    /** 经 SSH 在远端主机执行命令的子进程能力。 */
    lfaaSubprocessSsh: LfaaSubprocessSshService;
  }
}

export interface RunRemoteOptions {
  readonly timeoutMs?: number;
  readonly maxBytes?: number;
  readonly signal?: AbortSignal;
  /** 是否以流式返回（默认 true）；false 时缓冲全部输出。 */
  readonly stream?: boolean;
}

export interface RemoteRunHandle {
  readonly stream: SshStreamHandle;
  /** 等待远端命令结束并映射为 LFAA ProcessOutcome。 */
  readonly done: Promise<ProcessOutcome>;
}

/** 把 argv 用单引号拼成一行可被远端 POSIX shell 解释的命令。 */
function toRemoteCommand(argv: readonly string[]): string {
  if (argv.length === 0) throw new Error("远端命令 argv 不能为空。");
  return argv.map((arg) => `'${arg.replaceAll("'", `'\\''`)}'`).join(" ");
}

export interface LfaaSubprocessSshService {
  /** 在远端主机执行 argv，返回可消费的流与结束结果。 */
  run(session: SshSession, argv: readonly string[], options?: RunRemoteOptions): RemoteRunHandle;
}

const service: LfaaSubprocessSshService = {
  run(session, argv, options = {}) {
    const command = toRemoteCommand(argv);
    const stream = session.stream(command, options);
    const done = stream.done.then((result) => ({
      exitCode: result.exitCode,
      signal: result.signal,
      cancelled: options.signal?.aborted === true,
      timedOut: result.timedOut,
      outputTruncated: result.outputTruncated
    }));
    return { stream, done };
  }
};

export function apply(ctx: Context): void {
  ctx.provide(name, service);
}

// Loader 加载插件合同，不能把服务实例当成插件。
export default { name, apply };
