// 提供 /api/browser/* 导航、多标签管理、动态视口、真实键鼠、Console/Network 日志、人工接管及配置接口。
import type { IncomingMessage, ServerResponse } from "node:http";
import type { BrowserService } from "./index";
import type { BrowserInputPayload } from "./types";

/** 校验并归一化前端轻量输入负载，非法字段直接返回 null。 */
function parseInputPayload(body: Record<string, unknown>): BrowserInputPayload | null {
  const kind = typeof body.kind === "string" ? body.kind : "";
  const modifiers = typeof body.modifiers === "number" ? body.modifiers : undefined;
  const x = typeof body.x === "number" && Number.isFinite(body.x) ? body.x : 0;
  const y = typeof body.y === "number" && Number.isFinite(body.y) ? body.y : 0;
  if (kind === "wheel") {
    const deltaX = typeof body.deltaX === "number" && Number.isFinite(body.deltaX) ? body.deltaX : 0;
    const deltaY = typeof body.deltaY === "number" && Number.isFinite(body.deltaY) ? body.deltaY : 0;
    return { kind, x, y, deltaX, deltaY, ...(modifiers !== undefined ? { modifiers } : {}) };
  }
  if (kind === "mousemove") {
    const buttons = typeof body.buttons === "number" ? body.buttons : undefined;
    return { kind, x, y, ...(buttons !== undefined ? { buttons } : {}), ...(modifiers !== undefined ? { modifiers } : {}) };
  }
  if (kind === "mousedown" || kind === "mouseup") {
    const button = body.button === "right" || body.button === "middle" ? body.button : "left";
    const clickCount = typeof body.clickCount === "number" ? body.clickCount : 1;
    const buttons = typeof body.buttons === "number" ? body.buttons : undefined;
    return { kind, x, y, button, clickCount, ...(buttons !== undefined ? { buttons } : {}), ...(modifiers !== undefined ? { modifiers } : {}) };
  }
  if (kind === "keydown" || kind === "keyup") {
    if (typeof body.key !== "string" || !body.key) return null;
    const code = typeof body.code === "string" ? body.code : undefined;
    const text = typeof body.text === "string" ? body.text : undefined;
    return { kind, key: body.key, ...(code ? { code } : {}), ...(text ? { text } : {}), ...(modifiers !== undefined ? { modifiers } : {}) };
  }
  if (kind === "text") {
    if (typeof body.text !== "string" || !body.text) return null;
    return { kind, text: body.text };
  }
  return null;
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function parseAppearance(body: Record<string, unknown>): { deviceScaleFactor?: number; colorScheme?: "dark" | "light" } | undefined {
  const deviceScaleFactor = typeof body.deviceScaleFactor === "number" ? body.deviceScaleFactor : undefined;
  const colorScheme = body.colorScheme === "dark" || body.colorScheme === "light" ? body.colorScheme : undefined;
  if (deviceScaleFactor === undefined && colorScheme === undefined) return undefined;
  return {
    ...(deviceScaleFactor !== undefined ? { deviceScaleFactor } : {}),
    ...(colorScheme !== undefined ? { colorScheme } : {}),
  };
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

export function createBrowserHttpHandler(service: BrowserService) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const urlObj = new URL(req.url ?? "/", "http://127.0.0.1");
    const pathname = urlObj.pathname;
    if (!pathname.startsWith("/api/browser/")) return false;
    const method = (req.method ?? "GET").toUpperCase();

    try {
      const sessionId = urlObj.searchParams.get("sessionId") || "default";

      if (method === "GET" && pathname === "/api/browser/state") {
        sendJson(res, 200, { state: await service.getSnapshot(sessionId) });
        return true;
      }

      if (method === "GET" && pathname === "/api/browser/stream") {
        const dprRaw = Number(urlObj.searchParams.get("dpr"));
        const themeRaw = urlObj.searchParams.get("theme");
        const appearance = {
          ...(Number.isFinite(dprRaw) && dprRaw > 0 ? { deviceScaleFactor: dprRaw } : {}),
          ...(themeRaw === "light" || themeRaw === "dark" ? { colorScheme: themeRaw as "light" | "dark" } : {}),
        };
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");
        res.flushHeaders?.();
        let closed = false;
        const off = service.subscribeStream(sessionId, (frame) => {
          if (closed || res.writableEnded) return;
          res.write(`event: frame\ndata: ${JSON.stringify(frame)}\n\n`);
        }, appearance);
        const pingTimer = setInterval(() => {
          if (!closed && !res.writableEnded) res.write(": ping\n\n");
        }, 15_000);
        const cleanup = () => {
          if (closed) return;
          closed = true;
          clearInterval(pingTimer);
          off();
        };
        req.on("close", cleanup);
        res.on("close", cleanup);
        return true;
      }

      if (method === "GET" && pathname === "/api/browser/console") {
        sendJson(res, 200, { items: service.getConsole(sessionId) });
        return true;
      }

      if (method === "GET" && pathname === "/api/browser/network") {
        sendJson(res, 200, { items: service.getNetwork(sessionId) });
        return true;
      }

      if (method === "POST" && pathname === "/api/browser/logs/clear") {
        const body = await readJsonBody(req);
        const sid = typeof body.sessionId === "string" && body.sessionId ? body.sessionId : sessionId;
        service.clearLogs(sid);
        sendJson(res, 200, { cleared: true });
        return true;
      }

      if (method === "GET" && pathname === "/api/browser/config") {
        sendJson(res, 200, { config: await service.getSettings() });
        return true;
      }

      if (method === "PUT" && pathname === "/api/browser/config") {
        const body = await readJsonBody(req);
        const config = await service.updateSettings(body);
        sendJson(res, 200, { config });
        return true;
      }

      if (method === "POST" && pathname === "/api/browser/viewport") {
        const body = await readJsonBody(req);
        const sid = typeof body.sessionId === "string" && body.sessionId ? body.sessionId : sessionId;
        const width = typeof body.width === "number" ? body.width : 1024;
        const height = typeof body.height === "number" ? body.height : 768;
        sendJson(res, 200, { state: await service.setViewport(sid, width, height, parseAppearance(body)) });
        return true;
      }

      if (method === "POST" && pathname === "/api/browser/tabs") {
        const body = await readJsonBody(req);
        const sid = typeof body.sessionId === "string" && body.sessionId ? body.sessionId : sessionId;
        const action = typeof body.action === "string" ? body.action : "new";
        if (action === "activate" && typeof body.tabId === "string") {
          sendJson(res, 200, { state: await service.activateTab(sid, body.tabId) });
          return true;
        }
        if (action === "close" && typeof body.tabId === "string") {
          sendJson(res, 200, { state: await service.closeTab(sid, body.tabId) });
          return true;
        }
        const vpRaw = body.viewport as { width?: unknown; height?: unknown } | undefined;
        const viewport = vpRaw && typeof vpRaw.width === "number" && typeof vpRaw.height === "number"
          ? { width: vpRaw.width, height: vpRaw.height }
          : undefined;
        sendJson(res, 200, {
          state: await service.createTab(sid, typeof body.url === "string" ? body.url : undefined, viewport, parseAppearance(body)),
        });
        return true;
      }

      if (method === "POST" && pathname === "/api/browser/navigate") {
        const body = await readJsonBody(req);
        const sid = typeof body.sessionId === "string" && body.sessionId ? body.sessionId : sessionId;
        const url = typeof body.url === "string" ? body.url : "";
        const vpRaw = body.viewport as { width?: unknown; height?: unknown } | undefined;
        const viewport = vpRaw && typeof vpRaw.width === "number" && typeof vpRaw.height === "number"
          ? { width: vpRaw.width, height: vpRaw.height }
          : undefined;
        sendJson(res, 200, { state: await service.navigate(sid, url, viewport, parseAppearance(body)) });
        return true;
      }

      if (method === "POST" && pathname === "/api/browser/back") {
        const body = await readJsonBody(req);
        const sid = typeof body.sessionId === "string" && body.sessionId ? body.sessionId : sessionId;
        sendJson(res, 200, { state: await service.goBack(sid) });
        return true;
      }

      if (method === "POST" && pathname === "/api/browser/forward") {
        const body = await readJsonBody(req);
        const sid = typeof body.sessionId === "string" && body.sessionId ? body.sessionId : sessionId;
        sendJson(res, 200, { state: await service.goForward(sid) });
        return true;
      }

      if (method === "POST" && pathname === "/api/browser/reload") {
        const body = await readJsonBody(req);
        const sid = typeof body.sessionId === "string" && body.sessionId ? body.sessionId : sessionId;
        sendJson(res, 200, { state: await service.reload(sid) });
        return true;
      }

      if (method === "POST" && pathname === "/api/browser/input") {
        const body = await readJsonBody(req);
        const sid = typeof body.sessionId === "string" && body.sessionId ? body.sessionId : sessionId;
        const payload = parseInputPayload(body);
        if (!payload) {
          sendJson(res, 400, { error: "无效的浏览器输入事件负载。" });
          return true;
        }
        await service.dispatchInput(sid, payload);
        res.statusCode = 204;
        res.end();
        return true;
      }

      if (method === "POST" && pathname === "/api/browser/action") {
        const body = await readJsonBody(req);
        const sid = typeof body.sessionId === "string" && body.sessionId ? body.sessionId : sessionId;
        const kind = typeof body.kind === "string" ? body.kind : "";
        const fast = body.fast === true;
        if (kind === "click") {
          const button = body.button === "right" || body.button === "middle" ? body.button : "left";
          const state = await service.click(sid, {
            ...(typeof body.ref === "string" ? { ref: body.ref } : {}),
            ...(typeof body.x === "number" ? { x: body.x } : {}),
            ...(typeof body.y === "number" ? { y: body.y } : {}),
            button,
            ...(typeof body.clickCount === "number" ? { clickCount: body.clickCount } : {}),
          }, fast);
          sendJson(res, 200, { state });
          return true;
        }
        if (kind === "hover") {
          const state = await service.hover(sid, {
            ...(typeof body.ref === "string" ? { ref: body.ref } : {}),
            ...(typeof body.x === "number" ? { x: body.x } : {}),
            ...(typeof body.y === "number" ? { y: body.y } : {}),
          }, fast);
          sendJson(res, 200, { state });
          return true;
        }
        if (kind === "type") {
          const state = await service.typeText(sid, {
            ...(typeof body.ref === "string" ? { ref: body.ref } : {}),
            text: typeof body.text === "string" ? body.text : "",
            submit: body.submit === true,
          }, fast);
          sendJson(res, 200, { state });
          return true;
        }
        if (kind === "key") {
          const state = await service.pressKey(sid, typeof body.key === "string" ? body.key : "Enter", fast);
          sendJson(res, 200, { state });
          return true;
        }
        if (kind === "scroll") {
          const deltaY = typeof body.deltaY === "number" ? body.deltaY : 400;
          const deltaX = typeof body.deltaX === "number" ? body.deltaX : 0;
          const point = typeof body.x === "number" && typeof body.y === "number"
            ? { x: body.x, y: body.y }
            : undefined;
          const state = await service.scroll(sid, deltaY, deltaX, fast, point);
          sendJson(res, 200, { state });
          return true;
        }
        sendJson(res, 400, { error: "未知浏览器操作类型。" });
        return true;
      }

      if (method === "POST" && pathname === "/api/browser/takeover") {
        const body = await readJsonBody(req);
        const sid = typeof body.sessionId === "string" && body.sessionId ? body.sessionId : sessionId;
        if (body.openWindow === true) {
          sendJson(res, 200, { state: await service.openDesktopTakeoverWindow(sid) });
          return true;
        }
        const paused = body.paused === true;
        const state = await service.setTakeoverAndSnapshot(sid, paused);
        sendJson(res, 200, { state });
        return true;
      }

      if (method === "POST" && pathname === "/api/browser/close") {
        const body = await readJsonBody(req);
        const sid = typeof body.sessionId === "string" && body.sessionId ? body.sessionId : sessionId;
        await service.closeSession(sid);
        sendJson(res, 200, { state: await service.getSnapshot(sid) });
        return true;
      }

      sendJson(res, 404, { error: "未找到浏览器接口路由。" });
      return true;
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
      return true;
    }
  };
}
