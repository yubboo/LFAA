/** 功能：提供联机 App 的账户 API 与固定结构 Daemon Relay API。 */
import { Router } from "express";
import Joi from "joi";
import type { AiPluginHost } from "lfaa-app-boot/src/ai-host.js";
import type { MinecraftRealtimePublisher } from "lfaa-api-remotes/src/socket-server.js";
import { asyncHandler, parseBody, requireLocalDaemon } from "lfaa-api-remotes/src/route-contracts.js";
import { requireAuthentication } from "lfaa-authorization/src/middleware.js";
import { getDaemonNode, listDaemonNodes } from "lfaa-host-daemon/src/local-daemon.js";
import { ApiError } from "lfaa-util-values/src/http-error.js";
import { APPLICATION_IDS, type ApplicationId } from "lfaa-util-values/src/application-id.js";
import { ConnectivityServiceError, type ConnectivityMode, type GameConnectivityService, type GameTransport } from "lfaa-game-connectivity/src/service.js";
import { EASYTIER_RUNTIME_RELEASE } from "lfaa-game-connectivity/src/easytier-release.mjs";

const routeInputSchema = Joi.object({
  sourceAppId: Joi.alternatives().try(Joi.string().valid("custom"), Joi.string().valid(...APPLICATION_IDS)).required(),
  targetId: Joi.string().guid().allow(null),
  name: Joi.string().trim().min(1).max(64).required(),
  mode: Joi.string().valid("provider", "self-managed", "room-domain").required(),
  transport: Joi.string().valid("tcp", "udp").required(),
  nodeId: Joi.string().guid(),
  localPort: Joi.number().integer().min(1).max(65535),
  playerAddress: Joi.string().trim().max(280)
}).unknown(false);
const daemonRoutesSchema = Joi.object({ nodeId: Joi.string().guid().required() }).unknown(false);
const daemonStateSchema = Joi.object({ nodeId: Joi.string().guid().required(), state: Joi.string().valid("connected", "offline", "failed").required(), errorCode: Joi.string().trim().max(80).allow(null) }).unknown(false);
const providerCredentialSchema = Joi.object({ token: Joi.string().trim().min(8).max(4096).required() }).unknown(false);
const easyTierInstallSchema = Joi.object({ nodeId: Joi.string().guid().required() }).unknown(false);
const easyTierClaimSchema = Joi.object({ nodeId: Joi.string().guid().required() }).unknown(false);
const easyTierCompleteSchema = Joi.object({ nodeId: Joi.string().guid().required(), succeeded: Joi.boolean().required(), version: Joi.string().valid(EASYTIER_RUNTIME_RELEASE.version) }).unknown(false);

function mapServiceError(error: unknown): never {
  if (error instanceof ConnectivityServiceError) {
    const status = error.code === "relay_not_configured" || error.code === "provider_unavailable" || error.code === "easytier_install_pending" ? 409
      : error.code.endsWith("quota_exceeded") || error.code.endsWith("capacity_reached") ? 429
        : error.code === "target_unavailable" || error.code === "room_name_in_use" ? 409 : 400;
    throw new ApiError(status, error.code, error.message);
  }
  throw error;
}

