/**
 * 功能：承载短期节点文件字节传输。
 * 作用：任务队列只保留元数据；受认证路由通过随机 ID 读取有界、短期的原始字节。
 * 关联文件：queue.ts、workspace-files、job-controller、host/daemon。
 */
import { createHash, randomUUID } from "node:crypto";
import { maximumNodeFileTransferBytes, maximumRetainedNodeFileTransferBytes, nodeFileTransferLifetimeMilliseconds } from "lfaa-util-values/src/file-transfer-contract.mjs";

const fileTransfers = new Map();
let reservedBytes = 0;

export class FileTransferLimitError extends Error {
  constructor(message = "文件传输暂存容量已满，请稍后重试。", code = "file_transfer_capacity") { super(message); this.name = "FileTransferLimitError"; this.code = code; }
}

export class FileTransferNotFoundError extends Error {
  constructor() { super("文件传输已过期、不存在或不属于当前任务。 "); this.name = "FileTransferNotFoundError"; }
}

function expireFileTransfers(now = Date.now()) {
  for (const [id, entry] of fileTransfers) {
    if (entry.expiresAt <= now) removeFileTransfer(id);
  }
}

function removeFileTransfer(id) {
  const entry = fileTransfers.get(id);
  if (!entry) return false;
  reservedBytes -= entry.reservedBytes;
  fileTransfers.delete(id);
  return true;
}

function reserveFileTransfer({ id = randomUUID(), kind, userId, name, taskId = null, nodeId = null }) {
  expireFileTransfers();
  if (fileTransfers.has(id)) throw new FileTransferLimitError("此文件任务已登记传输内容。 ");
  if (reservedBytes + maximumNodeFileTransferBytes > maximumRetainedNodeFileTransferBytes) throw new FileTransferLimitError();
  const entry = {
    id,
    kind,
    userId,
    name: String(name).replace(/[\\/\u0000-\u001f\u007f]/gu, "_").slice(0, 255) || "download",
    taskId,
    nodeId,
    storage: Buffer.allocUnsafe(maximumNodeFileTransferBytes),
    bytes: null,
    size: 0,
    sha256: "",
    reservedBytes: maximumNodeFileTransferBytes,
    expiresAt: Date.now() + nodeFileTransferLifetimeMilliseconds
  };
  fileTransfers.set(id, entry);
  reservedBytes += entry.reservedBytes;
  return entry;
}

function assertContentLength(contentLength) {
  if (contentLength === undefined || contentLength === null || contentLength === "") return;
  const parsed = Number(contentLength);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new FileTransferLimitError("文件大小标记无效。 ", "file_transfer_invalid_size");
  if (parsed > maximumNodeFileTransferBytes) throw new FileTransferLimitError("单个文件不能超过 3 MiB。 ", "file_transfer_too_large");
}

async function fillFileTransfer(entry, source, contentLength) {
  assertContentLength(contentLength);
  const digest = createHash("sha256");
  let size = 0;
  try {
    for await (const chunk of source) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      if (size + bytes.length > maximumNodeFileTransferBytes) throw new FileTransferLimitError("单个文件不能超过 3 MiB。 ", "file_transfer_too_large");
      bytes.copy(entry.storage, size);
      digest.update(bytes);
      size += bytes.length;
    }
    const declaredLength = contentLength === undefined || contentLength === null || contentLength === "" ? null : Number(contentLength);
    if (declaredLength !== null && size !== declaredLength) throw new FileTransferLimitError("接收的文件大小与请求标记不一致。 ", "file_transfer_invalid_size");
    entry.bytes = entry.storage.subarray(0, size);
    entry.size = size;
    entry.sha256 = digest.digest("hex");
    return { id: entry.id, name: entry.name, size, sha256: entry.sha256 };
  } catch (error) {
    removeFileTransfer(entry.id);
    throw error;
  }
}

