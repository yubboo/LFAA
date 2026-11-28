// @lfaa/agent-group HTTP 接口：群聊启动（兼容阻塞与 SSE 流式）、SSE 事件流、回合中止与群设置更新。
// 关联：packages/core/agent-group/src/turn-stream.ts；运行环境：Node Host。
import type { IncomingMessage, ServerResponse } from "node:http";
import { runGroupTurn, type GroupTurnDeps } from "./orchestrator";
import { GroupTurnHub, type GroupStreamDeps } from "./turn-stream";

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

function supportsStreaming(deps: GroupTurnDeps | GroupStreamDeps): deps is GroupStreamDeps {
  const agent = deps.agent as Partial<GroupStreamDeps["agent"]>;
  return typeof agent.subscribeRun === "function" && typeof agent.abortRun === "function";
}

/** 群聊接口：POST /api/group/runs、GET /api/group/turns/:id/events、POST /api/group/turns/:id/abort、PATCH /api/group/sessions/:id。 */
export function createGroupHttpHandler(deps: GroupTurnDeps | GroupStreamDeps) {
  const hub = supportsStreaming(deps) ? new GroupTurnHub(deps) : null;

  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const { pathname } = new URL(req.url ?? "/", "http://127.0.0.1");
    if (!pathname.startsWith("/api/group/")) return false;
    const method = (req.method ?? "GET").toUpperCase();

    try {
      if (pathname === "/api/group/runs") {
        if (method !== "POST") {
          sendJson(res, 405, { error: "群聊回合只支持 POST。" });
          return true;
        }
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
        if (body.stream === true && hub) {
          const started = await hub.start({ sessionId, userMessage, ...(mentions.length > 0 ? { mentions } : {}) });
          sendJson(res, 202, started);
          return true;
        }
        const result = await runGroupTurn(deps, { sessionId, userMessage, ...(mentions.length > 0 ? { mentions } : {}) });
        sendJson(res, 202, result);
        return true;
      }

      const eventsMatch = /^\/api\/group\/turns\/([^/]+)\/events$/u.exec(pathname);
      if (method === "GET" && eventsMatch?.[1]) {
        if (!hub) {
          sendJson(res, 501, { error: "当前运行时不支持群聊流式订阅。" });
          return true;
        }
        const turnId = decodeURIComponent(eventsMatch[1]);
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders?.();

        const unsub = hub.subscribe(turnId, (event) => {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
          if (event.type === "turn_finished") {
            res.end();
          }
        });
        if (!unsub) {
          res.write(`data: ${JSON.stringify({ type: "turn_finished", turnId, sessionId: "", aborted: false })}\n\n`);
          res.end();
          return true;
        }
        req.on("close", () => unsub());
        return true;
      }

      const abortMatch = /^\/api\/group\/turns\/([^/]+)\/abort$/u.exec(pathname);
      if (method === "POST" && abortMatch?.[1]) {
        const turnId = decodeURIComponent(abortMatch[1]);
        sendJson(res, 200, { aborted: hub ? hub.abort(turnId) : false });
        return true;
      }

      const sessionMatch = /^\/api\/group\/sessions\/([^/]+)$/u.exec(pathname);
      if (method === "PATCH" && sessionMatch?.[1]) {
        const memory = deps.memory as Partial<GroupStreamDeps["memory"]>;
        if (typeof memory.updateSession !== "function") {
          sendJson(res, 501, { error: "当前运行时不支持修改群设置。" });
          return true;
        }
        const sessionId = decodeURIComponent(sessionMatch[1]);
        const current = await deps.memory.getSession(sessionId);
        if (!current || current.kind !== "group" || !current.group) {
          sendJson(res, 404, { error: "找不到群聊会话。" });
          return true;
        }
        const body = await readJsonBody(req);
        const nextTitle = typeof body.title === "string" && body.title.trim() ? body.title.trim() : current.title;
        const nextProjectId = body.projectId === null
          ? null
          : typeof body.projectId === "string"
            ? body.projectId.trim() || null
            : current.projectId;
        const rawGroup = typeof body.group === "object" && body.group !== null ? (body.group as Record<string, unknown>) : null;
        const nextAgentIds = Array.isArray(rawGroup?.agentIds)
          ? [...new Set(rawGroup.agentIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0))]
          : current.group.agentIds;
        if (nextAgentIds.length < 2) {
          sendJson(res, 400, { error: "群聊至少需要 2 位成员。" });
          return true;
        }
        const nextHostId = typeof rawGroup?.hostAgentId === "string" && nextAgentIds.includes(rawGroup.hostAgentId)
          ? rawGroup.hostAgentId
          : current.group.hostAgentId && nextAgentIds.includes(current.group.hostAgentId)
            ? current.group.hostAgentId
            : nextAgentIds[0]!;
        const updated = await memory.updateSession(sessionId, {
          title: nextTitle,
          projectId: nextProjectId,
          group: {
            ...current.group,
            agentIds: nextAgentIds,
            hostAgentId: nextHostId,
            ...(typeof rawGroup?.maxSpeakersPerRound === "number" && rawGroup.maxSpeakersPerRound >= 1
              ? { maxSpeakersPerRound: Math.floor(rawGroup.maxSpeakersPerRound) }
              : {}),
          },
        });
        sendJson(res, 200, { session: updated });
        return true;
      }

      sendJson(res, 404, { error: "未找到群聊接口。" });
      return true;
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
      return true;
    }
  };
}
