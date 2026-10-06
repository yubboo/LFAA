/**
 * 功能：启动 LFAA 控制端 HTTP 服务。
 * 作用：装配安全响应头、请求日志、JSON API、错误响应和进程关闭处理。
 * 关联文件：http-delivery.ts 提供静态交付与日志分级；packages/util/launch-environment/src/config.ts、packages/api/gateway/src/index.ts、packages/boot/app-boot/src/ai-host.ts 提供配置与业务服务。
 */
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { resolve } from "node:path";
import type { Context } from "@deepseek-ai/cordis";
import express, { type NextFunction, type Request, type Response } from "express";
import { ApiError } from "lfaa-util-values/src/http-error.js";
import "lfaa-api-gateway/src/index.js";
import { config } from "lfaa-launch-environment/src/config.js";
import { logger } from "lfaa-telemetry-logger/src/logger.js";
import { createAiPluginHost } from "lfaa-app-boot/src/ai-host.js";
import { createRealtimeSocketServer } from "lfaa-api-remotes/src/socket-server.js";
import { requestLogLevel, serveFrontend } from "./http-delivery.js";
import { DshWebServerCarrier, mountDshWebRoutes } from "./dsh-carrier.js";

export const name = "lfaaWebserver";
export const inject = ["apiGateway", "aiExtensions", "aiRuntimeHooks", "lfaaSettings", "lfaaAuth", "lfaaMinecraft", "lfaaSteamcmd", "lfaaWriting"];
export async function apply(ctx: Context): Promise<void> {
const app = express();
app.disable("x-powered-by");
// 远程节点使用 HTTPS；仅在部署明确启用时信任本机 TLS 反向代理，拒绝任意来源伪造转发协议。
if (process.env.LFAA_TRUST_LOOPBACK_PROXY === "true") app.set("trust proxy", "loopback");

app.use((request, response, next) => {
  const requestId = randomUUID();
  const requestPath = request.path;
  const startedAt = Date.now();
  response.locals.requestId = requestId;
  response.setHeader("X-Request-Id", requestId);
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Cache-Control", "no-store");

  response.on("finish", () => {
    const logFields = {
      requestId,
      method: request.method,
      path: requestPath,
      statusCode: response.statusCode,
      durationMilliseconds: Date.now() - startedAt
    };
    logger.log(requestLogLevel(request.method, requestPath, response.statusCode), "HTTP 请求完成", logFields);
  });

  next();
});

// API routes consume JSON here; DSH plugin routes retain their raw request stream
// for bounded host-side adapters such as Wallpaper Engine settings.
app.use("/api", express.json({ limit: "5mb" }));
const aiPluginHost = createAiPluginHost(ctx);
const dshWebServer = new DshWebServerCarrier(ctx, config.host, config.port);
dshWebServer.provide();
const server = createServer(app);
dshWebServer.bind(server);
const realtime = createRealtimeSocketServer(server);
app.use("/api", ctx.apiGateway.createRouter(ctx, aiPluginHost, realtime));
app.get("/__dsh/index-injections", (_request, response) => {
  const injections = dshWebServer.collectIndexInjections();
  if (!injections.some((row) => row.kind === "global" && row.name === "__DSH_BOOT__")) {
    response.status(503).json({ error: "dsh_runtime_not_ready", message: "DSH Client Runtime 尚未完成装配。" });
    return;
  }
  // This public read-only payload is the same bootstrap graph that the
  // production HTML serves; the Vite dev shell applies it with DSH's renderer.
  response.setHeader("Cache-Control", "public, no-cache");
  response.json(injections);
});
mountDshWebRoutes(dshWebServer, app);

if (process.env.LFAA_SERVE_FRONTEND === "true" || process.env.LFAA_SERVE_FRONTEND === "1") {
  serveFrontend(app, resolve(config.repositoryRoot, "dist", "apps", "web"), (html) => dshWebServer.renderIndex(html));
}

app.use((_request, response) => {
  response.status(404).json({ error: "not_found", message: "找不到请求的接口。" });
});

app.use((error: unknown, _request: Request, response: Response, next: NextFunction) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  const requestId = response.locals.requestId as string | undefined;
  const runtimeError = typeof error === "object" && error !== null
    ? error as { type?: string; status?: number; name?: string }
    : {};
  const malformedBody = runtimeError.type === "entity.parse.failed" || runtimeError.status === 400;
  const oversizedBody = runtimeError.type === "entity.too.large" || runtimeError.status === 413;
  const statusCode = error instanceof ApiError
    ? error.statusCode
    : malformedBody
      ? 400
      : oversizedBody
        ? 413
        : 500;
  const errorCode = error instanceof ApiError
    ? error.errorCode
    : malformedBody
      ? "invalid_json"
      : oversizedBody
        ? "request_too_large"
        : "internal_error";
  const message = error instanceof ApiError
    ? error.message
    : malformedBody
      ? "请求正文不是有效的 JSON。"
      : oversizedBody
        ? "请求正文超过允许大小。"
        : "服务器内部错误。";

  if (statusCode >= 500) {
    logger.error("请求处理失败", { requestId, errorName: runtimeError.name || "UnknownError" });
  } else if (error instanceof ApiError) {
    logger.warn("请求未通过校验", { requestId, errorCode });
  }

  response.status(statusCode).json({ error: errorCode, message, requestId });
});

// 先登记清理，再监听；启动失败也会由 Fiber 回收 Socket 和 HTTP。
ctx.effect(() => () => new Promise<void>((done) => {
  realtime.close(() => { void aiPluginHost.close().then(done); });
}));
await new Promise<void>((ready, reject) => {
  server.once("error", reject);
  server.listen(config.port, config.host, () => {
    server.off("error", reject);
    ready();
  });
});
ctx.provide(name, { app, server, realtime });
logger.info("LFAA 控制端已启动", { host: config.host, port: config.port, environment: config.nodeEnvironment, persistence: "JSON/JSONL + SQLite" });
}
