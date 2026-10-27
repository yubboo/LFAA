import { config } from "lfaa-launch-environment/src/config.js";
import { getAgentUsageControls, listManagedAgentUsageAccounts, saveAgentUsagePolicy } from "lfaa-identity-auth/src/account-agent-usage.js";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { isModelInvocable, isSkillDisabled } from "lfaa-skill";
/** 功能：登记 settings-controller 的现有接口。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。 */
import { raw, Router } from "express";
import { ApiError } from "lfaa-util-values/src/http-error.js";
import { requireAuthentication, requireRole, requireSuperAdmin } from "lfaa-authorization/src/middleware.js";
import { hasAdminAccess, type UserRole } from "lfaa-identity-auth/src/service.js";
import { authorizeExplicitUserAction } from "lfaa-permission-presets/src/permissions.js";
import type { AiPluginHost } from "lfaa-app-boot/src/ai-host.js";
import { PluginRuntimeError } from "lfaa-app-boot/src/plugin-runtime.js";
import type { MinecraftRealtimePublisher } from "lfaa-api-remotes/src/socket-server.js";
import { getUserPreferences, saveUserPreferences, type ApplicationId, type ApplicationMode } from "lfaa-settings/src/preferences/service.js";
import { clearConversationMemories, getConversationMemorySnapshot, replaceConversationMemories, validateConversationMemoriesInput } from "lfaa-conversation-memory/src/index.js";
import { createAccountSnapshot, deleteAccountSnapshot, exportCurrentAccountArchive, listAccountSnapshots, previewAccountArchive, readAccountSnapshot, restoreAccountArchive } from "lfaa-settings-snapshots";
import type { AttachmentStore } from "lfaa-attachment/src/index.js";
import { redactConversationMemoryContexts } from "lfaa-session/src/sessions.js";
import type { ClaudeAgentCredentialOwner } from "lfaa-subagent-claude-code";
import { activateAiAccount, applyUserAppearancePreset, validateAppearancePresetSnapshot, deleteAiAccount, deleteUserBackground, getAiAccountManagementScope, getAiProviderAccountScope, getUserBackground, getUserSettings, getUserSettingsSyncStatus, isUserBackgroundInUse, listUserBackgrounds, listAiAccounts, listAiProviders, probeAiProvider, testAiProviderModel, refreshAiAccountModelCatalog, testSavedAiAccountModel, saveAiAccount, saveUserBackground, saveUserSettings, testAiAccountCredential, updateAiAccountCredential, updateAiAccountModel, updateAiAccountReasoningMode, type AppearanceSettings, type AppearancePresetSnapshot, type SettingsCategory, type ShortcutSettings } from "lfaa-settings/src/service.js";
import { cancelDataDirectoryChange, confirmDataDirectoryLocation, recommendDataDirectoryLocation, DataDirectorySettingsError, getDataDirectorySettings, requestDataDirectoryChange } from "lfaa-workspace-data-directory/src/service.js";
import { confirmProjectContentDirectory, getProjectStorageLocations, saveProjectContentDirectory } from "lfaa-settings/src/project-storage.js";
import { adoptProjectContentDirectory, compareProjectContentDirectories, copyProjectContentToDirectory, createProjectContentArchive, importProjectContentArchive } from "lfaa-settings/src/content-storage-migration.js";
import { asyncHandler, parseBody, preferencesSchema, accountAgentUsagePolicySchema, accountSnapshotCreateSchema, accountArchiveRestoreSchema, generalSettingsSchema, aiRuntimeSettingsSchema, minecraftRuntimeSettingsSchema, gitSettingsSchema, permissionsSettingsSchema, pluginsSettingsSchema, personalizationSettingsSchema, conversationMemoriesSchema, computerControlSettingsSchema, browserUseSettingsSchema, miniSettingsSchema, canvasSettingsSchema, appearancePresetSnapshotSchema, appearanceSettingsSchema, shortcutsSchema, aiProbeSchema, aiAccountSchema, aiAccountCredentialSchema, aiModelSchema, aiReasoningSchema, aiModelTestSchema, backgroundUploadSchema, hasShortcutConflict, dataDirectorySettingsSchema, projectContentStorageSchema, projectContentMigrationSchema, projectContentArchiveImportSchema, pluginRuntimeActionSchema } from "lfaa-api-remotes/src/route-contracts.js";
export function registerRoutes(router: Router, aiPluginHost: AiPluginHost, _realtime: MinecraftRealtimePublisher, attachments: AttachmentStore, claudeCredentials: ClaudeAgentCredentialOwner): void {

function assertAiProviderWriteAccess(role: UserRole, providerId: string): void {
  const scope = getAiProviderAccountScope(providerId);
  if (!scope) throw new ApiError(422, "ai_provider_not_found", "AI Provider 不在允许列表中。");
  if (scope === "system" && !hasAdminAccess(role)) throw new ApiError(403, "ai_system_account_admin_required", "只有管理员可以管理系统级 AI Provider。");
}

function assertAiAccountWriteAccess(userId: string, role: UserRole, accountId: string): void {
  const scope = getAiAccountManagementScope(userId, accountId);
  if (!scope) throw new ApiError(404, "ai_account_not_found", "找不到当前账户可管理的 AI 模型配置。");
  if (scope === "system" && !hasAdminAccess(role)) throw new ApiError(403, "ai_system_account_admin_required", "只有管理员可以管理系统级 AI 模型配置。");
}

function authorizeBusinessContentAction(userId: string, action: string, targetDirectory: string): void {
  const targetHash = createHash("sha256").update(resolve(targetDirectory).toLocaleLowerCase("en-US")).digest("hex");
  const authorization = authorizeExplicitUserAction({
    userId,
    activeApplicationId: "workspace",
    toolApplicationIds: ["workspace"],
    toolId: `settings.business-content.${action}`,
    toolVersion: "1",
    risk: "dangerous",
    scopeKey: `business-content:${targetHash}`,
    executable: true
  });
  if (authorization !== "allow") throw new ApiError(403, "business_content_action_denied", "此业务内容操作未通过 Permission Owner 授权。请从设置中心的对应操作按钮发起。" );
}

router.get("/ai/skills", requireAuthentication, asyncHandler(async (request, response) => {
  if (!aiPluginHost.listSkills) throw new ApiError(503, "skill_directory_unavailable", "Skill 注册表尚未装配。");
  const controller = new AbortController();
  const cancel = () => { if (!response.writableEnded) controller.abort(); };
  response.on("close", cancel);
  try {
    const settings = getUserSettings(request.auth!.user.id);
    const visible = (await aiPluginHost.listSkills({ userId: request.auth!.user.id, customSkillDirs: settings.plugins.enabled ? settings.plugins.skillDirectories ?? [] : [], allowHostFilesystem: settings.plugins.enabled && config.localHostExecution, signal: controller.signal }))
      .filter(skill => isModelInvocable(skill) && (settings.plugins.enabled || skill.source === "bundled" || skill.provider === "lfaa-knowledge-library-skills"));
    if (!controller.signal.aborted) response.json({ skills: visible.slice(0, 200).map(skill => ({
      id: "skill.registry/" + skill.name,
      name: skill.name,
      description: skill.description,
      kind: "skill",
      source: skill.source,
      origin: skill.provider === "lfaa-knowledge-library-skills" ? "account-installed" : skill.source,
      enabled: (skill.source === "bundled" || settings.plugins.enabled) && !isSkillDisabled(skill.name, settings.plugins.disabledSkillNames)
    })), truncated: visible.length > 200 });
  } finally { response.off("close", cancel); }
}));

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

router.get("/settings/sync/status", requireAuthentication, (request, response) => {
  response.setHeader("Cache-Control", "private, no-store");
  response.json({ status: getUserSettingsSyncStatus(request.auth!.user.id) });
});

router.put("/settings/:category", requireAuthentication, (request, response) => {
    const category = request.params.category as SettingsCategory;
    const schemas = {
      general: generalSettingsSchema,
      appearance: appearanceSettingsSchema,
      shortcuts: shortcutsSchema,
      "ai-runtime": aiRuntimeSettingsSchema,
      "minecraft-runtime": minecraftRuntimeSettingsSchema,
      git: gitSettingsSchema,
      permissions: permissionsSettingsSchema,
      plugins: pluginsSettingsSchema,
      personalization: personalizationSettingsSchema,
      "computer-control": computerControlSettingsSchema,
      "browser-use": browserUseSettingsSchema,
      mini: miniSettingsSchema,
      canvas: canvasSettingsSchema
    };
    const schema = schemas[category];
    if (!schema) throw new ApiError(404, "settings_category_not_found", "找不到此设置分类。");
    const value = parseBody<Record<string, unknown>>(schema, request.body);
    if (category === "shortcuts" && hasShortcutConflict(value as unknown as ShortcutSettings)) {
      throw new ApiError(400, "shortcut_conflict", "快捷键重复，请为每个动作设置不同的组合键。");
    }
    if (category === "appearance") {
      const appearance = value as unknown as AppearanceSettings;
      if (appearance.backgrounds.login.startsWith("user-")) {
        throw new ApiError(400, "appearance_login_background_must_be_builtin", "登录页背景只能使用内置图片。");
      }
      const uploadedIds = new Set(listUserBackgrounds(request.auth!.user.id).map((background) => background.id));
      const presets = appearance.presets ?? [];
      const presetBackgrounds = presets.flatMap((preset) => Object.values(preset.snapshot.appearance.backgrounds));
      if (presets.some((preset) => preset.snapshot.appearance.backgrounds.login.startsWith("user-"))) {
        throw new ApiError(400, "appearance_login_background_must_be_builtin", "预设中的登录页背景只能使用内置图片。");
      }
      if ([...Object.values(appearance.backgrounds), ...presetBackgrounds].some((backgroundId) => backgroundId.startsWith("user-") && !uploadedIds.has(backgroundId))) {
        throw new ApiError(400, "appearance_background_not_owned", "背景设置引用了当前账户没有的图片。");
      }
    }
    saveUserSettings(request.auth!.user.id, category, value as never);
    response.json({ settings: getUserSettings(request.auth!.user.id) });
  });

router.post("/settings/appearance-presets/apply", requireAuthentication, (request, response) => {
  const snapshot = parseBody<AppearancePresetSnapshot>(appearancePresetSnapshotSchema, request.body);
  try {
    response.json({ settings: applyUserAppearancePreset(request.auth!.user.id, snapshot) });
  } catch (error) {
    throw new ApiError(422, "appearance_preset_apply_failed", error instanceof Error ? error.message : "外观预设无法应用。");
  }
});

router.post("/settings/appearance-presets/validate", requireAuthentication, (request, response) => {
  const snapshot = parseBody<AppearancePresetSnapshot>(appearancePresetSnapshotSchema, request.body);
  try {
    validateAppearancePresetSnapshot(snapshot);
    response.json({ valid: true });
  } catch (error) {
    throw new ApiError(422, "appearance_preset_invalid", error instanceof Error ? error.message : "外观预设内容无效。");
  }
});

router.get("/settings/memories", requireAuthentication, (request, response) => {
    response.json({ snapshot: getConversationMemorySnapshot(request.auth!.user.id) });
  });

router.put("/settings/memories", requireAuthentication, (request, response) => {
    const body = parseBody<{ revision: number; memories: string[] }>(conversationMemoriesSchema, request.body);
    const memories = validateConversationMemoriesInput(body.memories);
    if (!memories) throw new ApiError(400, "conversation_memories_invalid", "记忆内容含有不支持的信息、重复项或超出数量/长度限制，请检查后重试。");
    const userId = request.auth!.user.id;
    if (!replaceConversationMemories(userId, memories, body.revision)) {
      throw new ApiError(409, "conversation_memories_changed", "记忆已在其他请求中更新，请刷新后再保存。");
    }
    response.json({ snapshot: getConversationMemorySnapshot(userId) });
  });

router.delete("/settings/memories", requireAuthentication, (request, response) => {
    const userId = request.auth!.user.id;
    redactConversationMemoryContexts(userId);
    clearConversationMemories(userId);
    response.status(204).end();
  });

router.get("/settings/parental", requireAuthentication, (request, response) => {
    const userId = request.auth!.user.id;
    const targetId = typeof request.query.accountId === "string" ? request.query.accountId : userId;
    const controls = getAgentUsageControls(userId, targetId);
    const manageableAccounts = request.auth!.user.role === "admin" || request.auth!.user.role === "super_admin" ? listManagedAgentUsageAccounts(userId) : [];
    response.json({ controls, manageableAccounts });
  });

router.put("/settings/parental/:accountId", requireAuthentication, requireRole("admin"), (request, response) => {
    const policy = parseBody<Record<string, unknown>>(accountAgentUsagePolicySchema, request.body);
    const controls = saveAgentUsagePolicy(request.auth!.user.id, request.params.accountId, policy);
    response.json({ controls });
  });

router.get("/settings/snapshots", requireAuthentication, (request, response) => {
  response.json({ snapshots: listAccountSnapshots(request.auth!.user.id) });
});

router.post("/settings/snapshots", requireAuthentication, (request, response) => {
  const body = parseBody<{ name: string }>(accountSnapshotCreateSchema, request.body);
  response.status(201).json({ snapshot: createAccountSnapshot(request.auth!.user.id, body.name) });
});

router.delete("/settings/snapshots/:snapshotId", requireAuthentication, (request, response) => {
  if (!deleteAccountSnapshot(request.auth!.user.id, request.params.snapshotId)) throw new ApiError(404, "account_snapshot_not_found", "找不到当前账户的快照。");
  response.status(204).end();
});

router.get("/settings/snapshots/:snapshotId/download", requireAuthentication, (request, response) => {
  const snapshot = readAccountSnapshot(request.auth!.user.id, request.params.snapshotId);
  if (!snapshot) throw new ApiError(404, "account_snapshot_not_found", "找不到当前账户的快照。");
  response.setHeader("Content-Type", "application/vnd.lfaa.account-snapshot");
  response.setHeader("Content-Disposition", `attachment; filename="lfaa-account-${snapshot.summary.id}.lfaa-snapshot"`);
  response.setHeader("Content-Length", String(snapshot.archive.byteLength));
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Cache-Control", "private, no-store");
  response.send(snapshot.archive);
});

router.post("/settings/snapshots/:snapshotId/preview", requireAuthentication, asyncHandler(async (request, response) => {
  const snapshot = readAccountSnapshot(request.auth!.user.id, request.params.snapshotId);
  if (!snapshot) throw new ApiError(404, "account_snapshot_not_found", "找不到当前账户的快照。");
  response.json({ preview: await previewAccountArchive(request.auth!.user.id, snapshot.archive) });
}));

router.post("/settings/snapshots/:snapshotId/restore", requireAuthentication, asyncHandler(async (request, response) => {
  const body = parseBody<{ settings: boolean; memories: boolean; sessions: boolean }>(accountArchiveRestoreSchema, request.body);
  const snapshot = readAccountSnapshot(request.auth!.user.id, request.params.snapshotId);
  if (!snapshot) throw new ApiError(404, "account_snapshot_not_found", "找不到当前账户的快照。");
  response.json({ result: await restoreAccountArchive(request.auth!.user.id, snapshot.archive, body, attachments) });
}));

const accountArchiveBody = raw({ type: "application/vnd.lfaa.account-snapshot", limit: "256mb" });
router.get("/settings/import/export", requireAuthentication, asyncHandler(async (request, response) => {
  const exported = await exportCurrentAccountArchive(request.auth!.user.id, attachments);
  response.setHeader("Content-Type", "application/vnd.lfaa.account-snapshot");
  response.setHeader("Content-Disposition", `attachment; filename="lfaa-account-${exported.createdAt.slice(0, 10)}.lfaa-snapshot"`);
  response.setHeader("Content-Length", String(exported.archive.byteLength));
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Cache-Control", "private, no-store");
  response.send(exported.archive);
}));

router.post("/settings/import/preview", requireAuthentication, accountArchiveBody, asyncHandler(async (request, response) => {
  if (!Buffer.isBuffer(request.body)) throw new ApiError(415, "account_snapshot_required", "请上传 LFAA 账户快照文件。");
  try { response.json({ preview: await previewAccountArchive(request.auth!.user.id, request.body) }); }
  catch (error) { throw new ApiError(422, "account_snapshot_invalid", error instanceof Error ? error.message : "账户快照无法校验。"); }
}));

router.post("/settings/import/restore", requireAuthentication, accountArchiveBody, asyncHandler(async (request, response) => {
  if (!Buffer.isBuffer(request.body)) throw new ApiError(415, "account_snapshot_required", "请上传 LFAA 账户快照文件。");
  const body = parseBody<{ settings: boolean; memories: boolean; sessions: boolean }>(accountArchiveRestoreSchema, {
    settings: request.query.settings, memories: request.query.memories, sessions: request.query.sessions
  });
  try { response.json({ result: await restoreAccountArchive(request.auth!.user.id, request.body, body, attachments) }); }
  catch (error) { throw new ApiError(422, "account_snapshot_restore_failed", error instanceof Error ? error.message : "账户快照恢复失败。"); }
}));

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
    if (isUserBackgroundInUse(request.auth!.user.id, request.params.backgroundId)) {
      throw new ApiError(409, "appearance_background_in_use", "这张背景图片仍被外观或预设引用，请先解除引用后再删除。");
    }
    deleteUserBackground(request.auth!.user.id, request.params.backgroundId);
    response.status(204).end();
  });

