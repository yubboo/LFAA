// 为本机 Web 服务提供 /api/memory* HTTP 接口，用于读取、新增与清理长期记忆条目。
import type { IncomingMessage, ServerResponse } from "node:http";
import type { MemoryService } from "./index";

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

export function createMemoryHttpHandler(service: MemoryService) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const urlObj = new URL(req.url ?? "", "http://127.0.0.1");
    const pathname = urlObj.pathname;
    if (pathname !== "/api/memory" && !pathname.startsWith("/api/memory/")) return false;
    const method = (req.method ?? "GET").toUpperCase();

    try {
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
