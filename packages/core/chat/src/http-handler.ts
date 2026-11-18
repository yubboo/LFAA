// 为本机 Web 服务提供 /api/chat/* 聊天会话 CRUD 与项目聊天数统计接口。
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ChatService } from "./index";

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

export function createChatHttpHandler(service: ChatService) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const urlObj = new URL(req.url ?? "", "http://127.0.0.1");
    const pathname = urlObj.pathname;
    if (!pathname.startsWith("/api/chat/")) return false;
    const method = (req.method ?? "GET").toUpperCase();

    try {
      if (method === "GET" && pathname === "/api/chat/sessions") {
        const includeArchived = urlObj.searchParams.get("includeArchived") === "1";
        const projectId = urlObj.searchParams.get("projectId");
        const sessions = await service.listSessions({
          includeArchived,
          ...(projectId ? { projectId } : {}),
        });
        const countsByProject = await service.countByProject(false);
        sendJson(res, 200, { sessions, countsByProject });
        return true;
      }

      if (method === "POST" && pathname === "/api/chat/sessions") {
        const body = await readJsonBody(req);
        const session = await service.createSession({
          ...(typeof body.title === "string" ? { title: body.title } : {}),
          projectId: typeof body.projectId === "string" ? body.projectId : null,
          sectionId: typeof body.sectionId === "string" ? body.sectionId : null,
        });
        sendJson(res, 201, { session });
        return true;
      }

      if (pathname.startsWith("/api/chat/sessions/")) {
        const sessionId = decodeURIComponent(pathname.slice("/api/chat/sessions/".length));
        if (method === "GET") {
          const session = await service.getSession(sessionId);
          if (!session) {
            sendJson(res, 404, { error: "聊天会话不存在。" });
            return true;
          }
          sendJson(res, 200, { session });
          return true;
        }
        if (method === "PATCH") {
          const body = await readJsonBody(req);
          const session = await service.updateSession(sessionId, {
            ...(typeof body.title === "string" ? { title: body.title } : {}),
            ...(body.projectId !== undefined
              ? { projectId: typeof body.projectId === "string" ? body.projectId : null }
              : {}),
            ...(typeof body.pinned === "boolean" ? { pinned: body.pinned } : {}),
            ...(typeof body.archived === "boolean" ? { archived: body.archived } : {}),
          });
          if (!session) {
            sendJson(res, 404, { error: "聊天会话不存在。" });
            return true;
          }
          sendJson(res, 200, { session });
          return true;
        }
        if (method === "DELETE") {
          const removed = await service.deleteSession(sessionId);
          if (!removed) {
            sendJson(res, 404, { error: "聊天会话不存在。" });
            return true;
          }
          sendJson(res, 200, { removed: true });
          return true;
        }
      }

      sendJson(res, 404, { error: "未找到聊天接口路由。" });
      return true;
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
      return true;
    }
  };
}