router.get("/settings/ai/providers", requireAuthentication, (_request, response) => {
    response.json({ providers: listAiProviders() });
  });

router.get("/settings/ai/accounts", requireAuthentication, (request, response) => {
    response.json({ accounts: listAiAccounts(request.auth!.user.id) });
  });

router.get("/settings/ai/external-agents/anthropic-credential", requireAuthentication, (request, response) => {
    response.json({ credential: claudeCredentials.getCredentialStatus(request.auth!.user.id) });
  });

router.put("/settings/ai/external-agents/anthropic-credential", requireAuthentication, asyncHandler(async (request, response) => {
    const body = parseBody<{ secret: string }>(aiAccountCredentialSchema, request.body);
    try {
      response.json({ credential: await claudeCredentials.verifyAndSaveCredential(request.auth!.user.id, body.secret) });
    } catch (error) {
      throw new ApiError(422, "anthropic_console_credential_save_failed", error instanceof Error ? error.message : "Anthropic Console API Key 验证或加密保存失败。" );
    }
  }));

router.delete("/settings/ai/external-agents/anthropic-credential", requireAuthentication, (request, response) => {
    claudeCredentials.deleteCredential(request.auth!.user.id);
    response.status(204).end();
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
      response.json({ result: await testAiProviderModel(request.auth!.user.id, body) });
    } catch (error) {
      throw new ApiError(422, "ai_model_test_failed", error instanceof Error ? error.message : "模型测试失败。");
    }
  }));

