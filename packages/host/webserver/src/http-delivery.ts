/**
 * 功能：定义控制端 HTTP 日志分级和生产前端交付规则。
 * 作用：让带内容哈希的资源复用浏览器缓存，入口与普通资源可重新校验，缺失资源不返回页面 HTML。
 * 关联文件：server.ts 装配这些规则；apps/web/index.html 声明图标；apps/cli/tests/http-delivery.test.mjs 验证真实 HTTP 响应。
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";
import express, { type Express, type RequestHandler } from "express";

export interface RuntimeBuildIdentity {
  hostFingerprint: string;
  webFingerprint: string;
  webEntryHash: string;
}

function readBuildFingerprint(path: string, expectedKind: "host" | "web"): string {
  try {
    const value: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (!value || typeof value !== "object" || (value as { kind?: unknown }).kind !== expectedKind
      || typeof (value as { fingerprint?: unknown }).fingerprint !== "string") throw new Error("invalid build state");
    return (value as { fingerprint: string }).fingerprint;
  } catch (error) {
    throw new Error(`无法读取 ${expectedKind === "host" ? "控制端" : "Web"} 构建指纹：${path}`, { cause: error });
  }
}

function hashFile(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** Capture the server and Web bundle versions when this process starts. */
export function captureRuntimeBuildIdentity(repositoryRoot: string): RuntimeBuildIdentity {
  const hostDirectory = resolve(repositoryRoot, "dist", "apps", "control-plane");
  const webDirectory = resolve(repositoryRoot, "dist", "apps", "web");
  return {
    hostFingerprint: readBuildFingerprint(resolve(hostDirectory, "build-state.json"), "host"),
    webFingerprint: readBuildFingerprint(resolve(webDirectory, "build-state.json"), "web"),
    webEntryHash: hashFile(resolve(webDirectory, "index.html"))
  };
}

/** Check only on document loads and settings writes, so normal polling does no extra disk work. */
export function isRuntimeBuildIdentityCurrent(repositoryRoot: string, identity: RuntimeBuildIdentity): boolean {
  try {
    return readBuildFingerprint(resolve(repositoryRoot, "dist", "apps", "control-plane", "build-state.json"), "host") === identity.hostFingerprint
      && readBuildFingerprint(resolve(repositoryRoot, "dist", "apps", "web", "build-state.json"), "web") === identity.webFingerprint
      && hashFile(resolve(repositoryRoot, "dist", "apps", "web", "index.html")) === identity.webEntryHash;
  } catch {
    // A build removes/replaces its output before recording the new fingerprint.
    // Treat that interval as incompatible too, so a partial build cannot accept writes.
    return false;
  }
}

