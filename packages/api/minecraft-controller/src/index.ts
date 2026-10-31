/** 功能：登记 minecraft-controller 的现有接口。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。 */
import { Router } from "express";
import {runtimeManager} from "lfaa-runtime-manager/src/service.js";
import {requestMinecraftTaskCancellation} from "lfaa-jobs/src/minecraft-queue.js";
import {resolveMinecraftCoreArtifact} from "lfaa-games-minecraft/src/core-sources.js";
import { issueDaemonCredential, listDaemonCredentials, revokeDaemonCredential } from "lfaa-host-daemon/src/node-credentials.js";
import { deleteMinecraftInstance, getMinecraftInstanceShellDirectory, getMinecraftServerTelemetry, readMinecraftServerProperties, restartMinecraftInstance, sendMinecraftConsoleCommand } from "lfaa-games-minecraft/src/service.js";
import Joi from "joi";
import { ApiError } from "lfaa-util-values/src/http-error.js";
import { MINECRAFT_PROPERTY_KEY_PATTERN, MINECRAFT_PROPERTY_VALUE_LIMIT, MINECRAFT_PROPERTIES_ENTRY_LIMIT } from "lfaa-util-values/src/minecraft-property-contract.mjs";
import { requireAuthentication, requireRole } from "lfaa-authorization/src/middleware.js";
import { assertSystemFileAccess } from "lfaa-fs/src/library.js";
import { getDaemonNode, getDaemonSystemResourceTelemetry, listDaemonNodes } from "lfaa-host-daemon/src/local-daemon.js";
import { backupMinecraftWorld, createMinecraftDeployment, deleteMinecraftTaskRecords, getMinecraftTaskRecordDetails, getMinecraftInstance, getMinecraftInstanceLogs, getMinecraftOverview, getMinecraftRelease, getMinecraftReleases, getMinecraftStorageSettingsOverview, listMinecraftDeployments, forgetMinecraftJavaPath, installMinecraftJava, listMinecraftInstances, listMinecraftJavaRuntimes, listMinecraftTaskRecords, startMinecraftInstance, stopMinecraftInstance, registerMinecraftDeployment, retryMinecraftDeployment, updateMinecraftInstanceJavaRuntime, updateMinecraftInstanceJvmConfiguration, saveMinecraftNodeStorageSettings, saveMinecraftStorageDefaults, registerMinecraftJavaPath, uninstallMinecraftJava, updateMinecraftServerProperties, validateMinecraftServerProperties, withoutMinecraftTaskPropertySecrets } from "lfaa-games-minecraft/src/service.js";
import type { AiPluginHost } from "lfaa-app-boot/src/ai-host.js";
import type { MinecraftRealtimePublisher } from "lfaa-api-remotes/src/socket-server.js";
import { listMinecraftCores, listMinecraftCoreBuilds, minecraftCoreNames } from "lfaa-games-minecraft/src/core-sources.js";
import { provisionMinecraftServer, type MinecraftProvisionInput } from "lfaa-games-minecraft/src/deployment-service.js";
import { asyncHandler, parseBody, withoutJavaExecutablePath, withoutJavaExecutablePaths, withoutJavaTaskPath, minecraftDeploymentSchema, minecraftDeploymentRegistrationSchema, minecraftInstanceJavaRuntimeSchema, minecraftInstanceJvmConfigurationSchema, minecraftJavaInstallSchema, minecraftJavaUninstallSchema, minecraftJavaPathSchema, minecraftJavaPathRemovalSchema, minecraftStorageSettingsSchema } from "lfaa-api-remotes/src/route-contracts.js";
import { ensureProjectStorageDirectory, isOutsideProjectDataDirectory } from "lfaa-settings/src/project-storage.js";
export function registerRoutes(router: Router, _aiPluginHost: AiPluginHost, realtime: MinecraftRealtimePublisher): void {
router.post("/minecraft/tasks/:taskId/cancel",requireAuthentication,requireRole("admin"),(request,response)=>{const task=requestMinecraftTaskCancellation(request.params.taskId,request.auth!.user.id);realtime.publishMinecraftChange(["tasks","state"],task.instanceId??undefined);response.json({task});});
router.post("/minecraft/runtime-requirement",requireAuthentication,requireRole("admin"),asyncHandler(async(request,response)=>{
  const body=parseBody<{core:string;version:string;build?:string;nodeId:string}>(Joi.object({core:Joi.string().max(32).required(),version:Joi.string().max(120).required(),build:Joi.string().max(120),nodeId:Joi.string().guid().required()}).unknown(false),request.body);
  const artifact=await resolveMinecraftCoreArtifact(body.core,body.version,body.build);
  response.json({javaMajor:artifact.javaMajor,source:artifact.source,launchKind:artifact.launchKind,...(artifact.launchKind!=="php"?await runtimeManager.resolve(body.nodeId,artifact.javaMajor):{runtimes:[],installed:true})});
}));

router.get("/minecraft/core-names", requireAuthentication, (_request, response) => {
  response.json({ cores: minecraftCoreNames });
});
router.get("/minecraft/cores", requireAuthentication, asyncHandler(async (_request, response) => {
  response.json(await listMinecraftCores());
}));
router.get("/minecraft/cores/:core/versions/:version/builds", requireAuthentication, asyncHandler(async (request, response) => {
  const offset = request.query.offset === undefined ? 0 : Number(request.query.offset);
  response.json(await listMinecraftCoreBuilds(request.params.core, request.params.version, offset));
}));
router.post("/minecraft/provision", requireAuthentication, requireRole("admin"), asyncHandler(async (request, response) => {
  const body = parseBody<Omit<MinecraftProvisionInput, "userId">>(Joi.object({
    nodeId: Joi.string().guid().required(), name: Joi.string().trim().min(1).max(48).required(),
    core: Joi.string().max(32).required(), version: Joi.string().max(120).required(), build: Joi.string().max(120),
    eulaAccepted: Joi.boolean().valid(true).required(), memoryMb: Joi.number().integer().min(1024).max(32768),
    serverPort: Joi.number().integer().min(1024).max(65535), javaRuntimeId: Joi.string().max(80).allow(null),
    proxyBackendInstanceId: Joi.string().guid()
  }).unknown(false), request.body);
  const created = await provisionMinecraftServer({ ...body, userId: request.auth!.user.id });
  realtime.publishMinecraftChange(["state", "tasks"], created.instance.id);
  response.status(202).json(created);
}));
router.get("/daemon-nodes/credentials", requireAuthentication, requireRole("admin"), (_request, response) => response.json({ nodes: listDaemonCredentials() }));
router.post("/daemon-nodes/credentials", requireAuthentication, requireRole("admin"), (request, response) => {
    const body = parseBody<{ displayName: string; nodeId?: string; controlPlaneUrl: string }>(Joi.object({ displayName: Joi.string().trim().min(1).max(80).required(), nodeId: Joi.string().guid(), controlPlaneUrl: Joi.string().uri({ scheme: ["https"] }).max(2048).required() }).unknown(false), request.body);
    response.setHeader("Cache-Control", "no-store");
    try { const issued = issueDaemonCredential(body.displayName, body.nodeId, body.controlPlaneUrl); response.status(201).json({ nodeId: issued.nodeId, displayName: issued.displayName }); }
    catch (error) { throw new ApiError(400, "invalid_daemon_identity", error instanceof Error ? error.message : "节点身份无效。"); }
  });
router.delete("/daemon-nodes/credentials/:nodeId", requireAuthentication, requireRole("admin"), (request, response) => {
    if (!revokeDaemonCredential(request.params.nodeId)) throw new ApiError(404, "daemon_identity_not_found", "找不到远程节点身份。");
    realtime.publishMinecraftChange(["state"]); response.status(204).end();
  });
router.post("/minecraft/instances/:instanceId/restart", requireAuthentication, requireRole("admin"), (request, response) => {
    const task = restartMinecraftInstance(request.params.instanceId, request.auth!.user.id);
    realtime.publishMinecraftChange(["state", "tasks"], request.params.instanceId);
    response.status(202).json({ task });
  });
router.post("/minecraft/instances/:instanceId/console", requireAuthentication, requireRole("admin"), (request, response) => {
    const body = parseBody<{ command: string }>(Joi.object({ command: Joi.string().min(1).max(1024).required() }).unknown(false), request.body);
    const task = sendMinecraftConsoleCommand(request.params.instanceId, request.auth!.user.id, body.command);
    realtime.publishMinecraftChange(["tasks"], request.params.instanceId);
    response.status(202).json({ task });
  });

router.get("/minecraft/overview", requireAuthentication, asyncHandler(async (_request, response) => {
    const overview = await getMinecraftOverview(() => realtime.publishMinecraftChange(["state"]));
    const visibleOverview = _request.auth!.user.role !== "member" || !overview.node
      ? overview
      : { ...overview, node: withoutJavaExecutablePaths(overview.node) };
    response.json({ overview: visibleOverview });
  }));

router.get("/minecraft/nodes", requireAuthentication, (request, response) => {
    const nodes = listDaemonNodes(() => realtime.publishMinecraftChange(["state"]));
    response.json({ nodes: request.auth!.user.role !== "member" ? nodes : nodes.map(withoutJavaExecutablePaths) });
  });

router.get("/minecraft/nodes/:nodeId/resources", requireAuthentication, (request, response) => {
    const nodeId = request.params.nodeId;
    if (Joi.string().guid().validate(nodeId).error) throw new ApiError(400, "invalid_daemon_node_id", "节点标识无效。");
    const node = getDaemonNode(nodeId);
    if (!node) throw new ApiError(404, "daemon_node_not_found", "找不到目标 daemon 节点。");
    response.setHeader("Cache-Control", "no-store");
    response.json({ nodeId: node.id, nodeName: node.displayName, telemetry: getDaemonSystemResourceTelemetry(node) });
  });

router.get("/minecraft/storage-settings", requireAuthentication, requireRole("admin"), (_request, response) => {
    response.json(getMinecraftStorageSettingsOverview());
  });

router.put("/minecraft/storage-settings/defaults", requireAuthentication, requireRole("admin"), (request, response) => {
    const body = parseBody<{ instanceDirectory: string }>(minecraftStorageSettingsSchema, request.body);
    try {
      if (isOutsideProjectDataDirectory(body.instanceDirectory)) assertSystemFileAccess(request.auth!.user.id);
      ensureProjectStorageDirectory(body.instanceDirectory);
      response.json({ settings: saveMinecraftStorageDefaults(body) });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(400, "invalid_minecraft_storage_settings", error instanceof Error ? error.message : "Minecraft 实例存储设置无效。");
    }
  });

router.put("/minecraft/storage-settings/:nodeId", requireAuthentication, requireRole("admin"), (request, response) => {
    const body = parseBody<{ instanceDirectory: string }>(minecraftStorageSettingsSchema, request.body);
    if (!getDaemonNode(request.params.nodeId)) throw new ApiError(404, "daemon_node_not_found", "找不到目标 daemon 节点。");
    try {
      if (/^[a-z]:[\\/]/iu.test(body.instanceDirectory)) assertSystemFileAccess(request.auth!.user.id);
      response.json({ settings: saveMinecraftNodeStorageSettings(request.params.nodeId, body) });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(400, "invalid_minecraft_storage_settings", error instanceof Error ? error.message : "Minecraft 实例存储设置无效。");
    }
  });

router.get("/minecraft/releases", requireAuthentication, asyncHandler(async (_request, response) => {
    response.json({ catalog: await getMinecraftReleases() });
  }));

router.get("/minecraft/releases/:releaseId", requireAuthentication, asyncHandler(async (request, response) => {
    response.json({ release: await getMinecraftRelease(request.params.releaseId) });
  }));

router.get("/minecraft/java", requireAuthentication, (request, response) => {
    const nodes = listMinecraftJavaRuntimes(() => realtime.publishMinecraftChange(["state"]));
    response.json({
      nodes: request.auth!.user.role !== "member"
        ? nodes
        : nodes.map((node) => ({ ...node, runtimes: node.runtimes.map(withoutJavaExecutablePath) }))
    });
  });

router.post("/minecraft/java/install", requireAuthentication, requireRole("admin"), (request, response) => {
    const body = parseBody<{ nodeId: string; major: number }>(minecraftJavaInstallSchema, request.body);
    const task = installMinecraftJava(body.nodeId, request.auth!.user.id, body.major);
    realtime.publishMinecraftChange(["tasks"]);
    response.status(202).json({ task });
  });

router.post("/minecraft/java/uninstall", requireAuthentication, requireRole("admin"), (request, response) => {
    const body = parseBody<{ nodeId: string; major: number }>(minecraftJavaUninstallSchema, request.body);
    const task = uninstallMinecraftJava(body.nodeId, request.auth!.user.id, body.major);
    realtime.publishMinecraftChange(["tasks"]);
    response.status(202).json({ task });
  });

router.post("/minecraft/java/paths", requireAuthentication, requireRole("admin"), (request, response) => {
    const body = parseBody<{ nodeId: string; executablePath: string; runtimeId?: string }>(minecraftJavaPathSchema, request.body);
    const task = registerMinecraftJavaPath(body.nodeId, request.auth!.user.id, body.executablePath, body.runtimeId);
    realtime.publishMinecraftChange(["tasks"]);
    response.status(202).json({ task });
  });

router.delete("/minecraft/java/paths/:runtimeId", requireAuthentication, requireRole("admin"), (request, response) => {
    const body = parseBody<{ nodeId: string; runtimeId: string }>(minecraftJavaPathRemovalSchema, { ...request.body, runtimeId: request.params.runtimeId });
    const task = forgetMinecraftJavaPath(body.nodeId, request.auth!.user.id, body.runtimeId);
    realtime.publishMinecraftChange(["tasks"]);
    response.status(202).json({ task });
  });

router.get("/minecraft/instances", requireAuthentication, (_request, response) => {
    response.json({ instances: listMinecraftInstances() });
  });

router.get("/minecraft/deployments", requireAuthentication, (_request, response) => {
    response.json({ deployments: listMinecraftDeployments() });
  });

router.post("/minecraft/deployments", requireAuthentication, requireRole("admin"), asyncHandler(async (request, response) => {
    const body = parseBody<{ nodeId: string; name: string; serverType: "vanilla"; releaseId: string }>(minecraftDeploymentSchema, request.body);
    const created = await createMinecraftDeployment({ ...body, userId: request.auth!.user.id });
    realtime.publishMinecraftChange(["tasks"]);
    response.status(202).json(created);
  }));

router.post("/minecraft/deployments/:deploymentId/retry", requireAuthentication, requireRole("admin"), asyncHandler(async (request, response) => {
    const task = await retryMinecraftDeployment(request.params.deploymentId, request.auth!.user.id);
    realtime.publishMinecraftChange(["tasks"]);
    response.status(202).json({ task });
  }));

router.post("/minecraft/deployments/:deploymentId/instance", requireAuthentication, requireRole("admin"), asyncHandler(async (request, response) => {
    const body = parseBody<{ memoryMb: number; eulaAccepted: true; javaRuntimeId?: string | null }>(minecraftDeploymentRegistrationSchema, request.body);
    const created = await registerMinecraftDeployment({ ...body, deploymentId: request.params.deploymentId, userId: request.auth!.user.id });
    realtime.publishMinecraftChange(["state", "tasks"], created.instance.id);
    response.status(202).json(created);
  }));

router.get("/minecraft/instances/:instanceId/directory", requireAuthentication, requireRole("admin"), (request, response) => {
    const instanceId = Joi.string().guid().validate(request.params.instanceId);
    if (instanceId.error) throw new ApiError(400, "invalid_minecraft_instance_id", "Minecraft 实例 ID 无效。");
    const resolved = getMinecraftInstanceShellDirectory(instanceId.value);
    response.json({ instanceId: resolved.instance.id, directory: resolved.directory });
  });

router.get("/minecraft/instances/:instanceId/telemetry", requireAuthentication, (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.json({ telemetry: getMinecraftServerTelemetry(request.params.instanceId) });
  });

router.get("/minecraft/instances/:instanceId", requireAuthentication, (request, response) => {
    const instance = getMinecraftInstance(request.params.instanceId);
    if (!instance) throw new ApiError(404, "minecraft_instance_not_found", "找不到这个 Minecraft 实例。");
    response.json({ instance });
  });

router.patch("/minecraft/instances/:instanceId/java-runtime", requireAuthentication, requireRole("admin"), (request, response) => {
    const body = parseBody<{ javaRuntimeId: string | null }>(minecraftInstanceJavaRuntimeSchema, request.body);
    const instance = updateMinecraftInstanceJavaRuntime(request.params.instanceId, body.javaRuntimeId);
    realtime.publishMinecraftChange(["state"], instance.id);
    response.json({ instance });
  });

router.patch("/minecraft/instances/:instanceId/jvm-configuration", requireAuthentication, requireRole("admin"), (request, response) => {
    const body = parseBody<{ memoryMb: number; initialHeapMb: number; jvmArguments: string }>(minecraftInstanceJvmConfigurationSchema, request.body);
    const instance = updateMinecraftInstanceJvmConfiguration(request.params.instanceId, body);
    realtime.publishMinecraftChange(["state"], instance.id);
    response.json({ instance });
  });

router.get("/minecraft/instances/:instanceId/logs", requireAuthentication, (request, response) => {
    response.json({ logs: getMinecraftInstanceLogs(request.params.instanceId) });
  });

router.delete("/minecraft/instances/:instanceId",requireAuthentication,requireRole("admin"),(request,response)=>{
    const task=deleteMinecraftInstance(request.params.instanceId,request.auth!.user.id);
    realtime.publishMinecraftChange(["state","tasks"],request.params.instanceId);
    response.status(202).json({task});
  });

router.post("/minecraft/instances/:instanceId/start", requireAuthentication, requireRole("admin"), (request, response) => {
    const task = startMinecraftInstance(request.params.instanceId, request.auth!.user.id);
    realtime.publishMinecraftChange(["state", "tasks"], request.params.instanceId);
    response.status(202).json({ task });
  });

router.post("/minecraft/instances/:instanceId/stop", requireAuthentication, requireRole("admin"), (request, response) => {
    const task = stopMinecraftInstance(request.params.instanceId, request.auth!.user.id);
    realtime.publishMinecraftChange(["state", "tasks"], request.params.instanceId);
    response.status(202).json({ task });
  });

router.post("/minecraft/instances/:instanceId/backup", requireAuthentication, requireRole("admin"), (request, response) => {
    const task = backupMinecraftWorld(request.params.instanceId, request.auth!.user.id);
    realtime.publishMinecraftChange(["tasks"], request.params.instanceId);
    response.status(202).json({ task });
  });

router.patch("/minecraft/instances/:instanceId/properties", requireAuthentication, requireRole("admin"), (request, response) => {
    const filePropertyValueSchema = Joi.alternatives().try(Joi.string().max(MINECRAFT_PROPERTY_VALUE_LIMIT).pattern(/^[^\u0000-\u001f\u007f]*$/u), Joi.valid(null));
    const body = parseBody<{ properties?: unknown; fileProperties?: Record<string, string | null> }>(Joi.object({
      properties: Joi.object().min(1),
      fileProperties: Joi.object().pattern(Joi.string().pattern(MINECRAFT_PROPERTY_KEY_PATTERN), filePropertyValueSchema).min(1).max(MINECRAFT_PROPERTIES_ENTRY_LIMIT)
    }).xor("properties", "fileProperties").unknown(false), request.body);
    const input = body.fileProperties ? { fileProperties: body.fileProperties } : validateMinecraftServerProperties(body.properties);
    const task = withoutMinecraftTaskPropertySecrets(updateMinecraftServerProperties(request.params.instanceId, request.auth!.user.id, input));
    realtime.publishMinecraftChange(["tasks"], request.params.instanceId);
    response.status(202).json({ task });
  });
router.post("/minecraft/instances/:instanceId/properties/read", requireAuthentication, requireRole("admin"), (request, response) => {
    const task = readMinecraftServerProperties(request.params.instanceId, request.auth!.user.id);
    realtime.publishMinecraftChange(["tasks"], request.params.instanceId);
    response.status(202).json({ task });
  });

router.get("/minecraft/tasks", requireAuthentication, (request, response) => {
    const tasks = listMinecraftTaskRecords();
    response.json({ tasks: tasks.map(withoutMinecraftTaskPropertySecrets).map(task => request.auth!.user.role !== "member" ? task : withoutJavaTaskPath(task)) });
  });
router.get("/minecraft/tasks/:taskId", requireAuthentication, (request, response) => {
    const details = getMinecraftTaskRecordDetails(request.params.taskId);
    const task = withoutMinecraftTaskPropertySecrets(details.task);
    response.json({ ...details, task: request.auth!.user.role !== "member" ? task : withoutJavaTaskPath(task) });
  });
router.delete("/minecraft/tasks", requireAuthentication, requireRole("admin"), (request, response) => {
    const body = parseBody<{ taskIds: string[] }>(Joi.object({
      taskIds: Joi.array().items(Joi.string().guid().required()).min(1).max(200).unique().required()
    }).unknown(false), request.body);
    const deletedCount = deleteMinecraftTaskRecords(body.taskIds);
    realtime.publishMinecraftChange(["tasks"]);
    response.json({ deletedCount });
  });
}

/** 将本控制器的路由层与当前插件生命周期绑定。 */
import type { Context } from "@deepseek-ai/cordis";
import "lfaa-api-gateway/src/index.js";
export const inject = ["apiGateway"];
export function apply(ctx: Context): void { ctx.apiGateway.register(ctx, "minecraft-controller", registerRoutes); }