router.post("/settings/ai/accounts", requireAuthentication, asyncHandler(async (request, response) => {
    const body = parseBody<{ providerId: string; secret: string; options: Record<string, string>; displayName: string; modelId: string; reasoningMode: string; verificationToken?: string }>(aiAccountSchema, request.body);
    assertAiProviderWriteAccess(request.auth!.user.role, body.providerId);
    try {
      const account = await saveAiAccount(request.auth!.user.id, body);
      response.status(201).json({ account });
    } catch (error) {
      throw new ApiError(422, "ai_account_save_failed", error instanceof Error ? error.message : "AI 账户保存失败。");
    }
  }));

router.post("/settings/ai/accounts/:accountId/refresh-models", requireAuthentication, asyncHandler(async (request, response) => {
    assertAiAccountWriteAccess(request.auth!.user.id, request.auth!.user.role, request.params.accountId);
    try {
      response.json({ result: await refreshAiAccountModelCatalog(request.auth!.user.id, request.params.accountId) });
    } catch (error) {
      throw new ApiError(422, "ai_account_probe_failed", error instanceof Error ? error.message : "AI 模型目录更新失败。");
    }
  }));

router.post("/settings/ai/accounts/:accountId/test-model", requireAuthentication, asyncHandler(async (request, response) => {
    assertAiAccountWriteAccess(request.auth!.user.id, request.auth!.user.role, request.params.accountId);
    try {
      response.json({ result: await testSavedAiAccountModel(request.auth!.user.id, request.params.accountId) });
    } catch (error) {
      throw new ApiError(422, "ai_model_test_failed", error instanceof Error ? error.message : "模型测试失败。");
    }
  }));

