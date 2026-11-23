// @lfaa/agent-group HTTP 接口：启动一轮群聊（POST /api/group/runs）。
// 与其它能力包一致：只做路由与 JSON 读写，编排逻辑在 orchestrator。
import type { IncomingMessage, ServerResponse } from "node:http";
import { runGroupTurn, type GroupTurnDeps } from "./orchestrator";

const MAX_BODY_BYTES = 128 * 1024;

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    total += buf.length;
    if (total > MAX_BODY_BYTES) throw new Error("请求体过大。");
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
}

/** 群聊接口：POST /api/group/runs → { turnId, speakers }。 */
export function createGroupHttpHandler(deps: GroupTurnDeps) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const { pathname } = new URL(req.url ?? "/", "http://127.0.0.1");
    if (pathname !== "/api/group/runs") return false;
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "群聊回合只支持 POST。" });
      return true;
    }
    try {
      const body = await readJsonBody(req);
      const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
      const userMessage = typeof body.userMessage === "string" ? body.userMessage : "";
      if (!sessionId) {
        sendJson(res, 400, { error: "缺少 sessionId。" });
        return true;
      }
      const mentions = Array.isArray(body.mentions)
        ? body.mentions.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
        : [];
      const result = await runGroupTurn(deps, { sessionId, userMessage, ...(mentions.length > 0 ? { mentions } : {}) });
      sendJson(res, 202, result);
      return true;
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
      return true;
    }
  };
}