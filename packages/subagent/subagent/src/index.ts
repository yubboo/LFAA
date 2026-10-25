/**
 * 功能：登记子代理编排核心服务 lfaaSubagents，并统一导出协议层各模块。
 * 作用：提供驱动注册表与活动运行追踪；驱动包与模型工具包通过它协作，本身不写死业务流程。
 * 关联文件：manager.ts、types.ts、packages/subagent/*、packages/bundle/base/cordis.patch.yml。
 */
import type { Context } from "@deepseek-ai/cordis";
import { SubagentManager } from "./manager.js";

declare module "@deepseek-ai/cordis" {
  interface Context {
    lfaaSubagents: SubagentManager;
  }
}

// 核心类型与运行时
export * from "./types.js";
export { SubagentManager } from "./manager.js";
// 协议层各能力模块（深度对齐 DSH 24 文件能力面，按 LFAA 适配）
export * from "./error.js";
export * from "./internal.js";
export * from "./depth.js";
export * from "./invariant.js";
export * from "./control-types.js";
export * from "./control.js";
export * from "./projection-types.js";
export * from "./projection.js";
export * from "./descriptor.js";
export * from "./catalog.js";
export * from "./lifecycle.js";
export * from "./continuation.js";
export * from "./continuation-activation.js";
export * from "./continuation-messages.js";
export * from "./inbox.js";
export * from "./archive-admission.js";
export * from "./run-settlement.js";
export * from "./assistant-output.js";
export * from "./out-of-process.js";
export * from "./child-agent.js";
export * from "./list-children.js";
export * from "./client.js";

export const name = "lfaaSubagents";
export const inject = ["lfaaWin32Process"] as const;

export function apply(ctx: Context): void {
  const manager = new SubagentManager(ctx.lfaaWin32Process.killProcessTree);
  ctx.provide(name, manager);
  ctx.effect(() => () => manager.close());
}
