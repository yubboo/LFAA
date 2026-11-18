// 为本机 Web 服务提供 /api/memory*、/api/library* 与 /api/storage* HTTP 接口，支持记忆、资产库与无损存储迁移。
import { spawn } from "node:child_process";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { MemoryService } from "./index";

export interface MemoryHttpOptions {
  resolveActiveProjectRoot?: (projectId?: string | null) => Promise<string | undefined>;
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
}

export function createMemoryHttpHandler(service: MemoryService, options: MemoryHttpOptions = {}) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const urlObj = new URL(req.url ?? "", "http://127.0.0.1");
    const pathname = urlObj.pathname;
    const isMemoryRoute = pathname === "/api/memory" || pathname.startsWith("/api/memory/");
    const isLibraryRoute = pathname === "/api/library" || pathname.startsWith("/api/library/");
    const isStorageRoute = pathname === "/api/storage" || pathname.startsWith("/api/storage/");
    if (!isMemoryRoute && !isLibraryRoute && !isStorageRoute) return false;
    const method = (req.method ?? "GET").toUpperCase();

    try {
      if (isLibraryRoute) {
        if (method === "GET" && pathname === "/api/library") {
          const categoryRaw = urlObj.searchParams.get("category");
          const category = categoryRaw === "artifact" || categoryRaw === "asset" ? categoryRaw : undefined;
          const projectId = urlObj.searchParams.get("projectId");
          const query = urlObj.searchParams.get("q") ?? undefined;
          const [assets, memories, storage] = await Promise.all([
            service.listLibraryAssets({
              ...(category ? { category } : {}),
              ...(projectId ? { projectId } : {}),
              ...(query ? { query } : {}),
            }),
            service.listLongTermMemories({
              ...(projectId ? { projectId } : {}),
              ...(query ? { query } : {}),
            }),
            service.getStorageState(),
          ]);
          sendJson(res, 200, { assets, memories, dataRoot: storage.dataRoot });
          return true;
        }

        if (method === "POST" && pathname === "/api/library") {
          const body = await readJsonBody(req);
          const item = await service.saveLibraryAsset({
            category: body.category === "artifact" ? "artifact" : "asset",
            title: typeof body.title === "string" ? body.title : "",
            fileName: typeof body.fileName === "string" ? body.fileName : "asset.txt",
            content: typeof body.content === "string" ? body.content : "",
            encoding: body.encoding === "base64" ? "base64" : "utf8",
            ...(typeof body.mimeType === "string" ? { mimeType: body.mimeType } : {}),
            ...(typeof body.summary === "string" ? { summary: body.summary } : {}),
            ...(Array.isArray(body.tags) ? { tags: body.tags.filter((t): t is string => typeof t === "string") } : {}),
            projectId: typeof body.projectId === "string" ? body.projectId : null,
          });
          sendJson(res, 201, { item });
          return true;
        }

        if (method === "GET" && pathname.startsWith("/api/library/")) {
          const id = decodeURIComponent(pathname.slice("/api/library/".length));
          const detail = await service.readLibraryAsset(id);
          if (!detail) {
            sendJson(res, 404, { error: "资产条目不存在。" });
            return true;
          }
          sendJson(res, 200, detail);
          return true;
        }

        if (method === "DELETE" && pathname.startsWith("/api/library/")) {
          const id = decodeURIComponent(pathname.slice("/api/library/".length));
          const removed = await service.removeLibraryAsset(id);
          if (!removed) {
            sendJson(res, 404, { error: "资产条目不存在。" });
            return true;
          }
          sendJson(res, 200, { removed: true });
          return true;
        }
      }

      if (isStorageRoute) {
        if (method === "GET" && pathname === "/api/storage") {
          const projectId = urlObj.searchParams.get("projectId");
          const projectRoot = options.resolveActiveProjectRoot
            ? await options.resolveActiveProjectRoot(projectId)
            : undefined;
          const [state, stats] = await Promise.all([
            service.getStorageState(projectRoot),
            service.getStorageStats(),
          ]);
          sendJson(res, 200, { state, stats });
          return true;
        }

        if (method === "POST" && pathname === "/api/storage/migrate") {
          const body = await readJsonBody(req);
          const mode = body.mode === "project" || body.mode === "custom" ? body.mode : "default";
          const projectId = typeof body.projectId === "string" ? body.projectId : null;
          const projectRoot = options.resolveActiveProjectRoot
            ? await options.resolveActiveProjectRoot(projectId)
            : undefined;
          const currentState = await service.getStorageState(projectRoot);
          const targetPath = mode === "default"
            ? currentState.defaultDataRoot
            : mode === "project"
              ? currentState.recommendedProjectDataRoot
              : (typeof body.targetPath === "string" ? body.targetPath : "");
          const result = await service.migrateStorage({ targetPath, mode, projectRoot });
          sendJson(res, 200, result);
          return true;
        }

        if (method === "POST" && pathname === "/api/storage/open-explorer") {
          const state = await service.getStorageState();
          if (process.platform === "win32") {
            const child = spawn("explorer.exe", [state.dataRoot], {
              detached: true,
              stdio: "ignore",
              windowsHide: false,
            });
            child.unref();
            sendJson(res, 200, { opened: true, path: state.dataRoot });
          } else {
            sendJson(res, 200, { opened: false, path: state.dataRoot, error: "仅 Windows 支持打开资源管理器。" });
          }
          return true;
        }
      }
      if (method === "GET" && pathname === "/api/memory") {
        const projectId = urlObj.searchParams.get("projectId");
        const query = urlObj.searchParams.get("q") ?? undefined;
        const memories = await service.listLongTermMemories({
          ...(projectId ? { projectId } : {}),
          ...(query ? { query } : {}),
        });
        sendJson(res, 200, { memories });
        return true;
      }

      if (method === "POST" && pathname === "/api/memory") {
        const body = await readJsonBody(req);
        const entry = await service.addMemory({
          scope: body.scope === "project" ? "project" : "global",
          projectId: typeof body.projectId === "string" ? body.projectId : null,
          content: typeof body.content === "string" ? body.content : "",
          ...(Array.isArray(body.tags)
            ? { tags: body.tags.filter((t): t is string => typeof t === "string") }
            : {}),
        });
        sendJson(res, 201, { entry });
        return true;
      }

      if (method === "DELETE" && pathname.startsWith("/api/memory/")) {
        const memoryId = decodeURIComponent(pathname.slice("/api/memory/".length));
        const removed = await service.removeMemory(memoryId);
        if (!removed) {
          sendJson(res, 404, { error: "记忆条目不存在。" });
          return true;
        }
        sendJson(res, 200, { removed: true });
        return true;
      }

      sendJson(res, 404, { error: "未找到记忆接口路由。" });
      return true;
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
      return true;
    }
  };
}
