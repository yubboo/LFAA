/** 功能：登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。 */
import type { Context } from "@deepseek-ai/cordis";
import * as capability from "lfaa-llm/src/completion.js";
import { initializeAiRuns, closeAiRuns, startAiRun, prepareAgentShutdown } from "./runs.js";
import { createAiPluginHost } from "lfaa-app-boot/src/ai-host.js";
import { getScheduleTarget } from "lfaa-schedule/src/targets.js";
import { getAiSession } from "lfaa-session/src/sessions.js";
import { resolveUserRole } from "lfaa-identity-auth/src/service.js";
export const name = "lfaaAgentLoop";
export const inject = ["lfaaSettings", "lfaaLlm", "lfaaSessions", "lfaaTools", "lfaaAgentDefaultModel", "lfaaUserApproval", "lfaaUserQuestions", "lfaaSchedule", "aiExtensions", "aiRuntimeHooks"];
export function apply(ctx: Context): void {
  // 退出协调挂在既有服务对象上：app-boot 在 dispose 前调用；Agent 循环不依赖 daemon 或桌面宿主。
  ctx.provide(name, { ...capability, prepareShutdown: prepareAgentShutdown });
  // 附件服务按需读取（非 inject）：没有附件装配的 Profile 也能启动，缺失时只记录"未挂载"。
  initializeAiRuns(ctx.lfaaAgentDefaultModel, ctx.lfaaUserApproval, ctx.lfaaUserQuestions, ctx.lfaaLlm, ctx.get("lfaaAttachments") as import("lfaa-attachment/src/index.js").AttachmentStore | undefined);
  ctx.lfaaSchedule.setFireHandler(task => {
    const target = getScheduleTarget(task.id, task.ownerId);
    const role = resolveUserRole(task.ownerId);
    const session = target ? getAiSession(task.ownerId, target.sessionId) : null;
    if (!target || !role || !session || session.appId !== target.appId || session.archived) throw new Error("定时任务的账户或会话目标不可用；没有创建新任务。");
    const run = startAiRun(task.ownerId, role, { appId: target.appId, sessionId: target.sessionId, content: task.prompt }, createAiPluginHost(ctx), { allowedToolNames: target.allowedToolNames, memoryEligible: false });
    return { messageId: run.id };
  });
  ctx.effect(() => () => { ctx.lfaaSchedule.setFireHandler(() => { throw new Error("Agent 运行器已关闭。"); }); return closeAiRuns(); });
}

// ==== 上下文管理分片新增能力导出（保持现有 execute-turn/runs 公开 API 不变）====
// 移植自 deepseek-harness（MIT, commit 639ed01），按 LFAA 直接式循环适配。
export * from "./constants.js";
export * from "./assistant-stream.js";
export * from "./inbox.js";
export * from "./tool-calls.js";
export * from "./run-pause.js";
export * from "./agent.js";
export {
  assessContextPressure,
  estimateMessagesTokens,
  selectCompactionRange,
  manageContextBeforeRequest,
} from "./runtime-context.js";
export type {
  ContextPressure,
  ContextManagerHooks,
} from "./runtime-context.js";
