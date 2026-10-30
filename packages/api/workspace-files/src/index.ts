/** 功能：登记 workspace-files 的现有接口。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。 */
import { Router } from "express";
import Joi from "joi";
import { ApiError } from "lfaa-util-values/src/http-error.js";
import { requireAuthentication, requireRole } from "lfaa-authorization/src/middleware.js";
import { getDaemonNode, getDaemonDataRoot, listDaemonNodes } from "lfaa-host-daemon/src/local-daemon.js";
import { createNodeFileTask, getNodeFileTask, cancelQueuedNodeFileReadTask, listNodeFileAudit, NodeFileTaskQueueFullError, type NodeFileOperation } from "lfaa-fs/src/queue.js";
import { bindFileTransferToNodeTask, discardFileTransfer, discardUnboundUserFileTransfer, FileTransferLimitError, FileTransferNotFoundError, getUserFileTransfer, getUserUploadFileTransfer, maximumNodeFileTransferBytes, receiveUserFileTransfer } from "lfaa-fs/src/file-transfers.mjs";
import type { AiPluginHost } from "lfaa-app-boot/src/ai-host.js";
import type { MinecraftRealtimePublisher } from "lfaa-api-remotes/src/socket-server.js";
import { parseBody, fileOperationSchema, asyncHandler } from "lfaa-api-remotes/src/route-contracts.js";
import { pipeline } from "node:stream/promises";
import { systemFiles, assertSystemFileAccess, type FileActor } from "lfaa-fs/src/library.js";
import type { FileManagerOperation } from "lfaa-util-values/src/file-manager-contract.js";
import { listMinecraftInstances, getMinecraftNodeStorageSettings } from "lfaa-games-minecraft/src/service.js";
import { getSteamcmdNodeSettings } from "lfaa-games-steamcmd/src/service.js";
import { config } from "lfaa-launch-environment/src/config.js";
import { isAbsolute, posix, relative, resolve, sep, win32 } from "node:path";
import { assertInstanceFileMutation } from "lfaa-fs/src/instance-files.mjs";
async function protectRunningGameFiles(path: string): Promise<void> {
  for (const instance of listMinecraftInstances()) {
    const dataRoot = getDaemonDataRoot(instance.nodeId);
    if (!dataRoot || relative(resolve(dataRoot), resolve(config.dataDirectory)) !== "") continue;
    const directory = resolve(dataRoot, instance.storageDirectory, instance.name);
    await assertInstanceFileMutation(path, directory, instance.nodeStatus === "online" && instance.state === "stopped");
    const rel = relative(directory, resolve(path));
    if (rel === "" || rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)) throw new ApiError(409, "game_file_node_owner_required", "已登记实例的文件由所属节点执行，请从游戏实例入口修改，避免控制端与节点并发写入。");
  }
}
/** 等待唯一节点任务结果；超时/取消不重放已经可能产生副作用的操作。 */
async function waitNodeFileResult(taskId: string, actor: FileActor): Promise<Record<string, unknown>> {
  const deadline = Date.now() + 60_000;
  try {
  while (Date.now() < deadline) {
    actor.signal?.throwIfAborted();
    const current = getNodeFileTask(taskId);
    if (!current) throw new ApiError(404, "file_task_missing", "文件任务不存在。");
    if (current.status === "failed") throw new ApiError(409, "file_host_failed", current.message);
    if (current.status === "succeeded") return current.result ?? {};
    await new Promise<void>(done => setTimeout(done, 100));
  }
  throw new ApiError(504, "file_host_timeout", "目标机器未及时返回结果；请核对文件状态，不会自动重放操作。");
  } finally {
    if (actor.signal?.aborted || Date.now() >= deadline) cancelQueuedNodeFileReadTask(taskId, actor.userId);
  }
}

