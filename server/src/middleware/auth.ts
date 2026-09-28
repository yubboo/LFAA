/**
 * 功能：验证浏览器登录 Cookie 并执行角色授权。
 * 作用：仅将有效的、未过期且仍存在于数据库中的会话身份交给受保护路由。
 * 关联文件：server/src/modules/auth/service.ts、server/src/api/routes.ts。
 */
import type { RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { findActiveSession } from "../modules/auth/service.js";

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

function readSessionCookie(request: Parameters<RequestHandler>[0]): string | null {
  const cookieHeader = request.headers.cookie;

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

export const requireAuthentication: RequestHandler = (request, response, next) => {
  const token = readSessionCookie(request);

  if (!token) {
    response.status(401).json({ error: "authentication_required", message: "请先登录。" });
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret, {
      algorithms: ["HS256"],
      audience: "lfaa-web",
      issuer: "lfaa-server"
    });

    if (typeof payload === "string" || typeof payload.sid !== "string") {
      clearSessionCookie(response);
      response.status(401).json({ error: "invalid_session", message: "登录已失效，请重新登录。" });
      return;
    }

    const session = findActiveSession(payload.sid);
    if (!session) {
      clearSessionCookie(response);
      response.status(401).json({ error: "invalid_session", message: "登录已失效，请重新登录。" });
      return;
    }

    request.auth = session;
    next();
  } catch {
    clearSessionCookie(response);
    response.status(401).json({ error: "invalid_session", message: "登录已失效，请重新登录。" });
  }
};

export function requireRole(role: "admin" | "member"): RequestHandler {
  return (request, response, next) => {
    if (request.auth?.user.role !== role) {
      response.status(403).json({ error: "permission_denied", message: "当前账户没有执行此操作的权限。" });
      return;
    }

    next();
  };
}