router.post("/settings/ai/accounts/:accountId/test-credential", requireAuthentication, asyncHandler(async (request, response) => {
    assertAiAccountWriteAccess(request.auth!.user.id, request.auth!.user.role, request.params.accountId);
    const body = parseBody<{ secret: string }>(aiAccountCredentialSchema, request.body);
    try {
      response.json({ result: await testAiAccountCredential(request.auth!.user.id, request.params.accountId, body.secret) });
    } catch (error) {
      throw new ApiError(422, "ai_account_credential_test_failed", error instanceof Error ? error.message : "系统模型 API Key 测试失败。");
    }
  }));

router.put("/settings/ai/accounts/:accountId/credential", requireAuthentication, asyncHandler(async (request, response) => {
    assertAiAccountWriteAccess(request.auth!.user.id, request.auth!.user.role, request.params.accountId);
    const body = parseBody<{ secret: string }>(aiAccountCredentialSchema, request.body);
    try {
      response.json({ account: await updateAiAccountCredential(request.auth!.user.id, request.params.accountId, body.secret) });
    } catch (error) {
      throw new ApiError(422, "ai_account_credential_save_failed", error instanceof Error ? error.message : "系统模型 API Key 保存失败。");
    }
  }));

router.put("/settings/ai/accounts/:accountId/model", requireAuthentication, asyncHandler(async (request, response) => {
    assertAiAccountWriteAccess(request.auth!.user.id, request.auth!.user.role, request.params.accountId);
    const body = parseBody<{ modelId: string }>(aiModelSchema, request.body);
    try {
      response.json({ account: await updateAiAccountModel(request.auth!.user.id, request.params.accountId, body.modelId) });
    } catch (error) {
      throw new ApiError(422, "ai_account_model_failed", error instanceof Error ? error.message : "AI 模型更新失败。");
    }
  }));

