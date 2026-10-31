/** 功能：登记 job-controller 的现有接口。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。 */
import { Router } from "express";
import {registerRuntimeRoutes} from "./runtime-routes.js";
import {runtimeStorageFor} from "lfaa-runtime-manager/src/service.js";
import {listMinecraftCancellationRequests} from "lfaa-jobs/src/minecraft-queue.js";
import Joi from "joi";
import { ApiError } from "lfaa-util-values/src/http-error.js";
import { getDaemonNode, listDaemonNodes, recordDaemonHeartbeat } from "lfaa-host-daemon/src/local-daemon.js";
import { claimNextNodeFileTask, completeNodeFileTask, getNodeFileTask, renewNodeFileTaskLeases } from "lfaa-fs/src/queue.js";
import { discardNodeFileUploadTransfer, FileTransferLimitError, FileTransferNotFoundError, getNodeFileResultTransfer, getNodeFileUploadTransfer, receiveNodeFileTransfer } from "lfaa-fs/src/file-transfers.mjs";
import { claimNextAiHostTask, completeAiHostTask, getAiHostTask, renewAiHostTaskLeases, listAiHostCancellationRequests, updateAiHostTaskOutput, type AiHostTaskResult } from "lfaa-jobs/src/ai-host-tasks.js";
import { claimNextMinecraftTask, appendMinecraftTaskLogs, completeMinecraftTask, getMinecraftTask, renewMinecraftTaskLeases, updateMinecraftTaskProgress } from "lfaa-jobs/src/minecraft-queue.js";
import { claimNextSteamcmdTask, completeSteamcmdTask, getSteamcmdNodeSettings, renewSteamcmdTaskLeases, steamcmdServerIdsForNode, updateSteamcmdServerStatesFromDaemon, updateSteamcmdTaskProgress } from "lfaa-games-steamcmd/src/service.js";
import { getMinecraftInstance, getMinecraftNodeStorageDirectories, revealMinecraftTaskPropertySecrets, updateInstanceStatesFromDaemon, type MinecraftServerTelemetryReport } from "lfaa-games-minecraft/src/service.js";
import type { AiPluginHost } from "lfaa-app-boot/src/ai-host.js";
import type { MinecraftRealtimePublisher } from "lfaa-api-remotes/src/socket-server.js";
import { asyncHandler, parseBody, requireLocalDaemon, daemonHeartbeatSchema, minecraftProgressSchema, minecraftLogBatchSchema, minecraftCompletionSchema, steamcmdProgressSchema, steamcmdCompletionSchema, fileTaskCompletionSchema, aiHostTaskCompletionSchema } from "lfaa-api-remotes/src/route-contracts.js";
export function registerRoutes(router: Router, _aiPluginHost: AiPluginHost, realtime: MinecraftRealtimePublisher): void {
registerRuntimeRoutes(router);

router.post("/daemon/heartbeat", requireLocalDaemon, (request, response) => {
    const body = parseBody<Parameters<typeof recordDaemonHeartbeat>[0] & {
      activeTaskIds: string[];
      instances: Array<{ id: string; state: "stopped" | "running" | "starting" | "installing" | "unknown"; sandboxStatus: "unsupported" | "unprepared" | "prepared" | "running" | "unknown"; telemetry?: MinecraftServerTelemetryReport }>;
      steamcmdServers: Array<{ id: string; status: "unknown" | "stopped" | "running" | "starting" | "stopping"; processId: number | null }>;
    }>(daemonHeartbeatSchema, request.body);
    const { activeTaskIds, instances, steamcmdServers, ...heartbeat } = body;
    const nodeChanged = recordDaemonHeartbeat(heartbeat);
    renewMinecraftTaskLeases(body.id, activeTaskIds);
    renewNodeFileTaskLeases(body.id, activeTaskIds);
    renewSteamcmdTaskLeases(body.id, activeTaskIds);
    const changedSteamcmdServers = updateSteamcmdServerStatesFromDaemon(body.id, steamcmdServers);
    renewAiHostTaskLeases(body.id, activeTaskIds);
    const changedInstanceIds = updateInstanceStatesFromDaemon(body.id, instances);
    if (nodeChanged || changedInstanceIds.length || changedSteamcmdServers) {
      realtime.publishMinecraftChange(["state"]);
    }
    response.json({
      receivedAt: new Date().toISOString(),
      cancelTaskIds: listAiHostCancellationRequests(body.id),
      cancelMinecraftTaskIds: listMinecraftCancellationRequests(body.id),
      steamcmdSettings: getSteamcmdNodeSettings(body.id),
      steamcmdServers: steamcmdServerIdsForNode(body.id).map(id => ({ id })),
      minecraftStorageSettings: getMinecraftNodeStorageDirectories(body.id),
      runtimeStorageSettings: runtimeStorageFor(body.id)
    });
  });

router.post("/daemon/tasks/claim", requireLocalDaemon, (request, response) => {
    const body = parseBody<{ nodeId: string }>(Joi.object({ nodeId: Joi.string().guid().required() }).unknown(false), request.body);
    const node = getDaemonNode(body.nodeId);
    if (!node || node.status !== "online" || node.platform !== "win32" || node.architecture !== "x64") {
      throw new ApiError(409, "daemon_node_not_ready", "本机 Daemon 尚未登记或平台不受支持。");
    }
    const claimed = claimNextMinecraftTask(body.nodeId, node.capabilities.includes("app-sandbox-windows-appcontainer-v1"));
    let task = claimed;
    if (claimed) {
      try {
        task = revealMinecraftTaskPropertySecrets(claimed);
      } catch (error) {
        completeMinecraftTask(claimed.id, body.nodeId, false, error instanceof Error ? error.message : "无法安全解封服务器配置。");
        throw new ApiError(500, "minecraft_property_secret_unavailable", "服务器配置任务无法安全解封；任务已失败，请重新读取并提交配置。");
      }
      realtime.publishMinecraftChange(["tasks"], task.instanceId ?? undefined);
    }
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

router.get("/daemon/files/tasks/:taskId/input", requireLocalDaemon, asyncHandler(async (request, response) => {
    const { nodeId } = parseBody<{ nodeId: string }>(Joi.object({ nodeId: Joi.string().guid().required() }).unknown(false), request.query);
    const task = getNodeFileTask(request.params.taskId);
    if (!task || task.nodeId !== nodeId || task.status !== "running" || task.operation !== "upload") throw new ApiError(404, "daemon_file_transfer_not_found", "找不到此节点上待接收的文件任务。 ");
    let transfer: ReturnType<typeof getNodeFileUploadTransfer>;
    try { transfer = getNodeFileUploadTransfer({ transferId: String(task.payload.transferId ?? ""), task }); }
    catch (error) { if (error instanceof FileTransferNotFoundError) throw new ApiError(404, "daemon_file_transfer_not_found", error.message); throw error; }
    response.setHeader("Content-Type", "application/octet-stream");
    response.setHeader("Content-Length", transfer.size);
    response.setHeader("Cache-Control", "no-store");
    response.end(transfer.bytes);
  }));

router.put("/daemon/files/tasks/:taskId/transfer", requireLocalDaemon, asyncHandler(async (request, response) => {
    if (!request.is("application/octet-stream")) throw new ApiError(415, "daemon_file_transfer_content_type", "节点文件传输必须使用原始字节流。 ");
    const { nodeId, name } = parseBody<{ nodeId: string; name: string }>(Joi.object({ nodeId: Joi.string().guid().required(), name: Joi.string().trim().min(1).max(255).required() }).unknown(false), request.query);
    const task = getNodeFileTask(request.params.taskId);
    if (!task || task.nodeId !== nodeId || task.status !== "running" || !["download", "preview"].includes(task.operation)) throw new ApiError(404, "daemon_file_transfer_not_found", "找不到此节点上待保存的文件任务。 ");
    try {
      const transfer = await receiveNodeFileTransfer({ task, nodeId, name, source: request, contentLength: request.header("content-length") });
      response.json({ transferId: transfer.id, name: transfer.name, size: transfer.size, sha256: transfer.sha256 });
    } catch (error) {
      if (error instanceof FileTransferLimitError) throw new ApiError(error.code === "file_transfer_too_large" ? 413 : 429, error.code, error.message);
      if (error instanceof FileTransferNotFoundError) throw new ApiError(404, "daemon_file_transfer_not_found", error.message);
      throw error;
    }
  }));

router.post("/daemon/files/tasks/:taskId/complete", requireLocalDaemon, (request, response) => {
    const body = parseBody<{ nodeId: string; succeeded: boolean; message: string; result: Record<string, unknown> }>(fileTaskCompletionSchema, request.body);
    const task = getNodeFileTask(request.params.taskId);
    if (!task || task.nodeId !== body.nodeId) throw new ApiError(404, "daemon_file_task_not_found", "找不到此节点上的文件任务。");
    const transfersBytes = task.operation === "download" || task.operation === "preview" && ["image", "pdf"].includes(String(body.result.previewKind));
    if (body.succeeded && transfersBytes) {
      if (body.result.transferId !== task.id) throw new ApiError(400, "daemon_file_transfer_result_required", "文件任务必须引用其已接收的原始字节传输。 ");
      try {
        const transfer = getNodeFileResultTransfer({ task });
        if (body.result.name !== transfer.name || body.result.size !== transfer.size || body.result.sha256 !== transfer.sha256) {
          throw new ApiError(400, "daemon_file_transfer_result_mismatch", "文件任务结果元数据与已接收的原始字节不匹配。 ");
        }
      } catch (error) {
        if (error instanceof ApiError) throw error;
        if (error instanceof FileTransferNotFoundError) throw new ApiError(409, "daemon_file_transfer_result_missing", error.message);
        throw error;
      }
    }
    if (body.result.transferId !== undefined && body.result.transferId !== task.id) throw new ApiError(400, "daemon_file_transfer_result_invalid", "文件传输与当前任务不匹配。 ");
    if (!completeNodeFileTask({ taskId: task.id, nodeId: body.nodeId, succeeded: body.succeeded, message: body.message, result: body.result })) {
      throw new ApiError(409, "daemon_file_task_not_running", "文件任务已结束或不处于执行状态。");
    }
    discardNodeFileUploadTransfer(task);
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
    const body = parseBody<{ nodeId: string; succeeded: boolean; message: string; result: AiHostTaskResult }>(aiHostTaskCompletionSchema, request.body);
    const task = getAiHostTask(request.params.taskId);
    if (!task || task.nodeId !== body.nodeId) throw new ApiError(404, "daemon_host_task_not_found", "找不到此节点上的主机命令任务。");
    if (!completeAiHostTask({ taskId: task.id, nodeId: body.nodeId, succeeded: body.succeeded, message: body.message, result: body.result })) {
      throw new ApiError(409, "daemon_host_task_not_running", "主机命令任务已结束或不处于执行状态。");
    }
    response.status(204).end();
  });

router.post("/daemon/ai/host-tasks/:taskId/output", requireLocalDaemon, (request, response) => {
    const body = parseBody<{ nodeId: string; sequence: number; result: AiHostTaskResult }>(Joi.object({ nodeId: Joi.string().guid().required(), sequence: Joi.number().integer().min(1).required(), result: aiHostTaskCompletionSchema.extract("result") }).unknown(false), request.body);
    const task = getAiHostTask(request.params.taskId);
    if (!task || task.nodeId !== body.nodeId) throw new ApiError(404, "daemon_host_task_not_found", "找不到此节点的命令任务。");
    const accepted = updateAiHostTaskOutput(task.id, body.nodeId, body.sequence, body.result);
    response.json({ accepted });
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
