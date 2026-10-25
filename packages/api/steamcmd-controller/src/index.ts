/** 功能：登记 steamcmd-controller 的现有接口。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。 */
import { Router } from "express";
import { ApiError } from "lfaa-util-values/src/http-error.js";
import { requireAuthentication, requireRole } from "lfaa-authorization/src/middleware.js";
import { authorizeExplicitUserAction } from "lfaa-permission-presets/src/permissions.js";
import { assertSystemFileAccess } from "lfaa-fs/src/library.js";
import { getDaemonDataRoot, getDaemonNode, listDaemonNodes } from "lfaa-host-daemon/src/local-daemon.js";
import { createSteamcmdDstCluster, createSteamcmdServer, createSteamcmdServerTask, createSteamcmdTask, getSteamcmdConfigurationDefaults, getSteamcmdNodeConfiguration, getSteamcmdNodeStorageSettings, getSteamcmdServer, getSteamcmdStorageDefaults, getSteamcmdTask, hasSteamcmdNodeConfiguration, hasSteamcmdNodeStorageSettings, listSteamcmdServers, saveSteamcmdConfigurationDefaults, saveSteamcmdNodeConfiguration, saveSteamcmdNodeStorageSettings, saveSteamcmdStorageDefaults, updateSteamcmdServer, type SteamcmdDstClusterInput, type SteamcmdServerInput } from "lfaa-games-steamcmd/src/service.js";
import type { AiPluginHost } from "lfaa-app-boot/src/ai-host.js";
import type { MinecraftRealtimePublisher } from "lfaa-api-remotes/src/socket-server.js";
import { parseBody, steamcmdConfigurationSettingsSchema, steamcmdDstClusterSchema, steamcmdServerSchema, steamcmdServerTaskSchema, steamcmdStorageSettingsSchema, steamcmdTaskSchema } from "lfaa-api-remotes/src/route-contracts.js";
import { ensureProjectStorageDirectory, isOutsideProjectDataDirectory } from "lfaa-settings/src/project-storage.js";
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

router.get("/steamcmd/servers", requireAuthentication, requireRole("admin"), (request, response) => {
    const nodeId = typeof request.query.nodeId === "string" ? request.query.nodeId : undefined;
    if (nodeId && !getDaemonNode(nodeId)) throw new ApiError(404, "daemon_node_not_found", "找不到目标 daemon 节点。");
    response.json({ servers: listSteamcmdServers(nodeId) });
  });

router.post("/steamcmd/servers", requireAuthentication, requireRole("admin"), (request, response) => {
    const body = parseBody<SteamcmdServerInput>(steamcmdServerSchema, request.body);
    const authorization = authorizeExplicitUserAction({ userId: request.auth!.user.id, activeApplicationId: "steamcmd", toolApplicationIds: ["steamcmd"], toolId: "steamcmd.server.create", toolVersion: "1", risk: "write", scopeKey: `${body.nodeId}:${body.toolAppId}`, executable: true });
    if (authorization !== "allow") throw new ApiError(403, "steamcmd_server_not_authorized", "当前权限模式未授权此 Steam 游戏服务器配置写入。");
    try { response.status(201).json({ server: createSteamcmdServer({ ...body, createdBy: request.auth!.user.id }) }); }
    catch (error) { throw new ApiError(400, "steamcmd_server_invalid", error instanceof Error ? error.message : "Steam 游戏服务器配置无效。"); }
  });

router.post("/steamcmd/dst-clusters", requireAuthentication, requireRole("admin"), (request, response) => {
    const body = parseBody<SteamcmdDstClusterInput>(steamcmdDstClusterSchema, request.body);
    const authorization = authorizeExplicitUserAction({ userId: request.auth!.user.id, activeApplicationId: "steamcmd", toolApplicationIds: ["steamcmd"], toolId: "steamcmd.dst-cluster.create", toolVersion: "1", risk: "write", scopeKey: `${body.nodeId}:${body.toolAppId}:dst:${body.clusterName}`, executable: true });
    if (authorization !== "allow") throw new ApiError(403, "steamcmd_dst_cluster_not_authorized", "当前权限模式未授权创建饥荒服务器集群。");
    try { response.status(201).json(createSteamcmdDstCluster({ ...body, createdBy: request.auth!.user.id })); }
    catch (error) { throw new ApiError(409, "steamcmd_dst_cluster_invalid", error instanceof Error ? error.message : "饥荒服务器集群配置无效。"); }
  });

