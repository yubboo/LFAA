/**
 * 功能：为 AI Markdown 资料库提供账户认证的设置管理 API。
 * 作用：隔离读取、上传/编辑/删除资料，以及添加/删除当前账户的本地项目来源。
 * 关联文件：packages/knowledge/knowledge-library/src/index.ts、packages/client/connection/src/api.ts。
 */
import { Router } from "express";
import Joi from "joi";
import type { Context } from "@deepseek-ai/cordis";
import { ApiError } from "lfaa-util-values/src/http-error.js";
import { APPLICATION_IDS, type ApplicationId } from "lfaa-util-values/src/application-id.js";
import { requireAuthentication } from "lfaa-authorization/src/middleware.js";
import type { AiPluginHost } from "lfaa-app-boot/src/ai-host.js";
import type { MinecraftRealtimePublisher } from "lfaa-api-remotes/src/socket-server.js";
import { createKnowledgeLibraryItem, createKnowledgeLibraryProjectSource, deleteKnowledgeLibraryItem, deleteKnowledgeLibraryProjectSource, getKnowledgeLibraryItem, getKnowledgeLibraryUsage, listKnowledgeLibraryItems, listKnowledgeLibraryProjectSources, updateKnowledgeLibraryItem } from "lfaa-knowledge-library/src/index.js";
import { KNOWLEDGE_LIBRARY_KINDS } from "lfaa-knowledge-library/src/index.js";

const scopeSchema = Joi.alternatives().try(Joi.string().valid("all"), Joi.string().valid(...APPLICATION_IDS));
const readScopeSchema = Joi.string().valid(...APPLICATION_IDS);
const projectAppSchema = Joi.string().valid("workspace", "minecraft");
const createItemSchema = Joi.object({
  applicationId: scopeSchema.required(), kind: Joi.string().valid(...KNOWLEDGE_LIBRARY_KINDS).required(),
  title: Joi.string().trim().min(1).max(120).required(), description: Joi.string().max(500).allow("").default(""),
  contentMarkdown: Joi.string().min(1).max(64 * 1024).required(), sourceKind: Joi.string().valid("upload", "manual").default("manual")
}).unknown(false);
const updateItemSchema = Joi.object({
  applicationId: readScopeSchema.required(), title: Joi.string().trim().min(1).max(120).required(),
  description: Joi.string().max(500).allow("").required(), contentMarkdown: Joi.string().min(1).max(64 * 1024).required(),
  expectedContentSha256: Joi.string().pattern(/^[a-f0-9]{64}$/u).required()
}).unknown(false);
const createSourceSchema = Joi.object({
  applicationId: scopeSchema.required(), projectId: Joi.string().uuid().required(), projectApplicationId: projectAppSchema.required(),
  relativePath: Joi.string().max(512).allow("").required(), title: Joi.string().trim().min(1).max(120).required()
}).unknown(false);
const listQuerySchema = Joi.object({ applicationId: readScopeSchema.optional() }).unknown(false);

function parse<T>(schema: Joi.ObjectSchema, value: unknown): T {
  const result = schema.validate(value, { abortEarly: false, convert: true, stripUnknown: false });
  if (result.error) throw new ApiError(400, "knowledge_request_invalid", result.error.details.map(item => item.message).join("；"));
  return result.value as T;
}

function badInput(error: unknown): never {
  if (error instanceof ApiError) throw error;
  throw new ApiError(400, "knowledge_request_invalid", error instanceof Error ? error.message : "资料库请求无效。");
}

export function registerRoutes(router: Router, _aiPluginHost: AiPluginHost, _realtime: MinecraftRealtimePublisher): void {
  router.get("/knowledge/items", requireAuthentication, (request, response) => {
    const query = parse<{ applicationId?: ApplicationId }>(listQuerySchema, request.query);
    response.json({ items: listKnowledgeLibraryItems(request.auth!.user.id, query.applicationId), sources: listKnowledgeLibraryProjectSources(request.auth!.user.id, query.applicationId), usage: getKnowledgeLibraryUsage(request.auth!.user.id) });
  });

  router.get("/knowledge/items/:itemId", requireAuthentication, (request, response) => {
    const query = parse<{ applicationId: ApplicationId }>(Joi.object({ applicationId: readScopeSchema.required() }).unknown(false), request.query);
    const item = getKnowledgeLibraryItem(request.auth!.user.id, request.params.itemId, query.applicationId);
    if (!item) throw new ApiError(404, "knowledge_item_not_found", "找不到此账户和 App 可见的 Markdown 资料。");
    response.json({ item });
  });

  router.post("/knowledge/items", requireAuthentication, (request, response) => {
    const input = parse<{ applicationId: ApplicationId | "all"; kind: "knowledge" | "skill" | "prompt" | "expert"; title: string; description: string; contentMarkdown: string; sourceKind: "upload" | "manual" }>(createItemSchema, request.body);
    try {
      response.status(201).json({ item: createKnowledgeLibraryItem(request.auth!.user.id, { ...input, sourceKind: input.sourceKind }) });
    } catch (error) { badInput(error); }
  });

  router.patch("/knowledge/items/:itemId", requireAuthentication, (request, response) => {
    const input = parse<{ applicationId: ApplicationId; title: string; description: string; contentMarkdown: string; expectedContentSha256: string }>(updateItemSchema, request.body);
    try {
      const item = updateKnowledgeLibraryItem(request.auth!.user.id, request.params.itemId, input.applicationId, input);
      if (!item) throw new ApiError(404, "knowledge_item_not_found", "找不到此账户和 App 可见的 Markdown 资料。");
      response.json({ item });
    } catch (error) { badInput(error); }
  });

  router.delete("/knowledge/items/:itemId", requireAuthentication, (request, response) => {
    if (!deleteKnowledgeLibraryItem(request.auth!.user.id, request.params.itemId)) throw new ApiError(404, "knowledge_item_not_found", "找不到当前账户的 Markdown 资料。");
    response.status(204).end();
  });

  router.post("/knowledge/sources", requireAuthentication, (request, response) => {
    const input = parse<{ applicationId: ApplicationId | "all"; projectId: string; projectApplicationId: "workspace" | "minecraft"; relativePath: string; title: string }>(createSourceSchema, request.body);
    try { response.status(201).json({ source: createKnowledgeLibraryProjectSource(request.auth!.user.id, input) }); }
    catch (error) { badInput(error); }
  });

  router.delete("/knowledge/sources/:sourceId", requireAuthentication, (request, response) => {
    if (!deleteKnowledgeLibraryProjectSource(request.auth!.user.id, request.params.sourceId)) throw new ApiError(404, "knowledge_source_not_found", "找不到当前账户的本地 Markdown 来源。");
    response.status(204).end();
  });
}

export const inject = ["apiGateway"];
export function apply(ctx: Context): void { ctx.apiGateway.register(ctx, "knowledge-controller", registerRoutes); }
