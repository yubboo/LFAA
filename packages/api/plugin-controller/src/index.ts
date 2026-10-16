/**
 * 功能：提供当前 Profile 的第三方插件管理 API。
 * 作用：认证后提供插件查询、来源检查和手动启停、安装与卸载路由；自然语言仍由 AI Core Tools 执行。
 * 关联文件：boot/plugin-manager/src/index.ts 持有唯一清单与文件 Owner；api/gateway/src/index.ts 管理可撤销路由。
 */
import type { Context } from "@deepseek-ai/cordis";
import { Router } from "express";
import { requireAuthentication, requireRole } from "lfaa-authorization/src/middleware.js";
import { asyncHandler } from "lfaa-api-remotes/src/route-contracts.js";
import { ApiError } from "lfaa-util-values/src/http-error.js";
import type { PluginManager } from "lfaa-plugin-manager/src/index.js";
import type { CapabilityInstallRegistry } from "lfaa-capability-installs/src/index.js";
import { APPLICATION_IDS, type ApplicationId } from "lfaa-util-values/src/application-id.js";
import { authorizeExplicitUserAction } from "lfaa-permission-presets/src/permissions.js";

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
  const status = code === "plugin_admin_required" || code === "plugin_user_action_denied" ? 403
    : code === "plugin_not_found" ? 404
      : code.includes("invalid") || code.includes("manifest") || code.includes("path") ? 400
        : code.includes("unsupported") ? 422
      : code.includes("source_changed") || code.includes("conflict") || code.includes("in_progress") || code.includes("disable_required") || code.includes("recovery_required") || code.includes("limit") || code.includes("unavailable") || code.includes("disabled") || code.includes("target_mismatch") || code.includes("revision_changed") || code.includes("start_failed") ? 409 : 500;
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
  router.post("/plugins/install", requireAuthentication, requireRole("admin"), asyncHandler(async (request, response) => {
    const body = request.body;
    if (!record(body) || Object.keys(body).some(key => !["repositoryUrl", "ref", "expectedResolvedRef"].includes(key))
      || typeof body.repositoryUrl !== "string" || typeof body.ref !== "string" || !body.ref || typeof body.expectedResolvedRef !== "string" || !body.expectedResolvedRef || body.expectedResolvedRef.length > 200) throw new ApiError(400, "invalid_plugin_source", "请先检查插件来源再安装。");
    const userId = request.auth!.user.id;
    const authorization = authorizeExplicitUserAction({ userId, activeApplicationId: "workspace", toolApplicationIds: ["workspace"], toolId: "capabilities.install", toolVersion: "1", risk: "dangerous", scopeKey: `plugin-install:${body.repositoryUrl}:${body.expectedResolvedRef}`, executable: true });
    if (authorization !== "allow") throw new ApiError(403, "plugin_user_action_denied", "当前安装未通过 Permission Owner 授权。");
    try { response.json(await manager.installForCapability(body.repositoryUrl, body.ref, userId, "workspace", body.expectedResolvedRef)); }
    catch (error) { managerError(error); }
  }));
  router.post("/plugins/:pluginId/remove", requireAuthentication, requireRole("admin"), asyncHandler(async (request, response) => {
    const body = request.body;
    if (!record(body) || Object.keys(body).some(key => !["targetApplicationId", "expectedSourceCommit"].includes(key)) || typeof body.targetApplicationId !== "string" || !APPLICATION_IDS.includes(body.targetApplicationId as ApplicationId) || typeof body.expectedSourceCommit !== "string" || !body.expectedSourceCommit || body.expectedSourceCommit.length > 200) throw new ApiError(400, "invalid_plugin_remove", "插件卸载参数无效。");
    const current = manager.get(request.params.pluginId);
    if (!current) throw new ApiError(404, "plugin_not_found", "此插件已经卸载。");
    const authorization = authorizeExplicitUserAction({ userId: request.auth!.user.id, activeApplicationId: body.targetApplicationId as ApplicationId, toolApplicationIds: current.applicationIds, toolId: "capabilities.remove", toolVersion: "1", risk: "dangerous", scopeKey: `plugin-remove:${current.id}:${body.expectedSourceCommit}`, executable: true });
    if (authorization !== "allow") throw new ApiError(403, "plugin_user_action_denied", "当前卸载未通过 Permission Owner 授权。");
    try { await manager.remove(current.id, body.targetApplicationId as ApplicationId, body.expectedSourceCommit); response.json({ removed: true }); }
    catch (error) { managerError(error); }
  }));
  router.post("/plugins/:pluginId/lifecycle", requireAuthentication, requireRole("admin"), asyncHandler(async (request, response) => {
    const pluginId = request.params.pluginId;
    if (!/^[a-z0-9][a-z0-9._-]{1,119}$/u.test(pluginId)) throw new ApiError(400, "invalid_plugin_id", "插件 ID 无效。");
    const body = request.body;
    if (!record(body) || Object.keys(body).some((key) => !["enabled", "targetApplicationId", "expectedSourceCommit"].includes(key))
      || typeof body.enabled !== "boolean" || typeof body.targetApplicationId !== "string" || typeof body.expectedSourceCommit !== "string" || !body.expectedSourceCommit.trim() || body.expectedSourceCommit.length > 200) {
      throw new ApiError(400, "invalid_plugin_lifecycle", "插件启停参数无效。");
    }
    if (!APPLICATION_IDS.includes(body.targetApplicationId as ApplicationId)) throw new ApiError(400, "invalid_plugin_lifecycle", "插件启停目标 App 无效。");
    const targetApplicationId = body.targetApplicationId as ApplicationId;
    const current = manager.get(pluginId);
    if (!current) throw new ApiError(404, "plugin_not_found", "当前 Profile 未安装此插件。");
    if (!current.applicationIds.includes(targetApplicationId)) throw new ApiError(409, "plugin_target_mismatch", "该插件没有登记到所选目标 App。");
    const authorization = authorizeExplicitUserAction({
      userId: request.auth!.user.id,
      activeApplicationId: targetApplicationId,
      toolApplicationIds: current.applicationIds,
      toolId: "capabilities.set-enabled",
      toolVersion: "1",
      risk: body.enabled ? "dangerous" : "write",
      scopeKey: `capability-enabled:plugin:${targetApplicationId}:${pluginId}:${body.expectedSourceCommit}:${body.enabled}`,
      executable: true
    });
    if (authorization !== "allow") throw new ApiError(403, "plugin_user_action_denied", "当前插件操作未通过 Permission Owner 授权。");
    try {
      const plugin = await manager.setEnabled(pluginId, body.enabled, targetApplicationId, body.expectedSourceCommit);
      response.json({ plugin });
    } catch (error) { managerError(error); }
  }));
}

export const name = "api-plugin-controller";
export const inject = ["apiGateway", "lfaaPluginManager", "lfaaCapabilityInstalls"];
export function apply(ctx: Context): void {
  ctx.apiGateway.register(ctx, name, (router) => registerRoutes(router, ctx.lfaaPluginManager, ctx.lfaaCapabilityInstalls));
}
