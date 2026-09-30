/**
 * 功能：限制同一来源短时间内的敏感请求数量。
 * 作用：为首次管理员初始化和登录入口提供轻量的进程内尝试频率保护。
 * 关联文件：packages/api/gateway/src/index.ts。
 */
import type { RequestHandler } from "express";

interface RateWindow {
  count: number;
  resetsAt: number;
}

export function createRateLimit(maximum: number, windowMilliseconds: number): RequestHandler {
  const windows = new Map<string, RateWindow>();

  return (request, response, next) => {
    const now = Date.now();
    const key = request.ip || request.socket.remoteAddress || "unknown";
    let window = windows.get(key);

    if (!window || window.resetsAt <= now) {
      window = { count: 0, resetsAt: now + windowMilliseconds };
      windows.set(key, window);
    }

    window.count += 1;

    if (windows.size > 5000) {
      for (const [candidate, candidateWindow] of windows) {
        if (candidateWindow.resetsAt <= now) {
          windows.delete(candidate);
        }
      }
    }

    if (window.count > maximum) {
      response.setHeader("Retry-After", String(Math.ceil((window.resetsAt - now) / 1000)));
      response.status(429).json({ error: "rate_limited", message: "请求过于频繁，请稍后再试。" });
      return;
    }

    next();
  };
}
