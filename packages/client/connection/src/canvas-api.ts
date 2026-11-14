/**
 * Canvas DTO 与认证项目/素材/生成端点。
 */
import { request, requestBinary } from "./http-client.js";
import type { ApplicationId } from "lfaa-util-values/src/application-id.js";




export interface CanvasProjectSummary { id: string; title: string; applicationId: ApplicationId; nodeCount: number; assetCount: number; createdAt: string; updatedAt: string }

export interface CanvasNode { id: string; type: string; x: number; y: number; width: number; height: number; data: Record<string, unknown> }

export interface CanvasEdge { id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string }

export type CanvasAssetMimeType = "image/png" | "image/jpeg" | "image/webp" | "video/mp4" | "video/webm" | "audio/mpeg" | "audio/wav" | "audio/ogg";

export interface CanvasAsset { assetId: string; name: string; mimeType: CanvasAssetMimeType; bytes: number; createdAt: string }

export interface CanvasProject {
  format: "lfaa-canvas-project";
  formatVersion: 2;
  id: string;
  title: string;
  applicationId: ApplicationId;
  viewport: { x: number; y: number; zoom: number };
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  assets: CanvasAsset[];
  createdAt: string;
  updatedAt: string;
}

function canvasAppPath(applicationId: ApplicationId): string {
  return `/apps/${encodeURIComponent(applicationId)}/canvas/projects`;
}

export function loadCanvasProjects(applicationId?: ApplicationId, signal?: AbortSignal): Promise<{ projects: CanvasProjectSummary[] }> {
  return request(applicationId ? canvasAppPath(applicationId) : "/canvas/projects", signal ? { signal } : {});
}

export function createCanvasProject(applicationId: ApplicationId, title: string): Promise<{ project: CanvasProject }> {
  return request(canvasAppPath(applicationId), { method: "POST", body: JSON.stringify({ title }) });
}

export function loadCanvasProject(applicationId: ApplicationId, projectId: string, signal?: AbortSignal): Promise<{ project: CanvasProject }> {
  return request(`${canvasAppPath(applicationId)}/${encodeURIComponent(projectId)}`, signal ? { signal } : {});
}

export function saveCanvasProject(applicationId: ApplicationId, projectId: string, expectedUpdatedAt: string, project: CanvasProject): Promise<{ project: CanvasProject }> {
  return request(`${canvasAppPath(applicationId)}/${encodeURIComponent(projectId)}`, { method: "PUT", body: JSON.stringify({ expectedUpdatedAt, project }) });
}

export function deleteCanvasProject(applicationId: ApplicationId, projectId: string): Promise<void> {
  return request(`${canvasAppPath(applicationId)}/${encodeURIComponent(projectId)}`, { method: "DELETE" });
}

export function uploadCanvasAsset(applicationId: ApplicationId, projectId: string, expectedUpdatedAt: string, name: string, file: Blob, mimeType: string): Promise<{ project: CanvasProject }> {
  const query = new URLSearchParams({ expectedUpdatedAt, name });
  return request(`${canvasAppPath(applicationId)}/${encodeURIComponent(projectId)}/assets?${query}`, { method: "POST", headers: { "Content-Type": mimeType }, body: file });
}

export function deleteCanvasAsset(applicationId: ApplicationId, projectId: string, assetId: string, expectedUpdatedAt: string): Promise<{ project: CanvasProject }> {
  const query = new URLSearchParams({ expectedUpdatedAt });
  return request(`${canvasAppPath(applicationId)}/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}?${query}`, { method: "DELETE" });
}

export function canvasAssetUrl(applicationId: ApplicationId, projectId: string, assetId: string): string {
  return `/api${canvasAppPath(applicationId)}/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}`;
}

export async function readCanvasAsset(applicationId: ApplicationId, projectId: string, assetId: string): Promise<Blob> {
  return requestBinary(`${canvasAppPath(applicationId)}/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}`);
}


/** 画布生成比例；2:1 只表示全景比例图像，不承诺球面全景渲染。 */
export type CanvasAspectRatio = "1:1" | "4:3" | "3:4" | "16:9" | "9:16" | "2:1";

export type CanvasGenerationKind = "image" | "video";

/** 生成接口返回的新素材摘要；素材字节仍由画布 Owner 保存在项目内。 */
export interface CanvasGeneratedAsset { assetId: string; name: string; mimeType: CanvasAssetMimeType; bytes: number }

export interface CanvasImageGenerationInput {
  expectedUpdatedAt: string;
  nodeId?: string;
  prompt: string;
  aspectRatio?: CanvasAspectRatio;
  referenceAssetIds?: string[];
}

export interface CanvasVideoGenerationInput extends CanvasImageGenerationInput { durationSeconds?: number }

function canvasGenerationPath(applicationId: ApplicationId, projectId: string, suffix: string): string {
  return `${canvasAppPath(applicationId)}/${encodeURIComponent(projectId)}/${suffix}`;
}

/** 调用画布生成 Owner 生成图片；服务端校验账户/模型/密钥、提示词与参考素材。 */
export function generateCanvasImage(applicationId: ApplicationId, projectId: string, input: CanvasImageGenerationInput): Promise<{ project: CanvasProject; asset: CanvasGeneratedAsset }> {
  return request(canvasGenerationPath(applicationId, projectId, "generate/image"), { method: "POST", body: JSON.stringify(input) });
}

/** 启动画布视频生成任务；成功提交后节点 generation.status=running。 */
export function startCanvasVideo(applicationId: ApplicationId, projectId: string, input: CanvasVideoGenerationInput): Promise<{ project: CanvasProject }> {
  return request(canvasGenerationPath(applicationId, projectId, "generate/video"), { method: "POST", body: JSON.stringify(input) });
}

/** 刷新视频任务；只有真实任务完成后服务端才会落素材并置 succeeded。 */
export function refreshCanvasVideo(applicationId: ApplicationId, projectId: string, nodeId: string): Promise<{ project: CanvasProject }> {
  return request(canvasGenerationPath(applicationId, projectId, `generation/${encodeURIComponent(nodeId)}/refresh`), { method: "POST" });
}

/** 取消进行中的画布视频任务。 */
export function cancelCanvasVideo(applicationId: ApplicationId, projectId: string, nodeId: string): Promise<{ project: CanvasProject }> {
  return request(canvasGenerationPath(applicationId, projectId, `generation/${encodeURIComponent(nodeId)}/cancel`), { method: "POST" });
}