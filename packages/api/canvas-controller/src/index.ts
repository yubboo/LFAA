/**
 * 功能：提供认证后的系统级无限画布项目与素材 API。
 * 作用：按当前登录账户与 App 作用域解析有界请求并委派 lfaa-canvas 唯一数据 Owner；生成路由只做协议适配并委派 lfaaCanvasGeneration，不持有画布文件、素材或 Provider 协议。
 * 关联文件：packages/canvas/canvas/src/index.ts、packages/canvas/canvas-generation/src/index.ts、packages/api/gateway、bundle/web-app/cordis.patch.yml。
 */
import express, { Router, type Response } from "express";
import Joi from "joi";
import type { Context } from "@deepseek-ai/cordis";
import { asyncHandler } from "lfaa-api-remotes/src/route-contracts.js";
import { ApiError } from "lfaa-util-values/src/http-error.js";
import { APPLICATION_IDS, type ApplicationId } from "lfaa-util-values/src/application-id.js";
import { requireAuthentication } from "lfaa-authorization/src/middleware.js";
import { CANVAS_LIMITS, CANVAS_NODE_TYPE_PATTERN, CanvasConflictError, type CanvasService } from "lfaa-canvas/src/index.js";
import {
  CANVAS_GENERATION_LIMITS,
  CANVAS_IMAGE_ASPECT_RATIOS,
  CANVAS_VIDEO_ASPECT_RATIOS,
  CanvasGenerationConfigurationError,
  CanvasGenerationNotFoundError,
  CanvasGenerationUnsupportedError,
  type CanvasGenerationService,
  type CanvasImageAspectRatio,
  type CanvasVideoAspectRatio
} from "lfaa-canvas-generation/src/index.js";

const PROJECT_FORMAT = "lfaa-canvas-project";
const ASSET_MIME_VALUES = ["image/png", "image/jpeg", "image/webp", "video/mp4", "video/webm", "audio/mpeg", "audio/wav", "audio/ogg"];
const MAX_UPLOAD_BYTES = CANVAS_LIMITS.videoBytes;

const viewportSchema = Joi.object({
  x: Joi.number().min(-CANVAS_LIMITS.coordinate).max(CANVAS_LIMITS.coordinate).required(),
  y: Joi.number().min(-CANVAS_LIMITS.coordinate).max(CANVAS_LIMITS.coordinate).required(),
  zoom: Joi.number().min(CANVAS_LIMITS.minimumZoom).max(CANVAS_LIMITS.maximumZoom).required()
}).unknown(false);

const nodeSchema = Joi.object({
  id: Joi.string().guid({ version: ["uuidv4"] }).required(),
  type: Joi.string().pattern(CANVAS_NODE_TYPE_PATTERN).required(),
  x: Joi.number().min(-CANVAS_LIMITS.coordinate).max(CANVAS_LIMITS.coordinate).required(),
  y: Joi.number().min(-CANVAS_LIMITS.coordinate).max(CANVAS_LIMITS.coordinate).required(),
  width: Joi.number().min(CANVAS_LIMITS.nodeMinimumSize).max(CANVAS_LIMITS.nodeMaximumSize).required(),
  height: Joi.number().min(CANVAS_LIMITS.nodeMinimumSize).max(CANVAS_LIMITS.nodeMaximumSize).required(),
  data: Joi.object().required()
}).unknown(false);

const edgeSchema = Joi.object({
  id: Joi.string().guid({ version: ["uuidv4"] }).required(),
  source: Joi.string().guid({ version: ["uuidv4"] }).required(),
  target: Joi.string().guid({ version: ["uuidv4"] }).required(),
  sourceHandle: Joi.string().max(200).optional(),
  targetHandle: Joi.string().max(200).optional()
}).unknown(false);

const assetSchema = Joi.object({
  assetId: Joi.string().guid({ version: ["uuidv4"] }).required(),
  name: Joi.string().trim().min(1).max(120).required(),
  mimeType: Joi.string().valid(...ASSET_MIME_VALUES).required(),
  bytes: Joi.number().integer().min(1).max(MAX_UPLOAD_BYTES).required(),
  createdAt: Joi.string().isoDate().required()
}).unknown(false);

