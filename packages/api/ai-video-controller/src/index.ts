/** 功能：提供认证后的 AI 漫剧分镜画布 API。作用：按当前登录账户委派唯一创作数据 Owner。 */
import express, { Router, type NextFunction, type Request, type Response } from "express";
import Joi from "joi";
import type { Context } from "@deepseek-ai/cordis";
import { asyncHandler } from "lfaa-api-remotes/src/route-contracts.js";
import { ApiError } from "lfaa-util-values/src/http-error.js";
import { requireAuthentication } from "lfaa-authorization/src/middleware.js";
import { AI_VIDEO_CANVAS_LIMITS, AiVideoCanvasConflictError, type AiVideoCanvasService } from "lfaa-video-ai-video/src/index.js";
import type { AiPluginHost } from "lfaa-app-boot/src/ai-host.js";
import type { MinecraftRealtimePublisher } from "lfaa-api-remotes/src/socket-server.js";

const MAX_CONCURRENT_MEDIA_UPLOADS = 2;
let activeMediaUploads = 0;

function reserveMediaUpload(_request: Request, response: Response, next: NextFunction): void {
  if (activeMediaUploads >= MAX_CONCURRENT_MEDIA_UPLOADS) {
    next(new ApiError(429, "ai_video_media_busy", "媒体写入正在处理中，请稍后再试。"));
    return;
  }
  activeMediaUploads += 1;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    activeMediaUploads = Math.max(0, activeMediaUploads - 1);
  };
  response.once("finish", release);
  response.once("close", release);
  next();
}

const shotSchema = Joi.object({
  id: Joi.string().guid({ version: ["uuidv4"] }).required(),
  title: Joi.string().trim().min(1).max(80).required(),
  description: Joi.string().max(1_000).allow("").required(),
  dialogue: Joi.string().max(2_000).allow("").required(),
  durationSeconds: Joi.number().integer().min(1).max(120).required(),
  x: Joi.number().min(-50_000).max(50_000).required(),
  y: Joi.number().min(-50_000).max(50_000).required(),
  characterIds: Joi.array().max(AI_VIDEO_CANVAS_LIMITS.referencesPerShot).items(Joi.string().guid({ version: ["uuidv4"] })).optional(),
  locationId: Joi.string().guid({ version: ["uuidv4"] }).optional(),
  imageAssetId: Joi.string().guid({ version: ["uuidv4"] }).optional(),
  imageMimeType: Joi.string().valid("image/png", "image/jpeg", "image/webp").optional()
}).unknown(false);
const referenceSchema = Joi.object({
  id: Joi.string().guid({ version: ["uuidv4"] }).required(),
  name: Joi.string().trim().min(1).max(80).required(),
  description: Joi.string().max(2_000).allow("").required(),
  imageAssetId: Joi.string().guid({ version: ["uuidv4"] }).optional(),
  imageMimeType: Joi.string().valid("image/png", "image/jpeg", "image/webp").optional()
}).and("imageAssetId", "imageMimeType").unknown(false);
const linkSchema = Joi.object({
  id: Joi.string().guid({ version: ["uuidv4"] }).required(),
  source: Joi.string().guid({ version: ["uuidv4"] }).required(),
  target: Joi.string().guid({ version: ["uuidv4"] }).required()
}).unknown(false);
const timelineClipSchema = Joi.object({
  id: Joi.string().guid({ version: ["uuidv4"] }).required(),
  track: Joi.string().valid("video", "audio", "subtitle").required(),
  assetId: Joi.string().guid({ version: ["uuidv4"] }).optional(),
  text: Joi.string().max(1_000).optional(),
  startSeconds: Joi.number().min(0).max(AI_VIDEO_CANVAS_LIMITS.timelineSeconds).required(),
  inPointSeconds: Joi.number().min(0).max(AI_VIDEO_CANVAS_LIMITS.timelineSeconds).required(),
  durationSeconds: Joi.number().greater(0).max(AI_VIDEO_CANVAS_LIMITS.timelineSeconds).required()
}).unknown(false);
const whiteModelSchema = Joi.object({
  ratio: Joi.string().valid("16:9", "9:16", "1:1").required(),
  camera: Joi.object({
    x: Joi.number().min(-100).max(100).required(), y: Joi.number().min(-5).max(100).required(), z: Joi.number().min(-100).max(100).required(),
    yaw: Joi.number().min(-360).max(360).required(), pitch: Joi.number().min(-85).max(85).required(), focalLength: Joi.number().min(18).max(120).required()
  }).unknown(false).required(),
  items: Joi.array().max(AI_VIDEO_CANVAS_LIMITS.whiteModelItems).items(Joi.object({
    id: Joi.string().guid({ version: ["uuidv4"] }).required(), name: Joi.string().trim().min(1).max(50).required(), kind: Joi.string().valid("actor", "block").required(),
    x: Joi.number().min(-50).max(50).required(), z: Joi.number().min(-50).max(50).required(), width: Joi.number().min(0.2).max(20).required(), depth: Joi.number().min(0.2).max(20).required(), height: Joi.number().min(0.2).max(20).required()
  }).unknown(false)).required()
}).unknown(false);
const createSchema = Joi.object({ title: Joi.string().trim().min(1).max(80).required() }).unknown(false);
const updateSchema = Joi.object({
  expectedUpdatedAt: Joi.string().isoDate().required(),
  canvas: Joi.object({
    title: Joi.string().trim().min(1).max(80).required(),
    script: Joi.string().max(AI_VIDEO_CANVAS_LIMITS.scriptCharacters).optional(),
    characters: Joi.array().max(AI_VIDEO_CANVAS_LIMITS.characters).items(referenceSchema).optional(),
    locations: Joi.array().max(AI_VIDEO_CANVAS_LIMITS.locations).items(referenceSchema).optional(),
    shots: Joi.array().max(AI_VIDEO_CANVAS_LIMITS.shots).items(shotSchema).required(),
    links: Joi.array().max(AI_VIDEO_CANVAS_LIMITS.links).items(linkSchema).required(),
    timelineClips: Joi.array().max(AI_VIDEO_CANVAS_LIMITS.timelineClips).items(timelineClipSchema).optional(),
    whiteModel: whiteModelSchema.optional()
  }).unknown(false).required()
}).unknown(false);

