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

        const started = await service.startRun({
          sessionId,
          userMessage: typeof body.userMessage === "string" ? body.userMessage : "",
          ...(typeof body.profileId === "string" ? { profileId: body.profileId } : {}),
          projectId,
          workspaceRoots,
          ...(typeof body.maxSteps === "number" ? { maxSteps: body.maxSteps } : {}),
          autoApproveTools: body.autoApproveTools === true,
        });
        sendJson(res, 201, started);
        return true;
      }

      if (method === "GET" && pathname.startsWith("/api/agent/runs/") && pathname.endsWith("/events")) {
        const runId = decodeURIComponent(pathname.slice("/api/agent/runs/".length, -"/events".length));
        const run = service.getRunStatus(runId);
        if (!run) {
          sendJson(res, 404, { error: "运行任务不存在。" });
          return true;
        }
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        const writeEvent = (payload: unknown) => {
          res.write(`data: ${JSON.stringify(payload)}\n\n`);
        };
        writeEvent({ type: "snapshot", run });
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

        const off = service.subscribeRun(runId, (evt) => {
          writeEvent(evt);
          if (evt.type === "run_finished") {
            off();
            res.end();
          }
        });
        req.on("close", () => off());
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

      sendJson(res, 404, { error: "未找到 Agent 接口路由。" });
      return true;
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
      return true;
    }
  };
}
