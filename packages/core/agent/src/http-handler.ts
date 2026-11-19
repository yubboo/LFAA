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

/** 由应用提供工作区路径解析，使 HTTP 层不直接依赖具体项目存储实现。 */
export interface AgentHttpBridgeOptions {
  resolveWorkspaceRoots?: (projectId: string | null) => Promise<string[]>;
}

/** 桥接运行创建、控制与 SSE 订阅，将未匹配的请求留给其他 Host 插件。 */
export function createAgentHttpHandler(service: AgentService, options: AgentHttpBridgeOptions = {}) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const pathname = (req.url ?? "").split("?")[0] ?? "";
    if (!pathname.startsWith("/api/agent/")) return false;
    const method = (req.method ?? "GET").toUpperCase();

    try {
      const fileRoute = /^\/api\/agent\/sessions\/([^/]+)\/file-activity$/u.exec(pathname);
      if (method === "GET" && fileRoute?.[1]) {
        const params = new URL(req.url ?? pathname, "http://localhost").searchParams;
        const preview = await service.readFileActivity(
          decodeURIComponent(fileRoute[1]), params.get("messageId") ?? "", params.get("stepId") ?? "",
          options.resolveWorkspaceRoots ?? (async () => []),
        );
        sendJson(res, preview ? 200 : 404, preview ?? { error: "这条活动没有可定位的源文件。" });
        return true;
      }

      if (method === "POST" && pathname === "/api/agent/runs") {
        const body = await readJsonBody(req);
        const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";

        const reasoningEffort =
          body.reasoningEffort === "minimal" ||
          body.reasoningEffort === "low" ||
          body.reasoningEffort === "medium" ||
          body.reasoningEffort === "high" ||
          body.reasoningEffort === "max"
            ? body.reasoningEffort
            : undefined;
        const skillIds = Array.isArray(body.skillIds)
          ? body.skillIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
          : undefined;
        const started = await service.startRun({
          sessionId,
          userMessage: typeof body.userMessage === "string" ? body.userMessage : "",
          ...(typeof body.profileId === "string" ? { profileId: body.profileId } : {}),
          ...(reasoningEffort ? { reasoningEffort } : {}),
          ...(skillIds && skillIds.length > 0 ? { skillIds } : {}),
          ...(typeof body.maxSteps === "number" ? { maxSteps: body.maxSteps } : {}),
          ...(body.permissionMode === "ask" || body.permissionMode === "smart" || body.permissionMode === "full"
            ? { permissionMode: body.permissionMode }
            : {}),
          autoApproveTools: body.autoApproveTools === true,
        }, options.resolveWorkspaceRoots ?? (async () => []));
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

        if (isReconnect && run.status === "running") {
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
        } else if (run.status === "running" || !run.message) {
          writeEvent({ type: "snapshot", run, reconnect: false, afterSeq: 0 });
        }

        if (run.status !== "running") {
          writeEvent({
            type: "run_finished",
            runId: run.runId,
            sessionId: run.sessionId,
            assistantMessageId: run.assistantMessageId,
            status: run.status,
            ...(run.message ? { message: run.message } : {}),
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

      if (method === "PATCH" && pathname.startsWith("/api/agent/runs/") && pathname.endsWith("/permission")) {
        const runId = decodeURIComponent(pathname.slice("/api/agent/runs/".length, -"/permission".length));
        const { mode } = await readJsonBody(req);
        if (mode !== "ask" && mode !== "smart" && mode !== "full") {
          sendJson(res, 400, { error: "无效的权限模式。" });
          return true;
        }
        sendJson(res, 200, { applied: service.setRunPermissionMode(runId, mode) });
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

      if (method === "POST" && pathname === "/api/agent/side-ask") {
        const body = await readJsonBody(req);
        const question = typeof body.question === "string" ? body.question.trim() : "";
        if (!question) {
          sendJson(res, 400, { error: "提问内容不能为空。" });
          return true;
        }
        const answer = await service.answerSideQuestion(
          question,
          typeof body.contextHint === "string" ? body.contextHint : "",
          typeof body.profileId === "string" ? body.profileId : undefined,
        );
        sendJson(res, 200, { answer });
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
