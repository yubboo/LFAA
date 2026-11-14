/**
 * AI 漫剧 Connection DTO 与认证端点；资源和生成状态仍由 AI Video Owner 持有。
 */
import { ApiError, request, requestBinary } from "./http-client.js";
import { isRecord } from "./value-guards.js";



export interface AiVideoTask { localId: string; accountId: string; modelId: string; status: "submitting" | "queued" | "running" | "succeeded" | "failed" | "cancelled" | "expired"; createdAt: string; updatedAt: string; providerTaskId?: string; error?: string }

export interface AiVideoShot { id: string; title: string; description: string; dialogue: string; durationSeconds: number; x: number; y: number; characterIds: string[]; locationId?: string; imageAssetId?: string; imageMimeType?: "image/png" | "image/jpeg" | "image/webp"; videoAssetId?: string; videoMimeType?: "video/mp4"; videoTask?: AiVideoTask }

export interface AiVideoShotLink { id: string; source: string; target: string }

export interface AiVideoReference { id: string; name: string; description: string; imageAssetId?: string; imageMimeType?: "image/png" | "image/jpeg" | "image/webp" }

export type AiVideoMediaMimeType = "image/png" | "image/jpeg" | "image/webp" | "video/mp4" | "video/webm" | "audio/mpeg" | "audio/wav" | "audio/ogg";

export interface AiVideoMediaAsset { assetId: string; name: string; mimeType: AiVideoMediaMimeType; bytes: number; createdAt: string; origin: "imported" | "export" | "generated"; available?: boolean }

export interface AiVideoTimelineClip { id: string; track: "video" | "audio" | "subtitle"; assetId?: string; text?: string; startSeconds: number; inPointSeconds: number; durationSeconds: number }

export interface AiVideoWhiteModelItem { id: string; name: string; kind: "actor" | "block"; x: number; z: number; width: number; depth: number; height: number }

export interface AiVideoWhiteModel { items: AiVideoWhiteModelItem[]; camera: { x: number; y: number; z: number; yaw: number; pitch: number; focalLength: number }; ratio: "16:9" | "9:16" | "1:1" }

export interface AiVideoCanvasLayout { viewport: { x: number; y: number; zoom: number }; nodePositions: Record<string, { x: number; y: number }> }

export interface AiVideoCanvas { id: string; title: string; script: string; characters: AiVideoReference[]; locations: AiVideoReference[]; shots: AiVideoShot[]; links: AiVideoShotLink[]; mediaAssets: AiVideoMediaAsset[]; timelineClips: AiVideoTimelineClip[]; whiteModel: AiVideoWhiteModel; canvasLayout: AiVideoCanvasLayout; createdAt: string; updatedAt: string }

export type AiVideoCanvasInput = Pick<AiVideoCanvas, "title" | "script" | "characters" | "locations" | "shots" | "links" | "timelineClips" | "whiteModel"> & { canvasLayout?: AiVideoCanvasLayout };


type AiVideoCanvasLimits = { canvases: number; shots: number; links: number; characters: number; locations: number; scriptCharacters: number; referencesPerShot: number; referenceImageBytes: number; referenceImageDimension: number; referenceImagePixels: number; imageAssetBytes: number; mediaAssetBytes: number; timelineClips: number; timelineSeconds: number };

type AiVideoCanvasCollection = { canvases: AiVideoCanvas[]; limits: AiVideoCanvasLimits };


export async function loadAiVideoCanvases(signal?: AbortSignal): Promise<AiVideoCanvasCollection> {
  const response: unknown = await request<unknown>("/ai-video/canvases", signal ? { signal } : {});
  const limits = isRecord(response) && isRecord(response.limits) ? response.limits : undefined;
  if (!isRecord(response) || !Array.isArray(response.canvases) || !limits || !aiVideoCanvasLimitFields.every(field => {
    const value = limits[field];
    return typeof value === "number" && Number.isFinite(value) && value >= 0;
  })) {
    throw new ApiError(502, "AI 漫剧服务返回的数据与当前界面版本不兼容。请重启本机 LFAA Web 服务后刷新页面。", "ai_video_contract_mismatch");
  }
  return response as AiVideoCanvasCollection;
}

export function createAiVideoCanvas(title: string): Promise<{ canvas: AiVideoCanvas }> {
  return request("/ai-video/canvases", { method: "POST", body: JSON.stringify({ title }) });
}

export function saveAiVideoCanvas(canvasId: string, expectedUpdatedAt: string, canvas: AiVideoCanvasInput): Promise<{ canvas: AiVideoCanvas }> {
  return request(`/ai-video/canvases/${encodeURIComponent(canvasId)}`, { method: "PUT", body: JSON.stringify({ expectedUpdatedAt, canvas }) });
}

export function generateAiVideoShotImage(canvasId: string, shotId: string, expectedUpdatedAt: string): Promise<{ canvas: AiVideoCanvas }> {
  return request(`/ai-video/canvases/${encodeURIComponent(canvasId)}/shots/${encodeURIComponent(shotId)}/image`, { method: "POST", body: JSON.stringify({ expectedUpdatedAt }) });
}