// 客户端会回传完整项目文档；assets 只作只读回显，服务端仍以已保存素材清单为准。
const projectSchema = Joi.object({
  format: Joi.string().valid(PROJECT_FORMAT).optional(),
  formatVersion: Joi.number().valid(2).optional(),
  applicationId: Joi.string().valid(...APPLICATION_IDS).optional(),
  id: Joi.string().guid({ version: ["uuidv4"] }).optional(),
  title: Joi.string().trim().min(1).max(80).required(),
  viewport: viewportSchema.optional(),
  nodes: Joi.array().max(CANVAS_LIMITS.nodes).items(nodeSchema).required(),
  edges: Joi.array().max(CANVAS_LIMITS.edges).items(edgeSchema).required(),
  assets: Joi.array().max(CANVAS_LIMITS.assets).items(assetSchema).optional(),
  createdAt: Joi.string().isoDate().optional(),
  updatedAt: Joi.string().isoDate().optional()
}).unknown(false);

const createSchema = Joi.object({ title: Joi.string().trim().min(1).max(80).required() }).unknown(false);
const updateSchema = Joi.object({ expectedUpdatedAt: Joi.string().isoDate().required(), project: projectSchema.required() }).unknown(false);
const uploadQuerySchema = Joi.object({
  expectedUpdatedAt: Joi.string().isoDate().required(),
  name: Joi.string().trim().min(1).max(120).required()
}).unknown(false);
const mutationQuerySchema = Joi.object({ expectedUpdatedAt: Joi.string().isoDate().required() }).unknown(false);

const applicationParamsSchema = Joi.object({
  applicationId: Joi.string().valid(...APPLICATION_IDS).required()
}).unknown(false);
const projectParamsSchema = Joi.object({
  applicationId: Joi.string().valid(...APPLICATION_IDS).required(),
  projectId: Joi.string().guid({ version: ["uuidv4"] }).required()
}).unknown(false);
const assetParamsSchema = Joi.object({
  applicationId: Joi.string().valid(...APPLICATION_IDS).required(),
  projectId: Joi.string().guid({ version: ["uuidv4"] }).required(),
  assetId: Joi.string().guid({ version: ["uuidv4"] }).required()
}).unknown(false);

const generationNodeParamsSchema = Joi.object({
  applicationId: Joi.string().valid(...APPLICATION_IDS).required(),
  projectId: Joi.string().guid({ version: ["uuidv4"] }).required(),
  nodeId: Joi.string().guid({ version: ["uuidv4"] }).required()
}).unknown(false);
const referenceAssetIdsSchema = Joi.array()
  .max(CANVAS_GENERATION_LIMITS.referenceImages)
  .items(Joi.string().guid({ version: ["uuidv4"] }))
  .optional();
const generateImageSchema = Joi.object({
  expectedUpdatedAt: Joi.string().isoDate().required(),
  nodeId: Joi.string().guid({ version: ["uuidv4"] }).optional(),
  prompt: Joi.string().trim().min(1).max(CANVAS_GENERATION_LIMITS.imagePromptCharacters).required(),
  aspectRatio: Joi.string().valid(...CANVAS_IMAGE_ASPECT_RATIOS).optional(),
  referenceAssetIds: referenceAssetIdsSchema,
  modelTarget: Joi.object({
    accountId: Joi.string().trim().min(1).max(160).required(),
    modelId: Joi.string().trim().min(1).max(160).required()
  }).unknown(false).optional()
}).unknown(false);
const generateVideoSchema = Joi.object({
  expectedUpdatedAt: Joi.string().isoDate().required(),
  nodeId: Joi.string().guid({ version: ["uuidv4"] }).optional(),
  prompt: Joi.string().trim().min(1).max(CANVAS_GENERATION_LIMITS.videoPromptCharacters).required(),
  durationSeconds: Joi.number().integer().min(CANVAS_GENERATION_LIMITS.videoMinimumSeconds).max(CANVAS_GENERATION_LIMITS.videoMaximumSeconds).optional(),
  aspectRatio: Joi.string().valid(...CANVAS_VIDEO_ASPECT_RATIOS).optional(),
  referenceAssetIds: referenceAssetIdsSchema
}).unknown(false);

