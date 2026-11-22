// @lfaa/handoff：交接 HTTP 接口，供聊天界面读取待处理交接并接手/取消；接手时创建同目标 goal。
import type { IncomingMessage, ServerResponse } from "node:http";
import type { GoalService } from "@lfaa/goal";
import type { MemoryService } from "@lfaa/memory";
import { buildHandoffObjective, type HandoffService } from "./service";

const MAX_BODY_BYTES = 64 * 1024;

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

/** 交接接口：列表 + 接手 + 取消；接手必须由同一项目的会话发起。 */
export function createHandoffHttpHandler(
  service: HandoffService,
  memory: MemoryService,
  goal: GoalService | undefined,
) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (!url.pathname.startsWith("/api/handoffs")) return false;
    const method = (req.method ?? "GET").toUpperCase();

    try {
      if (method === "GET" && url.pathname === "/api/handoffs") {
        const sessionId = url.searchParams.get("sessionId")?.trim() ?? "";
        if (!sessionId) {
          sendJson(res, 400, { error: "缺少 sessionId。" });
          return true;
        }
        const directionRaw = url.searchParams.get("direction");
        const direction = directionRaw === "outgoing" || directionRaw === "all" ? directionRaw : "incoming";
        const projectRaw = url.searchParams.get("projectId");
        const handoffs = await service.list({
          sessionId,
          direction,
          status: "pending",
          ...(projectRaw !== null ? { projectId: projectRaw.trim() || null } : {}),
        });
        sendJson(res, 200, { handoffs });
        return true;
      }

      const acceptMatch = /^\/api\/handoffs\/([^/]+)\/accept$/u.exec(url.pathname);
      if (method === "POST" && acceptMatch?.[1]) {
        if (!goal) {
          sendJson(res, 400, { error: "目标服务未装配，无法接手交接。" });
          return true;
        }
        const body = await readJsonBody(req);
        const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
        if (!sessionId) {
          sendJson(res, 400, { error: "缺少 sessionId。" });
          return true;
        }
        const session = await memory.getSession(sessionId);
        if (!session) {
          sendJson(res, 404, { error: "找不到会话。" });
          return true;
        }
        const id = decodeURIComponent(acceptMatch[1]);
        const item = await service.get(id);
        if (!item) {
          sendJson(res, 404, { error: "找不到这条交接。" });
          return true;
        }
        if ((item.projectId ?? null) !== (session.projectId ?? null)) {
          sendJson(res, 403, { error: "只能接手同一项目的交接。" });
          return true;
        }
        const goalItem = await goal.create({
          title: item.title,
          objective: buildHandoffObjective(item),
          sessionId,
          maxRounds: 10,
        });
        try {
          const handoff = await service.accept(id, sessionId, goalItem.id);
          sendJson(res, 200, { handoff, goal: goalItem });
        } catch (error) {
          await goal.remove(goalItem.id).catch(() => undefined);
          throw error;
        }
        return true;
      }

      const cancelMatch = /^\/api\/handoffs\/([^/]+)\/cancel$/u.exec(url.pathname);
      if (method === "POST" && cancelMatch?.[1]) {
        const body = await readJsonBody(req);
        const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
        if (!sessionId) {
          sendJson(res, 400, { error: "缺少 sessionId。" });
          return true;
        }
        const handoff = await service.cancel(decodeURIComponent(cancelMatch[1]), sessionId);
        sendJson(res, 200, { handoff });
        return true;
      }

      sendJson(res, 404, { error: "未找到交接接口。" });
      return true;
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
      return true;
    }
  };
}