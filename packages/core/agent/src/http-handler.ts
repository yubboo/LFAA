// 为本机 Web 服务提供 /api/agent/* 任务启动、SSE 轨迹推送、人工审批与任务中止接口。
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AgentService } from "./index";

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

export interface AgentHttpBridgeOptions {
  resolveWorkspaceRoots?: (projectId: string | null) => Promise<string[]>;
}

export function createAgentHttpHandler(service: AgentService, options: AgentHttpBridgeOptions = {}) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const pathname = (req.url ?? "").split("?")[0] ?? "";
    if (!pathname.startsWith("/api/agent/")) return false;
    const method = (req.method ?? "GET").toUpperCase();

    try {
      if (method === "POST" && pathname === "/api/agent/runs") {
        const body = await readJsonBody(req);
        const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
        const projectId = typeof body.projectId === "string" ? body.projectId : null;
        const explicitRoots = Array.isArray(body.workspaceRoots)
          ? body.workspaceRoots.filter((r): r is string => typeof r === "string")
          : [];
        const workspaceRoots = explicitRoots.length > 0
          ? explicitRoots
          : (options.resolveWorkspaceRoots ? await options.resolveWorkspaceRoots(projectId) : []);

        const reasoningEffort =
          body.reasoningEffort === "minimal" ||
          body.reasoningEffort === "low" ||
          body.reasoningEffort === "medium" ||
          body.reasoningEffort === "high" ||
          body.reasoningEffort === "max"
            ? body.reasoningEffort
            : undefined;
        const started = await service.startRun({
          sessionId,
          userMessage: typeof body.userMessage === "string" ? body.userMessage : "",
          ...(typeof body.profileId === "string" ? { profileId: body.profileId } : {}),
          ...(reasoningEffort ? { reasoningEffort } : {}),
          projectId,
          workspaceRoots,
          ...(typeof body.maxSteps === "number" ? { maxSteps: body.maxSteps } : {}),
          ...(body.permissionMode === "ask" || body.permissionMode === "smart" || body.permissionMode === "full"
            ? { permissionMode: body.permissionMode }
            : {}),
          autoApproveTools: body.autoApproveTools === true,
        });
        sendJson(res, 201, started);
        return true;
      }

      if (method === "GET" && pathname.startsWith("/api/agent/runs/") && pathname.endsWith("/events")) {
        const urlObj = new URL(req.url ?? "", "http://127.0.0.1");
        const runId = decodeURIComponent(pathname.slice("/api/agent/runs/".length, -"/events".length));
        const run = service.getRunStatus(runId);
        if (!run) {
          sendJson(res, 404, { error: "运行任务不存在。" });
          return true;
        }
        const afterSeqParam = urlObj.searchParams.get("afterSeq") ?? (typeof req.headers["last-event-id"] === "string" ? req.headers["last-event-id"] : null);
        const afterSeq = afterSeqParam !== null && /^\d+$/u.test(afterSeqParam) ? Number(afterSeqParam) : 0;
        const isReconnect = urlObj.searchParams.has("afterSeq") || typeof req.headers["last-event-id"] === "string";

        // 代理层兼容头：关闭缓冲与压缩，确保流式分片实时直达客户端
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");
        res.setHeader("Content-Encoding", "identity");

        const writeEvent = (payload: Record<string, unknown>, id?: number) => {
          if (id !== undefined) res.write(`id: ${id}\n`);
          res.write(`data: ${JSON.stringify(payload)}\n\n`);
        };

        if (isReconnect) {
          const replayed = service.getReplayChunks(runId, afterSeq);
          service.recordReconnect(runId, afterSeq, replayed);
          writeEvent({
            type: "snapshot",
            run: {
              ...run,
              content: "",
              reasoning: "",
            },
            reconnect: true,
            afterSeq,
          });
          for (const chunk of replayed) {
            writeEvent({ type: "delta", runId, seq: chunk.seq, kind: chunk.kind, text: chunk.text }, chunk.seq);
          }
        } else {
          writeEvent({ type: "snapshot", run, reconnect: false, afterSeq: 0 });
        }

        if (run.status !== "running") {
          writeEvent({
            type: "run_finished",
            runId: run.runId,
            sessionId: run.sessionId,
            assistantMessageId: run.assistantMessageId,
            status: run.status,
            ...(run.error ? { error: run.error } : {}),
          });
          res.end();
          return true;
        }

        const heartbeatTimer = setInterval(() => {
          res.write(`event: heartbeat\ndata: ${JSON.stringify({ type: "heartbeat", ts: Date.now() })}\n\n`);
        }, 10_000);

        const off = service.subscribeRun(runId, (evt) => {
          const seqId = evt.type === "delta" ? evt.seq : undefined;
          writeEvent(evt as Record<string, unknown>, seqId);
          if (evt.type === "run_finished") {
            clearInterval(heartbeatTimer);
            off();
            res.end();
          }
        });
        req.on("close", () => {
          clearInterval(heartbeatTimer);
          off();
        });
        return true;
      }

      if (method === "GET" && pathname.startsWith("/api/agent/sessions/") && pathname.endsWith("/active-run")) {
        const sessionId = decodeURIComponent(pathname.slice("/api/agent/sessions/".length, -"/active-run".length));
        const run = service.getActiveRunForSession(sessionId);
        sendJson(res, 200, { run });
        return true;
      }

      if (method === "GET" && pathname === "/api/agent/metrics") {
        sendJson(res, 200, { metrics: service.getStreamMetrics() });
        return true;
      }

      if (method === "POST" && pathname === "/api/agent/metrics/render") {
        const body = await readJsonBody(req);
        if (typeof body.fps === "number") {
          service.recordClientFps(body.fps);
        }
        sendJson(res, 200, { ok: true });
        return true;
      }

      if (method === "POST" && pathname.startsWith("/api/agent/runs/") && pathname.endsWith("/approve")) {
        const runId = decodeURIComponent(pathname.slice("/api/agent/runs/".length, -"/approve".length));
        const body = await readJsonBody(req);
        const approvalId = typeof body.approvalId === "string" ? body.approvalId : "";
        const resolved = service.resolveApproval(runId, approvalId, body.approved === true);
        sendJson(res, resolved ? 200 : 404, { resolved });
        return true;
      }

      if (method === "POST" && pathname.startsWith("/api/agent/runs/") && pathname.endsWith("/abort")) {
        const runId = decodeURIComponent(pathname.slice("/api/agent/runs/".length, -"/abort".length));
        const aborted = service.abortRun(runId);
        sendJson(res, aborted ? 200 : 404, { aborted });
        return true;
      }

      if (method === "GET" && pathname === "/api/agent/trust") {
        const counts = await service.getSmartTrustCounts();
        sendJson(res, 200, { counts });
        return true;
      }

      if (method === "DELETE" && pathname === "/api/agent/trust") {
        await service.resetSmartTrust();
        sendJson(res, 200, { counts: {} });
        return true;
      }

      sendJson(res, 404, { error: "未找到 Agent 接口路由。" });
      return true;
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
      return true;
    }
  };
}
