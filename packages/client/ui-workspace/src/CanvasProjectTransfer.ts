/** 功能：无限画布项目 JSON 导入导出格式的编解码与校验。作用：在客户端预览外部文件问题，权威校验仍在画布服务端。关联文件：CanvasWorkspace.tsx、dist/.tmp/canvas/CONTRACT.md。 */
import type { CanvasAssetMimeType, CanvasEdge, CanvasNode } from "lfaa-client-connection/src/api.js";

/** 导入导出的 JSON（含素材 base64）总量上限，与画布合同一致；服务端仍是最终权威。 */
export const MAX_TRANSFER_BYTES = 64 * 1024 * 1024;
/** 导入文件本身的上限，比素材总量略宽以容纳 base64 膨胀，避免读入异常大文件。 */
export const MAX_IMPORT_FILE_BYTES = 96 * 1024 * 1024;
/** 客户端预览用的合同上限；服务端校验才是权威，这里只用于提前给出中文反馈。 */
export const CANVAS_LIMITS = {
  nodes: 200,
  edges: 400,
  assets: 100,
  textLength: 20_000,
  titleLength: 80,
  imageBytes: 16 * 1024 * 1024,
  videoBytes: 64 * 1024 * 1024,
  projectAssetBytes: 512 * 1024 * 1024,
  minNodeSize: 120,
  maxNodeSize: 800,
  coordinate: 100_000,
  minZoom: 0.05,
  maxZoom: 8
} as const;

export const CANVAS_ASSET_MIME_TYPES: readonly CanvasAssetMimeType[] = ["image/png", "image/jpeg", "image/webp", "video/mp4", "video/webm"];

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
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label}不是有效数字。`);
  return value;
}

function readArray(value: unknown, label: string, maximum: number): unknown[] {
  if (!Array.isArray(value)) throw new Error(`导入文件缺少${label}数组。`);
  if (value.length > maximum) throw new Error(`${label}超过上限 ${maximum} 条。`);
  return value;
}

function readTitle(value: unknown): string {
  if (typeof value !== "string") return "导入的画布";
  const title = value.trim().slice(0, CANVAS_LIMITS.titleLength);
  return title || "导入的画布";
}

function readViewport(value: unknown): { x: number; y: number; zoom: number } {
  if (!isRecord(value)) return { x: 0, y: 0, zoom: 1 };
  const x = typeof value.x === "number" && Number.isFinite(value.x) ? clampNumber(value.x, -CANVAS_LIMITS.coordinate, CANVAS_LIMITS.coordinate) : 0;
  const y = typeof value.y === "number" && Number.isFinite(value.y) ? clampNumber(value.y, -CANVAS_LIMITS.coordinate, CANVAS_LIMITS.coordinate) : 0;
  const zoom = typeof value.zoom === "number" && Number.isFinite(value.zoom) ? clampNumber(value.zoom, CANVAS_LIMITS.minZoom, CANVAS_LIMITS.maxZoom) : 1;
  return { x, y, zoom };
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
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${bytes} B`;
}

export function canvasAssetKind(mimeType: string): "image" | "video" | null {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return null;
}

