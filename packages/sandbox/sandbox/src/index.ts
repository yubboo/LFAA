/**
 * 功能：定义 LFAA 进程沙箱提供方接口与失败即关闭的结果核验。
 * 作用：让本机或节点插件为精确 argv 执行请求返回真实隔离证据；不提供假执行器或不受限回退。
 * 关联文件：packages/sandbox/sandbox-policy/src/index.ts、packages/host/daemon/src/process-control.mjs 与未来的平台沙箱插件。
 */
import type { SandboxExecutionPolicy, SandboxMode } from "lfaa-sandbox-policy/src/index.js";

export { SANDBOX_MODES, SandboxPolicyError, createSandboxExecutionPolicy, isSandboxPolicyWidening } from "lfaa-sandbox-policy/src/index.js";
export type { SandboxExecutionPolicy, SandboxMode, SandboxPlatform, SandboxTarget } from "lfaa-sandbox-policy/src/index.js";

export const SANDBOX_UNAVAILABLE = "SANDBOX_UNAVAILABLE" as const;
export type SandboxEnforcement = "full" | "partial" | "none";

export interface ConfinedCommand {
  readonly argv: readonly string[];
  readonly effectiveMode: SandboxMode;
  readonly enforcement: SandboxEnforcement;
  readonly providerId: string;
}

export class SandboxUnavailableError extends Error {
  readonly code = SANDBOX_UNAVAILABLE;

  constructor(message = "目标执行主机无法提供请求的沙箱限制。") {
    super(message);
    this.name = "SandboxUnavailableError";
  }
}

/** 由平台插件实现的服务；未加载合格提供方时调用方必须拒绝受限执行。 */
export interface SandboxProvider {
  confine(
    argv: readonly string[],
    policy: SandboxExecutionPolicy,
    signal?: AbortSignal
  ): Promise<ConfinedCommand>;
}

/** 将真实平台提供方登记到 Cordis 宿主；实现包拥有服务实例和完整清理责任。 */
export function registerSandboxProvider(
  ctx: { provide(name: string, service: SandboxProvider): unknown },
  provider: SandboxProvider
): void {
  ctx.provide("lfaaSandbox", provider);
}

/** 验证提供方结果没有偷偷放宽模式、替换命令或返回不完整隔离。 */
export function assertSandboxResult(
  requestedArgv: readonly string[],
  policy: SandboxExecutionPolicy,
  result: ConfinedCommand
): ConfinedCommand {
  if (!Array.isArray(result.argv) || result.argv.length === 0 || result.argv.some(value => typeof value !== "string" || value.includes("\0"))) {
    throw new SandboxUnavailableError("沙箱提供方返回了无效命令参数。");
  }
  if (result.effectiveMode !== policy.mode) throw new SandboxUnavailableError("沙箱提供方没有维持本次请求的限制模式。");
  if (result.enforcement !== (policy.mode === "danger-full-access" ? "none" : "full")) {
    throw new SandboxUnavailableError("沙箱提供方无法完整执行本次请求的隔离边界。");
  }
  if (policy.mode === "danger-full-access" && (result.argv.length !== requestedArgv.length || result.argv.some((value, index) => value !== requestedArgv[index]))) {
    throw new SandboxUnavailableError("不受沙箱约束的执行必须保持调用方提交的 argv 原样。");
  }
  if (!result.providerId.trim()) throw new SandboxUnavailableError("沙箱提供方未报告真实提供方标识。");
  return Object.freeze({ ...result, argv: Object.freeze([...result.argv]) });
}
