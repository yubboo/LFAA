/**
 * 功能：验证浏览器登录 Cookie 并执行角色授权。
 * 作用：仅将有效的、未过期且仍存在于数据库中的会话身份交给受保护路由。
 * 关联文件：packages/identity/auth/src/service.ts、packages/api/gateway/src/index.ts、packages/api/remotes/src/socket-server.ts。
 */
import type { RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "lfaa-launch-environment/src/config.js";
import { findActiveSession, hasAdminAccess, type ActiveSession } from "lfaa-identity-auth/src/service.js";

export const sessionCookieName = "lfaa_session";

export function setSessionCookie(response: Response, token: string): void {
  const secureAttribute = config.nodeEnvironment === "production" ? "; Secure" : "";
  response.append(
    "Set-Cookie",
    `${sessionCookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${secureAttribute}`
  );
}

export function clearSessionCookie(response: Response): void {
  const secureAttribute = config.nodeEnvironment === "production" ? "; Secure" : "";
  response.append(
    "Set-Cookie",
    `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secureAttribute}`
  );
}

function readSessionCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) {
    return null;
  }

  for (const item of cookieHeader.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0) {
      continue;
    }

    if (item.slice(0, separator).trim() === sessionCookieName) {
      return item.slice(separator + 1).trim();
    }
  }

  return null;
}

function resolveSessionTokenDetails(token: string): { session: ActiveSession; expiresAt: number | null } | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret, {
      algorithms: ["HS256"],
      audience: "lfaa-web",
      issuer: "lfaa-server"
    });

    if (typeof payload === "string" || typeof payload.sid !== "string") {
      return null;
    }

    const session = findActiveSession(payload.sid);
    return session ? { session, expiresAt: typeof payload.exp === "number" ? payload.exp * 1000 : null } : null;
  } catch {
    return null;
  }
}

function resolveSessionToken(token: string): ActiveSession | null {
  return resolveSessionTokenDetails(token)?.session ?? null;
}

export function resolveSocketSessionFromCookieHeader(cookieHeader: string | undefined): { session: ActiveSession; expiresAt: number } | null {
  const token = readSessionCookie(cookieHeader);
  if (!token) return null;
  const resolved = resolveSessionTokenDetails(token);
  if (!resolved || resolved.expiresAt === null) return null;
  return { session: resolved.session, expiresAt: resolved.expiresAt };
}

export const requireAuthentication: RequestHandler = (request, response, next) => {
  const token = readSessionCookie(request.headers.cookie);

  if (!token) {
    response.status(401).json({ error: "authentication_required", message: "请先登录。" });
    return;
  }

  const session = resolveSessionToken(token);
  if (!session) {
    clearSessionCookie(response);
    response.status(401).json({ error: "invalid_session", message: "登录已失效，请重新登录。" });
    return;
  }

  request.auth = session;
  next();
};

export function requireRole(role: "admin" | "member"): RequestHandler {
  return (request, response, next) => {
    const actualRole = request.auth?.user.role;
    const allowed = role === "admin" ? actualRole !== undefined && hasAdminAccess(actualRole) : actualRole === role;
    if (!allowed) {
      response.status(403).json({ error: "permission_denied", message: "当前账户没有执行此操作的权限。" });
      return;
    }

    next();
  };
}

export const requireSuperAdmin: RequestHandler = (request, response, next) => {
  if (request.auth?.user.role !== "super_admin") {
    response.status(403).json({ error: "super_admin_required", message: "只有超级管理员可以管理账户。" });
    return;
  }

  next();
};