function parse<T>(schema: Joi.ObjectSchema, value: unknown): T {
  const result = schema.validate(value, { abortEarly: false, convert: true, stripUnknown: false });
  if (result.error) throw new ApiError(400, "canvas_invalid", result.error.details.map(item => item.message).join("；"));
  return result.value as T;
}

function handleError(error: unknown): never {
  if (error instanceof CanvasConflictError) throw new ApiError(409, "canvas_conflict", error.message);
  if (error instanceof ApiError) throw error;
  throw new ApiError(400, "canvas_invalid", error instanceof Error ? error.message : "无限画布请求无效。");
}

function notFoundProject(): never {
  throw new ApiError(404, "canvas_not_found", "找不到当前账户与 App 作用域下的画布项目。");
}

/** 生成编排错误映射：未配置/无密钥/非法参数 → 400；未接通能力 → 501；Provider 真实失败 → 422。 */
function handleGenerationError(error: unknown): never {
  if (error instanceof CanvasConflictError) throw new ApiError(409, "canvas_conflict", error.message);
  if (error instanceof CanvasGenerationConfigurationError) throw new ApiError(400, "canvas_generation_invalid", error.message);
  if (error instanceof CanvasGenerationUnsupportedError) throw new ApiError(501, "canvas_generation_unsupported", error.message);
  if (error instanceof CanvasGenerationNotFoundError) throw new ApiError(404, "canvas_not_found", error.message);
  if (error instanceof ApiError) throw error;
  throw new ApiError(422, "canvas_generation_failed", error instanceof Error ? error.message : "画布生成请求失败；没有登记任何生成结果。");
}

/** 客户端断开连接时中止真实 Provider 请求；不缓存、不返回假成功。 */
function abortOnDisconnect(response: Response): { controller: AbortController; dispose: () => void } {
  const controller = new AbortController();
  const abort = () => {
    if (!response.writableFinished) controller.abort();
  };
  response.once("close", abort);
  return { controller, dispose: () => response.removeListener("close", abort) };
}