function instanceDescription(instance: ReturnType<typeof listMinecraftInstances>[number]): string {
  const states = { installing: "安装中", stopped: "已停止", starting: "启动中", running: "运行中", stopping: "停止中", error: "异常", unknown: "未确认" };
  return `${instance.nodeName} · ${instance.nodeStatus === "online" ? "在线" : "离线"} · ${states[instance.state]} · ${displayDataPath(`${instance.storageDirectory}/${instance.name}`)}`;
}
function displayDataPath(path: string): string {
  if (/^[a-z]:[\\/]|^\\\\/iu.test(path)) return win32.normalize(path);
  if (path.startsWith("/")) return posix.normalize(path);
  return `data\\${path.replace(/[\\/]+/gu, "\\")}`;
}
const systemOperationSchema = fileOperationSchema.fork(["nodeId"], field => field.forbidden());
const fileUploadQuerySchema = Joi.object({
  path: Joi.string().max(1024).allow("").required(),
  name: Joi.string().trim().min(1).max(255).required(),
  sha256: Joi.string().hex().length(64).lowercase().required()
}).unknown(false);
const binaryNodeFileOperations = new Set<FileManagerOperation>(["preview", "download", "upload"]);
function transferError(error: unknown): never {
  if (error instanceof FileTransferLimitError) throw new ApiError(error.code === "file_transfer_too_large" ? 413 : error.code === "file_transfer_capacity" ? 429 : 400, error.code, error.message);
  if (error instanceof FileTransferNotFoundError) throw new ApiError(404, "file_transfer_not_found", error.message);
  throw error;
}
// 游戏服务器是统一目录中的一个 Owner；登记本身不查询节点，更不阻断本机根目录。
function listOnlineFileCapableNodes() {
  return listDaemonNodes().filter(node => node.status === "online" && node.capabilities.includes("node-filesystem-v1"));
}
export const gameFileMount: import("lfaa-fs/src/library.js").FileMount = { id: "game-servers", name: "节点资源", locationDescription: "各节点自己的真实 data 根目录；进入后由该节点的文件 Owner 读取", async operate(actor, operation, input) {
  const [nodeId, ...parts] = String(input.path).split("/");
  const nodes = listOnlineFileCapableNodes();
  if (!nodeId && operation === "list") return { path: "", operations: ["list"], entries: nodes.map(node => ({ name: node.displayName, path: node.id, kind: "directory", size: 0, fileType: "folder", modifiedAt: node.lastSeenAt, operations: ["list"] })), truncated: false };
  const node = nodes.find(item => item.id === nodeId);
  if (!node) throw new ApiError(409, "file_host_offline", "这台游戏服务器当前无法连接；其他目录仍可使用。");
  if (binaryNodeFileOperations.has(operation) && !node.capabilities.includes("node-filesystem-binary-transfer-v1")) throw new ApiError(409, "file_host_binary_transfer_update_required", "此机器尚不支持安全的二进制文件传输，请更新并加载 Daemon。");
  if (operation === "upload" && typeof input.transferId !== "string") throw new ApiError(400, "file_upload_transfer_required", "上传必须通过原始文件字节流提交。");
  if (["preview", "move", "trash-list", "trash-restore", "trash-purge"].includes(operation) && !node.capabilities.includes("node-filesystem-v2")) throw new ApiError(409, "file_host_update_required", "此机器尚不支持该文件操作，请更新其 Daemon。");
  if (operation === "directory-size" && !node.capabilities.includes("node-filesystem-directory-size-v1")) throw new ApiError(409, "file_host_update_required", "此机器尚不支持计算目录大小。");
  const payload: Record<string, unknown> = { ...input, path: parts.join("/") };
  if (["trash-restore", "trash-purge"].includes(operation) && typeof input.name === "string" && input.name.startsWith(nodeId + "/")) payload.name = input.name.slice(nodeId.length + 1);
  if (operation === "move") {
    const [destinationNode, ...destinationParts] = String(input.destinationPath).split("/");
    if (destinationNode !== nodeId) throw new ApiError(400, "cross_host_move", "不同机器之间请先下载并上传，不能直接移动。");
    payload.destinationPath = destinationParts.join("/");
  }
  const task = createNodeFileTask({ nodeId, createdBy: actor.userId, operation, payload });
  if (operation === "upload") bindFileTransferToNodeTask({ transferId: String(payload.transferId), taskId: task.id, nodeId, userId: actor.userId });
  const result = await waitNodeFileResult(task.id, actor);
  const prefix = (path: string) => [nodeId, path].filter(Boolean).join("/");
  return { ...result, rootDirectory: `${node.displayName} · ${displayDataPath(getDaemonDataRoot(node.id) ?? "data")}`, ...(typeof result.path === "string" ? { path: prefix(result.path) } : {}), ...(Array.isArray(result.entries) ? { entries: result.entries.map(entry => ({ ...entry, path: prefix(entry.path), ...(entry.trashId ? { trashId: prefix(entry.trashId) } : {}) })) } : {}) };
} };
/** 按实例 ID 投影原领域记录；路径只交由目标节点索引解析，不接收浏览器绝对路径。 */
export const gameInstanceFileMount: import("lfaa-fs/src/library.js").FileMount = { id: "game-instances", name: "游戏实例", locationDescription: "快捷入口 · 只显示已登记 Minecraft 实例并跳转到其真实目录；当前节点存储根见“游戏存储位置”", async operate(actor, operation, input) {
  const [instanceId, ...parts] = String(input.path).split("/");
  const instances = listMinecraftInstances();
  if (!instanceId && operation === "list") return { path: "", operations: ["list"], entries: instances.slice(0, 500).map(instance => ({
    name: instance.name, path: instance.id, kind: "directory", size: 0, fileType: "folder", modifiedAt: "", operations: ["list"],
    description: instanceDescription(instance)
  })), truncated: instances.length > 500 };
  const instance = instances.find(item => item.id === instanceId);
  if (!instance) throw new ApiError(404, "game_instance_missing", "游戏实例已不存在，请刷新实例列表。");
  const node = getDaemonNode(instance.nodeId);
  if (!node || node.status !== "online") throw new ApiError(409, "file_host_offline", "游戏实例所属节点离线，未读取文件内容。");
  if (!node.capabilities.includes("node-filesystem-instance-v1")) throw new ApiError(409, "file_host_update_required", "节点尚不支持按实例管理目录，请更新并加载本次 Daemon。");
  if (binaryNodeFileOperations.has(operation) && !node.capabilities.includes("node-filesystem-binary-transfer-v1")) throw new ApiError(409, "file_host_binary_transfer_update_required", "此机器尚不支持安全的二进制文件传输，请更新并加载 Daemon。");
  if (operation === "upload" && typeof input.transferId !== "string") throw new ApiError(400, "file_upload_transfer_required", "上传必须通过原始文件字节流提交。");
  const readonly = ["list", "search", "directory-size", "preview", "read", "download", "trash-list"].includes(operation);
  if (!readonly && instance.state !== "stopped") throw new ApiError(409, "game_directory_busy", "游戏实例正在运行或状态未确认，请先停止并核对状态。");
  const payload: Record<string, unknown> = { ...input, path: parts.join("/"), minecraftInstanceId: instance.id };
  if (operation === "move") {
    const [targetInstance, ...destination] = String(input.destinationPath).split("/");
    if (targetInstance !== instance.id) throw new ApiError(400, "cross_instance_move", "不同游戏实例之间不能直接移动。");
    payload.destinationPath = destination.join("/");
  }
  if (["trash-restore", "trash-purge"].includes(operation) && typeof input.name === "string") {
    payload.name = input.name.startsWith(instance.id + "/") ? input.name.slice(instance.id.length + 1) : input.name;
  }
  const task = createNodeFileTask({ nodeId: node.id, createdBy: actor.userId, operation, payload });
  if (operation === "upload") bindFileTransferToNodeTask({ transferId: String(payload.transferId), taskId: task.id, nodeId: node.id, userId: actor.userId });
  const result = await waitNodeFileResult(task.id, actor);
  const prefix = (path: string) => [instance.id, path].filter(Boolean).join("/");
  const latest = listMinecraftInstances().find(item => item.id === instance.id);
  const operations = latest?.nodeStatus === "online" && latest.state === "stopped" ? undefined : ["list", "search", "directory-size", "preview", "read", "download", "trash-list"];
  return { ...result, path: prefix(typeof result.path === "string" ? result.path : ""), rootDirectory: `${instance.nodeName} · ${displayDataPath(`${instance.storageDirectory}/${instance.name}`)}`, description: instanceDescription(latest ?? instance),
    ...(operations ? { operations } : {}),
    ...(Array.isArray(result.entries) ? { entries: result.entries.map(entry => ({ ...entry, path: prefix(entry.path), ...(entry.trashId ? { trashId: prefix(entry.trashId) } : {}), ...(operations ? { operations } : {}) })) } : {}) };
} };
/** 平台目录来自各节点的保存设置；控制端不解释远端盘符。 */
export const gameStorageFileMount: import("lfaa-fs/src/library.js").FileMount = { id: "game-storage", name: "游戏存储位置", locationDescription: "快捷入口 · Minecraft、Steam 游戏和 SteamCMD 工具位置来自对应节点的已保存设置", async operate(actor, operation, input) {
  const [nodeId, kind, ...parts] = String(input.path).split("/");
  const nodes = listOnlineFileCapableNodes();
  if (!nodeId && operation === "list") return { path: "", operations: ["list"], entries: nodes.flatMap(node => [
    { name: `${node.displayName} · Minecraft`, path: `${node.id}/minecraft`, description: `在线 · ${displayDataPath(getMinecraftNodeStorageSettings(node.id).instanceDirectory)}` },
    { name: `${node.displayName} · Steam 游戏`, path: `${node.id}/steamcmd`, description: `在线 · ${displayDataPath(getSteamcmdNodeSettings(node.id).gameDirectory)}` },
    { name: `${node.displayName} · SteamCMD 工具目录`, path: `${node.id}/steamcmd-runtime`, description: `在线 · ${displayDataPath(getSteamcmdNodeSettings(node.id).steamcmdDirectory)} · 只读查看` }
  ]).map(entry => ({ ...entry, kind: "directory", size: 0, fileType: "folder", modifiedAt: "", operations: ["list"] })), truncated: false };
  if (kind !== "minecraft" && kind !== "steamcmd" && kind !== "steamcmd-runtime") throw new ApiError(400, "game_storage_kind_invalid", "游戏存储来源无效。");
  const runtimeReadOnlyOperations: FileManagerOperation[] = ["list", "search", "directory-size", "preview", "read", "download"];
  if (kind === "steamcmd-runtime" && !runtimeReadOnlyOperations.includes(operation)) throw new ApiError(403, "steamcmd_runtime_read_only", "SteamCMD 工具目录在文件管理中只允许查看；安装和完整卸载请使用 SteamCMD 运行环境操作。");
  const node = nodes.find(item => item.id === nodeId);
  if (!node || node.status !== "online") throw new ApiError(409, "file_host_offline", "游戏存储所属节点离线，未读取目录内容。");
  if (!node.capabilities.includes("node-filesystem-game-storage-v1")) throw new ApiError(409, "file_host_update_required", "此节点尚不支持按游戏存储位置浏览，请更新并加载本次 Daemon。");
  const payload: Record<string, unknown> = { ...input, path: [nodeId, ...parts].join("/"), gameStorageKind: kind };
  if (operation === "move") {
    const [targetNode, targetKind, ...targetParts] = String(input.destinationPath).split("/");
    if (targetNode !== nodeId || targetKind !== kind) throw new ApiError(400, "cross_owner_move", "不同游戏存储位置不能直接移动。");
    payload.destinationPath = [nodeId, ...targetParts].join("/");
  }
  if (["trash-restore", "trash-purge"].includes(operation) && typeof input.name === "string") payload.name = input.name.replace(new RegExp(`^${nodeId}/${kind}/`), nodeId + "/");
  const result = await gameFileMount.operate(actor, operation, payload);
  const prefix = (path: string) => `${nodeId}/${kind}${path.slice(nodeId.length)}`;
  const directory = kind === "minecraft" ? getMinecraftNodeStorageSettings(nodeId).instanceDirectory : kind === "steamcmd" ? getSteamcmdNodeSettings(nodeId).gameDirectory : getSteamcmdNodeSettings(nodeId).steamcmdDirectory;
  return { ...result, rootDirectory: `${node.displayName} · ${displayDataPath(directory)}`, description: kind === "steamcmd-runtime" ? "SteamCMD 工具目录只读查看；路径来自节点设置，安装、校验和完整卸载由 SteamCMD 运行环境管理。" : "游戏数据留在所属节点；路径来自节点设置，运行中实例和实例元数据受保护。",
    ...(kind === "steamcmd-runtime" ? { operations: runtimeReadOnlyOperations } : {}),
    ...(typeof result.path === "string" ? { path: prefix(result.path) } : {}),
    ...(Array.isArray(result.entries) ? { entries: result.entries.map(entry => ({ ...entry, path: prefix(entry.path), ...(entry.trashId ? { trashId: prefix(entry.trashId) } : {}), ...(kind === "steamcmd-runtime" ? { operations: runtimeReadOnlyOperations } : {}) })) } : {}) };
} };
export function registerRoutes(router: Router, _aiPluginHost: AiPluginHost, realtime: MinecraftRealtimePublisher, files = systemFiles): void {
// 旧节点接口与新统一接口共同执行实时安全门，不能经旧 URL 绕过角色或权限模式。
router.use("/files", requireAuthentication, (request, _response, next) => { try { assertSystemFileAccess(request.auth!.user.id); next(); } catch (error) { next(error); } });
router.get("/files/locations", requireRole("admin"), (request, response) => response.json(files.listLocations({ userId: request.auth!.user.id, role: request.auth!.user.role })));

router.post("/files/operations", requireAuthentication, requireRole("admin"), asyncHandler(async (request, response) => {
  const body = parseBody<{ operation: FileManagerOperation; path: string } & Record<string, unknown>>(systemOperationSchema, request.body);
  if (body.operation === "upload") throw new ApiError(415, "file_upload_binary_required", "上传必须使用原始文件字节流接口。");
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
router.get("/files/transfers/:transferId", requireAuthentication, requireRole("admin"), (request, response) => {
  const { transferId } = parseBody<{ transferId: string }>(Joi.object({ transferId: Joi.string().guid().required() }).unknown(false), request.params);
  let transfer: ReturnType<typeof getUserFileTransfer>;
  try { transfer = getUserFileTransfer({ transferId, userId: request.auth!.user.id }); }
  catch (error) { transferError(error); }
  const task = getNodeFileTask(transferId);
  if (!task || task.createdBy !== request.auth!.user.id || task.status !== "succeeded" || task.result?.transferId !== transferId
    || task.result.size !== transfer.size || task.result.sha256 !== transfer.sha256) throw new ApiError(404, "file_transfer_not_found", "文件传输已过期、不存在或不属于当前任务。");
  response.setHeader("Content-Type", "application/octet-stream");
  response.setHeader("Content-Length", transfer.size);
  response.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(transfer.name)}`);
  response.setHeader("Cache-Control", "private, no-store");
  response.once("finish", () => discardFileTransfer({ transferId, userId: request.auth!.user.id }));
  response.end(transfer.bytes);
});
router.post("/files/upload", requireAuthentication, requireRole("admin"), asyncHandler(async (request, response) => {
  if (!request.is("application/octet-stream")) throw new ApiError(415, "file_upload_content_type", "上传必须使用原始文件字节流。");
  const input = parseBody<{ path: string; name: string; sha256: string }>(fileUploadQuerySchema, request.query);
  if (Number(request.header("content-length")) > maximumNodeFileTransferBytes) throw new ApiError(413, "file_upload_too_large", "单个上传文件不能超过 3 MiB。");
  const actor = { userId: request.auth!.user.id, role: request.auth!.user.role };
  let staged: Awaited<ReturnType<typeof receiveUserFileTransfer>>;
  try { staged = await receiveUserFileTransfer({ userId: actor.userId, name: input.name, source: request, contentLength: request.header("content-length") }); }
  catch (error) { transferError(error); }
  if (!input.path.startsWith(".lfaa-library/")) {
    try {
      const transfer = getUserUploadFileTransfer({ transferId: staged.id, userId: actor.userId });
      response.json({ result: await files.operate(actor, "upload", { ...input, bytes: transfer.bytes }) });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(400, "file_upload_failed", error instanceof Error ? error.message : "上传失败。");
    } finally {
      discardUnboundUserFileTransfer({ transferId: staged.id, userId: actor.userId });
    }
    return;
  }
  try {
    response.json({ result: await files.operate(actor, "upload", { ...input, transferId: staged.id }) });
  } catch (error) {
    discardUnboundUserFileTransfer({ transferId: staged.id, userId: actor.userId });
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "file_upload_failed", error instanceof Error ? error.message : "上传失败。");
  }
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
      sha256?: string;
      expectedSha256?: string;
    }>(fileOperationSchema, request.body);
    if (body.operation === "upload") throw new ApiError(415, "file_upload_binary_required", "上传必须使用原始文件字节流接口。");
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
    if (binaryNodeFileOperations.has(body.operation) && !node.capabilities.includes("node-filesystem-binary-transfer-v1")) throw new ApiError(409, "file_host_binary_transfer_update_required", "此机器尚不支持安全的二进制文件传输，请更新并加载 Daemon。");
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
export function apply(ctx: Context): void { ctx.effect(() => systemFiles.register(gameFileMount)); ctx.effect(() => systemFiles.register(gameInstanceFileMount)); ctx.effect(() => systemFiles.register(gameStorageFileMount)); ctx.effect(() => systemFiles.registerMutationGuard(protectRunningGameFiles)); ctx.apiGateway.register(ctx, "workspace-files", registerRoutes); }
