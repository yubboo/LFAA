/** 功能：登记 writing-controller 的现有接口。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。 */
import { Router } from "express";
import { ApiError } from "lfaa-util-values/src/http-error.js";
import { requireAuthentication } from "lfaa-authorization/src/middleware.js";
import type { AiPluginHost } from "lfaa-app-boot/src/ai-host.js";
import type { MinecraftRealtimePublisher } from "lfaa-api-remotes/src/socket-server.js";
import { createWritingBook, createWritingCatalogEntry, createWritingChapter, createWritingVolume, deleteWritingBook, deleteWritingCatalogEntry, deleteWritingChapter, getWritingCatalogEntry, listWritingBookOutlineRevisions, getWritingWorkspace, listWritingChapterRevisions, renameWritingBook, restoreWritingChapterRevision, restoreWritingBookOutlineRevision, setActiveWritingLocation, updateWritingBookOutline, updateWritingCatalogEntry, updateWritingChapter } from "lfaa-document-writing/src/service.js";
import { parseBody, writingBookSchema, writingVolumeSchema, writingChapterSchema, writingOutlineSchema, writingChapterTitleSchema, writingCatalogEntryCreateSchema, writingCatalogEntrySchema, writingSelectionSchema, writingRouteIdSchema } from "lfaa-api-remotes/src/route-contracts.js";
export function registerRoutes(router: Router, _aiPluginHost: AiPluginHost, _realtime: MinecraftRealtimePublisher): void {

router.get("/writing/workspace", requireAuthentication, (request, response) => {
    response.json({ workspace: getWritingWorkspace(request.auth!.user.id) });
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