export function registerRoutes(router: Router, _aiHost: AiPluginHost, realtime: MinecraftRealtimePublisher, connectivity: GameConnectivityService): void {
  router.get("/connectivity/overview", requireAuthentication, (request, response) => {
    const ownerId = request.auth!.user.id;
    response.setHeader("Cache-Control", "no-store");
    const nodes = listDaemonNodes().filter(node => node.status === "online").map(node => ({ id: node.id, displayName: node.displayName, platform: node.platform, architecture: node.architecture, capabilities: node.capabilities }));
    response.json({ deployment: connectivity.getDeploymentStatus(), providers: connectivity.listProviderAdapters(ownerId), routes: connectivity.listRoutes(ownerId), targets: connectivity.listTargets(ownerId), nodes, easyTier: { version: EASYTIER_RUNTIME_RELEASE.version, license: EASYTIER_RUNTIME_RELEASE.license, installCapability: EASYTIER_RUNTIME_RELEASE.installCapability, runtimeCapability: EASYTIER_RUNTIME_RELEASE.runtimeCapability } });
  });

  router.post("/connectivity/easytier/install", requireAuthentication, (request, response) => {
    const body = parseBody<{ nodeId: string }>(easyTierInstallSchema, request.body);
    const user = request.auth!.user;
    if (user.role === "member") throw new ApiError(403, "connectivity_engine_admin_required", "EasyTier 运行包安装需要管理员权限。");
    const node = getDaemonNode(body.nodeId);
    if (!node || node.status !== "online" || Date.parse(node.lastSeenAt) < Date.now() - 20_000) throw new ApiError(409, "connectivity_engine_node_offline", "目标 Daemon 节点当前不在线。");
    if (node.platform !== EASYTIER_RUNTIME_RELEASE.platform || node.architecture !== EASYTIER_RUNTIME_RELEASE.architecture) throw new ApiError(409, "connectivity_engine_platform_unsupported", "当前只支持 Windows x64 Daemon 安装 EasyTier。");
    if (!node.capabilities.includes(EASYTIER_RUNTIME_RELEASE.installCapability)) throw new ApiError(409, "connectivity_engine_daemon_outdated", "目标 Daemon 尚未提供受控 EasyTier 安装能力，请先更新 Daemon。");
    if (node.capabilities.includes(EASYTIER_RUNTIME_RELEASE.runtimeCapability)) throw new ApiError(409, "connectivity_engine_already_installed", "目标节点已报告 EasyTier 运行版本通过核验。");
    let task;
    try {
      task = connectivity.createEasyTierInstallTask(user.id, node.id);
    } catch (error) {
      mapServiceError(error);
    }
    response.setHeader("Cache-Control", "no-store");
    response.status(202).json({ task: publicEasyTierTask(task) });
  });

  router.get("/connectivity/easytier/tasks", requireAuthentication, (request, response) => {
    const tasks = connectivity.listEasyTierInstallTasks(request.auth!.user.id).map(publicEasyTierTask);
    response.setHeader("Cache-Control", "no-store");
    response.json({ tasks });
  });

  router.get("/connectivity/easytier/tasks/:taskId", requireAuthentication, (request, response) => {
    const task = connectivity.getEasyTierInstallTask(request.auth!.user.id, request.params.taskId);
    if (!task) throw new ApiError(404, "connectivity_engine_task_not_found", "找不到当前账户创建的 EasyTier 安装任务。");
    response.setHeader("Cache-Control", "no-store");
    response.json({ task: publicEasyTierTask(task) });
  });

  router.get("/connectivity/targets", requireAuthentication, (request, response) => {
    const appId = typeof request.query.applicationId === "string" ? request.query.applicationId : undefined;
    if (appId !== undefined && !APPLICATION_IDS.includes(appId as ApplicationId)) throw new ApiError(400, "invalid_connectivity_application", "游戏 App 标识无效。");
    response.setHeader("Cache-Control", "no-store");
    response.json({ targets: connectivity.listTargets(request.auth!.user.id, appId as ApplicationId | undefined) });
  });

  router.get("/connectivity/routes", requireAuthentication, (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.json({ routes: connectivity.listRoutes(request.auth!.user.id) });
  });

  router.post("/connectivity/providers/:providerId/credential", requireAuthentication, (request, response) => {
    const body = parseBody<{ token: string }>(providerCredentialSchema, request.body);
    try { connectivity.saveProviderCredential(request.auth!.user.id, request.params.providerId, body.token); }
    catch (error) { mapServiceError(error); }
    response.setHeader("Cache-Control", "no-store");
    response.status(204).end();
  });

  router.delete("/connectivity/providers/:providerId/credential", requireAuthentication, (request, response) => {
    try { connectivity.deleteProviderCredential(request.auth!.user.id, request.params.providerId); }
    catch (error) { mapServiceError(error); }
    response.status(204).end();
  });

  router.post("/connectivity/providers/:providerId/catalog", requireAuthentication, asyncHandler(async (request, response) => {
    const body = parseBody<{ kind: "nodes" }>(Joi.object({ kind: Joi.string().valid("nodes").required() }).unknown(false), request.body);
    try {
      const result = await connectivity.invokeProvider(request.auth!.user.id, request.params.providerId, body);
      response.setHeader("Cache-Control", "no-store");
      response.json({ result });
    } catch (error) { mapServiceError(error); }
  }));

  router.post("/connectivity/routes", requireAuthentication, asyncHandler(async (request, response) => {
    const body = parseBody<{ sourceAppId: ApplicationId | "custom"; targetId?: string | null; name: string; mode: ConnectivityMode; transport: GameTransport; nodeId?: string; localPort?: number; playerAddress?: string }>(routeInputSchema, request.body);
    if (body.sourceAppId === "custom") {
      const node = body.nodeId ? getDaemonNode(body.nodeId) : null;
      if (request.auth!.user.role === "member") throw new ApiError(403, "custom_target_forbidden", "自定义节点端口目标仅允许管理员创建；游戏 App 的账户归属目标可以由账户本人管理。");
      if (!node || node.status !== "online") throw new ApiError(409, "connectivity_node_offline", "目标 Daemon 节点当前不在线。");
    }
    try {
      const route = connectivity.createRoute(request.auth!.user.id, body);
      realtime.publishMinecraftChange(["state"]);
      response.status(201).json({ route });
    } catch (error) { mapServiceError(error); }
  }));

  router.delete("/connectivity/routes/:routeId", requireAuthentication, (request, response) => {
    if (!/^[0-9a-f-]{36}$/iu.test(request.params.routeId)) throw new ApiError(400, "invalid_route_id", "联机路线 ID 无效。");
    if (!connectivity.deleteRoute(request.auth!.user.id, request.params.routeId)) throw new ApiError(404, "connectivity_route_not_found", "找不到当前账户的联机路线。");
    realtime.publishMinecraftChange(["state"]);
    response.status(204).end();
  });

  router.post("/connectivity/daemon/routes", requireLocalDaemon, (request, response) => {
    const body = parseBody<{ nodeId: string }>(daemonRoutesSchema, request.body);
    response.setHeader("Cache-Control", "no-store");
    response.json({ routes: connectivity.getDaemonRoutes(body.nodeId) });
  });

  router.post("/connectivity/daemon/routes/:routeId/state", requireLocalDaemon, (request, response) => {
    const body = parseBody<{ nodeId: string; state: "connected" | "offline" | "failed"; errorCode?: string | null }>(daemonStateSchema, request.body);
    const route = connectivity.reportDaemonState(body.nodeId, request.params.routeId, body.state, body.errorCode ?? null);
    if (!route) throw new ApiError(404, "connectivity_route_not_found", "当前节点没有此活动联机路线。");
    realtime.publishMinecraftChange(["state"]);
    response.json({ state: route.state, lastConnectedAt: route.lastConnectedAt });
  });

  router.post("/connectivity/daemon/easytier/install/claim", requireLocalDaemon, (request, response) => {
    const body = parseBody<{ nodeId: string }>(easyTierClaimSchema, request.body);
    const node = getDaemonNode(body.nodeId);
    if (!node || node.status !== "online" || Date.parse(node.lastSeenAt) < Date.now() - 20_000
      || node.platform !== EASYTIER_RUNTIME_RELEASE.platform || node.architecture !== EASYTIER_RUNTIME_RELEASE.architecture
      || !node.capabilities.includes(EASYTIER_RUNTIME_RELEASE.installCapability)) {
      throw new ApiError(409, "connectivity_engine_daemon_unavailable", "目标节点当前不能接收 EasyTier 安装任务。");
    }
    response.setHeader("Cache-Control", "no-store");
    response.json({ task: connectivity.claimEasyTierInstallTask(node.id) });
  });

  router.post("/connectivity/daemon/easytier/install/:taskId/complete", requireLocalDaemon, (request, response) => {
    if (!/^[0-9a-f-]{36}$/iu.test(request.params.taskId)) throw new ApiError(400, "invalid_connectivity_task_id", "EasyTier 安装任务 ID 无效。");
    const body = parseBody<{ nodeId: string; succeeded: boolean; version?: string }>(easyTierCompleteSchema, request.body);
    if (!connectivity.completeEasyTierInstallTask(body.nodeId, request.params.taskId, body.succeeded, body.version)) {
      throw new ApiError(404, "connectivity_engine_task_not_found", "找不到此节点当前运行中的 EasyTier 安装任务。");
    }
    response.setHeader("Cache-Control", "no-store");
    response.status(204).end();
  });
}

function publicEasyTierTask(task: { id: string; nodeId: string; status: string; message: string; createdAt: string; finishedAt: string | null }) {
  return { id: task.id, nodeId: task.nodeId, status: task.status, message: task.message, createdAt: task.createdAt, finishedAt: task.finishedAt };
}