export function startAiVideoShotVideo(canvasId: string, shotId: string, expectedUpdatedAt: string): Promise<{ canvas: AiVideoCanvas }> {
  return request(`/ai-video/canvases/${encodeURIComponent(canvasId)}/shots/${encodeURIComponent(shotId)}/video`, { method: "POST", body: JSON.stringify({ expectedUpdatedAt }) });
}

export function refreshAiVideoShotVideo(canvasId: string, shotId: string): Promise<{ canvas: AiVideoCanvas }> {
  return request(`/ai-video/canvases/${encodeURIComponent(canvasId)}/shots/${encodeURIComponent(shotId)}/video`);
}

export function cancelAiVideoShotVideo(canvasId: string, shotId: string): Promise<{ canvas: AiVideoCanvas }> {
  return request(`/ai-video/canvases/${encodeURIComponent(canvasId)}/shots/${encodeURIComponent(shotId)}/video`, { method: "DELETE" });
}

export function aiVideoShotImageUrl(canvasId: string, assetId: string): string {
  return aiVideoAssetUrl(canvasId, assetId);
}

export function aiVideoAssetUrl(canvasId: string, assetId: string): string {
  return `/api/ai-video/canvases/${encodeURIComponent(canvasId)}/assets/${encodeURIComponent(assetId)}`;
}

export function loadAiVideoMediaAssets(canvasId: string, signal?: AbortSignal): Promise<{ assets: AiVideoMediaAsset[] }> {
  return request(`/ai-video/canvases/${encodeURIComponent(canvasId)}/media`, signal ? { signal } : {});
}

export function readAiVideoMediaAsset(canvasId: string, assetId: string): Promise<Blob> {
  return requestBinary(`/ai-video/canvases/${encodeURIComponent(canvasId)}/assets/${encodeURIComponent(assetId)}`);
}

export function uploadAiVideoMediaAsset(canvasId: string, expectedUpdatedAt: string, file: File): Promise<{ canvas: AiVideoCanvas }> {
  const query = new URLSearchParams({ expectedUpdatedAt, name: file.name });
  return request(`/ai-video/canvases/${encodeURIComponent(canvasId)}/assets?${query}`, { method: "POST", headers: { "Content-Type": file.type }, body: file });
}

export function deleteAiVideoMediaAsset(canvasId: string, assetId: string, expectedUpdatedAt: string): Promise<{ canvas: AiVideoCanvas }> {
  const query = new URLSearchParams({ expectedUpdatedAt });
  return request(`/ai-video/canvases/${encodeURIComponent(canvasId)}/assets/${encodeURIComponent(assetId)}?${query}`, { method: "DELETE" });
}

export function saveAiVideoExport(canvasId: string, expectedUpdatedAt: string, blob: Blob): Promise<{ canvas: AiVideoCanvas; asset: AiVideoMediaAsset }> {
  const query = new URLSearchParams({ expectedUpdatedAt });
  return request(`/ai-video/canvases/${encodeURIComponent(canvasId)}/exports?${query}`, { method: "POST", headers: { "Content-Type": blob.type }, body: blob });
}

export function uploadAiVideoShotImage(canvasId: string, shotId: string, expectedUpdatedAt: string, blob: Blob): Promise<{ canvas: AiVideoCanvas }> {
  const query = new URLSearchParams({ expectedUpdatedAt });
  return request(`/ai-video/canvases/${encodeURIComponent(canvasId)}/shots/${encodeURIComponent(shotId)}/image?${query}`, { method: "PUT", headers: { "Content-Type": blob.type }, body: blob });
}

export function uploadAiVideoReferenceImage(canvasId: string, kind: "characters" | "locations", referenceId: string, expectedUpdatedAt: string, dataUrl: string): Promise<{ canvas: AiVideoCanvas }> {
  return request(`/ai-video/canvases/${encodeURIComponent(canvasId)}/references/${kind}/${encodeURIComponent(referenceId)}/image`, { method: "PUT", body: JSON.stringify({ expectedUpdatedAt, dataUrl }) });
}

export function removeAiVideoReferenceImage(canvasId: string, kind: "characters" | "locations", referenceId: string, expectedUpdatedAt: string): Promise<{ canvas: AiVideoCanvas }> {
  return request(`/ai-video/canvases/${encodeURIComponent(canvasId)}/references/${kind}/${encodeURIComponent(referenceId)}/image`, { method: "DELETE", body: JSON.stringify({ expectedUpdatedAt }) });
}

export function deleteAiVideoCanvas(canvasId: string): Promise<void> {
  return request(`/ai-video/canvases/${encodeURIComponent(canvasId)}`, { method: "DELETE" });
}

const aiVideoCanvasLimitFields = ["canvases", "shots", "links", "characters", "locations", "scriptCharacters", "referencesPerShot", "referenceImageBytes", "referenceImageDimension", "referenceImagePixels", "imageAssetBytes", "mediaAssetBytes", "timelineClips", "timelineSeconds"] as const satisfies readonly (keyof AiVideoCanvasLimits)[];