router.put("/settings/ai/accounts/:accountId/reasoning", requireAuthentication, (request, response) => {
    assertAiAccountWriteAccess(request.auth!.user.id, request.auth!.user.role, request.params.accountId);
    const body = parseBody<{ reasoningMode: string }>(aiReasoningSchema, request.body);
    try {
      response.json({ account: updateAiAccountReasoningMode(request.auth!.user.id, request.params.accountId, body.reasoningMode) });
    } catch (error) {
      throw new ApiError(422, "ai_account_reasoning_failed", error instanceof Error ? error.message : "思考参数更新失败。");
    }
  });

router.post("/settings/ai/accounts/:accountId/activate", requireAuthentication, (request, response) => {
    assertAiAccountWriteAccess(request.auth!.user.id, request.auth!.user.role, request.params.accountId);
    try {
      response.json({ account: activateAiAccount(request.auth!.user.id, request.params.accountId) });
    } catch (error) {
      throw new ApiError(404, "ai_account_activation_failed", error instanceof Error ? error.message : "AI 账户激活失败。");
    }
  });

router.delete("/settings/ai/accounts/:accountId", requireAuthentication, (request, response) => {
    assertAiAccountWriteAccess(request.auth!.user.id, request.auth!.user.role, request.params.accountId);
    deleteAiAccount(request.auth!.user.id, request.params.accountId);
    response.status(204).end();
  });