export async function receiveUserFileTransfer({ userId, name, source, contentLength }) {
  const entry = reserveFileTransfer({ kind: "upload", userId, name });
  try { return await fillFileTransfer(entry, source, contentLength); }
  catch (error) { removeFileTransfer(entry.id); throw error; }
}

export function getUserUploadFileTransfer({ transferId, userId }) {
  expireFileTransfers();
  const entry = fileTransfers.get(transferId);
  if (!entry || entry.kind !== "upload" || entry.userId !== userId || entry.taskId !== null || !entry.bytes) throw new FileTransferNotFoundError();
  return { name: entry.name, size: entry.size, sha256: entry.sha256, bytes: entry.bytes };
}

export async function receiveNodeFileTransfer({ task, nodeId, name, source, contentLength }) {
  if (!task || task.status !== "running" || task.nodeId !== nodeId || !["download", "preview"].includes(task.operation)) {
    throw new FileTransferNotFoundError();
  }
  const entry = reserveFileTransfer({ id: task.id, kind: "download", userId: task.createdBy, name, taskId: task.id, nodeId });
  try { return await fillFileTransfer(entry, source, contentLength); }
  catch (error) { removeFileTransfer(entry.id); throw error; }
}

export function bindFileTransferToNodeTask({ transferId, taskId, nodeId, userId }) {
  expireFileTransfers();
  const entry = fileTransfers.get(transferId);
  if (!entry || entry.kind !== "upload" || entry.userId !== userId || entry.taskId) throw new FileTransferNotFoundError();
  entry.taskId = taskId;
  entry.nodeId = nodeId;
}

export function getNodeFileUploadTransfer({ transferId, task }) {
  expireFileTransfers();
  const entry = fileTransfers.get(transferId);
  if (!entry || entry.kind !== "upload" || !task || task.status !== "running" || task.operation !== "upload"
    || entry.userId !== task.createdBy || entry.taskId !== task.id || entry.nodeId !== task.nodeId
    || task.payload.transferId !== transferId || !entry.bytes) throw new FileTransferNotFoundError();
  return { name: entry.name, size: entry.size, sha256: entry.sha256, bytes: entry.bytes };
}

export function getUserFileTransfer({ transferId, userId }) {
  expireFileTransfers();
  const entry = fileTransfers.get(transferId);
  if (!entry || entry.kind !== "download" || entry.userId !== userId || !entry.bytes) throw new FileTransferNotFoundError();
  return { id: entry.id, name: entry.name, size: entry.size, sha256: entry.sha256, bytes: entry.bytes };
}

export function getNodeFileResultTransfer({ task }) {
  expireFileTransfers();
  const entry = fileTransfers.get(task?.id);
  if (!entry || entry.kind !== "download" || !task || task.status !== "running"
    || !["download", "preview"].includes(task.operation) || entry.userId !== task.createdBy
    || entry.taskId !== task.id || entry.nodeId !== task.nodeId || !entry.bytes) throw new FileTransferNotFoundError();
  return { id: entry.id, name: entry.name, size: entry.size, sha256: entry.sha256, bytes: entry.bytes };
}

export function discardFileTransfer({ transferId, userId, taskId }) {
  const entry = fileTransfers.get(transferId);
  if (!entry || userId !== undefined && entry.userId !== userId || taskId !== undefined && entry.taskId !== taskId) return false;
  return removeFileTransfer(transferId);
}

export function discardNodeFileUploadTransfer(task) {
  if (task?.operation !== "upload" || typeof task.payload?.transferId !== "string") return false;
  return discardFileTransfer({ transferId: task.payload.transferId, taskId: task.id });
}

export function discardUnboundUserFileTransfer({ transferId, userId }) {
  const entry = fileTransfers.get(transferId);
  if (!entry || entry.kind !== "upload" || entry.userId !== userId || entry.taskId !== null) return false;
  return removeFileTransfer(transferId);
}

const fileTransferCleanupTimer = setInterval(expireFileTransfers, 60_000);
fileTransferCleanupTimer.unref();

export { maximumNodeFileTransferBytes };
