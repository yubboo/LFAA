// 为本机 Web 服务提供 /api/skills/* HTTP 接口，支持技能列表、详情、编辑、二创、启停与删除。
import type { IncomingMessage, ServerResponse } from "node:http";
import type { SkillsService } from "./index";

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

export interface SkillsHttpOptions {
  resolveProjectRoots?: () => Promise<string[]>;
}

/** 处理 /api/skills 路由，未命中则返回 false 交由后续处理器。 */
export function createSkillsHttpHandler(service: SkillsService, options: SkillsHttpOptions = {}) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const urlObj = new URL(req.url ?? "/", "http://127.0.0.1");
    const pathname = urlObj.pathname;
    if (pathname !== "/api/skills" && !pathname.startsWith("/api/skills/")) return false;
    const method = (req.method ?? "GET").toUpperCase();

    try {
      const projectRoots = options.resolveProjectRoots ? await options.resolveProjectRoots() : [];

      if (method === "GET" && pathname === "/api/skills") {
        const includeDisabled = urlObj.searchParams.get("includeDisabled") !== "false";
        const skills = await service.listSkills({ projectRoots, includeDisabled });
        sendJson(res, 200, { skills });
        return true;
      }

      if (method === "POST" && pathname === "/api/skills/install-git") {
        const body = await readJsonBody(req);
        const repoUrl = typeof body.repoUrl === "string" ? body.repoUrl : "";
        const installed = await service.installFromGitRepo(repoUrl);
        sendJson(res, 200, { installed });
        return true;
      }

      if (method === "POST" && pathname === "/api/skills") {
        const body = await readJsonBody(req);
        const skill = await service.createOrUpdateSkill({
          ...(typeof body.id === "string" ? { id: body.id } : {}),
          name: typeof body.name === "string" ? body.name : "",
          ...(typeof body.description === "string" ? { description: body.description } : {}),
          content: typeof body.content === "string" ? body.content : "",
          ...(typeof body.expectedRevision === "number" ? { expectedRevision: body.expectedRevision } : {}),
        });
        sendJson(res, 200, { skill });
        return true;
      }

      if (method === "GET" && pathname.startsWith("/api/skills/")) {
        const id = decodeURIComponent(pathname.slice("/api/skills/".length));
        const skill = await service.getSkillDetail(id, projectRoots);
        if (!skill) {
          sendJson(res, 404, { error: "技能不存在。" });
          return true;
        }
        sendJson(res, 200, { skill });
        return true;
      }

      if (method === "POST" && pathname.endsWith("/fork")) {
        const id = decodeURIComponent(pathname.slice("/api/skills/".length, -"/fork".length));
        const skill = await service.forkSkill(id, projectRoots);
        sendJson(res, 200, { skill });
        return true;
      }

      if (method === "POST" && pathname.endsWith("/toggle")) {
        const id = decodeURIComponent(pathname.slice("/api/skills/".length, -"/toggle".length));
        const body = await readJsonBody(req);
        const skill = await service.setSkillEnabled(id, body.enabled === true, projectRoots);
        sendJson(res, 200, { skill });
        return true;
      }

      if (method === "DELETE" && pathname.startsWith("/api/skills/")) {
        const id = decodeURIComponent(pathname.slice("/api/skills/".length));
        const removed = await service.deleteSkill(id);
        if (!removed) {
          sendJson(res, 404, { error: "技能不存在。" });
          return true;
        }
        sendJson(res, 200, { ok: true });
        return true;
      }

      sendJson(res, 404, { error: "未找到技能接口路由。" });
      return true;
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
      return true;
    }
  };
}
