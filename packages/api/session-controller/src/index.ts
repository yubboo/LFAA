/** 功能：提供认证的会话、审批与任务 API。作用：提交任务、查询结果和订阅事件。关联文件：agent-loop/runs.ts、core/session、API Gateway。 */
import { Router } from "express";
import { ApiError } from "lfaa-util-values/src/http-error.js";
import { requireAuthentication } from "lfaa-authorization/src/middleware.js";
import { createRateLimit } from "lfaa-api-remotes/src/rate-limit.js";
import type { AiPluginHost } from "lfaa-app-boot/src/ai-host.js";
import type { MinecraftRealtimePublisher } from "lfaa-api-remotes/src/socket-server.js";
import { startAiRun, getAiRun, cancelAiRun, subscribeAiRun, appendAiRunInput, type AiRunInput } from "lfaa-agent-loop/src/runs.js";
import { getAiSessionMessages, getAiUsageSummary, listAiSessions, setAiSessionArchived } from "lfaa-session/src/sessions.js";
import { AiPermissionModeChangedError, decideAiToolApproval, listAiToolApprovals, listAiToolPermissionGrants, revokeAiToolPermissionGrant } from "lfaa-permission-presets/src/permissions.js";
import { getUserSettings } from "lfaa-settings/src/service.js";
import { getAiHostTask, listUserAiHostTasks } from "lfaa-jobs/src/ai-host-tasks.js";
import { asyncHandler, parseBody, aiChatMessageSchema, aiSessionArchiveSchema, aiApprovalDecisionSchema, writeSse } from "lfaa-api-remotes/src/route-contracts.js";
export function registerRoutes(router: Router, aiPluginHost: AiPluginHost, _realtime: MinecraftRealtimePublisher): void {
const limitAiInference = createRateLimit(12, 60 * 1000);
router.get("/ai/host-tasks", requireAuthentication, (request, response) => response.json({ tasks: listUserAiHostTasks(request.auth!.user.id) }));
router.get("/ai/host-tasks/:taskId", requireAuthentication, (request, response) => {
  const task = getAiHostTask(request.params.taskId);
  if (!task || task.createdBy !== request.auth!.user.id) throw new ApiError(404, "ai_host_task_not_found", "找不到当前账户的节点任务。");
  response.json({ task });
});
router.get("/ai/sessions", requireAuthentication, (request, response) => {
    const archivedValue = request.query.archived;
    const appValue = request.query.appId;
    if (archivedValue !== undefined && archivedValue !== "true" && archivedValue !== "false") throw new ApiError(400, "invalid_archived_filter", "归档筛选值无效。");
    if (appValue !== undefined && !["steamcmd", "minecraft", "writing", "workspace"].includes(String(appValue))) throw new ApiError(400, "invalid_application_filter", "应用筛选值无效。");
    response.json({ sessions: listAiSessions(request.auth!.user.id, archivedValue === "true", appValue as "steamcmd" | "minecraft" | "writing" | "workspace" | undefined) });
  });

router.get("/ai/sessions/:sessionId/messages", requireAuthentication, (request, response) => {
    const messages = getAiSessionMessages(request.auth!.user.id, request.params.sessionId);
    if (!messages) throw new ApiError(404, "ai_session_not_found", "找不到此 AI 会话。");
    response.json({ messages });
  });

router.patch("/ai/sessions/:sessionId/archive", requireAuthentication, (request, response) => {
    const body = parseBody<{ archived: boolean }>(aiSessionArchiveSchema, request.body);
    const session = setAiSessionArchived(request.auth!.user.id, request.params.sessionId, body.archived);
    if (!session) throw new ApiError(404, "ai_session_not_found", "找不到此 AI 会话。");
    response.json({ session });
  });

router.get("/ai/usage", requireAuthentication, (request, response) => {
    response.json({ usage: getAiUsageSummary(request.auth!.user.id) });
  });

router.get("/ai/approvals", requireAuthentication, (request, response) => {
    response.json({ approvals: listAiToolApprovals(request.auth!.user.id, "pending") });
  });

router.get("/ai/permissions/grants", requireAuthentication, (request, response) => {
    response.json({ grants: listAiToolPermissionGrants(request.auth!.user.id) });
  });

router.delete("/ai/permissions/grants/:grantId", requireAuthentication, (request, response) => {
    if (!revokeAiToolPermissionGrant(request.auth!.user.id, request.params.grantId)) {
      throw new ApiError(404, "ai_permission_grant_not_found", "找不到此账户的记忆授权。");
    }
    response.status(204).end();
  });

router.patch("/ai/approvals/:approvalId", requireAuthentication, (request, response) => {
    const body = parseBody<{ decision: "approved" | "denied"; remember: boolean }>(aiApprovalDecisionSchema, request.body);
    if (body.remember && body.decision !== "approved") throw new ApiError(400, "invalid_ai_approval_memory", "拒绝操作时不能保存记忆授权。");
    if (body.remember && getUserSettings(request.auth!.user.id).permissions.mode !== "approve_remembered") {
      throw new ApiError(409, "ai_permission_mode_changed", "请先保存“替我审批”模式，再记住此类操作。");
    }
    let approval;
    try {
      approval = decideAiToolApproval(request.auth!.user.id, request.params.approvalId, body.decision, body.remember);
    } catch (error) {
      if (error instanceof AiPermissionModeChangedError) throw new ApiError(409, "ai_permission_mode_changed", error.message);
      throw error;
    }
    if (!approval) throw new ApiError(409, "ai_approval_not_pending", "审批请求已处理或不存在。");
    response.json({ approval });
  });

router.post("/ai/chat/stream", requireAuthentication, limitAiInference, asyncHandler(async (request, response) => {
    const body = parseBody<AiRunInput>(aiChatMessageSchema, request.body);
    const run = submit(request.auth!.user.id, request.auth!.user.role, body, aiPluginHost);
    follow(response, request.auth!.user.id, run.id);
  }));
  router.post("/ai/runs", requireAuthentication, limitAiInference, asyncHandler(async (request, response) => {
    const body = parseBody<AiRunInput>(aiChatMessageSchema, request.body);
    const run = submit(request.auth!.user.id, request.auth!.user.role, body, aiPluginHost);
    response.status(202).json({ run });
  }));
  router.get("/ai/runs/:runId", requireAuthentication, (request, response) => {
    const run = getAiRun(request.auth!.user.id, request.params.runId);
    if (!run) throw new ApiError(404, "ai_run_not_found", "找不到当前账户的任务。");
    response.json({ run });
  });
  router.get("/ai/runs/:runId/events", requireAuthentication, (request, response) => follow(response, request.auth!.user.id, request.params.runId));
  router.post("/ai/runs/:runId/input", requireAuthentication, limitAiInference, asyncHandler(async (request, response) => {
    const body = parseBody<AiRunInput>(aiChatMessageSchema, { ...request.body, appId: "workspace", sessionId: null });
    try { response.status(202).json(appendAiRunInput(request.auth!.user.id, request.auth!.user.role, request.params.runId, body.content, aiPluginHost)); }
    catch (error) { throw new ApiError(409, "ai_run_input_rejected", error instanceof Error ? error.message : "任务跟进失败。"); }
  }));
  router.post("/ai/runs/:runId/cancel", requireAuthentication, (request, response) => {
    if (!cancelAiRun(request.auth!.user.id, request.params.runId)) throw new ApiError(404, "ai_run_not_found", "找不到当前账户的活动任务。");
    response.status(202).json({ run: getAiRun(request.auth!.user.id, request.params.runId) });
  });
}