export function canvasExportFileName(title: string): string {
  const safe = title.replace(/[\\/:*?"<>|\u0000-\u001f]+/gu, "-").trim().slice(0, 60);
  return `${safe || "canvas"}.canvas.json`;
}

/** 校验并规范化导入文件；节点与连线会分配新 id，素材 id 保留原名供调用方在上传后重映射。 */
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
  if (raw.formatVersion !== 1) throw new Error(`不支持的画布格式版本：${String(raw.formatVersion)}。`);

  const title = readTitle(raw.title);
  const viewport = readViewport(raw.viewport);
  const assetIds = new Set<string>();
  const assets: CanvasTransferAsset[] = [];
  const rawAssets = readArray(raw.assets, "素材", CANVAS_LIMITS.assets);
  rawAssets.forEach((item, index) => {
    if (!isRecord(item)) throw new Error(`第 ${index + 1} 个素材格式无效。`);
    const name = typeof item.name === "string" && item.name.trim() ? item.name.trim().slice(0, 120) : `素材 ${index + 1}`;
    const mimeType = item.mimeType;
    if (typeof mimeType !== "string" || !CANVAS_ASSET_MIME_TYPES.includes(mimeType as CanvasAssetMimeType)) {
      throw new Error(`素材「${name}」的 MIME 类型不受支持。`);
    }
    if (typeof item.data !== "string") throw new Error(`素材「${name}」缺少 base64 数据。`);
    const bytes = base64ToBytes(item.data);
    if (!bytes.length) throw new Error(`素材「${name}」内容为空。`);
    const typedMimeType = mimeType as CanvasAssetMimeType;
    const limit = typedMimeType.startsWith("image/") ? CANVAS_LIMITS.imageBytes : CANVAS_LIMITS.videoBytes;
    if (bytes.byteLength > limit) throw new Error(`素材「${name}」超过 ${formatCanvasBytes(limit)} 上限。`);
    if (!matchesMimeType(bytes, typedMimeType)) throw new Error(`素材「${name}」的文件内容与 MIME 类型不符。`);
    const oldId = typeof item.assetId === "string" && item.assetId ? item.assetId : `import-asset-${index}`;
    if (assetIds.has(oldId)) throw new Error(`素材 id 重复：${oldId}。`);
    assetIds.add(oldId);
    assets.push({ id: oldId, name, mimeType: typedMimeType, bytes });
  });
  const totalAssetBytes = assets.reduce((total, asset) => total + asset.bytes.byteLength, 0);
  if (totalAssetBytes > CANVAS_LIMITS.projectAssetBytes) throw new Error(`素材总量超过 ${formatCanvasBytes(CANVAS_LIMITS.projectAssetBytes)} 上限。`);

  const nodeIdMap = new Map<string, string>();
  const rawNodes = readArray(raw.nodes, "节点", CANVAS_LIMITS.nodes);
  const nodes: CanvasNode[] = rawNodes.map((item, index) => {
    if (!isRecord(item)) throw new Error(`第 ${index + 1} 个节点格式无效。`);
    const type = item.type;
    if (type !== "text" && type !== "note" && type !== "image" && type !== "video") throw new Error(`第 ${index + 1} 个节点类型不受支持。`);
    const oldId = typeof item.id === "string" && item.id ? item.id : `import-node-${index}`;
    if (nodeIdMap.has(oldId)) throw new Error(`节点 id 重复：${oldId}。`);
    const id = randomId();
    nodeIdMap.set(oldId, id);
    const x = clampNumber(requireFinite(item.x, "节点横坐标"), -CANVAS_LIMITS.coordinate, CANVAS_LIMITS.coordinate);
    const y = clampNumber(requireFinite(item.y, "节点纵坐标"), -CANVAS_LIMITS.coordinate, CANVAS_LIMITS.coordinate);
    const width = clampNumber(typeof item.width === "number" && Number.isFinite(item.width) ? item.width : 300, CANVAS_LIMITS.minNodeSize, CANVAS_LIMITS.maxNodeSize);
    const height = clampNumber(typeof item.height === "number" && Number.isFinite(item.height) ? item.height : 200, CANVAS_LIMITS.minNodeSize, CANVAS_LIMITS.maxNodeSize);
    const data = isRecord(item.data) ? item.data : {};
    const nodeData: Record<string, unknown> = {};
    if (type === "text" || type === "note") nodeData.text = typeof data.text === "string" ? data.text.slice(0, CANVAS_LIMITS.textLength) : "";
    if (type === "image" || type === "video") {
      const assetId = data.assetId;
      if (typeof assetId !== "string" || !assetIds.has(assetId)) throw new Error(`节点「${oldId}」引用的素材不存在。`);
      const asset = assets.find(item => item.id === assetId);
      if (type === "image" && !asset?.mimeType.startsWith("image/")) throw new Error(`图片节点「${oldId}」必须引用图片素材。`);
      if (type === "video" && !asset?.mimeType.startsWith("video/")) throw new Error(`视频节点「${oldId}」必须引用视频素材。`);
      nodeData.assetId = assetId;
      nodeData.assetName = typeof data.assetName === "string" && data.assetName.trim() ? data.assetName.trim().slice(0, 120) : asset?.name ?? "";
    }
    return { id, type, x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height), data: nodeData };
  });

  const rawEdges = readArray(raw.edges, "连线", CANVAS_LIMITS.edges);
  const edges: CanvasEdge[] = rawEdges.map((item, index) => {
    if (!isRecord(item)) throw new Error(`第 ${index + 1} 条连线格式无效。`);
    const source = typeof item.source === "string" ? nodeIdMap.get(item.source) : undefined;
    const target = typeof item.target === "string" ? nodeIdMap.get(item.target) : undefined;
    if (!source || !target) throw new Error(`第 ${index + 1} 条连线的端点不存在。`);
    if (source === target) throw new Error(`第 ${index + 1} 条连线连接了同一节点。`);
    return {
      id: randomId(),
      source,
      target,
      ...(typeof item.sourceHandle === "string" ? { sourceHandle: item.sourceHandle } : {}),
      ...(typeof item.targetHandle === "string" ? { targetHandle: item.targetHandle } : {})
    };
  });

  return { title, viewport, nodes, edges, assets };
}

export function buildCanvasExportDocument(input: CanvasExportInput): Record<string, unknown> {
  return {
    format: "lfaa-canvas-project",
    formatVersion: 1,
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
