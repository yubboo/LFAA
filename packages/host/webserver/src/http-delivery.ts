/**
 * 功能：定义控制端 HTTP 日志分级和生产前端交付规则。
 * 作用：让带内容哈希的资源复用浏览器缓存，入口与普通资源可重新校验，缺失资源不返回页面 HTML。
 * 关联文件：server.ts 装配这些规则；apps/web/index.html 声明图标；apps/cli/tests/http-delivery.test.mjs 验证真实 HTTP 响应。
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";
import express, { type Express } from "express";

export function requestLogLevel(method: string, path: string, statusCode: number): "debug" | "info" | "warn" | "error" {
  if (statusCode >= 500) return "error";
  if (statusCode >= 400) return "warn";
  // 正常读取和节点空队列查询是访问明细；写入、启动与故障仍在默认日志中可见。
  if (method === "GET" || method === "HEAD") return "debug";
  if (method === "POST" && (
    path === "/api/daemon/heartbeat"
    || path === "/api/daemon/tasks/claim"
    || path === "/api/daemon/files/tasks/claim"
    || path === "/api/daemon/steamcmd/tasks/claim"
    || path === "/api/daemon/ai/host-tasks/claim"
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
