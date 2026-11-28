// 统一回收站 TrashStore 回归测试：覆盖软删除、30 天自动清理、预览解析、彻底删除与清空。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Context } from "@deepseek-ai/cordis";
import { CanvasService } from "@lfaa/canvas";
import { WorkspaceService } from "@lfaa/workspace";
import { createTrashHandler } from "../src/handlers/handlers-trash";
import { TRASH_RETENTION_MS, TrashStore, resolveConflictPath } from "../src/trash/trash-store";

function mockRequest(method: string, url: string, body?: Record<string, unknown>): IncomingMessage {
  const payload = body ? Buffer.from(JSON.stringify(body)) : Buffer.alloc(0);
  return {
    method,
    url,
    async *[Symbol.asyncIterator]() {
      if (payload.length > 0) yield payload;
    },
  } as unknown as IncomingMessage;
}

function mockResponse(): { res: ServerResponse; status: () => number; json: () => Record<string, unknown> } {
  let statusCode = 200;
  let body = "";
  const res = {
    get statusCode() { return statusCode; },
    set statusCode(value: number) { statusCode = value; },
    writeHead(code: number) { statusCode = code; return this; },
    setHeader() {},
    end(chunk?: string | Buffer) {
      body = typeof chunk === "string" ? chunk : chunk ? chunk.toString("utf8") : "";
    },
  } as unknown as ServerResponse;
  return {
    res,
    status: () => statusCode,
    json: () => JSON.parse(body || "{}") as Record<string, unknown>,
  };
}