router.put("/steamcmd/servers/:serverId", requireAuthentication, requireRole("admin"), (request, response) => {
    const body = parseBody<Parameters<typeof updateSteamcmdServer>[1]>(steamcmdServerSchema, request.body);
    const server = getSteamcmdServer(request.params.serverId);
    if (!server) throw new ApiError(404, "steamcmd_server_not_found", "找不到此 Steam 游戏服务器。");
    const authorization = authorizeExplicitUserAction({ userId: request.auth!.user.id, activeApplicationId: "steamcmd", toolApplicationIds: ["steamcmd"], toolId: "steamcmd.server.configure", toolVersion: "1", risk: "write", scopeKey: server.id, executable: true });
    if (authorization !== "allow") throw new ApiError(403, "steamcmd_server_not_authorized", "当前权限模式未授权此 Steam 游戏服务器配置写入。");
    try { response.json({ server: updateSteamcmdServer(server.id, body) }); }
    catch (error) { throw new ApiError(409, "steamcmd_server_update_conflict", error instanceof Error ? error.message : "Steam 游戏服务器配置无法更新。"); }
  });

router.post("/steamcmd/servers/:serverId/tasks", requireAuthentication, requireRole("admin"), (request, response) => {
    const body = parseBody<{ kind: "install-server" | "update-server" | "start-server" | "stop-server" }>(steamcmdServerTaskSchema, request.body);
    const server = getSteamcmdServer(request.params.serverId);
    if (!server) throw new ApiError(404, "steamcmd_server_not_found", "找不到此 Steam 游戏服务器。");
    const risk = body.kind === "install-server" || body.kind === "update-server" ? "write" : "dangerous";
    const authorization = authorizeExplicitUserAction({ userId: request.auth!.user.id, activeApplicationId: "steamcmd", toolApplicationIds: ["steamcmd"], toolId: `steamcmd.server.${body.kind}`, toolVersion: "1", risk, scopeKey: server.id, executable: true });
    if (authorization !== "allow") throw new ApiError(403, "steamcmd_server_not_authorized", "当前权限模式未授权此 Steam 游戏服务器操作。");
    try {
      const task = createSteamcmdServerTask({ serverId: server.id, nodeId: server.nodeId, createdBy: request.auth!.user.id, kind: body.kind });
      response.status(202).json({ task: { ...task, payload: undefined } });
    } catch (error) { throw new ApiError(409, "steamcmd_server_task_unavailable", error instanceof Error ? error.message : "Steam 游戏服务器任务暂不可用。"); }
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
      if (isOutsideProjectDataDirectory(body.gameDirectory)) assertSystemFileAccess(request.auth!.user.id);
      ensureProjectStorageDirectory(body.gameDirectory);
      response.json({ settings: saveSteamcmdStorageDefaults(body) });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(400, "invalid_steamcmd_storage_settings", error instanceof Error ? error.message : "Steam 游戏存储设置无效。");
    }
  });

router.put("/steamcmd/storage-settings/:nodeId", requireAuthentication, requireRole("admin"), (request, response) => {
    const body = parseBody<ReturnType<typeof getSteamcmdStorageDefaults>["settings"]>(steamcmdStorageSettingsSchema, request.body);
    if (!getDaemonNode(request.params.nodeId)) throw new ApiError(404, "daemon_node_not_found", "找不到目标 daemon 节点。");
    try {
      if (/^[a-z]:[\\/]/iu.test(body.gameDirectory)) assertSystemFileAccess(request.auth!.user.id);
      response.json({ settings: saveSteamcmdNodeStorageSettings({ nodeId: request.params.nodeId, ...body }) });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(400, "invalid_steamcmd_storage_settings", error instanceof Error ? error.message : "Steam 游戏存储设置无效。");
    }
  });

router.post("/steamcmd/tasks", requireAuthentication, requireRole("admin"), (request, response) => {
    const body = parseBody<{ nodeId: string; kind: "install" | "verify" | "uninstall" }>(steamcmdTaskSchema, request.body);
    const authorization = authorizeExplicitUserAction({ userId: request.auth!.user.id, activeApplicationId: "steamcmd", toolApplicationIds: ["steamcmd"], toolId: `steamcmd.runtime.${body.kind}`, toolVersion: "1", risk: body.kind === "uninstall" ? "dangerous" : "write", scopeKey: body.nodeId, executable: true });
    if (authorization !== "allow") throw new ApiError(403, "steamcmd_runtime_not_authorized", "当前权限模式未授权此 SteamCMD 运行环境操作。");
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
