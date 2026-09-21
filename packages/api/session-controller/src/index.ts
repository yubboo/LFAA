/**
 * 文件：packages/api/session-controller/src/index.ts
 * 作用：把 Node Session Repository 暴露为同源 Web Host API。
 * 负责：snapshot/create/load/save/set-active/delete 的 HTTP 边界与输入校验。
 * 不负责：Session 业务投影、React、Agent Runtime。
 * 状态归属：无独立业务状态；持久真值归 @lfaa/session-host-node。
 * 对外接口：lfaaDevSessionBridge(projectRoot?)。
 * 关联文件：@lfaa/session、@lfaa/session-host-node、@lfaa/client-connection。
 * 修改注意事项：不得把 Session JSON 写进源码仓库；所有数据必须留在 LFAA_HOME。
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { NodeWorkspaceSessionRepository } from "@lfaa/session-host-node";
import type { WorkspaceSessionRecord, WorkspaceSessionMode } from "@lfaa/session";

const BASE = "/__lfaa/dev/sessions";

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of request) raw += String(chunk);
  if (!raw) return {};
  const value = JSON.parse(raw) as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("请求 JSON 无效。");
  return value as Record<string, unknown>;
}
function json(response: ServerResponse, status: number, value: unknown): void {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(value));
}
function modeOf(value: unknown): WorkspaceSessionMode {
  if (value === "chat" || value === "work" || value === "manual") return value;
  throw new Error("Session mode 无效。");
}

export function lfaaDevSessionBridge(): Plugin {
  const repository = new NodeWorkspaceSessionRepository();
  return {
    name: "lfaa-dev-session-bridge",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url ?? "/", "http://127.0.0.1");
        if (!url.pathname.startsWith(BASE)) return next();
        try {
          const path = url.pathname.slice(BASE.length) || "/";
          if (request.method === "GET" && path === "/projects") {
            const defaultProjectId = url.searchParams.get("defaultProjectId")?.trim() || "lfaa";
            return json(response, 200, { ok: true, snapshot: await repository.projects(defaultProjectId) });
          }
          if (request.method === "POST" && path === "/projects") {
            const body = await readJson(request);
            if (typeof body.name !== "string") throw new Error("项目名称无效。");
            return json(response, 200, { ok: true, snapshot: await repository.createProject({ name: body.name }) });
          }
          if (request.method === "POST" && path === "/projects/active") {
            const body = await readJson(request);
            if (typeof body.projectId !== "string") throw new Error("项目参数无效。");
            return json(response, 200, { ok: true, snapshot: await repository.setActiveProject(body.projectId) });
          }
          const projectMatch = path.match(/^\/projects\/([A-Za-z0-9-]{1,80})$/u);
          if (projectMatch) {
            const projectId = projectMatch[1]!;
            if (request.method === "PATCH") {
              const body = await readJson(request);
              return json(response, 200, { ok: true, snapshot: await repository.updateProject(projectId, {
                ...(typeof body.name === "string" ? { name: body.name } : {}),
                ...(typeof body.pinned === "boolean" ? { pinned: body.pinned } : {}),
                ...(typeof body.expanded === "boolean" ? { expanded: body.expanded } : {}),
              }) });
            }
            if (request.method === "DELETE") return json(response, 200, { ok: true, snapshot: await repository.deleteProject(projectId) });
          }
          if (request.method === "GET" && path === "/snapshot") {
            const workspaceId = url.searchParams.get("workspaceId")?.trim() || "lfaa";
            return json(response, 200, { ok: true, snapshot: await repository.snapshot(workspaceId) });
          }
          if (request.method === "POST" && path === "/") {
            const body = await readJson(request);
            const workspaceId = typeof body.workspaceId === "string" && body.workspaceId.trim() ? body.workspaceId.trim() : "lfaa";
            return json(response, 200, { ok: true, session: await repository.create({ workspaceId, mode: modeOf(body.mode), ...(typeof body.title === "string" ? { title: body.title } : {}) }) });
          }
          if (request.method === "POST" && path === "/active") {
            const body = await readJson(request);
            if (typeof body.workspaceId !== "string" || typeof body.sessionId !== "string") throw new Error("active session 参数无效。");
            return json(response, 200, { ok: true, snapshot: await repository.setActive(body.workspaceId, body.sessionId) });
          }
          const match = path.match(/^\/([A-Za-z0-9-]{8,80})$/u);
          if (match) {
            const sessionId = match[1]!;
            if (request.method === "GET") return json(response, 200, { ok: true, session: await repository.load(sessionId) });
            if (request.method === "PUT") {
              const body = await readJson(request);
              const session = body.session as WorkspaceSessionRecord | undefined;
              if (!session || session.id !== sessionId) throw new Error("Session payload 无效。");
              return json(response, 200, { ok: true, session: await repository.save(session) });
            }
            if (request.method === "DELETE") return json(response, 200, { ok: true, snapshot: await repository.delete(sessionId) });
          }
          return json(response, 404, { ok: false, error: "Session API 不存在。" });
        } catch (error) {
          return json(response, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
        }
      });
    },
  };
}