router.get("/data-directory", requireAuthentication, requireRole("admin"), (_request, response) => {
    response.json({ settings: getDataDirectorySettings() });
  });
router.get("/project-storage-locations", requireAuthentication, requireRole("admin"), (_request, response) => {
    response.json(getProjectStorageLocations());
  });
router.put("/project-storage-locations", requireAuthentication, requireRole("admin"), (request, response) => {
    const body = parseBody<{ contentDirectory: string }>(projectContentStorageSchema, request.body);
    try {
      authorizeBusinessContentAction(request.auth!.user.id, "select-location", body.contentDirectory);
      response.json(saveProjectContentDirectory(body.contentDirectory));
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(400, "invalid_content_storage_location", error instanceof Error ? error.message : "内容存储位置无效。");
    }
  });
router.post("/project-storage-locations/confirm", requireAuthentication, requireRole("admin"), (_request, response) => {
    try {
      authorizeBusinessContentAction(_request.auth!.user.id, "keep-location", getProjectStorageLocations().settings.contentDirectory);
      response.json(confirmProjectContentDirectory());
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(400, "invalid_content_storage_location", error instanceof Error ? error.message : "内容存储位置无效。");
    }
  });
router.post("/project-storage-locations/compare", requireAuthentication, requireRole("admin"), asyncHandler(async (request, response) => {
    const body = parseBody<{ targetDirectory: string }>(projectContentMigrationSchema, request.body);
    try { response.json(await compareProjectContentDirectories(body.targetDirectory)); }
    catch (error) { throw new ApiError(422, "project_content_compare_failed", error instanceof Error ? error.message : "业务内容核对失败。"); }
  }));
