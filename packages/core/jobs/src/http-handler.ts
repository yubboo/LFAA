// 提供 /api/jobs* 后台任务查询、终端命令启动与终止接口。
import type { IncomingMessage, ServerResponse } from "node:http";
import type { JobsService } from "./index";

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

export function createJobsHttpHandler(
  service: JobsService,
  resolveWorkspaceCwd?: (sessionId: string) => Promise<string>,
) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const urlObj = new URL(req.url ?? "/", "http://127.0.0.1");
    const pathname = urlObj.pathname;
    if (pathname !== "/api/jobs" && !pathname.startsWith("/api/jobs/")) return false;
    const method = (req.method ?? "GET").toUpperCase();

    try {
      if (method === "GET" && pathname === "/api/jobs") {
        const sessionId = urlObj.searchParams.get("sessionId") ?? undefined;
        sendJson(res, 200, { jobs: service.listJobs(sessionId) });
        return true;
      }

      if (method === "POST" && pathname === "/api/jobs") {
        const body = await readJsonBody(req);
        const sessionId = typeof body.sessionId === "string" && body.sessionId.trim()
          ? body.sessionId.trim()
          : "default";
        const command = typeof body.command === "string" ? body.command : "";
        const title = typeof body.title === "string" ? body.title : undefined;
        const cwd = resolveWorkspaceCwd ? await resolveWorkspaceCwd(sessionId) : process.cwd();
        const job = await service.startJob({
          sessionId,
          command,
          ...(title ? { title } : {}),
          cwd,
        });
        sendJson(res, 201, { job });
        return true;
      }

      const stopMatch = /^\/api\/jobs\/([^/]+)\/stop$/u.exec(pathname);
      if (method === "POST" && stopMatch?.[1]) {
        const job = await service.stopJob(decodeURIComponent(stopMatch[1]));
        sendJson(res, job ? 200 : 404, job ? { stopped: true, job } : { error: "未找到后台任务。" });
        return true;
      }

      const getMatch = /^\/api\/jobs\/([^/]+)$/u.exec(pathname);
      if (method === "GET" && getMatch?.[1]) {
        const job = service.getJob(decodeURIComponent(getMatch[1]));
        sendJson(res, job ? 200 : 404, job ? { job } : { error: "未找到后台任务。" });
        return true;
      }

      sendJson(res, 404, { error: "未找到后台任务路由。" });
      return true;
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
      return true;
    }
  };
}
