/**
 * 文件：packages/api/identity-controller/src/index.ts
 * 作用：把本地 Identity Provider 暴露为同源 Web API，并为其他 LFAA Host API 提供统一 AuthSession Gate。
 * 负责：First Run、Login/Logout/Me、用户/角色管理、HttpOnly Cookie、非 Identity API 的登录态拦截。
 * 不负责：密码散列、身份文件持久化、Workspace Session、业务 Capability 授权、React。
 * 状态归属：身份真值归 @lfaa/identity-host-node；Cookie 只携带随机 Auth Token。
 * 对外接口：lfaaDevIdentityBridge(repository?)。
 * 关联文件：@lfaa/identity、@lfaa/identity-host-node、@lfaa/client-connection、@lfaa/bundle-web-app。
 * 修改注意事项：匿名白名单只能包含 bootstrap/initialize/login；禁止把 Token 写进 JSON、URL、日志或 localStorage。
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { hasPermission, LFAA_IDENTITY_PERMISSIONS, type LfaaAuthenticatedUser } from "@lfaa/identity";
import { NodeIdentityRepository } from "@lfaa/identity-host-node";

const BASE = "/__lfaa/dev/identity";
const DEV_API_PREFIX = "/__lfaa/dev/";
const COOKIE_NAME = "lfaa_auth";
const COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

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
  response.setHeader("cache-control", "no-store");
  response.end(JSON.stringify(value));
}
function cookies(request: IncomingMessage): Readonly<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const item of (request.headers.cookie ?? "").split(";")) {
    const index = item.indexOf("=");
    if (index <= 0) continue;
    const key = item.slice(0, index).trim();
    const value = item.slice(index + 1).trim();
    if (key) result[key] = decodeURIComponent(value);
  }
  return result;
}
function authToken(request: IncomingMessage): string { return cookies(request)[COOKIE_NAME] ?? ""; }
function setAuthCookie(response: ServerResponse, token: string): void {
  response.setHeader("set-cookie", `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${COOKIE_MAX_AGE_SECONDS}`);
}
function clearAuthCookie(response: ServerResponse): void {
  response.setHeader("set-cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
}
function stringField(body: Record<string, unknown>, key: string): string {
  if (typeof body[key] !== "string") throw new Error(`${key} 参数无效。`);
  return body[key];
}
function stringArrayField(value: unknown, key: string): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw new Error(`${key} 参数无效。`);
  return value as string[];
}
function requirePermission(identity: LfaaAuthenticatedUser, permission: string): void {
  if (!hasPermission(identity.permissions, permission)) {
    const error = new Error(`缺少权限：${permission}`) as Error & { statusCode?: number };
    error.statusCode = 403;
    throw error;
  }
}

export function lfaaDevIdentityBridge(repository = new NodeIdentityRepository()): Plugin {
  return {
    name: "lfaa-dev-identity-bridge",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url ?? "/", "http://127.0.0.1");
        const path = url.pathname;
        try {
          if (path.startsWith(BASE)) {
            const route = path.slice(BASE.length) || "/";
            if (request.method === "GET" && route === "/bootstrap") {
              return json(response, 200, { ok: true, ...(await repository.bootstrapState()) });
            }
            if (request.method === "POST" && route === "/initialize") {
              const body = await readJson(request);
              const result = await repository.initializeSuperAdmin({
                username: stringField(body, "username"),
                password: stringField(body, "password"),
                ...(typeof body.displayName === "string" ? { displayName: body.displayName } : {}),
              });
              setAuthCookie(response, result.token);
              return json(response, 200, { ok: true, user: result.user, authSession: result.session });
            }
            if (request.method === "POST" && route === "/login") {
              const body = await readJson(request);
              const result = await repository.login({ username: stringField(body, "username"), password: stringField(body, "password") });
              setAuthCookie(response, result.token);
              return json(response, 200, { ok: true, user: result.user, authSession: result.session });
            }

            const token = authToken(request);
            const identity = await repository.authenticate(token);
            if (!identity) return json(response, 401, { ok: false, error: "登录已失效，请重新登录。" });

            if (request.method === "POST" && route === "/logout") {
              await repository.logout(token);
              clearAuthCookie(response);
              return json(response, 200, { ok: true });
            }
            if (request.method === "GET" && route === "/me") return json(response, 200, { ok: true, identity });
            if (request.method === "GET" && route === "/snapshot") {
              requirePermission(identity, LFAA_IDENTITY_PERMISSIONS.usersRead);
              requirePermission(identity, LFAA_IDENTITY_PERMISSIONS.rolesRead);
              return json(response, 200, { ok: true, snapshot: await repository.snapshot() });
            }
            if (request.method === "POST" && route === "/users") {
              requirePermission(identity, LFAA_IDENTITY_PERMISSIONS.usersManage);
              const body = await readJson(request);
              return json(response, 200, { ok: true, snapshot: await repository.createUser({
                username: stringField(body, "username"),
                password: stringField(body, "password"),
                ...(typeof body.displayName === "string" ? { displayName: body.displayName } : {}),
                ...(body.roleIds !== undefined ? { roleIds: stringArrayField(body.roleIds, "roleIds") } : {}),
              }) });
            }
            const userMatch = route.match(/^\/users\/([A-Za-z0-9-]{8,80})$/u);
            if (userMatch && request.method === "PATCH") {
              requirePermission(identity, LFAA_IDENTITY_PERMISSIONS.usersManage);
              const body = await readJson(request);
              return json(response, 200, { ok: true, snapshot: await repository.updateUser(userMatch[1]!, {
                ...(typeof body.displayName === "string" ? { displayName: body.displayName } : {}),
                ...(typeof body.disabled === "boolean" ? { disabled: body.disabled } : {}),
                ...(body.roleIds !== undefined ? { roleIds: stringArrayField(body.roleIds, "roleIds") } : {}),
              }) });
            }
            if (request.method === "POST" && route === "/roles") {
              requirePermission(identity, LFAA_IDENTITY_PERMISSIONS.rolesManage);
              const body = await readJson(request);
              return json(response, 200, { ok: true, snapshot: await repository.createRole({
                id: stringField(body, "id"), name: stringField(body, "name"), permissions: stringArrayField(body.permissions, "permissions"),
                ...(typeof body.description === "string" ? { description: body.description } : {}),
              }) });
            }
            const roleMatch = route.match(/^\/roles\/([a-z0-9._-]{2,64})$/u);
            if (roleMatch && request.method === "PATCH") {
              requirePermission(identity, LFAA_IDENTITY_PERMISSIONS.rolesManage);
              const body = await readJson(request);
              return json(response, 200, { ok: true, snapshot: await repository.updateRole(roleMatch[1]!, {
                ...(typeof body.name === "string" ? { name: body.name } : {}),
                ...(typeof body.description === "string" ? { description: body.description } : {}),
                ...(body.permissions !== undefined ? { permissions: stringArrayField(body.permissions, "permissions") } : {}),
              }) });
            }
            if (roleMatch && request.method === "DELETE") {
              requirePermission(identity, LFAA_IDENTITY_PERMISSIONS.rolesManage);
              return json(response, 200, { ok: true, snapshot: await repository.deleteRole(roleMatch[1]!) });
            }
            return json(response, 404, { ok: false, error: "Identity API 不存在。" });
          }

          // 所有 LFAA 本地 Host API 默认必须先经过 AuthSession；这不是 Capability 细粒度授权的替代品，而是实例级第二层门禁。
          if (path.startsWith(DEV_API_PREFIX)) {
            const state = await repository.bootstrapState();
            if (!state.initialized) return json(response, 428, { ok: false, error: "LFAA 尚未初始化，请先创建超级管理员。" });
            const identity = await repository.authenticate(authToken(request));
            if (!identity) return json(response, 401, { ok: false, error: "需要登录后才能使用 LFAA Host API。" });
          }
          return next();
        } catch (error) {
          const status = typeof (error as { statusCode?: unknown }).statusCode === "number" ? (error as { statusCode: number }).statusCode : 400;
          return json(response, status, { ok: false, error: error instanceof Error ? error.message : String(error) });
        }
      });
    },
  };
}