function submit(userId: string, userRole: import("lfaa-identity-auth/src/service.js").UserRole, body: AiRunInput, aiHost: AiPluginHost) {
  try { return startAiRun(userId, userRole, body, aiHost); }
  catch (error) { const message = error instanceof Error ? error.message : "任务提交失败。"; throw new ApiError(message.includes("找不到") ? 404 : 409, "ai_run_submission_failed", message); }
}

/** 连接关闭仅取消订阅；停止由账户隔离的取消接口处理。 */
function follow(response: import("express").Response, userId: string, runId: string): void {
  const run = getAiRun(userId, runId);
  if (!run) throw new ApiError(404, "ai_run_not_found", "找不到当前账户的任务。");
  response.status(200).set({ "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" });
  response.flushHeaders();
  const unsubscribe = subscribeAiRun(userId, runId, (event, data) => {
    if (response.destroyed || response.writableEnded) return;
    writeSse(response, event, data);
    if (event === "done") response.end();
  });
  const heartbeat = setInterval(() => { if (!response.destroyed && !response.writableEnded) writeSse(response, "keepalive", {}); }, 15_000);
  heartbeat.unref();
  response.on("close", () => { clearInterval(heartbeat); unsubscribe(); });
  if (response.writableEnded) { clearInterval(heartbeat); unsubscribe(); }
}

/** 将控制器路由绑定到插件生命周期；运行服务由 agent-loop 包管理。 */
import type { Context } from "@deepseek-ai/cordis";
import "lfaa-api-gateway/src/index.js";
export const inject = ["apiGateway", "lfaaAgentLoop"];
export function apply(ctx: Context): void { ctx.apiGateway.register(ctx, "session-controller", registerRoutes); }
