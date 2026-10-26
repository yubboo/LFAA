/**
 * 功能：系统级无限画布的项目文档数据形状、节点数据规范化、工程导入/导出编解码与生成设置读取兜底。
 * 作用：为画布首页与工作区提供唯一一份节点数据合同（合同 5.2）、导入校验（服务端仍为权威）以及导入/导出编排，
 *      避免首页与工作区各自实现一套数据规则。
 * 关联文件：CanvasWorkspace.tsx、CanvasHome.tsx、CanvasNodeCards.tsx、CanvasAssetPanel.tsx、
 *          packages/client/connection/src/api.ts、docs/development/canvas-agent-workbench-20261025.md。
 */
import {
  canvasAssetUrl, createCanvasProject, deleteCanvasProject, saveCanvasProject, uploadCanvasAsset,
  type ApplicationId, type CanvasAssetMimeType, type CanvasEdge, type CanvasNode, type CanvasProject, type UserSettings
} from "lfaa-client-connection/src/api.js";
import type { DirectorDeskObject, DirectorDeskSceneData } from "lfaa-client-ui-primitives/src/DirectorDeskStage.js";

/** 导入导出的 JSON（含素材 base64）总量上限，与画布合同一致；服务端仍是最终权威。 */
export const MAX_TRANSFER_BYTES = 64 * 1024 * 1024;
/** 导入文件本身的上限，比素材总量略宽以容纳 base64 膨胀，避免读入异常大文件。 */
export const MAX_IMPORT_FILE_BYTES = 96 * 1024 * 1024;
/** 当前工程文档格式版本；v1 从未发布，只接受 v2（含 applicationId）。 */
export const CANVAS_FORMAT_VERSION = 2;

/** 客户端预览用的合同上限；服务端校验才是权威，这里只用于提前给出中文反馈。 */
export const CANVAS_LIMITS = {
  nodes: 200,
  edges: 400,
  assets: 100,
  textLength: 20_000,
  /** 单个节点 data 的 JSON 字符上限，与画布 Owner 的 nodeDataBytes 保持一致。 */
  nodeDataBytes: 64 * 1024,
  titleLength: 80,
  imageBytes: 16 * 1024 * 1024,
  videoBytes: 64 * 1024 * 1024,
  /** 音频单文件上限（合同 5.1）：32 MiB。 */
  audioBytes: 32 * 1024 * 1024,
  projectAssetBytes: 512 * 1024 * 1024,
  directorDeskObjects: 32,
  minNodeSize: 120,
  maxNodeSize: 800,
  coordinate: 100_000,
  minZoom: 0.05,
  maxZoom: 8
} as const;

export const CANVAS_ASSET_MIME_TYPES: readonly CanvasAssetMimeType[] = [
  "image/png", "image/jpeg", "image/webp", "video/mp4", "video/webm", "audio/mpeg", "audio/wav", "audio/ogg"
];

/** 画布客户端注册的节点类型（合同 5.2）；服务端只校验类型模式与有界 JSON。 */
export const CANVAS_NODE_KINDS = [
  "text", "note", "image", "video", "audio", "generation", "subject", "timeline", "director-toolbox", "director-desk", "script", "asset"
] as const;
export type CanvasNodeKind = typeof CANVAS_NODE_KINDS[number];

/** 生成支持的比例；2:1 只表示“全景比例图像”，不承诺球面全景渲染。 */
export const CANVAS_ASPECT_RATIOS = ["1:1", "4:3", "3:4", "16:9", "9:16", "2:1"] as const;
export type CanvasAspectRatio = typeof CANVAS_ASPECT_RATIOS[number];

export interface CanvasAspectRatioOption { value: CanvasAspectRatio; label: string; note?: string }
export const CANVAS_ASPECT_RATIO_OPTIONS: readonly CanvasAspectRatioOption[] = [
  { value: "1:1", label: "1:1 方形" },
  { value: "4:3", label: "4:3 横向" },
  { value: "3:4", label: "3:4 竖向" },
  { value: "16:9", label: "16:9 宽银幕" },
  { value: "9:16", label: "9:16 竖屏" },
  { value: "2:1", label: "2:1 全景比例", note: "全景比例图像（按 2:1 图片生成，不是球面全景渲染）" }
];

export type CanvasGenerationStatus = "idle" | "running" | "succeeded" | "failed";
export interface CanvasGenerationData {
  kind: "image" | "video";
  prompt: string;
  status: CanvasGenerationStatus;
  assetId?: string;
  error?: string;
  aspectRatio?: CanvasAspectRatio;
  durationSeconds?: number;
  taskId?: string;
  startedAt?: string;
  finishedAt?: string;
}
export type CanvasSubjectKind = "character" | "location" | "prop";
export interface CanvasSubjectData { name: string; kind: CanvasSubjectKind; description: string; assetIds: string[] }
export interface CanvasTimelineClip { nodeId: string; assetId?: string; startSeconds: number; durationSeconds: number; title: string }
export interface CanvasTimelineData { clips: CanvasTimelineClip[]; durationSeconds: number }
export interface CanvasDirectorToolboxData { name: string; promptSuffix: string; aspectRatio?: CanvasAspectRatio }
export interface CanvasDirectorDeskData { shotNodeIds: string[]; scene?: DirectorDeskSceneData }

