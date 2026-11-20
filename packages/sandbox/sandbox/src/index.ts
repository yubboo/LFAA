// @lfaa/sandbox 抽象契约：文件影响模式、沙箱策略与执行前判定接口，不绑定具体后端。
import { type Context, Service } from "@deepseek-ai/cordis";

/**
 * 文件影响模式，沿用 DSH 的词汇：
 * - `read-only`：只读，禁止一切写入与命令执行；
 * - `workspace-write`：仅允许在工作区根目录内写入；
 * - `danger-full-access`：不限制。
 */
export type SandboxMode = "read-only" | "workspace-write" | "danger-full-access";

/** 一次执行使用的沙箱策略；按调用携带，不在全局固定。 */
export interface SandboxPolicy {
  mode: SandboxMode;
  /** 允许写入的绝对路径根；`workspace-write` 模式必须提供。 */
  workspaceRoots: readonly string[];
}

/** 判定结果：拒绝时给出可展示原因，绝不静默放行。 */
export type SandboxDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * 后端的强制能力等级。
 * - `os`：操作系统级（受限令牌 / 命名空间）——LFAA 当前未实现；
 * - `policy`：工具层判定，只能拦住本进程发起的工具调用；
 * - `none`：不强制。
 */
export type SandboxEnforcement = "os" | "policy" | "none";

/** 执行前判定接口。所有方法必须对未知情况返回拒绝，遵循 fail-closed。 */
export interface SandboxGuard {
  readonly enforcement: SandboxEnforcement;
  /** 判定一次写入是否允许。 */
  checkWrite(targetPath: string, policy: SandboxPolicy): SandboxDecision;
  /** 判定一次命令执行是否允许。 */
  checkCommand(command: string, policy: SandboxPolicy): SandboxDecision;
}

/** 进程包装结果：把调用方的 argv 替换为受限执行形式。 */
export interface ConfinedArgv {
  argv: string[];
  /** 该次包装实际达到的强制等级。 */
  enforcement: SandboxEnforcement;
}

/** 请求的强制模式在当前宿主不可用；调用方必须拒绝执行，不得降级放行。 */
export class SandboxUnavailableError extends Error {
  constructor(mode: SandboxMode, detail?: string) {
    super(
      `沙箱模式「${mode}」在当前宿主不可用，拒绝以无限制方式执行`
      + (detail ? `：${detail}` : ""),
    );
    this.name = "SandboxUnavailableError";
  }
}

/** 沙箱后端的公开契约。 */
export abstract class SandboxEnforcer extends Service implements SandboxGuard {
  constructor(ctx: Context) {
    super(ctx, "sandbox");
  }

  abstract readonly enforcement: SandboxEnforcement;
  abstract checkWrite(targetPath: string, policy: SandboxPolicy): SandboxDecision;
  abstract checkCommand(command: string, policy: SandboxPolicy): SandboxDecision;

  /**
   * 把 argv 包装成受限执行形式。默认实现直接失败：
   * 未实现原生后端时必须拒绝，而不是静默放行。
   */
  async confine(_argv: readonly string[], policy: SandboxPolicy): Promise<ConfinedArgv> {
    throw new SandboxUnavailableError(policy.mode, "当前后端未实现进程级包装");
  }
}

/** 默认策略：工作区可写；调用方未提供工作区根时按只读处理（fail-closed）。 */
export function defaultPolicy(workspaceRoots: readonly string[]): SandboxPolicy {
  return workspaceRoots.length > 0
    ? { mode: "workspace-write", workspaceRoots }
    : { mode: "read-only", workspaceRoots: [] };
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    sandbox: SandboxEnforcer;
  }
}

export default SandboxEnforcer;
