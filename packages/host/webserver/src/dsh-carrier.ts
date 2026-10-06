/**
 * 功能：把 LFAA 现有 Express/HTTP Host 适配为 DSH 插件使用的 WebServer 合同。
 * 作用：复用 DSH Client Modules 的路由与 index 注入协议，不再启动第二个 HTTP 服务。
 * 关联文件：server.ts、http-delivery.ts、@deepseek-ai/dsh-client-modules。
 */
import type { Context } from "@deepseek-ai/cordis";
import type { RequestHandler } from "express";
import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { requireAuthentication, resolveSocketSessionFromCookieHeader } from "lfaa-authorization/src/middleware.js";
import { renderIndexInjections, type IndexInjection, type WebRoute, type WebRouteKind, type WebUpgradeRoute } from "@deepseek-ai/dsh-host-webserver";
import type { WebServer } from "@deepseek-ai/dsh-host-webserver";

type RouteRecord = WebRoute & { readonly public: boolean };
export type DshHandlerAdapter = (request: import("express").Request, response: import("express").Response, dispatch: (request?: import("express").Request, response?: import("express").Response) => void | Promise<void>) => void | Promise<void>;
type WebServerFacade = Pick<WebServer, "host" | "port" | "register" | "registerUpgrade" | "registerFallback" | "tapIndex" | "applyIndexTaps" | "collectIndexInjections" | "renderIndex">;

const CLIENT_BUNDLE_PATH = "/plugins";
const CLIENT_EVENTS_PATH = `${CLIENT_BUNDLE_PATH}/events`;

/** DSH's client bundles are public bootstrap assets; other plugin routes require an LFAA session. */
function isPublicBundleRoute(route: WebRoute): boolean {
  return route.path === CLIENT_BUNDLE_PATH && route.kind === "prefix";
}

/** DSH 生成的插件 bundle URL 是相对路径；HTML head 注入早于 LFAA 的 base 标签，需先锚定站点根。 */
function normalizeDshBundleInjection(row: IndexInjection): IndexInjection {
  if ((row.kind === "script-src" || row.kind === "script-preload") && row.src.startsWith("plugins/")) {
    return { ...row, src: `/${row.src}` };
  }
  return row;
}

function validatePath(kind: WebRouteKind, path: string): void {
  if (path === "/" || !path.startsWith("/") || path.startsWith("//") || path.includes("?") || path.includes("#")
    || path.includes("\\") || path.split("/").some((part) => part === "." || part === "..")
    || path.length > 256 || (path.length > 1 && path.endsWith("/"))) {
    throw new Error(`DSH WebServer 路由路径无效：${path}`);
  }
  if (path === CLIENT_BUNDLE_PATH) {
    if (kind === "prefix") return;
    throw new Error("/plugins 保留给 DSH Client Modules 的公开、只读 bundle 路由。");
  }
  // This exact route belongs to upstream @deepseek-ai/dsh-client-hmr. It is
  // private by default; the public bundle prefix remains GET/HEAD-only.
  if (path === CLIENT_EVENTS_PATH) {
    if (kind === "exact") return;
    throw new Error("/plugins/events 保留给 DSH Client HMR 的认证事件通道。");
  }
  if (path.startsWith(`${CLIENT_BUNDLE_PATH}/`)) throw new Error("/plugins 子路径保留给 DSH Client Modules 的 bundle 资源。");
}

/** Express-backed carrier for the upstream DSH route and index-injection contract. */
export class DshWebServerCarrier {
  private readonly exactRoutes = new Map<string, RouteRecord>();
  private readonly prefixRoutes = new Map<string, RouteRecord>();
  private readonly upgradeRoutes = new Map<string, WebUpgradeRoute>();
  private readonly indexTransforms: Array<(html: string) => string> = [];
  private readonly handlerAdapters = new Map<string, { owner: object; adapter: DshHandlerAdapter }>();
  private server: Server | undefined;
  private readonly publicApi: WebServerFacade;

  constructor(private readonly context: Context, private readonly host: string, private readonly configuredPort: number) {
    const carrier = this;
    // Cordis types the upstream service as a concrete Service class. This
    // facade implements its public carrier contract while keeping LFAA's
    // already-listening Express server as the only network owner.
    this.publicApi = {
      get host() { return carrier.host as "127.0.0.1" | "0.0.0.0"; },
      get port() { return carrier.port; },
      register: (route) => carrier.register(route),
      registerUpgrade: (route) => carrier.registerUpgrade(route),
      registerFallback: () => { throw new Error("LFAA SPA 拥有唯一 HTTP fallback；DSH 插件应登记具名路由。"); },
      tapIndex: (transform) => carrier.tapIndex(transform),
      applyIndexTaps: (html) => carrier.applyIndexTaps(html),
      collectIndexInjections: () => carrier.collectIndexInjections(),
      renderIndex: (html) => carrier.renderIndex(html)
    };
    Object.assign(this.publicApi, { registerHandlerAdapter: (owner: object, path: string, adapter: DshHandlerAdapter) => carrier.registerHandlerAdapter(owner, path, adapter) });
  }

