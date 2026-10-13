/** 功能：登记 workspace-files 的现有接口。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。 */
import { Router } from "express";
import { ApiError } from "lfaa-util-values/src/http-error.js";
import { requireAuthentication, requireRole } from "lfaa-authorization/src/middleware.js";
import { getDaemonNode, getDaemonDataRoot, listDaemonNodes } from "lfaa-host-daemon/src/local-daemon.js";
import { createNodeFileTask, getNodeFileTask, listNodeFileAudit, NodeFileTaskQueueFullError, type NodeFileOperation } from "lfaa-fs/src/queue.js";
import type { AiPluginHost } from "lfaa-app-boot/src/ai-host.js";
import type { MinecraftRealtimePublisher } from "lfaa-api-remotes/src/socket-server.js";
import { parseBody, fileOperationSchema, asyncHandler } from "lfaa-api-remotes/src/route-contracts.js";
import { pipeline } from "node:stream/promises";
import { systemFiles, assertSystemFileAccess, type FileActor } from "lfaa-fs/src/library.js";
import type { FileManagerOperation } from "lfaa-util-values/src/file-manager-contract.js";
import { listMinecraftInstances } from "lfaa-games-minecraft/src/service.js";
import { config } from "lfaa-launch-environment/src/config.js";
import { isAbsolute, relative, resolve, sep } from "node:path";
function containsPath(parent: string, target: string): boolean { const path = relative(parent, target); return !path || path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path); }
function protectRunningGameFiles(path: string): void {
  for (const instance of listMinecraftInstances()) {
    const dataRoot = getDaemonDataRoot(instance.nodeId);
    if (!dataRoot || relative(resolve(dataRoot), resolve(config.dataDirectory)) !== "" || ["stopped", "error"].includes(instance.state)) continue;
    const directory = resolve(config.dataDirectory, instance.storageDirectory, instance.name);
    if (containsPath(directory, path) || containsPath(path, directory)) throw new ApiError(409, "game_directory_busy", "此目录包含运行中或状态未确认的游戏实例；请先停止实例并核对状态。");
  }
}
const systemOperationSchema = fileOperationSchema.fork(["nodeId"], field => field.forbidden());
// 游戏服务器是统一目录中的一个 Owner；登记本身不查询节点，更不阻断本机根目录。
const gameFileMount: import("lfaa-fs/src/library.js").FileMount = { id: "game-servers", name: "游戏服务器", async operate(actor, operation, input) {
  const [nodeId, ...parts] = String(input.path).split("/");
  const nodes = listDaemonNodes().filter(node => node.capabilities.includes("node-filesystem-v1"));
  if (!nodeId && operation === "list") return { path: "", entries: nodes.map(node => ({ name: `${node.displayName}${node.status === "online" ? "" : "（离线）"}`, path: node.id, kind: "directory", size: 0, fileType: "folder", modifiedAt: node.lastSeenAt })), truncated: false };
  const node = nodes.find(item => item.id === nodeId);
  if (!node || node.status !== "online") throw new ApiError(409, "file_host_offline", "这台游戏服务器当前无法连接；其他目录仍可使用。");
  if (["preview", "move", "trash-list", "trash-restore", "trash-purge"].includes(operation) && !node.capabilities.includes("node-filesystem-v2")) throw new ApiError(409, "file_host_update_required", "此机器尚不支持该文件操作，请更新其 Daemon。");
  if (operation === "directory-size" && !node.capabilities.includes("node-filesystem-directory-size-v1")) throw new ApiError(409, "file_host_update_required", "此机器尚不支持计算目录大小。");
  const payload: Record<string, unknown> = { ...input, path: parts.join("/") };
  if (operation === "move") {
    const [destinationNode, ...destinationParts] = String(input.destinationPath).split("/");
    if (destinationNode !== nodeId) throw new ApiError(400, "cross_host_move", "不同机器之间请先下载并上传，不能直接移动。");
    payload.destinationPath = destinationParts.join("/");
  }
  const task = createNodeFileTask({ nodeId, createdBy: actor.userId, operation, payload });
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    actor.signal?.throwIfAborted();
    const current = getNodeFileTask(task.id);
    if (!current) throw new ApiError(404, "file_task_missing", "文件任务不存在。");
    if (current.status === "failed") throw new ApiError(409, "file_host_failed", current.message);
    if (current.status === "succeeded") {
      const result = current.result ?? {};
      const prefix = (path: string) => [nodeId, path].filter(Boolean).join("/");
      return { ...result, ...(typeof result.path === "string" ? { path: prefix(result.path) } : {}), ...(Array.isArray(result.entries) ? { entries: result.entries.map(entry => ({ ...entry, path: prefix(entry.path), ...(entry.trashId ? { trashId: prefix(entry.trashId) } : {}) })) } : {}) };
    }
    await new Promise<void>(done => setTimeout(done, 100));
  }
  throw new ApiError(504, "file_host_timeout", "目标机器未及时返回结果；请核对文件状态，不会自动重放操作。");
} };
export function registerRoutes(router: Router, _aiPluginHost: AiPluginHost, realtime: MinecraftRealtimePublisher, files = systemFiles): void {
// 旧节点接口与新统一接口共同执行实时安全门，不能经旧 URL 绕过角色或权限模式。
router.use("/files", requireAuthentication, (request, _response, next) => { try { assertSystemFileAccess(request.auth!.user.id); next(); } catch (error) { next(error); } });

router.post("/files/operations", requireAuthentication, requireRole("admin"), asyncHandler(async (request, response) => {
  const body = parseBody<{ operation: FileManagerOperation; path: string } & Record<string, unknown>>(systemOperationSchema, request.body);
  const controller = new AbortController();
  const cancel = () => { if (!response.writableFinished) controller.abort(); };
  response.on("close", cancel);
  try {
    const { operation, ...input } = body;
    response.json({ result: await files.operate({ userId: request.auth!.user.id, role: request.auth!.user.role, signal: controller.signal }, operation, input) });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "file_operation_failed", error instanceof Error ? error.message : "文件操作失败。");
  } finally { response.off("close", cancel); }
}));
router.get("/files/system-audit", requireAuthentication, requireRole("admin"), asyncHandler(async (request, response) => {
  const query = typeof request.query.q === "string" ? request.query.q.slice(0, 120) : "";
  const user = request.auth!.user;
  response.json({ entries: (await files.listAudit({ userId: user.id, role: user.role }, query)).map(entry => ({ ...entry, username: user.username })) });
}));
router.get("/files/download", requireAuthentication, requireRole("admin"), asyncHandler(async (request, response) => {
  if (typeof request.query.path !== "string") throw new ApiError(400, "invalid_file_path", "下载路径无效。");
  const actor: FileActor = { userId: request.auth!.user.id, role: request.auth!.user.role };
  let file: Awaited<ReturnType<typeof files.openDownload>>;
  try { file = await files.openDownload(actor, request.query.path); }
  catch (error) { if (error instanceof ApiError) throw error; throw new ApiError(400, "file_download_failed", error instanceof Error ? error.message : "下载失败。"); }
  response.setHeader("Content-Type", "application/octet-stream");
  response.setHeader("Content-Length", file.size);
  response.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`);
  response.setHeader("Cache-Control", "private, no-store");
  try { await pipeline(file.stream, response); await files.recordDownload(actor, request.query.path, true); }
  catch (error) { await files.recordDownload(actor, request.query.path, false); if (!response.destroyed) throw error; }
}));
router.post("/files/upload", requireAuthentication, requireRole("admin"), asyncHandler(async (request, response) => {
  if (!request.is("application/octet-stream")) throw new ApiError(415, "file_upload_content_type", "上传必须使用原始文件字节流。");
  const body = parseBody<{ operation: FileManagerOperation } & Record<string, unknown>>(systemOperationSchema, { ...request.query, operation: "upload", dataBase64: "" });
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.from(chunk); size += bytes.length;
    if (size > 3 * 1024 * 1024) throw new ApiError(413, "file_upload_too_large", "单个上传文件不能超过 3 MiB。");
    chunks.push(bytes);
  }
  const { operation, dataBase64: _encoding, ...input } = body;
  if (typeof input.path !== "string" || input.path.startsWith(".lfaa-library/")) throw new ApiError(400, "local_upload_required", "本接口只接收当前 data 内的文件。");
  try { response.json({ result: await files.operate({ userId: request.auth!.user.id, role: request.auth!.user.role }, operation, { ...input, bytes: Buffer.concat(chunks, size) }) }); }
  catch (error) { if (error instanceof ApiError) throw error; throw new ApiError(400, "file_upload_failed", error instanceof Error ? error.message : "上传失败。"); }
}));

router.get("/files/audit", requireAuthentication, requireRole("admin"), (request, response) => {
    const query = typeof request.query.q === "string" ? request.query.q.trim().slice(0, 120) : "";
    const requestedLimit = Number(request.query.limit);
    const limit = Number.isInteger(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 200)) : 100;
    response.json({ entries: listNodeFileAudit({ query, limit }) });
  });

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
      destinationPath?: string;
      content?: string;
      dataBase64?: string;
      sha256?: string;
      expectedSha256?: string;
    }>(fileOperationSchema, request.body);
    if (body.path === "" && !["list", "search", "directory-size", "upload", "trash-list", "trash-restore", "trash-purge"].includes(body.operation)) {
      throw new ApiError(400, "invalid_file_path", "此文件操作需要选择数据根目录中的具体路径。");
    }
    listDaemonNodes(() => realtime.publishMinecraftChange(["state"]));
    const node = getDaemonNode(body.nodeId);
    if (!node || node.status !== "online" || !node.capabilities.includes("node-filesystem-v1")) {
      throw new ApiError(409, "daemon_file_manager_unavailable", "所选 daemon 节点未连接或尚未报告文件管理能力。");
    }
    const requiresFileManagerV2 = ["preview", "move", "trash-list", "trash-restore", "trash-purge"].includes(body.operation);
    if (requiresFileManagerV2 && !node.capabilities.includes("node-filesystem-v2")) {
      throw new ApiError(409, "daemon_file_manager_update_required", "目标节点的 Daemon 版本尚不支持预览、移动或回收站；请先更新目标节点 Daemon。");
    }
    if (body.operation === "directory-size" && !node.capabilities.includes("node-filesystem-directory-size-v1")) {
      throw new ApiError(409, "daemon_directory_size_update_required", "目标节点的 Daemon 尚不支持按需计算目录大小；请先更新目标节点 Daemon。");
    }
    const { nodeId, operation, ...payload } = body;
    let task: ReturnType<typeof createNodeFileTask>;
    try { task = createNodeFileTask({ nodeId, createdBy: request.auth!.user.id, operation, payload }); }
    catch (error) {
      if (error instanceof NodeFileTaskQueueFullError) throw new ApiError(429, "file_task_queue_full", error.message);
      throw error;
    }
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
export function apply(ctx: Context): void { ctx.effect(() => systemFiles.register(gameFileMount)); ctx.effect(() => systemFiles.registerMutationGuard(protectRunningGameFiles)); ctx.apiGateway.register(ctx, "workspace-files", registerRoutes); }
