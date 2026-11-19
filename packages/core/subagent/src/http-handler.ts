// 提供 /api/subagents* 查询与中止接口，供右侧栏实时显示子智能体列表与执行详情。
import type { IncomingMessage, ServerResponse } from "node:http";
import type { SubagentService } from "./index";

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

export function createSubagentHttpHandler(service: SubagentService) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const urlObj = new URL(req.url ?? "/", "http://127.0.0.1");
    const pathname = urlObj.pathname;
    if (pathname !== "/api/subagents" && !pathname.startsWith("/api/subagents/")) return false;
    const method = (req.method ?? "GET").toUpperCase();

    try {
      if (method === "GET" && pathname === "/api/subagents") {
        const sessionId = urlObj.searchParams.get("sessionId") ?? undefined;
        sendJson(res, 200, { subagents: service.listSubagents(sessionId) });
        return true;
      }

      const stopMatch = /^\/api\/subagents\/([^/]+)\/stop$/u.exec(pathname);
      if (method === "POST" && stopMatch?.[1]) {
        const item = service.stopSubagent(decodeURIComponent(stopMatch[1]));
        sendJson(res, item ? 200 : 404, item ? { stopped: true, subagent: item } : { error: "未找到子智能体。" });
        return true;
      }

      const getMatch = /^\/api\/subagents\/([^/]+)$/u.exec(pathname);
      if (method === "GET" && getMatch?.[1]) {
        const item = service.getSubagent(decodeURIComponent(getMatch[1]));
        sendJson(res, item ? 200 : 404, item ? { subagent: item } : { error: "未找到子智能体。" });
        return true;
      }

      sendJson(res, 404, { error: "未找到子智能体接口路由。" });
      return true;
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
      return true;
    }
  };
}
