/**
 * 功能：提供当前 Profile 的第三方插件管理 API。
 * 作用：认证后限制管理员调用插件查询、来源检查、安装、启停和移除服务。
 * 关联文件：boot/plugin-manager/src/index.ts 持有唯一清单与文件 Owner；api/gateway/src/index.ts 管理可撤销路由。
 */
import type { Context } from "@deepseek-ai/cordis";
import { Router } from "express";
import { requireAuthentication, requireRole } from "lfaa-authorization/src/middleware.js";
import { asyncHandler } from "lfaa-api-remotes/src/route-contracts.js";
import { ApiError } from "lfaa-util-values/src/http-error.js";
import type { PluginManager } from "lfaa-plugin-manager/src/index.js";
import type { CapabilityInstallRegistry } from "lfaa-capability-installs/src/index.js";

function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function repositoryInput(value: unknown): { repositoryUrl: string; ref?: string } {
  if (!record(value) || Object.keys(value).some((key) => !["repositoryUrl", "ref"].includes(key)) || typeof value.repositoryUrl !== "string" || value.ref !== undefined && typeof value.ref !== "string") {
    throw new ApiError(400, "invalid_plugin_source", "插件来源参数无效。");
  }
  return { repositoryUrl: value.repositoryUrl, ...(typeof value.ref === "string" ? { ref: value.ref } : {}) };
}
function managerError(error: unknown): never {
  const candidate = typeof error === "object" && error !== null ? error as { code?: unknown; message?: unknown } : {};
  const code = typeof candidate.code === "string" ? candidate.code : "plugin_operation_failed";
  const message = typeof candidate.message === "string" ? candidate.message : "插件操作失败。";
  const status = code === "plugin_admin_required" ? 403
    : code === "plugin_not_found" ? 404
      : code.includes("invalid") || code.includes("manifest") || code.includes("path") ? 400
        : code.includes("unsupported") ? 422
      : code.includes("conflict") || code.includes("in_progress") || code.includes("disable_required") || code.includes("recovery_required") || code.includes("limit") || code.includes("unavailable") || code.includes("disabled") ? 409 : 500;
  throw new ApiError(status, code, message);
}

export function registerRoutes(router: Router, manager: PluginManager, capabilities: CapabilityInstallRegistry): void {
  router.get("/capabilities/catalog", requireAuthentication, (_request, response) => response.json({ capabilities: capabilities.catalog() }));
  router.get("/plugins", requireAuthentication, requireRole("admin"), (_request, response) => response.json({ profile: manager.profile, plugins: manager.list() }));
  router.get("/plugins/:pluginId", requireAuthentication, requireRole("admin"), (request, response) => {
    const plugin = manager.get(request.params.pluginId);
    if (!plugin) throw new ApiError(404, "plugin_not_found", "当前 Profile 未安装此插件。");
    response.json({ plugin });
  });
  router.post("/plugins/search", requireAuthentication, requireRole("admin"), asyncHandler(async (request, response) => {
    if (!record(request.body) || Object.keys(request.body).some((key) => key !== "query") || typeof request.body.query !== "string") throw new ApiError(400, "invalid_plugin_search", "插件搜索参数无效。");
    try { response.json({ candidates: await manager.search(request.body.query) }); } catch (error) { managerError(error); }
  }));
  router.post("/plugins/inspect", requireAuthentication, requireRole("admin"), asyncHandler(async (request, response) => {
    const input = repositoryInput(request.body);
    try { response.json({ plugin: await manager.inspect(input.repositoryUrl, input.ref) }); } catch (error) { managerError(error); }
  }));
}

export const name = "api-plugin-controller";
export const inject = ["apiGateway", "lfaaPluginManager", "lfaaCapabilityInstalls"];
export function apply(ctx: Context): void {
  ctx.apiGateway.register(ctx, name, (router) => registerRoutes(router, ctx.lfaaPluginManager, ctx.lfaaCapabilityInstalls));
}
