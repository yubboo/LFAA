/**
 * 文件：plugin-manager-bridge.ts
 * 作用：把唯一 PluginManager 事务安全地暴露给本地 Web 设置中心。
 * 负责：同源开发 HTTP API、Profile 初始化、inspect/install/enable/remove/cancel、结果 JSON 化。
 * 不负责：React UI、直接 import 第三方插件代码、Secret 明文、Agent Tool 安装逻辑。
 * 状态归属：NodePluginPackageHost 持有安装子进程；PluginManager/Registry 持有当前开发进程 generation。
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { PluginManager, PluginRegistry } from "@lfaa/plugin-runtime";
import { NodePluginPackageHost } from "@lfaa/plugin-host-node";
import type { Plugin } from "vite";

const BASE = "/__lfaa/dev/plugins";
const MAX_BODY_BYTES = 64 * 1024;

function send(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.setHeader("x-content-type-options", "nosniff");
  response.end(JSON.stringify(payload));
}

function isSameOrigin(request: IncomingMessage): boolean {
  const origin = request.headers.origin;
  if (!origin) return false;
  const host = request.headers.host;
  if (!host) return false;
  try {
    const url = new URL(origin);
    return url.protocol === "http:" && url.host === host && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  } catch { return false; }
}

async function readBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > MAX_BODY_BYTES) throw new Error("请求体过大。");
    chunks.push(buffer);
  }
  if (!chunks.length) return {};
  const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("请求体必须是 JSON object。");
  return parsed as Record<string, unknown>;
}

function serializableSnapshot(snapshot: Awaited<ReturnType<PluginManager["snapshot"]>>) {
  return {
    installed: snapshot.installed,
    registry: {
      generation: snapshot.registry.generation,
      plugins: [...snapshot.registry.plugins.values()],
      capabilities: [...snapshot.registry.capabilities.values()],
    },
  };
}

export function lfaaDevPluginManagerBridge(projectRoot: string): Plugin {
  const host = new NodePluginPackageHost({ projectRoot });
  const manager = new PluginManager(host, new PluginRegistry());
  let hydrated: Promise<void> | null = null;
  const ensureHydrated = () => hydrated ??= manager.hydrate().then(() => undefined);

  return {
    name: "lfaa-dev-plugin-manager-bridge",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
        if (!pathname.startsWith(BASE)) { next(); return; }
        try {
          await ensureHydrated();
          if (request.method === "GET" && pathname === `${BASE}/snapshot`) {
            send(response, 200, { ok: true, snapshot: serializableSnapshot(await manager.snapshot()) });
            return;
          }
          if (request.method !== "GET" && !isSameOrigin(request)) {
            send(response, 403, { ok: false, error: "插件管理只接受当前 LFAA 本地页面的同源写操作。" });
            return;
          }
          const body = await readBody(request);
          if (request.method === "POST" && pathname === `${BASE}/inspect`) {
            const spec = typeof body.spec === "string" ? body.spec : "";
            send(response, 200, { ok: true, inspection: await manager.inspect(spec) });
            return;
          }
          if (request.method === "POST" && pathname === `${BASE}/install`) {
            const spec = typeof body.spec === "string" ? body.spec : "";
            const requestId = typeof body.requestId === "string" ? body.requestId : "";
            const approvedBuilds = Array.isArray(body.approvedBuilds) && body.approvedBuilds.every((item) => typeof item === "string")
              ? body.approvedBuilds as string[] : undefined;
            if (!/^[0-9a-f-]{20,64}$/i.test(requestId)) throw new Error("插件安装 requestId 无效。");
            const progress: unknown[] = [];
            const outcome = await manager.install(spec, { requestId, ...(approvedBuilds ? { approvedBuilds } : {}), onProgress: (event) => progress.push(event) });
            const snapshot = await manager.snapshot();
            server.ws.send({ type: "custom", event: "lfaa:plugins-changed", data: { generation: snapshot.registry.generation } });
            send(response, 200, { ok: true, outcome, progress, snapshot: serializableSnapshot(snapshot) });
            return;
          }
          if (request.method === "POST" && pathname === `${BASE}/enable`) {
            const packageName = typeof body.packageName === "string" ? body.packageName : "";
            const enabled = body.enabled === true;
            const snapshot = await manager.setEnabled(packageName, enabled);
            server.ws.send({ type: "custom", event: "lfaa:plugins-changed", data: { generation: snapshot.registry.generation } });
            send(response, 200, { ok: true, snapshot: serializableSnapshot(snapshot) });
            return;
          }
          if (request.method === "POST" && pathname === `${BASE}/remove`) {
            const packageName = typeof body.packageName === "string" ? body.packageName : "";
            const snapshot = await manager.remove(packageName);
            server.ws.send({ type: "custom", event: "lfaa:plugins-changed", data: { generation: snapshot.registry.generation } });
            send(response, 200, { ok: true, snapshot: serializableSnapshot(snapshot) });
            return;
          }
          if (request.method === "POST" && pathname === `${BASE}/cancel`) {
            const requestId = typeof body.requestId === "string" ? body.requestId : "";
            await manager.cancel(requestId);
            send(response, 200, { ok: true });
            return;
          }
          send(response, 404, { ok: false, error: "未知插件管理路由。" });
        } catch (error) {
          send(response, 400, { ok: false, error: error instanceof Error ? error.message : "插件管理操作失败。" });
        }
      });
    },
  };
}
