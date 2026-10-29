/** 功能：持有 AI 漫剧分镜项目文件。作用：按账户原子保存可编辑画布，与可执行 Workflow 分开。 */
import { randomUUID } from "node:crypto";
import { createReadStream, existsSync, lstatSync, mkdirSync, opendirSync, readFileSync, renameSync, rmSync, unlinkSync, type ReadStream } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import type { Context } from "@deepseek-ai/cordis";
import { resolveUserDataPaths } from "lfaa-home-paths/src/data-layout.mjs";
import { protectPrivateDirectory } from "lfaa-home-paths/src/private-directory.mjs";
import { atomicWrite, atomicWriteBytes } from "lfaa-storage-json/src/index.js";
import { database } from "lfaa-storage-sqlite/src/database.js";
import { withControlLock } from "lfaa-storage-domain/src/control-lock.js";
import { credentialReference } from "lfaa-credentials/src/index.js";
import type { CredentialConsumer } from "lfaa-credentials/src/index.js";
import { generateProviderImage, type GeneratedImageMimeType, type ImageGenerationProvider, type ProviderReferenceImage } from "lfaa-llm/src/image-generation.js";
import type { LocalModelRuntimeService } from "lfaa-llm-local-runtime/src/index.js";
import { cancelArkVideoTask, createArkVideoTask, downloadArkVideo, getArkVideoTask, type ArkVideoProviderId, type ArkVideoTaskStatus } from "lfaa-llm/src/video-generation.js";
import { getUserSettings, imageDimensions, listAiAccounts } from "lfaa-settings/src/service.js";
import { getProjectStorageDirectoryCandidates } from "lfaa-settings/src/project-storage.js";

export const AI_VIDEO_CANVAS_LIMITS = Object.freeze({ canvases: 20, shots: 64, links: 128, characters: 24, locations: 24, scriptCharacters: 100_000, referencesPerShot: 8, referenceImageBytes: 3 * 1024 * 1024, referenceImageDimension: 8_192, referenceImagePixels: 20_000_000, imageAssetBytes: 16 * 1024 * 1024, storeBytes: 4 * 1024 * 1024, assetBytes: 2 * 1024 * 1024 * 1024, assetFiles: 2_048, mediaAssetBytes: 128 * 1024 * 1024, videoAssetBytes: 128 * 1024 * 1024, timelineClips: 256, timelineSeconds: 300, whiteModelItems: 32, activeVideoTasks: 2 });
type AiVideoImageGenerationTarget =
  | { generationMode: "local"; prompt: string; modelId: string; timeoutMs: number; unloadAfterMs: number }
  | { generationMode: "provider"; prompt: string; referenceImages: ProviderReferenceImage[]; accountId: string; modelId: string; providerId: ImageGenerationProvider; timeoutMs: number };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const MAX_COORDINATE = 50_000;
const PROJECT_FORMAT = "lfaa-aivideo-project";
const PROJECT_FORMAT_VERSION = 7;
const SUPPORTED_PROJECT_FORMAT_VERSIONS = new Set([1, 2, 3, 4, 5, 6, PROJECT_FORMAT_VERSION]);
const LEGACY_FILE_NAME = "storyboards.json";
const LEGACY_BACKUP_FILE_NAME = "storyboards.v1.migrated.json";
const videoPollLeases = new Set<string>();
const localVideoJobs = new Map<string, AbortController>();
let watchSubmittedVideoTask: ((userId: string, canvasId: string, shotId: string, localTaskId: string) => void) | null = null;

function videoTaskKey(userId: string, canvasId: string, shotId: string, localTaskId: string): string {
  return `${userId}:${canvasId}:${shotId}:${localTaskId}`;
}

export interface AiVideoShot {
  id: string;
  title: string;
  description: string;
  dialogue: string;
  durationSeconds: number;
  x: number;
  y: number;
  characterIds: string[];
  locationId?: string;
  imageAssetId?: string;
  imageMimeType?: GeneratedImageMimeType;
  videoAssetId?: string;
  videoMimeType?: "video/mp4";
  videoTask?: AiVideoTask;
}

export type AiVideoTaskStatus = "submitting" | ArkVideoTaskStatus;
export interface AiVideoTask {
  localId: string;
  accountId: string;
  modelId: string;
  status: AiVideoTaskStatus;
  createdAt: string;
  updatedAt: string;
  providerTaskId?: string;
  error?: string;
}

export interface AiVideoShotLink { id: string; source: string; target: string }
export interface AiVideoReference { id: string; name: string; description: string; imageAssetId?: string; imageMimeType?: GeneratedImageMimeType }
export type AiVideoReferenceKind = "characters" | "locations";
export type AiVideoMediaMimeType = GeneratedImageMimeType | "video/mp4" | "video/webm" | "audio/mpeg" | "audio/wav" | "audio/ogg";
export interface AiVideoMediaAsset { assetId: string; name: string; mimeType: AiVideoMediaMimeType; bytes: number; createdAt: string; origin: "imported" | "export" | "generated" }
export interface AiVideoMediaAssetSummary extends AiVideoMediaAsset { available: boolean }
export interface AiVideoTimelineClip { id: string; track: "video" | "audio" | "subtitle"; assetId?: string; text?: string; startSeconds: number; inPointSeconds: number; durationSeconds: number }
export interface AiVideoWhiteModelItem { id: string; name: string; kind: "actor" | "block"; x: number; z: number; width: number; depth: number; height: number }
export interface AiVideoWhiteModel { items: AiVideoWhiteModelItem[]; camera: { x: number; y: number; z: number; yaw: number; pitch: number; focalLength: number }; ratio: "16:9" | "9:16" | "1:1" }
export interface AiVideoCanvasLayout {
  viewport: { x: number; y: number; zoom: number };
  nodePositions: Record<string, { x: number; y: number }>;
}

export interface AiVideoCanvas {
  id: string;
  title: string;
  script: string;
  characters: AiVideoReference[];
  locations: AiVideoReference[];
  shots: AiVideoShot[];
  links: AiVideoShotLink[];
  mediaAssets: AiVideoMediaAsset[];
  timelineClips: AiVideoTimelineClip[];
  whiteModel: AiVideoWhiteModel;
  canvasLayout: AiVideoCanvasLayout;
  createdAt: string;
  updatedAt: string;
}

export interface AiVideoCanvasService {
  list(userId: string): AiVideoCanvas[];
  create(userId: string, title: unknown): AiVideoCanvas;
  update(userId: string, canvasId: string, expectedUpdatedAt: string, input: unknown): AiVideoCanvas | null;
  remove(userId: string, canvasId: string): boolean;
  uploadReferenceImage(userId: string, canvasId: string, kind: AiVideoReferenceKind, referenceId: string, expectedUpdatedAt: string, dataUrl: unknown): Promise<AiVideoCanvas | null>;
  removeReferenceImage(userId: string, canvasId: string, kind: AiVideoReferenceKind, referenceId: string, expectedUpdatedAt: string): AiVideoCanvas | null;
  generateShotImage(userId: string, canvasId: string, shotId: string, expectedUpdatedAt: string, signal?: AbortSignal): Promise<AiVideoCanvas | null>;
  startShotVideo(userId: string, canvasId: string, shotId: string, expectedUpdatedAt: string, signal?: AbortSignal): Promise<AiVideoCanvas | null>;
  refreshShotVideo(userId: string, canvasId: string, shotId: string, signal?: AbortSignal): Promise<AiVideoCanvas | null>;
  cancelShotVideo(userId: string, canvasId: string, shotId: string, signal?: AbortSignal): Promise<AiVideoCanvas | null>;
  listMediaAssets(userId: string, canvasId: string): AiVideoMediaAssetSummary[] | null;
  importMediaAsset(userId: string, canvasId: string, expectedUpdatedAt: string, name: unknown, mimeType: unknown, bytes: Buffer): Promise<AiVideoCanvas | null>;
  saveExportAsset(userId: string, canvasId: string, expectedUpdatedAt: string, bytes: Buffer, mimeType: unknown): { canvas: AiVideoCanvas; asset: AiVideoMediaAsset } | null;
  removeMediaAsset(userId: string, canvasId: string, assetId: string, expectedUpdatedAt: string): AiVideoCanvas | null;
  uploadShotImage(userId: string, canvasId: string, shotId: string, expectedUpdatedAt: string, bytes: Buffer, mimeType: unknown): Promise<AiVideoCanvas | null>;
  openMediaAsset(userId: string, canvasId: string, assetId: string, rangeHeader?: string): { stream?: ReadStream; mimeType: AiVideoMediaMimeType; size: number; start?: number; end?: number; rangeNotSatisfiable?: boolean } | null;
  readGeneratedImage(userId: string, canvasId: string, assetId: string): { bytes: Buffer; mimeType: AiVideoMediaMimeType } | null;
}

interface LegacyCanvasStore { schemaVersion: 1; canvases: AiVideoCanvas[] }
interface CanvasInput { title: string; script?: string; characters?: AiVideoReference[]; locations?: AiVideoReference[]; shots: AiVideoShot[]; links: AiVideoShotLink[]; timelineClips?: AiVideoTimelineClip[]; whiteModel?: AiVideoWhiteModel; canvasLayout?: AiVideoCanvasLayout }
type ProjectAsset = { assetId: string; mimeType: AiVideoMediaMimeType };
interface CanvasProjectFile { format: typeof PROJECT_FORMAT; formatVersion: typeof PROJECT_FORMAT_VERSION; canvas: AiVideoCanvas }
interface StoredCanvas { canvas: AiVideoCanvas; bytes: number }

export class AiVideoCanvasConflictError extends Error {
  constructor() { super("分镜画布已在其他位置更新；请重新加载后再保存。"); this.name = "AiVideoCanvasConflictError"; }
}

function fail(message: string): never { throw new Error(message); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }

function normalizeCanvasLayout(value: unknown): AiVideoCanvasLayout {
  if (value === undefined) return { viewport: { x: 0, y: 0, zoom: 1 }, nodePositions: {} };
  if (!isRecord(value) || Object.keys(value).some(key => key !== "viewport" && key !== "nodePositions")
    || !isRecord(value.viewport) || Object.keys(value.viewport).some(key => !["x", "y", "zoom"].includes(key))
    || !isRecord(value.nodePositions) || Object.keys(value.nodePositions).length > 128) return fail("漫剧画布布局格式无效。");
  const coordinate = (input: unknown, label: string, min: number, max: number) => {
    const number = Number(input);
    if (!Number.isFinite(number) || number < min || number > max) return fail(`${label}超出可用范围。`);
    return Number(number.toFixed(2));
  };
  const x = coordinate(value.viewport.x, "画布视口横坐标", -100_000, 100_000);
  const y = coordinate(value.viewport.y, "画布视口纵坐标", -100_000, 100_000);
  const zoom = coordinate(value.viewport.zoom, "画布缩放比例", 0.05, 8);
  const nodePositions: AiVideoCanvasLayout["nodePositions"] = {};
  for (const [key, position] of Object.entries(value.nodePositions)) {
    if (!/^(?:script|timeline|director|character:[0-9a-f-]{36}|location:[0-9a-f-]{36}|asset:[0-9a-f-]{36})$/iu.test(key) || !isRecord(position)
      || Object.keys(position).some(field => field !== "x" && field !== "y")) return fail("漫剧画布节点布局标识无效。");
    nodePositions[key] = {
      x: coordinate(position.x, "节点横坐标", -50_000, 50_000),
      y: coordinate(position.y, "节点纵坐标", -50_000, 50_000)
    };
  }
  return { viewport: { x, y, zoom }, nodePositions };
}

function normalizedText(value: unknown, label: string, maximum: number, allowEmpty = false): string {
  if (typeof value !== "string") return fail(`${label}必须是文本。`);
  const result = value.trim();
  if ((!allowEmpty && !result) || result.length > maximum) return fail(`${label}不能为空，且不能超过 ${maximum} 个字符。`);
  return result;
}

function normalizedId(value: unknown, label: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) return fail(`${label}无效。`);
  return value.toLowerCase();
}

function normalizedCoordinate(value: unknown, label: string): number {
  const coordinate = Number(value);
  if (!Number.isFinite(coordinate) || Math.abs(coordinate) > MAX_COORDINATE) return fail(`${label}超出画布范围。`);
  return Math.round(coordinate);
}

function normalizedDocument(value: unknown): string {
  if (typeof value !== "string" || value.length > AI_VIDEO_CANVAS_LIMITS.scriptCharacters) return fail(`剧本文本不能超过 ${AI_VIDEO_CANVAS_LIMITS.scriptCharacters} 个字符。`);
  return value;
}

function normalizeReferences(value: unknown, label: string, maximum: number): AiVideoReference[] {
  if (!Array.isArray(value) || value.length > maximum) return fail(`${label}最多保存 ${maximum} 条。`);
  const ids = new Set<string>();
  return value.map((raw, index) => {
    if (!isRecord(raw) || Object.keys(raw).some(key => !["id", "name", "description", "imageAssetId", "imageMimeType"].includes(key))) return fail(`${label}第 ${index + 1} 条格式无效。`);
    const id = normalizedId(raw.id, `${label} ID`);
    if (ids.has(id)) return fail(`${label} ID 重复。`);
    ids.add(id);
    const imageAssetId = raw.imageAssetId === undefined ? undefined : normalizedId(raw.imageAssetId, `${label}图片素材 ID`);
    const imageMimeType = raw.imageMimeType === undefined ? undefined : raw.imageMimeType;
    if ((imageAssetId === undefined) !== (imageMimeType === undefined)
      || imageMimeType !== undefined && imageMimeType !== "image/png" && imageMimeType !== "image/jpeg" && imageMimeType !== "image/webp") return fail(`${label}图片素材引用无效。`);
    return {
      id,
      name: normalizedText(raw.name, `${label}名称`, 80),
      description: normalizedText(raw.description, `${label}描述`, 2_000, true),
      ...(imageAssetId && imageMimeType ? { imageAssetId, imageMimeType: imageMimeType as GeneratedImageMimeType } : {})
    };
  });
}

const MEDIA_MIME_TYPES = new Set<AiVideoMediaMimeType>(["image/png", "image/jpeg", "image/webp", "video/mp4", "video/webm", "audio/mpeg", "audio/wav", "audio/ogg"]);
const MEDIA_EXTENSIONS: Record<AiVideoMediaMimeType, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "video/mp4": "mp4", "video/webm": "webm",
  "audio/mpeg": "mp3", "audio/wav": "wav", "audio/ogg": "ogg"
};
const AUDIO_MIME_TYPES = new Set<AiVideoMediaMimeType>(["audio/mpeg", "audio/wav", "audio/ogg"]);
const VIDEO_MIME_TYPES = new Set<AiVideoMediaMimeType>(["video/mp4", "video/webm"]);
const IMAGE_MIME_TYPES = new Set<AiVideoMediaMimeType>(["image/png", "image/jpeg", "image/webp"]);

