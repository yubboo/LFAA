/**
 * 功能：持有系统级无限画布项目与项目素材文件。
 * 作用：按账户与 App 作用域隔离并原子保存画布 JSON 与二进制素材，校验并发版本、引用、大小与坐标边界，拒绝符号链接路径。
 * 关联文件：本包 package.json/README、api/canvas-controller、settings/content-storage-migration、apps/cli/tests/canvas-owner.test.mjs。
 */
import { randomUUID } from "node:crypto";
import {
  createReadStream,
  existsSync,
  lstatSync,
  mkdirSync,
  opendirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  type ReadStream
} from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { isDeepStrictEqual } from "node:util";
import type { Context } from "@deepseek-ai/cordis";
import { resolveUserDataPaths } from "lfaa-home-paths/src/data-layout.mjs";
import { protectPrivateDirectory } from "lfaa-home-paths/src/private-directory.mjs";
import { atomicWrite, atomicWriteBytes } from "lfaa-storage-json/src/index.js";
import { APPLICATION_IDS, type ApplicationId } from "lfaa-util-values/src/application-id.js";

/** 无限画布的数量、大小、文本与坐标边界；控制器和客户端不得复制这些默认值。 */
export const CANVAS_LIMITS = Object.freeze({
  projects: 100,
  nodes: 200,
  edges: 400,
  assets: 100,
  textCharacters: 20_000,
  nodeDataBytes: 64 * 1024,
  coordinate: 100_000,
  nodeMinimumSize: 120,
  nodeMaximumSize: 800,
  minimumZoom: 0.05,
  maximumZoom: 8,
  projectFileBytes: 4 * 1024 * 1024,
  imageBytes: 16 * 1024 * 1024,
  videoBytes: 64 * 1024 * 1024,
  projectAssetBytes: 512 * 1024 * 1024
});

/** 节点类型是 App 可扩展标识，不是固定枚举；具体节点语义归注册该类型的 App。 */
export const CANVAS_NODE_TYPE_PATTERN = /^[a-z][a-z0-9._-]{0,63}$/u;
const PROJECT_FORMAT = "lfaa-canvas-project";
const PROJECT_FORMAT_VERSION = 2;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const PROJECT_FILE_NAME = "project.json";
const ASSETS_DIRECTORY_NAME = "assets";
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const APPLICATION_ID_SET = new Set<string>(APPLICATION_IDS);

export type CanvasAssetMimeType = "image/png" | "image/jpeg" | "image/webp" | "video/mp4" | "video/webm";

const ASSET_MIME_TYPES = new Set<CanvasAssetMimeType>(["image/png", "image/jpeg", "image/webp", "video/mp4", "video/webm"]);
const IMAGE_MIME_TYPES = new Set<CanvasAssetMimeType>(["image/png", "image/jpeg", "image/webp"]);
const STORED_PROJECT_KEYS = ["format", "formatVersion", "applicationId", "id", "title", "viewport", "nodes", "edges", "assets", "createdAt", "updatedAt"];

