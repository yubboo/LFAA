/** 功能：提供账户认证的 App-scoped 工作流 API。作用：在 Core Owner 与注册的 App/引擎适配之间传递请求。 */
import { Router } from "express";
import Joi from "joi";
import type { Context } from "@deepseek-ai/cordis";
import { ApiError } from "lfaa-util-values/src/http-error.js";
import { APPLICATION_IDS, type ApplicationId } from "lfaa-util-values/src/application-id.js";
import { requireAuthentication } from "lfaa-authorization/src/middleware.js";
import type { AiPluginHost } from "lfaa-app-boot/src/ai-host.js";
import type { MinecraftRealtimePublisher } from "lfaa-api-remotes/src/socket-server.js";
import {
  cancelWorkflowRun,
  createWorkflow,
  deleteWorkflow,
  getWorkflow,
  getWorkflowRun,
  listWorkflowEngineTypes,
  listWorkflowNodeTypes,
  listWorkflowRuns,
  listWorkflows,
  startWorkflowRun,
  updateWorkflow
} from "lfaa-workflow/src/service.js";

const definitionSchema = Joi.object({
  title: Joi.string().trim().min(1).max(80).required(),
  engineId: Joi.string().trim().min(2).max(120).optional(),
  nodes: Joi.array().max(64).items(Joi.object().unknown(true)).required(),
  edges: Joi.array().max(128).items(Joi.object().unknown(true)).required()
}).unknown(false);
const runSchema = Joi.object({ options: Joi.object().unknown(true).default({}) }).unknown(false);

function parse<T>(schema: Joi.ObjectSchema, input: unknown): T {
  const result = schema.validate(input, { abortEarly: false, convert: true, stripUnknown: false });
  if (result.error) throw new ApiError(400, "workflow_request_invalid", result.error.details.map((item) => item.message).join("；"));
  return result.value as T;
}

function badInput(error: unknown): never {
  if (error instanceof ApiError) throw error;
  throw new ApiError(400, "workflow_request_invalid", error instanceof Error ? error.message : "工作流请求无效。");
}

function requestAppId(value: string): ApplicationId {
  if (!APPLICATION_IDS.includes(value as ApplicationId)) throw new ApiError(404, "workflow_app_not_found", "此 App 不支持工作流。");
  return value as ApplicationId;
}

function requireWorkflow(userId: string, appId: ApplicationId, workflowId: string) {
  const workflow = getWorkflow(userId, appId, workflowId);
  if (!workflow) throw new ApiError(404, "workflow_not_found", "找不到当前账户和 App 的工作流。");
  return workflow;
}

export function registerRoutes(router: Router, aiPluginHost: AiPluginHost, _realtime: MinecraftRealtimePublisher): void {
  router.get("/apps/:appId/workflows/nodes", requireAuthentication, async (request, response) => {
    const appId = requestAppId(request.params.appId);
    response.setHeader("Cache-Control", "no-store");
    response.json({ nodes: await listWorkflowNodeTypes(appId, request.auth!.user.id, request.auth!.user.role) });
  });

  router.get("/apps/:appId/workflows/engines", requireAuthentication, (request, response) => {
    const appId = requestAppId(request.params.appId);
    response.setHeader("Cache-Control", "no-store");
    response.json({ engines: listWorkflowEngineTypes(appId) });
  });

  router.get("/apps/:appId/workflows", requireAuthentication, (request, response) => {
    const appId = requestAppId(request.params.appId);
    response.setHeader("Cache-Control", "no-store");
    response.json({ workflows: listWorkflows(request.auth!.user.id, appId) });
  });

  router.post("/apps/:appId/workflows", requireAuthentication, (request, response) => {
    const appId = requestAppId(request.params.appId);
    const input = parse<{ title: string; engineId?: string; nodes: unknown[]; edges: unknown[] }>(definitionSchema, request.body);
    try { response.status(201).json({ workflow: createWorkflow(request.auth!.user.id, appId, input) }); }
    catch (error) { badInput(error); }
  });

  router.get("/apps/:appId/workflows/:workflowId", requireAuthentication, (request, response) => {
    const appId = requestAppId(request.params.appId);
    response.setHeader("Cache-Control", "no-store");
    response.json({ workflow: requireWorkflow(request.auth!.user.id, appId, request.params.workflowId) });
  });

  router.put("/apps/:appId/workflows/:workflowId", requireAuthentication, (request, response) => {
    const appId = requestAppId(request.params.appId);
    const input = parse<{ title: string; engineId?: string; nodes: unknown[]; edges: unknown[] }>(definitionSchema, request.body);
    try {
      const workflow = updateWorkflow(request.auth!.user.id, appId, request.params.workflowId, input);
      if (!workflow) throw new ApiError(404, "workflow_not_found", "找不到当前账户和 App 的工作流。");
      response.json({ workflow });
    } catch (error) { badInput(error); }
  });

  router.delete("/apps/:appId/workflows/:workflowId", requireAuthentication, (request, response) => {
    const appId = requestAppId(request.params.appId);
    try {
      if (!deleteWorkflow(request.auth!.user.id, appId, request.params.workflowId)) throw new ApiError(404, "workflow_not_found", "找不到当前账户和 App 的工作流。");
      response.status(204).end();
    } catch (error) { badInput(error); }
  });

  router.get("/apps/:appId/workflows/:workflowId/runs", requireAuthentication, (request, response) => {
    const appId = requestAppId(request.params.appId);
    requireWorkflow(request.auth!.user.id, appId, request.params.workflowId);
    response.setHeader("Cache-Control", "no-store");
    response.json({ runs: listWorkflowRuns(request.auth!.user.id, appId, request.params.workflowId) });
  });

  router.post("/apps/:appId/workflows/:workflowId/runs", requireAuthentication, (request, response) => {
    const appId = requestAppId(request.params.appId);
    const input = parse<{ options: Record<string, unknown> }>(runSchema, request.body ?? {});
    if (JSON.stringify(input.options).length > 8_000) throw new ApiError(413, "workflow_options_too_large", "工作流运行选项过大。");
    requireWorkflow(request.auth!.user.id, appId, request.params.workflowId);
    try {
      const run = startWorkflowRun(request.auth!.user.id, request.auth!.user.role, appId, request.params.workflowId, input.options, { aiHost: aiPluginHost });
      response.status(202).json({ run });
    } catch (error) { badInput(error); }
  });

  router.get("/apps/:appId/workflow-runs/:runId", requireAuthentication, (request, response) => {
    const appId = requestAppId(request.params.appId);
    const run = getWorkflowRun(request.auth!.user.id, appId, request.params.runId);
    if (!run) throw new ApiError(404, "workflow_run_not_found", "找不到当前账户和 App 的工作流运行记录。");
    response.setHeader("Cache-Control", "no-store");
    response.json({ run });
  });

  router.post("/apps/:appId/workflow-runs/:runId/cancel", requireAuthentication, (request, response) => {
    const appId = requestAppId(request.params.appId);
    const run = cancelWorkflowRun(request.auth!.user.id, appId, request.params.runId);
    if (!run) throw new ApiError(404, "workflow_run_not_found", "找不到当前账户和 App 的工作流运行记录。");
    response.status(202).json({ run });
  });
}

export const inject = ["apiGateway", "lfaaWorkflow"];
export function apply(ctx: Context): void { ctx.apiGateway.register(ctx, "workflow-controller", registerRoutes); }