function normalizeMediaAsset(value: unknown): AiVideoMediaAsset {
  if (!isRecord(value) || Object.keys(value).some(key => !["assetId", "name", "mimeType", "bytes", "createdAt", "origin"].includes(key))) return fail("媒体素材记录格式无效。");
  const assetId = normalizedId(value.assetId, "媒体素材 ID");
  const mimeType = value.mimeType;
  if (typeof mimeType !== "string" || !MEDIA_MIME_TYPES.has(mimeType as AiVideoMediaMimeType)) return fail("媒体素材类型无效。");
  const bytes = Number(value.bytes);
  if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > AI_VIDEO_CANVAS_LIMITS.mediaAssetBytes) return fail("媒体素材大小超出限制。");
  const createdAt = normalizedText(value.createdAt, "媒体素材创建时间", 40);
  if (!Number.isFinite(Date.parse(createdAt))) return fail("媒体素材时间无效。");
  if (value.origin !== "imported" && value.origin !== "export" && value.origin !== "generated") return fail("媒体素材来源无效。");
  const name = normalizedText(value.name, "媒体名称", 120).replace(/[\\/:*?"<>|\u0000-\u001f]/gu, "_");
  return { assetId, name: name || "未命名素材", mimeType: mimeType as AiVideoMediaMimeType, bytes, createdAt, origin: value.origin };
}

function normalizeTimelineClips(value: unknown): AiVideoTimelineClip[] {
  if (!Array.isArray(value) || value.length > AI_VIDEO_CANVAS_LIMITS.timelineClips) return fail(`时间线最多保存 ${AI_VIDEO_CANVAS_LIMITS.timelineClips} 个片段。`);
  const ids = new Set<string>();
  const clips = value.map((raw, index): AiVideoTimelineClip => {
    if (!isRecord(raw) || Object.keys(raw).some(key => !["id", "track", "assetId", "text", "startSeconds", "inPointSeconds", "durationSeconds"].includes(key))) return fail(`第 ${index + 1} 个时间线片段格式无效。`);
    const id = normalizedId(raw.id, "时间线片段 ID");
    if (ids.has(id)) return fail("时间线片段 ID 重复。");
    ids.add(id);
    if (raw.track !== "video" && raw.track !== "audio" && raw.track !== "subtitle") return fail("时间线轨道类型无效。");
    const startSeconds = Number(raw.startSeconds);
    const inPointSeconds = Number(raw.inPointSeconds);
    const durationSeconds = Number(raw.durationSeconds);
    if (![startSeconds, inPointSeconds, durationSeconds].every(Number.isFinite) || startSeconds < 0 || inPointSeconds < 0 || durationSeconds <= 0 || startSeconds + durationSeconds > AI_VIDEO_CANVAS_LIMITS.timelineSeconds || durationSeconds > AI_VIDEO_CANVAS_LIMITS.timelineSeconds) return fail("时间线片段的起点、入点或时长超出范围。");
    if (raw.track === "subtitle") {
      if (raw.assetId !== undefined || typeof raw.text !== "string" || !raw.text.trim() || raw.text.length > 1_000) return fail("字幕片段需要文本且不能引用媒体素材。");
      return { id, track: "subtitle", text: raw.text.trim(), startSeconds, inPointSeconds: 0, durationSeconds };
    }
    if (raw.text !== undefined || raw.assetId === undefined) return fail("媒体片段必须引用项目内素材。");
    const assetId = normalizedId(raw.assetId, "时间线素材 ID");
    return { id, track: raw.track, assetId, startSeconds, inPointSeconds, durationSeconds };
  });
  for (const track of ["video", "audio", "subtitle"] as const) {
    const ordered = clips.filter(clip => clip.track === track).sort((left, right) => left.startSeconds - right.startSeconds);
    for (let index = 1; index < ordered.length; index += 1) {
      if (ordered[index]!.startSeconds < ordered[index - 1]!.startSeconds + ordered[index - 1]!.durationSeconds) return fail(`${track === "video" ? "视频" : track === "audio" ? "音频" : "字幕"}轨道片段不能重叠。`);
    }
  }
  return clips;
}

function defaultWhiteModel(): AiVideoWhiteModel {
  return { items: [], camera: { x: 0, y: 1.6, z: -8, yaw: 0, pitch: -4, focalLength: 50 }, ratio: "16:9" };
}

function normalizeWhiteModel(value: unknown): AiVideoWhiteModel {
  if (value === undefined) return defaultWhiteModel();
  if (!isRecord(value) || Object.keys(value).some(key => !["items", "camera", "ratio"].includes(key)) || !Array.isArray(value.items) || value.items.length > AI_VIDEO_CANVAS_LIMITS.whiteModelItems) return fail("白模导演台项目格式无效。");
  if (value.ratio !== "16:9" && value.ratio !== "9:16" && value.ratio !== "1:1") return fail("导演台取景比例无效。");
  if (!isRecord(value.camera) || Object.keys(value.camera).some(key => !["x", "y", "z", "yaw", "pitch", "focalLength"].includes(key))) return fail("导演台相机参数无效。");
  const cameraValue = value.camera;
  const coordinate = (input: unknown, label: string, min: number, max: number) => {
    const number = Number(input);
    if (!Number.isFinite(number) || number < min || number > max) return fail(`${label}超出可用范围。`);
    return Number(number.toFixed(2));
  };
  const itemIds = new Set<string>();
  const items = value.items.map((raw, index): AiVideoWhiteModelItem => {
    if (!isRecord(raw) || Object.keys(raw).some(key => !["id", "name", "kind", "x", "z", "width", "depth", "height"].includes(key))) return fail(`第 ${index + 1} 个白模格式无效。`);
    const id = normalizedId(raw.id, "白模 ID");
    if (itemIds.has(id)) return fail("白模 ID 重复。");
    itemIds.add(id);
    if (raw.kind !== "actor" && raw.kind !== "block") return fail("白模类型无效。");
    return {
      id,
      name: normalizedText(raw.name, "白模名称", 50),
      kind: raw.kind,
      x: coordinate(raw.x, "白模横坐标", -50, 50),
      z: coordinate(raw.z, "白模纵坐标", -50, 50),
      width: coordinate(raw.width, "白模宽度", 0.2, 20),
      depth: coordinate(raw.depth, "白模深度", 0.2, 20),
      height: coordinate(raw.height, "白模高度", 0.2, 20)
    };
  });
  return {
    items,
    camera: {
      x: coordinate(cameraValue.x, "相机横坐标", -100, 100),
      y: coordinate(cameraValue.y, "相机高度", -5, 100),
      z: coordinate(cameraValue.z, "相机纵坐标", -100, 100),
      yaw: coordinate(cameraValue.yaw, "相机水平角度", -360, 360),
      pitch: coordinate(cameraValue.pitch, "相机俯仰角度", -85, 85),
      focalLength: coordinate(cameraValue.focalLength, "镜头焦距", 18, 120)
    },
    ratio: value.ratio
  };
}

function validateShotReferences(shots: AiVideoShot[], characters: AiVideoReference[], locations: AiVideoReference[]): void {
  const characterIds = new Set(characters.map(reference => reference.id));
  const locationIds = new Set(locations.map(reference => reference.id));
  for (const shot of shots) {
    if (shot.characterIds.length > AI_VIDEO_CANVAS_LIMITS.referencesPerShot || new Set(shot.characterIds).size !== shot.characterIds.length
      || shot.characterIds.some(id => !characterIds.has(id))) return fail("镜头引用的角色档案不存在或重复。");
    if (shot.locationId && !locationIds.has(shot.locationId)) return fail("镜头引用的场景档案不存在。");
  }
}

function normalizeVideoTask(value: unknown): AiVideoTask | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value) || Object.keys(value).some(key => !["localId", "providerTaskId", "accountId", "modelId", "status", "createdAt", "updatedAt", "error"].includes(key))) return fail("视频任务记录格式无效。");
  const status = value.status;
  if (status !== "submitting" && status !== "queued" && status !== "running" && status !== "succeeded" && status !== "failed" && status !== "cancelled" && status !== "expired") return fail("视频任务状态无效。");
  const createdAt = normalizedText(value.createdAt, "视频任务创建时间", 40);
  const updatedAt = normalizedText(value.updatedAt, "视频任务更新时间", 40);
  if (!Number.isFinite(Date.parse(createdAt)) || !Number.isFinite(Date.parse(updatedAt))) return fail("视频任务时间无效。");
  if (value.providerTaskId !== undefined && (typeof value.providerTaskId !== "string" || !value.providerTaskId || value.providerTaskId.length > 256)) return fail("服务商视频任务 ID 无效。");
  if (value.error !== undefined && (typeof value.error !== "string" || value.error.length > 1_000)) return fail("视频任务错误信息无效。");
  return {
    localId: normalizedId(value.localId, "本地视频任务 ID"),
    accountId: normalizedText(value.accountId, "视频账户 ID", 160),
    modelId: normalizedText(value.modelId, "视频模型 ID", 160),
    status,
    createdAt,
    updatedAt,
    ...(typeof value.providerTaskId === "string" ? { providerTaskId: value.providerTaskId } : {}),
    ...(typeof value.error === "string" ? { error: value.error } : {})
  };
}

export function normalizeAiVideoCanvasInput(input: unknown): CanvasInput {
  if (!isRecord(input) || Object.keys(input).some(key => !["title", "script", "characters", "locations", "shots", "links", "timelineClips", "whiteModel", "canvasLayout"].includes(key))) return fail("漫剧项目格式无效。");
  const title = normalizedText(input.title, "画布名称", 80);
  const script = input.script === undefined ? undefined : normalizedDocument(input.script);
  const characters = input.characters === undefined ? undefined : normalizeReferences(input.characters, "角色档案", AI_VIDEO_CANVAS_LIMITS.characters);
  const locations = input.locations === undefined ? undefined : normalizeReferences(input.locations, "场景档案", AI_VIDEO_CANVAS_LIMITS.locations);
  if (!Array.isArray(input.shots) || input.shots.length > AI_VIDEO_CANVAS_LIMITS.shots) return fail(`每个画布最多保存 ${AI_VIDEO_CANVAS_LIMITS.shots} 个镜头。`);
  if (!Array.isArray(input.links) || input.links.length > AI_VIDEO_CANVAS_LIMITS.links) return fail(`每个画布最多保存 ${AI_VIDEO_CANVAS_LIMITS.links} 条镜头连线。`);

  const shotIds = new Set<string>();
  const shots = input.shots.map((raw, index): AiVideoShot => {
    if (!isRecord(raw) || Object.keys(raw).some(key => !["id", "title", "description", "dialogue", "durationSeconds", "x", "y", "characterIds", "locationId", "imageAssetId", "imageMimeType", "videoAssetId", "videoMimeType", "videoTask"].includes(key))) return fail(`第 ${index + 1} 个镜头格式无效。`);
    const id = normalizedId(raw.id, "镜头 ID");
    if (shotIds.has(id)) return fail("镜头 ID 重复。");
    shotIds.add(id);
    const durationSeconds = Number(raw.durationSeconds);
    if (!Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 120) return fail("镜头时长必须是 1 到 120 秒的整数。");
    const imageAssetId = raw.imageAssetId === undefined ? undefined : normalizedId(raw.imageAssetId, "镜头图片素材 ID");
    const imageMimeType = raw.imageMimeType === undefined ? undefined : raw.imageMimeType;
    const videoAssetId = raw.videoAssetId === undefined ? undefined : normalizedId(raw.videoAssetId, "镜头视频素材 ID");
    const videoMimeType = raw.videoMimeType === undefined ? undefined : raw.videoMimeType;
    const videoTask = normalizeVideoTask(raw.videoTask);
    const characterIds = raw.characterIds === undefined ? [] : Array.isArray(raw.characterIds) ? raw.characterIds.map(value => normalizedId(value, "镜头角色 ID")) : fail("镜头角色引用格式无效。");
    const locationId = raw.locationId === undefined || raw.locationId === "" ? undefined : normalizedId(raw.locationId, "镜头场景 ID");
    if ((imageAssetId === undefined) !== (imageMimeType === undefined)
      || imageMimeType !== undefined && imageMimeType !== "image/png" && imageMimeType !== "image/jpeg" && imageMimeType !== "image/webp") return fail("镜头图片素材引用无效。");
    if ((videoAssetId === undefined) !== (videoMimeType === undefined) || videoMimeType !== undefined && videoMimeType !== "video/mp4") return fail("镜头视频素材引用无效。");
    return {
      id,
      title: normalizedText(raw.title, "镜头标题", 80),
      description: normalizedText(raw.description, "镜头描述", 1_000, true),
      dialogue: normalizedText(raw.dialogue, "镜头对白", 2_000, true),
      durationSeconds,
      x: normalizedCoordinate(raw.x, "镜头横坐标"),
      y: normalizedCoordinate(raw.y, "镜头纵坐标"),
      characterIds,
      ...(locationId ? { locationId } : {}),
      ...(imageAssetId ? { imageAssetId, imageMimeType: imageMimeType as GeneratedImageMimeType } : {}),
      ...(videoAssetId ? { videoAssetId, videoMimeType: "video/mp4" as const } : {}),
      ...(videoTask ? { videoTask } : {})
    };
  });

  const linkIds = new Set<string>();
  const linkPairs = new Set<string>();
  const links = input.links.map((raw, index): AiVideoShotLink => {
    if (!isRecord(raw) || Object.keys(raw).some(key => !["id", "source", "target"].includes(key))) return fail(`第 ${index + 1} 条连线格式无效。`);
    const id = normalizedId(raw.id, "连线 ID");
    const source = normalizedId(raw.source, "连线起点");
    const target = normalizedId(raw.target, "连线终点");
    if (linkIds.has(id)) return fail("连线 ID 重复。");
    if (source === target || !shotIds.has(source) || !shotIds.has(target)) return fail("连线必须连接两个不同的现有镜头。");
    const pair = `${source}:${target}`;
    if (linkPairs.has(pair)) return fail("相同镜头之间不能重复连线。");
    linkIds.add(id);
    linkPairs.add(pair);
    return { id, source, target };
  });

  const timelineClips = input.timelineClips === undefined ? undefined : normalizeTimelineClips(input.timelineClips);
  const whiteModel = input.whiteModel === undefined ? undefined : normalizeWhiteModel(input.whiteModel);
  const canvasLayout = input.canvasLayout === undefined ? undefined : normalizeCanvasLayout(input.canvasLayout);

  if (script !== undefined && characters !== undefined && locations !== undefined) validateShotReferences(shots, characters, locations);
  return { title, ...(script !== undefined ? { script } : {}), ...(characters !== undefined ? { characters } : {}), ...(locations !== undefined ? { locations } : {}), shots, links, ...(timelineClips !== undefined ? { timelineClips } : {}), ...(whiteModel ? { whiteModel } : {}), ...(canvasLayout ? { canvasLayout } : {}) };
}

