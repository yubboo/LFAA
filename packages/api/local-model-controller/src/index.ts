/** 功能：提供认证后的 LFAA 本机模型管理 API。作用：只转发 Runtime 已登记 ID，不接受客户端路径或任意仓库。 */
import { Router } from "express";
import Joi from "joi";
import type { Context } from "@deepseek-ai/cordis";
import { asyncHandler } from "lfaa-api-remotes/src/route-contracts.js";
import { ApiError } from "lfaa-util-values/src/http-error.js";
import { requireAuthentication } from "lfaa-authorization/src/middleware.js";
import type { LocalModelRuntimeService } from "lfaa-llm-local-runtime/src/index.js";

declare module "@deepseek-ai/cordis" {
  interface Context { lfaaLocalModelRuntime: LocalModelRuntimeService }
}

const modelIdSchema = Joi.string().pattern(/^[a-z0-9][a-z0-9-]{1,80}$/u).required();
const downloadIdSchema = Joi.string().guid({ version: ["uuidv4"] }).required();

function parseId(schema: Joi.StringSchema, value: unknown, label: string): string {
  const result = schema.validate(value, { convert: false });
  if (result.error) throw new ApiError(400, "local_model_id_invalid", `${label}无效。`);
  return result.value as string;
}

function handleError(error: unknown): never {
  if (error instanceof ApiError) throw error;
  const message = error instanceof Error ? error.message : "本机模型操作失败。";
  if (/另一个本地模型正在下载|本机模型正在推理|不能释放模型内存/u.test(message)) throw new ApiError(409, "local_model_busy", message);
  throw new ApiError(400, "local_model_operation_failed", message.slice(0, 800));
}

export function registerRoutes(router: Router, runtime: LocalModelRuntimeService): void {
  router.get("/local-models", requireAuthentication, asyncHandler(async (_request, response) => {
    try {
      response.setHeader("Cache-Control", "private, no-store");
      response.json({ models: await runtime.listModels(), activeDownload: runtime.getActiveDownload() });
    } catch (error) { handleError(error); }
  }));

  router.post("/local-models/:modelId/downloads", requireAuthentication, asyncHandler(async (request, response) => {
    const modelId = parseId(modelIdSchema, request.params.modelId, "模型 ID");
    try {
      const download = await runtime.startDownload(modelId);
      response.status(202).setHeader("Cache-Control", "no-store").json({ download });
    } catch (error) { handleError(error); }
  }));

  router.get("/local-models/downloads/:downloadId", requireAuthentication, (request, response) => {
    const downloadId = parseId(downloadIdSchema, request.params.downloadId, "下载 ID");
    const download = runtime.getDownload(downloadId);
    if (!download) throw new ApiError(404, "local_model_download_not_found", "本机模型下载记录不存在或已过期。");
    response.setHeader("Cache-Control", "no-store");
    response.json({ download });
  });

  router.delete("/local-models/downloads/:downloadId", requireAuthentication, (request, response) => {
    const downloadId = parseId(downloadIdSchema, request.params.downloadId, "下载 ID");
    const download = runtime.getDownload(downloadId);
    if (!download) throw new ApiError(404, "local_model_download_not_found", "本机模型下载记录不存在或已过期。");
    if (download.status === "queued" || download.status === "downloading") runtime.cancelDownload(downloadId);
    response.setHeader("Cache-Control", "no-store");
    response.json({ download: runtime.getDownload(downloadId) ?? download });
  });

  router.post("/local-models/:modelId/unload", requireAuthentication, asyncHandler(async (request, response) => {
    const modelId = parseId(modelIdSchema, request.params.modelId, "模型 ID");
    try {
      await runtime.unload(modelId);
      response.status(204).end();
    } catch (error) { handleError(error); }
  }));
}

export const name = "local-model-controller";
export const inject = ["apiGateway", "lfaaLocalModelRuntime"] as const;
export function apply(ctx: Context): void {
  ctx.apiGateway.register(ctx, name, router => registerRoutes(router, ctx.lfaaLocalModelRuntime));
}
