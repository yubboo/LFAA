/** 功能：登记 workspace-files 的现有接口。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。 */
import { Router } from "express";
import { ApiError } from "lfaa-util-values/src/http-error.js";
import { requireAuthentication, requireRole } from "lfaa-authorization/src/middleware.js";
import { getDaemonNode, listDaemonNodes } from "lfaa-host-daemon/src/local-daemon.js";
import { createNodeFileTask, getNodeFileTask, type NodeFileOperation } from "lfaa-fs/src/queue.js";
import type { AiPluginHost } from "lfaa-app-boot/src/ai-host.js";
import type { MinecraftRealtimePublisher } from "lfaa-api-remotes/src/socket-server.js";
import { parseBody, fileOperationSchema } from "lfaa-api-remotes/src/route-contracts.js";
export function registerRoutes(router: Router, _aiPluginHost: AiPluginHost, realtime: MinecraftRealtimePublisher): void {

router.get("/files/nodes", requireAuthentication, requireRole("admin"), (_request, response) => {
    const nodes = listDaemonNodes(() => realtime.publishMinecraftChange(["state"]))
      .filter((node) => node.capabilities.includes("node-filesystem-v1"));
    response.json({ nodes });
  });

router.post("/files/tasks", requireAuthentication, requireRole("admin"), (request, response) => {
    const body = parseBody<{
      nodeId: string;
      operation: NodeFileOperation;
      path: string;
      query?: string;
      name?: string;
      content?: string;
      dataBase64?: string;
    }>(fileOperationSchema, request.body);
    if (body.path === "" && body.operation !== "list" && body.operation !== "search" && body.operation !== "upload") {
      throw new ApiError(400, "invalid_file_path", "此文件操作需要选择数据根目录中的具体路径。");
    }
    listDaemonNodes(() => realtime.publishMinecraftChange(["state"]));
    const node = getDaemonNode(body.nodeId);
    if (!node || node.status !== "online" || !node.capabilities.includes("node-filesystem-v1")) {
      throw new ApiError(409, "daemon_file_manager_unavailable", "所选 daemon 节点未连接或尚未报告文件管理能力。");
    }
    const { nodeId, operation, ...payload } = body;
    const task = createNodeFileTask({ nodeId, createdBy: request.auth!.user.id, operation, payload });
    response.status(202).json({ task: { ...task, payload: undefined } });
  });

router.get("/files/tasks/:taskId", requireAuthentication, requireRole("admin"), (request, response) => {
    const task = getNodeFileTask(request.params.taskId);
    if (!task || task.createdBy !== request.auth!.user.id) throw new ApiError(404, "file_task_not_found", "找不到此文件任务。");
    response.json({ task: { ...task, payload: undefined } });
  });
}

/** 将本控制器的路由层与当前插件生命周期绑定。 */
import type { Context } from "@deepseek-ai/cordis";
import "lfaa-api-gateway/src/index.js";
export const inject = ["apiGateway"];
export function apply(ctx: Context): void { ctx.apiGateway.register(ctx, "workspace-files", registerRoutes); }