function aivideoDirectory(userId: string): string {
  const baseDirectory = getProjectStorageDirectoryCandidates("drama")[0];
  if (!baseDirectory) throw new Error("AI 漫剧存储位置未配置。");
  return resolve(resolveUserDataPaths(baseDirectory, userId).projects, "aivideo");
}

function aivideoDirectoryCandidates(root: string): string[] {
  const userHash = basename(dirname(dirname(resolve(root))));
  if (!/^[a-f0-9]{64}$/u.test(userHash)) throw new Error("AI 漫剧账户目录无效，拒绝访问。");
  return [...new Set(getProjectStorageDirectoryCandidates("drama").map(baseDirectory => resolve(baseDirectory, "users", userHash, "projects", "aivideo")))];
}

function assertWithin(root: string, path: string): void {
  if (!path.startsWith(`${root}${process.platform === "win32" ? "\\" : "/"}`)) throw new Error("AI 漫剧项目路径越界，拒绝访问。");
}

function projectDirectory(root: string, canvasId: string): string {
  const id = normalizedId(canvasId, "项目 ID");
  const candidates = aivideoDirectoryCandidates(root).map(candidate => resolve(candidate, id));
  const existing = candidates.filter(candidate => existsSync(candidate));
  if (existing.length > 1) throw new Error("AI 漫剧画布在多个存储位置重复存在；请先核对文件，拒绝选择性覆盖。");
  const directory = existing[0] ?? candidates[0];
  if (!directory) throw new Error("AI 漫剧存储位置未配置。");
  const ownerRoot = dirname(directory);
  assertWithin(ownerRoot, directory);
  return directory;
}

