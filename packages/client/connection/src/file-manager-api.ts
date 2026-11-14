/**
 * 文件管理 API 与 Client 合同；认证、错误和取消语义统一复用 http-client。
 */
import { request, requestBinary } from "./http-client.js";
import { maximumNodeFileTransferBytes } from "lfaa-util-values/src/file-transfer-contract.mjs";
import type { ManagedFileEntry, FileManagerOperation, FileOperationInput, FileResourceLocation } from "lfaa-util-values/src/file-manager-contract.js";
export type { ManagedFileEntry, FileManagerOperation, FileResourceLocation };

export interface FileManagerNode {
  id: string;
  displayName: string;
  platform: string;
  architecture: string;
  version: string;
  status: "online" | "offline";
  capabilities: string[];
  lastSeenAt: string;
}

export interface FileManagerAuditEntry {
  id: string;
  taskId?: string;
  nodeId?: string;
  userId: string;
  username: string;
  operation: string;
  path: string;
  targetPath: string;
  fileName: string;
  succeeded: boolean;
  createdAt: string;
  finishedAt: string;
}

export interface FileManagerTask {
  id: string;
  nodeId: string;
  createdBy: string;
  operation: FileManagerOperation;
  status: "queued" | "running" | "succeeded" | "failed";
  progress: number;
  message: string;
  result: Record<string, unknown> | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export function loadFileManagerNodes(): Promise<{ nodes: FileManagerNode[] }> {
  return request("/files/nodes");
}
/** 资源位置与真实目录分开读取，不枚举磁盘或递归计算大小。 */
export function loadFileResourceLocations(signal?: AbortSignal): Promise<{ rootDirectory: string; locations: FileResourceLocation[] }> {
  return request("/files/locations", { signal });
}
/** 页面与 AI 共用统一文件 Owner，普通本机操作直接返回，不产生节点任务。 */
export function operateSystemFiles(input: FileOperationInput & { operation: FileManagerOperation }, signal?: AbortSignal): Promise<{ result: Record<string, unknown> }> {
  return request("/files/operations", { method: "POST", body: JSON.stringify(input), signal });
}
export function downloadSystemFile(path: string): Promise<Blob> {
  return requestBinary(`/files/download?${new URLSearchParams({ path })}`);
}
/** 让服务端以 attachment 流式交付领域媒体，避免把大视频先读入页面内存。 */
export function startSystemFileDownload(path: string): void {
  const link = document.createElement("a");
  link.href = `/api/files/download?${new URLSearchParams({ path })}`;
  link.rel = "noopener";
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
}
export function downloadFileTransfer(transferId: string): Promise<Blob> {
  return requestBinary(`/files/transfers/${encodeURIComponent(transferId)}`);
}
export { maximumNodeFileTransferBytes };
export function uploadSystemFile(path: string, file: File, sha256: string): Promise<{ result: Record<string, unknown> }> {
  return request(`/files/upload?${new URLSearchParams({ path, name: file.name, sha256 })}`, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: file });
}
export function loadSystemFileAudit(query = ""): Promise<{ entries: FileManagerAuditEntry[] }> {
  return request(`/files/system-audit?${new URLSearchParams({ q: query.slice(0, 120) })}`);
}

export function submitFileManagerTask(input: {
  nodeId: string;
  operation: FileManagerOperation;
  path: string;
  query?: string;
  name?: string;
  destinationPath?: string;
  content?: string;
  sha256?: string;
  expectedSha256?: string;
}): Promise<{ task: FileManagerTask }> {
  return request("/files/tasks", { method: "POST", body: JSON.stringify(input) });
}

export function loadFileManagerAudit(query = ""): Promise<{ entries: FileManagerAuditEntry[] }> {
  const parameters = new URLSearchParams({ limit: "200" });
  if (query.trim()) parameters.set("q", query.trim().slice(0, 120));
  return request(`/files/audit?${parameters.toString()}`);
}

export function loadFileManagerTask(taskId: string): Promise<{ task: FileManagerTask }> {
  return request(`/files/tasks/${encodeURIComponent(taskId)}`);
}

