// 统一回收站 HTTP 处理器：提供 /api/trash/* 列表/预览/恢复/彻底删除/清空接口，并拦截画布、项目、素材与资料库资产的默认 DELETE 请求转入 30 天回收站。
import { createReadStream, existsSync } from "node:fs";
import { readFile, rm, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { pipeline } from "node:stream/promises";
import type { Context } from "@deepseek-ai/cordis";
import {
  TrashStore,
  moveEntrySafe,
  resolveConflictPath,
  type TrashItemKind,
} from "../trash/trash-store";

const CANVAS_DELETE_RE = /^\/api\/canvas\/projects\/([^/]+)\/boards\/([^/]+)$/u;
const PROJECT_DELETE_RE = /^\/api\/workspace\/projects\/([^/]+)$/u;
const LIBRARY_DELETE_RE = /^\/api\/library\/([^/]+)$/u;
const TRASH_PREVIEW_RE = /^\/api\/trash\/([^/]+)\/preview$/u;

const VALID_KINDS = new Set<string>(["all", "media", "asset", "canvas", "project"]);

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) return {};
  const parsed = JSON.parse(text) as unknown;
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}

function isWithinRoot(target: string, root: string): boolean {
  const base = resolve(root);
  const full = resolve(target);
  const a = process.platform === "win32" ? base.toLowerCase() : base;
  const b = process.platform === "win32" ? full.toLowerCase() : full;
  return b === a || b.startsWith(a + sep);
}

