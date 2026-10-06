/** 功能：登记 writing-controller 的现有接口。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。 */
import { Router, type Request } from "express";
import Joi from "joi";
import { ApiError } from "lfaa-util-values/src/http-error.js";
import { requireAuthentication } from "lfaa-authorization/src/middleware.js";
import type { AiPluginHost } from "lfaa-app-boot/src/ai-host.js";
import type { MinecraftRealtimePublisher } from "lfaa-api-remotes/src/socket-server.js";
import { createWritingBook, createWritingCatalogEntry, createWritingChapter, createWritingVolume, createWritingBookSkill, deleteWritingBookSkill, deleteWritingBook, deleteWritingCatalogEntry, deleteWritingChapter, getWritingBookSkill, getWritingCatalogEntry, getWritingEditProposal, listWritingBookSkills, listWritingCatalogEntries, WRITING_CATALOG_KINDS, listWritingBookOutlineRevisions, getWritingWorkspace, listWritingChapterRevisions, renameWritingBook, resolveWritingEditProposal, restoreWritingChapterRevision, restoreWritingBookOutlineRevision, setActiveWritingLocation, updateWritingBookAiRole, updateWritingBookSkill, updateWritingBookOutline, updateWritingCatalogEntry, updateWritingChapter, exportWritingBookDeepWriteZip, importWritingBookDeepWriteZip, DeepWriteImportError } from "lfaa-document-writing/src/service.js";
import { parseBody, writingBookSchema, writingVolumeSchema, writingChapterSchema, writingOutlineSchema, writingChapterTitleSchema, writingCatalogEntryCreateSchema, writingCatalogEntrySchema, writingSelectionSchema, writingRouteIdSchema } from "lfaa-api-remotes/src/route-contracts.js";

const DEEPWRITE_UPLOAD_LIMIT = 32 * 1024 * 1024;

async function readDeepWriteUpload(request: Request): Promise<Buffer> {
  const contentLength = request.get("content-length");
  if (contentLength !== undefined && (!/^\d+$/u.test(contentLength) || Number(contentLength) > DEEPWRITE_UPLOAD_LIMIT)) {
    throw new ApiError(413, "deepwrite_zip_too_large", "DeepWrite ZIP 上传不能超过 32 MiB。");
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    size += buffer.byteLength;
    if (size > DEEPWRITE_UPLOAD_LIMIT) throw new ApiError(413, "deepwrite_zip_too_large", "DeepWrite ZIP 上传不能超过 32 MiB。");
    chunks.push(buffer);
  }
  if (!size) throw new ApiError(400, "empty_deepwrite_zip", "请选择一个 DeepWrite 项目 ZIP 文件。");
  return Buffer.concat(chunks, size);
}