/** 既有 Canvas 设置之外的项目级场景初始值；保存后归当前导演台节点。 */
export function createDefaultDirectorDeskScene(): DirectorDeskSceneData {
  return {
    objects: [],
    camera: { x: 0, y: 2.4, z: -8, yaw: 0, pitch: -5, focalLength: 50 },
    environment: "studio",
    keyLightIntensity: 3.4,
    showGrid: true
  };
}
export type CanvasScriptStatus = "draft" | "ready";
export interface CanvasScriptData { title: string; body: string; status: CanvasScriptStatus }

/** 画布界面读取的设置中心 canvas 分区（权威 Owner 为 settings-contract + settings + ui-settings）。 */
export interface CanvasUiSettings {
  defaultMode: "generate" | "canvas";
  gridStyle: "dots" | "lines" | "none";
  snapToGrid: boolean;
  showMiniMap: boolean;
  agentPanelDefaultOpen: boolean;
}

/** 与合同第 8 节一致的默认值；设置类型尚未落地时用它兜底，后续以 settings.canvas 为准。 */
export const DEFAULT_CANVAS_UI_SETTINGS: CanvasUiSettings = {
  defaultMode: "generate",
  gridStyle: "dots",
  snapToGrid: false,
  showMiniMap: true,
  agentPanelDefaultOpen: false
};

/**
 * 功能：从账户设置读取画布分区。
 * 作用：settings.canvas 由设置中心 Owner 提供（共享类型 + 服务端校验/持久化）；这里只做防御式读取，
 *      旧数据缺少该分区时退回合同默认值，不自行持久化第二套设置。
 */
export function resolveCanvasSettings(settings: UserSettings | null | undefined): CanvasUiSettings {
  const canvas: Partial<CanvasUiSettings> | undefined = settings?.canvas;
  if (!canvas) return DEFAULT_CANVAS_UI_SETTINGS;
  return {
    defaultMode: canvas.defaultMode === "canvas" ? "canvas" : "generate",
    gridStyle: canvas.gridStyle === "lines" || canvas.gridStyle === "none" ? canvas.gridStyle : "dots",
    snapToGrid: typeof canvas.snapToGrid === "boolean" ? canvas.snapToGrid : DEFAULT_CANVAS_UI_SETTINGS.snapToGrid,
    showMiniMap: typeof canvas.showMiniMap === "boolean" ? canvas.showMiniMap : DEFAULT_CANVAS_UI_SETTINGS.showMiniMap,
    agentPanelDefaultOpen: typeof canvas.agentPanelDefaultOpen === "boolean" ? canvas.agentPanelDefaultOpen : DEFAULT_CANVAS_UI_SETTINGS.agentPanelDefaultOpen
  };
}

export interface CanvasTransferAsset {
  id: string;
  name: string;
  mimeType: CanvasAssetMimeType;
  bytes: Uint8Array;
}

export interface CanvasTransferBundle {
  title: string;
  viewport: { x: number; y: number; zoom: number };
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  assets: CanvasTransferAsset[];
}

export interface CanvasExportAsset {
  assetId: string;
  name: string;
  mimeType: CanvasAssetMimeType;
  bytes: number;
  data: string;
}

