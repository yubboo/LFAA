/**
 * 功能：启动 LFAA 控制端 HTTP 服务。
 * 作用：装配安全响应头、请求日志、JSON API、错误响应和进程关闭处理。
 * 关联文件：server/src/config.ts、server/src/database.ts、server/src/api/routes.ts、server/src/ai/host.ts。
 */
import { randomUUID } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import { ApiError } from "./api/http-error.js";
import { createApiRouter } from "./api/routes.js";
import { config } from "./config.js";
import { closeDatabase } from "./database.js";
import { logger } from "./logger.js";
import { createAiPluginHost } from "./ai/host.js";

const app = express();
app.disable("x-powered-by");

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
    const isSuccessfulPollingRequest = response.statusCode < 400
      && request.method === "GET"
      && (requestPath === "/api/health" || requestPath === "/api/auth/me");

    if (isSuccessfulPollingRequest) {
      logger.debug("HTTP 请求完成", logFields);
      return;
    }

    logger.info("HTTP 请求完成", logFields);
  });

  next();
});

app.use(express.json({ limit: "5mb" }));
const aiPluginHost = await createAiPluginHost();
app.use("/api", createApiRouter(aiPluginHost));

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

const server = app.listen(config.port, config.host, () => {
  logger.info("LFAA 控制端已启动", {
    host: config.host,
    port: config.port,
    environment: config.nodeEnvironment,
    persistence: "SQLite"
  });
});

server.on("error", (error: NodeJS.ErrnoException) => {
  logger.error("LFAA 控制端启动失败", { errorCode: error.code || "unknown" });
  void aiPluginHost.close().finally(() => {
    closeDatabase();
    process.exitCode = 1;
  });
});

let isClosing = false;
function shutdown(signal: string): void {
  if (isClosing) {
    return;
  }

  isClosing = true;
  logger.info("正在关闭 LFAA 控制端", { signal });
  server.close(() => {
    void aiPluginHost.close().then(() => {
      closeDatabase();
      logger.info("LFAA 控制端已关闭");
    }).catch(() => {
      closeDatabase();
      logger.error("AI 插件宿主关闭时发生错误");
    });
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
