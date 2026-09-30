/** 功能：登记 settings-controller 的现有接口。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。 */
import { Router } from "express";
import { ApiError } from "lfaa-util-values/src/http-error.js";
import { requireAuthentication, requireRole } from "lfaa-authorization/src/middleware.js";
import type { AiPluginHost } from "lfaa-app-boot/src/ai-host.js";
import { PluginRuntimeError } from "lfaa-app-boot/src/plugin-runtime.js";
import type { MinecraftRealtimePublisher } from "lfaa-api-remotes/src/socket-server.js";
import { getUserPreferences, saveUserPreferences, type ApplicationId, type ApplicationMode } from "lfaa-settings/src/preferences/service.js";
import { activateAiAccount, deleteAiAccount, deleteUserBackground, getUserBackground, getUserSettings, listUserBackgrounds, listAiAccounts, listAiProviders, probeAiProvider, testAiProviderModel, reprobeAiAccount, saveAiAccount, saveUserBackground, saveUserSettings, updateAiAccountModel, updateAiAccountReasoningMode, type SettingsCategory, type ShortcutSettings } from "lfaa-settings/src/service.js";
import { cancelDataDirectoryChange, DataDirectorySettingsError, getDataDirectorySettings, requestDataDirectoryChange } from "lfaa-workspace-data-directory/src/service.js";
import { asyncHandler, parseBody, preferencesSchema, generalSettingsSchema, aiRuntimeSettingsSchema, permissionsSettingsSchema, pluginsSettingsSchema, appearanceSettingsSchema, shortcutsSchema, aiProbeSchema, aiAccountSchema, aiModelSchema, aiReasoningSchema, aiModelTestSchema, backgroundUploadSchema, hasShortcutConflict, dataDirectorySettingsSchema, pluginRuntimeActionSchema } from "lfaa-api-remotes/src/route-contracts.js";
export function registerRoutes(router: Router, aiPluginHost: AiPluginHost, _realtime: MinecraftRealtimePublisher): void {

router.get("/ai/extensions", requireAuthentication, (_request, response) => {
    response.json({ plugins: aiPluginHost.listPlugins(), extensions: aiPluginHost.listExtensions(), hooks: aiPluginHost.listHooks(), hotReloadEnabled: aiPluginHost.hotReloadEnabled });
  });

router.post("/settings/runtime-plugins/:pluginId/actions", requireAuthentication, requireRole("admin"), asyncHandler(async (request, response) => {
    const body = parseBody<{ action: "start" | "stop" | "reload" }>(pluginRuntimeActionSchema, request.body);
    try {
      if (body.action === "reload") await aiPluginHost.reloadPlugin(request.params.pluginId);
      else await aiPluginHost.setPluginEnabled(request.params.pluginId, body.action === "start");
    } catch (error) {
      if (error instanceof PluginRuntimeError) {
        const statusCode = error.code === "plugin_not_found" ? 404 : error.code === "plugin_runtime_action_failed" ? 500 : 409;
        throw new ApiError(statusCode, error.code, error.message);
      }
      throw error;
    }
    response.json({ plugins: aiPluginHost.listPlugins(), hotReloadEnabled: aiPluginHost.hotReloadEnabled });
  }));

router.get("/preferences", requireAuthentication, (request, response) => {
    response.json({ preferences: getUserPreferences(request.auth!.user.id) });
  });

router.put("/preferences", requireAuthentication, (request, response) => {
    const body = parseBody<{ selectedApp: ApplicationId; selectedMode: ApplicationMode }>(preferencesSchema, request.body);
    const preferences = saveUserPreferences(request.auth!.user.id, body);
    response.json({ preferences });
  });

router.get("/settings", requireAuthentication, (request, response) => {
    response.json({ settings: getUserSettings(request.auth!.user.id) });
  });

router.put("/settings/:category", requireAuthentication, (request, response) => {
    const category = request.params.category as SettingsCategory;
    const schemas = {
      general: generalSettingsSchema,
      appearance: appearanceSettingsSchema,
      shortcuts: shortcutsSchema,
      "ai-runtime": aiRuntimeSettingsSchema,
      permissions: permissionsSettingsSchema,
      plugins: pluginsSettingsSchema
    };
    const schema = schemas[category];
    if (!schema) throw new ApiError(404, "settings_category_not_found", "找不到此设置分类。");
    const value = parseBody<Record<string, unknown>>(schema, request.body);
    if (category === "shortcuts" && hasShortcutConflict(value as unknown as ShortcutSettings)) {
      throw new ApiError(400, "shortcut_conflict", "快捷键重复，请为每个动作设置不同的组合键。");
    }
    if (category === "appearance") {
      const appearance = value as { backgrounds: Record<string, string> };
      if (appearance.backgrounds.login.startsWith("user-")) {
        throw new ApiError(400, "appearance_login_background_must_be_builtin", "登录页背景只能使用内置图片。");
      }
      const uploadedIds = new Set(listUserBackgrounds(request.auth!.user.id).map((background) => background.id));
      if (Object.values(appearance.backgrounds).some((backgroundId) => backgroundId.startsWith("user-") && !uploadedIds.has(backgroundId))) {
        throw new ApiError(400, "appearance_background_not_owned", "背景设置引用了当前账户没有的图片。");
      }
    }
    saveUserSettings(request.auth!.user.id, category, value as never);
    response.json({ settings: getUserSettings(request.auth!.user.id) });
  });

router.get("/settings/backgrounds", requireAuthentication, (request, response) => {
    response.json({ backgrounds: listUserBackgrounds(request.auth!.user.id) });
  });

router.post("/settings/backgrounds", requireAuthentication, (request, response) => {
    const body = parseBody<{ name: string; dataUrl: string }>(backgroundUploadSchema, request.body);
    try {
      response.status(201).json({ background: saveUserBackground(request.auth!.user.id, body.dataUrl, body.name) });
    } catch (error) {
      throw new ApiError(422, "appearance_background_invalid", error instanceof Error ? error.message : "背景图片无法保存。");
    }
  });

router.get("/settings/backgrounds/:backgroundId", requireAuthentication, (request, response) => {
    const image = getUserBackground(request.auth!.user.id, request.params.backgroundId);
    if (!image) throw new ApiError(404, "appearance_background_not_found", "找不到这张背景图片。");
    response.setHeader("Content-Type", image.mimeType);
    response.setHeader("Content-Length", image.data.length);
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "private, no-store");
    response.end(image.data);
  });

