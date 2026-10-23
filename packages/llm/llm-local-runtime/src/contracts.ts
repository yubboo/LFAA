/** 功能：定义 LFAA 自有本地模型核心与系列适配器合同。作用：统一目录、Hub 下载和推理入口，模型格式细节留给对应适配器。 */
import type { Buffer } from "node:buffer";

export type LocalModelModality = "text" | "image" | "video" | "audio";
export type LocalModelDownloadStatus = "queued" | "downloading" | "completed" | "failed" | "cancelled";

export interface LocalModelInspection {
  ready: boolean;
  reason: string | null;
}

export interface LocalModelDefinition {
  id: string;
  name: string;
  family: string;
  modality: LocalModelModality;
  task: string;
  repository: string;
  licenseName: string;
  licenseUrl: string;
  estimatedDownloadBytes: number | null;
  modelDirectory: string;
  includeFile(path: string): boolean;
  inspect(modelDirectory: string): Promise<LocalModelInspection>;
}

export interface LocalImageRequest {
  modelId: string;
  prompt: string;
  timeoutMs: number;
  unloadAfterMs: number;
  signal?: AbortSignal;
}

export interface LocalImageResult {
  bytes: Buffer;
  mimeType: "image/png";
}

export interface LocalVideoRequest {
  modelId: string;
  prompt: string;
  durationSeconds: number;
  aspectRatio: "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
  referenceImages?: Array<{ bytes: Buffer; mimeType: "image/png" | "image/jpeg" | "image/webp" }>;
  timeoutMs: number;
  unloadAfterMs: number;
  signal?: AbortSignal;
}

export interface LocalVideoResult {
  bytes: Buffer;
  mimeType: "video/mp4";
}

/** 系列适配器读取自身原生目录，并在该家族中维护一个受管模型进程。 */
export interface LocalModelAdapter {
  readonly definition: LocalModelDefinition;
  generateImage?(modelDirectory: string, request: LocalImageRequest): Promise<LocalImageResult>;
  generateVideo?(modelDirectory: string, request: LocalVideoRequest): Promise<LocalVideoResult>;
  isLoaded?(): boolean;
  unload(): Promise<void>;
}

export interface LocalModelSummary {
  id: string;
  name: string;
  family: string;
  modality: LocalModelModality;
  task: string;
  repository: string;
  licenseName: string;
  licenseUrl: string;
  directory: string;
  estimatedDownloadBytes: number | null;
  installedBytes: number;
  installed: boolean;
  loaded: boolean;
  ready: boolean;
  reason: string | null;
}

export interface LocalModelDownloadSnapshot {
  id: string;
  modelId: string;
  status: LocalModelDownloadStatus;
  receivedBytes: number;
  totalBytes: number | null;
  completedFiles: number;
  totalFiles: number | null;
  message: string | null;
  startedAt: string;
  updatedAt: string;
}

export type LocalWorkspaceDirectory = "input" | "output";

/** 用户可在本机 Data 目录中直接查看的本地推理输入/输出副本。 */
export interface LocalWorkspaceAsset {
  id: string;
  directory: LocalWorkspaceDirectory;
  fileName: string;
  mimeType: string;
  bytes: number;
}

export interface LocalModelRuntimeService {
  registerAdapter(adapter: LocalModelAdapter): () => void;
  listModels(): Promise<LocalModelSummary[]>;
  startDownload(modelId: string): Promise<LocalModelDownloadSnapshot>;
  getActiveDownload(): LocalModelDownloadSnapshot | null;
  getDownload(downloadId: string): LocalModelDownloadSnapshot | null;
  cancelDownload(downloadId: string): boolean;
  generateImage(request: LocalImageRequest): Promise<LocalImageResult>;
  generateVideo(request: LocalVideoRequest): Promise<LocalVideoResult>;
  saveWorkspaceAsset(userId: string, directory: LocalWorkspaceDirectory, name: string, mimeType: string, bytes: Buffer): Promise<LocalWorkspaceAsset>;
  removeWorkspaceAsset(userId: string, asset: LocalWorkspaceAsset): Promise<void>;
  unload(modelId?: string): Promise<void>;
}
