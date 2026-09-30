/** 功能：登记 steamcmd-controller 的现有接口。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。 */
import { Router } from "express";
import { ApiError } from "lfaa-util-values/src/http-error.js";
import { requireAuthentication, requireRole } from "lfaa-authorization/src/middleware.js";
import { getDaemonDataRoot, getDaemonNode, listDaemonNodes } from "lfaa-host-daemon/src/local-daemon.js";
import { createSteamcmdTask, getSteamcmdConfigurationDefaults, getSteamcmdNodeConfiguration, getSteamcmdNodeStorageSettings, getSteamcmdStorageDefaults, getSteamcmdTask, hasSteamcmdNodeConfiguration, hasSteamcmdNodeStorageSettings, saveSteamcmdConfigurationDefaults, saveSteamcmdNodeConfiguration, saveSteamcmdNodeStorageSettings, saveSteamcmdStorageDefaults } from "lfaa-games-steamcmd/src/service.js";
import type { AiPluginHost } from "lfaa-app-boot/src/ai-host.js";
import type { MinecraftRealtimePublisher } from "lfaa-api-remotes/src/socket-server.js";
import { parseBody, steamcmdConfigurationSettingsSchema, steamcmdStorageSettingsSchema, steamcmdTaskSchema } from "lfaa-api-remotes/src/route-contracts.js";
export function registerRoutes(router: Router, _aiPluginHost: AiPluginHost, realtime: MinecraftRealtimePublisher): void {

router.get("/steamcmd/settings", requireAuthentication, requireRole("admin"), (_request, response) => {
    const configurationDefaults = getSteamcmdConfigurationDefaults();
    const storageDefaults = getSteamcmdStorageDefaults();
    const nodes = listDaemonNodes(() => realtime.publishMinecraftChange(["state"]))
      .filter((node) => node.platform === "win32" && node.architecture === "x64")
      .map((node) => ({
        id: node.id,
        displayName: node.displayName,
        platform: node.platform,
        architecture: node.architecture,
        version: node.version,
        status: node.status,
        capabilities: node.capabilities,
        lastSeenAt: node.lastSeenAt,
        dataRoot: getDaemonDataRoot(node.id),
        configurationConfigured: hasSteamcmdNodeConfiguration(node.id),
        storageConfigured: hasSteamcmdNodeStorageSettings(node.id),
        steamcmdInstalled: node.status === "online" && node.capabilities.includes("steamcmd-ready-v1"),
        configuration: getSteamcmdNodeConfiguration(node.id),
        storage: getSteamcmdNodeStorageSettings(node.id)
      }));
    response.json({
      nodes,
      configurationDefaults: configurationDefaults.settings,
      configurationDefaultsConfigured: configurationDefaults.configured,
      storageDefaults: storageDefaults.settings,
      storageDefaultsConfigured: storageDefaults.configured
    });
  });

router.put("/steamcmd/configuration-settings/defaults", requireAuthentication, requireRole("admin"), (request, response) => {
    const body = parseBody<ReturnType<typeof getSteamcmdConfigurationDefaults>["settings"]>(steamcmdConfigurationSettingsSchema, request.body);
    try {
      response.json({ settings: saveSteamcmdConfigurationDefaults(body) });
    } catch (error) {
      throw new ApiError(400, "invalid_steamcmd_configuration", error instanceof Error ? error.message : "SteamCMD 安装配置无效。");
    }
  });

router.put("/steamcmd/configuration-settings/:nodeId", requireAuthentication, requireRole("admin"), (request, response) => {
    const body = parseBody<ReturnType<typeof getSteamcmdConfigurationDefaults>["settings"]>(steamcmdConfigurationSettingsSchema, request.body);
    if (!getDaemonNode(request.params.nodeId)) throw new ApiError(404, "daemon_node_not_found", "找不到目标 daemon 节点。");
    try {
      response.json({ settings: saveSteamcmdNodeConfiguration({ nodeId: request.params.nodeId, ...body }) });
    } catch (error) {
      throw new ApiError(400, "invalid_steamcmd_configuration", error instanceof Error ? error.message : "SteamCMD 安装配置无效。");
    }
  });

router.put("/steamcmd/storage-settings/defaults", requireAuthentication, requireRole("admin"), (request, response) => {
    const body = parseBody<ReturnType<typeof getSteamcmdStorageDefaults>["settings"]>(steamcmdStorageSettingsSchema, request.body);
    try {
      response.json({ settings: saveSteamcmdStorageDefaults(body) });
    } catch (error) {
      throw new ApiError(400, "invalid_steamcmd_storage_settings", error instanceof Error ? error.message : "Steam 游戏存储设置无效。");
    }
  });

router.put("/steamcmd/storage-settings/:nodeId", requireAuthentication, requireRole("admin"), (request, response) => {
    const body = parseBody<ReturnType<typeof getSteamcmdStorageDefaults>["settings"]>(steamcmdStorageSettingsSchema, request.body);
    if (!getDaemonNode(request.params.nodeId)) throw new ApiError(404, "daemon_node_not_found", "找不到目标 daemon 节点。");
    try {
      response.json({ settings: saveSteamcmdNodeStorageSettings({ nodeId: request.params.nodeId, ...body }) });
    } catch (error) {
      throw new ApiError(400, "invalid_steamcmd_storage_settings", error instanceof Error ? error.message : "Steam 游戏存储设置无效。");
    }
  });

router.post("/steamcmd/tasks", requireAuthentication, requireRole("admin"), (request, response) => {
    const body = parseBody<{ nodeId: string; kind: "install" | "verify" }>(steamcmdTaskSchema, request.body);
    try {
      const task = createSteamcmdTask({ ...body, createdBy: request.auth!.user.id });
      response.status(202).json({ task: { ...task, payload: undefined } });
    } catch (error) {
      throw new ApiError(409, "steamcmd_task_unavailable", error instanceof Error ? error.message : "SteamCMD 任务暂不可用。");
    }
  });

router.get("/steamcmd/tasks/:taskId", requireAuthentication, requireRole("admin"), (request, response) => {
    const task = getSteamcmdTask(request.params.taskId);
    if (!task) throw new ApiError(404, "steamcmd_task_not_found", "找不到此 SteamCMD 任务。");
    response.json({ task: { ...task, payload: undefined } });
  });
}

/** 将本控制器的路由层与当前插件生命周期绑定。 */
import type { Context } from "@deepseek-ai/cordis";
import "lfaa-api-gateway/src/index.js";
export const inject = ["apiGateway"];
export function apply(ctx: Context): void { ctx.apiGateway.register(ctx, "steamcmd-controller", registerRoutes); }
