// 为本机 Web 服务提供 /api/rules* HTTP 接口，用于查看分层规则及保存用户全局规则。
import type { IncomingMessage, ServerResponse } from "node:http";
import type { RulesService } from "./index";

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

export function createRulesHttpHandler(service: RulesService) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const rawUrl = req.url ?? "";
    const urlObj = new URL(rawUrl, "http://127.0.0.1");
    const pathname = urlObj.pathname;
    if (pathname !== "/api/rules" && !pathname.startsWith("/api/rules/")) return false;
    const method = (req.method ?? "GET").toUpperCase();

    try {
      if (method === "GET" && pathname === "/api/rules") {
        const projectPaths = urlObj.searchParams.getAll("projectPath").filter(Boolean);
        const documents = await service.listAllRules(projectPaths);
        sendJson(res, 200, { documents });
        return true;
      }

      if ((method === "PUT" || method === "POST") && pathname === "/api/rules/user") {
        const body = await readJsonBody(req);
        const content = typeof body.content === "string" ? body.content : "";
        const saved = await service.saveUserRules(content);
        const documents = await service.listAllRules();
        sendJson(res, 200, { saved, documents });
        return true;
      }

      sendJson(res, 404, { error: "未找到规则接口路由。" });
      return true;
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
      return true;
    }
  };
}
