// 提供 /api/subagents* 查询、SSE 流式订阅、追问与中止接口，供右侧栏实时渲染子智能体工作舞台。
import type { IncomingMessage, ServerResponse } from "node:http";
import type { SubagentService } from "./index";

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
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) return {};
  const parsed: unknown = JSON.parse(text);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
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

      // SSE 流式订阅：与主聊天协议同构（snapshot / delta / step_update / run_finished）。
      const streamMatch = /^\/api\/subagents\/([^/]+)\/stream$/u.exec(pathname);
      if (method === "GET" && streamMatch?.[1]) {
        const id = decodeURIComponent(streamMatch[1]);
        if (!service.getSubagent(id)) {
          sendJson(res, 404, { error: "未找到子智能体。" });
          return true;
        }
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");
        res.flushHeaders?.();

        const writeEvent = (evt: unknown): void => {
          if (res.writableEnded || res.destroyed) return;
          res.write(`data: ${JSON.stringify(evt)}\n\n`);
        };
        const unsubscribe = service.subscribeSubagent(id, writeEvent);
        const heartbeat = setInterval(() => {
          if (!res.writableEnded && !res.destroyed) res.write(": ping\n\n");
        }, 10_000);
        const cleanup = (): void => {
          clearInterval(heartbeat);
          unsubscribe();
        };
        req.on("close", cleanup);
        res.on("close", cleanup);
        return true;
      }

      // 从右侧子智能体标签页底部输入框发起追问（非阻塞，结果通过 SSE 流实时回传）。
      const msgMatch = /^\/api\/subagents\/([^/]+)\/message$/u.exec(pathname);
      if (method === "POST" && msgMatch?.[1]) {
        const id = decodeURIComponent(msgMatch[1]);
        const body = await readJsonBody(req);
        const message = typeof body.message === "string" ? body.message.trim() : "";
        if (!message) {
          sendJson(res, 400, { error: "补充任务描述不能为空。" });
          return true;
        }
        const item = await service.messageSubagent(id, message);
        sendJson(res, 202, { accepted: true, subagent: item });
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