/** 构造统一回收站与软删除拦截处理器。 */
export function createTrashHandler(deps: {
  context: Context;
  trashRoot: string;
  resolveMediaAllowedRoots: () => Promise<string[]>;
}) {
  const store = new TrashStore(deps.trashRoot);

  /** 按条目类型执行恢复并清理对应回收站目录。 */
  async function restoreOne(id: string): Promise<void> {
    const meta = await store.getMeta(id);
    if (!meta) throw new Error("回收站条目不存在或已过期。");

    if (meta.kind === "project") {
      const project = meta.origin.project as {
        id: string;
        name: string;
        rootPath: string;
        rootPaths?: string[];
        sectionId?: string | null;
        pinned?: boolean;
        trusted?: boolean;
        createdAt?: number;
        kind?: "workspace" | "canvas";
        canvasFolderId?: string | null;
      } | undefined;
      if (!project?.id || !project.rootPath) throw new Error("项目元数据缺失。");
      await deps.context.workspace.restoreProject(project);
      await store.purge(id);
      return;
    }

    if (meta.kind === "canvas") {
      const canvas = deps.context.get("canvas");
      if (!canvas) throw new Error("画布服务未启用。");
      const projectId = typeof meta.origin.projectId === "string" ? meta.origin.projectId : "";
      const canvasId = typeof meta.origin.canvasId === "string" ? meta.origin.canvasId : "";
      if (!projectId || !canvasId) throw new Error("画布元数据缺失。");
      // 若原项目当前不在活跃列表，尝试从回收站先一并还原原项目。
      const existingProject = await deps.context.workspace.getProject(projectId);
      if (!existingProject) {
        const trashedProjects = await store.list("project");
        const matched = trashedProjects.find((item) => {
          const rec = item.origin.project as { id?: string } | undefined;
          return rec?.id === projectId;
        });
        if (matched) {
          await restoreOne(matched.id);
        } else {
          throw new Error("原所属项目不存在，请先恢复原项目。");
        }
      }
      const srcBoard = join(store.payloadDir(id), "board");
      const destDir = canvas.store.boardDir(projectId, canvasId);
      const finalDest = existsSync(destDir)
        ? canvas.store.boardDir(projectId, `${canvasId}-${Date.now().toString(36)}`)
        : destDir;
      await moveEntrySafe(srcBoard, finalDest);
      await store.purge(id);
      return;
    }

    if (meta.kind === "media") {
      const filePath = typeof meta.origin.filePath === "string" ? meta.origin.filePath : "";
      const fileName = typeof meta.origin.fileName === "string" ? meta.origin.fileName : "";
      const hasSidecar = meta.origin.hasSidecar === true;
      if (!filePath || !fileName) throw new Error("素材元数据缺失。");
      const srcFile = join(store.payloadDir(id), fileName);
      if (!existsSync(srcFile)) throw new Error("素材文件已丢失。");
      const targetPath = resolveConflictPath(filePath);
      await moveEntrySafe(srcFile, targetPath);
      if (hasSidecar) {
        const srcSidecar = join(store.payloadDir(id), `${fileName}.json`);
        if (existsSync(srcSidecar)) {
          await moveEntrySafe(srcSidecar, `${targetPath}.json`).catch(() => {});
        }
      }
      await store.purge(id);
      return;
    }

    if (meta.kind === "asset") {
      const asset = meta.origin.asset as {
        title: string;
        fileName: string;
        category: "artifact" | "asset";
        mimeType?: string;
        summary?: string;
        tags?: string[];
        projectId?: string | null;
      } | undefined;
      if (!asset?.fileName) throw new Error("资产元数据缺失。");
      const content = await readFile(join(store.payloadDir(id), "content.txt"), "utf8");
      await deps.context.memory.saveLibraryAsset({
        title: asset.title,
        fileName: asset.fileName,
        content,
        category: asset.category,
        ...(asset.mimeType ? { mimeType: asset.mimeType } : {}),
        ...(asset.summary ? { summary: asset.summary } : {}),
        ...(Array.isArray(asset.tags) ? { tags: asset.tags } : {}),
        projectId: asset.projectId ?? null,
      });
      await store.purge(id);
    }
  }

  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const urlObj = new URL(req.url ?? "/", "http://127.0.0.1");
    const pathname = urlObj.pathname;
    const method = (req.method ?? "GET").toUpperCase();
    const permanent = urlObj.searchParams.get("permanent") === "1";

    // 1) 回收站管理接口 /api/trash*
    if (pathname === "/api/trash" && method === "GET") {
      const rawKind = urlObj.searchParams.get("kind") ?? "all";
      const projectKind = urlObj.searchParams.get("projectKind");
      const kind = (VALID_KINDS.has(rawKind) ? rawKind : "all") as TrashItemKind | "all";
      let items = await store.list(kind);
      if (projectKind === "canvas" || projectKind === "workspace") {
        items = items.filter((item) => {
          if (item.kind !== "project") return true;
          const rec = item.origin.project as { kind?: string } | undefined;
          const itemKind = rec?.kind === "canvas" ? "canvas" : "workspace";
          return itemKind === projectKind;
        });
      }
      sendJson(res, 200, { items, retentionDays: 30 });
      return true;
    }

    const previewMatch = TRASH_PREVIEW_RE.exec(pathname);
    if (previewMatch?.[1] && (method === "GET" || method === "HEAD")) {
      const resolved = await store.resolvePreview(decodeURIComponent(previewMatch[1]));
      if (!resolved) {
        sendJson(res, 404, { error: "预览图不存在。" });
        return true;
      }
      const info = await stat(resolved.file);
      res.writeHead(200, {
        "Content-Type": resolved.mime,
        "Content-Length": info.size,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      });
      if (method === "HEAD") res.end();
      else await pipeline(createReadStream(resolved.file), res);
      return true;
    }

    if (pathname === "/api/trash/restore" && method === "POST") {
      const body = await readJsonBody(req);
      const ids = Array.isArray(body.ids) ? body.ids.filter((v): v is string => typeof v === "string") : [];
      const restored: string[] = [];
      const failed: Array<{ id: string; reason: string }> = [];
      for (const id of ids) {
        try {
          await restoreOne(id);
          restored.push(id);
        } catch (error) {
          failed.push({ id, reason: error instanceof Error ? error.message : String(error) });
        }
      }
      sendJson(res, 200, { restored, failed });
      return true;
    }

    if (pathname === "/api/trash/purge" && method === "POST") {
      const body = await readJsonBody(req);
      const ids = Array.isArray(body.ids) ? body.ids.filter((v): v is string => typeof v === "string") : [];
      const purged: string[] = [];
      for (const id of ids) {
        if (await store.purge(id)) purged.push(id);
      }
      sendJson(res, 200, { purged });
      return true;
    }

    if (pathname === "/api/trash/empty" && method === "DELETE") {
      const rawKind = urlObj.searchParams.get("kind") ?? "all";
      const kind = (VALID_KINDS.has(rawKind) ? rawKind : "all") as TrashItemKind | "all";
      const count = await store.empty(kind);
      sendJson(res, 200, { purged: count });
      return true;
    }

    // 2) 软删除拦截：除非显式 ?permanent=1，否则将四类删除先移入统一回收站。
    if (method !== "DELETE" || permanent) return false;

    const canvasMatch = CANVAS_DELETE_RE.exec(pathname);
    if (canvasMatch?.[1] && canvasMatch[2]) {
      const canvas = deps.context.get("canvas");
      if (!canvas) return false;
      const projectId = decodeURIComponent(canvasMatch[1]);
      const canvasId = decodeURIComponent(canvasMatch[2]);
      const project = await deps.context.workspace.getProject(projectId);
      if (!project) return false;
      const boardDir = canvas.store.boardDir(projectId, canvasId);
      if (!existsSync(boardDir)) return false;
      const detail = await canvas.detail(boardDir).catch(() => null);
      const boardTitle = detail?.board.title || canvasId;
      const firstImage = detail?.assets.find((item) => item.mime.startsWith("image/"));
      const coverInfo = firstImage ? await canvas.store.asset(boardDir, firstImage.id).catch(() => null) : null;
      const coverRelPath = coverInfo ? relative(boardDir, coverInfo.file) : undefined;
      const trashed = await store.trashCanvasBoard({
        projectId,
        projectName: project.name,
        canvasId,
        boardTitle,
        boardDir,
        ...(coverRelPath && firstImage ? { coverRelPath, coverMime: firstImage.mime } : {}),
      });
      sendJson(res, 200, { ok: true, trashedId: trashed.id });
      return true;
    }

    const projectMatch = PROJECT_DELETE_RE.exec(pathname);
    if (projectMatch?.[1]) {
      const projectId = decodeURIComponent(projectMatch[1]);
      const project = await deps.context.workspace.getProject(projectId);
      if (!project) return false;
      const trashed = await store.trashProject({
        project: {
          id: project.id,
          name: project.name,
          rootPath: project.rootPath,
          rootPaths: project.rootPaths,
          sectionId: project.sectionId ?? null,
          pinned: project.pinned,
          trusted: project.trusted,
          createdAt: project.createdAt,
          kind: project.kind === "canvas" ? "canvas" : "workspace",
          canvasFolderId: project.canvasFolderId ?? null,
        },
      });
      await deps.context.workspace.removeProject(projectId);
      sendJson(res, 200, { removed: true, trashedId: trashed.id });
      return true;
    }

    if (pathname === "/api/media/file") {
      const raw = urlObj.searchParams.get("path")?.trim() ?? "";
      if (!raw) return false;
      const target = resolve(raw);
      const roots = [...(await deps.resolveMediaAllowedRoots().catch(() => [])), join(homedir(), ".lfaa", "media")];
      if (!roots.some((root) => isWithinRoot(target, root))) return false;
      if (!existsSync(target)) return false;
      const trashed = await store.trashMediaFile({ filePath: target });
      sendJson(res, 200, { deleted: true, trashedId: trashed.id });
      return true;
    }

    const libraryMatch = LIBRARY_DELETE_RE.exec(pathname);
    if (libraryMatch?.[1]) {
      const assetId = decodeURIComponent(libraryMatch[1]);
      const detail = await deps.context.memory.readLibraryAsset(assetId);
      if (!detail) return false;
      const trashed = await store.trashLibraryAsset({
        asset: {
          id: detail.item.id,
          title: detail.item.title,
          fileName: detail.item.fileName,
          category: detail.item.category,
          mimeType: detail.item.mimeType,
          ...(detail.item.summary ? { summary: detail.item.summary } : {}),
          tags: detail.item.tags,
          projectId: detail.item.projectId,
          sizeBytes: detail.item.sizeBytes,
        },
        content: detail.content,
      });
      await deps.context.memory.removeLibraryAsset(assetId);
      sendJson(res, 200, { removed: true, trashedId: trashed.id });
      return true;
    }

    return false;
  };
}

// 供测试直接清理临时目录用。
export { rm };
