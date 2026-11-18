// 为 Web 开发服务提供 /api/workspace/sections* HTTP RPC 路由桥接。
import type { IncomingMessage, ServerResponse } from "node:http";
import type { SectionsService } from "./index";

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

// 处理工作区分区的查询、创建、重命名与删除请求。
export function createSectionsHttpHandler(service: SectionsService) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const rawUrl = req.url ?? "";
    const pathname = rawUrl.split("?")[0] ?? "";
    if (!pathname.startsWith("/api/workspace/sections")) return false;

    const method = (req.method ?? "GET").toUpperCase();

    try {
      if (method === "GET" && pathname === "/api/workspace/sections") {
        const sections = await service.listSections();
        sendJson(res, 200, { sections });
        return true;
      }

      if (method === "POST" && pathname === "/api/workspace/sections") {
        const body = await readJsonBody(req);
        const name = typeof body.name === "string" ? body.name : "";
        const section = await service.createSection({ name });
        sendJson(res, 201, { section });
        return true;
      }

      const itemMatch = pathname.match(/^\/api\/workspace\/sections\/([^/]+)$/u);
      if (method === "PATCH" && itemMatch?.[1]) {
        const body = await readJsonBody(req);
        const name = typeof body.name === "string" ? body.name : "";
        const updated = await service.updateSection(decodeURIComponent(itemMatch[1]), { name });
        if (!updated) {
          sendJson(res, 404, { error: "分区不存在。" });
          return true;
        }
        sendJson(res, 200, { section: updated });
        return true;
      }

      if (method === "DELETE" && itemMatch?.[1]) {
        const removed = await service.removeSection(decodeURIComponent(itemMatch[1]));
        sendJson(res, removed ? 200 : 404, { removed });
        return true;
      }

      sendJson(res, 404, { error: "未找到分区接口。" });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, 400, { error: message });
      return true;
    }
  };
}
