/** 功能：登记 job-controller 的现有接口。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。 */
import { Router } from "express";
import Joi from "joi";
import { ApiError } from "lfaa-util-values/src/http-error.js";
import { getDaemonNode, listDaemonNodes, recordDaemonHeartbeat } from "lfaa-host-daemon/src/local-daemon.js";
import { claimNextNodeFileTask, completeNodeFileTask, getNodeFileTask, renewNodeFileTaskLeases } from "lfaa-fs/src/queue.js";
import { claimNextAiHostTask, completeAiHostTask, getAiHostTask, renewAiHostTaskLeases } from "lfaa-jobs/src/ai-host-tasks.js";
import { claimNextMinecraftTask, appendMinecraftTaskLogs, completeMinecraftTask, getMinecraftTask, renewMinecraftTaskLeases, updateMinecraftTaskProgress } from "lfaa-jobs/src/minecraft-queue.js";
import { claimNextSteamcmdTask, completeSteamcmdTask, getSteamcmdNodeSettings, renewSteamcmdTaskLeases, updateSteamcmdTaskProgress } from "lfaa-games-steamcmd/src/service.js";
import { getMinecraftInstance, getMinecraftNodeStorageDirectories, updateInstanceStatesFromDaemon } from "lfaa-games-minecraft/src/service.js";
import type { AiPluginHost } from "lfaa-app-boot/src/ai-host.js";
import type { MinecraftRealtimePublisher } from "lfaa-api-remotes/src/socket-server.js";
import { parseBody, requireLocalDaemon, daemonHeartbeatSchema, minecraftProgressSchema, minecraftLogBatchSchema, minecraftCompletionSchema, steamcmdProgressSchema, steamcmdCompletionSchema, fileTaskCompletionSchema, aiHostTaskCompletionSchema } from "lfaa-api-remotes/src/route-contracts.js";
export function registerRoutes(router: Router, _aiPluginHost: AiPluginHost, realtime: MinecraftRealtimePublisher): void {

router.post("/daemon/heartbeat", requireLocalDaemon, (request, response) => {
    const body = parseBody<Parameters<typeof recordDaemonHeartbeat>[0] & {
      activeTaskIds: string[];
      instances: Array<{ id: string; state: "stopped" | "running" | "installing" | "unknown"; sandboxStatus: "unsupported" | "unprepared" | "prepared" | "running" | "unknown" }>;
    }>(daemonHeartbeatSchema, request.body);
    const { activeTaskIds, instances, ...heartbeat } = body;
    const nodeChanged = recordDaemonHeartbeat(heartbeat);
    renewMinecraftTaskLeases(body.id, activeTaskIds);
    renewNodeFileTaskLeases(body.id, activeTaskIds);
    renewSteamcmdTaskLeases(body.id, activeTaskIds);
    renewAiHostTaskLeases(body.id, activeTaskIds);
    const changedInstanceIds = updateInstanceStatesFromDaemon(body.id, instances);
    if (nodeChanged || changedInstanceIds.length) {
      realtime.publishMinecraftChange(["state"]);
    }
    response.json({
      receivedAt: new Date().toISOString(),
      steamcmdSettings: getSteamcmdNodeSettings(body.id),
      minecraftStorageSettings: getMinecraftNodeStorageDirectories(body.id)
    });
  });

router.post("/daemon/tasks/claim", requireLocalDaemon, (request, response) => {
    const body = parseBody<{ nodeId: string }>(Joi.object({ nodeId: Joi.string().guid().required() }).unknown(false), request.body);
    const node = getDaemonNode(body.nodeId);
    if (!node || node.status !== "online" || node.platform !== "win32" || node.architecture !== "x64") {
      throw new ApiError(409, "daemon_node_not_ready", "本机 Daemon 尚未登记或平台不受支持。");
    }
    const task = claimNextMinecraftTask(body.nodeId, node.capabilities.includes("app-sandbox-windows-appcontainer-v1"));
    if (task) realtime.publishMinecraftChange(["tasks"], task.instanceId ?? undefined);
    response.json({ task });
  });

router.post("/daemon/files/tasks/claim", requireLocalDaemon, (request, response) => {
    const body = parseBody<{ nodeId: string }>(Joi.object({ nodeId: Joi.string().guid().required() }).unknown(false), request.body);
    listDaemonNodes(() => realtime.publishMinecraftChange(["state"]));
    const node = getDaemonNode(body.nodeId);
    if (!node || node.status !== "online" || !node.capabilities.includes("node-filesystem-v1")) {
      throw new ApiError(409, "daemon_file_manager_unavailable", "Daemon 节点尚未登记文件管理能力。");
    }
    response.json({ task: claimNextNodeFileTask(body.nodeId) });
  });

router.post("/daemon/files/tasks/:taskId/complete", requireLocalDaemon, (request, response) => {
    const body = parseBody<{ nodeId: string; succeeded: boolean; message: string; result: Record<string, unknown> }>(fileTaskCompletionSchema, request.body);
    const task = getNodeFileTask(request.params.taskId);
    if (!task || task.nodeId !== body.nodeId) throw new ApiError(404, "daemon_file_task_not_found", "找不到此节点上的文件任务。");
    if (!completeNodeFileTask({ taskId: task.id, nodeId: body.nodeId, succeeded: body.succeeded, message: body.message, result: body.result })) {
      throw new ApiError(409, "daemon_file_task_not_running", "文件任务已结束或不处于执行状态。");
    }
    response.status(204).end();
  });

router.post("/daemon/ai/host-tasks/claim", requireLocalDaemon, (request, response) => {
    const body = parseBody<{ nodeId: string }>(Joi.object({ nodeId: Joi.string().guid().required() }).unknown(false), request.body);
    listDaemonNodes(() => realtime.publishMinecraftChange(["state"]));
    const node = getDaemonNode(body.nodeId);
    if (!node || node.status !== "online" || !node.capabilities.some((capability) => capability === "agent-shell-v1" || capability === "project-files-v1")) {
      throw new ApiError(409, "daemon_host_task_unavailable", "Daemon 节点尚未登记可执行的 Agent 主机或项目文件能力。");
    }
    response.json({ task: claimNextAiHostTask(body.nodeId) });
  });

router.post("/daemon/ai/host-tasks/:taskId/complete", requireLocalDaemon, (request, response) => {
    const body = parseBody<{ nodeId: string; succeeded: boolean; message: string; result: { stdout: string; stderr: string; exitCode: number | null; timedOut: boolean; outputTruncated: boolean } }>(aiHostTaskCompletionSchema, request.body);
    const task = getAiHostTask(request.params.taskId);
    if (!task || task.nodeId !== body.nodeId) throw new ApiError(404, "daemon_host_task_not_found", "找不到此节点上的主机命令任务。");
    if (!completeAiHostTask({ taskId: task.id, nodeId: body.nodeId, succeeded: body.succeeded, message: body.message, result: body.result })) {
      throw new ApiError(409, "daemon_host_task_not_running", "主机命令任务已结束或不处于执行状态。");
    }
    response.status(204).end();
  });

router.post("/daemon/steamcmd/tasks/claim", requireLocalDaemon, (request, response) => {
    const body = parseBody<{ nodeId: string }>(Joi.object({ nodeId: Joi.string().guid().required() }).unknown(false), request.body);
    const node = getDaemonNode(body.nodeId);
    if (!node || node.status !== "online" || !node.capabilities.includes("node-filesystem-v1")) {
      throw new ApiError(409, "daemon_steamcmd_unavailable", "Daemon 节点未连接或尚未报告 Windows 文件管理能力。");
    }
    response.json({ task: claimNextSteamcmdTask(body.nodeId) });
  });

router.post("/daemon/steamcmd/tasks/:taskId/progress", requireLocalDaemon, (request, response) => {
    const body = parseBody<{ nodeId: string; progress: number; message: string }>(steamcmdProgressSchema, request.body);
    if (!updateSteamcmdTaskProgress(request.params.taskId, body.nodeId, body.progress, body.message)) {
      throw new ApiError(409, "daemon_steamcmd_task_not_running", "SteamCMD 任务已结束或不处于执行状态。");
    }
    response.status(204).end();
  });

router.post("/daemon/steamcmd/tasks/:taskId/complete", requireLocalDaemon, (request, response) => {
    const body = parseBody<{ nodeId: string; succeeded: boolean; message: string; result: Record<string, unknown> }>(steamcmdCompletionSchema, request.body);
    if (!completeSteamcmdTask({ taskId: request.params.taskId, ...body })) {
      throw new ApiError(409, "daemon_steamcmd_task_not_running", "SteamCMD 任务已结束或不处于执行状态。");
    }
    response.status(204).end();
  });

router.post("/daemon/tasks/:taskId/progress", requireLocalDaemon, (request, response) => {
    const body = parseBody<{ nodeId: string; progress: number; message: string }>(minecraftProgressSchema, request.body);
    const task = getMinecraftTask(request.params.taskId);
    if (!task || task.nodeId !== body.nodeId) throw new ApiError(404, "daemon_task_not_found", "找不到此节点上的 Minecraft 任务。");
    if (!updateMinecraftTaskProgress(request.params.taskId, body.progress, body.message)) {
      throw new ApiError(409, "daemon_task_not_running", "任务已结束或不处于执行状态。");
    }
    realtime.publishMinecraftChange(["tasks"], task.instanceId ?? undefined);
    response.status(204).end();
  });

router.post("/daemon/tasks/:taskId/logs", requireLocalDaemon, (request, response) => {
    const body = parseBody<{ nodeId: string; instanceId: string; taskId: string | null; stream: "stdout" | "stderr" | "system"; lines: string[] }>(minecraftLogBatchSchema, request.body);
    const instance = getMinecraftInstance(body.instanceId);
    if (!instance || instance.nodeId !== body.nodeId) throw new ApiError(404, "minecraft_instance_not_found", "找不到此节点上的 Minecraft 实例。");
    if (request.params.taskId !== String(body.taskId)) throw new ApiError(400, "daemon_log_task_mismatch", "Minecraft 日志任务编号不一致。");
    if (body.taskId) {
      const task = getMinecraftTask(body.taskId);
      if (!task || task.nodeId !== body.nodeId || task.instanceId !== body.instanceId) throw new ApiError(404, "daemon_task_not_found", "找不到此节点上的 Minecraft 任务。");
    }
    appendMinecraftTaskLogs(body.instanceId, body.taskId, body.stream, body.lines);
    realtime.publishMinecraftChange(["logs"], body.instanceId);
    response.status(204).end();
  });

router.post("/daemon/tasks/:taskId/complete", requireLocalDaemon, (request, response) => {
    const body = parseBody<{ nodeId: string; succeeded: boolean; message: string; result: Record<string, unknown> }>(minecraftCompletionSchema, request.body);
    if (!listDaemonNodes(() => realtime.publishMinecraftChange(["state"])).some((node) => node.id === body.nodeId && node.status === "online")) {
      throw new ApiError(409, "daemon_node_not_ready", "本机 Daemon 尚未登记。");
    }
    const task = getMinecraftTask(request.params.taskId);
    if (!task || task.nodeId !== body.nodeId) throw new ApiError(404, "daemon_task_not_found", "找不到此节点上的 Minecraft 任务。");
    if (!completeMinecraftTask(request.params.taskId, body.nodeId, body.succeeded, body.message, body.result)) {
      throw new ApiError(409, "daemon_task_not_running", "任务已结束或不处于执行状态。");
    }
    realtime.publishMinecraftChange(["tasks", "state"], task.instanceId ?? undefined);
    response.status(204).end();
  });
}

/** 将本控制器的路由层与当前插件生命周期绑定。 */
import type { Context } from "@deepseek-ai/cordis";
import "lfaa-api-gateway/src/index.js";
export const inject = ["apiGateway"];
export function apply(ctx: Context): void { ctx.apiGateway.register(ctx, "job-controller", registerRoutes); }
