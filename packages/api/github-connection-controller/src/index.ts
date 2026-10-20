/** 功能：适配认证后的 GitHub Device Flow 与只读数据接口。作用：把用户身份、取消信号交给 GitHub Integration Owner。关联文件：packages/integrations/github、api/gateway。 */
import type { Context } from "@deepseek-ai/cordis";
import { Router, type Response } from "express";
import Joi from "joi";
import { requireAuthentication } from "lfaa-authorization/src/middleware.js";
import { asyncHandler, parseBody } from "lfaa-api-remotes/src/route-contracts.js";
import { ApiError } from "lfaa-util-values/src/http-error.js";
import { GitHubIntegrationError, type GitHubIntegrationService } from "lfaa-github-integration/src/index.js";

const deviceAttemptSchema = Joi.object({ attemptId: Joi.string().guid().required() }).unknown(false);
const repositoryPageSchema = Joi.object({ page: Joi.number().integer().min(1).max(100).default(1) }).unknown(false);
const repositorySegment = /^[A-Za-z0-9_.-]{1,100}$/u;

function requestSignal(response: Response): { signal: AbortSignal; dispose: () => void } {
  const controller = new AbortController();
  const onClose = () => { if (!response.writableEnded) controller.abort(); };
  response.on("close", onClose);
  return { signal: controller.signal, dispose: () => response.off("close", onClose) };
}

function mapIntegrationError(error: unknown): never {
  if (error instanceof GitHubIntegrationError) throw new ApiError(error.statusCode, error.code, error.message);
  throw error;
}

function repositoryParam(owner: string, name: string): string {
  if (!repositorySegment.test(owner) || !repositorySegment.test(name)) throw new ApiError(400, "invalid_repository", "仓库名称无效。" );
  return `${owner}/${name}`;
}

export function registerRoutes(router: Router, service: GitHubIntegrationService): void {
  router.get("/integrations/github/status", requireAuthentication, (request, response) => {
    try {
      response.setHeader("Cache-Control", "no-store");
      response.json({ connection: service.status(request.auth!.user.id) });
    } catch (error) { mapIntegrationError(error); }
  });

  router.post("/integrations/github/device", requireAuthentication, asyncHandler(async (request, response) => {
    if (request.body && typeof request.body === "object" && Object.keys(request.body).length > 0) throw new ApiError(400, "invalid_request", "GitHub 授权请求不接受参数。" );
    try {
      const device = await service.beginAuthorization(request.auth!.user.id);
      response.setHeader("Cache-Control", "no-store");
      response.status(201).json({ device });
    } catch (error) { mapIntegrationError(error); }
  }));

  router.post("/integrations/github/device/poll", requireAuthentication, asyncHandler(async (request, response) => {
    const body = parseBody<{ attemptId: string }>(deviceAttemptSchema, request.body);
    const requestContext = requestSignal(response);
    try {
      const result = await service.pollAuthorization(request.auth!.user.id, body.attemptId, requestContext.signal);
      response.setHeader("Cache-Control", "no-store");
      response.json({ result });
    } catch (error) { mapIntegrationError(error); }
    finally { requestContext.dispose(); }
  }));

  router.delete("/integrations/github/device/:attemptId", requireAuthentication, (request, response) => {
    if (!/^[0-9a-f-]{36}$/iu.test(request.params.attemptId)) throw new ApiError(400, "invalid_device_attempt", "GitHub 授权请求 ID 无效。" );
    service.cancelAuthorization(request.auth!.user.id, request.params.attemptId);
    response.status(204).end();
  });

  router.delete("/integrations/github", requireAuthentication, asyncHandler(async (request, response) => {
    const requestContext = requestSignal(response);
    try {
      const result = await service.disconnect(request.auth!.user.id, requestContext.signal);
      response.setHeader("Cache-Control", "no-store");
      response.json({ disconnected: true, remoteRevoked: result.remoteRevoked });
    } catch (error) { mapIntegrationError(error); }
    finally { requestContext.dispose(); }
  }));

  router.get("/integrations/github/repositories", requireAuthentication, asyncHandler(async (request, response) => {
    const query = parseBody<{ page: number }>(repositoryPageSchema, { page: request.query.page ?? 1 });
    const requestContext = requestSignal(response);
    try {
      const result = await service.listRepositories(request.auth!.user.id, query.page, requestContext.signal);
      response.setHeader("Cache-Control", "no-store");
      response.json(result);
    } catch (error) { mapIntegrationError(error); }
    finally { requestContext.dispose(); }
  }));

  router.get("/integrations/github/repositories/:owner/:name/issues", requireAuthentication, asyncHandler(async (request, response) => {
    const repository = repositoryParam(request.params.owner, request.params.name);
    const requestContext = requestSignal(response);
    try {
      const issues = await service.listIssues(request.auth!.user.id, repository, requestContext.signal);
      response.setHeader("Cache-Control", "no-store");
      response.json({ issues });
    } catch (error) { mapIntegrationError(error); }
    finally { requestContext.dispose(); }
  }));

  router.get("/integrations/github/repositories/:owner/:name/pulls", requireAuthentication, asyncHandler(async (request, response) => {
    const repository = repositoryParam(request.params.owner, request.params.name);
    const requestContext = requestSignal(response);
    try {
      const pullRequests = await service.listPullRequests(request.auth!.user.id, repository, requestContext.signal);
      response.setHeader("Cache-Control", "no-store");
      response.json({ pullRequests });
    } catch (error) { mapIntegrationError(error); }
    finally { requestContext.dispose(); }
  }));
}

export const name = "lfaaApiGithubConnectionController";
export const inject = ["apiGateway", "lfaaGithubIntegration"];
declare module "@deepseek-ai/cordis" { interface Context { lfaaGithubIntegration: GitHubIntegrationService } }
export function apply(ctx: Context): void {
  ctx.apiGateway.register(ctx, "github-connection-controller", router => registerRoutes(router, ctx.lfaaGithubIntegration));
}