router.post("/project-storage-locations/copy", requireAuthentication, requireRole("admin"), asyncHandler(async (request, response) => {
    const body = parseBody<{ targetDirectory: string }>(projectContentMigrationSchema, request.body);
    try { authorizeBusinessContentAction(request.auth!.user.id, "copy-and-switch", body.targetDirectory); response.json(await copyProjectContentToDirectory(body.targetDirectory)); }
    catch (error) { throw new ApiError(422, "project_content_copy_failed", error instanceof Error ? error.message : "业务内容复制失败；原内容位置仍保持生效。"); }
  }));
router.post("/project-storage-locations/adopt", requireAuthentication, requireRole("admin"), asyncHandler(async (request, response) => {
    const body = parseBody<{ targetDirectory: string }>(projectContentMigrationSchema, request.body);
    try { authorizeBusinessContentAction(request.auth!.user.id, "verify-and-switch", body.targetDirectory); response.json(await adoptProjectContentDirectory(body.targetDirectory)); }
    catch (error) { throw new ApiError(422, "project_content_adopt_failed", error instanceof Error ? error.message : "手动复制后的业务内容核对失败。"); }
  }));
router.post("/project-storage-locations/archive/import", requireAuthentication, requireRole("admin"), asyncHandler(async (request, response) => {
    const body = parseBody<{ targetDirectory: string; archivePath: string }>(projectContentArchiveImportSchema, request.body);
    try { authorizeBusinessContentAction(request.auth!.user.id, "import-and-switch", body.targetDirectory); response.json(await importProjectContentArchive(body.archivePath, body.targetDirectory)); }
    catch (error) { throw new ApiError(422, "project_content_archive_import_failed", error instanceof Error ? error.message : "业务 ZIP 导入失败；当前内容目录仍保持生效。"); }
  }));
router.post("/project-storage-locations/archive/export", requireAuthentication, requireRole("admin"), asyncHandler(async (_request, response, next) => {
    authorizeBusinessContentAction(_request.auth!.user.id, "export-archive", getProjectStorageLocations().settings.contentDirectory);
    const artifact = await createProjectContentArchive();
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      void artifact.cleanup();
    };
    response.once("close", cleanup);
    response.download(artifact.path, artifact.fileName, error => {
      cleanup();
      if (error && !response.headersSent) next(error);
    });
  }));
router.post("/data-directory/recommended", requireAuthentication, requireSuperAdmin, (_request, response) => {
    try { response.json({ settings: recommendDataDirectoryLocation() }); }
    catch (error) { if (error instanceof DataDirectorySettingsError) throw new ApiError(409, error.errorCode, error.message); throw error; }
  });
router.post("/data-directory/confirm", requireAuthentication, requireSuperAdmin, (_request, response) => {
    response.json({ settings: confirmDataDirectoryLocation() });
  });

router.put("/data-directory", requireAuthentication, requireSuperAdmin, (request, response) => {
    const body = parseBody<{ directory: string; mode: "copy" | "adopt" | "archive"; archivePath: string }>(dataDirectorySettingsSchema, request.body);
    try {
      response.json({ settings: requestDataDirectoryChange(body.directory, body.mode, body.archivePath) });
    } catch (error) {
      if (error instanceof DataDirectorySettingsError) {
        const statusCode = error.errorCode === "invalid_data_directory" ? 400 : 409;
        throw new ApiError(statusCode, error.errorCode, error.message);
      }
      throw new ApiError(500, "data_directory_migration_unavailable", "无法保存数据目录迁移请求。");
    }
  });

router.delete("/data-directory", requireAuthentication, requireSuperAdmin, (_request, response) => {
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
export const inject = ["apiGateway", "lfaaAttachments", "lfaaSubagentClaudeCode"];
export function apply(ctx: Context): void {
  ctx.apiGateway.register(ctx, "settings-controller", (router, aiPluginHost, realtime) => registerRoutes(router, aiPluginHost, realtime, ctx.lfaaAttachments, ctx.lfaaSubagentClaudeCode));
}