router.delete("/settings/backgrounds/:backgroundId", requireAuthentication, (request, response) => {
    deleteUserBackground(request.auth!.user.id, request.params.backgroundId);
    response.status(204).end();
  });

router.get("/settings/ai/providers", requireAuthentication, (_request, response) => {
    response.json({ providers: listAiProviders() });
  });

router.get("/settings/ai/accounts", requireAuthentication, (request, response) => {
    response.json({ accounts: listAiAccounts(request.auth!.user.id) });
  });

router.post("/settings/ai/probe", requireAuthentication, asyncHandler(async (request, response) => {
    const body = parseBody<{ providerId: string; secret: string; options: Record<string, string> }>(aiProbeSchema, request.body);
    try {
      response.json({ result: await probeAiProvider(body) });
    } catch (error) {
      throw new ApiError(422, "ai_provider_probe_failed", error instanceof Error ? error.message : "Provider 连接测试失败。");
    }
  }));

router.post("/settings/ai/test-model", requireAuthentication, asyncHandler(async (request, response) => {
    const body = parseBody<{ providerId: string; secret: string; options: Record<string, string>; modelId: string; reasoningMode: string }>(aiModelTestSchema, request.body);
    try {
      response.json({ result: await testAiProviderModel(body) });
    } catch (error) {
      throw new ApiError(422, "ai_model_test_failed", error instanceof Error ? error.message : "模型测试失败。");
    }
  }));