function parse<T>(schema: Joi.ObjectSchema, value: unknown): T {
  const result = schema.validate(value, { abortEarly: false, convert: true, stripUnknown: false });
  if (result.error) throw new ApiError(400, "ai_video_canvas_invalid", result.error.details.map(item => item.message).join("；"));
  return result.value as T;
}

function handleError(error: unknown): never {
  if (error instanceof AiVideoCanvasConflictError) throw new ApiError(409, "ai_video_canvas_conflict", error.message);
  if (error instanceof ApiError) throw error;
  throw new ApiError(400, "ai_video_canvas_invalid", error instanceof Error ? error.message : "分镜画布请求无效。");
}

export function registerRoutes(router: Router, _aiHost: AiPluginHost, _realtime: MinecraftRealtimePublisher, service: AiVideoCanvasService): void {
  router.get("/ai-video/canvases", requireAuthentication, (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.json({
      canvases: service.list(request.auth!.user.id),
      limits: {
        canvases: AI_VIDEO_CANVAS_LIMITS.canvases,
        shots: AI_VIDEO_CANVAS_LIMITS.shots,
        links: AI_VIDEO_CANVAS_LIMITS.links,
        characters: AI_VIDEO_CANVAS_LIMITS.characters,
        locations: AI_VIDEO_CANVAS_LIMITS.locations,
        scriptCharacters: AI_VIDEO_CANVAS_LIMITS.scriptCharacters,
        referencesPerShot: AI_VIDEO_CANVAS_LIMITS.referencesPerShot,
        referenceImageBytes: AI_VIDEO_CANVAS_LIMITS.referenceImageBytes,
        referenceImageDimension: AI_VIDEO_CANVAS_LIMITS.referenceImageDimension,
        referenceImagePixels: AI_VIDEO_CANVAS_LIMITS.referenceImagePixels,
        imageAssetBytes: AI_VIDEO_CANVAS_LIMITS.imageAssetBytes,
        mediaAssetBytes: AI_VIDEO_CANVAS_LIMITS.mediaAssetBytes,
        timelineClips: AI_VIDEO_CANVAS_LIMITS.timelineClips,
        timelineSeconds: AI_VIDEO_CANVAS_LIMITS.timelineSeconds
      }
    });
  });

  router.post("/ai-video/canvases", requireAuthentication, (request, response) => {
    const input = parse<{ title: string }>(createSchema, request.body);
    try { response.status(201).json({ canvas: service.create(request.auth!.user.id, input.title) }); }
    catch (error) { handleError(error); }
  });

  router.put("/ai-video/canvases/:canvasId", requireAuthentication, (request, response) => {
    const input = parse<{ expectedUpdatedAt: string; canvas: unknown }>(updateSchema, request.body);
    try {
      const canvas = service.update(request.auth!.user.id, request.params.canvasId, input.expectedUpdatedAt, input.canvas);
      if (!canvas) throw new ApiError(404, "ai_video_canvas_not_found", "找不到当前账户的分镜画布。");
      response.json({ canvas });
    } catch (error) { handleError(error); }
  });

  const referenceImageInput = Joi.object({
    expectedUpdatedAt: Joi.string().isoDate().required(),
    dataUrl: Joi.string().max(Math.ceil(AI_VIDEO_CANVAS_LIMITS.referenceImageBytes * 4 / 3) + 128).required()
  }).unknown(false);
  const referenceImageRemovalInput = Joi.object({ expectedUpdatedAt: Joi.string().isoDate().required() }).unknown(false);
  router.put("/ai-video/canvases/:canvasId/references/:kind/:referenceId/image", requireAuthentication, asyncHandler(async (request, response) => {
    const input = parse<{ expectedUpdatedAt: string; dataUrl: string }>(referenceImageInput, request.body);
    if (request.params.kind !== "characters" && request.params.kind !== "locations") throw new ApiError(400, "ai_video_canvas_invalid", "参考图片类型无效。");
    try {
      const canvas = await service.uploadReferenceImage(request.auth!.user.id, request.params.canvasId, request.params.kind, request.params.referenceId, input.expectedUpdatedAt, input.dataUrl);
      if (!canvas) throw new ApiError(404, "ai_video_canvas_not_found", "找不到当前账户的分镜画布。");
      response.setHeader("Cache-Control", "no-store");
      response.json({ canvas });
    } catch (error) { handleError(error); }
  }));

  router.delete("/ai-video/canvases/:canvasId/references/:kind/:referenceId/image", requireAuthentication, (request, response) => {
    const input = parse<{ expectedUpdatedAt: string }>(referenceImageRemovalInput, request.body);
    if (request.params.kind !== "characters" && request.params.kind !== "locations") throw new ApiError(400, "ai_video_canvas_invalid", "参考图片类型无效。");
    try {
      const canvas = service.removeReferenceImage(request.auth!.user.id, request.params.canvasId, request.params.kind, request.params.referenceId, input.expectedUpdatedAt);
      if (!canvas) throw new ApiError(404, "ai_video_canvas_not_found", "找不到当前账户的分镜画布。");
      response.setHeader("Cache-Control", "no-store");
      response.json({ canvas });
    } catch (error) { handleError(error); }
  });

  router.post("/ai-video/canvases/:canvasId/shots/:shotId/image", requireAuthentication, asyncHandler(async (request, response) => {
    const input = parse<{ expectedUpdatedAt: string }>(Joi.object({ expectedUpdatedAt: Joi.string().isoDate().required() }).unknown(false), request.body);
    const abortController = new AbortController();
    const abortOnDisconnect = () => { if (!response.writableFinished) abortController.abort(); };
    response.once("close", abortOnDisconnect);
    try {
      const canvas = await service.generateShotImage(request.auth!.user.id, request.params.canvasId, request.params.shotId, input.expectedUpdatedAt, abortController.signal);
      if (!canvas) throw new ApiError(404, "ai_video_canvas_not_found", "找不到当前账户的分镜画布。");
      response.setHeader("Cache-Control", "no-store");
      response.json({ canvas });
    } catch (error) {
      if (error instanceof AiVideoCanvasConflictError || error instanceof ApiError) throw error;
      throw new ApiError(422, "ai_video_image_generation_failed", error instanceof Error ? error.message : "图片生成失败。没有登记生成结果。");
    } finally {
      response.removeListener("close", abortOnDisconnect);
    }
  }));

  const videoTaskInput = Joi.object({ expectedUpdatedAt: Joi.string().isoDate().required() }).unknown(false);
  router.post("/ai-video/canvases/:canvasId/shots/:shotId/video", requireAuthentication, asyncHandler(async (request, response) => {
    const input = parse<{ expectedUpdatedAt: string }>(videoTaskInput, request.body);
    try {
      const canvas = await service.startShotVideo(request.auth!.user.id, request.params.canvasId, request.params.shotId, input.expectedUpdatedAt);
      if (!canvas) throw new ApiError(404, "ai_video_canvas_not_found", "找不到当前账户的漫剧项目。");
      response.setHeader("Cache-Control", "no-store");
      response.json({ canvas });
    } catch (error) {
      if (error instanceof AiVideoCanvasConflictError || error instanceof ApiError) throw error;
      throw new ApiError(422, "ai_video_video_generation_failed", error instanceof Error ? error.message : "视频任务创建失败；没有登记生成成功。");
    }
  }));

  router.get("/ai-video/canvases/:canvasId/shots/:shotId/video", requireAuthentication, asyncHandler(async (request, response) => {
    try {
      const canvas = await service.refreshShotVideo(request.auth!.user.id, request.params.canvasId, request.params.shotId);
      if (!canvas) throw new ApiError(404, "ai_video_canvas_not_found", "找不到当前账户的漫剧项目。");
      response.setHeader("Cache-Control", "no-store");
      response.json({ canvas });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(422, "ai_video_video_status_failed", error instanceof Error ? error.message : "查询视频任务失败。");
    }
  }));

  router.delete("/ai-video/canvases/:canvasId/shots/:shotId/video", requireAuthentication, asyncHandler(async (request, response) => {
    try {
      const canvas = await service.cancelShotVideo(request.auth!.user.id, request.params.canvasId, request.params.shotId);
      if (!canvas) throw new ApiError(404, "ai_video_canvas_not_found", "找不到当前账户的漫剧项目。");
      response.setHeader("Cache-Control", "no-store");
      response.json({ canvas });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(422, "ai_video_video_cancel_failed", error instanceof Error ? error.message : "取消排队中的视频任务失败。");
    }
  }));

  router.get("/ai-video/canvases/:canvasId/assets/:assetId", requireAuthentication, (request, response) => {
    try {
      const asset = service.openMediaAsset(request.auth!.user.id, request.params.canvasId, request.params.assetId, request.headers.range);
      if (!asset) throw new ApiError(404, "ai_video_asset_not_found", "找不到当前账户项目引用的媒体素材。");
      response.setHeader("Cache-Control", "private, no-store");
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.setHeader("Accept-Ranges", "bytes");
      response.setHeader("Content-Type", asset.mimeType);
      if (asset.rangeNotSatisfiable) {
        response.setHeader("Content-Range", `bytes */${asset.size}`);
        response.status(416).end();
        return;
      }
      const start = asset.start ?? 0;
      const end = asset.end ?? asset.size - 1;
      const partial = Boolean(request.headers.range);
      response.setHeader("Content-Length", end - start + 1);
      if (partial) {
        response.status(206);
        response.setHeader("Content-Range", `bytes ${start}-${end}/${asset.size}`);
      }
      const stream = asset.stream!;
      response.on("close", () => { if (!stream.destroyed) stream.destroy(); });
      stream.on("error", streamError => { if (response.headersSent) response.destroy(streamError); else response.status(500).end(); });
      stream.pipe(response);
    } catch (error) { handleError(error); }
  });

  const mediaBody = express.raw({ type: ["image/png", "image/jpeg", "image/webp", "video/mp4", "video/webm", "audio/mpeg", "audio/wav", "audio/ogg"], limit: AI_VIDEO_CANVAS_LIMITS.mediaAssetBytes });
  const exportBody = express.raw({ type: ["video/mp4", "video/webm"], limit: AI_VIDEO_CANVAS_LIMITS.mediaAssetBytes });
  const shotImageBody = express.raw({ type: ["image/png", "image/jpeg", "image/webp"], limit: AI_VIDEO_CANVAS_LIMITS.referenceImageBytes });
  const mediaUploadQuery = Joi.object({ expectedUpdatedAt: Joi.string().isoDate().required(), name: Joi.string().trim().min(1).max(120).required() }).unknown(false);
  const mediaMutationQuery = Joi.object({ expectedUpdatedAt: Joi.string().isoDate().required() }).unknown(false);
  router.get("/ai-video/canvases/:canvasId/media", requireAuthentication, (request, response) => {
    try {
      const assets = service.listMediaAssets(request.auth!.user.id, request.params.canvasId);
      if (!assets) throw new ApiError(404, "ai_video_canvas_not_found", "找不到当前账户的漫剧项目。");
      response.setHeader("Cache-Control", "private, no-store");
      response.json({ assets });
    } catch (error) { handleError(error); }
  });

  router.post("/ai-video/canvases/:canvasId/assets", requireAuthentication, reserveMediaUpload, mediaBody, asyncHandler(async (request, response) => {
    const query = parse<{ expectedUpdatedAt: string; name: string }>(mediaUploadQuery, request.query);
    const bytes = Buffer.isBuffer(request.body) ? request.body : null;
    if (!bytes) throw new ApiError(400, "ai_video_media_invalid", "媒体文件内容无效。");
    try {
      const canvas = await service.importMediaAsset(request.auth!.user.id, request.params.canvasId, query.expectedUpdatedAt, query.name, request.headers["content-type"], bytes);
      if (!canvas) throw new ApiError(404, "ai_video_canvas_not_found", "找不到当前账户的漫剧项目。");
      response.status(201).json({ canvas });
    } catch (error) { handleError(error); }
  }));

  router.delete("/ai-video/canvases/:canvasId/assets/:assetId", requireAuthentication, (request, response) => {
    const query = parse<{ expectedUpdatedAt: string }>(mediaMutationQuery, request.query);
    try {
      const canvas = service.removeMediaAsset(request.auth!.user.id, request.params.canvasId, request.params.assetId, query.expectedUpdatedAt);
      if (!canvas) throw new ApiError(404, "ai_video_canvas_not_found", "找不到当前账户的漫剧项目。");
      response.json({ canvas });
    } catch (error) { handleError(error); }
  });

  router.post("/ai-video/canvases/:canvasId/exports", requireAuthentication, reserveMediaUpload, exportBody, (request, response) => {
    const query = parse<{ expectedUpdatedAt: string }>(mediaMutationQuery, request.query);
    const bytes = Buffer.isBuffer(request.body) ? request.body : null;
    if (!bytes) throw new ApiError(400, "ai_video_export_invalid", "导出文件内容无效。");
    try {
      const result = service.saveExportAsset(request.auth!.user.id, request.params.canvasId, query.expectedUpdatedAt, bytes, request.headers["content-type"]);
      if (!result) throw new ApiError(404, "ai_video_canvas_not_found", "找不到当前账户的漫剧项目。");
      response.status(201).json(result);
    } catch (error) { handleError(error); }
  });

  router.put("/ai-video/canvases/:canvasId/shots/:shotId/image", requireAuthentication, reserveMediaUpload, shotImageBody, asyncHandler(async (request, response) => {
    const query = parse<{ expectedUpdatedAt: string }>(mediaMutationQuery, request.query);
    const bytes = Buffer.isBuffer(request.body) ? request.body : null;
    if (!bytes) throw new ApiError(400, "ai_video_image_invalid", "取景图片内容无效。");
    try {
      const canvas = await service.uploadShotImage(request.auth!.user.id, request.params.canvasId, request.params.shotId, query.expectedUpdatedAt, bytes, request.headers["content-type"]);
      if (!canvas) throw new ApiError(404, "ai_video_canvas_not_found", "找不到当前账户的漫剧项目。");
      response.json({ canvas });
    } catch (error) { handleError(error); }
  }));

  router.delete("/ai-video/canvases/:canvasId", requireAuthentication, (request, response) => {
    try {
      if (!service.remove(request.auth!.user.id, request.params.canvasId)) throw new ApiError(404, "ai_video_canvas_not_found", "找不到当前账户的分镜画布。");
      response.status(204).end();
    } catch (error) { handleError(error); }
  });
}

export const inject = ["apiGateway", "lfaaAiVideo"];
export function apply(ctx: Context): void {
  ctx.apiGateway.register(ctx, "ai-video-controller", (router, aiHost, realtime) => registerRoutes(router, aiHost, realtime, ctx.lfaaAiVideo));
}
