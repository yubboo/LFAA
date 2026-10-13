/**
 * 文件：index.ts
 * 功能：探测远端主机可用的沙箱工具，并声明本端不做本地隔离。
 * 作用：DSH 的 sandbox-ssh 会让远端主机用 bubblewrap/firejail 等对 argv 做隔离；
 *       经系统 ssh.exe 只能依赖远端已安装的沙箱工具，本端不实现隔离，也不假定远端一定具备。
 * 集成需要（重要）：真正的“按策略隔离远端命令”需要远端安装 bwrap/firejail，
 * 并与 LFAA sandbox-policy 的 SandboxPolicy 语义对齐；本包当前只做能力探测与命令透传。
 * 关联文件：packages/ssh/ssh/src/session.ts、packages/sandbox/sandbox-policy（待接线）。
 * 移植参考：DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84）
 *          packages/ssh/sandbox-ssh/src/index.ts 的能力面；探测实现为 LFAA 自写。
 */
import type { Context } from "@deepseek-ai/cordis";
import type { SshSession } from "lfaa-ssh";

export const name = "lfaaSandboxSsh";

declare module "@deepseek-ai/cordis" {
  interface Context {
    /** 远端主机沙箱能力探测。 */
    lfaaSandboxSsh: LfaaSandboxSshService;
  }
}

/** 远端沙箱工具能力快照。 */
export interface RemoteSandboxFacts {
  /** 远端是否可用 bubblewrap。 */
  readonly bwrap: boolean;
  /** 远端是否可用 firejail。 */
  readonly firejail: boolean;
  /** 远端是否可用任何命令隔离。 */
  readonly any: boolean;
}

export interface LfaaSandboxSshService {
  /** 探测远端沙箱工具；远端 POSIX 环境不可用时返回全 false，不抛错。 */
  probe(session: SshSession): Promise<RemoteSandboxFacts>;
  /**
   * 透传 argv：在没有可用沙箱时原样返回；隔离需要远端工具与策略接线。
   * 返回的命令行可直接交给 subprocess-ssh 执行。
   */
  wrap(argv: readonly string[], facts: RemoteSandboxFacts): string;
}

const service: LfaaSandboxSshService = {
  async probe(session) {
    const result = await session.exec("command -v bwrap >/dev/null 2>&1 && echo B; command -v firejail >/dev/null 2>&1 && echo F");
    if (result.exitCode !== 0) {
      return { bwrap: false, firejail: false, any: false };
    }
    const out = result.stdout;
    const bwrap = out.includes("B");
    const firejail = out.includes("F");
    return { bwrap, firejail, any: bwrap || firejail };
  },
  wrap(argv, facts) {
    // 当前不假定隔离策略：无可用沙箱时原样透传；有工具时也不擅自包 bwrap（策略待接线）。
    void facts;
    return argv.map((arg) => `'${arg.replaceAll("'", `'\\''`)}'`).join(" ");
  }
};

export function apply(ctx: Context): void {
  ctx.provide(name, service);
}

// Loader 加载插件合同，不能把服务实例当成插件。
export default { name, apply };