export interface CanvasProjectSummary {
  id: string;
  applicationId: ApplicationId;
  title: string;
  nodeCount: number;
  assetCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CanvasNode {
  id: string;
  /** 节点类型由 App 注册，本包只校验标识格式与数据边界。 */
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  data: Record<string, unknown>;
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface CanvasAsset {
  assetId: string;
  name: string;
  mimeType: CanvasAssetMimeType;
  bytes: number;
  createdAt: string;
}

export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface CanvasProject {
  format: "lfaa-canvas-project";
  formatVersion: 2;
  /** 画布所属 App 作用域；同一账户不同 App 的画布互不可见。 */
  applicationId: ApplicationId;
  id: string;
  title: string;
  viewport: CanvasViewport;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  assets: CanvasAsset[];
  createdAt: string;
  updatedAt: string;
}

/** 素材读取结果；Range 不可满足时只返回大小，供调用方回 416。 */
export interface CanvasAssetRead {
  stream?: ReadStream;
  mimeType: CanvasAssetMimeType;
  size: number;
  start?: number;
  end?: number;
  rangeNotSatisfiable?: boolean;
}

export interface CanvasService {
  /** 省略 applicationId 时枚举全部 App（画布首页）；提供时只列该 App。 */
  list(userId: string, applicationId?: ApplicationId): CanvasProjectSummary[];
  create(userId: string, applicationId: ApplicationId, title: unknown): CanvasProject;
  read(userId: string, applicationId: ApplicationId, projectId: string): CanvasProject | null;
  update(userId: string, applicationId: ApplicationId, projectId: string, expectedUpdatedAt: string, input: unknown): CanvasProject | null;
  remove(userId: string, applicationId: ApplicationId, projectId: string): boolean;
  uploadAsset(userId: string, applicationId: ApplicationId, projectId: string, expectedUpdatedAt: string, name: unknown, mimeType: unknown, bytes: Buffer): CanvasProject | null;
  removeAsset(userId: string, applicationId: ApplicationId, projectId: string, assetId: string, expectedUpdatedAt: string): CanvasProject | null;
  openAsset(userId: string, applicationId: ApplicationId, projectId: string, assetId: string, rangeHeader?: string): CanvasAssetRead | null;
}

export class CanvasConflictError extends Error {
  constructor() {
    super("画布已在其他位置更新；请重新加载后再保存。");
    this.name = "CanvasConflictError";
  }
}

interface CanvasProjectInput {
  title: string;
  viewport: CanvasViewport;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

interface CanvasBaseLocation {
  userRoot: string;
  projectsRoot: string;
  canvasRoot: string;
}

interface CanvasApplicationLocation extends CanvasBaseLocation {
  applicationId: ApplicationId;
  applicationRoot: string;
}

interface CanvasProjectLocation extends CanvasApplicationLocation {
  id: string;
  directory: string;
}

function fail(message: string): never {
  throw new Error(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizedText(value: unknown, label: string, maximum: number, allowEmpty = false): string {
  if (typeof value !== "string") return fail(label + "必须是文本。");
  const result = value.trim();
  if ((!allowEmpty && !result) || result.length > maximum) return fail(label + "不能为空，且不能超过 " + maximum + " 个字符。");
  return result;
}

function normalizedUuid(value: unknown, label: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) return fail(label + "必须是有效的 UUID。");
  return value.toLowerCase();
}

function normalizedApplicationId(value: unknown): ApplicationId {
  if (typeof value !== "string" || !APPLICATION_ID_SET.has(value)) return fail("画布所属 App 无效；只接受已登记的 App ID。");
  return value as ApplicationId;
}

function normalizedTimestamp(value: unknown, label: string): string {
  const result = normalizedText(value, label, 40);
  if (!Number.isFinite(Date.parse(result))) return fail(label + "必须是有效时间。");
  return result;
}

function normalizedTitle(value: unknown): string {
  return normalizedText(value, "画布名称", 80);
}

function normalizedNodeType(value: unknown): string {
  if (typeof value !== "string" || !CANVAS_NODE_TYPE_PATTERN.test(value)) {
    return fail("画布节点类型无效；必须是小写字母开头、最多 64 个字符的标识。");
  }
  return value;
}

function normalizedCoordinate(value: unknown, label: string): number {
  const coordinate = Number(value);
  if (!Number.isFinite(coordinate) || Math.abs(coordinate) > CANVAS_LIMITS.coordinate) return fail(label + "超出画布可用范围。");
  return Math.round(coordinate);
}

function normalizedNodeSize(value: unknown, label: string): number {
  const size = Number(value);
  if (!Number.isFinite(size) || size < CANVAS_LIMITS.nodeMinimumSize || size > CANVAS_LIMITS.nodeMaximumSize) {
    return fail(label + "必须在 " + CANVAS_LIMITS.nodeMinimumSize + " 到 " + CANVAS_LIMITS.nodeMaximumSize + " 之间。");
  }
  return Math.round(size);
}

function normalizedAssetMimeType(value: unknown): CanvasAssetMimeType {
  const mime = typeof value === "string" ? value.split(";", 1)[0]!.trim().toLocaleLowerCase("en-US") : "";
  if (!ASSET_MIME_TYPES.has(mime as CanvasAssetMimeType)) return fail("素材类型无效；只支持 PNG、JPEG、WebP、MP4 或 WebM。");
  return mime as CanvasAssetMimeType;
}

function maximumAssetBytes(mimeType: CanvasAssetMimeType): number {
  return IMAGE_MIME_TYPES.has(mimeType) ? CANVAS_LIMITS.imageBytes : CANVAS_LIMITS.videoBytes;
}

function normalizeNodeData(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) return fail(label + "数据格式无效。");
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return fail(label + "数据必须是可序列化的 JSON。");
  }
  if (typeof serialized !== "string" || serialized.length > CANVAS_LIMITS.nodeDataBytes) return fail(label + "数据超过 " + CANVAS_LIMITS.nodeDataBytes + " 字节上限。");
  const data = JSON.parse(serialized) as Record<string, unknown>;
  if (data.text !== undefined && (typeof data.text !== "string" || data.text.length > CANVAS_LIMITS.textCharacters)) {
    return fail(label + "文本不能超过 " + CANVAS_LIMITS.textCharacters + " 个字符。");
  }
  return data;
}

function normalizeNodes(value: unknown, assets: CanvasAsset[]): CanvasNode[] {
  if (!Array.isArray(value) || value.length > CANVAS_LIMITS.nodes) return fail("每个画布最多保存 " + CANVAS_LIMITS.nodes + " 个节点。");
  const ids = new Set<string>();
  const assetIds = new Set(assets.map(asset => asset.assetId));
  return value.map((raw, index): CanvasNode => {
    if (!isRecord(raw) || Object.keys(raw).some(key => !["id", "type", "x", "y", "width", "height", "data"].includes(key))) {
      return fail("第 " + (index + 1) + " 个画布节点格式无效。");
    }
    const id = normalizedUuid(raw.id, "节点 ID");
    if (ids.has(id)) return fail("画布节点 ID 重复。");
    ids.add(id);
    const type = normalizedNodeType(raw.type);
    const x = normalizedCoordinate(raw.x, "节点横坐标");
    const y = normalizedCoordinate(raw.y, "节点纵坐标");
    const width = normalizedNodeSize(raw.width, "节点宽度");
    const height = normalizedNodeSize(raw.height, "节点高度");
    const data = normalizeNodeData(raw.data, "第 " + (index + 1) + " 个画布节点");
    if (data.assetId !== undefined) {
      const assetId = normalizedUuid(data.assetId, "节点素材 ID");
      if (!assetIds.has(assetId)) return fail("画布节点引用的素材不存在。");
      data.assetId = assetId;
    }
    return { id, type, x, y, width, height, data };
  });
}

function normalizeEdges(value: unknown, nodes: CanvasNode[]): CanvasEdge[] {
  if (!Array.isArray(value) || value.length > CANVAS_LIMITS.edges) return fail("每个画布最多保存 " + CANVAS_LIMITS.edges + " 条连线。");
  const nodeIds = new Set(nodes.map(node => node.id));
  const ids = new Set<string>();
  return value.map((raw, index): CanvasEdge => {
    if (!isRecord(raw) || Object.keys(raw).some(key => !["id", "source", "target", "sourceHandle", "targetHandle"].includes(key))) {
      return fail("第 " + (index + 1) + " 条画布连线格式无效。");
    }
    const id = normalizedUuid(raw.id, "连线 ID");
    if (ids.has(id)) return fail("画布连线 ID 重复。");
    ids.add(id);
    const source = normalizedUuid(raw.source, "连线起点");
    const target = normalizedUuid(raw.target, "连线终点");
    if (source === target || !nodeIds.has(source) || !nodeIds.has(target)) return fail("连线必须连接两个不同的现有画布节点。");
    const sourceHandle = raw.sourceHandle === undefined ? undefined : normalizedText(raw.sourceHandle, "连线起点手柄", 200, true);
    const targetHandle = raw.targetHandle === undefined ? undefined : normalizedText(raw.targetHandle, "连线终点手柄", 200, true);
    return {
      id,
      source,
      target,
      ...(sourceHandle !== undefined ? { sourceHandle } : {}),
      ...(targetHandle !== undefined ? { targetHandle } : {})
    };
  });
}

function normalizeViewport(value: unknown): CanvasViewport {
  if (!isRecord(value) || Object.keys(value).some(key => !["x", "y", "zoom"].includes(key))) return fail("画布视口格式无效。");
  const x = normalizedCoordinate(value.x, "视口横坐标");
  const y = normalizedCoordinate(value.y, "视口纵坐标");
  const zoom = Number(value.zoom);
  if (!Number.isFinite(zoom) || zoom < CANVAS_LIMITS.minimumZoom || zoom > CANVAS_LIMITS.maximumZoom) {
    return fail("画布缩放必须在 " + CANVAS_LIMITS.minimumZoom + " 到 " + CANVAS_LIMITS.maximumZoom + " 之间。");
  }
  return { x, y, zoom: Number(zoom.toFixed(4)) };
}

function normalizeAsset(value: unknown, index: number, ids: Set<string>): CanvasAsset {
  if (!isRecord(value) || Object.keys(value).some(key => !["assetId", "name", "mimeType", "bytes", "createdAt"].includes(key))) {
    return fail("第 " + (index + 1) + " 个素材记录格式无效。");
  }
  const assetId = normalizedUuid(value.assetId, "素材 ID");
  if (ids.has(assetId)) return fail("画布素材 ID 重复。");
  ids.add(assetId);
  const mimeType = normalizedAssetMimeType(value.mimeType);
  const bytes = Number(value.bytes);
  if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > maximumAssetBytes(mimeType)) return fail("画布素材大小无效。");
  return {
    assetId,
    name: normalizedText(value.name, "素材名称", 120),
    mimeType,
    bytes,
    createdAt: normalizedTimestamp(value.createdAt, "素材创建时间")
  };
}

function normalizeAssets(value: unknown): CanvasAsset[] {
  if (!Array.isArray(value) || value.length > CANVAS_LIMITS.assets) return fail("每个画布最多保存 " + CANVAS_LIMITS.assets + " 个素材。");
  const ids = new Set<string>();
  return value.map((raw, index) => normalizeAsset(raw, index, ids));
}

function normalizeStoredProject(value: unknown, applicationId: ApplicationId, id: string): CanvasProject {
  try {
    if (!isRecord(value) || Object.keys(value).some(key => !STORED_PROJECT_KEYS.includes(key))) throw new Error("结构");
    if (value.format !== PROJECT_FORMAT || value.formatVersion !== PROJECT_FORMAT_VERSION) throw new Error("版本");
    if (normalizedApplicationId(value.applicationId) !== applicationId) throw new Error("App");
    if (normalizedUuid(value.id, "项目 ID") !== id) throw new Error("ID");
    const title = normalizedTitle(value.title);
    const viewport = normalizeViewport(value.viewport);
    const assets = normalizeAssets(value.assets);
    const nodes = normalizeNodes(value.nodes, assets);
    const edges = normalizeEdges(value.edges, nodes);
    const createdAt = normalizedTimestamp(value.createdAt, "创建时间");
    const updatedAt = normalizedTimestamp(value.updatedAt, "更新时间");
    return {
      format: PROJECT_FORMAT,
      formatVersion: PROJECT_FORMAT_VERSION,
      applicationId,
      id,
      title,
      viewport,
      nodes,
      edges,
      assets,
      createdAt,
      updatedAt
    };
  } catch {
    throw new Error("无限画布项目文件格式无效；原文件已保留。");
  }
}

function normalizeProjectInput(value: unknown, current: CanvasProject): CanvasProjectInput {
  if (!isRecord(value)) return fail("画布项目格式无效。");
  const allowed = ["format", "formatVersion", "applicationId", "id", "title", "viewport", "nodes", "edges", "assets", "createdAt", "updatedAt"];
  if (Object.keys(value).some(key => !allowed.includes(key))) return fail("画布项目包含未知字段。");
  if (value.format !== undefined && value.format !== PROJECT_FORMAT) return fail("画布项目格式标识无效。");
  if (value.formatVersion !== undefined && value.formatVersion !== PROJECT_FORMAT_VERSION) return fail("画布项目格式版本不受支持。");
  if (value.applicationId !== undefined && normalizedApplicationId(value.applicationId) !== current.applicationId) {
    return fail("画布 App 作用域与目标项目不一致，拒绝跨 App 写入。");
  }
  if (value.id !== undefined && normalizedUuid(value.id, "项目 ID") !== current.id) return fail("画布项目 ID 与目标不一致。");
  if (value.createdAt !== undefined && normalizedTimestamp(value.createdAt, "创建时间") !== current.createdAt) return fail("画布创建时间与已保存项目不一致。");
  const nodes = normalizeNodes(value.nodes, current.assets);
  return {
    title: normalizedTitle(value.title),
    viewport: value.viewport === undefined ? current.viewport : normalizeViewport(value.viewport),
    nodes,
    edges: normalizeEdges(value.edges, nodes)
  };
}

function nextTimestamp(previous: string): string {
  const now = Date.now();
  const previousMillis = Date.parse(previous);
  return new Date(Number.isFinite(previousMillis) && now <= previousMillis ? previousMillis + 1 : now).toISOString();
}

function assertWithin(root: string, path: string): void {
  const relativePath = relative(resolve(root), resolve(path));
  if (!relativePath || relativePath === ".." || relativePath.startsWith(".." + sep) || isAbsolute(relativePath)) {
    throw new Error("无限画布项目路径越界，拒绝访问。");
  }
}

function rejectSymlinkOrWrongType(path: string, expected: "directory" | "file"): void {
  let info: ReturnType<typeof lstatSync>;
  try {
    info = lstatSync(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  if (info.isSymbolicLink() || (expected === "directory" ? !info.isDirectory() : !info.isFile())) {
    throw new Error("无限画布存储路径类型无效；拒绝跟随符号链接。");
  }
}

function dataDirectory(): string {
  const value = process.env.LFAA_DATA_DIR?.trim();
  if (!value) throw new Error("无限画布数据目录未配置，无法访问项目文件。");
  return value;
}

function canvasBaseLocation(userId: string): CanvasBaseLocation {
  const userPaths = resolveUserDataPaths(dataDirectory(), userId);
  const canvasRoot = resolve(userPaths.projects, "canvas");
  assertWithin(userPaths.projects, canvasRoot);
  return { userRoot: userPaths.root, projectsRoot: userPaths.projects, canvasRoot };
}

function applicationLocation(userId: string, applicationId: ApplicationId): CanvasApplicationLocation {
  const targetApplication = normalizedApplicationId(applicationId);
  const base = canvasBaseLocation(userId);
  const applicationRoot = resolve(base.canvasRoot, targetApplication);
  assertWithin(base.canvasRoot, applicationRoot);
  rejectSymlinkOrWrongType(applicationRoot, "directory");
  return { ...base, applicationId: targetApplication, applicationRoot };
}

function projectLocation(userId: string, applicationId: ApplicationId, projectId: string): CanvasProjectLocation {
  const application = applicationLocation(userId, applicationId);
  const id = normalizedUuid(projectId, "项目 ID");
  const directory = resolve(application.applicationRoot, id);
  assertWithin(application.applicationRoot, directory);
  return { ...application, id, directory };
}

function assertCanvasChain(base: CanvasBaseLocation): void {
  rejectSymlinkOrWrongType(base.userRoot, "directory");
  rejectSymlinkOrWrongType(base.projectsRoot, "directory");
  rejectSymlinkOrWrongType(base.canvasRoot, "directory");
}

function ensureCanvasRoot(userId: string): CanvasBaseLocation {
  const base = canvasBaseLocation(userId);
  assertCanvasChain(base);
  mkdirSync(base.canvasRoot, { recursive: true, mode: 0o700 });
  assertCanvasChain(base);
  protectPrivateDirectory(base.canvasRoot);
  return base;
}

function ensureApplicationRoot(userId: string, applicationId: ApplicationId): CanvasApplicationLocation {
  const base = ensureCanvasRoot(userId);
  const targetApplication = normalizedApplicationId(applicationId);
  const applicationRoot = resolve(base.canvasRoot, targetApplication);
  assertWithin(base.canvasRoot, applicationRoot);
  rejectSymlinkOrWrongType(applicationRoot, "directory");
  if (!existsSync(applicationRoot)) mkdirSync(applicationRoot, { recursive: false, mode: 0o700 });
  rejectSymlinkOrWrongType(applicationRoot, "directory");
  return { ...base, applicationId: targetApplication, applicationRoot };
}

function projectManifestPath(location: CanvasProjectLocation): string {
  const path = resolve(location.directory, PROJECT_FILE_NAME);
  assertWithin(location.directory, path);
  return path;
}

function projectAssetsDirectory(location: CanvasProjectLocation, create: boolean): string {
  const directory = resolve(location.directory, ASSETS_DIRECTORY_NAME);
  assertWithin(location.directory, directory);
  rejectSymlinkOrWrongType(directory, "directory");
  if (create && !existsSync(directory)) mkdirSync(directory, { recursive: false, mode: 0o700 });
  return directory;
}

function projectAssetPath(location: CanvasProjectLocation, assetId: string, createDirectory = false): string {
  const id = normalizedUuid(assetId, "素材 ID");
  const directory = projectAssetsDirectory(location, createDirectory);
  const path = resolve(directory, id);
  assertWithin(directory, path);
  rejectSymlinkOrWrongType(path, "file");
  return path;
}

function readProject(userId: string, applicationId: ApplicationId, projectId: string): CanvasProject | null {
  const location = projectLocation(userId, applicationId, projectId);
  assertCanvasChain(location);
  rejectSymlinkOrWrongType(location.directory, "directory");
  if (!existsSync(location.directory)) return null;
  const manifestPath = projectManifestPath(location);
  rejectSymlinkOrWrongType(manifestPath, "file");
  if (!existsSync(manifestPath)) throw new Error("无限画布项目清单缺失；原目录已保留。");
  const bytes = readFileSync(manifestPath);
  if (bytes.byteLength > CANVAS_LIMITS.projectFileBytes) throw new Error("无限画布项目文件超过大小限制；原文件已保留。");
  const text = bytes.toString("utf8");
  if (!Buffer.from(text, "utf8").equals(bytes)) throw new Error("无限画布项目文件编码无效；原文件已保留。");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("无限画布项目文件不是有效 JSON；原文件已保留。");
  }
  return normalizeStoredProject(raw, location.applicationId, location.id);
}

function writeProject(userId: string, project: CanvasProject, createDirectory: boolean): void {
  const location = projectLocation(userId, project.applicationId, project.id);
  assertCanvasChain(location);
  rejectSymlinkOrWrongType(location.directory, "directory");
  const createdDirectory = !existsSync(location.directory);
  if (createdDirectory) {
    if (!createDirectory) throw new Error("无限画布项目目录不存在；拒绝写入。");
    mkdirSync(location.directory, { recursive: false, mode: 0o700 });
  }
  try {
    const manifestPath = projectManifestPath(location);
    rejectSymlinkOrWrongType(manifestPath, "file");
    if (Buffer.byteLength(JSON.stringify(project), "utf8") > CANVAS_LIMITS.projectFileBytes) return fail("无限画布项目数据超过大小限制。");
    atomicWrite(manifestPath, project);
    const readback = readProject(userId, project.applicationId, project.id);
    // 写入后回读并比较规范化对象，避免受损文件被当成成功保存。
    if (!readback || !isDeepStrictEqual(readback, project)) throw new Error("无限画布项目写入回读校验失败。");
  } catch (error) {
    if (createdDirectory && existsSync(location.directory)) rmSync(location.directory, { recursive: true, force: true });
    throw error;
  }
}

function readProjectDirectoryNames(applicationRoot: string): string[] {
  const names: string[] = [];
  const directory = opendirSync(applicationRoot);
  let entryCount = 0;
  try {
    while (true) {
      const entry = directory.readSync();
      if (!entry) break;
      entryCount += 1;
      if (entryCount > CANVAS_LIMITS.projects + 4) throw new Error("无限画布项目目录项超过有界读取上限；文件已保留。");
      if (entry.isSymbolicLink()) throw new Error("无限画布项目目录含符号链接；拒绝跟随链接读取。");
      if (!entry.isDirectory()) continue;
      names.push(normalizedUuid(entry.name, "项目目录名"));
      if (names.length > CANVAS_LIMITS.projects) throw new Error("每个 App 每个账户最多保存 " + CANVAS_LIMITS.projects + " 个画布项目。");
    }
  } finally {
    try {
      directory.closeSync();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ERR_DIR_CLOSED") throw error;
    }
  }
  return names.sort();
}

/** 只枚举已登记 App 的目录；旧 v1 的 UUID 项目目录不读取，也不迁移。 */
function readApplicationDirectoryNames(canvasRoot: string): ApplicationId[] {
  const names: ApplicationId[] = [];
  const directory = opendirSync(canvasRoot);
  let entryCount = 0;
  try {
    while (true) {
      const entry = directory.readSync();
      if (!entry) break;
      entryCount += 1;
      if (entryCount > APPLICATION_IDS.length + 8) throw new Error("无限画布 App 目录项超过有界读取上限；文件已保留。");
      if (entry.isSymbolicLink()) throw new Error("无限画布 App 目录含符号链接；拒绝跟随链接读取。");
      if (!entry.isDirectory()) continue;
      if (APPLICATION_ID_SET.has(entry.name)) names.push(entry.name as ApplicationId);
    }
  } finally {
    try {
      directory.closeSync();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ERR_DIR_CLOSED") throw error;
    }
  }
  return names.sort();
}

function projectSummary(project: CanvasProject): CanvasProjectSummary {
  return {
    id: project.id,
    applicationId: project.applicationId,
    title: project.title,
    nodeCount: project.nodes.length,
    assetCount: project.assets.length,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt
  };
}

function storedAssetBytes(location: CanvasProjectLocation, project: CanvasProject): number {
  let total = 0;
  for (const asset of project.assets) {
    const path = projectAssetPath(location, asset.assetId);
    if (!existsSync(path)) continue;
    total += lstatSync(path).size;
  }
  return total;
}

function validateAssetBytes(bytes: Buffer, mimeType: CanvasAssetMimeType): Buffer {
  if (!Buffer.isBuffer(bytes) || bytes.byteLength < 1) return fail("素材文件为空或内容无效。");
  if (bytes.byteLength > maximumAssetBytes(mimeType)) {
    return fail("素材文件超过 " + Math.round(maximumAssetBytes(mimeType) / (1024 * 1024)) + " MiB 上限。");
  }
  const matches = mimeType === "image/png"
    ? bytes.byteLength >= PNG_SIGNATURE.byteLength && bytes.subarray(0, PNG_SIGNATURE.byteLength).equals(PNG_SIGNATURE)
    : mimeType === "image/jpeg"
      ? bytes.byteLength >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : mimeType === "image/webp"
        ? bytes.byteLength >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP"
        : mimeType === "video/mp4"
          ? bytes.byteLength >= 12 && bytes.toString("ascii", 4, 8) === "ftyp"
          : bytes.byteLength >= 4 && bytes.toString("hex", 0, 4) === "1a45dfa3";
  if (!matches) return fail("素材文件内容与声明的图片或视频格式不一致。");
  return bytes;
}

function normalizedAssetName(value: unknown, mimeType: CanvasAssetMimeType): string {
  const raw = (typeof value === "string" ? value.split(/[\\/]/u).pop() ?? "" : "").trim();
  if (raw.length > 120) return fail("素材名称不能超过 120 个字符。");
  const cleaned = raw.replace(/[\\/:*?"<>|\u0000-\u001f]/gu, "_");
  return cleaned || "未命名素材." + (mimeType.split("/", 2)[1] ?? "bin");
}

function parseRange(rangeHeader: string, size: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/u.exec(rangeHeader.trim());
  if (!match || (!match[1] && !match[2])) return null;
  let start: number;
  let end: number;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= size || end >= size) return null;
  return { start, end };
}

export function listCanvasProjects(userId: string, applicationId?: ApplicationId): CanvasProjectSummary[] {
  const base = canvasBaseLocation(userId);
  assertCanvasChain(base);
  if (!existsSync(base.canvasRoot)) return [];
  const applications = applicationId === undefined
    ? readApplicationDirectoryNames(base.canvasRoot)
    : [normalizedApplicationId(applicationId)];
  const summaries: CanvasProjectSummary[] = [];
  for (const targetApplication of applications) {
    const applicationRoot = resolve(base.canvasRoot, targetApplication);
    assertWithin(base.canvasRoot, applicationRoot);
    rejectSymlinkOrWrongType(applicationRoot, "directory");
    if (!existsSync(applicationRoot)) continue;
    for (const projectId of readProjectDirectoryNames(applicationRoot)) {
      const project = readProject(userId, targetApplication, projectId);
      if (project) summaries.push(projectSummary(project));
    }
  }
  return summaries.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.title.localeCompare(right.title, "zh-CN"));
}

export function createCanvasProject(userId: string, applicationId: ApplicationId, title: unknown): CanvasProject {
  const targetApplication = normalizedApplicationId(applicationId);
  const normalized = normalizedTitle(title);
  const location = ensureApplicationRoot(userId, targetApplication);
  if (readProjectDirectoryNames(location.applicationRoot).length >= CANVAS_LIMITS.projects) {
    return fail("每个 App 每个账户最多保存 " + CANVAS_LIMITS.projects + " 个画布项目。");
  }
  const now = new Date().toISOString();
  const project: CanvasProject = {
    format: PROJECT_FORMAT,
    formatVersion: PROJECT_FORMAT_VERSION,
    applicationId: targetApplication,
    id: randomUUID(),
    title: normalized,
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [],
    edges: [],
    assets: [],
    createdAt: now,
    updatedAt: now
  };
  writeProject(userId, project, true);
  return project;
}

export function readCanvasProject(userId: string, applicationId: ApplicationId, projectId: string): CanvasProject | null {
  return readProject(userId, applicationId, projectId);
}

export function updateCanvasProject(userId: string, applicationId: ApplicationId, projectId: string, expectedUpdatedAt: string, input: unknown): CanvasProject | null {
  const targetApplication = normalizedApplicationId(applicationId);
  const id = normalizedUuid(projectId, "项目 ID");
  const expected = normalizedTimestamp(expectedUpdatedAt, "预期更新时间");
  const current = readProject(userId, targetApplication, id);
  if (!current) return null;
  if (current.updatedAt !== expected) throw new CanvasConflictError();
  const normalized = normalizeProjectInput(input, current);
  const next: CanvasProject = {
    ...current,
    title: normalized.title,
    viewport: normalized.viewport,
    nodes: normalized.nodes,
    edges: normalized.edges,
    updatedAt: nextTimestamp(current.updatedAt)
  };
  writeProject(userId, next, false);
  return next;
}

export function deleteCanvasProject(userId: string, applicationId: ApplicationId, projectId: string): boolean {
  const location = projectLocation(userId, applicationId, projectId);
  assertCanvasChain(location);
  rejectSymlinkOrWrongType(location.directory, "directory");
  if (!existsSync(location.directory)) return false;
  // 删除前确认清单可读，避免静默删除无法核对的项目数据。
  readProject(userId, location.applicationId, location.id);
  rmSync(location.directory, { recursive: true, force: false });
  return true;
}

export function uploadCanvasAsset(userId: string, applicationId: ApplicationId, projectId: string, expectedUpdatedAt: string, name: unknown, mimeType: unknown, bytes: Buffer): CanvasProject | null {
  const targetApplication = normalizedApplicationId(applicationId);
  const id = normalizedUuid(projectId, "项目 ID");
  const expected = normalizedTimestamp(expectedUpdatedAt, "预期更新时间");
  const contentType = normalizedAssetMimeType(mimeType);
  const assetName = normalizedAssetName(name, contentType);
  const content = validateAssetBytes(bytes, contentType);
  const current = readProject(userId, targetApplication, id);
  if (!current) return null;
  if (current.updatedAt !== expected) throw new CanvasConflictError();
  if (current.assets.length >= CANVAS_LIMITS.assets) {
    return fail("每个画布最多保存 " + CANVAS_LIMITS.assets + " 个素材；请先删除不再使用的素材。");
  }
  const location = projectLocation(userId, targetApplication, id);
  if (storedAssetBytes(location, current) + content.byteLength > CANVAS_LIMITS.projectAssetBytes) {
    return fail("画布素材合计超过 512 MiB 上限；没有保存该文件。");
  }
  const asset: CanvasAsset = {
    assetId: randomUUID(),
    name: assetName,
    mimeType: contentType,
    bytes: content.byteLength,
    createdAt: new Date().toISOString()
  };
  const path = projectAssetPath(location, asset.assetId, true);
  if (existsSync(path)) return fail("素材 ID 冲突；拒绝覆盖现有文件。");
  let created = false;
  try {
    atomicWriteBytes(path, content);
    created = true;
    const next: CanvasProject = { ...current, assets: [...current.assets, asset], updatedAt: nextTimestamp(current.updatedAt) };
    writeProject(userId, next, false);
    return next;
  } catch (error) {
    if (created && existsSync(path)) {
      try {
        unlinkSync(path);
      } catch {
        // 原始保存错误优先；遗留文件仍计入后续素材容量校验。
      }
    }
    throw error;
  }
}

export function removeCanvasAsset(userId: string, applicationId: ApplicationId, projectId: string, assetId: string, expectedUpdatedAt: string): CanvasProject | null {
  const targetApplication = normalizedApplicationId(applicationId);
  const id = normalizedUuid(projectId, "项目 ID");
  const targetId = normalizedUuid(assetId, "素材 ID");
  const expected = normalizedTimestamp(expectedUpdatedAt, "预期更新时间");
  const current = readProject(userId, targetApplication, id);
  if (!current) return null;
  if (current.updatedAt !== expected) throw new CanvasConflictError();
  const asset = current.assets.find(item => item.assetId === targetId);
  if (!asset) return fail("找不到要删除的画布素材。");
  const referenced = current.nodes.some(node => node.data.assetId === targetId);
  if (referenced) return fail("该素材仍被画布节点引用；请先移除引用后再删除。");
  const next: CanvasProject = {
    ...current,
    assets: current.assets.filter(item => item.assetId !== targetId),
    updatedAt: nextTimestamp(current.updatedAt)
  };
  writeProject(userId, next, false);
  try {
    const path = projectAssetPath(projectLocation(userId, targetApplication, id), targetId);
    if (existsSync(path)) unlinkSync(path);
  } catch {
    // 清单提交后清理失败不应谎报事务失败；遗留文件仍受项目素材容量约束。
  }
  return next;
}

export function openCanvasAsset(userId: string, applicationId: ApplicationId, projectId: string, assetId: string, rangeHeader?: string): CanvasAssetRead | null {
  const targetApplication = normalizedApplicationId(applicationId);
  const id = normalizedUuid(projectId, "项目 ID");
  const targetId = normalizedUuid(assetId, "素材 ID");
  const project = readProject(userId, targetApplication, id);
  if (!project) return null;
  const asset = project.assets.find(item => item.assetId === targetId);
  if (!asset) return null;
  const path = projectAssetPath(projectLocation(userId, targetApplication, id), targetId);
  if (!existsSync(path)) return null;
  const size = lstatSync(path).size;
  if (size < 1 || size > maximumAssetBytes(asset.mimeType)) throw new Error("无限画布素材超过读取上限；项目文件已保留。");
  if (rangeHeader === undefined || rangeHeader === "") {
    return { stream: createReadStream(path, { start: 0, end: size - 1 }), mimeType: asset.mimeType, size, start: 0, end: size - 1 };
  }
  const range = parseRange(rangeHeader, size);
  if (!range) return { mimeType: asset.mimeType, size, rangeNotSatisfiable: true };
  return { stream: createReadStream(path, { start: range.start, end: range.end }), mimeType: asset.mimeType, size, start: range.start, end: range.end };
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    lfaaCanvas: CanvasService;
  }
}

export const name = "lfaaCanvas";

export function apply(ctx: Context): void {
  const service: CanvasService = {
    list: listCanvasProjects,
    create: createCanvasProject,
    read: readCanvasProject,
    update: updateCanvasProject,
    remove: deleteCanvasProject,
    uploadAsset: uploadCanvasAsset,
    removeAsset: removeCanvasAsset,
    openAsset: openCanvasAsset
  };
  ctx.provide(name, service);
}