describe("TrashStore", () => {
  it("preserves payloads whose metadata is pending, corrupt, or incomplete during cleanup", async (t) => {
    const root = await mkdtemp(join(tmpdir(), "lfaa-trash-pending-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const store = new TrashStore(join(root, "trash"));
    const now = 1_700_000_000_000;
    const item = await store.trashProject({
      project: { id: "expired", name: "Expired project", rootPath: join(root, "workspace") },
      now: now - TRASH_RETENTION_MS,
    });

    for (const id of ["pending", "corrupt", "incomplete"]) {
      await mkdir(store.payloadDir(id), { recursive: true });
      await writeFile(join(store.payloadDir(id), "content.txt"), id, "utf8");
    }
    await writeFile(join(store.itemDir("corrupt"), "meta.json"), "{", "utf8");
    await writeFile(join(store.itemDir("incomplete"), "meta.json"), '{"id":"incomplete","expiresAt":null}', "utf8");

    assert.equal(await store.purgeExpired(now), 1);
    assert.equal(await store.getMeta(item.id), null);
    assert.deepEqual(await store.list("all", now), []);
    for (const id of ["pending", "corrupt", "incomplete"]) {
      assert.equal(await readFile(join(store.payloadDir(id), "content.txt"), "utf8"), id);
    }
  });

  it("soft-deletes canvas board, media file, project, and asset, then purges expired items", async () => {
    const root = await mkdtemp(join(tmpdir(), "lfaa-trash-test-"));
    try {
      const store = new TrashStore(join(root, "trash"));
      const now = 1_700_000_000_000;

      // 1. 软删除画布目录
      const boardDir = join(root, "boards", "b1");
      await mkdir(join(boardDir, "assets"), { recursive: true });
      await writeFile(join(boardDir, "board.json"), JSON.stringify({ title: "画布 2" }), "utf8");
      await writeFile(join(boardDir, "assets", "a1.png"), Buffer.from([137, 80, 78, 71]));
      const canvasMeta = await store.trashCanvasBoard({
        projectId: "proj-1",
        projectName: "未命名项目",
        canvasId: "b1",
        boardTitle: "画布 2",
        boardDir,
        coverRelPath: join("assets", "a1.png"),
        coverMime: "image/png",
        now,
      });
      assert.equal(existsSync(boardDir), false);
      const preview = await store.resolvePreview(canvasMeta.id);
      assert.ok(preview && preview.mime === "image/png");

      // 2. 软删除素材文件（含 sidecar .json）
      const mediaFile = join(root, "media", "demo.png");
      await mkdir(join(root, "media"), { recursive: true });
      await writeFile(mediaFile, Buffer.from([1, 2, 3]));
      await writeFile(`${mediaFile}.json`, JSON.stringify({ prompt: "cat" }), "utf8");
      const mediaMeta = await store.trashMediaFile({ filePath: mediaFile, now: now + 1000 });
      assert.equal(existsSync(mediaFile), false);
      assert.equal(existsSync(`${mediaFile}.json`), false);

      // 3. 软删除项目与资料库资产
      const projectMeta = await store.trashProject({
        project: { id: "proj-1", name: "未命名项目", rootPath: join(root, "workspace-code") },
        now: now + 2000,
      });
      const assetMeta = await store.trashLibraryAsset({
        asset: {
          id: "asset-1",
          title: "脚本大纲",
          fileName: "outline.md",
          category: "artifact",
          mimeType: "text/markdown",
          tags: ["script"],
          projectId: null,
        },
        content: "# 大纲",
        now: now + 3000,
      });

      const listAll = await store.list("all", now + 4000);
      assert.equal(listAll.length, 4);
      assert.equal(listAll[0]?.id, assetMeta.id);
      assert.equal(listAll[0]?.remainingDays, 30);

      const listCanvas = await store.list("canvas", now + 4000);
      assert.equal(listCanvas.length, 1);
      assert.equal(listCanvas[0]?.originLabel, "未命名项目");

      // 4. 手动彻底删除单条
      assert.equal(await store.purge(projectMeta.id), true);
      assert.equal((await store.list("all", now + 4000)).length, 3);

      // 5. 超过 30 天自动清理
      const after31Days = await store.list("all", now + TRASH_RETENTION_MS + 10_000);
      assert.equal(after31Days.length, 0);
      assert.equal(await store.getMeta(mediaMeta.id), null);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("generates conflict-free restored paths when target file already exists", async () => {
    const root = await mkdtemp(join(tmpdir(), "lfaa-trash-conflict-"));
    try {
      const target = join(root, "shot.png");
      await writeFile(target, "a", "utf8");
      const next = resolveConflictPath(target);
      assert.notEqual(next, target);
      assert.match(next, /shot \(恢复\)\.png$/u);
      await writeFile(next, "b", "utf8");
      const content = await readFile(next, "utf8");
      assert.equal(content, "b");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("soft-deletes canvas project via HTTP handler, lists under projectKind=canvas, and restores with canvas kind", async () => {
    const root = await mkdtemp(join(tmpdir(), "lfaa-trash-http-"));
    const documentsDir = join(root, "Documents");
    const storeFilePath = join(root, "projects.json");
    const trashRoot = join(root, "trash");
    const ctx = new Context();
    try {
      const workspace = new WorkspaceService(ctx, { documentsDir, storeFilePath });
      const canvasProj = await workspace.createProject({ name: "短剧项目", trusted: true, kind: "canvas" });
      const codeProj = await workspace.createProject({ name: "代码项目", trusted: true, kind: "workspace" });
      const handler = createTrashHandler({
        context: ctx,
        trashRoot,
        resolveMediaAllowedRoots: async () => [],
      });

      // 软删除画布项目
      const delCanvas = mockResponse();
      const handledCanvas = await handler(mockRequest("DELETE", `/api/workspace/projects/${encodeURIComponent(canvasProj.id)}`), delCanvas.res);
      assert.equal(handledCanvas, true);
      assert.equal(delCanvas.status(), 200);
      const trashedId = delCanvas.json().trashedId as string;
      assert.ok(trashedId);

      // 软删除代码项目
      const delCode = mockResponse();
      await handler(mockRequest("DELETE", `/api/workspace/projects/${encodeURIComponent(codeProj.id)}`), delCode.res);
      assert.equal(delCode.status(), 200);

      // 当前项目列表不应包含已软删的两个项目（即使磁盘目录还在，也不应被 syncDefaultProjectDir 重新扫回）
      const activeAfterDelete = await workspace.listProjects();
      assert.equal(activeAfterDelete.some((item) => item.id === canvasProj.id), false);
      assert.equal(activeAfterDelete.some((item) => item.id === codeProj.id), false);

      // 无限画布回收站接口应仅列出画布项目，不混入代码项目
      const listRes = mockResponse();
      await handler(mockRequest("GET", "/api/trash?kind=all&projectKind=canvas"), listRes.res);
      assert.equal(listRes.status(), 200);
      const items = listRes.json().items as Array<{ id: string; title: string }>;
      assert.equal(items.length, 1);
      assert.equal(items[0]?.id, trashedId);
      assert.equal(items[0]?.title, "短剧项目");

      // 恢复后原项目重新回到活跃列表且保留 kind === "canvas"
      const restoreRes = mockResponse();
      await handler(mockRequest("POST", "/api/trash/restore", { ids: [trashedId] }), restoreRes.res);
      assert.equal(restoreRes.status(), 200);
      assert.deepEqual(restoreRes.json().restored, [trashedId]);
      const activeAfterRestore = await workspace.listProjects();
      const restored = activeAfterRestore.find((item) => item.id === canvasProj.id);
      assert.ok(restored);
      assert.equal(restored.kind, "canvas");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("trashes 0-board default-workspace canvas into recycle bin and isolates restore flag from other projects", async () => {
    const root = await mkdtemp(join(tmpdir(), "lfaa-trash-default-canvas-"));
    const documentsDir = join(root, "Documents");
    const storeFilePath = join(root, "projects.json");
    const trashRoot = join(root, "trash");
    const canvasRoot = join(root, "canvas");
    const ctx = new Context();
    try {
      const workspace = new WorkspaceService(ctx, { documentsDir, storeFilePath });
      // CanvasService injects llm, provide a minimal stub on ctx for construction
      (ctx as unknown as { llm: unknown }).llm = {};
      new CanvasService(ctx, { root: canvasRoot, mediaRoot: root });
      const listed = await workspace.listProjects();
      const defaultWs = listed.find((item) => item.isDefault);
      assert.ok(defaultWs);
      const otherCanvasProj = await workspace.createProject({ name: "短剧", trusted: true, kind: "canvas" });

      const handler = createTrashHandler({
        context: ctx,
        trashRoot,
        resolveMediaAllowedRoots: async () => [],
      });

      // 1) 删除 0 张画布的默认工作区画布 → 回收站应出现「默认工作区画布」，且默认工作区本身仍留在活跃项目列表
      const delDefault = mockResponse();
      const handled = await handler(mockRequest("DELETE", `/api/canvas/projects/${encodeURIComponent(defaultWs.id)}`), delDefault.res);
      assert.equal(handled, true);
      assert.equal(delDefault.status(), 200);
      const defaultTrashedId = delDefault.json().trashedId as string;
      assert.ok(defaultTrashedId);
      assert.ok((await workspace.listProjects()).some((item) => item.id === defaultWs.id));

      // 2) 删除另一个画布项目「短剧」
      const delOther = mockResponse();
      await handler(mockRequest("DELETE", `/api/workspace/projects/${encodeURIComponent(otherCanvasProj.id)}`), delOther.res);
      const otherTrashedId = delOther.json().trashedId as string;
      assert.ok(otherTrashedId);

      const listRes = mockResponse();
      await handler(mockRequest("GET", "/api/trash?kind=all&projectKind=canvas"), listRes.res);
      const items = listRes.json().items as Array<{ id: string; title: string }>;
      assert.equal(items.some((i) => i.id === defaultTrashedId && i.title === "默认工作区画布"), true);
      assert.equal(items.some((i) => i.id === otherTrashedId && i.title === "短剧"), true);

      // 3) 仅恢复「短剧」→ restoredDefaultCanvas 必须为 false，不得意外复活默认工作区画布
      const restoreOther = mockResponse();
      await handler(mockRequest("POST", "/api/trash/restore", { ids: [otherTrashedId] }), restoreOther.res);
      assert.equal(restoreOther.status(), 200);
      assert.equal(restoreOther.json().restoredDefaultCanvas, false);

      // 4) 再单独恢复「默认工作区画布」→ restoredDefaultCanvas 为 true，且回收站清空
      const restoreDefault = mockResponse();
      await handler(mockRequest("POST", "/api/trash/restore", { ids: [defaultTrashedId] }), restoreDefault.res);
      assert.equal(restoreDefault.status(), 200);
      assert.equal(restoreDefault.json().restoredDefaultCanvas, true);
      const afterList = mockResponse();
      await handler(mockRequest("GET", "/api/trash?kind=all&projectKind=canvas"), afterList.res);
      assert.equal((afterList.json().items as unknown[]).length, 0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("removes canvas project folder under lfaa/ on permanent purge while keeping code project folder intact", async () => {
    const root = await mkdtemp(join(tmpdir(), "lfaa-trash-purge-disk-"));
    const documentsDir = join(root, "Documents");
    const storeFilePath = join(root, "projects.json");
    const trashRoot = join(root, "trash");
    const ctx = new Context();
    try {
      const workspace = new WorkspaceService(ctx, { documentsDir, storeFilePath });
      const canvasProj = await workspace.createProject({ name: "待彻底删除短剧", trusted: true, kind: "canvas" });
      const codeProj = await workspace.createProject({ name: "保留代码目录", trusted: true, kind: "workspace" });
      const handler = createTrashHandler({
        context: ctx,
        trashRoot,
        resolveMediaAllowedRoots: async () => [],
      });

      const delCanvas = mockResponse();
      await handler(mockRequest("DELETE", `/api/workspace/projects/${encodeURIComponent(canvasProj.id)}`), delCanvas.res);
      const canvasTrashId = delCanvas.json().trashedId as string;

      const delCode = mockResponse();
      await handler(mockRequest("DELETE", `/api/workspace/projects/${encodeURIComponent(codeProj.id)}`), delCode.res);
      const codeTrashId = delCode.json().trashedId as string;

      // 软删除阶段两个目录都在磁盘保留
      assert.equal(existsSync(canvasProj.rootPath), true);
      assert.equal(existsSync(codeProj.rootPath), true);

      // 彻底删除后：画布项目对应文件夹被一并删除，普通代码项目文件夹绝不被删除
      const purgeRes = mockResponse();
      await handler(mockRequest("POST", "/api/trash/purge", { ids: [canvasTrashId, codeTrashId] }), purgeRes.res);
      assert.equal(purgeRes.status(), 200);
      assert.deepEqual(purgeRes.json().purged, [canvasTrashId, codeTrashId]);
      assert.equal(existsSync(canvasProj.rootPath), false);
      assert.equal(existsSync(codeProj.rootPath), true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