export function registerRoutes(router: Router, _aiPluginHost: AiPluginHost, _realtime: MinecraftRealtimePublisher): void {

router.get("/writing/workspace", requireAuthentication, (request, response) => {
    response.json({ workspace: getWritingWorkspace(request.auth!.user.id) });
  });

router.get("/writing/books/:bookId/deepwrite.zip", requireAuthentication, (request, response) => {
    const { id: bookId } = parseBody<{ id: string }>(writingRouteIdSchema, { id: request.params.bookId });
    const archive = exportWritingBookDeepWriteZip(request.auth!.user.id, bookId);
    if (!archive) throw new ApiError(404, "writing_book_not_found", "找不到此账户下的作品。");
    response.status(200);
    response.setHeader("Content-Type", "application/zip");
    response.setHeader("Content-Disposition", `attachment; filename="${archive.filename}"`);
    response.setHeader("Content-Length", String(archive.data.byteLength));
    response.send(archive.data);
  });

router.post("/writing/import/deepwrite.zip", requireAuthentication, (request, response, next) => {
    void (async () => {
      const contentType = request.get("content-type")?.split(";", 1)[0]?.trim().toLocaleLowerCase("en-US");
      if (contentType !== "application/zip") throw new ApiError(415, "deepwrite_zip_required", "导入接口只接收 application/zip 文件流。");
      const archive = await readDeepWriteUpload(request);
      try {
        const workspace = importWritingBookDeepWriteZip(request.auth!.user.id, archive);
        response.status(201).json({ workspace });
      } catch (error) {
        if (error instanceof DeepWriteImportError) throw new ApiError(400, "invalid_deepwrite_project", error.message);
        throw error;
      }
    })().catch(next);
  });

router.patch("/writing/workspace/selection", requireAuthentication, (request, response) => {
    const body = parseBody<{ bookId: string | null; chapterId: string | null }>(writingSelectionSchema, request.body);
    const workspace = setActiveWritingLocation(request.auth!.user.id, body.bookId, body.chapterId);
    if (!workspace) throw new ApiError(404, "writing_location_not_found", "找不到此账户下的作品或章节。");
    response.json({ workspace });
  });

router.post("/writing/books", requireAuthentication, (request, response) => {
    const body = parseBody<{ title: string }>(writingBookSchema, request.body);
    response.status(201).json({ workspace: createWritingBook(request.auth!.user.id, body.title) });
  });

router.patch("/writing/books/:bookId", requireAuthentication, (request, response) => {
    const { id: bookId } = parseBody<{ id: string }>(writingRouteIdSchema, { id: request.params.bookId });
    const body = parseBody<{ title: string }>(writingBookSchema, request.body);
    const book = renameWritingBook(request.auth!.user.id, bookId, body.title);
    if (!book) throw new ApiError(404, "writing_book_not_found", "找不到此账户下的作品。");
    response.json({ book });
  });

router.patch("/writing/books/:bookId/ai-profile", requireAuthentication, (request, response) => {
    const { id: bookId } = parseBody<{ id: string }>(writingRouteIdSchema, { id: request.params.bookId });
    const body = parseBody<{ roleId: string }>(Joi.object({ roleId: Joi.string().valid("writing-companion", "outline-planner", "chapter-writer", "precision-editor", "continuity-reviewer", "character-consultant").required() }).unknown(false), request.body);
    const workspace = updateWritingBookAiRole(request.auth!.user.id, bookId, body.roleId);
    if (!workspace) throw new ApiError(404, "writing_book_not_found", "找不到此账户下的作品。");
    response.json({ workspace });
  });

router.get("/writing/books/:bookId/skills", requireAuthentication, (request, response) => {
    const { id: bookId } = parseBody<{ id: string }>(writingRouteIdSchema, { id: request.params.bookId });
    const skills = listWritingBookSkills(request.auth!.user.id, bookId);
    if (!skills) throw new ApiError(404, "writing_book_not_found", "找不到此账户下的作品。");
    response.json({ skills });
  });

router.post("/writing/books/:bookId/skills", requireAuthentication, (request, response) => {
    const { id: bookId } = parseBody<{ id: string }>(writingRouteIdSchema, { id: request.params.bookId });
    const body = parseBody<{ title: string; description?: string; instructions: string; enabled?: boolean }>(Joi.object({
      title: Joi.string().trim().min(1).max(120).required(), description: Joi.string().trim().max(300).default(""),
      instructions: Joi.string().min(1).max(12000).required(), enabled: Joi.boolean().default(true)
    }).unknown(false), request.body);
    const skill = createWritingBookSkill(request.auth!.user.id, bookId, body);
    if (!skill) throw new ApiError(404, "writing_book_not_found", "找不到此账户下的作品。");
    response.status(201).json({ skill, workspace: getWritingWorkspace(request.auth!.user.id) });
  });

router.get("/writing/books/:bookId/skills/:skillId", requireAuthentication, (request, response) => {
    const { id: bookId } = parseBody<{ id: string }>(writingRouteIdSchema, { id: request.params.bookId });
    const { id: skillId } = parseBody<{ id: string }>(writingRouteIdSchema, { id: request.params.skillId });
    const skill = getWritingBookSkill(request.auth!.user.id, bookId, skillId);
    if (!skill) throw new ApiError(404, "writing_book_skill_not_found", "找不到此账户当前作品下的 Skill。");
    response.json({ skill });
  });

router.patch("/writing/books/:bookId/skills/:skillId", requireAuthentication, (request, response) => {
    const { id: bookId } = parseBody<{ id: string }>(writingRouteIdSchema, { id: request.params.bookId });
    const { id: skillId } = parseBody<{ id: string }>(writingRouteIdSchema, { id: request.params.skillId });
    const body = parseBody<{ title: string; description?: string; instructions: string; enabled: boolean }>(Joi.object({
      title: Joi.string().trim().min(1).max(120).required(), description: Joi.string().trim().max(300).default(""),
      instructions: Joi.string().min(1).max(12000).required(), enabled: Joi.boolean().required()
    }).unknown(false), request.body);
    const skill = updateWritingBookSkill(request.auth!.user.id, bookId, skillId, body);
    if (!skill) throw new ApiError(404, "writing_book_skill_not_found", "找不到此账户当前作品下的 Skill。");
    response.json({ skill, workspace: getWritingWorkspace(request.auth!.user.id) });
  });

router.delete("/writing/books/:bookId/skills/:skillId", requireAuthentication, (request, response) => {
    const { id: bookId } = parseBody<{ id: string }>(writingRouteIdSchema, { id: request.params.bookId });
    const { id: skillId } = parseBody<{ id: string }>(writingRouteIdSchema, { id: request.params.skillId });
    if (!deleteWritingBookSkill(request.auth!.user.id, bookId, skillId)) throw new ApiError(404, "writing_book_skill_not_found", "找不到此账户当前作品下的 Skill。");
    response.json({ workspace: getWritingWorkspace(request.auth!.user.id) });
  });

router.patch("/writing/books/:bookId/outline", requireAuthentication, (request, response) => {
    const { id: bookId } = parseBody<{ id: string }>(writingRouteIdSchema, { id: request.params.bookId });
    const body = parseBody<{ content: string }>(writingOutlineSchema, request.body);
    const outline = updateWritingBookOutline(request.auth!.user.id, bookId, body.content);
    if (!outline) throw new ApiError(404, "writing_book_not_found", "找不到此账户下的作品大纲。");
    response.json({ outline });
  });

router.post("/writing/books/:bookId/catalog", requireAuthentication, (request, response) => {
    const { id: bookId } = parseBody<{ id: string }>(writingRouteIdSchema, { id: request.params.bookId });
    const body = parseBody<{ kind: Parameters<typeof createWritingCatalogEntry>[2]["kind"]; title: string }>(writingCatalogEntryCreateSchema, request.body);
    const entry = createWritingCatalogEntry(request.auth!.user.id, bookId, body);
    if (!entry) throw new ApiError(404, "writing_book_not_found", "找不到此账户下的作品。");
    response.status(201).json({ entry });
  });

router.get("/writing/books/:bookId/catalog", requireAuthentication, (request, response) => {
    const { id: bookId } = parseBody<{ id: string }>(writingRouteIdSchema, { id: request.params.bookId });
    const query = parseBody<{ kind: typeof WRITING_CATALOG_KINDS[number]; search?: string; offset: number }>(Joi.object({
      kind: Joi.string().valid(...WRITING_CATALOG_KINDS).required(),
      search: Joi.string().trim().max(100).optional(),
      offset: Joi.number().integer().min(0).max(1_000_000).default(0)
    }).unknown(false), {
      kind: request.query.kind,
      ...(request.query.search === undefined ? {} : { search: request.query.search }),
      ...(request.query.offset === undefined ? {} : { offset: Number(request.query.offset) })
    });
    const page = listWritingCatalogEntries(request.auth!.user.id, bookId, query);
    if (!page) throw new ApiError(404, "writing_book_not_found", "找不到此账户下的作品。");
    response.json({ page });
  });

router.get("/writing/catalog/:entryId", requireAuthentication, (request, response) => {
    const { id: entryId } = parseBody<{ id: string }>(writingRouteIdSchema, { id: request.params.entryId });
    const entry = getWritingCatalogEntry(request.auth!.user.id, entryId);
    if (!entry) throw new ApiError(404, "writing_catalog_entry_not_found", "找不到此账户下的作品资料。");
    response.json({ entry });
  });

router.patch("/writing/catalog/:entryId", requireAuthentication, (request, response) => {
    const { id: entryId } = parseBody<{ id: string }>(writingRouteIdSchema, { id: request.params.entryId });
    const body = parseBody<{ title: string; content: string }>(writingCatalogEntrySchema, request.body);
    const entry = updateWritingCatalogEntry(request.auth!.user.id, entryId, body);
    if (!entry) throw new ApiError(404, "writing_catalog_entry_not_found", "找不到此账户下的作品资料。");
    response.json({ entry });
  });

router.delete("/writing/catalog/:entryId", requireAuthentication, (request, response) => {
    const { id: entryId } = parseBody<{ id: string }>(writingRouteIdSchema, { id: request.params.entryId });
    if (!deleteWritingCatalogEntry(request.auth!.user.id, entryId)) throw new ApiError(404, "writing_catalog_entry_not_found", "找不到此账户下的作品资料。");
    response.status(204).end();
  });

router.get("/writing/proposals/:proposalId", requireAuthentication, (request, response) => {
    const { id: proposalId } = parseBody<{ id: string }>(writingRouteIdSchema, { id: request.params.proposalId });
    const proposal = getWritingEditProposal(request.auth!.user.id, proposalId);
    if (!proposal) throw new ApiError(404, "writing_proposal_not_found", "找不到当前账户的写作提案。");
    response.json({ proposal });
  });

router.post("/writing/proposals/:proposalId/apply", requireAuthentication, (request, response) => {
    const { id: proposalId } = parseBody<{ id: string }>(writingRouteIdSchema, { id: request.params.proposalId });
    const proposal = resolveWritingEditProposal(request.auth!.user.id, proposalId, "apply");
    if (!proposal) throw new ApiError(404, "writing_proposal_not_found", "找不到当前账户的写作提案。");
    response.json({ proposal });
  });

router.post("/writing/proposals/:proposalId/reject", requireAuthentication, (request, response) => {
    const { id: proposalId } = parseBody<{ id: string }>(writingRouteIdSchema, { id: request.params.proposalId });
    const proposal = resolveWritingEditProposal(request.auth!.user.id, proposalId, "reject");
    if (!proposal) throw new ApiError(404, "writing_proposal_not_found", "找不到当前账户的写作提案。");
    response.json({ proposal });
  });

router.get("/writing/books/:bookId/outline/revisions", requireAuthentication, (request, response) => {
    const { id: bookId } = parseBody<{ id: string }>(writingRouteIdSchema, { id: request.params.bookId });
    const revisions = listWritingBookOutlineRevisions(request.auth!.user.id, bookId);
    if (!revisions) throw new ApiError(404, "writing_book_not_found", "找不到此账户下的作品大纲。");
    response.json({ revisions });
  });

router.post("/writing/books/:bookId/outline/revisions/:revisionId/restore", requireAuthentication, (request, response) => {
    const { id: bookId } = parseBody<{ id: string }>(writingRouteIdSchema, { id: request.params.bookId });
    const { id: revisionId } = parseBody<{ id: string }>(writingRouteIdSchema, { id: request.params.revisionId });
    const outline = restoreWritingBookOutlineRevision(request.auth!.user.id, bookId, revisionId);
    if (!outline) throw new ApiError(404, "writing_revision_not_found", "找不到此账户下的大纲修订记录。");
    response.json({ outline });
  });

router.delete("/writing/books/:bookId", requireAuthentication, (request, response) => {
    const { id: bookId } = parseBody<{ id: string }>(writingRouteIdSchema, { id: request.params.bookId });
    if (!deleteWritingBook(request.auth!.user.id, bookId)) throw new ApiError(404, "writing_book_not_found", "找不到此账户下的作品。");
    response.status(204).end();
  });

router.post("/writing/books/:bookId/volumes", requireAuthentication, (request, response) => {
    const { id: bookId } = parseBody<{ id: string }>(writingRouteIdSchema, { id: request.params.bookId });
    const body = parseBody<{ title: string }>(writingVolumeSchema, request.body);
    const workspace = createWritingVolume(request.auth!.user.id, bookId, body.title);
    if (!workspace) throw new ApiError(404, "writing_book_not_found", "找不到此账户下的作品。");
    response.status(201).json({ workspace });
  });

router.post("/writing/books/:bookId/chapters", requireAuthentication, (request, response) => {
    const { id: bookId } = parseBody<{ id: string }>(writingRouteIdSchema, { id: request.params.bookId });
    const body = parseBody<{ title: string; volumeId?: string }>(writingChapterTitleSchema, request.body);
    const workspace = createWritingChapter(request.auth!.user.id, bookId, body.title, body.volumeId);
    if (!workspace) throw new ApiError(404, "writing_location_not_found", "找不到此账户下的作品或卷。");
    response.status(201).json({ workspace });
  });

router.patch("/writing/chapters/:chapterId", requireAuthentication, (request, response) => {
    const { id: chapterId } = parseBody<{ id: string }>(writingRouteIdSchema, { id: request.params.chapterId });
    const body = parseBody<{ title: string; content: string }>(writingChapterSchema, request.body);
    const chapter = updateWritingChapter(request.auth!.user.id, chapterId, body);
    if (!chapter) throw new ApiError(404, "writing_chapter_not_found", "找不到此账户下的章节。");
    response.json({ chapter });
  });

router.delete("/writing/chapters/:chapterId", requireAuthentication, (request, response) => {
    const { id: chapterId } = parseBody<{ id: string }>(writingRouteIdSchema, { id: request.params.chapterId });
    const workspace = deleteWritingChapter(request.auth!.user.id, chapterId);
    if (!workspace) throw new ApiError(404, "writing_chapter_not_found", "找不到此账户下的章节。");
    response.json({ workspace });
  });

router.get("/writing/chapters/:chapterId/revisions", requireAuthentication, (request, response) => {
    const { id: chapterId } = parseBody<{ id: string }>(writingRouteIdSchema, { id: request.params.chapterId });
    const revisions = listWritingChapterRevisions(request.auth!.user.id, chapterId);
    if (!revisions) throw new ApiError(404, "writing_chapter_not_found", "找不到此账户下的章节。");
    response.json({ revisions });
  });

router.post("/writing/chapters/:chapterId/revisions/:revisionId/restore", requireAuthentication, (request, response) => {
    const { id: chapterId } = parseBody<{ id: string }>(writingRouteIdSchema, { id: request.params.chapterId });
    const { id: revisionId } = parseBody<{ id: string }>(writingRouteIdSchema, { id: request.params.revisionId });
    const chapter = restoreWritingChapterRevision(request.auth!.user.id, chapterId, revisionId);
    if (!chapter) throw new ApiError(404, "writing_revision_not_found", "找不到此账户下的修订记录。");
    response.json({ chapter });
  });
}

/** 将本控制器的路由层与当前插件生命周期绑定。 */
import type { Context } from "@deepseek-ai/cordis";
import "lfaa-api-gateway/src/index.js";
export const inject = ["apiGateway"];
export function apply(ctx: Context): void { ctx.apiGateway.register(ctx, "writing-controller", registerRoutes); }