export interface CanvasExportInput {
  title: string;
  viewport: { x: number; y: number; zoom: number };
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  assets: CanvasExportAsset[];
  exportedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clampNumber(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function requireFinite(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(label + "不是有效数字。");
  return value;
}

function readArray(value: unknown, label: string, maximum: number): unknown[] {
  if (!Array.isArray(value)) throw new Error("导入文件缺少" + label + "数组。");
  if (value.length > maximum) throw new Error(label + "超过上限 " + maximum + " 条。");
  return value;
}

function readText(value: unknown, maximum: number, fallback: string): string {
  if (typeof value !== "string") return fallback;
  return value.slice(0, maximum);
}

function readTrimmed(value: unknown, maximum: number, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const text = value.trim().slice(0, maximum);
  return text || fallback;
}

function readTitle(value: unknown): string {
  const title = readTrimmed(value, CANVAS_LIMITS.titleLength, "导入的画布");
  return title || "导入的画布";
}

function readViewport(value: unknown): { x: number; y: number; zoom: number } {
  if (!isRecord(value)) return { x: 0, y: 0, zoom: 1 };
  const x = typeof value.x === "number" && Number.isFinite(value.x) ? clampNumber(value.x, -CANVAS_LIMITS.coordinate, CANVAS_LIMITS.coordinate) : 0;
  const y = typeof value.y === "number" && Number.isFinite(value.y) ? clampNumber(value.y, -CANVAS_LIMITS.coordinate, CANVAS_LIMITS.coordinate) : 0;
  const zoom = typeof value.zoom === "number" && Number.isFinite(value.zoom) ? clampNumber(value.zoom, CANVAS_LIMITS.minZoom, CANVAS_LIMITS.maxZoom) : 1;
  return { x, y, zoom };
}

function isCanvasNodeKind(value: unknown): value is CanvasNodeKind {
  return typeof value === "string" && (CANVAS_NODE_KINDS as readonly string[]).includes(value);
}

function isAspectRatio(value: unknown): value is CanvasAspectRatio {
  return typeof value === "string" && (CANVAS_ASPECT_RATIOS as readonly string[]).includes(value);
}

/** 单个节点的数据规范化上下文：素材与节点既有 id 由项目文档提供，导入时由导入文件提供。 */
export interface CanvasNodeDataContext {
  assetIds: ReadonlySet<string>;
  assetNames: ReadonlyMap<string, string>;
  /** 素材 MIME 类型；用于校验图片/视频/音频节点引用的素材类别是否匹配。 */
  assetMimeTypes: ReadonlyMap<string, string>;
  nodeIds: ReadonlySet<string>;
}

const GENERATION_STATUSES: readonly CanvasGenerationStatus[] = ["idle", "running", "succeeded", "failed"];
const SUBJECT_KINDS: readonly CanvasSubjectKind[] = ["character", "location", "prop"];
const SCRIPT_STATUSES: readonly CanvasScriptStatus[] = ["draft", "ready"];

function requireAssetId(value: unknown, context: CanvasNodeDataContext, label: string): string {
  if (typeof value !== "string" || !context.assetIds.has(value)) throw new Error(label + "引用的素材不存在。");
  return value;
}

function normalizeGenerationData(value: unknown, context: CanvasNodeDataContext, label: string): CanvasGenerationData {
  if (!isRecord(value)) throw new Error(label + "缺少生成数据。");
  const kind = value.kind === "video" ? "video" : value.kind === "image" ? "image" : null;
  if (!kind) throw new Error(label + "生成类型只能是 image 或 video。");
  const status = typeof value.status === "string" && (GENERATION_STATUSES as readonly string[]).includes(value.status) ? value.status as CanvasGenerationStatus : null;
  if (!status) throw new Error(label + "生成状态无效。");
  const data: CanvasGenerationData = { kind, prompt: readText(value.prompt, CANVAS_LIMITS.textLength, ""), status };
  if (value.assetId !== undefined) data.assetId = requireAssetId(value.assetId, context, label);
  if (typeof value.error === "string" && value.error.trim()) data.error = value.error.slice(0, 2_000);
  if (isAspectRatio(value.aspectRatio)) data.aspectRatio = value.aspectRatio;
  if (typeof value.durationSeconds === "number" && Number.isFinite(value.durationSeconds)) data.durationSeconds = clampNumber(Math.round(value.durationSeconds), 0, 600);
  if (typeof value.taskId === "string" && value.taskId) data.taskId = value.taskId.slice(0, 200);
  if (typeof value.startedAt === "string" && value.startedAt) data.startedAt = value.startedAt.slice(0, 40);
  if (typeof value.finishedAt === "string" && value.finishedAt) data.finishedAt = value.finishedAt.slice(0, 40);
  return data;
}

function normalizeSubjectData(value: unknown, context: CanvasNodeDataContext, label: string): CanvasSubjectData {
  if (!isRecord(value)) throw new Error(label + "缺少主体数据。");
  const kind = typeof value.kind === "string" && (SUBJECT_KINDS as readonly string[]).includes(value.kind) ? value.kind as CanvasSubjectKind : "character";
  const rawAssetIds = Array.isArray(value.assetIds) ? value.assetIds.slice(0, CANVAS_LIMITS.assets) : [];
  const assetIds = rawAssetIds.map(assetId => requireAssetId(assetId, context, label));
  return {
    name: readTrimmed(value.name, 120, "未命名主体"),
    kind,
    description: readText(value.description, CANVAS_LIMITS.textLength, ""),
    assetIds: [...new Set(assetIds)]
  };
}

function normalizeTimelineData(value: unknown, context: CanvasNodeDataContext, label: string): CanvasTimelineData {
  if (!isRecord(value)) throw new Error(label + "缺少时间线数据。");
  const rawClips = readArray(value.clips, "时间线片段", 200);
  const clips: CanvasTimelineClip[] = rawClips.map((item, index) => {
    if (!isRecord(item)) throw new Error(label + "第 " + (index + 1) + " 个时间线片段格式无效。");
    const nodeId = typeof item.nodeId === "string" ? item.nodeId : "";
    if (nodeId && !context.nodeIds.has(nodeId)) throw new Error(label + "时间线片段引用的画布节点不存在。");
    const clip: CanvasTimelineClip = {
      nodeId,
      startSeconds: clampNumber(requireFinite(item.startSeconds, label + "片段开始时间"), 0, 36_000),
      durationSeconds: clampNumber(requireFinite(item.durationSeconds, label + "片段时长"), 0.1, 36_000),
      title: readTrimmed(item.title, 120, "未命名片段")
    };
    if (item.assetId !== undefined && item.assetId !== "") clip.assetId = requireAssetId(item.assetId, context, label);
    return clip;
  });
  const durationSeconds = clips.reduce((total, clip) => Math.max(total, clip.startSeconds + clip.durationSeconds), 0);
  return { clips, durationSeconds: Math.round(durationSeconds * 10) / 10 };
}

function normalizeToolboxData(value: unknown, label: string): CanvasDirectorToolboxData {
  if (!isRecord(value)) throw new Error(label + "缺少导演工具箱数据。");
  const data: CanvasDirectorToolboxData = {
    name: readTrimmed(value.name, 120, "未命名预设"),
    promptSuffix: readText(value.promptSuffix, CANVAS_LIMITS.textLength, "")
  };
  if (isAspectRatio(value.aspectRatio)) data.aspectRatio = value.aspectRatio;
  return data;
}

function normalizeDeskData(value: unknown, context: CanvasNodeDataContext, label: string): CanvasDirectorDeskData {
  if (!isRecord(value)) throw new Error(label + "缺少导演台数据。");
  const raw = Array.isArray(value.shotNodeIds) ? value.shotNodeIds.slice(0, CANVAS_LIMITS.nodes) : [];
  const shotNodeIds = raw.map(nodeId => {
    if (typeof nodeId !== "string" || !context.nodeIds.has(nodeId)) throw new Error(label + "镜头节点不存在。");
    return nodeId;
  });
  const result: CanvasDirectorDeskData = { shotNodeIds: [...new Set(shotNodeIds)] };
  if (value.scene !== undefined) result.scene = normalizeDirectorDeskScene(value.scene, label);
  return result;
}

function normalizeDirectorDeskScene(value: unknown, label: string): DirectorDeskSceneData {
  if (!isRecord(value) || Object.keys(value).some(key => !["objects", "camera", "environment", "keyLightIntensity", "showGrid"].includes(key))) {
    throw new Error(label + "场景格式无效。");
  }
  const rawObjects = readArray(value.objects, "导演台对象", CANVAS_LIMITS.directorDeskObjects);
  const ids = new Set<string>();
  const objects: DirectorDeskObject[] = rawObjects.map((item, index) => {
    if (!isRecord(item) || Object.keys(item).some(key => !["id", "name", "kind", "x", "y", "z", "width", "height", "depth", "rotation"].includes(key))) {
      throw new Error(label + "第 " + (index + 1) + " 个场景对象格式无效。");
    }
    if (typeof item.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(item.id)) {
      throw new Error(label + "场景对象 ID 无效。");
    }
    const id = item.id.toLowerCase();
    if (ids.has(id)) throw new Error(label + "场景对象 ID 重复。");
    ids.add(id);
    if (item.kind !== "actor" && item.kind !== "block") throw new Error(label + "对象类型无效。");
    const finite = (field: unknown, fieldLabel: string, minimum: number, maximum: number) =>
      clampNumber(requireFinite(field, label + fieldLabel), minimum, maximum);
    return {
      id,
      name: readTrimmed(item.name, 50, item.kind === "actor" ? "白模角色" : "场景方块"),
      kind: item.kind,
      x: finite(item.x, "对象横向位置", -50, 50),
      y: finite(item.y, "对象高度", -50, 50),
      z: finite(item.z, "对象纵向位置", -50, 50),
      width: finite(item.width, "对象宽度", 0.2, 20),
      height: finite(item.height, "对象高度", 0.2, 20),
      depth: finite(item.depth, "对象纵深", 0.2, 20),
      rotation: finite(item.rotation, "对象朝向", -360, 360)
    };
  });
  if (!isRecord(value.camera) || Object.keys(value.camera).some(key => !["x", "y", "z", "yaw", "pitch", "focalLength"].includes(key))) {
    throw new Error(label + "摄影机格式无效。");
  }
  const camera = value.camera;
  const finiteCamera = (field: unknown, fieldLabel: string, minimum: number, maximum: number) =>
    clampNumber(requireFinite(field, label + fieldLabel), minimum, maximum);
  if (value.environment !== "studio" && value.environment !== "sunset" && value.environment !== "night") {
    throw new Error(label + "环境预设无效。");
  }
  if (typeof value.showGrid !== "boolean") throw new Error(label + "地面网格开关无效。");
  return {
    objects,
    camera: {
      x: finiteCamera(camera.x, "摄影机横向位置", -100, 100),
      y: finiteCamera(camera.y, "摄影机高度", -5, 100),
      z: finiteCamera(camera.z, "摄影机纵向位置", -100, 100),
      yaw: finiteCamera(camera.yaw, "摄影机水平角度", -360, 360),
      pitch: finiteCamera(camera.pitch, "摄影机俯仰角度", -85, 85),
      focalLength: finiteCamera(camera.focalLength, "摄影机焦距", 18, 120)
    },
    environment: value.environment,
    keyLightIntensity: finiteCamera(value.keyLightIntensity, "主光强度", 0, 5),
    showGrid: value.showGrid
  };
}

function normalizeScriptData(value: unknown, label: string): CanvasScriptData {
  if (!isRecord(value)) throw new Error(label + "缺少剧本数据。");
  const status = typeof value.status === "string" && (SCRIPT_STATUSES as readonly string[]).includes(value.status) ? value.status as CanvasScriptStatus : "draft";
  return {
    title: readTrimmed(value.title, 120, "未命名剧本"),
    body: readText(value.body, CANVAS_LIMITS.textLength, ""),
    status
  };
}

/**
 * 功能：按节点类型规范化 data 字段。
 * 作用：导入校验与保存前整理共用同一实现，保证客户端只有一套节点数据规则；非法数据抛出可读中文错误。
 */
export function normalizeCanvasNodeData(kind: CanvasNodeKind, raw: unknown, context: CanvasNodeDataContext): Record<string, unknown> {
  const label = "节点「" + kind + "」";
  if (kind !== "text" && kind !== "note" && (raw === undefined || raw === null)) throw new Error(label + "缺少数据。");
  const data = isRecord(raw) ? raw : {};
  let normalized: Record<string, unknown>;
  switch (kind) {
    case "text":
    case "note":
      normalized = { text: readText(data.text, CANVAS_LIMITS.textLength, "") };
      break;
    case "image":
    case "video":
    case "audio": {
      const assetId = requireAssetId(data.assetId, context, label);
      const mimeType = context.assetMimeTypes.get(assetId);
      if (mimeType && !mimeType.startsWith(kind + "/")) {
        throw new Error(label + "必须引用" + (kind === "image" ? "图片" : kind === "video" ? "视频" : "音频") + "素材。");
      }
      normalized = { assetId, assetName: readTrimmed(data.assetName, 120, context.assetNames.get(assetId) ?? "素材") };
      break;
    }
    case "asset": {
      const assetId = requireAssetId(data.assetId, context, label);
      normalized = { assetId, assetName: readTrimmed(data.assetName, 120, context.assetNames.get(assetId) ?? "素材") };
      break;
    }
    case "generation":
      normalized = { generation: normalizeGenerationData(data.generation, context, label) };
      break;
    case "subject":
      normalized = { subject: normalizeSubjectData(data.subject, context, label) };
      break;
    case "timeline":
      normalized = { timeline: normalizeTimelineData(data.timeline, context, label) };
      break;
    case "director-toolbox":
      normalized = { preset: normalizeToolboxData(data.preset, label) };
      break;
    case "director-desk":
      normalized = { desk: normalizeDeskData(data.desk, context, label) };
      break;
    case "script":
      normalized = { script: normalizeScriptData(data.script, label) };
      break;
    default:
      throw new Error(label + "不受支持。");
  }
  let serialized: string;
  try {
    serialized = JSON.stringify(normalized);
  } catch {
    throw new Error(label + "数据无法序列化。");
  }
  if (serialized.length > CANVAS_LIMITS.nodeDataBytes) throw new Error(label + "数据超过 64 KiB 上限。");
  return normalized;
}

function matchesMimeType(bytes: Uint8Array, mimeType: CanvasAssetMimeType): boolean {
  const startsWith = (...signature: number[]): boolean => signature.every((value, index) => bytes[index] === value);
  const asciiAt = (offset: number, text: string): boolean => {
    for (let index = 0; index < text.length; index += 1) {
      if (bytes[offset + index] !== text.charCodeAt(index)) return false;
    }
    return true;
  };
  switch (mimeType) {
    case "image/png": return startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case "image/jpeg": return startsWith(0xff, 0xd8, 0xff);
    case "image/webp": return startsWith(0x52, 0x49, 0x46, 0x46) && asciiAt(8, "WEBP");
    case "video/mp4": return asciiAt(4, "ftyp");
    case "video/webm": return startsWith(0x1a, 0x45, 0xdf, 0xa3);
    case "audio/mpeg": return asciiAt(0, "ID3") || (bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0);
    case "audio/wav": return asciiAt(0, "RIFF") && asciiAt(8, "WAVE");
    case "audio/ogg": return asciiAt(0, "OggS");
    default: return false;
  }
}

function base64ToBytes(value: string): Uint8Array {
  const normalized = value.replace(/\s+/gu, "");
  if (!normalized || !/^[A-Za-z0-9+/]*={0,2}$/u.test(normalized)) throw new Error("素材 base64 内容无效。");
  let binary: string;
  try {
    binary = atob(normalized);
  } catch {
    throw new Error("素材 base64 内容无法解码。");
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function randomId(): string {
  return crypto.randomUUID();
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export function estimateBase64Length(rawBytes: number): number {
  return Math.ceil(rawBytes / 3) * 4;
}

export function formatCanvasBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + " MiB";
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + " KiB";
  return bytes + " B";
}

export function canvasAssetKind(mimeType: string): "image" | "video" | "audio" | null {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return null;
}

/** 按 MIME 返回该素材类型的单文件上限；未知类型返回 0。 */
export function canvasAssetByteLimit(mimeType: string): number {
  const kind = canvasAssetKind(mimeType);
  if (kind === "image") return CANVAS_LIMITS.imageBytes;
  if (kind === "video") return CANVAS_LIMITS.videoBytes;
  if (kind === "audio") return CANVAS_LIMITS.audioBytes;
  return 0;
}

export function canvasExportFileName(title: string): string {
  const safe = title.replace(/[\\/:*?"<>|\u0000-\u001f]+/gu, "-").trim().slice(0, 60);
  return (safe || "canvas") + ".canvas.json";
}

export function buildCanvasExportDocument(input: CanvasExportInput): Record<string, unknown> {
  return {
    format: "lfaa-canvas-project",
    formatVersion: CANVAS_FORMAT_VERSION,
    title: input.title.slice(0, CANVAS_LIMITS.titleLength),
    viewport: {
      x: Math.round(input.viewport.x * 100) / 100,
      y: Math.round(input.viewport.y * 100) / 100,
      zoom: Math.round(input.viewport.zoom * 1000) / 1000
    },
    nodes: input.nodes,
    edges: input.edges,
    assets: input.assets,
    exportedAt: input.exportedAt
  };
}

/** 导入时把节点数据里记录的旧节点 id（时间线片段、导演台镜头）映射为新 id。 */
function remapImportedNodeReferences(data: unknown, nodeIdMap: ReadonlyMap<string, string>): unknown {
  if (!isRecord(data)) return data;
  const copy = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
  if (isRecord(copy.timeline) && Array.isArray(copy.timeline.clips)) {
    copy.timeline.clips = (copy.timeline.clips as Array<Record<string, unknown>>).map(clip => {
      if (typeof clip.nodeId !== "string" || !clip.nodeId) return clip;
      return { ...clip, nodeId: nodeIdMap.get(clip.nodeId) ?? clip.nodeId };
    });
  }
  if (isRecord(copy.desk) && Array.isArray(copy.desk.shotNodeIds)) {
    copy.desk.shotNodeIds = (copy.desk.shotNodeIds as unknown[]).map(nodeId => (
      typeof nodeId === "string" ? nodeIdMap.get(nodeId) ?? nodeId : nodeId
    ));
  }
  return copy;
}

/**
 * 功能：校验并规范化导入文件。
 * 作用：节点重新分配 id 并同步重映射连线/时间线/导演台引用，素材 id 保留原名供上传后重映射。
 */
export function parseCanvasImport(text: string): CanvasTransferBundle {
  if (text.length > MAX_IMPORT_FILE_BYTES) throw new Error("导入文件超过 96 MiB 上限。");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("导入文件不是有效的 JSON。");
  }
  if (!isRecord(raw)) throw new Error("导入文件的根内容必须是对象。");
  if (raw.format !== "lfaa-canvas-project") throw new Error("导入文件不是 LFAA 无限画布项目。");
  if (raw.formatVersion !== CANVAS_FORMAT_VERSION) throw new Error("不支持的画布格式版本：" + String(raw.formatVersion) + "；当前只接受 " + CANVAS_FORMAT_VERSION + "。");

  const title = readTitle(raw.title);
  const viewport = readViewport(raw.viewport);
  const assetIds = new Set<string>();
  const assetNames = new Map<string, string>();
  const assetMimeTypes = new Map<string, string>();
  const assets: CanvasTransferAsset[] = [];
  const rawAssets = readArray(raw.assets, "素材", CANVAS_LIMITS.assets);
  rawAssets.forEach((item, index) => {
    if (!isRecord(item)) throw new Error("第 " + (index + 1) + " 个素材格式无效。");
    const name = readTrimmed(item.name, 120, "素材 " + (index + 1));
    const mimeType = item.mimeType;
    if (typeof mimeType !== "string" || !(CANVAS_ASSET_MIME_TYPES as readonly string[]).includes(mimeType)) {
      throw new Error("素材「" + name + "」的 MIME 类型不受支持。");
    }
    if (typeof item.data !== "string") throw new Error("素材「" + name + "」缺少 base64 数据。");
    const bytes = base64ToBytes(item.data);
    if (!bytes.length) throw new Error("素材「" + name + "」内容为空。");
    const typedMimeType = mimeType as CanvasAssetMimeType;
    const limit = canvasAssetByteLimit(typedMimeType);
    if (bytes.byteLength > limit) throw new Error("素材「" + name + "」超过 " + formatCanvasBytes(limit) + " 上限。");
    if (!matchesMimeType(bytes, typedMimeType)) throw new Error("素材「" + name + "」的文件内容与 MIME 类型不符。");
    const oldId = typeof item.assetId === "string" && item.assetId ? item.assetId : "import-asset-" + index;
    if (assetIds.has(oldId)) throw new Error("素材 id 重复：" + oldId + "。");
    assetIds.add(oldId);
    assetNames.set(oldId, name);
    assetMimeTypes.set(oldId, typedMimeType);
    assets.push({ id: oldId, name, mimeType: typedMimeType, bytes });
  });
  const totalAssetBytes = assets.reduce((total, asset) => total + asset.bytes.byteLength, 0);
  if (totalAssetBytes > CANVAS_LIMITS.projectAssetBytes) throw new Error("素材总量超过 " + formatCanvasBytes(CANVAS_LIMITS.projectAssetBytes) + " 上限。");

  const rawNodes = readArray(raw.nodes, "节点", CANVAS_LIMITS.nodes);
  const nodeIdMap = new Map<string, string>();
  const assignedIds: string[] = [];
  const drafts: Array<{ id: string; kind: CanvasNodeKind; x: number; y: number; width: number; height: number; data: unknown }> = rawNodes.map((item, index) => {
    if (!isRecord(item)) throw new Error("第 " + (index + 1) + " 个节点格式无效。");
    if (!isCanvasNodeKind(item.type)) {
      throw new Error("第 " + (index + 1) + " 个节点类型不受支持：" + String(item.type) + "。");
    }
    const oldId = typeof item.id === "string" && item.id ? item.id : "import-node-" + index;
    if (nodeIdMap.has(oldId)) throw new Error("节点 id 重复：" + oldId + "。");
    const id = randomId();
    nodeIdMap.set(oldId, id);
    assignedIds.push(id);
    const x = clampNumber(requireFinite(item.x, "节点横坐标"), -CANVAS_LIMITS.coordinate, CANVAS_LIMITS.coordinate);
    const y = clampNumber(requireFinite(item.y, "节点纵坐标"), -CANVAS_LIMITS.coordinate, CANVAS_LIMITS.coordinate);
    const width = clampNumber(typeof item.width === "number" && Number.isFinite(item.width) ? item.width : 300, CANVAS_LIMITS.minNodeSize, CANVAS_LIMITS.maxNodeSize);
    const height = clampNumber(typeof item.height === "number" && Number.isFinite(item.height) ? item.height : 200, CANVAS_LIMITS.minNodeSize, CANVAS_LIMITS.maxNodeSize);
    return { id, kind: item.type, x, y, width, height, data: isRecord(item.data) ? item.data : {} };
  });

  const nodeIds = new Set(assignedIds);
  const context: CanvasNodeDataContext = { assetIds, assetNames, assetMimeTypes, nodeIds };
  const nodes: CanvasNode[] = drafts.map((draft, index) => {
    let data: Record<string, unknown>;
    try {
      data = normalizeCanvasNodeData(draft.kind, remapImportedNodeReferences(draft.data, nodeIdMap), context);
    } catch (error) {
      throw new Error("第 " + (index + 1) + " 个节点： " + (error instanceof Error ? error.message : "数据无效。"));
    }
    return {
      id: draft.id,
      type: draft.kind,
      x: Math.round(draft.x),
      y: Math.round(draft.y),
      width: Math.round(draft.width),
      height: Math.round(draft.height),
      data
    };
  });

  const rawEdges = readArray(raw.edges, "连线", CANVAS_LIMITS.edges);
  const edges: CanvasEdge[] = rawEdges.map((item, index) => {
    if (!isRecord(item)) throw new Error("第 " + (index + 1) + " 条连线格式无效。");
    const source = typeof item.source === "string" ? nodeIdMap.get(item.source) : undefined;
    const target = typeof item.target === "string" ? nodeIdMap.get(item.target) : undefined;
    if (!source || !target) throw new Error("第 " + (index + 1) + " 条连线的端点不存在。");
    if (source === target) throw new Error("第 " + (index + 1) + " 条连线连接了同一节点。");
    return {
      id: randomId(),
      source,
      target,
      ...(typeof item.sourceHandle === "string" ? { sourceHandle: item.sourceHandle.slice(0, 200) } : {}),
      ...(typeof item.targetHandle === "string" ? { targetHandle: item.targetHandle.slice(0, 200) } : {})
    };
  });

  return { title, viewport, nodes, edges, assets };
}

/** 上传素材后把节点数据里的旧素材 id 替换为新上传的素材 id。 */
export function remapCanvasNodeAssets(node: CanvasNode, assetIdMap: ReadonlyMap<string, string>): CanvasNode {
  const data = JSON.parse(JSON.stringify(node.data)) as Record<string, unknown>;
  if (typeof data.assetId === "string") data.assetId = assetIdMap.get(data.assetId) ?? data.assetId;
  if (isRecord(data.generation) && typeof data.generation.assetId === "string") {
    data.generation.assetId = assetIdMap.get(data.generation.assetId) ?? data.generation.assetId;
  }
  if (isRecord(data.subject) && Array.isArray(data.subject.assetIds)) {
    data.subject.assetIds = (data.subject.assetIds as string[]).map(assetId => assetIdMap.get(assetId) ?? assetId);
  }
  if (isRecord(data.timeline) && Array.isArray(data.timeline.clips)) {
    data.timeline.clips = (data.timeline.clips as Array<Record<string, unknown>>).map(clip => (
      typeof clip.assetId === "string" ? { ...clip, assetId: assetIdMap.get(clip.assetId) ?? clip.assetId } : clip
    ));
  }
  return { ...node, data };
}

/** 拼出可交给 saveCanvasProject 的完整项目文档（含格式版本与 App）。 */
export function buildCanvasProjectPayload(input: {
  project: CanvasProject;
  title: string;
  viewport: { x: number; y: number; zoom: number };
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}): CanvasProject {
  return {
    format: "lfaa-canvas-project",
    formatVersion: CANVAS_FORMAT_VERSION,
    id: input.project.id,
    title: input.title.slice(0, CANVAS_LIMITS.titleLength),
    applicationId: input.project.applicationId,
    viewport: {
      x: clampNumber(Math.round(input.viewport.x), -CANVAS_LIMITS.coordinate, CANVAS_LIMITS.coordinate),
      y: clampNumber(Math.round(input.viewport.y), -CANVAS_LIMITS.coordinate, CANVAS_LIMITS.coordinate),
      zoom: clampNumber(input.viewport.zoom, CANVAS_LIMITS.minZoom, CANVAS_LIMITS.maxZoom)
    },
    nodes: input.nodes,
    edges: input.edges,
    assets: input.project.assets,
    createdAt: input.project.createdAt,
    updatedAt: input.project.updatedAt
  };
}

export interface CanvasImportProgress { (message: string): void }

/**
 * 功能：把导入包真正写入画布 Owner。
 * 作用：新建项目 → 逐个上传素材 → 重映射素材引用 → 保存项目；失败时回滚临时项目并给出可读原因。
 */
export async function importCanvasProject(applicationId: ApplicationId, bundle: CanvasTransferBundle, onProgress: CanvasImportProgress = () => undefined): Promise<CanvasProject> {
  onProgress("正在创建导入项目…");
  const created = await createCanvasProject(applicationId, bundle.title);
  let latest = created.project;
  try {
    const assetIdMap = new Map<string, string>();
    for (let index = 0; index < bundle.assets.length; index += 1) {
      const asset = bundle.assets[index]!;
      onProgress("正在上传素材 " + (index + 1) + "/" + bundle.assets.length + "…");
      const blob = new Blob([asset.bytes], { type: asset.mimeType });
      const uploaded = await uploadCanvasAsset(applicationId, created.project.id, latest.updatedAt, asset.name, blob, asset.mimeType);
      const stored = uploaded.project.assets[uploaded.project.assets.length - 1];
      if (stored) assetIdMap.set(asset.id, stored.assetId);
      latest = uploaded.project;
    }
    const nodes = bundle.nodes.map(node => remapCanvasNodeAssets(node, assetIdMap));
    onProgress("正在保存导入项目…");
    const saved = await saveCanvasProject(applicationId, created.project.id, latest.updatedAt, buildCanvasProjectPayload({
      project: latest,
      title: bundle.title,
      viewport: bundle.viewport,
      nodes,
      edges: bundle.edges
    }));
    return saved.project;
  } catch (error) {
    try {
      await deleteCanvasProject(applicationId, created.project.id);
    } catch {
      throw new Error((error instanceof Error ? error.message : "导入失败。") + "；临时项目未能删除，请在画布首页手动删除。");
    }
    throw error;
  }
}

/**
 * 功能：读回项目全部素材字节并转成 base64。
 * 作用：导出前按合同总量上限做真实校验，超限即中止并保留可读原因。
 */
export async function collectCanvasExportAssets(applicationId: ApplicationId, project: CanvasProject, onProgress: CanvasImportProgress = () => undefined): Promise<CanvasExportAsset[]> {
  const exported: CanvasExportAsset[] = [];
  let usedBytes = 0;
  for (let index = 0; index < project.assets.length; index += 1) {
    const asset = project.assets[index]!;
    onProgress("正在读取素材 " + (index + 1) + "/" + project.assets.length + "…");
    const response = await fetch(canvasAssetUrl(applicationId, project.id, asset.assetId), { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) throw new Error("读取素材「" + asset.name + "」失败（HTTP " + response.status + "）。");
    const bytes = new Uint8Array(await response.arrayBuffer());
    const base64 = bytesToBase64(bytes);
    usedBytes += base64.length;
    if (usedBytes > MAX_TRANSFER_BYTES) throw new Error("导出内容超过 " + formatCanvasBytes(MAX_TRANSFER_BYTES) + " 上限。");
    exported.push({ assetId: asset.assetId, name: asset.name, mimeType: asset.mimeType, bytes: bytes.byteLength, data: base64 });
  }
  return exported;
}
