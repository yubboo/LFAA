// @lfaa/web-server：生产模式宿主：只监听本机，静态托管 Web 产物，并把 /api 交给同一套网关与一次性令牌。
// 文件细节（MIME/穿越防护/Range/缓存）在 static-files 中，这里只负责服务器生命周期与路由。
import { readFile, stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { join, resolve } from "node:path";
import { checkApiAuth, checkApiWriteContentType, isApiPath, type ApiGateway } from "@lfaa/api-gateway";
import { createHostRuntime } from "./runtime";
import {
  firstHeader,
  injectToken,
  resolveStaticPath,
  sendJson,
  serveFile,
  serveIndex,
  type StaticRequestContext,
} from "./static-files";

/** 生产静态服务器参数（不装配运行时，便于单测直接注入假网关）。 */
export interface StaticServerOptions {
  /** 已构建的 Web 产物根目录（含 index.html 与 assets/）。 */
  webRoot: string;
  /** 启动时生成的一次性接口令牌。 */
  token: string;
  gateway: Pick<ApiGateway, "handle">;
  host?: string;
  port?: number;
  /** 关闭服务器后的清理回调（由 startHostServer 用来释放运行时）。 */
  onStop?: () => Promise<void>;
}

export interface StaticServer {
  /** 可直接交给 BrowserWindow.loadURL 的本机地址。 */
  url: string;
  port: number;
  stop(): Promise<void>;
}

/** 生产宿主参数：自带运行时装配，外部只需给出资源与用户工作根。 */
export interface HostServerOptions {
  webRoot: string;
  projectRoot: string;
  host?: string;
  port?: number;
  profile?: string;
  loaderBaseUrl?: string;
}

export interface HostServer extends StaticServer {}

/** 启动生产宿主：先装配运行时，再起静态服务器；任一环节失败都不留半启动状态。 */
export async function startHostServer(options: HostServerOptions): Promise<HostServer> {
  const runtime = await createHostRuntime({
    projectRoot: options.projectRoot,
    ...(options.loaderBaseUrl ? { loaderBaseUrl: options.loaderBaseUrl } : {}),
    ...(options.profile ? { profile: options.profile } : {}),
  });
  try {
    return await startStaticServer({
      webRoot: options.webRoot,
      token: runtime.token,
      gateway: runtime.gateway,
      ...(options.host ? { host: options.host } : {}),
      ...(options.port !== undefined ? { port: options.port } : {}),
      onStop: () => runtime.dispose(),
    });
  } catch (error) {
    await runtime.dispose();
    throw error;
  }
}

/** 启动静态托管本机服务；返回真实端口与幂等 stop。 */
export async function startStaticServer(options: StaticServerOptions): Promise<StaticServer> {
  const webRoot = resolve(options.webRoot);
  const assetsRoot = join(webRoot, "assets");
  const indexHtml = injectToken(await readFile(join(webRoot, "index.html"), "utf8"), options.token);
  const host = options.host ?? "127.0.0.1";

  const server = createServer((req, res) => {
    handleRequest(req, res, { webRoot, assetsRoot, indexHtml, token: options.token, gateway: options.gateway })
      .catch((error: unknown) => {
        console.error("LFAA 本机服务处理请求失败：", error);
        if (res.headersSent) {
          res.destroy();
          return;
        }
        sendJson(res, 500, { error: isApiPath(req.url) ? "本机接口处理失败。" : "静态资源读取失败。" });
      });
  });

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(options.port ?? 0, host, () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    await new Promise<void>((done) => server.close(() => done()));
    throw new Error("本机服务未取得可用端口。");
  }
  const port = (address as AddressInfo).port;

  let isStopped = false;
  return {
    url: `http://${host}:${port}/`,
    port,
    async stop() {
      if (isStopped) return;
      isStopped = true;
      await new Promise<void>((done) => {
        server.close(() => done());
        // keep-alive 连接会拖住 close，这里统一断开，保证桌面端退出后不残留进程。
        server.closeAllConnections();
      });
      await options.onStop?.();
    },
  };
}

/** 请求入口：/api 走网关，其余走静态资源。 */
async function handleRequest(req: IncomingMessage, res: ServerResponse, context: StaticRequestContext): Promise<void> {
  const rawUrl = req.url ?? "/";
  if (isApiPath(rawUrl)) {
    await handleApi(req, res, context);
    return;
  }
  const pathname = rawUrl.split("?")[0] || "/";
  await handleStatic(req, res, context, pathname);
}

/** 本机接口：先鉴权，再校验写请求内容类型，未命中返回 JSON 404（绝不回退 HTML）。 */
async function handleApi(
  req: IncomingMessage,
  res: ServerResponse,
  context: StaticRequestContext,
): Promise<void> {
  const decision = checkApiAuth(req, { token: context.token });
  if (!decision.allowed) {
    sendJson(res, decision.status, { error: decision.reason });
    return;
  }
  const contentTypeDecision = checkApiWriteContentType(req);
  if (!contentTypeDecision.allowed) {
    sendJson(res, contentTypeDecision.status, { error: contentTypeDecision.reason });
    return;
  }
  const handled = await context.gateway.handle(req, res);
  if (!handled) sendJson(res, 404, { error: "未找到本机接口。" });
}

/** 静态资源：只读、防穿越、支持 Range 与 SPA 回退。 */
async function handleStatic(
  req: IncomingMessage,
  res: ServerResponse,
  context: StaticRequestContext,
  pathname: string,
): Promise<void> {
  const method = (req.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD");
    res.end();
    return;
  }

  const target = resolveStaticPath(context.webRoot, pathname);
  if (!target) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("请求路径不合法。");
    return;
  }

  // 直接请求 /index.html 也必须走注入了本机接口令牌的 serveIndex，避免拿到未注入令牌的原始文件导致 401。
  if (target === join(context.webRoot, "index.html")) {
    serveIndex(req, res, context.indexHtml);
    return;
  }

  const info = await stat(target).catch(() => null);
  if (info?.isFile()) {
    await serveFile(req, res, target, context.assetsRoot);
    return;
  }
  // 根路径就是应用入口；其他真实目录不列目录，按缺失处理。
  if (info?.isDirectory() && target === context.webRoot) {
    serveIndex(req, res, context.indexHtml);
    return;
  }
  // SPA 回退只给页面请求；找不到的静态文件仍是 404，避免把 HTML 当成图片/脚本。
  const accept = firstHeader(req.headers.accept) ?? "";
  if (accept.includes("text/html")) {
    serveIndex(req, res, context.indexHtml);
    return;
  }
  res.statusCode = 404;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end("未找到静态资源。");
}