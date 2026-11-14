/**
 * 本地模型目录与下载生命周期的认证 Connection 端点。
 */
import { request } from "./http-client.js";
import type { LocalModelDownloadSnapshot, LocalModelSummary } from "./local-model-types.js";



export function loadLocalModels(signal?: AbortSignal): Promise<{ models: LocalModelSummary[]; activeDownload: LocalModelDownloadSnapshot | null }> {
  return request<{ models: LocalModelSummary[]; activeDownload: LocalModelDownloadSnapshot | null }>("/local-models", signal ? { signal } : {});
}


export function startLocalModelDownload(modelId: string): Promise<{ download: LocalModelDownloadSnapshot }> {
  return request<{ download: LocalModelDownloadSnapshot }>(`/local-models/${encodeURIComponent(modelId)}/downloads`, { method: "POST", body: "{}" });
}


export function readLocalModelDownload(downloadId: string, signal?: AbortSignal): Promise<{ download: LocalModelDownloadSnapshot }> {
  return request<{ download: LocalModelDownloadSnapshot }>(`/local-models/downloads/${encodeURIComponent(downloadId)}`, signal ? { signal } : {});
}


export function cancelLocalModelDownload(downloadId: string): Promise<{ download: LocalModelDownloadSnapshot }> {
  return request<{ download: LocalModelDownloadSnapshot }>(`/local-models/downloads/${encodeURIComponent(downloadId)}`, { method: "DELETE" });
}


export function unloadLocalModel(modelId: string): Promise<void> {
  return request<void>(`/local-models/${encodeURIComponent(modelId)}/unload`, { method: "POST", body: "{}" });
}
