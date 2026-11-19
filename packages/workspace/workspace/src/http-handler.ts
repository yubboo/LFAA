// 为仅监听本机 127.0.0.1 的 Web 开发服务提供 /api/workspace/* HTTP 中间件桥接。
import type { IncomingMessage, ServerResponse } from "node:http";
import type { WorkspaceService } from "./index";

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

// 处理工作区项目读写、默认路径解析、原生文件夹选择与目录查看请求。
export function createWorkspaceHttpHandler(service: WorkspaceService) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const rawUrl = req.url ?? "";
    const pathname = rawUrl.split("?")[0] ?? "";
    if (!pathname.startsWith("/api/workspace/")) return false;

    const method = (req.method ?? "GET").toUpperCase();

    try {
      if (method === "GET" && pathname === "/api/workspace/projects") {
        const projects = await service.listProjects();
        sendJson(res, 200, { projects });
        return true;
      }

      if (method === "POST" && pathname === "/api/workspace/projects/resolve-path") {
        const body = await readJsonBody(req);
        const name = typeof body.name === "string" ? body.name : "";
        const resolved = await service.resolveDefaultProjectPath(name);
        sendJson(res, 200, resolved);
        return true;
      }

      if (method === "POST" && pathname === "/api/workspace/projects") {
        const body = await readJsonBody(req);
        const name = typeof body.name === "string" ? body.name : "";
        const rootPath = typeof body.rootPath === "string" ? body.rootPath : undefined;
        const trusted = body.trusted === true;
        const project = await service.createProject({
          name,
          ...(rootPath !== undefined ? { rootPath } : {}),
          trusted,
        });
        sendJson(res, 201, { project });
        return true;
      }

      if (method === "POST" && pathname === "/api/workspace/pick-folder") {
        const result = await service.pickLocalFolder();
        sendJson(res, 200, result);
        return true;
      }

      if (method === "POST" && pathname === "/api/workspace/validate-folder") {
        const body = await readJsonBody(req);
        const pathValue = typeof body.path === "string" ? body.path : "";
        const validated = await service.validateLocalFolder(pathValue);
        sendJson(res, 200, validated);
        return true;
      }

      const fileMatch = pathname.match(/^\/api\/workspace\/projects\/([^/]+)\/file$/u);
      if (method === "GET" && fileMatch?.[1]) {
        const queryStart = rawUrl.indexOf("?");
        const requestedPath = queryStart >= 0
          ? new URLSearchParams(rawUrl.slice(queryStart + 1)).get("path") ?? ""
          : "";
        const fileData = await service.readProjectFile(decodeURIComponent(fileMatch[1]), requestedPath);
        if (!fileData) {
          sendJson(res, 404, { error: "项目不存在。" });
          return true;
        }
        sendJson(res, 200, fileData);
        return true;
      }

      const inspectMatch = pathname.match(/^\/api\/workspace\/projects\/([^/]+)\/inspect$/u);
      if (method === "GET" && inspectMatch?.[1]) {
        const queryStart = rawUrl.indexOf("?");
        const requestedPath = queryStart >= 0
          ? new URLSearchParams(rawUrl.slice(queryStart + 1)).get("path") ?? undefined
          : undefined;
        const inspection = await service.inspectProject(decodeURIComponent(inspectMatch[1]), requestedPath);
        if (!inspection) {
          sendJson(res, 404, { error: "项目不存在。" });
          return true;
        }
        sendJson(res, 200, inspection);
        return true;
      }

      const revealFileMatch = pathname.match(/^\/api\/workspace\/projects\/([^/]+)\/reveal-file$/u);
      if (method === "POST" && revealFileMatch?.[1]) {
        const body = await readJsonBody(req);
        const pathValue = typeof body.path === "string" ? body.path : "";
        const result = await service.revealProjectFileInExplorer(decodeURIComponent(revealFileMatch[1]), pathValue);
        sendJson(res, 200, result);
        return true;
      }

      const openExplorerMatch = pathname.match(/^\/api\/workspace\/projects\/([^/]+)\/open-explorer$/u);
      if (method === "POST" && openExplorerMatch?.[1]) {
        const result = await service.openProjectFolderInExplorer(decodeURIComponent(openExplorerMatch[1]));
        sendJson(res, 200, result);
        return true;
      }

      const itemMatch = pathname.match(/^\/api\/workspace\/projects\/([^/]+)$/u);
      if (method === "PATCH" && itemMatch?.[1]) {
        const body = await readJsonBody(req);
        const rawRootPaths = Array.isArray(body.rootPaths)
          ? body.rootPaths.filter((entry): entry is string => typeof entry === "string")
          : undefined;
        const updated = await service.updateProject(decodeURIComponent(itemMatch[1]), {
          ...(typeof body.name === "string" ? { name: body.name } : {}),
          ...(rawRootPaths !== undefined ? { rootPaths: rawRootPaths } : {}),
          ...(typeof body.pinned === "boolean" ? { pinned: body.pinned } : {}),
          ...(body.sectionId === null || typeof body.sectionId === "string" ? { sectionId: body.sectionId } : {}),
        });
        if (!updated) {
          sendJson(res, 404, { error: "项目不存在。" });
          return true;
        }
        sendJson(res, 200, { project: updated });
        return true;
      }

      if (method === "DELETE" && itemMatch?.[1]) {
        const removed = await service.removeProject(decodeURIComponent(itemMatch[1]));
        sendJson(res, removed ? 200 : 404, { removed });
        return true;
      }

      sendJson(res, 404, { error: "未找到工作区接口。" });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, 400, { error: message });
      return true;
    }
  };
}
