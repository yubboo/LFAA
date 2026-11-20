// 为本机 Web 服务提供 /api/plugins/* HTTP 接口，管理插件安装、启用、停用、卸载、编辑与二创。
import type { IncomingMessage, ServerResponse } from "node:http";
import type { PluginsService } from "./index";

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

/** 处理 /api/plugins 路由，未命中则返回 false。 */
export function createPluginsHttpHandler(service: PluginsService) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const urlObj = new URL(req.url ?? "/", "http://127.0.0.1");
    const pathname = urlObj.pathname;
    if (pathname !== "/api/plugins" && !pathname.startsWith("/api/plugins/")) return false;
    const method = (req.method ?? "GET").toUpperCase();

    try {
      if (method === "GET" && pathname === "/api/plugins") {
        const state = await service.listState();
        sendJson(res, 200, state);
        return true;
      }

      if (method === "POST" && pathname === "/api/plugins/install") {
        const body = await readJsonBody(req);
        const plugin = await service.installPlugin({
          ...(typeof body.moduleName === "string" && body.moduleName.trim() ? { moduleName: body.moduleName.trim() } : {}),
          ...(typeof body.catalogId === "string" ? { catalogId: body.catalogId } : {}),
        });
        const state = await service.listState();
        sendJson(res, 200, { plugin, ...state });
        return true;
      }

      // 流式安装：POST + JSON 请求体 + SSE 响应，逐行推送 pnpm 输出，最后一条 done 携带完整状态。
      // 安装会写入 profile 依赖，必须保持非幂等语义，因此不再接受 GET 触发。
      if (pathname === "/api/plugins/add/stream" && method !== "POST") {
        res.setHeader("Allow", "POST");
        sendJson(res, 405, { error: "流式安装只接受 POST。" });
        return true;
      }
      if (method === "POST" && pathname === "/api/plugins/add/stream") {
        const body = await readJsonBody(req);
        const spec = typeof body.spec === "string" ? body.spec : "";
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        const send = (event: string, payload: unknown) => {
          res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
        };
        try {
          const plugin = await service.addExternal(spec, (line) => send("log", line));
          send("done", { plugin, ...(await service.listState()) });
        } catch (error) {
          send("failed", { error: error instanceof Error ? error.message : String(error) });
        }
        res.end();
        return true;
      }

      if (method === "POST" && pathname === "/api/plugins/preset") {
        const body = await readJsonBody(req);
        const id = typeof body.id === "string" ? body.id : "";
        await service.setPreset(id);
        sendJson(res, 200, await service.listState());
        return true;
      }

      if (method === "POST" && pathname === "/api/plugins/add") {
        const body = await readJsonBody(req);
        const spec = typeof body.spec === "string" ? body.spec : "";
        const plugin = await service.addExternal(spec);
        sendJson(res, 200, { plugin, ...(await service.listState()) });
        return true;
      }

      if (method === "POST" && pathname === "/api/plugins/builtin/enable") {
        const body = await readJsonBody(req);
        const moduleName = typeof body.moduleName === "string" ? body.moduleName.trim() : "";
        if (!moduleName) throw new Error("缺少内置插件包名。");
        const plugin = await service.enableBuiltin(moduleName);
        sendJson(res, 200, { plugin, ...(await service.listState()) });
        return true;
      }

      if (method === "POST" && pathname.endsWith("/enable")) {
        const id = decodeURIComponent(pathname.slice("/api/plugins/".length, -"/enable".length));
        const plugin = await service.enablePlugin(id);
        const state = await service.listState();
        sendJson(res, 200, { plugin, ...state });
        return true;
      }

      if (method === "POST" && pathname.endsWith("/disable")) {
        const id = decodeURIComponent(pathname.slice("/api/plugins/".length, -"/disable".length));
        const plugin = await service.disablePlugin(id);
        const state = await service.listState();
        sendJson(res, 200, { plugin, ...state });
        return true;
      }

      if (method === "POST" && pathname.endsWith("/uninstall")) {
        const id = decodeURIComponent(pathname.slice("/api/plugins/".length, -"/uninstall".length));
        await service.uninstallPlugin(id);
        const state = await service.listState();
        sendJson(res, 200, state);
        return true;
      }

      if (method === "POST" && pathname.endsWith("/fork")) {
        const id = decodeURIComponent(pathname.slice("/api/plugins/".length, -"/fork".length));
        const plugin = await service.forkPlugin(id);
        const state = await service.listState();
        sendJson(res, 200, { plugin, ...state });
        return true;
      }

      if (method === "POST" && pathname.endsWith("/update")) {
        const id = decodeURIComponent(pathname.slice("/api/plugins/".length, -"/update".length));
        const body = await readJsonBody(req);
        const plugin = await service.updateManifest(id, {
          ...(typeof body.name === "string" ? { name: body.name } : {}),
          ...(typeof body.description === "string" ? { description: body.description } : {}),
        });
        const state = await service.listState();
        sendJson(res, 200, { plugin, ...state });
        return true;
      }

      sendJson(res, 404, { error: "未找到插件接口路由。" });
      return true;
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
      return true;
    }
  };
}