  get port(): number {
    try {
      const address = this.server?.address();
      return address && typeof address === "object" ? address.port : this.configuredPort;
    } catch {
      return this.configuredPort;
    }
  }

  provide(): void {
    this.context.provide("webServer", this.publicApi as unknown as WebServer);
  }

  bind(server: Server): void {
    if (this.server) throw new Error("DSH WebServer carrier 已绑定 HTTP Host。");
    this.server = server;
    server.on("upgrade", (request, socket, head) => this.dispatchUpgrade(request, socket, head));
  }

  register(route: WebRoute): () => void {
    validatePath(route.kind, route.path);
    const table = route.kind === "exact" ? this.exactRoutes : this.prefixRoutes;
    if (table.has(route.path)) throw new Error(`DSH WebServer 路由重复：${route.kind} ${route.path}`);
    const record: RouteRecord = { ...route, public: isPublicBundleRoute(route) };
    table.set(route.path, record);
    return () => { if (table.get(route.path) === record) table.delete(route.path); };
  }

  registerHandlerAdapter(owner: object, path: string, adapter: DshHandlerAdapter): () => void {
    validatePath("exact", path);
    if (this.handlerAdapters.has(path)) throw new Error(`DSH WebServer 路由适配器重复：${path}`);
    const record = { owner, adapter };
    this.handlerAdapters.set(path, record);
    return () => { if (this.handlerAdapters.get(path) === record) this.handlerAdapters.delete(path); };
  }

  registerUpgrade(route: WebUpgradeRoute): () => void {
    validatePath("exact", route.path);
    if (route.path === CLIENT_BUNDLE_PATH || route.path.startsWith(`${CLIENT_BUNDLE_PATH}/`)) {
      throw new Error("/plugins 不可由第三方 DSH 插件登记 WebSocket 路由。");
    }
    if (this.upgradeRoutes.has(route.path)) throw new Error(`DSH WebServer upgrade 路由重复：${route.path}`);
    this.upgradeRoutes.set(route.path, route);
    return () => { if (this.upgradeRoutes.get(route.path) === route) this.upgradeRoutes.delete(route.path); };
  }

  tapIndex(transform: (html: string) => string): () => void {
    this.indexTransforms.push(transform);
    return () => {
      const index = this.indexTransforms.indexOf(transform);
      if (index !== -1) this.indexTransforms.splice(index, 1);
    };
  }

  applyIndexTaps(html: string): string {
    return this.indexTransforms.reduce((current, transform) => transform(current), html);
  }

  collectIndexInjections(): IndexInjection[] {
    const rows: IndexInjection[] = [];
    this.context.emit("webserver/index-inject", rows);
    return rows.map(normalizeDshBundleInjection);
  }

  renderIndex(html: string): string {
    return this.applyIndexTaps(renderIndexInjections(html, this.collectIndexInjections()));
  }

  middleware(): RequestHandler {
    return (request, response, next) => {
      let pathname: string;
      try { pathname = new URL(request.path, "http://lfaa.invalid").pathname; }
      catch { response.status(400).json({ error: "invalid_path", message: "请求路径无效。" }); return; }
      const route = this.match(pathname);
      if (!route) { next(); return; }
        const dispatchRoute = (adaptedRequest: import("express").Request = request, adaptedResponse: import("express").Response = response) => {
          return route.handler(adaptedRequest, adaptedResponse);
        };
        const dispatch = () => {
        const adapted = this.handlerAdapters.get(pathname)?.adapter;
        void Promise.resolve().then(() => adapted
            ? adapted(request, response, dispatchRoute)
          : route.handler(request, response)).catch(next);
      };
      if (route.public && (request.method === "GET" || request.method === "HEAD")) dispatch();
      else requireAuthentication(request, response, dispatch);
    };
  }

  private match(pathname: string): RouteRecord | undefined {
    const exact = this.exactRoutes.get(pathname);
    if (exact) return exact;
    let selected: RouteRecord | undefined;
    for (const [prefix, route] of this.prefixRoutes) {
      if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) continue;
      if (!selected || prefix.length > selected.path.length) selected = route;
    }
    return selected;
  }

  private dispatchUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void {
    let pathname: string;
    try { pathname = new URL(request.url ?? "/", "http://lfaa.invalid").pathname; }
    catch { socket.destroy(); return; }
    const route = this.upgradeRoutes.get(pathname);
    if (!route) return;
    if (!resolveSocketSessionFromCookieHeader(request.headers.cookie)) {
      socket.end("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      return;
    }
    try {
      Promise.resolve(route.handler(request, socket, head)).catch(() => socket.destroy());
    } catch {
      socket.destroy();
    }
  }
}

export function mountDshWebRoutes(carrier: DshWebServerCarrier, app: import("express").Express): void {
  app.use(carrier.middleware());
}
