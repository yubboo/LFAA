// 为本机 Web 服务提供 /api/chat/coding-settings、/api/git/* 与 /api/code-review/* 内置 Git 与审查接口。
import type { IncomingMessage, ServerResponse } from "node:http";
import type { CodeReviewCodingSettings, GitCodingSettings } from "./coding-settings";
import type { ChatService } from "./index";

/** 注入候选目录与目标路径解析，供编码路由处理实际工作区请求。 */
export interface CodingHttpHandlerOptions {
  resolveProjectCandidates?: () => Promise<Array<{ rootPath: string; name?: string; projectId?: string }>>;
  resolveTargetRoot?: (projectId?: string | null) => Promise<string | undefined>;
}

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
    if (total > 2 * 1024 * 1024) {
      throw new Error("请求体过大。");
    }
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
}

/** 暴露 Git 状态、变更操作、编码设置及审查相关的 Host 路由。 */
export function createCodingHttpHandler(service: ChatService, options: CodingHttpHandlerOptions = {}) {
  const resolveRoot = async (projectId?: string | null): Promise<string | undefined> => {
    if (options.resolveTargetRoot) {
      return options.resolveTargetRoot(projectId);
    }
    return undefined;
  };

  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const urlObj = new URL(req.url ?? "", "http://127.0.0.1");
    const pathname = urlObj.pathname;
    if (
      pathname !== "/api/chat/coding-settings" &&
      !pathname.startsWith("/api/git/") &&
      !pathname.startsWith("/api/code-review/")
    ) {
      return false;
    }

    const method = (req.method ?? "GET").toUpperCase();
    try {
      if (method === "GET" && pathname === "/api/chat/coding-settings") {
        const settings = await service.getCodingSettings();
        sendJson(res, 200, { settings });
        return true;
      }

      if (method === "PATCH" && pathname === "/api/chat/coding-settings") {
        const body = await readJsonBody(req);
        const settings = await service.updateCodingSettings(
          body as Partial<{ git: Partial<GitCodingSettings>; codeReview: Partial<CodeReviewCodingSettings> }>,
        );
        sendJson(res, 200, { settings });
        return true;
      }

      if (method === "GET" && pathname === "/api/git/repos") {
        const candidates = options.resolveProjectCandidates ? await options.resolveProjectCandidates() : [];
        const repos = await service.listDiscoveredRepositories(candidates);
        sendJson(res, 200, { repos });
        return true;
      }

      if (method === "GET" && pathname === "/api/git/status") {
        const projectId = urlObj.searchParams.get("projectId");
        const status = await service.getGitStatus(await resolveRoot(projectId));
        sendJson(res, 200, { status });
        return true;
      }

      if (method === "GET" && pathname === "/api/git/diff") {
        const projectId = urlObj.searchParams.get("projectId");
        const filePath = urlObj.searchParams.get("filePath") || undefined;
        const commitHash = urlObj.searchParams.get("commitHash") || undefined;
        const staged = urlObj.searchParams.get("staged") === "1";
        const diff = await service.getGitDiff(await resolveRoot(projectId), {
          ...(filePath ? { filePath } : {}),
          ...(commitHash ? { commitHash } : {}),
          ...(staged ? { staged: true } : {}),
        });
        sendJson(res, 200, diff);
        return true;
      }

      if (method === "POST" && pathname === "/api/git/stage") {
        const body = await readJsonBody(req);
        const projectId = typeof body.projectId === "string" ? body.projectId : undefined;
        const files = body.files === "all" ? "all" : Array.isArray(body.files) ? (body.files as string[]) : [];
        const status = await service.stageGitFiles(await resolveRoot(projectId), files);
        sendJson(res, 200, { status });
        return true;
      }

      if (method === "POST" && pathname === "/api/git/unstage") {
        const body = await readJsonBody(req);
        const projectId = typeof body.projectId === "string" ? body.projectId : undefined;
        const files = body.files === "all" ? "all" : Array.isArray(body.files) ? (body.files as string[]) : [];
        const status = await service.unstageGitFiles(await resolveRoot(projectId), files);
        sendJson(res, 200, { status });
        return true;
      }

      if (method === "POST" && pathname === "/api/git/branch") {
        const body = await readJsonBody(req);
        const projectId = typeof body.projectId === "string" ? body.projectId : undefined;
        const name = typeof body.name === "string" ? body.name : "";
        const create = body.create === true;
        const status = await service.checkoutGitBranch(await resolveRoot(projectId), { name, create });
        sendJson(res, 200, { status });
        return true;
      }

      if (method === "POST" && pathname === "/api/git/commit-draft") {
        const body = await readJsonBody(req);
        const projectId = typeof body.projectId === "string" ? body.projectId : undefined;
        const draft = await service.generateGitCommitDraft(await resolveRoot(projectId));
        sendJson(res, 200, { draft });
        return true;
      }

      if (method === "POST" && pathname === "/api/git/commit") {
        const body = await readJsonBody(req);
        const projectId = typeof body.projectId === "string" ? body.projectId : undefined;
        const message = typeof body.message === "string" ? body.message : "";
        const result = await service.commitGitChanges(await resolveRoot(projectId), message);
        sendJson(res, 200, result);
        return true;
      }

      if (method === "POST" && pathname === "/api/git/pr-draft") {
        const body = await readJsonBody(req);
        const projectId = typeof body.projectId === "string" ? body.projectId : undefined;
        const draft = await service.generateGitPrDraft(await resolveRoot(projectId));
        sendJson(res, 200, { draft });
        return true;
      }

      if (method === "POST" && pathname === "/api/git/revert-files") {
        const body = await readJsonBody(req);
        const projectId = typeof body.projectId === "string" ? body.projectId : undefined;
        const files = Array.isArray(body.files)
          ? body.files.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          : [];
        const result = await service.revertGitFiles(await resolveRoot(projectId), files);
        sendJson(res, 200, result);
        return true;
      }

      if (method === "GET" && pathname === "/api/code-review/reports") {
        const reports = await service.listCodeReviews();
        sendJson(res, 200, { reports });
        return true;
      }

      if (method === "POST" && pathname === "/api/code-review/run") {
        const body = await readJsonBody(req);
        const projectId = typeof body.projectId === "string" ? body.projectId : undefined;
        const scope =
          body.scope === "staged" || body.scope === "commit" || body.scope === "working_tree"
            ? body.scope
            : "working_tree";
        const commitHash = typeof body.commitHash === "string" ? body.commitHash : undefined;
        const targetDir = await resolveRoot(projectId);
        const report = await service.runCodeReview({
          ...(targetDir ? { targetDir } : {}),
          scope,
          ...(commitHash ? { commitHash } : {}),
        });
        sendJson(res, 200, { report });
        return true;
      }

      return false;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 400, { error: message });
      return true;
    }
  };
}