export function registerRoutes(router: Router, service: CanvasService, generation: CanvasGenerationService): void {
  // 画布首页：跨 App 列当前账户全部画布。
  router.get("/canvas/projects", requireAuthentication, (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.json({ projects: service.list(request.auth!.user.id) });
  });

  router.get("/apps/:applicationId/canvas/projects", requireAuthentication, (request, response) => {
    const params = parse<{ applicationId: ApplicationId }>(applicationParamsSchema, request.params);
    response.setHeader("Cache-Control", "no-store");
    response.json({ projects: service.list(request.auth!.user.id, params.applicationId) });
  });

  router.post("/apps/:applicationId/canvas/projects", requireAuthentication, (request, response) => {
    const params = parse<{ applicationId: ApplicationId }>(applicationParamsSchema, request.params);
    const input = parse<{ title: string }>(createSchema, request.body);
    try {
      response.status(201).json({ project: service.create(request.auth!.user.id, params.applicationId, input.title) });
    } catch (error) {
      handleError(error);
    }
  });

  router.get("/apps/:applicationId/canvas/projects/:projectId", requireAuthentication, (request, response) => {
    const params = parse<{ applicationId: ApplicationId; projectId: string }>(projectParamsSchema, request.params);
    try {
      const project = service.read(request.auth!.user.id, params.applicationId, params.projectId);
      if (!project) notFoundProject();
      response.setHeader("Cache-Control", "no-store");
      response.json({ project });
    } catch (error) {
      handleError(error);
    }
  });

  router.put("/apps/:applicationId/canvas/projects/:projectId", requireAuthentication, (request, response) => {
    const params = parse<{ applicationId: ApplicationId; projectId: string }>(projectParamsSchema, request.params);
    const input = parse<{ expectedUpdatedAt: string; project: unknown }>(updateSchema, request.body);
    try {
      const project = service.update(request.auth!.user.id, params.applicationId, params.projectId, input.expectedUpdatedAt, input.project);
      if (!project) notFoundProject();
      response.setHeader("Cache-Control", "no-store");
      response.json({ project });
    } catch (error) {
      handleError(error);
    }
  });

  router.delete("/apps/:applicationId/canvas/projects/:projectId", requireAuthentication, (request, response) => {
    const params = parse<{ applicationId: ApplicationId; projectId: string }>(projectParamsSchema, request.params);
    try {
      if (!service.remove(request.auth!.user.id, params.applicationId, params.projectId)) notFoundProject();
      response.status(204).end();
    } catch (error) {
      handleError(error);
    }
  });

  const assetBody = express.raw({ type: ASSET_MIME_VALUES, limit: MAX_UPLOAD_BYTES });

  router.post("/apps/:applicationId/canvas/projects/:projectId/assets", requireAuthentication, assetBody, (request, response) => {
    const params = parse<{ applicationId: ApplicationId; projectId: string }>(projectParamsSchema, request.params);
    const query = parse<{ expectedUpdatedAt: string; name: string }>(uploadQuerySchema, request.query);
    const bytes = Buffer.isBuffer(request.body) ? request.body : null;
    if (!bytes) throw new ApiError(400, "canvas_asset_invalid", "素材文件内容无效。");
    try {
      const project = service.uploadAsset(
        request.auth!.user.id,
        params.applicationId,
        params.projectId,
        query.expectedUpdatedAt,
        query.name,
        request.headers["content-type"],
        bytes
      );
      if (!project) notFoundProject();
      response.setHeader("Cache-Control", "no-store");
      response.status(201).json({ project });
    } catch (error) {
      handleError(error);
    }
  });

  router.get("/apps/:applicationId/canvas/projects/:projectId/assets/:assetId", requireAuthentication, (request, response) => {
    const params = parse<{ applicationId: ApplicationId; projectId: string; assetId: string }>(assetParamsSchema, request.params);
    try {
      const asset = service.openAsset(request.auth!.user.id, params.applicationId, params.projectId, params.assetId, request.headers.range);
      if (!asset) throw new ApiError(404, "canvas_asset_not_found", "找不到当前账户与 App 作用域下画布引用的素材。");
      response.setHeader("Cache-Control", "private, no-store");
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.setHeader("Accept-Ranges", "bytes");
      response.setHeader("Content-Type", asset.mimeType);
      if (asset.rangeNotSatisfiable) {
        response.setHeader("Content-Range", "bytes */" + asset.size);
        response.status(416).end();
        return;
      }
      const start = asset.start ?? 0;
      const end = asset.end ?? asset.size - 1;
      const partial = Boolean(request.headers.range);
      response.setHeader("Content-Length", end - start + 1);
      if (partial) {
        response.status(206);
        response.setHeader("Content-Range", "bytes " + start + "-" + end + "/" + asset.size);
      }
      const stream = asset.stream!;
      response.on("close", () => {
        if (!stream.destroyed) stream.destroy();
      });
      stream.on("error", streamError => {
        if (response.headersSent) response.destroy(streamError);
        else response.status(500).end();
      });
      stream.pipe(response);
    } catch (error) {
      handleError(error);
    }
  });

  router.delete("/apps/:applicationId/canvas/projects/:projectId/assets/:assetId", requireAuthentication, (request, response) => {
    const params = parse<{ applicationId: ApplicationId; projectId: string; assetId: string }>(assetParamsSchema, request.params);
    const query = parse<{ expectedUpdatedAt: string }>(mutationQuerySchema, request.query);
    try {
      const project = service.removeAsset(request.auth!.user.id, params.applicationId, params.projectId, params.assetId, query.expectedUpdatedAt);
      if (!project) notFoundProject();
      response.setHeader("Cache-Control", "no-store");
      response.json({ project });
    } catch (error) {
      handleError(error);
    }
  });

  // 生成路由：控制器只做 Joi 校验、认证与错误映射；模型账户、密钥、Provider 协议和落盘都由生成编排与画布 Owner 完成。
  router.post("/apps/:applicationId/canvas/projects/:projectId/generate/image", requireAuthentication, asyncHandler(async (request, response) => {
    const params = parse<{ applicationId: ApplicationId; projectId: string }>(projectParamsSchema, request.params);
    const input = parse<{
      expectedUpdatedAt: string;
      nodeId?: string;
      prompt: string;
      aspectRatio?: CanvasImageAspectRatio;
      referenceAssetIds?: string[];
      modelTarget?: { accountId: string; modelId: string };
    }>(generateImageSchema, request.body);
    const { controller, dispose } = abortOnDisconnect(response);
    try {
      const result = await generation.generateImage(request.auth!.user.id, params.applicationId, params.projectId, { ...input, signal: controller.signal });
      if (!result) notFoundProject();
      response.setHeader("Cache-Control", "no-store");
      response.json(result);
    } catch (error) {
      handleGenerationError(error);
    } finally {
      dispose();
    }
  }));

  router.post("/apps/:applicationId/canvas/projects/:projectId/generate/video", requireAuthentication, asyncHandler(async (request, response) => {
    const params = parse<{ applicationId: ApplicationId; projectId: string }>(projectParamsSchema, request.params);
    const input = parse<{
      expectedUpdatedAt: string;
      nodeId?: string;
      prompt: string;
      durationSeconds?: number;
      aspectRatio?: CanvasVideoAspectRatio;
      referenceAssetIds?: string[];
    }>(generateVideoSchema, request.body);
    const { controller, dispose } = abortOnDisconnect(response);
    try {
      const result = await generation.startVideo(request.auth!.user.id, params.applicationId, params.projectId, { ...input, signal: controller.signal });
      if (!result) notFoundProject();
      response.setHeader("Cache-Control", "no-store");
      response.json({ project: result.project });
    } catch (error) {
      handleGenerationError(error);
    } finally {
      dispose();
    }
  }));

  router.post("/apps/:applicationId/canvas/projects/:projectId/generation/:nodeId/refresh", requireAuthentication, asyncHandler(async (request, response) => {
    const params = parse<{ applicationId: ApplicationId; projectId: string; nodeId: string }>(generationNodeParamsSchema, request.params);
    const { controller, dispose } = abortOnDisconnect(response);
    try {
      const project = await generation.refreshVideo(request.auth!.user.id, params.applicationId, params.projectId, params.nodeId, controller.signal);
      if (!project) notFoundProject();
      response.setHeader("Cache-Control", "no-store");
      response.json({ project });
    } catch (error) {
      handleGenerationError(error);
    } finally {
      dispose();
    }
  }));

  router.post("/apps/:applicationId/canvas/projects/:projectId/generation/:nodeId/cancel", requireAuthentication, asyncHandler(async (request, response) => {
    const params = parse<{ applicationId: ApplicationId; projectId: string; nodeId: string }>(generationNodeParamsSchema, request.params);
    const { controller, dispose } = abortOnDisconnect(response);
    try {
      const project = await generation.cancelVideo(request.auth!.user.id, params.applicationId, params.projectId, params.nodeId, controller.signal);
      if (!project) notFoundProject();
      response.setHeader("Cache-Control", "no-store");
      response.json({ project });
    } catch (error) {
      handleGenerationError(error);
    } finally {
      dispose();
    }
  }));
}

export const inject = ["apiGateway", "lfaaCanvas", "lfaaCanvasGeneration"];
export function apply(ctx: Context): void {
  ctx.apiGateway.register(ctx, "canvas-controller", router => registerRoutes(router, ctx.lfaaCanvas, ctx.lfaaCanvasGeneration));
}