export function runtimeBuildCompatibilityGuard(repositoryRoot: string, identity: RuntimeBuildIdentity): RequestHandler {
  return (request, response, next) => {
    const isSettingsWrite = request.method === "PUT" && /^\/api\/settings\/[^/]+$/u.test(request.path);
    const isDocument = (request.method === "GET" || request.method === "HEAD")
      && !["/api", "/assets", "/images", "/backgrounds", "/socket.io", "/__dsh", "/wallpaper-engine"]
        .some(prefix => request.path === prefix || request.path.startsWith(`${prefix}/`))
      && !extname(request.path)
      && Boolean(request.accepts("html"));
    if ((!isSettingsWrite && !isDocument) || isRuntimeBuildIdentityCurrent(repositoryRoot, identity)) {
      next();
      return;
    }

    const message = "LFAA Web 或控制端构建文件在服务运行期间已更新。为避免设置写入失败，请停止并重新启动 LFAA Web 后重试。";
    response.status(503).setHeader("Cache-Control", "no-store");
    if (isDocument) {
      response.type("html").send(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>LFAA 需要重新启动</title></head><body><main><h1>LFAA 需要重新启动</h1><p>${message}</p></main></body></html>`);
      return;
    }
    response.json({ error: "runtime_build_changed", message });
  };
}

export function requestLogLevel(method: string, path: string, statusCode: number, expectedWallpaperMiss = false): "debug" | "info" | "warn" | "error" {
  if (statusCode >= 500) return "error";
  if (statusCode >= 400) {
    const methodCanProbe = method === "GET" || method === "HEAD";
    const expectedWallpaperProbe = ["/wallpaper-engine/scene-frame/", "/wallpaper-engine/scene-audio/", "/wallpaper-engine/scene-files/"]
      .some((prefix) => path.startsWith(prefix));
    if (statusCode === 404 && methodCanProbe && expectedWallpaperMiss && expectedWallpaperProbe) return "debug";
    return "warn";
  }
  if (method === "POST" && path === "/wallpaper-engine/client-diag") return "debug";
  if (method === "PUT" && path === "/wallpaper-engine/settings") return "debug";
  // 正常读取和后台只读复核/节点空队列轮询是访问明细；写入、启动与故障仍在默认日志中可见。
  if (method === "GET" || method === "HEAD") return "debug";
  if (method === "POST" && (
    path === "/api/typert/auth/me"
    || path === "/api/daemon/heartbeat"
    || path === "/api/daemon/tasks/claim"
    || path === "/api/daemon/runtime/tasks/claim"
    || /^\/api\/daemon\/runtime\/tasks\/[^/]+\/(?:renew|progress)$/u.test(path)
    || path === "/api/daemon/files/tasks/claim"
    || path === "/api/daemon/steamcmd/tasks/claim"
    || path === "/api/daemon/ai/host-tasks/claim"
    || path === "/api/connectivity/daemon/easytier/install/claim"
  )) return "debug";
  return "info";
}

export function serveFrontend(app: Express, frontendDirectory: string, renderIndex?: (html: string) => string): void {
  const frontendEntry = resolve(frontendDirectory, "index.html");
  if (!existsSync(frontendEntry)) throw new Error(`前端构建文件不存在：${frontendEntry}`);
  // Re-read the small HTML shell for each document request. A long-running Web
  // process must not keep a previous hashed asset name after a new build has
  // replaced the static directory.
  const sendIndex = (response: import("express").Response, next: import("express").NextFunction): void => {
    response.setHeader("Cache-Control", "public, no-cache");
    if (renderIndex) {
      void readFile(frontendEntry, "utf8")
        .then((html) => response.type("html").send(renderIndex(html)))
        .catch(next);
      return;
    }
    response.sendFile(frontendEntry, (error) => { if (error) next(error); });
  };

  if (renderIndex) app.get("/index.html", (_request, response, next) => sendIndex(response, next));

  // API 与账户图片在上游保持 no-store；只有构建目录中的公开文件可以覆盖缓存头。
  app.use(express.static(frontendDirectory, {
    index: false,
    fallthrough: true,
    setHeaders(response, filePath) {
      const resourcePath = relative(frontendDirectory, filePath).split(sep).join("/");
      const isHashedAsset = /^assets\/.+-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2?|png|jpe?g|svg|webp|avif)$/u.test(resourcePath);
      // 内容哈希变化即产生新 URL；一年有效期遵循不可变静态资源的 HTTP 缓存合同。
      response.setHeader("Cache-Control", isHashedAsset ? "public, max-age=31536000, immutable" : "public, no-cache");
    }
  }));
  // 兼容浏览器的默认图标地址；显式声明的 SVG 是唯一图标资源。
  app.get("/favicon.ico", (_request, response) => {
    response.setHeader("Cache-Control", "public, no-cache");
    response.redirect(308, "/favicon.svg");
  });
  app.get("*", (request, response, next) => {
    const path = request.path;
    const isReservedPath = ["/api", "/socket.io", "/assets", "/images", "/backgrounds"].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
    // 浏览器路由才回退到入口；资源缺失必须暴露真实 404，避免 HTML 被当作脚本或图标反复加载。
    if (isReservedPath || extname(path) || !request.accepts("html")) {
      next();
      return;
    }
    sendIndex(response, next);
  });
}