function rejectSymlinkOrWrongType(path: string, expected: "directory" | "file"): void {
  let stat: ReturnType<typeof lstatSync>;
  try { stat = lstatSync(path); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  if (stat.isSymbolicLink() || (expected === "directory" ? !stat.isDirectory() : !stat.isFile())) {
    throw new Error("AI 漫剧项目存储类型无效；拒绝跟随链接读取。");
  }
}

function ensureAivideoDirectory(userId: string): string {
  const baseDirectory = getProjectStorageDirectoryCandidates("drama")[0];
  if (!baseDirectory) throw new Error("AI 漫剧存储位置未配置。");
  const userPaths = resolveUserDataPaths(baseDirectory, userId);
  const projectsDirectory = resolve(userPaths.root, "projects");
  const directory = aivideoDirectory(userId);
  rejectSymlinkOrWrongType(userPaths.root, "directory");
  rejectSymlinkOrWrongType(projectsDirectory, "directory");
  rejectSymlinkOrWrongType(directory, "directory");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  rejectSymlinkOrWrongType(directory, "directory");
  protectPrivateDirectory(directory);
  return directory;
}

function projectFilePath(root: string, canvasId: string): string {
  return resolve(projectDirectory(root, canvasId), "project.json");
}

function imageExtension(mimeType: GeneratedImageMimeType): "png" | "jpg" | "webp" {
  return mimeType === "image/png" ? "png" : mimeType === "image/jpeg" ? "jpg" : "webp";
}

function imageAssetsDirectory(root: string, canvasId: string, create: boolean): string {
  const project = projectDirectory(root, canvasId);
  rejectSymlinkOrWrongType(project, "directory");
  if (!existsSync(project)) throw new Error("AI 漫剧项目不存在；拒绝创建游离素材目录。");
  const directory = resolve(project, "assets");
  assertWithin(project, directory);
  rejectSymlinkOrWrongType(directory, "directory");
  if (create && !existsSync(directory)) mkdirSync(directory, { recursive: false, mode: 0o700 });
  if (existsSync(directory)) protectPrivateDirectory(directory);
  return directory;
}

function imageAssetPath(root: string, canvasId: string, assetId: string, mimeType: GeneratedImageMimeType, createDirectory = false): string {
  const id = normalizedId(assetId, "图片素材 ID");
  const directory = imageAssetsDirectory(root, canvasId, createDirectory);
  const path = resolve(directory, `${id}.${imageExtension(mimeType)}`);
  assertWithin(directory, path);
  rejectSymlinkOrWrongType(path, "file");
  return path;
}

function projectAssetPath(root: string, canvasId: string, asset: ProjectAsset, createDirectory = false): string {
  if (IMAGE_MIME_TYPES.has(asset.mimeType)) return imageAssetPath(root, canvasId, asset.assetId, asset.mimeType as GeneratedImageMimeType, createDirectory);
  const id = normalizedId(asset.assetId, "视频素材 ID");
  const directory = imageAssetsDirectory(root, canvasId, createDirectory);
  const path = resolve(directory, `${id}.${MEDIA_EXTENSIONS[asset.mimeType]}`);
  assertWithin(directory, path);
  rejectSymlinkOrWrongType(path, "file");
  return path;
}

function projectAssets(canvas: AiVideoCanvas): ProjectAsset[] {
  const all = [
    ...[...canvas.shots, ...canvas.characters, ...canvas.locations]
      .flatMap(item => item.imageAssetId && item.imageMimeType ? [{ assetId: item.imageAssetId, mimeType: item.imageMimeType }] : []),
    ...canvas.mediaAssets.map(({ assetId, mimeType }) => ({ assetId, mimeType }))
  ];
  const unique = new Map<string, ProjectAsset>();
  for (const asset of all) {
    const existing = unique.get(asset.assetId);
    if (existing && existing.mimeType !== asset.mimeType) return fail("项目素材 ID 指向不同文件类型。");
    unique.set(asset.assetId, asset);
  }
  return [...unique.values()];
}

function projectAssetsWithVideo(canvas: AiVideoCanvas): ProjectAsset[] {
  const unique = new Map(projectAssets(canvas).map(asset => [asset.assetId, asset]));
  for (const shot of canvas.shots) {
    if (!shot.videoAssetId || !shot.videoMimeType) continue;
    const existing = unique.get(shot.videoAssetId);
    if (existing && existing.mimeType !== shot.videoMimeType) return fail("项目视频素材 ID 指向不同文件类型。");
    unique.set(shot.videoAssetId, { assetId: shot.videoAssetId, mimeType: shot.videoMimeType });
  }
  return [...unique.values()];
}

function validateTimelineAssets(canvas: AiVideoCanvas): void {
  const assets = new Map(projectAssetsWithVideo(canvas).map(asset => [asset.assetId, asset.mimeType]));
  if (assets.size !== projectAssetsWithVideo(canvas).length) return fail("项目中存在重复媒体素材 ID。文件已保留。");
  for (const clip of canvas.timelineClips) {
    if (clip.track === "subtitle") continue;
    const mimeType = clip.assetId ? assets.get(clip.assetId) : undefined;
    if (!mimeType) return fail("时间线片段引用的项目素材不存在。");
    if (clip.track === "video" && !IMAGE_MIME_TYPES.has(mimeType) && !VIDEO_MIME_TYPES.has(mimeType)) return fail("视频轨道只能使用图片或视频素材。");
    if (clip.track === "audio" && !AUDIO_MIME_TYPES.has(mimeType)) return fail("音频轨道只能使用音频素材。");
  }
}

function retainTimelineAssets(root: string, before: AiVideoCanvas, after: AiVideoCanvas): void {
  const retained = new Set(projectAssetsWithVideo(after).map(asset => asset.assetId));
  const known = new Map(projectAssetsWithVideo(before).map(asset => [asset.assetId, asset]));
  const metadata = new Map(before.mediaAssets.map(asset => [asset.assetId, asset]));
  const additions: AiVideoMediaAsset[] = [];
  for (const clip of after.timelineClips) {
    if (clip.track === "subtitle" || !clip.assetId || retained.has(clip.assetId)) continue;
    const asset = known.get(clip.assetId);
    if (!asset) continue;
    const existing = metadata.get(asset.assetId);
    const path = projectAssetPath(root, before.id, asset);
    if (!existsSync(path)) return fail("时间线素材文件已缺失；项目没有删除其引用。");
    const stat = lstatSync(path);
    const imageOwner = [...before.shots, ...before.characters, ...before.locations].find(item => item.imageAssetId === asset.assetId);
    const videoOwner = before.shots.find(item => item.videoAssetId === asset.assetId);
    additions.push(existing ?? {
      assetId: asset.assetId,
      name: videoOwner ? `${videoOwner.title} 视频` : imageOwner ? ("title" in imageOwner ? `${imageOwner.title} 图片` : `${imageOwner.name} 参考图`) : "项目媒体",
      mimeType: asset.mimeType,
      bytes: stat.size,
      createdAt: stat.mtime.toISOString(),
      origin: "generated"
    });
    retained.add(clip.assetId);
  }
  if (after.mediaAssets.length + additions.length > AI_VIDEO_CANVAS_LIMITS.assetFiles) return fail("项目媒体清单超过上限。");
  after.mediaAssets = [...after.mediaAssets, ...additions];
}

function removeUnreferencedAssetsAfterCommit(root: string, before: AiVideoCanvas, after: AiVideoCanvas): void {
  const retained = new Set(projectAssetsWithVideo(after).map(asset => `${asset.assetId}:${asset.mimeType}`));
  for (const asset of projectAssetsWithVideo(before)) {
    if (!retained.has(`${asset.assetId}:${asset.mimeType}`)) removeProjectAssetAfterCommit(root, before.id, asset);
  }
}

function referencedAssetBytes(root: string, records: StoredCanvas[]): number {
  let total = 0;
  const assetIds = new Set<string>();
  for (const record of records) {
    for (const asset of projectAssetsWithVideo(record.canvas)) {
      if (assetIds.has(asset.assetId)) throw new Error("AI 漫剧项目存在重复素材引用；拒绝修改。文件已保留。");
      assetIds.add(asset.assetId);
      const path = projectAssetPath(root, record.canvas.id, asset);
      if (!existsSync(path)) throw new Error("AI 漫剧素材文件缺失；项目文件已保留。");
      total += lstatSync(path).size;
      if (total > AI_VIDEO_CANVAS_LIMITS.assetBytes) throw new Error("AI 漫剧账户图片素材超过存储上限；文件已保留。");
    }
  }
  return total;
}

function storedAssetUsage(root: string, records: StoredCanvas[]): { bytes: number; files: number } {
  let total = 0;
  let fileCount = 0;
  for (const record of records) {
    const assetsPath = imageAssetsDirectory(root, record.canvas.id, false);
    if (!existsSync(assetsPath)) continue;
    const directory = opendirSync(assetsPath);
    try {
      while (true) {
        const entry = directory.readSync();
        if (!entry) break;
        fileCount += 1;
        if (fileCount > AI_VIDEO_CANVAS_LIMITS.assetFiles) throw new Error("AI 漫剧图片素材文件数量超过有界读取上限；文件已保留。");
        if (entry.isSymbolicLink() || !entry.isFile()) throw new Error("AI 漫剧素材目录含链接或非文件项；拒绝跟随链接读取。");
        const match = /^([0-9a-f-]{36})\.(png|jpg|webp|mp4|webm|mp3|wav|ogg)$/iu.exec(entry.name);
        if (!match || !UUID_PATTERN.test(match[1])) throw new Error("AI 漫剧图片素材文件名无效；文件已保留。");
        const path = resolve(assetsPath, entry.name);
        assertWithin(assetsPath, path);
        rejectSymlinkOrWrongType(path, "file");
        const size = lstatSync(path).size;
        const maxBytes = ["mp4", "webm", "mp3", "wav", "ogg"].includes(match[2]!.toLocaleLowerCase("en-US")) ? AI_VIDEO_CANVAS_LIMITS.mediaAssetBytes : 16 * 1024 * 1024;
        if (size > maxBytes) throw new Error("AI 漫剧素材超过单文件大小上限；文件已保留。");
        total += size;
      if (total > AI_VIDEO_CANVAS_LIMITS.assetBytes) throw new Error("AI 漫剧账户素材超过存储上限；文件已保留。");
      }
    } finally {
      try { directory.closeSync(); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ERR_DIR_CLOSED") throw error; }
    }
  }
  return { bytes: total, files: fileCount };
}

function parseReferenceImageDataUrl(value: unknown): { bytes: Buffer; mimeType: GeneratedImageMimeType } {
  const match = typeof value === "string" ? /^data:(image\/png|image\/jpeg|image\/webp);base64,([A-Za-z0-9+/]+={0,2})$/u.exec(value) : null;
  if (!match || match[2]!.length > Math.ceil(AI_VIDEO_CANVAS_LIMITS.referenceImageBytes * 4 / 3) + 4) {
    return fail("参考图片仅支持不超过 3 MiB 的 PNG、JPEG 或 WebP 文件。");
  }
  const bytes = Buffer.from(match[2]!, "base64");
  if (!bytes.length || bytes.length > AI_VIDEO_CANVAS_LIMITS.referenceImageBytes || bytes.toString("base64") !== match[2]) {
    return fail("参考图片为空、超过 3 MiB 或 Base64 编码无效。");
  }
  const mimeType = match[1] as GeneratedImageMimeType;
  const { width, height } = imageDimensions(bytes, mimeType);
  if (width < 1 || height < 1 || width > AI_VIDEO_CANVAS_LIMITS.referenceImageDimension || height > AI_VIDEO_CANVAS_LIMITS.referenceImageDimension
    || width * height > AI_VIDEO_CANVAS_LIMITS.referenceImagePixels) {
    return fail("参考图片尺寸不能超过 8192 像素边长或 2000 万像素。");
  }
  return { bytes, mimeType };
}

function removeProjectAssetAfterCommit(root: string, canvasId: string, asset: ProjectAsset): void {
  try {
    const path = projectAssetPath(root, canvasId, asset);
    if (existsSync(path)) unlinkSync(path);
  } catch { /* 清单提交后清理失败不应谎报事务失败；遗留文件仍计入账户素材配额。 */ }
}

function normalizeStoredCanvas(value: unknown): AiVideoCanvas {
  if (!isRecord(value) || Object.keys(value).some(key => !["id", "title", "script", "characters", "locations", "shots", "links", "mediaAssets", "timelineClips", "whiteModel", "canvasLayout", "createdAt", "updatedAt"].includes(key))) {
    throw new Error("AI 漫剧项目画布格式无效；原文件已保留。");
  }
  const normalized = normalizeAiVideoCanvasInput({ title: value.title, script: value.script, characters: value.characters, locations: value.locations, shots: value.shots, links: value.links, timelineClips: value.timelineClips ?? [], ...(value.whiteModel !== undefined ? { whiteModel: value.whiteModel } : {}), ...(value.canvasLayout !== undefined ? { canvasLayout: value.canvasLayout } : {}) });
  const mediaAssets = value.mediaAssets === undefined ? [] : Array.isArray(value.mediaAssets) && value.mediaAssets.length <= AI_VIDEO_CANVAS_LIMITS.assetFiles ? value.mediaAssets.map(normalizeMediaAsset) : fail("项目媒体清单超过上限；原文件已保留。");
  if (new Set(mediaAssets.map(asset => asset.assetId)).size !== mediaAssets.length) throw new Error("项目媒体素材 ID 重复；原文件已保留。");
  const id = normalizedId(value.id, "项目 ID");
  const createdAt = normalizedText(value.createdAt, "创建时间", 40);
  const updatedAt = normalizedText(value.updatedAt, "更新时间", 40);
  if (!Number.isFinite(Date.parse(createdAt)) || !Number.isFinite(Date.parse(updatedAt))) throw new Error("AI 漫剧项目时间无效；原文件已保留。");
  const canvas: AiVideoCanvas = { id, ...normalized, script: normalized.script ?? "", characters: normalized.characters ?? [], locations: normalized.locations ?? [], mediaAssets, timelineClips: normalized.timelineClips ?? [], whiteModel: normalized.whiteModel ?? defaultWhiteModel(), canvasLayout: normalized.canvasLayout ?? normalizeCanvasLayout(undefined), createdAt, updatedAt };
  validateShotReferences(canvas.shots, canvas.characters, canvas.locations);
  validateTimelineAssets(canvas);
  return canvas;
}

function projectFile(canvas: AiVideoCanvas): CanvasProjectFile {
  return { format: PROJECT_FORMAT, formatVersion: PROJECT_FORMAT_VERSION, canvas };
}

function serializedProjectBytes(canvas: AiVideoCanvas): number {
  return Buffer.byteLength(`${JSON.stringify(projectFile(canvas), null, 2)}\n`, "utf8");
}

function readProject(root: string, canvasId: string): StoredCanvas | null {
  const id = normalizedId(canvasId, "项目 ID");
  const directory = projectDirectory(root, id);
  rejectSymlinkOrWrongType(directory, "directory");
  if (!existsSync(directory)) return null;
  const path = projectFilePath(root, id);
  rejectSymlinkOrWrongType(path, "file");
  if (!existsSync(path)) throw new Error("AI 漫剧项目清单缺失；原项目目录已保留。");
  const bytes = readFileSync(path);
  if (bytes.byteLength > AI_VIDEO_CANVAS_LIMITS.storeBytes) throw new Error("AI 漫剧项目文件超过大小限制；原文件已保留。");
  const text = bytes.toString("utf8");
  if (!Buffer.from(text, "utf8").equals(bytes)) throw new Error("AI 漫剧项目文件编码无效；原文件已保留。");
  const raw = JSON.parse(text) as unknown;
  if (!isRecord(raw) || Object.keys(raw).some(key => !["format", "formatVersion", "canvas"].includes(key))
    || raw.format !== PROJECT_FORMAT || typeof raw.formatVersion !== "number" || !SUPPORTED_PROJECT_FORMAT_VERSIONS.has(raw.formatVersion)) {
    throw new Error("AI 漫剧项目格式不受支持；原文件已保留。");
  }
  const canvas = normalizeStoredCanvas(raw.canvas);
  if (canvas.id !== id) throw new Error("AI 漫剧项目目录与清单 ID 不匹配；原文件已保留。");
  return { canvas, bytes: bytes.byteLength };
}

function readProjectCollection(root: string): StoredCanvas[] {
  const ids = new Map<string, string>();
  let scannedRoots = 0;
  for (const candidateRoot of aivideoDirectoryCandidates(root)) {
    if (!existsSync(candidateRoot)) continue;
    scannedRoots += 1;
    if (scannedRoots > 32) throw new Error("AI 漫剧存储位置历史超过有界读取上限；文件已保留。");
    rejectSymlinkOrWrongType(candidateRoot, "directory");
    const directory = opendirSync(candidateRoot);
    let entryCount = 0;
    try {
      while (true) {
        const entry = directory.readSync();
        if (!entry) break;
        entryCount += 1;
        if (entryCount > AI_VIDEO_CANVAS_LIMITS.canvases + 4) throw new Error("AI 漫剧项目目录项超过有界读取上限；文件已保留。");
        if (entry.isSymbolicLink()) throw new Error("AI 漫剧项目目录含符号链接；拒绝跟随链接读取。");
        if (!entry.isDirectory()) continue;
        const id = normalizedId(entry.name, "项目目录名");
        if (ids.has(id)) throw new Error("AI 漫剧画布在多个存储位置重复存在；请先核对文件，拒绝选择性覆盖。");
        ids.set(id, candidateRoot);
        if (ids.size > AI_VIDEO_CANVAS_LIMITS.canvases) throw new Error(`每个账户最多保存 ${AI_VIDEO_CANVAS_LIMITS.canvases} 个分镜项目。`);
      }
    } finally {
      try { directory.closeSync(); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ERR_DIR_CLOSED") throw error; }
    }
  }

  const projects = [...ids.keys()].map(id => readProject(root, id));
  if (projects.some(project => !project)) throw new Error("AI 漫剧项目目录不完整；文件已保留。");
  const records = projects as StoredCanvas[];
  const totalBytes = records.reduce((total, record) => total + record.bytes, 0);
  if (totalBytes > AI_VIDEO_CANVAS_LIMITS.storeBytes) throw new Error("AI 漫剧账户项目总量超过存储上限；文件已保留。");
  return records;
}

function parseLegacyStore(path: string): LegacyCanvasStore {
  rejectSymlinkOrWrongType(path, "file");
  const bytes = readFileSync(path);
  if (bytes.byteLength > AI_VIDEO_CANVAS_LIMITS.storeBytes) throw new Error("旧版分镜画布文件超出大小限制；原文件已保留。");
  const text = bytes.toString("utf8");
  if (!Buffer.from(text, "utf8").equals(bytes)) throw new Error("旧版分镜画布文件编码无效；原文件已保留。");
  const raw = JSON.parse(text) as unknown;
  if (!isRecord(raw) || Object.keys(raw).some(key => !["schemaVersion", "canvases"].includes(key))
    || raw.schemaVersion !== 1 || !Array.isArray(raw.canvases) || raw.canvases.length > AI_VIDEO_CANVAS_LIMITS.canvases) {
    throw new Error("旧版分镜画布文件格式无效；原文件已保留。");
  }
  const canvases = raw.canvases.map(normalizeStoredCanvas);
  if (new Set(canvases.map(canvas => canvas.id)).size !== canvases.length) throw new Error("旧版分镜画布 ID 重复；原文件已保留。");
  return { schemaVersion: 1, canvases };
}

function writeProject(root: string, canvas: AiVideoCanvas): void {
  const directory = projectDirectory(root, canvas.id);
  const path = projectFilePath(root, canvas.id);
  rejectSymlinkOrWrongType(directory, "directory");
  const createdDirectory = !existsSync(directory);
  if (createdDirectory) mkdirSync(directory, { recursive: false, mode: 0o700 });
  try {
    protectPrivateDirectory(directory);
    rejectSymlinkOrWrongType(path, "file");
    atomicWrite(path, projectFile(canvas));
    const readback = readProject(root, canvas.id);
    // 读取时会统一对象字段顺序；比较归一后的内容，避免仅因 JSON 键顺序不同拒绝真实写入。
    if (!readback || !isDeepStrictEqual(readback.canvas, normalizeStoredCanvas(canvas))) throw new Error("AI 漫剧项目写入回读校验失败。");
  } catch (error) {
    if (createdDirectory && existsSync(directory)) rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}

function migrateLegacyStore(root: string): void {
  const legacyPath = resolve(root, LEGACY_FILE_NAME);
  rejectSymlinkOrWrongType(legacyPath, "file");
  if (!existsSync(legacyPath)) return;
  const backupPath = resolve(root, LEGACY_BACKUP_FILE_NAME);
  rejectSymlinkOrWrongType(backupPath, "file");
  if (existsSync(backupPath)) throw new Error("旧版迁移恢复文件已存在；原文件已保留，拒绝覆盖。");

  const legacy = parseLegacyStore(legacyPath);
  const existing = readProjectCollection(root);
  const existingById = new Map(existing.map(record => [record.canvas.id, record]));
  const legacyIds = new Set(legacy.canvases.map(canvas => canvas.id));
  for (const canvas of legacy.canvases) {
    const current = existingById.get(canvas.id);
    if (current && !isDeepStrictEqual(current.canvas, canvas)) {
      throw new Error("旧版与本地项目的同一画布内容冲突；旧文件已保留，拒绝覆盖。");
    }
  }
  const combinedCount = new Set([...existingById.keys(), ...legacyIds]).size;
  if (combinedCount > AI_VIDEO_CANVAS_LIMITS.canvases) throw new Error("旧版迁移后的项目数超出上限；原文件已保留。");
  const projectedBytes = existing.reduce((total, record) => total + record.bytes, 0)
    + legacy.canvases.filter(canvas => !existingById.has(canvas.id)).reduce((total, canvas) => total + serializedProjectBytes(canvas), 0);
  if (projectedBytes > AI_VIDEO_CANVAS_LIMITS.storeBytes) throw new Error("旧版迁移后的项目总量超出上限；原文件已保留。");

  for (const canvas of legacy.canvases) {
    if (!existingById.has(canvas.id)) writeProject(root, canvas);
  }
  for (const canvas of legacy.canvases) {
    const readback = readProject(root, canvas.id);
    if (!readback || !isDeepStrictEqual(readback.canvas, canvas)) throw new Error("旧版分镜迁移回读校验失败；原文件已保留。");
  }
  renameSync(legacyPath, backupPath);
}

function ensureCurrentFormat(userId: string): string {
  const root = ensureAivideoDirectory(userId);
  for (const candidateRoot of aivideoDirectoryCandidates(root)) {
    if (existsSync(candidateRoot)) migrateLegacyStore(candidateRoot);
  }
  return root;
}

function assertProjectCapacity(records: StoredCanvas[], next: AiVideoCanvas, replacingId?: string): void {
  const nextCount = records.length + (replacingId ? 0 : 1);
  if (nextCount > AI_VIDEO_CANVAS_LIMITS.canvases) return fail(`每个账户最多保存 ${AI_VIDEO_CANVAS_LIMITS.canvases} 个分镜项目。`);
  const totalBytes = records.reduce((total, record) => total + (record.canvas.id === replacingId ? 0 : record.bytes), 0) + serializedProjectBytes(next);
  if (totalBytes > AI_VIDEO_CANVAS_LIMITS.storeBytes) return fail("AI 漫剧账户项目总量超过存储上限。");
}

export function listAiVideoCanvases(userId: string): AiVideoCanvas[] {
  return withControlLock(database, () => readProjectCollection(ensureCurrentFormat(userId))
    .map(record => record.canvas)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)));
}

export function createAiVideoCanvas(userId: string, title: unknown): AiVideoCanvas {
  const normalizedTitle = normalizedText(title, "画布名称", 80);
  return withControlLock(database, () => {
    const root = ensureCurrentFormat(userId);
    const records = readProjectCollection(root);
    const now = new Date().toISOString();
    const canvas: AiVideoCanvas = { id: randomUUID(), title: normalizedTitle, script: "", characters: [], locations: [], shots: [], links: [], mediaAssets: [], timelineClips: [], whiteModel: defaultWhiteModel(), canvasLayout: normalizeCanvasLayout(undefined), createdAt: now, updatedAt: now };
    assertProjectCapacity(records, canvas);
    writeProject(root, canvas);
    return canvas;
  });
}

export function updateAiVideoCanvas(userId: string, canvasId: string, expectedUpdatedAt: string, input: unknown): AiVideoCanvas | null {
  const id = normalizedId(canvasId, "项目 ID");
  const expected = normalizedText(expectedUpdatedAt, "预期更新时间", 40);
  const normalized = normalizeAiVideoCanvasInput(input);
  return withControlLock(database, () => {
    const root = ensureCurrentFormat(userId);
    const records = readProjectCollection(root);
    const current = records.find(record => record.canvas.id === id)?.canvas;
    if (!current) return null;
    if (current.updatedAt !== expected) throw new AiVideoCanvasConflictError();
    const currentShots = new Map(current.shots.map(shot => [shot.id, shot]));
    const currentCharacters = new Map(current.characters.map(reference => [reference.id, reference]));
    const currentLocations = new Map(current.locations.map(reference => [reference.id, reference]));
    const nextShotIds = new Set(normalized.shots.map(shot => shot.id));
    if (current.shots.some(shot => shot.videoTask && ["submitting", "queued", "running"].includes(shot.videoTask.status) && !nextShotIds.has(shot.id))) {
      return fail("此项目仍有排队或生成中的视频任务；请先取消排队任务或等待运行结束，再删除镜头。");
    }
    const rawInput = isRecord(input) ? input : {};
    const preserveReferenceImages = (references: AiVideoReference[], existingReferences: Map<string, AiVideoReference>, rawValue: unknown, label: string): AiVideoReference[] => references.map(reference => {
      const existing = existingReferences.get(reference.id);
      if ((reference.imageAssetId && reference.imageAssetId !== existing?.imageAssetId)
        || (reference.imageMimeType && reference.imageMimeType !== existing?.imageMimeType)) return fail(`${label}图片素材引用只能通过认证上传登记。`);
      const rawReferenceValue = Array.isArray(rawValue) ? rawValue.find(item => isRecord(item) && item.id === reference.id) : undefined;
      const rawReference = isRecord(rawReferenceValue) ? rawReferenceValue : undefined;
      return {
        ...reference,
        ...(existing && rawReference?.imageAssetId === undefined && rawReference?.imageMimeType === undefined && existing.imageAssetId && existing.imageMimeType
          ? { imageAssetId: existing.imageAssetId, imageMimeType: existing.imageMimeType } : {})
      };
    });
    const shots = normalized.shots.map(shot => {
      const existing = currentShots.get(shot.id);
      if (shot.imageAssetId && shot.imageAssetId !== existing?.imageAssetId
        || shot.imageMimeType && shot.imageMimeType !== existing?.imageMimeType) return fail("镜头图片素材引用只能由真实生成结果登记。");
      if (shot.videoAssetId && shot.videoAssetId !== existing?.videoAssetId
        || shot.videoMimeType && shot.videoMimeType !== existing?.videoMimeType) return fail("镜头视频素材引用只能由真实生成结果登记。");
      if (shot.videoTask && JSON.stringify(shot.videoTask) !== JSON.stringify(existing?.videoTask)) return fail("视频任务状态只能由真实服务商回执更新。");
      const rawShotValue = Array.isArray(rawInput.shots) ? rawInput.shots.find(item => isRecord(item) && item.id === shot.id) : undefined;
      const rawShot = isRecord(rawShotValue) ? rawShotValue : undefined;
      return {
        ...shot,
        ...(existing && rawShot && rawShot.characterIds === undefined ? { characterIds: existing.characterIds } : {}),
        ...(existing && rawShot && rawShot.locationId === undefined ? { locationId: existing.locationId } : {}),
        ...(existing?.imageAssetId && existing.imageMimeType ? { imageAssetId: existing.imageAssetId, imageMimeType: existing.imageMimeType } : {}),
        ...(existing?.videoAssetId && existing.videoMimeType ? { videoAssetId: existing.videoAssetId, videoMimeType: existing.videoMimeType } : {}),
        ...(existing?.videoTask ? { videoTask: existing.videoTask } : {})
      };
    });
    const canvas: AiVideoCanvas = {
      id,
      ...normalized,
      script: normalized.script ?? current.script,
      characters: normalized.characters === undefined ? current.characters : preserveReferenceImages(normalized.characters, currentCharacters, rawInput.characters, "角色档案"),
      locations: normalized.locations === undefined ? current.locations : preserveReferenceImages(normalized.locations, currentLocations, rawInput.locations, "场景档案"),
      shots,
      mediaAssets: current.mediaAssets,
      timelineClips: normalized.timelineClips ?? current.timelineClips,
      whiteModel: normalized.whiteModel ?? current.whiteModel,
      canvasLayout: normalized.canvasLayout ?? current.canvasLayout,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString()
    };
    validateShotReferences(canvas.shots, canvas.characters, canvas.locations);
    retainTimelineAssets(root, current, canvas);
    validateTimelineAssets(canvas);
    assertProjectCapacity(records, canvas, id);
    writeProject(root, canvas);
    removeUnreferencedAssetsAfterCommit(root, current, canvas);
    return canvas;
  });
}

function persistGeneratedImage(userId: string, canvasId: string, shotId: string, expectedUpdatedAt: string, image: { bytes: Buffer; mimeType: GeneratedImageMimeType }): AiVideoCanvas | null {
  const id = normalizedId(canvasId, "项目 ID");
  const targetShotId = normalizedId(shotId, "镜头 ID");
  let createdAssetPath: string | null = null;
  try {
    return withControlLock(database, () => {
      const root = ensureCurrentFormat(userId);
      const records = readProjectCollection(root);
      const currentRecord = records.find(record => record.canvas.id === id);
      if (!currentRecord) return null;
      const current = currentRecord.canvas;
      if (current.updatedAt !== expectedUpdatedAt) throw new AiVideoCanvasConflictError();
      const oldShot = current.shots.find(shot => shot.id === targetShotId);
      if (!oldShot) throw new Error("镜头已不存在；图片没有写入项目。");
      referencedAssetBytes(root, records);
      const previousImageBytes = oldShot.imageAssetId && oldShot.imageMimeType
        ? lstatSync(imageAssetPath(root, id, oldShot.imageAssetId, oldShot.imageMimeType)).size : 0;
      const usage = storedAssetUsage(root, records);
      if (usage.files - (previousImageBytes ? 1 : 0) + 1 > AI_VIDEO_CANVAS_LIMITS.assetFiles) {
        throw new Error("AI 漫剧图片素材文件数量已达上限；请删除项目或旧图片后重试。");
      }
      if (usage.bytes - previousImageBytes + image.bytes.byteLength > AI_VIDEO_CANVAS_LIMITS.assetBytes) {
        throw new Error("AI 漫剧图片素材空间已满；已生成图片没有保存。");
      }
      const assetId = randomUUID();
      const path = imageAssetPath(root, id, assetId, image.mimeType, true);
      if (existsSync(path)) throw new Error("图片素材 ID 冲突；拒绝覆盖现有文件。");
      atomicWriteBytes(path, image.bytes);
      createdAssetPath = path;
      const now = new Date().toISOString();
      const canvas: AiVideoCanvas = {
        ...current,
        shots: current.shots.map(shot => shot.id === targetShotId ? { ...shot, imageAssetId: assetId, imageMimeType: image.mimeType } : shot),
        updatedAt: now
      };
      retainTimelineAssets(root, current, canvas);
      validateTimelineAssets(canvas);
      assertProjectCapacity(records, canvas, id);
      writeProject(root, canvas);
      createdAssetPath = null;
      removeUnreferencedAssetsAfterCommit(root, current, canvas);
      return canvas;
    });
  } catch (error) {
    if (createdAssetPath && existsSync(createdAssetPath)) {
      try { unlinkSync(createdAssetPath); }
      catch { /* 原始保存错误优先；残留文件会计入后续的素材容量校验。 */ }
    }
    throw error;
  }
}

async function uploadAiVideoReferenceImage(userId: string, canvasId: string, kind: AiVideoReferenceKind, referenceId: string, expectedUpdatedAt: string, dataUrl: unknown, localModels: LocalModelRuntimeService): Promise<AiVideoCanvas | null> {
  const id = normalizedId(canvasId, "项目 ID");
  const targetReferenceId = normalizedId(referenceId, "角色/场景档案 ID");
  if (kind !== "characters" && kind !== "locations") return fail("参考图片类型无效。");
  const expected = normalizedText(expectedUpdatedAt, "预期更新时间", 40);
  const image = parseReferenceImageDataUrl(dataUrl);
  const inputCopy = await localModels.saveWorkspaceAsset(userId, "input", `${kind}-${targetReferenceId}`, image.mimeType, image.bytes);
  let createdAssetPath: string | null = null;
  try {
    const canvas = withControlLock(database, () => {
      const root = ensureCurrentFormat(userId);
      const records = readProjectCollection(root);
      const current = records.find(record => record.canvas.id === id)?.canvas;
      if (!current) return null;
      if (current.updatedAt !== expected) throw new AiVideoCanvasConflictError();
      const references = current[kind];
      const oldReference = references.find(reference => reference.id === targetReferenceId);
      if (!oldReference) throw new Error("角色/场景档案已不存在；图片没有写入项目。");
      referencedAssetBytes(root, records);
      const usage = storedAssetUsage(root, records);
      const previousBytes = oldReference.imageAssetId && oldReference.imageMimeType
        ? lstatSync(imageAssetPath(root, id, oldReference.imageAssetId, oldReference.imageMimeType)).size : 0;
      if (usage.files - (previousBytes ? 1 : 0) + 1 > AI_VIDEO_CANVAS_LIMITS.assetFiles) throw new Error("AI 漫剧图片素材文件数量已达上限；请删除项目或旧图片后重试。");
      if (usage.bytes - previousBytes + image.bytes.byteLength > AI_VIDEO_CANVAS_LIMITS.assetBytes) throw new Error("AI 漫剧图片素材空间已满；参考图片没有保存。");
      const assetId = randomUUID();
      const path = imageAssetPath(root, id, assetId, image.mimeType, true);
      if (existsSync(path)) throw new Error("图片素材 ID 冲突；拒绝覆盖现有文件。");
      atomicWriteBytes(path, image.bytes);
      createdAssetPath = path;
      const canvas: AiVideoCanvas = {
        ...current,
        [kind]: references.map(reference => reference.id === targetReferenceId ? { ...reference, imageAssetId: assetId, imageMimeType: image.mimeType } : reference),
        updatedAt: new Date().toISOString()
      };
      retainTimelineAssets(root, current, canvas);
      validateTimelineAssets(canvas);
      assertProjectCapacity(records, canvas, id);
      writeProject(root, canvas);
      createdAssetPath = null;
      removeUnreferencedAssetsAfterCommit(root, current, canvas);
      return canvas;
    });
    if (!canvas) await localModels.removeWorkspaceAsset(userId, inputCopy);
    return canvas;
  } catch (error) {
    if (createdAssetPath && existsSync(createdAssetPath)) {
      try { unlinkSync(createdAssetPath); }
      catch { /* 原始保存错误优先；残留文件会计入后续素材容量校验。 */ }
    }
    await localModels.removeWorkspaceAsset(userId, inputCopy);
    throw error;
  }
}

export function removeAiVideoReferenceImage(userId: string, canvasId: string, kind: AiVideoReferenceKind, referenceId: string, expectedUpdatedAt: string): AiVideoCanvas | null {
  const id = normalizedId(canvasId, "项目 ID");
  const targetReferenceId = normalizedId(referenceId, "角色/场景档案 ID");
  if (kind !== "characters" && kind !== "locations") return fail("参考图片类型无效。");
  const expected = normalizedText(expectedUpdatedAt, "预期更新时间", 40);
  return withControlLock(database, () => {
    const root = ensureCurrentFormat(userId);
    const records = readProjectCollection(root);
    const current = records.find(record => record.canvas.id === id)?.canvas;
    if (!current) return null;
    if (current.updatedAt !== expected) throw new AiVideoCanvasConflictError();
    const references = current[kind];
    const existing = references.find(reference => reference.id === targetReferenceId);
    if (!existing) throw new Error("角色/场景档案已不存在。");
    if (!existing.imageAssetId || !existing.imageMimeType) return current;
    const withoutImage = (reference: AiVideoReference): AiVideoReference => Object.fromEntries(
      Object.entries(reference).filter(([key]) => key !== "imageAssetId" && key !== "imageMimeType")
    ) as AiVideoReference;
    const canvas: AiVideoCanvas = {
      ...current,
      [kind]: references.map(reference => reference.id === targetReferenceId ? withoutImage(reference) : reference),
      updatedAt: new Date().toISOString()
    };
    retainTimelineAssets(root, current, canvas);
    validateTimelineAssets(canvas);
    assertProjectCapacity(records, canvas, id);
    writeProject(root, canvas);
    removeUnreferencedAssetsAfterCommit(root, current, canvas);
    return canvas;
  });
}

function listMediaAssets(userId: string, canvasId: string): AiVideoMediaAssetSummary[] | null {
  const id = normalizedId(canvasId, "项目 ID");
  return withControlLock(database, () => {
    const root = ensureCurrentFormat(userId);
    const canvas = readProject(root, id)?.canvas;
    if (!canvas) return null;
    const known = new Map(canvas.mediaAssets.map(asset => [asset.assetId, asset]));
    return projectAssetsWithVideo(canvas).map(asset => {
      const path = projectAssetPath(root, id, asset);
      const available = existsSync(path);
      const stat = available ? lstatSync(path) : null;
      const stored = known.get(asset.assetId);
      const shot = canvas.shots.find(item => item.imageAssetId === asset.assetId || item.videoAssetId === asset.assetId);
      const reference = [...canvas.characters, ...canvas.locations].find(item => item.imageAssetId === asset.assetId);
      const name = stored?.name ?? (shot ? `${shot.title} ${asset.mimeType.startsWith("video/") ? "视频" : "图片"}` : reference ? `${reference.name} 参考图` : "项目媒体");
      return {
        assetId: asset.assetId,
        name,
        mimeType: asset.mimeType,
        bytes: stat?.size ?? stored?.bytes ?? 0,
        createdAt: stored?.createdAt ?? stat?.mtime.toISOString() ?? canvas.updatedAt,
        origin: stored?.origin ?? "generated",
        available
      };
    }).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  });
}

function saveMediaAsset(userId: string, canvasId: string, expectedUpdatedAt: string, nameInput: unknown, mimeInput: unknown, bytes: Buffer, origin: "imported" | "export"): { canvas: AiVideoCanvas; asset: AiVideoMediaAsset } | null {
  const id = normalizedId(canvasId, "项目 ID");
  const expected = normalizedText(expectedUpdatedAt, "预期更新时间", 40);
  const mimeValue = typeof mimeInput === "string" ? mimeInput.split(";", 1)[0]!.trim().toLocaleLowerCase("en-US") : "";
  const mimeType = MEDIA_MIME_TYPES.has(mimeValue as AiVideoMediaMimeType) ? mimeValue as AiVideoMediaMimeType : fail("媒体类型无效。" );
  if (origin === "export" && mimeType !== "video/mp4" && mimeType !== "video/webm") return fail("导出只支持浏览器已生成的 MP4 或 WebM 文件。" );
  validateMediaBytes(bytes, mimeType);
  const rawName = typeof nameInput === "string" ? nameInput.split(/[\\/]/u).pop() : "";
  const cleanedName = normalizedText(rawName, "媒体名称", 120).replace(/[\\/:*?"<>|\u0000-\u001f]/gu, "_") || `媒体素材.${MEDIA_EXTENSIONS[mimeType]}`;
  let createdAssetPath: string | null = null;
  try {
    const result = withControlLock(database, () => {
      const root = ensureCurrentFormat(userId);
      const records = readProjectCollection(root);
      const record = records.find(item => item.canvas.id === id);
      if (!record) return null;
      const current = record.canvas;
      if (current.updatedAt !== expected) throw new AiVideoCanvasConflictError();
      referencedAssetBytes(root, records);
      const usage = storedAssetUsage(root, records);
      if (usage.files + 1 > AI_VIDEO_CANVAS_LIMITS.assetFiles) throw new Error("项目媒体文件数量已达上限；请先删除不再使用的素材。" );
      if (usage.bytes + bytes.byteLength > AI_VIDEO_CANVAS_LIMITS.assetBytes) throw new Error("账户媒体空间已满；没有保存该文件。" );
      const asset: AiVideoMediaAsset = { assetId: randomUUID(), name: cleanedName, mimeType, bytes: bytes.byteLength, createdAt: new Date().toISOString(), origin };
      const path = projectAssetPath(root, id, asset, true);
      if (existsSync(path)) throw new Error("媒体素材 ID 冲突；拒绝覆盖现有文件。" );
      atomicWriteBytes(path, bytes);
      createdAssetPath = path;
      const canvas: AiVideoCanvas = { ...current, mediaAssets: [...current.mediaAssets, asset], updatedAt: asset.createdAt };
      assertProjectCapacity(records, canvas, id);
      writeProject(root, canvas);
      createdAssetPath = null;
      return { canvas, asset };
    });
    return result;
  } catch (error) {
    if (createdAssetPath && existsSync(createdAssetPath)) {
      try { unlinkSync(createdAssetPath); }
      catch { /* 原始写入错误优先；残留文件仍进入账户容量统计。 */ }
    }
    throw error;
  }
}

async function importMediaAsset(userId: string, canvasId: string, expectedUpdatedAt: string, name: unknown, mimeType: unknown, bytes: Buffer, localModels: LocalModelRuntimeService): Promise<AiVideoCanvas | null> {
  const inputCopy = await localModels.saveWorkspaceAsset(userId, "input", String(name), String(mimeType ?? ""), bytes);
  try {
    const canvas = saveMediaAsset(userId, canvasId, expectedUpdatedAt, name, mimeType, bytes, "imported")?.canvas ?? null;
    if (!canvas) await localModels.removeWorkspaceAsset(userId, inputCopy);
    return canvas;
  } catch (error) {
    await localModels.removeWorkspaceAsset(userId, inputCopy);
    throw error;
  }
}

function saveExportAsset(userId: string, canvasId: string, expectedUpdatedAt: string, bytes: Buffer, mimeType: unknown): { canvas: AiVideoCanvas; asset: AiVideoMediaAsset } | null {
  const now = new Date().toISOString().replace(/[:.]/gu, "-");
  return saveMediaAsset(userId, canvasId, expectedUpdatedAt, `漫剧导出-${now}`, mimeType, bytes, "export");
}

async function uploadShotImage(userId: string, canvasId: string, shotId: string, expectedUpdatedAt: string, bytes: Buffer, mimeInput: unknown, localModels: LocalModelRuntimeService): Promise<AiVideoCanvas | null> {
  const mimeType = typeof mimeInput === "string" && IMAGE_MIME_TYPES.has(mimeInput as AiVideoMediaMimeType) ? mimeInput as GeneratedImageMimeType : fail("镜头参考图只支持 PNG、JPEG 或 WebP。" );
  if (bytes.byteLength > AI_VIDEO_CANVAS_LIMITS.referenceImageBytes) return fail("镜头参考图不能超过 3 MiB。" );
  validateMediaBytes(bytes, mimeType);
  const id = normalizedId(canvasId, "项目 ID");
  const shotIdValue = normalizedId(shotId, "镜头 ID");
  const expected = normalizedText(expectedUpdatedAt, "预期更新时间", 40);
  const inputCopy = await localModels.saveWorkspaceAsset(userId, "input", `shot-reference${MEDIA_EXTENSIONS[mimeType]}`, mimeType, bytes);
  let createdPath: string | null = null;
  try {
    const canvas = withControlLock(database, () => {
      const root = ensureCurrentFormat(userId);
      const records = readProjectCollection(root);
      const current = records.find(item => item.canvas.id === id)?.canvas;
      if (!current) return null;
      if (current.updatedAt !== expected) throw new AiVideoCanvasConflictError();
      const shot = current.shots.find(item => item.id === shotIdValue);
      if (!shot) throw new Error("镜头已不存在；图片没有写入项目。" );
      if (current.mediaAssets.length >= AI_VIDEO_CANVAS_LIMITS.assetFiles) throw new Error("项目媒体清单已达上限。" );
      const usage = storedAssetUsage(root, records);
      if (usage.files + 1 > AI_VIDEO_CANVAS_LIMITS.assetFiles || usage.bytes + bytes.byteLength > AI_VIDEO_CANVAS_LIMITS.assetBytes) throw new Error("项目媒体配额不足；图片没有保存。" );
      const assetId = randomUUID();
      const path = imageAssetPath(root, id, assetId, mimeType, true);
      atomicWriteBytes(path, bytes);
      createdPath = path;
      const createdAt = new Date().toISOString();
      const asset: AiVideoMediaAsset = { assetId, name: `${shot.title} 取景图`, mimeType, bytes: bytes.byteLength, createdAt, origin: "imported" };
      const canvas: AiVideoCanvas = {
        ...current,
        mediaAssets: [...current.mediaAssets, asset],
        shots: current.shots.map(item => item.id === shotIdValue ? { ...item, imageAssetId: assetId, imageMimeType: mimeType } : item),
        updatedAt: createdAt
      };
      retainTimelineAssets(root, current, canvas);
      validateTimelineAssets(canvas);
      assertProjectCapacity(records, canvas, id);
      writeProject(root, canvas);
      createdPath = null;
      removeUnreferencedAssetsAfterCommit(root, current, canvas);
      return canvas;
    });
    if (!canvas) await localModels.removeWorkspaceAsset(userId, inputCopy);
    return canvas;
  } catch (error) {
    if (createdPath && existsSync(createdPath)) {
      try { unlinkSync(createdPath); }
      catch { /* 保留原始保存错误；遗留文件仍进入容量统计。 */ }
    }
    await localModels.removeWorkspaceAsset(userId, inputCopy);
    throw error;
  }
}

function removeMediaAsset(userId: string, canvasId: string, assetId: string, expectedUpdatedAt: string): AiVideoCanvas | null {
  const id = normalizedId(canvasId, "项目 ID");
  const targetId = normalizedId(assetId, "媒体素材 ID");
  const expected = normalizedText(expectedUpdatedAt, "预期更新时间", 40);
  return withControlLock(database, () => {
    const root = ensureCurrentFormat(userId);
    const records = readProjectCollection(root);
    const current = records.find(record => record.canvas.id === id)?.canvas;
    if (!current) return null;
    if (current.updatedAt !== expected) throw new AiVideoCanvasConflictError();
    const asset = current.mediaAssets.find(item => item.assetId === targetId);
    if (!asset) throw new Error("只有媒体库登记的项目素材可以删除。" );
    const referencedByProject = [...current.shots, ...current.characters, ...current.locations].some(item => item.imageAssetId === targetId || "videoAssetId" in item && item.videoAssetId === targetId);
    const referencedByTimeline = current.timelineClips.some(clip => clip.assetId === targetId);
    if (referencedByProject || referencedByTimeline) throw new Error("该素材仍被角色、场景、镜头或时间线使用；请先移除引用。" );
    const canvas: AiVideoCanvas = { ...current, mediaAssets: current.mediaAssets.filter(item => item.assetId !== targetId), updatedAt: new Date().toISOString() };
    assertProjectCapacity(records, canvas, id);
    writeProject(root, canvas);
    removeProjectAssetAfterCommit(root, id, asset);
    return canvas;
  });
}

function validateMediaBytes(bytes: Buffer, mimeType: AiVideoMediaMimeType): void {
  if (!Buffer.isBuffer(bytes) || bytes.byteLength < 12 || bytes.byteLength > AI_VIDEO_CANVAS_LIMITS.mediaAssetBytes) return fail("媒体文件为空或超过 128 MiB。" );
  if (IMAGE_MIME_TYPES.has(mimeType)) {
    if (bytes.byteLength > AI_VIDEO_CANVAS_LIMITS.imageAssetBytes) return fail("图片素材不能超过 16 MiB。" );
    const { width, height } = imageDimensions(bytes, mimeType as GeneratedImageMimeType);
    if (width < 1 || height < 1 || width > AI_VIDEO_CANVAS_LIMITS.referenceImageDimension || height > AI_VIDEO_CANVAS_LIMITS.referenceImageDimension || width * height > AI_VIDEO_CANVAS_LIMITS.referenceImagePixels) return fail("图片尺寸不能超过 8192 像素边长或 2000 万像素。" );
    return;
  }
  if (mimeType === "video/mp4" && bytes.toString("ascii", 4, 8) === "ftyp") return;
  if (mimeType === "video/webm" && bytes.toString("hex", 0, 4) === "1a45dfa3") return;
  if (mimeType === "audio/wav" && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WAVE") return;
  if (mimeType === "audio/ogg" && bytes.toString("ascii", 0, 4) === "OggS") return;
  if (mimeType === "audio/mpeg" && (bytes.toString("ascii", 0, 3) === "ID3" || bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0)) return;
  return fail("媒体文件内容与所选图片、视频或音频格式不一致。" );
}

function readGeneratedImage(userId: string, canvasId: string, assetId: string): { bytes: Buffer; mimeType: AiVideoMediaMimeType } | null {
  const id = normalizedId(canvasId, "项目 ID");
  const imageId = normalizedId(assetId, "图片素材 ID");
  return withControlLock(database, () => {
    const root = ensureCurrentFormat(userId);
    const record = readProject(root, id);
    if (!record) return null;
    const asset = projectAssetsWithVideo(record.canvas).find(item => item.assetId === imageId);
    if (!asset) return null;
    const path = projectAssetPath(root, id, asset);
    if (!existsSync(path)) return null;
    const maxBytes = VIDEO_MIME_TYPES.has(asset.mimeType) || AUDIO_MIME_TYPES.has(asset.mimeType) ? AI_VIDEO_CANVAS_LIMITS.mediaAssetBytes : AI_VIDEO_CANVAS_LIMITS.imageAssetBytes;
    if (lstatSync(path).size > maxBytes) throw new Error("AI 漫剧素材超过读取上限；项目文件已保留。");
    return { bytes: readFileSync(path), mimeType: asset.mimeType };
  });
}

function openMediaAsset(userId: string, canvasId: string, assetId: string, rangeHeader?: string): { stream?: ReadStream; mimeType: AiVideoMediaMimeType; size: number; start?: number; end?: number; rangeNotSatisfiable?: boolean } | null {
  const id = normalizedId(canvasId, "项目 ID");
  const targetAssetId = normalizedId(assetId, "媒体素材 ID");
  return withControlLock(database, () => {
    const root = ensureCurrentFormat(userId);
    const canvas = readProject(root, id)?.canvas;
    if (!canvas) return null;
    const asset = projectAssetsWithVideo(canvas).find(item => item.assetId === targetAssetId);
    if (!asset) return null;
    const path = projectAssetPath(root, id, asset);
    if (!existsSync(path)) return null;
    const size = lstatSync(path).size;
    const maximum = VIDEO_MIME_TYPES.has(asset.mimeType) || AUDIO_MIME_TYPES.has(asset.mimeType) ? AI_VIDEO_CANVAS_LIMITS.mediaAssetBytes : AI_VIDEO_CANVAS_LIMITS.imageAssetBytes;
    if (size < 1 || size > maximum) throw new Error("AI 漫剧素材超过读取上限；项目文件已保留。");
    let start = 0;
    let end = size - 1;
    if (rangeHeader) {
      const match = /^bytes=(\d*)-(\d*)$/u.exec(rangeHeader.trim());
      if (!match) return { mimeType: asset.mimeType, size, rangeNotSatisfiable: true };
      if (!match[1] && !match[2]) return { mimeType: asset.mimeType, size, rangeNotSatisfiable: true };
      if (!match[1]) {
        const suffix = Number(match[2]);
        if (!Number.isSafeInteger(suffix) || suffix <= 0) return { mimeType: asset.mimeType, size, rangeNotSatisfiable: true };
        start = Math.max(0, size - suffix);
      } else {
        start = Number(match[1]);
        end = match[2] ? Number(match[2]) : size - 1;
      }
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= size || end >= size) return { mimeType: asset.mimeType, size, rangeNotSatisfiable: true };
    }
    return { stream: createReadStream(path, { start, end }), mimeType: asset.mimeType, size, start, end };
  });
}

async function generateShotImage(userId: string, canvasId: string, shotId: string, expectedUpdatedAt: string, credentials: CredentialConsumer, localModels: LocalModelRuntimeService, signal?: AbortSignal): Promise<AiVideoCanvas | null> {
  signal?.throwIfAborted();
  const id = normalizedId(canvasId, "项目 ID");
  const targetShotId = normalizedId(shotId, "镜头 ID");
  const expected = normalizedText(expectedUpdatedAt, "预期更新时间", 40);
  const target = withControlLock(database, (): AiVideoImageGenerationTarget | null => {
    const root = ensureCurrentFormat(userId);
    const records = readProjectCollection(root);
    const record = records.find(item => item.canvas.id === id);
    if (!record) return null;
    if (record.canvas.updatedAt !== expected) throw new AiVideoCanvasConflictError();
    const shot = record.canvas.shots.find(item => item.id === targetShotId);
    if (!shot) throw new Error("找不到当前分镜板中的镜头。");
    if (!shot.description.trim()) throw new Error("请先填写镜头的画面与动作，再生成图片。");
    const settings = getUserSettings(userId).aiRuntime;
    const generationMode = settings.imageGenerationMode === "local" ? "local" : "provider";
    const accountId = settings.imageGenerationAccountId;
    const modelId = settings.imageGenerationModelId;
    const localModelId = settings.imageGenerationLocalModelId;
    const account = generationMode === "provider" ? listAiAccounts(userId).find(item => item.id === accountId) : undefined;
    if (generationMode === "local" && !localModelId) throw new Error("请先在设置中心选择已登记的本机生图模型。");
    if (generationMode === "provider" && (!accountId || !modelId)) throw new Error("请先在设置中心选择 AI 漫剧图片模型账户和模型 ID。");
    if (generationMode === "provider" && !account?.hasSecret) throw new Error("设置中心找不到所选图片模型账户或其密钥已删除。");
    if (generationMode === "provider" && account?.providerId !== "openai" && account?.providerId !== "doubao" && account?.providerId !== "ark-agent-plan") throw new Error("AI 漫剧图片生成只支持 OpenAI、豆包/火山方舟或 Agent Plan 图片账户。");
    const selectedImageModel = account?.models.find(item => item.id === modelId);
    if (generationMode === "provider" && (!selectedImageModel || account?.providerId === "ark-agent-plan" && selectedImageModel.taskType !== "image-generation")) throw new Error("所选图片模型不在当前账户图片能力目录中，请重新选择。");
    const previousImageBytes = shot.imageAssetId && shot.imageMimeType
      ? lstatSync(imageAssetPath(root, id, shot.imageAssetId, shot.imageMimeType)).size : 0;
      referencedAssetBytes(root, records);
      const usage = storedAssetUsage(root, records);
    if (usage.files - (previousImageBytes ? 1 : 0) + 1 > AI_VIDEO_CANVAS_LIMITS.assetFiles) {
      throw new Error("AI 漫剧图片素材文件数量已达上限；请删除项目或旧图片后重试。");
    }
    if (usage.bytes - previousImageBytes + 1 > AI_VIDEO_CANVAS_LIMITS.assetBytes) {
      throw new Error("AI 漫剧图片素材空间已满；请删除项目或旧图片后重试。");
    }
    const characterPrompts = shot.characterIds.map(referenceId => record.canvas.characters.find(reference => reference.id === referenceId))
      .filter((reference): reference is AiVideoReference => Boolean(reference))
      .map(reference => `角色「${reference.name}」：${reference.description}`);
    const characters = shot.characterIds.map(referenceId => record.canvas.characters.find(reference => reference.id === referenceId))
      .filter((reference): reference is AiVideoReference => Boolean(reference));
    const location = shot.locationId ? record.canvas.locations.find(reference => reference.id === shot.locationId) : undefined;
    const prompt = [shot.description, ...characterPrompts, ...(location ? [`场景「${location.name}」：${location.description}`] : [])].filter(Boolean).join("\n\n");
    const references = [...characters, ...(location ? [location] : [])].filter(reference => reference.imageAssetId && reference.imageMimeType);
    const referenceImages = references.map(reference => {
      const path = imageAssetPath(root, id, reference.imageAssetId!, reference.imageMimeType!);
      if (!existsSync(path)) throw new Error(`角色或场景「${reference.name}」的参考图片文件缺失，未向模型发送不完整素材。`);
      const bytes = readFileSync(path);
      if (bytes.byteLength > AI_VIDEO_CANVAS_LIMITS.referenceImageBytes) throw new Error(`角色或场景「${reference.name}」的参考图片超过本次模型输入上限。`);
      return { bytes, mimeType: reference.imageMimeType! };
    });
    if (generationMode === "local" && referenceImages.length) throw new Error("当前登记的 MOSS-Image 适配只支持文字生图；请移除镜头关联角色/场景的参考图片，或切回 Provider 模式。");
    return generationMode === "local"
      ? { generationMode: "local", prompt, modelId: localModelId!, timeoutMs: settings.imageGenerationLocalTimeoutSeconds * 1_000, unloadAfterMs: settings.imageGenerationUnloadAfterMinutes * 60_000 }
      : { generationMode: "provider", prompt, referenceImages, accountId: accountId!, modelId: modelId!, providerId: account!.providerId as ImageGenerationProvider, timeoutMs: settings.requestTimeoutSeconds * 1_000 };
  });
  if (!target) return null;
  let image: { bytes: Buffer; mimeType: GeneratedImageMimeType };
  if (target.generationMode === "local") {
    image = await localModels.generateImage({ modelId: target.modelId, prompt: target.prompt, timeoutMs: target.timeoutMs, unloadAfterMs: target.unloadAfterMs, ...(signal ? { signal } : {}) });
  } else {
    const apiKey = credentials.resolve(userId, credentialReference("lfaa-settings", target.accountId));
    if (!apiKey) throw new Error("设置中心的图像模型账户密钥不可用。");
    image = await generateProviderImage({ providerId: target.providerId, modelId: target.modelId, apiKey, prompt: target.prompt, referenceImages: target.referenceImages, timeoutMs: target.timeoutMs, ...(signal ? { signal } : {}) });
  }
  signal?.throwIfAborted();
  if (target.generationMode !== "local") return persistGeneratedImage(userId, id, targetShotId, expected, image);
  const outputCopy = await localModels.saveWorkspaceAsset(userId, "output", `${target.modelId}-${targetShotId}`, image.mimeType, image.bytes);
  try {
    const canvas = persistGeneratedImage(userId, id, targetShotId, expected, image);
    if (!canvas) await localModels.removeWorkspaceAsset(userId, outputCopy);
    return canvas;
  } catch (error) {
    await localModels.removeWorkspaceAsset(userId, outputCopy);
    throw error;
  }
}

function persistVideoTaskState(userId: string, canvasId: string, shotId: string, localId: string, taskUpdate: Partial<AiVideoTask>, video?: Buffer): AiVideoCanvas | null {
  let createdAssetPath: string | null = null;
  try {
    return withControlLock(database, () => {
      const root = ensureCurrentFormat(userId);
      const records = readProjectCollection(root);
      const current = records.find(record => record.canvas.id === canvasId)?.canvas;
      if (!current) return null;
      const shot = current.shots.find(item => item.id === shotId);
      if (!shot?.videoTask || shot.videoTask.localId !== localId) return current;
      if (["succeeded", "failed", "cancelled", "expired"].includes(shot.videoTask.status) && taskUpdate.status && taskUpdate.status !== shot.videoTask.status) return current;
      let videoAssetId = shot.videoAssetId;
      let videoMimeType = shot.videoMimeType;
      if (video) {
        if (video.byteLength < 16 || video.byteLength > AI_VIDEO_CANVAS_LIMITS.videoAssetBytes || video.toString("ascii", 4, 8) !== "ftyp") {
          throw new Error("视频结果不是有效的 MP4 或超过 128 MiB；项目没有登记该成片。");
        }
        referencedAssetBytes(root, records);
        const usage = storedAssetUsage(root, records);
        const previousBytes = videoAssetId && videoMimeType ? lstatSync(projectAssetPath(root, canvasId, { assetId: videoAssetId, mimeType: videoMimeType })).size : 0;
        if (usage.files - (previousBytes ? 1 : 0) + 1 > AI_VIDEO_CANVAS_LIMITS.assetFiles) throw new Error("AI 漫剧素材文件数量已达上限；请删除旧素材后重试。");
        if (usage.bytes - previousBytes + video.byteLength > AI_VIDEO_CANVAS_LIMITS.assetBytes) throw new Error("AI 漫剧账户素材空间不足；没有登记视频成片。");
        videoAssetId = randomUUID();
        videoMimeType = "video/mp4";
        const path = projectAssetPath(root, canvasId, { assetId: videoAssetId, mimeType: videoMimeType }, true);
        if (existsSync(path)) throw new Error("视频素材 ID 冲突；拒绝覆盖现有文件。");
        atomicWriteBytes(path, video);
        createdAssetPath = path;
      }
      const now = new Date().toISOString();
      const videoTask: AiVideoTask = { ...shot.videoTask, ...taskUpdate, updatedAt: now };
      const canvas: AiVideoCanvas = {
        ...current,
        shots: current.shots.map(item => item.id === shotId ? {
          ...item,
          ...(videoAssetId && videoMimeType ? { videoAssetId, videoMimeType } : {}),
          videoTask
        } : item),
        updatedAt: video ? now : current.updatedAt
      };
      retainTimelineAssets(root, current, canvas);
      validateTimelineAssets(canvas);
      assertProjectCapacity(records, canvas, canvasId);
      writeProject(root, canvas);
      createdAssetPath = null;
      if (video) removeUnreferencedAssetsAfterCommit(root, current, canvas);
      return canvas;
    });
  } catch (error) {
    if (createdAssetPath && existsSync(createdAssetPath)) {
      try { unlinkSync(createdAssetPath); }
      catch { /* 保留原始错误；遗留文件仍受账户素材容量扫描约束。 */ }
    }
    throw error;
  }
}

async function startShotVideo(userId: string, canvasId: string, shotId: string, expectedUpdatedAt: string, credentials: CredentialConsumer, localModels: LocalModelRuntimeService, signal?: AbortSignal): Promise<AiVideoCanvas | null> {
  signal?.throwIfAborted();
  const id = normalizedId(canvasId, "项目 ID");
  const targetShotId = normalizedId(shotId, "镜头 ID");
  const expected = normalizedText(expectedUpdatedAt, "预期更新时间", 40);
  const target = withControlLock(database, () => {
    const root = ensureCurrentFormat(userId);
    const records = readProjectCollection(root);
    const current = records.find(record => record.canvas.id === id)?.canvas;
    if (!current) return null;
    if (current.updatedAt !== expected) throw new AiVideoCanvasConflictError();
    const shot = current.shots.find(item => item.id === targetShotId);
    if (!shot) throw new Error("找不到当前项目中的镜头。");
    if (!shot.description.trim()) throw new Error("请先填写镜头画面与动作，再生成视频。");
    if (shot.videoTask && ["submitting", "queued", "running"].includes(shot.videoTask.status)) throw new Error("此镜头已有排队或生成中的视频任务。");
    const activeTaskCount = records.reduce((total, record) => total + record.canvas.shots.filter(item => item.videoTask && ["submitting", "queued", "running"].includes(item.videoTask.status)).length, 0);
    if (activeTaskCount >= AI_VIDEO_CANVAS_LIMITS.activeVideoTasks) throw new Error(`当前账户最多同时排队或运行 ${AI_VIDEO_CANVAS_LIMITS.activeVideoTasks} 个视频任务。`);
    const settings = getUserSettings(userId).aiRuntime;
    const generationMode = settings.videoGenerationMode === "local" ? "local" : "provider";
    const accountId = generationMode === "provider" ? settings.videoGenerationAccountId : "local";
    const modelId = generationMode === "provider" ? settings.videoGenerationModelId : settings.videoGenerationLocalModelId;
    if (!modelId || generationMode === "provider" && !accountId) throw new Error(generationMode === "local" ? "请先在设置中心选择已登记的本机视频模型。" : "请先在设置中心选择火山方舟视频账户和模型。");
    const account = generationMode === "provider" ? listAiAccounts(userId).find(item => item.id === accountId) : undefined;
    if (generationMode === "provider" && (!account?.hasSecret || account.providerId !== "doubao" && account.providerId !== "ark-agent-plan")) throw new Error("设置中心找不到所选火山方舟视频账户或密钥已删除。");
    const selectedVideoModel = account?.models.find(item => item.id === modelId);
    if (generationMode === "provider" && (!selectedVideoModel || account?.providerId === "ark-agent-plan" && (selectedVideoModel.taskType !== "video-generation"
      || Boolean(selectedVideoModel.planTiers?.length && account.options.planTier !== "unknown" && account.options.planTier && !selectedVideoModel.planTiers.includes(account.options.planTier as NonNullable<typeof selectedVideoModel.planTiers>[number]))))) throw new Error("视频模型不属于当前 Agent Plan 档位的可用视频目录，请重新选择套餐档位或模型。");
    if (generationMode === "local" && (settings.videoGenerationDurationSeconds < 5 || settings.videoGenerationDurationSeconds > 15)) throw new Error("当前本机 MiniMax-H3 适配只接受 5 至 15 秒视频；请在设置中心调整时长或切换远程 Provider。");
    const characters = shot.characterIds.map(referenceId => current.characters.find(reference => reference.id === referenceId)).filter((reference): reference is AiVideoReference => Boolean(reference));
    const location = shot.locationId ? current.locations.find(reference => reference.id === shot.locationId) : undefined;
    const promptParts = [
      shot.description,
      shot.dialogue ? `对白与声音：${shot.dialogue}` : "",
      ...characters.map(reference => `角色「${reference.name}」：${reference.description}`),
      ...(location ? [`场景「${location.name}」：${location.description}`] : [])
    ].filter(Boolean);
    const prompt = promptParts.join("\n\n");
    if (prompt.length > 5_000) throw new Error("镜头、对白、角色和场景描述合并后超过视频提示词上限；请精简项目资料。");
    const references = [...characters, ...(location ? [location] : [])].filter(reference => reference.imageAssetId && reference.imageMimeType);
    const referenceImages = references.map(reference => {
      const path = imageAssetPath(root, id, reference.imageAssetId!, reference.imageMimeType!);
      if (!existsSync(path)) throw new Error(`角色或场景「${reference.name}」的本机参考图缺失。`);
      const bytes = readFileSync(path);
      if (bytes.byteLength > AI_VIDEO_CANVAS_LIMITS.referenceImageBytes) throw new Error(`角色或场景「${reference.name}」的参考图超过视频模型输入上限。`);
      return { bytes, mimeType: reference.imageMimeType! };
    });
    if (generationMode === "local" && referenceImages.length > 1) throw new Error("当前本机 MiniMax-H3 适配只接收一张首帧图；请减少角色/场景参考图片，或切换远程 Provider。");
    const apiKey = generationMode === "provider" ? credentials.resolve(userId, credentialReference("lfaa-settings", accountId)) : null;
    if (generationMode === "provider" && !apiKey) throw new Error("设置中心的火山方舟账户密钥不可用。");
    const now = new Date().toISOString();
    const localId = randomUUID();
    const task: AiVideoTask = { localId, accountId, modelId, status: generationMode === "local" ? "running" : "submitting", ...(generationMode === "local" ? { providerTaskId: `lfaa-local:${localId}` } : {}), createdAt: now, updatedAt: now };
    const reserved: AiVideoCanvas = {
      ...current,
      shots: current.shots.map(item => item.id === targetShotId ? { ...item, videoTask: task } : item),
      updatedAt: now
    };
    assertProjectCapacity(records, reserved, id);
    writeProject(root, reserved);
    const targetData = {
      task,
      prompt,
      referenceImages,
      durationSeconds: settings.videoGenerationDurationSeconds,
      timeoutMs: generationMode === "local" ? settings.videoGenerationLocalTimeoutSeconds * 1_000 : settings.requestTimeoutSeconds * 1_000,
      canvas: reserved
    };
    return generationMode === "local"
      ? { ...targetData, mode: "local" as const, ratio: settings.videoGenerationRatio === "adaptive" ? current.whiteModel.ratio : settings.videoGenerationRatio, unloadAfterMs: settings.videoGenerationUnloadAfterMinutes * 60_000 }
      : { ...targetData, mode: "provider" as const, apiKey: apiKey!, providerId: account!.providerId as ArkVideoProviderId, ratio: settings.videoGenerationRatio, resolution: settings.videoGenerationResolution, generateAudio: settings.videoGenerationGenerateAudio, watermark: settings.videoGenerationWatermark };
  });
  if (!target) return null;
  if (target.mode === "local") {
    const taskKey = videoTaskKey(userId, id, targetShotId, target.task.localId);
    const controller = new AbortController();
    localVideoJobs.set(taskKey, controller);
    void localModels.generateVideo({
      modelId: target.task.modelId,
      prompt: target.prompt,
      durationSeconds: target.durationSeconds,
      aspectRatio: target.ratio,
      referenceImages: target.referenceImages,
      timeoutMs: target.timeoutMs,
      unloadAfterMs: target.unloadAfterMs,
      signal: controller.signal
    }).then(async result => {
      if (controller.signal.aborted) {
        persistVideoTaskState(userId, id, targetShotId, target.task.localId, { status: "cancelled", error: "" });
        return;
      }
      const outputCopy = await localModels.saveWorkspaceAsset(userId, "output", `${target.task.modelId}-${targetShotId}`, result.mimeType, result.bytes);
      try {
        const canvas = persistVideoTaskState(userId, id, targetShotId, target.task.localId, { status: "succeeded", error: "" }, result.bytes);
        const committed = canvas?.shots.some(shot => shot.id === targetShotId && shot.videoTask?.localId === target.task.localId && shot.videoTask.status === "succeeded" && Boolean(shot.videoAssetId));
        if (!committed) await localModels.removeWorkspaceAsset(userId, outputCopy);
      } catch (error) {
        await localModels.removeWorkspaceAsset(userId, outputCopy);
        throw error;
      }
    }).catch(error => {
      const cancelled = controller.signal.aborted || error instanceof DOMException && error.name === "AbortError";
      const message = cancelled ? "" : error instanceof Error ? error.message.slice(0, 1_000) : "本机视频生成失败。";
      persistVideoTaskState(userId, id, targetShotId, target.task.localId, { status: cancelled ? "cancelled" : "failed", error: message });
    }).finally(() => localVideoJobs.delete(taskKey));
    watchSubmittedVideoTask?.(userId, id, targetShotId, target.task.localId);
    return target.canvas;
  }
  try {
    const providerTask = await createArkVideoTask({
      providerId: target.providerId,
      modelId: target.task.modelId,
      apiKey: target.apiKey,
      prompt: target.prompt,
      referenceImages: target.referenceImages,
      durationSeconds: target.durationSeconds,
      ratio: target.ratio,
      resolution: target.resolution,
      generateAudio: target.generateAudio,
      watermark: target.watermark,
      timeoutMs: target.timeoutMs,
      ...(signal ? { signal } : {})
    });
    const updated = persistVideoTaskState(userId, id, targetShotId, target.task.localId, {
      providerTaskId: providerTask.id,
      status: providerTask.status,
      ...(providerTask.error ? { error: providerTask.error } : {})
    });
    if (updated) watchSubmittedVideoTask?.(userId, id, targetShotId, target.task.localId);
    return updated;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1_000) : "火山方舟视频任务创建失败。";
    persistVideoTaskState(userId, id, targetShotId, target.task.localId, { status: "failed", error: message });
    throw error;
  }
}

function taskApiKey(userId: string, task: AiVideoTask, credentials: CredentialConsumer): { apiKey: string; timeoutMs: number; providerId: ArkVideoProviderId } {
  const account = listAiAccounts(userId).find(item => item.id === task.accountId);
  if (!account?.hasSecret || account.providerId !== "doubao" && account.providerId !== "ark-agent-plan") throw new Error("视频任务所用的火山方舟账户或密钥已不可用。");
  const model = account.models.find(item => item.id === task.modelId);
  if (!model || account.providerId === "ark-agent-plan" && model.taskType !== "video-generation") throw new Error("视频任务模型不在套餐视频能力目录中。");
  const apiKey = credentials.resolve(userId, credentialReference("lfaa-settings", task.accountId));
  if (!apiKey) throw new Error("视频任务所用的火山方舟密钥不可用。");
  return { apiKey, timeoutMs: getUserSettings(userId).aiRuntime.requestTimeoutSeconds * 1_000, providerId: account.providerId };
}

async function refreshShotVideo(userId: string, canvasId: string, shotId: string, credentials: CredentialConsumer, signal?: AbortSignal): Promise<AiVideoCanvas | null> {
  signal?.throwIfAborted();
  const id = normalizedId(canvasId, "项目 ID");
  const targetShotId = normalizedId(shotId, "镜头 ID");
  const target = withControlLock(database, () => {
    const root = ensureCurrentFormat(userId);
    const canvas = readProject(root, id)?.canvas;
    if (!canvas) return null;
    const shot = canvas.shots.find(item => item.id === targetShotId);
    if (!shot?.videoTask) throw new Error("此镜头还没有视频生成任务。");
    const task = shot.videoTask;
    if (["succeeded", "failed", "cancelled", "expired"].includes(task.status)) return { canvas, task, canRefresh: false };
    if (task.providerTaskId?.startsWith("lfaa-local:")) {
      return { canvas, task, canRefresh: false, localActive: localVideoJobs.has(videoTaskKey(userId, id, targetShotId, task.localId)) };
    }
    if (!task.providerTaskId || task.status === "submitting") {
      const requestTimeoutMs = getUserSettings(userId).aiRuntime.requestTimeoutSeconds * 1_000;
      const stale = task.status === "submitting" && Date.now() - Date.parse(task.createdAt) > requestTimeoutMs + 15_000;
      return { canvas, task, apiKey: "", timeoutMs: 0, canRefresh: false, stale };
    }
    const canRefresh = task.status === "queued" || task.status === "running" || task.status === "succeeded" && !shot.videoAssetId;
    if (!canRefresh) return { canvas, task, apiKey: "", timeoutMs: 0, canRefresh: false };
    return { canvas, task, ...taskApiKey(userId, task, credentials), canRefresh: true };
  });
  if (!target) return null;
  if ("localActive" in target) {
    if (target.localActive) return target.canvas;
    return persistVideoTaskState(userId, id, targetShotId, target.task.localId, {
      status: "failed",
      error: "本机视频推理进程已中断；LFAA 没有登记不完整的生成结果。"
    }) ?? target.canvas;
  }
  if ("stale" in target && target.stale) {
    return persistVideoTaskState(userId, id, targetShotId, target.task.localId, {
      status: "failed",
      error: "LFAA 在服务商回执前中断了任务提交，服务商是否已受理无法确认。请先查看服务商任务记录，再决定是否重试。"
    }) ?? target.canvas;
  }
  if (!("apiKey" in target) || !target.canRefresh || typeof target.timeoutMs !== "number") return target.canvas;
  if (!("providerId" in target) || !target.providerId) throw new Error("视频任务恢复时未能确定原始方舟套餐接口。" );
  const lease = videoTaskKey(userId, id, targetShotId, target.task.localId);
  if (videoPollLeases.has(lease)) return target.canvas;
  videoPollLeases.add(lease);
  try {
    const providerTask = await getArkVideoTask({ providerId: target.providerId, taskId: target.task.providerTaskId!, apiKey: target.apiKey, timeoutMs: target.timeoutMs, ...(signal ? { signal } : {}) });
    if (providerTask.status === "succeeded") {
      if (!providerTask.videoUrl) return persistVideoTaskState(userId, id, targetShotId, target.task.localId, { status: "succeeded", error: "服务商显示生成完成，但没有返回视频文件地址。请查看服务商任务记录。" });
      try {
        const video = await downloadArkVideo(providerTask.videoUrl, target.timeoutMs, signal);
        signal?.throwIfAborted();
        return persistVideoTaskState(userId, id, targetShotId, target.task.localId, { status: "succeeded", error: "" }, video);
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 1_000) : "视频下载失败。";
        persistVideoTaskState(userId, id, targetShotId, target.task.localId, { status: "succeeded", error: message });
        throw error;
      }
    }
    const terminal = providerTask.status === "failed" || providerTask.status === "cancelled" || providerTask.status === "expired";
    return persistVideoTaskState(userId, id, targetShotId, target.task.localId, {
      status: providerTask.status,
      ...(providerTask.error ? { error: providerTask.error } : terminal && providerTask.status === "expired" ? { error: "服务商任务已过期，请重新发起生成。" } : { error: "" })
    });
  } finally { videoPollLeases.delete(lease); }
}

async function cancelShotVideo(userId: string, canvasId: string, shotId: string, credentials: CredentialConsumer, signal?: AbortSignal): Promise<AiVideoCanvas | null> {
  const id = normalizedId(canvasId, "项目 ID");
  const targetShotId = normalizedId(shotId, "镜头 ID");
  const target = withControlLock(database, () => {
    const root = ensureCurrentFormat(userId);
    const canvas = readProject(root, id)?.canvas;
    if (!canvas) return null;
    const shot = canvas.shots.find(item => item.id === targetShotId);
    if (!shot?.videoTask) throw new Error("此镜头没有可取消的视频任务。");
    if (shot.videoTask.providerTaskId?.startsWith("lfaa-local:")) {
      const controller = localVideoJobs.get(videoTaskKey(userId, id, targetShotId, shot.videoTask.localId));
      if (!controller) throw new Error("本机视频任务已结束或没有可取消的运行进程。");
      return { task: shot.videoTask, localController: controller };
    }
    if (shot.videoTask.status !== "queued" || !shot.videoTask.providerTaskId) throw new Error("只有仍在排队中的视频任务可以取消；运行中的任务需等服务商返回结果。");
    return { task: shot.videoTask, ...taskApiKey(userId, shot.videoTask, credentials) };
  });
  if (!target) return null;
  if ("localController" in target) {
    target.localController.abort(new Error("用户取消本机视频生成。"));
    return persistVideoTaskState(userId, id, targetShotId, target.task.localId, { status: "cancelled", error: "" });
  }
  await cancelArkVideoTask({ providerId: target.providerId, taskId: target.task.providerTaskId!, apiKey: target.apiKey, timeoutMs: target.timeoutMs, ...(signal ? { signal } : {}) });
  return persistVideoTaskState(userId, id, targetShotId, target.task.localId, { status: "cancelled", error: "" });
}

export function deleteAiVideoCanvas(userId: string, canvasId: string): boolean {
  const id = normalizedId(canvasId, "项目 ID");
  return withControlLock(database, () => {
    const root = ensureCurrentFormat(userId);
    const records = readProjectCollection(root);
    const current = records.find(record => record.canvas.id === id)?.canvas;
    if (!current) return false;
    if (current.shots.some(shot => shot.videoTask && ["submitting", "queued", "running"].includes(shot.videoTask.status))) {
      throw new Error("此项目仍有排队或生成中的视频任务；请先取消排队任务或等待任务结束，再删除项目。");
    }
    const directory = projectDirectory(root, id);
    rejectSymlinkOrWrongType(directory, "directory");
    rmSync(directory, { recursive: true, force: false });
    return true;
  });
}

declare module "@deepseek-ai/cordis" { interface Context { lfaaAiVideo: AiVideoCanvasService } }
export const name = "lfaaAiVideo";
export const inject = ["lfaaCredentials", "lfaaSettings", "lfaaLocalModelRuntime"];
export function apply(ctx: Context): void {
  const credentials = ctx.lfaaCredentials.createConsumer(ctx);
  let disposed = false;
  const watchers = new Map<string, { controller: AbortController; timer: ReturnType<typeof setTimeout> | null; failures: number }>();
  const watch = (userId: string, canvasId: string, shotId: string, localTaskId: string) => {
    const key = videoTaskKey(userId, canvasId, shotId, localTaskId);
    if (disposed || watchers.has(key)) return;
    const watcher = { controller: new AbortController(), timer: null as ReturnType<typeof setTimeout> | null, failures: 0 };
    watchers.set(key, watcher);
    const stop = () => {
      if (watcher.timer) clearTimeout(watcher.timer);
      watcher.controller.abort();
      watchers.delete(key);
    };
    const schedule = (delay: number) => {
      if (!disposed && !watcher.controller.signal.aborted && watcher.timer === null) watcher.timer = setTimeout(() => { watcher.timer = null; void poll(); }, delay);
    };
    const poll = async () => {
      if (disposed || watcher.controller.signal.aborted) { stop(); return; }
      try {
        const canvas = await refreshShotVideo(userId, canvasId, shotId, credentials, watcher.controller.signal);
        const shot = canvas?.shots.find(item => item.id === shotId);
        const task = shot?.videoTask;
        if (!task || task.localId !== localTaskId || task.status === "failed" || task.status === "cancelled" || task.status === "expired"
          || task.status === "succeeded" && (Boolean(shot?.videoAssetId) || Boolean(task.error))) {
          stop();
          return;
        }
        watcher.failures = 0;
        schedule(5_000);
      } catch {
        if (watcher.controller.signal.aborted) { stop(); return; }
        watcher.failures += 1;
        const latest = listAiVideoCanvases(userId).find(item => item.id === canvasId)?.shots.find(item => item.id === shotId);
        if (!latest?.videoTask || latest.videoTask.localId !== localTaskId || latest.videoTask.error) { stop(); return; }
        schedule(Math.min(30_000, 5_000 * 2 ** Math.min(watcher.failures, 2)));
      }
    };
    schedule(1_500);
  };
  watchSubmittedVideoTask = watch;
  ctx.effect(() => () => {
    disposed = true;
    for (const watcher of watchers.values()) {
      if (watcher.timer) clearTimeout(watcher.timer);
      watcher.controller.abort();
    }
    watchers.clear();
    for (const controller of localVideoJobs.values()) controller.abort(new Error("LFAA AI Video 正在卸载。"));
    localVideoJobs.clear();
    if (watchSubmittedVideoTask === watch) watchSubmittedVideoTask = null;
  });
  ctx.provide(name, {
    list: listAiVideoCanvases,
    create: createAiVideoCanvas,
    update: updateAiVideoCanvas,
    remove: deleteAiVideoCanvas,
    listMediaAssets,
    importMediaAsset: (userId: string, canvasId: string, expectedUpdatedAt: string, name: unknown, mimeType: unknown, bytes: Buffer) => importMediaAsset(userId, canvasId, expectedUpdatedAt, name, mimeType, bytes, ctx.lfaaLocalModelRuntime),
    saveExportAsset,
    removeMediaAsset,
    uploadShotImage: (userId: string, canvasId: string, shotId: string, expectedUpdatedAt: string, bytes: Buffer, mimeType: unknown) => uploadShotImage(userId, canvasId, shotId, expectedUpdatedAt, bytes, mimeType, ctx.lfaaLocalModelRuntime),
    openMediaAsset,
    uploadReferenceImage: (userId: string, canvasId: string, kind: AiVideoReferenceKind, referenceId: string, expectedUpdatedAt: string, dataUrl: unknown) => uploadAiVideoReferenceImage(userId, canvasId, kind, referenceId, expectedUpdatedAt, dataUrl, ctx.lfaaLocalModelRuntime),
    removeReferenceImage: removeAiVideoReferenceImage,
    generateShotImage: (userId: string, canvasId: string, shotId: string, expectedUpdatedAt: string, signal?: AbortSignal) => generateShotImage(userId, canvasId, shotId, expectedUpdatedAt, credentials, ctx.lfaaLocalModelRuntime, signal),
    startShotVideo: (userId: string, canvasId: string, shotId: string, expectedUpdatedAt: string, signal?: AbortSignal) => startShotVideo(userId, canvasId, shotId, expectedUpdatedAt, credentials, ctx.lfaaLocalModelRuntime, signal),
    refreshShotVideo: (userId: string, canvasId: string, shotId: string, signal?: AbortSignal) => refreshShotVideo(userId, canvasId, shotId, credentials, signal),
    cancelShotVideo: (userId: string, canvasId: string, shotId: string, signal?: AbortSignal) => cancelShotVideo(userId, canvasId, shotId, credentials, signal),
    readGeneratedImage
  });
}
