/** 功能：附件上传/清单/元数据的认证 API。作用：只调用附件 Owner，账户隔离与校验都下沉在存储合同里。 */
import type { Context } from "@deepseek-ai/cordis";
import { Router } from "express";
import Joi from "joi";
import "lfaa-api-gateway/src/index.js";
import { asyncHandler } from "lfaa-api-remotes/src/route-contracts.js";
import { requireAuthentication } from "lfaa-authorization/src/middleware.js";
import { ApiError } from "lfaa-util-values/src/http-error.js";
import { ATTACHMENT_MAX_BYTES, ATTACHMENT_MEDIA_TYPES, normalizeAttachmentName, type AttachmentMediaType } from "lfaa-attachment/src/index.js";

const uploadSchema = Joi.object({
  name: Joi.string().trim().min(1).max(128).required(),
  mediaType: Joi.string().valid(...ATTACHMENT_MEDIA_TYPES).required(),
  dataBase64: Joi.string().min(4).max(Math.ceil(ATTACHMENT_MAX_BYTES / 3) * 4 + 16).required()
}).unknown(false);

export interface DecodedAttachmentUpload {
  name: string;
  mediaType: AttachmentMediaType;
  data: Uint8Array;
}

/**
 * 把上传体解码成受管字节：只接受白名单类型、有界 base64 与合规名称。
 * 与存储合同重复的校验保留在这里，是为了在解析阶段就拒绝 oversized 请求，避免把大对象交给 Owner。
 */
export function decodeAttachmentUpload(value: unknown): DecodedAttachmentUpload {
  const parsed = uploadSchema.validate(value, { convert: false, abortEarly: false });
  if (parsed.error) throw new ApiError(400, "invalid_attachment_upload", "附件名称、类型或内容无效：" + parsed.error.message);
  const { name, mediaType, dataBase64 } = parsed.value as { name: string; mediaType: AttachmentMediaType; dataBase64: string };
  if (!/^[A-Za-z0-9+/]*={0,2}$/u.test(dataBase64) || dataBase64.length % 4 !== 0) throw new ApiError(400, "invalid_attachment_upload", "附件内容不是有效的 base64。");
  const data = Buffer.from(dataBase64, "base64");
  // canonical base64：解码再编码必须与原串完全一致，拒绝畸形/多余填充的载荷（对齐 DSH admission）。
  if (data.toString("base64") !== dataBase64) throw new ApiError(400, "invalid_attachment_upload", "附件内容不是规范 base64。");
  if (data.byteLength === 0 || data.byteLength > ATTACHMENT_MAX_BYTES) throw new ApiError(400, "invalid_attachment_upload", `附件必须为 1 字节以上且不超过 ${ATTACHMENT_MAX_BYTES} 字节。`);
  return { name: normalizeAttachmentName(name), mediaType, data: new Uint8Array(data) };
}

export function registerRoutes(router: Router, attachments: Context["lfaaAttachments"]): void {
  router.get("/attachments", requireAuthentication, asyncHandler(async (request, response) => {
    const [list, usage] = await Promise.all([attachments.list(request.auth!.user.id), attachments.usage(request.auth!.user.id)]);
    response.setHeader("Cache-Control", "no-store");
    response.json({ attachments: list, usage });
  }));

  // 只删除当前账户自己的附件；不存在或不属于该账户返回 404，不泄露其他账户信息。
  router.delete("/attachments/:attachmentId", requireAuthentication, asyncHandler(async (request, response) => {
    const removed = await attachments.remove(request.auth!.user.id, request.params.attachmentId);
    if (!removed) throw new ApiError(404, "attachment_not_found", "找不到当前账户的该附件。");
    response.status(204).end();
  }));

  router.post("/attachments", requireAuthentication, asyncHandler(async (request, response) => {
    const upload = decodeAttachmentUpload(request.body);
    const record = await attachments.put({ userId: request.auth!.user.id, name: upload.name, mediaType: upload.mediaType, data: upload.data });
    response.setHeader("Cache-Control", "no-store");
    response.status(201).json({ attachment: record });
  }));

  router.get("/attachments/:attachmentId", requireAuthentication, asyncHandler(async (request, response) => {
    const record = await attachments.get(request.auth!.user.id, request.params.attachmentId);
    response.setHeader("Cache-Control", "no-store");
    response.json({ attachment: record.record });
  }));

  // 缩略图/预览：只返回当前账户自己的附件字节，仍然经过存储的归属与摘要校验。
  router.get("/attachments/:attachmentId/content", requireAuthentication, asyncHandler(async (request, response) => {
    const content = await attachments.get(request.auth!.user.id, request.params.attachmentId);
    response.setHeader("Content-Type", content.record.mediaType);
    response.setHeader("Cache-Control", "private, max-age=300");
    response.setHeader("Content-Disposition", "inline; filename*=UTF-8''" + encodeURIComponent(content.record.name));
    response.send(Buffer.from(content.data));
  }));
}

export const name = "lfaaApiAttachmentController";
export const inject = ["apiGateway", "lfaaAttachments"];
export function apply(ctx: Context): void {
  ctx.apiGateway.register(ctx, "attachment-controller", (router) => registerRoutes(router, ctx.lfaaAttachments));
}
