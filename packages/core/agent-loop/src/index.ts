/** 功能：登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。 */
import type { Context } from "@deepseek-ai/cordis";
import * as capability from "./runtime.js";
import { initializeAiRuns, closeAiRuns } from "./runs.js";
export const name = "lfaaAgentLoop";
export const inject = ["lfaaSettings", "lfaaSessions", "lfaaTools", "lfaaAgentDefaultModel", "lfaaUserApproval", "lfaaUserQuestions"];
export function apply(ctx: Context): void {
  ctx.provide(name, capability);
  initializeAiRuns(ctx.lfaaAgentDefaultModel, ctx.lfaaUserApproval, ctx.lfaaUserQuestions);
  ctx.effect(() => () => closeAiRuns());
}
