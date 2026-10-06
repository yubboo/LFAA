/** 功能：提供认证的会话、审批与任务 API。作用：提交任务、查询结果和订阅事件。关联文件：agent-loop/runs.ts、core/session、API Gateway。 */
import { Router } from "express";
import { ApiError } from "lfaa-util-values/src/http-error.js";
import { APPLICATION_IDS, type ApplicationId } from "lfaa-util-values/src/application-id.js";
import { requireAuthentication } from "lfaa-authorization/src/middleware.js";
import { createRateLimit } from "lfaa-api-remotes/src/rate-limit.js";
import type { AiPluginHost } from "lfaa-app-boot/src/ai-host.js";
import type { MinecraftRealtimePublisher } from "lfaa-api-remotes/src/socket-server.js";
import { startAiRun, getAiRun, cancelAiRun, subscribeAiRun, appendAiRunInput, answerAiRunQuestion, type AiRunInput } from "lfaa-agent-loop/src/runs.js";
import { forkAiSessionBeforeUserMessage, forkAiSessionForSideChat, forkAiSessionFromMessage, getAiSideChatParentSessionId, getAiSessionMessages, getAiUsageSummary, listAiSessions, setAiSessionArchived, setAiSessionPlanMode, submitAiMessageFeedback, type AiMessageFeedbackInput } from "lfaa-session/src/sessions.js";
import { AiPermissionModeChangedError, decideAiToolApproval, listAiToolApprovals, listAiToolPermissionGrants, revokeAiToolPermissionGrant } from "lfaa-permission-presets/src/permissions.js";
import type { UserApprovalNotifications } from "lfaa-user-approval/src/index.js";
import { getUserSettings } from "lfaa-settings/src/service.js";
import { getAiHostTask, listUserAiHostTasks, requestAiHostTaskCancellation } from "lfaa-jobs/src/ai-host-tasks.js";
import { asyncHandler, parseBody, aiChatMessageSchema, aiMessageFeedbackSchema, aiSessionArchiveSchema, aiSessionPlanModeSchema, aiSessionForkSchema, aiApprovalDecisionSchema, aiRunQuestionAnswerSchema, writeSse } from "lfaa-api-remotes/src/route-contracts.js";
export function registerRoutes(router: Router, aiPluginHost: AiPluginHost, _realtime: MinecraftRealtimePublisher, approvalNotifications: UserApprovalNotifications): void {
const limitAiInference = createRateLimit(12, 60 * 1000);
router.post("/ai/host-tasks/:taskId/cancel", requireAuthentication, (request, response) => {
  if (!requestAiHostTaskCancellation(request.params.taskId, request.auth!.user.id)) throw new ApiError(404, "ai_host_task_not_found", "找不到当前账户的节点任务。");
  response.status(202).json({ task: getAiHostTask(request.params.taskId) });
});
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
    if (appValue !== undefined && !APPLICATION_IDS.includes(String(appValue) as ApplicationId)) throw new ApiError(400, "invalid_application_filter", "应用筛选值无效。");
    response.json({ sessions: listAiSessions(request.auth!.user.id, archivedValue === "true", appValue as ApplicationId | undefined) });
  });

router.get("/ai/sessions/:sessionId/messages", requireAuthentication, (request, response) => {
    const messages = getAiSessionMessages(request.auth!.user.id, request.params.sessionId);
    if (!messages) throw new ApiError(404, "ai_session_not_found", "找不到此 AI 会话。");
    response.json({ messages });
  });

router.post("/ai/sessions/:sessionId/messages/:messageId/feedback", requireAuthentication, (request, response) => {
    const body = parseBody<AiMessageFeedbackInput>(aiMessageFeedbackSchema, request.body);
    const feedback = submitAiMessageFeedback(request.auth!.user.id, request.params.sessionId, request.params.messageId, body);
    if (!feedback) throw new ApiError(404, "ai_feedback_target_not_found", "找不到可评价的完整 AI 回复。");
    response.json({ feedback });
  });

router.post("/ai/sessions/:sessionId/fork", requireAuthentication, (request, response) => {
    const body = parseBody<{ messageId: string }>(aiSessionForkSchema, request.body);
    const session = forkAiSessionFromMessage(request.auth!.user.id, request.params.sessionId, body.messageId);
    if (!session) throw new ApiError(404, "ai_session_fork_target_not_found", "找不到可创建分支的完整 AI 回复。");
    response.status(201).json({ session });
  });