router.post("/settings/ai/accounts", requireAuthentication, asyncHandler(async (request, response) => {
    const body = parseBody<{ providerId: string; secret: string; options: Record<string, string>; displayName: string; modelId: string; reasoningMode: string }>(aiAccountSchema, request.body);
    try {
      const account = await saveAiAccount(request.auth!.user.id, body);
      response.status(201).json({ account });
    } catch (error) {
      throw new ApiError(422, "ai_account_save_failed", error instanceof Error ? error.message : "AI 账户保存失败。");
    }
  }));

router.post("/settings/ai/accounts/:accountId/retest", requireAuthentication, asyncHandler(async (request, response) => {
    try {
      response.json({ result: await reprobeAiAccount(request.auth!.user.id, request.params.accountId) });
    } catch (error) {
      throw new ApiError(422, "ai_account_probe_failed", error instanceof Error ? error.message : "AI 账户重测失败。");
    }
  }));

router.put("/settings/ai/accounts/:accountId/model", requireAuthentication, asyncHandler(async (request, response) => {
    const body = parseBody<{ modelId: string }>(aiModelSchema, request.body);
    try {
      response.json({ account: await updateAiAccountModel(request.auth!.user.id, request.params.accountId, body.modelId) });
    } catch (error) {
      throw new ApiError(422, "ai_account_model_failed", error instanceof Error ? error.message : "AI 模型更新失败。");
    }
  }));

router.put("/settings/ai/accounts/:accountId/reasoning", requireAuthentication, (request, response) => {
    const body = parseBody<{ reasoningMode: string }>(aiReasoningSchema, request.body);
    try {
      response.json({ account: updateAiAccountReasoningMode(request.auth!.user.id, request.params.accountId, body.reasoningMode) });
    } catch (error) {
      throw new ApiError(422, "ai_account_reasoning_failed", error instanceof Error ? error.message : "思考参数更新失败。");
    }
  });

router.post("/settings/ai/accounts/:accountId/activate", requireAuthentication, (request, response) => {
    try {
      response.json({ account: activateAiAccount(request.auth!.user.id, request.params.accountId) });
    } catch (error) {
      throw new ApiError(404, "ai_account_activation_failed", error instanceof Error ? error.message : "AI 账户激活失败。");
    }
  });

router.delete("/settings/ai/accounts/:accountId", requireAuthentication, (request, response) => {
    deleteAiAccount(request.auth!.user.id, request.params.accountId);
    response.status(204).end();
  });

router.get("/data-directory", requireAuthentication, requireRole("admin"), (_request, response) => {
    response.json({ settings: getDataDirectorySettings() });
  });

router.put("/data-directory", requireAuthentication, requireRole("admin"), (request, response) => {
    const body = parseBody<{ directory: string }>(dataDirectorySettingsSchema, request.body);
    try {
      response.json({ settings: requestDataDirectoryChange(body.directory) });
    } catch (error) {
      if (error instanceof DataDirectorySettingsError) {
        const statusCode = error.errorCode === "invalid_data_directory" ? 400 : 409;
        throw new ApiError(statusCode, error.errorCode, error.message);
      }
      throw new ApiError(500, "data_directory_migration_unavailable", "无法保存数据目录迁移请求。");
    }
  });

router.delete("/data-directory", requireAuthentication, requireRole("admin"), (_request, response) => {
    try {
      cancelDataDirectoryChange();
      response.json({ settings: getDataDirectorySettings() });
    } catch {
      throw new ApiError(409, "data_directory_migration_unavailable", "无法取消待处理的数据目录迁移请求。");
    }
  });
}

/** 将本控制器的路由层与当前插件生命周期绑定。 */
import type { Context } from "@deepseek-ai/cordis";
import "lfaa-api-gateway/src/index.js";
export const inject = ["apiGateway"];
export function apply(ctx: Context): void { ctx.apiGateway.register(ctx, "settings-controller", registerRoutes); }
