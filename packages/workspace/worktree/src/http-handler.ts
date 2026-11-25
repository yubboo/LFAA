// 为本机 Web 服务提供 /api/worktrees 工作树列出、创建、检查与删除接口；鉴权与内容类型由网关统一处理。
import type { IncomingMessage, ServerResponse } from "node:http";
import type { CreateWorktreeInput } from "../contract";
import type { WorktreeService } from "./worktree-service";

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

/** 处理工作树路由；未命中时返回 false，交给其他 Host 处理器。 */
export function createWorktreeHttpHandler(service: WorktreeService) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const rawUrl = req.url ?? "";
    const pathname = rawUrl.split("?")[0] ?? "";
    if (pathname !== "/api/worktrees" && !pathname.startsWith("/api/worktrees/")) return false;
    const method = (req.method ?? "GET").toUpperCase();

    try {
      const mergeMatch = /^\/api\/worktrees\/([^/]+)\/merge$/u.exec(pathname);
      if (method === "POST" && mergeMatch?.[1]) {
        const result = await service.merge(decodeURIComponent(mergeMatch[1]));
        if (!result) {
          sendJson(res, 404, { error: "工作树不存在。" });
          return true;
        }
        sendJson(res, 200, result);
        return true;
      }

      const mergePreviewMatch = /^\/api\/worktrees\/([^/]+)\/merge-preview$/u.exec(pathname);
      if (method === "POST" && mergePreviewMatch?.[1]) {
        const preview = await service.previewMerge(decodeURIComponent(mergePreviewMatch[1]));
        if (!preview) {
          sendJson(res, 404, { error: "工作树不存在。" });
          return true;
        }
        sendJson(res, 200, preview);
        return true;
      }

      const fileMatch = /^\/api\/worktrees\/([^/]+)\/file$/u.exec(pathname);
      if (method === "GET" && fileMatch?.[1]) {
        const requestedPath = new URL(rawUrl, "http://localhost").searchParams.get("path") ?? "";
        const file = await service.readFile(decodeURIComponent(fileMatch[1]), requestedPath);
        if (!file) {
          sendJson(res, 404, { error: "工作树不存在。" });
          return true;
        }
        sendJson(res, 200, file);
        return true;
      }

      const inspectMatch = /^\/api\/worktrees\/([^/]+)\/inspect$/u.exec(pathname);
      if (method === "GET" && inspectMatch?.[1]) {
        const subPath = new URL(rawUrl, "http://localhost").searchParams.get("path") ?? undefined;
        const inspection = await service.inspect(decodeURIComponent(inspectMatch[1]), subPath);
        if (!inspection) {
          sendJson(res, 404, { error: "工作树不存在。" });
          return true;
        }
        sendJson(res, 200, inspection);
        return true;
      }

      if (method === "POST" && pathname === "/api/worktrees/prune") {
        const removed = await service.prune();
        sendJson(res, 200, { removed });
        return true;
      }

      if (method === "GET" && pathname === "/api/worktrees/repository") {
        const projectId = new URL(rawUrl, "http://localhost").searchParams.get("projectId") ?? "";
        const info = await service.repositoryInfo(projectId);
        if (!info) {
          sendJson(res, 404, { error: "找不到项目或项目不是 Git 仓库。" });
          return true;
        }
        sendJson(res, 200, info);
        return true;
      }

      const itemMatch = /^\/api\/worktrees\/([^/]+)$/u.exec(pathname);
      if (method === "DELETE" && itemMatch?.[1]) {
        const search = new URL(rawUrl, "http://localhost").searchParams;
        const id = decodeURIComponent(itemMatch[1]);
        if (search.get("deleteBranch") === "1") {
          const result = await service.removeAndDeleteBranch(id);
          sendJson(res, result.removed ? 200 : 404, result);
          return true;
        }
        const removed = await service.remove(id, { force: search.get("force") === "1" });
        sendJson(res, removed ? 200 : 404, { removed });
        return true;
      }

      if (method === "GET" && pathname === "/api/worktrees") {
        const projectId = new URL(rawUrl, "http://localhost").searchParams.get("projectId") ?? undefined;
        const worktrees = await service.list(projectId);
        sendJson(res, 200, { worktrees });
        return true;
      }

      if (method === "POST" && pathname === "/api/worktrees") {
        const body = await readJsonBody(req);
        const input: CreateWorktreeInput = {
          projectId: typeof body.projectId === "string" ? body.projectId : "",
          branch: typeof body.branch === "string" ? body.branch : "",
          ...(typeof body.from === "string" ? { from: body.from } : {}),
        };
        const worktree = await service.create(input);
        sendJson(res, 201, { worktree });
        return true;
      }

      sendJson(res, 404, { error: "未找到工作树接口。" });
      return true;
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
      return true;
    }
  };
}