router.post("/ai/sessions/:sessionId/fork-before-message", requireAuthentication, (request, response) => {
    const body = parseBody<{ messageId: string }>(aiSessionForkSchema, request.body);
    let session: ReturnType<typeof forkAiSessionBeforeUserMessage>;
    try { session = forkAiSessionBeforeUserMessage(request.auth!.user.id, request.params.sessionId, body.messageId); }
    catch (error) { throw new ApiError(409, "ai_session_edit_active_run", error instanceof Error ? error.message : "当前会话仍有活动任务，暂时不能编辑问题。"); }
    if (!session) throw new ApiError(404, "ai_session_edit_target_not_found", "找不到可编辑的独立用户问题。");
    response.status(201).json({ session });
  });

router.post("/ai/sessions/:sessionId/side-chat", requireAuthentication, limitAiInference, (request, response) => {
    const session = forkAiSessionForSideChat(request.auth!.user.id, request.params.sessionId);
    if (!session) throw new ApiError(404, "ai_side_chat_source_not_found", "找不到可用于侧边聊天的当前会话。侧边聊天不能从另一个侧边聊天继续创建。");
    response.status(201).json({ session });
  });

router.patch("/ai/sessions/:sessionId/archive", requireAuthentication, (request, response) => {
    const body = parseBody<{ archived: boolean }>(aiSessionArchiveSchema, request.body);
    const session = setAiSessionArchived(request.auth!.user.id, request.params.sessionId, body.archived);
    if (!session) throw new ApiError(404, "ai_session_not_found", "找不到此 AI 会话。");
    response.json({ session });
  });

router.patch("/ai/sessions/:sessionId/plan-mode", requireAuthentication, (request, response) => {
    const body = parseBody<{ active: boolean }>(aiSessionPlanModeSchema, request.body);
    let session;
    try { session = setAiSessionPlanMode(request.auth!.user.id, request.params.sessionId, body.active); }
    catch (error) { throw new ApiError(409, "ai_session_plan_mode_active_run", error instanceof Error ? error.message : "当前会话仍有活动任务，暂时不能切换计划模式。"); }
    if (!session) throw new ApiError(404, "ai_session_not_found", "找不到可切换计划模式的当前账户会话。");
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
    approvalNotifications.notify(request.auth!.user.id, approval.id);
    response.json({ approval });
  });

router.post("/ai/chat/stream", requireAuthentication, limitAiInference, asyncHandler(async (request, response) => {
    const body = parseBody<AiRunInput>(aiChatMessageSchema, request.body);
    const run = submit(request.auth!.user.id, request.auth!.user.role, body, aiPluginHost);
    follow(response, request.auth!.user.id, run.id);
  }));
  router.post("/ai/side-chat/stream", requireAuthentication, limitAiInference, asyncHandler(async (request, response) => {
    const body = parseBody<AiRunInput>(aiChatMessageSchema, request.body);
    if (!body.sessionId || !getAiSideChatParentSessionId(request.auth!.user.id, body.sessionId)) {
      throw new ApiError(404, "ai_side_chat_session_not_found", "找不到当前账户的侧边聊天会话。");
    }
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
  router.post("/ai/runs/:runId/answer", requireAuthentication, limitAiInference, (request, response) => {
    const body = parseBody<{ questionId: string; answer: string; skipped: boolean }>(aiRunQuestionAnswerSchema, request.body);
    if (!body.skipped && !body.answer.trim()) throw new ApiError(400, "ai_run_question_answer_empty", "请先选择选项、填写回答或选择跳过。");
    try {
      response.status(202).json(answerAiRunQuestion(request.auth!.user.id, request.params.runId, body.questionId, body.answer, body.skipped));
    } catch (error) {
      throw new ApiError(409, "ai_run_question_rejected", error instanceof Error ? error.message : "澄清问题回答失败。");
    }
  });
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
export const inject = ["apiGateway", "lfaaAgentLoop", "lfaaUserApproval"];
export function apply(ctx: Context): void {
  ctx.apiGateway.register(ctx, "session-controller", (router, aiHost, realtime) => registerRoutes(router, aiHost, realtime, ctx.lfaaUserApproval));
}
