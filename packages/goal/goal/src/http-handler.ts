// @lfaa/goal：目标 HTTP 接口，供聊天界面读取当前会话目标并保存用户编辑的目标文字。
import type { IncomingMessage, ServerResponse } from "node:http";
import type { GoalService } from "./index";

const MAX_BODY_BYTES = 64 * 1024;
const MAX_OBJECTIVE_CHARS = 2000;

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

/** 目标接口：只读列表 + 编辑目标文字；状态仍由 Agent 的 goal_update 维护。 */
export function createGoalHttpHandler(service: GoalService) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (!url.pathname.startsWith("/api/goals")) return false;

    if (url.pathname === "/api/goals") {
      if (req.method !== "GET") {
        sendJson(res, 405, { error: "目标列表只支持 GET。" });
        return true;
      }
      const sessionId = url.searchParams.get("sessionId")?.trim() ?? "";
      if (!sessionId) {
        sendJson(res, 400, { error: "缺少 sessionId。" });
        return true;
      }
      sendJson(res, 200, { goals: await service.list({ sessionId }) });
      return true;
    }

    const id = decodeURIComponent(url.pathname.slice("/api/goals/".length));
    if (!id || id.includes("/")) {
      sendJson(res, 404, { error: "未找到目标。" });
      return true;
    }
    if (req.method !== "PATCH") {
      sendJson(res, 405, { error: "目标只支持 PATCH 更新。" });
      return true;
    }

    try {
      const body = await readJsonBody(req);
      const objective = typeof body.objective === "string" ? body.objective.trim() : undefined;
      const autoContinue = typeof body.autoContinue === "boolean" ? body.autoContinue : undefined;
      if (objective === undefined && autoContinue === undefined) {
        sendJson(res, 400, { error: "没有可更新的字段。" });
        return true;
      }
      if (objective !== undefined && !objective) {
        sendJson(res, 400, { error: "目标文字不能为空。" });
        return true;
      }
      if (objective !== undefined && objective.length > MAX_OBJECTIVE_CHARS) {
        sendJson(res, 400, { error: `目标文字不能超过 ${MAX_OBJECTIVE_CHARS} 个字符。` });
        return true;
      }
      const goal = await service.get(id);
      if (!goal) {
        sendJson(res, 404, { error: "未找到目标。" });
        return true;
      }
      const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
      if (sessionId && goal.sessionId && goal.sessionId !== sessionId) {
        sendJson(res, 404, { error: "未找到目标。" });
        return true;
      }
      const updated = await service.update(id, {
        ...(objective !== undefined ? { objective } : {}),
        ...(autoContinue !== undefined ? { autoContinue } : {}),
      });
      sendJson(res, 200, { goal: updated });
      return true;
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
      return true;
    }
  };
}