/**
 * 功能：系统级无限画布工作区（即梦式主题驱动沉浸画布）。
 * 作用：在 /apps/<app>/canvas[/:projectId] 提供全幅画布、左侧浮层工具轨、顶部浮层（返回/项目切换/保存状态/生成|画布/对话/设置）、
 *      点阵网格、平移缩放、Shift 框选、多选、连线、撤销重做、小地图（受设置控制）、节点编辑、生成工作台、资产库、导入导出与 409 冲突处理。
 *      所有数据读写都经画布 Owner 的认证 API；生成调用画布生成 Owner，未配置时展示服务端真实错误并引导到设置中心。
 * 不负责：权限判断、账户隔离与数据校验（服务端权威）；不伪造生成结果。
 * 关联文件：CanvasNodeCards.tsx、CanvasAssetPanel.tsx、CanvasProjectTransfer.ts、CanvasHome.tsx、canvas-workspace.css。
 */
import {
  addEdge, Background, BackgroundVariant, MarkerType, MiniMap, ReactFlow, useEdgesState, useNodesState,
  type Connection, type Edge, type EdgeChange, type NodeChange, type ReactFlowInstance, type Viewport
} from "@xyflow/react";
import {
  AudioOutlined, BarsOutlined, EllipsisOutlined, FileTextOutlined,
  FolderOpenOutlined, MessageOutlined, PictureOutlined, RedoOutlined, SaveOutlined,
  SettingOutlined, SmileOutlined, TableOutlined, ToolOutlined, UndoOutlined, UploadOutlined, VideoCameraOutlined
} from "@ant-design/icons";
import { Alert, Button, Dropdown, Input, Segmented, Select, Spin, Tooltip, Typography } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  ApiError, cancelCanvasVideo, createCanvasProject, deleteCanvasAsset, deleteCanvasProject, generateCanvasImage, getErrorMessage,
  loadCanvasProject, loadCanvasProjects, refreshCanvasVideo, saveCanvasProject, startCanvasVideo, uploadCanvasAsset,
  type ApplicationId, type CanvasAsset, type CanvasEdge, type CanvasNode, type CanvasProject, type CanvasProjectSummary, type UserSettings
} from "lfaa-client-connection/src/api.js";
import { ResizableWorkbench } from "lfaa-client-ui-dockkit/src/ResizableWorkbench.js";
import { useWorkbenchMetrics } from "lfaa-client-ui-dockkit/src/use-workbench-metrics.js";
import { resolveWorkbenchLayoutMetrics } from "lfaa-client-ui-dockkit/src/workbench-layout.config.js";
import type { WorkbenchLayoutMetrics } from "lfaa-client-ui-dockkit/src/workbench-layout.config.js";
import type { WorkbenchPaneLimits } from "lfaa-client-ui-dockkit/src/workbench-layout.types.js";
import { CanvasAssetPanel, type CanvasProjectAsset } from "./CanvasAssetPanel.js";
import { CanvasDirectorDeskEditor } from "./CanvasDirectorDeskEditor.js";
import {
  CANVAS_ASPECT_RATIO_OPTIONS, CANVAS_LIMITS, MAX_IMPORT_FILE_BYTES, MAX_TRANSFER_BYTES,
  buildCanvasExportDocument, buildCanvasProjectPayload, canvasAssetByteLimit, canvasAssetKind, canvasExportFileName,
  collectCanvasExportAssets, estimateBase64Length, formatCanvasBytes, importCanvasProject, normalizeCanvasNodeData,
  parseCanvasImport, resolveCanvasSettings,
  type CanvasAspectRatio, type CanvasGenerationData, type CanvasNodeKind
} from "./CanvasProjectTransfer.js";
import {
  CANVAS_NODE_LABELS, CANVAS_NODE_TYPES, CanvasNodeContextProvider,
  type CanvasFlowNode, type CanvasNodeCallbacks, type CanvasNodeData, type CanvasNodeOption
} from "./CanvasNodeCards.js";
import "@xyflow/react/dist/style.css";
import "./canvas-workspace.css";

type CanvasMode = "generate" | "canvas";
type CanvasOperation = "upload" | "asset-delete" | "import" | "export";
type CanvasSnapshot = { nodes: CanvasFlowNode[]; edges: Edge[] };

const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };
const EMPTY_ASSETS: CanvasAsset[] = [];
const HISTORY_LIMIT = 50;
const TEXT_HISTORY_DELAY_MS = 700;
/** 画布助手右栏上限占工作区 40%，保证中心画布始终更宽。 */
const CANVAS_CHAT_MAX_WIDTH_SHARE = 0.4;

/** 新建节点的默认尺寸；仍受画布服务端 120–800 的权威范围校验。 */
const NODE_DEFAULT_SIZE: Record<CanvasNodeKind, { width: number; height: number }> = {
  text: { width: 320, height: 220 },
  note: { width: 280, height: 190 },
  image: { width: 320, height: 260 },
  video: { width: 320, height: 260 },
  audio: { width: 320, height: 190 },
  generation: { width: 340, height: 300 },
  subject: { width: 340, height: 360 },
  timeline: { width: 380, height: 340 },
  "director-toolbox": { width: 340, height: 300 },
  "director-desk": { width: 340, height: 300 },
  script: { width: 360, height: 340 },
  asset: { width: 300, height: 220 }
};

/** 左侧图标工具轨；资产库/上传是动作入口，不是节点类型。 */
const RAIL_ITEMS: ReadonlyArray<{ key: CanvasNodeKind | "assets" | "upload"; label: string; icon: ReactNode; testId: string; separatorBefore?: boolean }> = [
  { key: "text", label: "文本", icon: <FileTextOutlined />, testId: "canvas-rail-text" },
  { key: "image", label: "图片", icon: <PictureOutlined />, testId: "canvas-rail-image" },
  { key: "video", label: "视频", icon: <VideoCameraOutlined />, testId: "canvas-rail-video" },
  { key: "audio", label: "音频", icon: <AudioOutlined />, testId: "canvas-rail-audio" },
  { key: "timeline", label: "时间线", icon: <BarsOutlined />, testId: "canvas-rail-timeline" },
  { key: "subject", label: "主体", icon: <SmileOutlined />, testId: "canvas-rail-subject" },
  { key: "director-toolbox", label: "导演工具箱", icon: <ToolOutlined />, testId: "canvas-rail-toolbox" },
  { key: "director-desk", label: "导演台", icon: <TableOutlined />, testId: "canvas-rail-desk" },
  { key: "assets", label: "资产库", icon: <FolderOpenOutlined />, testId: "canvas-rail-assets", separatorBefore: true },
  { key: "upload", label: "上传", icon: <UploadOutlined />, testId: "canvas-rail-upload" }
];

const ADD_MENU_ITEMS: ReadonlyArray<{ kind: CanvasNodeKind; label: string }> = [
  { kind: "text", label: "文本节点" },
  { kind: "note", label: "备注节点" },
  { kind: "script", label: "剧本节点" },
  { kind: "subject", label: "主体节点" },
  { kind: "timeline", label: "时间线节点" },
  { kind: "director-toolbox", label: "导演工具箱" },
  { kind: "director-desk", label: "导演台" },
  { kind: "generation", label: "生成节点" }
];

function clampCoordinate(value: number): number {
  return Math.min(CANVAS_LIMITS.coordinate, Math.max(-CANVAS_LIMITS.coordinate, value));
}

function clampNodeSize(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(CANVAS_LIMITS.maxNodeSize, Math.max(CANVAS_LIMITS.minNodeSize, Math.round(value)));
}

function styleSize(value: unknown, fallback: number): number {
  if (typeof value === "number") return clampNodeSize(value, fallback);
  if (typeof value === "string") return clampNodeSize(Number.parseFloat(value), fallback);
  return fallback;
}

function canvasErrorText(error: unknown, fallback: string): string {
  const message = getErrorMessage(error);
  return !message || message === "发生了未知错误，请重试。" ? fallback : message;
}

function isConflictError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function summaryFor(project: CanvasProject, nodeCount = project.nodes.length): CanvasProjectSummary {
  return {
    id: project.id,
    title: project.title,
    applicationId: project.applicationId,
    nodeCount,
    assetCount: project.assets.length,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt
  };
}

function upsertSummary(list: CanvasProjectSummary[], summary: CanvasProjectSummary): CanvasProjectSummary[] {
  const index = list.findIndex(item => item.id === summary.id);
  if (index === -1) return [summary, ...list];
  const next = list.slice();
  next[index] = summary;
  return next;
}

function knownKind(value: string): CanvasNodeKind | null {
  return (Object.keys(NODE_DEFAULT_SIZE) as CanvasNodeKind[]).includes(value as CanvasNodeKind) ? value as CanvasNodeKind : null;
}

/** 服务端保存的 data 形状 → 节点卡片使用的界面字段；只映射合同 5.2 的字段。 */
function uiPatchFromPersisted(kind: CanvasNodeKind, data: Record<string, unknown>): Partial<CanvasNodeData> {
  switch (kind) {
    case "text":
    case "note":
      return { text: typeof data.text === "string" ? data.text.slice(0, CANVAS_LIMITS.textLength) : "" };
    case "image":
    case "video":
    case "audio":
    case "asset": {
      const patch: Partial<CanvasNodeData> = {};
      if (typeof data.assetId === "string") patch.assetId = data.assetId;
      if (typeof data.assetName === "string") patch.assetName = data.assetName;
      return patch;
    }
    case "generation":
      return isRecord(data.generation) ? { generation: data.generation as unknown as CanvasGenerationData } : {};
    case "subject":
      return isRecord(data.subject) ? { subject: data.subject as unknown as CanvasNodeData["subject"] } : {};
    case "timeline":
      return isRecord(data.timeline) ? { timeline: data.timeline as unknown as CanvasNodeData["timeline"] } : {};
    case "director-toolbox":
      return isRecord(data.preset) ? { preset: data.preset as unknown as CanvasNodeData["preset"] } : {};
    case "director-desk":
      return isRecord(data.desk) ? { desk: data.desk as unknown as CanvasNodeData["desk"] } : {};
    case "script":
      return isRecord(data.script) ? { script: data.script as unknown as CanvasNodeData["script"] } : {};
    default:
      return {};
  }
}

/** 新建节点时写入的空数据；随后由用户在卡片里真实编辑。 */
function defaultUiData(kind: CanvasNodeKind): Partial<CanvasNodeData> {
  switch (kind) {
    case "text":
    case "note":
      return { text: "" };
    case "generation":
      return { generation: { kind: "image", prompt: "", status: "idle" } };
    case "subject":
      return { subject: { name: "", kind: "character", description: "", assetIds: [] } };
    case "timeline":
      return { timeline: { clips: [], durationSeconds: 0 } };
    case "director-toolbox":
      return { preset: { name: "", promptSuffix: "" } };
    case "director-desk":
      return { desk: { shotNodeIds: [] } };
    case "script":
      return { script: { title: "", body: "", status: "draft" } };
    default:
      return {};
  }
}

function flowNodesFrom(project: CanvasProject, callbacks: CanvasNodeCallbacks): { nodes: CanvasFlowNode[]; unsupported: CanvasNode[] } {
  const unsupported: CanvasNode[] = [];
  const nodes: CanvasFlowNode[] = [];
  for (const node of project.nodes) {
    const kind = knownKind(node.type);
    if (!kind) {
      unsupported.push(node);
      continue;
    }
    const defaultSize = NODE_DEFAULT_SIZE[kind];
    nodes.push({
      id: node.id,
      type: kind,
      position: { x: node.x, y: node.y },
      style: { width: styleSize(node.width, defaultSize.width), height: styleSize(node.height, defaultSize.height) },
      data: {
        kind,
        applicationId: project.applicationId,
        projectId: project.id,
        text: "",
        ...uiPatchFromPersisted(kind, node.data),
        ...callbacks
      }
    });
  }
  return { nodes, unsupported };
}

function flowEdgesFrom(project: CanvasProject, knownNodeIds: Set<string>): { edges: Edge[]; unsupported: CanvasEdge[] } {
  const edges: Edge[] = [];
  const unsupported: CanvasEdge[] = [];
  for (const edge of project.edges) {
    if (!knownNodeIds.has(edge.source) || !knownNodeIds.has(edge.target)) {
      unsupported.push(edge);
      continue;
    }
    edges.push({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      ...(edge.sourceHandle ? { sourceHandle: edge.sourceHandle } : {}),
      ...(edge.targetHandle ? { targetHandle: edge.targetHandle } : {}),
      type: "smoothstep"
    });
  }
  return { edges, unsupported };
}

function persistedNodesFrom(flowNodes: CanvasFlowNode[], project: CanvasProject, unsupported: CanvasNode[]): CanvasNode[] {
  const assetIds = new Set(project.assets.map(asset => asset.assetId));
  const assetNames = new Map(project.assets.map(asset => [asset.assetId, asset.name] as const));
  const assetMimeTypes = new Map(project.assets.map(asset => [asset.assetId, asset.mimeType] as const));
  const nodeIds = new Set(flowNodes.map(node => node.id));
  const context = { assetIds, assetNames, assetMimeTypes, nodeIds };
  const stored = flowNodes.map(node => {
    const defaultSize = NODE_DEFAULT_SIZE[node.data.kind];
    try {
      const data = normalizeCanvasNodeData(node.data.kind, node.data, context);
      return {
        id: node.id,
        type: node.data.kind,
        x: clampCoordinate(Math.round(node.position.x)),
        y: clampCoordinate(Math.round(node.position.y)),
        width: clampNodeSize(node.measured?.width ?? styleSize(node.style?.width, defaultSize.width), defaultSize.width),
        height: clampNodeSize(node.measured?.height ?? styleSize(node.style?.height, defaultSize.height), defaultSize.height),
        data
      } satisfies CanvasNode;
    } catch (error) {
      throw new Error("「" + CANVAS_NODE_LABELS[node.data.kind] + "」节点无法保存：" + (error instanceof Error ? error.message : "数据无效。"));
    }
  });
  return [...stored, ...unsupported];
}

function persistedEdgesFrom(flowEdges: Edge[], unsupported: CanvasEdge[]): CanvasEdge[] {
  const stored = flowEdges.map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    ...(edge.sourceHandle ? { sourceHandle: edge.sourceHandle } : {}),
    ...(edge.targetHandle ? { targetHandle: edge.targetHandle } : {})
  }));
  return [...stored, ...unsupported];
}

/** 统计素材被画布节点引用的次数；删除素材前用它给出真实引用检查。 */
function assetReferenceCount(flowNodes: CanvasFlowNode[], assetId: string): number {
  let count = 0;
  for (const node of flowNodes) {
    const data = node.data;
    if (data.assetId === assetId) count += 1;
    if (data.generation?.assetId === assetId) count += 1;
    if (data.subject?.assetIds.includes(assetId)) count += 1;
    if (data.timeline?.clips.some(clip => clip.assetId === assetId)) count += 1;
  }
  return count;
}

/** 删除节点时清理其它节点对它的引用（时间线片段、导演台镜头）。 */
function withoutNodeReference(node: CanvasFlowNode, removedId: string): CanvasFlowNode {
  let data = node.data;
  let changed = false;
  if (data.timeline?.clips.some(clip => clip.nodeId === removedId)) {
    data = { ...data, timeline: { ...data.timeline, clips: data.timeline.clips.map(clip => clip.nodeId === removedId ? { ...clip, nodeId: "" } : clip) } };
    changed = true;
  }
  if (data.desk?.shotNodeIds.includes(removedId)) {
    data = { ...data, desk: { shotNodeIds: data.desk.shotNodeIds.filter(id => id !== removedId) } };
    changed = true;
  }
  return changed ? { ...node, data } : node;
}

export interface CanvasWorkspaceProps {
  applicationId: ApplicationId;
  initialProjectId?: string;
  settings: UserSettings;
  applications: Array<{ title: string; applicationId: ApplicationId }>;
  onNavigate: (path: string) => void;
  onOpenSettings: () => void;
  chatPanel: ReactNode;
}

function initialCanvasWorkbenchMetrics(): WorkbenchLayoutMetrics {
  if (typeof window === "undefined") return resolveWorkbenchLayoutMetrics(1200, 800, true);
  return resolveWorkbenchLayoutMetrics(window.innerWidth, window.innerHeight, true);
}

export function CanvasWorkspace({ applicationId, initialProjectId, settings, applications, onNavigate, onOpenSettings, chatPanel }: CanvasWorkspaceProps) {
  const canvasSettings = resolveCanvasSettings(settings);
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<CanvasProjectSummary[]>([]);
  const [project, setProject] = useState<CanvasProject | null>(null);
  const [title, setTitle] = useState("");
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [operation, setOperation] = useState<CanvasOperation | null>(null);
  const [progressNote, setProgressNote] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [conflict, setConflict] = useState(false);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(() => resolveCanvasSettings(settings).agentPanelDefaultOpen);
  const [chatMounted, setChatMounted] = useState(() => resolveCanvasSettings(settings).agentPanelDefaultOpen);
  const [mode, setMode] = useState<CanvasMode>(() => resolveCanvasSettings(settings).defaultMode === "canvas" ? "canvas" : "generate");
  const [addMenu, setAddMenu] = useState<{ x: number; y: number; position: { x: number; y: number } } | null>(null);
  const [prompt, setPrompt] = useState("");
  const [referenceIds, setReferenceIds] = useState<string[]>([]);
  const [generationKind, setGenerationKind] = useState<"image" | "video">("image");
  const [aspectRatio, setAspectRatio] = useState<CanvasAspectRatio>("1:1");
  const [durationSeconds, setDurationSeconds] = useState(5);
  const [generationTargetId, setGenerationTargetId] = useState<string | null>(null);
  const [generationBusy, setGenerationBusy] = useState(false);
  const [mention, setMention] = useState<{ query: string; start: number; end: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [flowRevision, setFlowRevision] = useState(0);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [compactViewport, setCompactViewport] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-height: 640px), (max-width: 640px)").matches);
  const [generateExpanded, setGenerateExpanded] = useState(false);
  const [directorDeskNodeId, setDirectorDeskNodeId] = useState<string | null>(null);
  const runningVideoRef = useRef<string[]>([]);

  const mountedRef = useRef(true);
  const projectRef = useRef<CanvasProject | null>(null);
  const nodesRef = useRef<CanvasFlowNode[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const dirtyRef = useRef(false);
  const titleRef = useRef("");
  const promptRef = useRef("");
  const referenceIdsRef = useRef<string[]>([]);
  const generationTargetIdRef = useRef<string | null>(null);
  const saveInFlight = useRef(false);
  const busyRef = useRef(false);
  const editRevision = useRef(0);
  const viewportRef = useRef<Viewport>(DEFAULT_VIEWPORT);
  const canvasRef = useRef<HTMLDivElement>(null);
  const workbenchRef = useRef<HTMLDivElement>(null);
  const chatLaunchButtonRef = useRef<HTMLButtonElement>(null);
  const flowRef = useRef<ReactFlowInstance<CanvasFlowNode, Edge> | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const timersRef = useRef<Set<number>>(new Set());
  const downloadUrlsRef = useRef<Set<string>>(new Set());
  const createInFlight = useRef(false);
  const openInFlight = useRef(false);
  const deleteInFlight = useRef(false);
  const refreshInFlight = useRef(false);
  const generationInFlight = useRef(false);
  const unsupportedNodesRef = useRef<CanvasNode[]>([]);
  const unsupportedEdgesRef = useRef<CanvasEdge[]>([]);
  const cascadeRef = useRef(0);
  const historyRef = useRef<{ past: CanvasSnapshot[]; future: CanvasSnapshot[] }>({ past: [], future: [] });
  const pendingSnapshotRef = useRef<CanvasSnapshot | null>(null);
  const historyTimerRef = useRef<number | null>(null);
  const saveActionRef = useRef<() => void>(() => undefined);

  projectRef.current = project;
  nodesRef.current = nodes;
  edgesRef.current = edges;
  dirtyRef.current = dirty;
  titleRef.current = title;
  promptRef.current = prompt;
  referenceIdsRef.current = referenceIds;
  generationTargetIdRef.current = generationTargetId;

  const workbenchMetrics = useWorkbenchMetrics(workbenchRef, initialCanvasWorkbenchMetrics, true);
  const chatRightLimits = useMemo<WorkbenchPaneLimits>(() => {
    const max = Math.max(
      workbenchMetrics.right.min,
      Math.min(workbenchMetrics.right.max, Math.round(workbenchMetrics.containerWidth * CANVAS_CHAT_MAX_WIDTH_SHARE))
    );
    return {
      ...workbenchMetrics.right,
      max,
      initial: Math.min(max, Math.max(workbenchMetrics.right.min, workbenchMetrics.right.initial))
    };
  }, [workbenchMetrics]);

  const openChatPanel = useCallback(() => {
    setChatMounted(true);
    setChatOpen(true);
    setAssetsOpen(false);
  }, []);

  const closeChatPanel = useCallback(() => {
    setChatOpen(false);
    window.requestAnimationFrame(() => chatLaunchButtonRef.current?.focus());
  }, []);

  const handleRightCollapsedChange = useCallback((collapsed: boolean) => {
    if (!collapsed) setChatMounted(true);
    setChatOpen(!collapsed);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // 短屏（高度 ≤640）或窄屏（宽度 ≤640）用紧凑布局：生成面板默认折叠成一行，避免遮挡画布节点。
  useEffect(() => {
    const query = window.matchMedia("(max-height: 640px), (max-width: 640px)");
    const handleChange = () => setCompactViewport(query.matches);
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => () => {
    for (const timer of timersRef.current) window.clearTimeout(timer);
    timersRef.current.clear();
    if (historyTimerRef.current !== null) window.clearTimeout(historyTimerRef.current);
    for (const url of downloadUrlsRef.current) URL.revokeObjectURL(url);
    downloadUrlsRef.current.clear();
  }, []);

  const scheduleTimer = useCallback((callback: () => void, delay: number) => {
    const timer = window.setTimeout(() => { timersRef.current.delete(timer); callback(); }, delay);
    timersRef.current.add(timer);
  }, []);

  // 初始视口：把全部节点拟合到浮层之外的可见区域（顶部工具栏、左侧工具轨、底部生成面板留白），最大缩放 1。
  const fitCanvasToNodes = useCallback(() => {
    const flowNodes = nodesRef.current;
    const container = canvasRef.current;
    const instance = flowRef.current;
    if (!container || !instance || flowNodes.length === 0) return;
    const rect = container.getBoundingClientRect();
    const width = Math.max(320, rect.width);
    const height = Math.max(320, rect.height);
    const narrow = width <= 640;
    const compact = height <= 640;
    const padLeft = narrow ? 16 : 120;
    const padRight = narrow ? 16 : 40;
    const padTop = compact ? 104 : 112;
    const padBottom = compact ? 168 : narrow ? 196 : 280;
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const node of flowNodes) {
      const fallback = NODE_DEFAULT_SIZE[node.data.kind];
      const nodeWidth = node.measured?.width ?? styleSize(node.style?.width, fallback.width);
      const nodeHeight = node.measured?.height ?? styleSize(node.style?.height, fallback.height);
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + nodeWidth);
      maxY = Math.max(maxY, node.position.y + nodeHeight);
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY)) return;
    const boundsWidth = Math.max(1, maxX - minX);
    const boundsHeight = Math.max(1, maxY - minY);
    const availableWidth = Math.max(160, width - padLeft - padRight);
    const availableHeight = Math.max(120, height - padTop - padBottom);
    const zoom = Math.min(CANVAS_LIMITS.maxZoom, Math.max(CANVAS_LIMITS.minZoom, Math.min(availableWidth / boundsWidth, availableHeight / boundsHeight, 1)));
    const viewport: Viewport = {
      x: padLeft + (availableWidth - boundsWidth * zoom) / 2 - minX * zoom,
      y: padTop + (availableHeight - boundsHeight * zoom) / 2 - minY * zoom,
      zoom
    };
    viewportRef.current = viewport;
    setZoom(zoom);
    void instance.setViewport(viewport, { duration: 0 });
  }, []);

  // 项目加载或重新载入后等一帧让 React Flow 完成测量再拟合，保证节点 header 在浮层下方可见。
  useEffect(() => {
    if (!project || project.nodes.length === 0) return;
    let second = 0;
    const first = window.requestAnimationFrame(() => {
      second = window.requestAnimationFrame(() => fitCanvasToNodes());
    });
    return () => {
      window.cancelAnimationFrame(first);
      if (second) window.cancelAnimationFrame(second);
    };
  }, [project?.id, flowRevision, fitCanvasToNodes]);

  const snapshotNow = useCallback((): CanvasSnapshot => ({ nodes: nodesRef.current, edges: edgesRef.current }), []);

  const pushHistorySnapshot = useCallback((snapshot: CanvasSnapshot) => {
    const history = historyRef.current;
    history.past.push(snapshot);
    if (history.past.length > HISTORY_LIMIT) history.past.shift();
    history.future = [];
    setHistoryRevision(current => current + 1);
  }, []);

  const flushPendingHistory = useCallback(() => {
    if (historyTimerRef.current !== null) {
      window.clearTimeout(historyTimerRef.current);
      historyTimerRef.current = null;
    }
    const pending = pendingSnapshotRef.current;
    pendingSnapshotRef.current = null;
    if (pending) pushHistorySnapshot(pending);
  }, [pushHistorySnapshot]);

  const commitHistory = useCallback(() => {
    flushPendingHistory();
    pushHistorySnapshot(snapshotNow());
  }, [flushPendingHistory, pushHistorySnapshot, snapshotNow]);

  const beginTextHistory = useCallback(() => {
    if (!pendingSnapshotRef.current) pendingSnapshotRef.current = snapshotNow();
    if (historyTimerRef.current !== null) window.clearTimeout(historyTimerRef.current);
    historyTimerRef.current = window.setTimeout(() => {
      historyTimerRef.current = null;
      flushPendingHistory();
    }, TEXT_HISTORY_DELAY_MS);
  }, [flushPendingHistory, snapshotNow]);

  const markDirty = useCallback(() => {
    editRevision.current += 1;
    setDirty(true);
    setNotice("");
  }, []);

  const onTextChange = useCallback((id: string, text: string) => {
    beginTextHistory();
    const value = text.slice(0, CANVAS_LIMITS.textLength);
    setNodes(current => current.map(node => node.id === id ? { ...node, data: { ...node.data, text: value } } : node));
    markDirty();
  }, [beginTextHistory, markDirty, setNodes]);

  const onPatch = useCallback((id: string, patch: Record<string, unknown>) => {
    commitHistory();
    setNodes(current => current.map(node => node.id === id ? { ...node, data: { ...node.data, ...patch } } : node));
    markDirty();
  }, [commitHistory, markDirty, setNodes]);

  const onRemove = useCallback((id: string) => {
    commitHistory();
    setNodes(current => current.filter(node => node.id !== id).map(node => withoutNodeReference(node, id)));
    setEdges(current => current.filter(edge => edge.source !== id && edge.target !== id));
    markDirty();
  }, [commitHistory, markDirty, setEdges, setNodes]);

  const onOpenDirectorDesk = useCallback((id: string) => {
    const target = nodesRef.current.find(node => node.id === id && node.data.kind === "director-desk");
    if (!target || saving || generationBusy || operation !== null || openingId !== null || deletingProjectId !== null || deletingAssetId !== null) return;
    setError("");
    setAssetsOpen(false);
    setChatOpen(false);
    setMode("canvas");
    setDirectorDeskNodeId(id);
  }, [deletingAssetId, deletingProjectId, generationBusy, openingId, operation, saving]);

  const updateProjectMeta = useCallback((updated: CanvasProject) => {
    projectRef.current = updated;
    setProject(updated);
    setSummaries(list => upsertSummary(list, summaryFor(updated, nodesRef.current.length + unsupportedNodesRef.current.length)));
  }, []);

  const applyGenerationResult = useCallback((updated: CanvasProject, nodeId: string) => {
    projectRef.current = updated;
    setProject(updated);
    setSummaries(list => upsertSummary(list, summaryFor(updated, nodesRef.current.length + unsupportedNodesRef.current.length)));
    setNodes(current => current.map(node => {
      if (node.id !== nodeId) return node;
      const serverNode = updated.nodes.find(item => item.id === nodeId);
      return serverNode ? { ...node, data: { ...node.data, ...uiPatchFromPersisted(node.data.kind, serverNode.data) } } : node;
    }));
  }, [setNodes]);

  const refreshGeneration = useCallback(async (nodeId: string) => {
    const current = projectRef.current;
    if (!current || refreshInFlight.current || busyRef.current || saveInFlight.current) return;
    refreshInFlight.current = true;
    try {
      const result = await refreshCanvasVideo(applicationId, current.id, nodeId);
      if (!mountedRef.current) return;
      applyGenerationResult(result.project, nodeId);
      const serverNode = result.project.nodes.find(item => item.id === nodeId);
      const status = serverNode && isRecord(serverNode.data) && isRecord(serverNode.data.generation) ? String(serverNode.data.generation.status) : "";
      setNotice(status === "succeeded" ? "视频任务已完成，素材已写入项目。" : status === "failed" ? "视频任务失败，原因见生成节点。" : "已刷新视频任务状态。");
    } catch (refreshError) {
      if (mountedRef.current) setError(canvasErrorText(refreshError, "刷新生成任务失败。"));
    } finally {
      refreshInFlight.current = false;
    }
  }, [applicationId, applyGenerationResult]);

  const cancelGeneration = useCallback(async (nodeId: string) => {
    const current = projectRef.current;
    if (!current || refreshInFlight.current) return;
    refreshInFlight.current = true;
    try {
      const result = await cancelCanvasVideo(applicationId, current.id, nodeId);
      if (!mountedRef.current) return;
      applyGenerationResult(result.project, nodeId);
      setNotice("已请求取消生成任务；最终状态以服务端返回为准。");
    } catch (cancelError) {
      if (mountedRef.current) setError(canvasErrorText(cancelError, "取消生成任务失败。"));
    } finally {
      refreshInFlight.current = false;
    }
  }, [applicationId, applyGenerationResult]);

  const canvasCallbacks = useMemo<CanvasNodeCallbacks>(() => ({
    onTextChange,
    onPatch,
    onRemove,
    onOpenDirectorDesk,
    onRefreshGeneration: nodeId => { void refreshGeneration(nodeId); },
    onCancelGeneration: nodeId => { void cancelGeneration(nodeId); }
  }), [cancelGeneration, onOpenDirectorDesk, onPatch, onRemove, onTextChange, refreshGeneration]);

  const applyProject = useCallback((next: CanvasProject) => {
    editRevision.current += 1;
    setDirectorDeskNodeId(null);
    projectRef.current = next;
    viewportRef.current = next.viewport ?? DEFAULT_VIEWPORT;
    setProject(next);
    setTitle(next.title);
    const knownNodeIds = new Set<string>();
    for (const node of next.nodes) if (knownKind(node.type)) knownNodeIds.add(node.id);
    const flow = flowNodesFrom(next, canvasCallbacks);
    const edgeFlow = flowEdgesFrom(next, knownNodeIds);
    unsupportedNodesRef.current = flow.unsupported;
    unsupportedEdgesRef.current = edgeFlow.unsupported;
    cascadeRef.current = 0;
    setNodes(flow.nodes);
    setEdges(edgeFlow.edges);
    setZoom(next.viewport?.zoom ?? 1);
    // 有节点的项目自动选中第一个可用 generation 节点：首页创建的单节点项目应直接可生成，并把节点 prompt 回填到生成工作台。
    const autoTarget = flow.nodes.length === 1
      ? flow.nodes[0]
      : flow.nodes.find(node => node.data.kind === "generation" && node.data.generation?.status !== "succeeded");
    if (autoTarget && autoTarget.data.kind === "generation") {
      const generation = autoTarget.data.generation;
      setNodes(flow.nodes.map(node => node.id === autoTarget.id ? { ...node, selected: true } : node));
      setGenerationTargetId(autoTarget.id);
      if (generation?.prompt) setPrompt(generation.prompt.slice(0, CANVAS_LIMITS.textLength));
      if (generation?.kind) setGenerationKind(generation.kind);
      if (generation?.aspectRatio) setAspectRatio(generation.aspectRatio);
      if (typeof generation?.durationSeconds === "number" && generation.durationSeconds > 0) setDurationSeconds(generation.durationSeconds);
    } else {
      setGenerationTargetId(null);
    }
    setDirty(false);
    setConflict(false);
    setError("");
    setFlowRevision(current => current + 1);
    historyRef.current = { past: [], future: [] };
    pendingSnapshotRef.current = null;
    setHistoryRevision(current => current + 1);
  }, [canvasCallbacks, setEdges, setNodes]);

  const clearProject = useCallback(() => {
    editRevision.current += 1;
    projectRef.current = null;
    viewportRef.current = DEFAULT_VIEWPORT;
    unsupportedNodesRef.current = [];
    unsupportedEdgesRef.current = [];
    setProject(null);
    setTitle("");
    setNodes([]);
    setEdges([]);
    setDirty(false);
    setConflict(false);
    setFlowRevision(current => current + 1);
    historyRef.current = { past: [], future: [] };
    setHistoryRevision(current => current + 1);
  }, [setEdges, setNodes]);

  const confirmDiscard = useCallback((action: string): boolean => {
    if (!dirtyRef.current) return true;
    return window.confirm("当前画布有未保存更改，" + action + "后将丢弃这些更改。要继续吗？");
  }, []);

  const reloadSummaries = useCallback(async () => {
    const { projects } = await loadCanvasProjects(applicationId);
    if (mountedRef.current) setSummaries(projects);
    return projects;
  }, [applicationId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void (async () => {
      try {
        const { projects } = await loadCanvasProjects(applicationId);
        if (!active) return;
        setSummaries(projects);
        let target: CanvasProject;
        if (initialProjectId) {
          target = (await loadCanvasProject(applicationId, initialProjectId)).project;
        } else if (projects[0]) {
          target = (await loadCanvasProject(applicationId, projects[0].id)).project;
        } else {
          target = (await createCanvasProject(applicationId, "未命名画布")).project;
        }
        if (!active) return;
        applyProject(target);
        setSummaries(list => upsertSummary(list, summaryFor(target, target.nodes.length)));
      } catch (loadError) {
        if (active) setError(canvasErrorText(loadError, "无法加载画布项目。"));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [applicationId, initialProjectId, applyProject]);

  const openProject = useCallback(async (summary: CanvasProjectSummary) => {
    if (projectRef.current?.id === summary.id || openInFlight.current || busyRef.current || saveInFlight.current) return;
    if (!confirmDiscard("切换项目")) return;
    openInFlight.current = true;
    setOpeningId(summary.id);
    setError("");
    setNotice("");
    try {
      const { project: loaded } = await loadCanvasProject(applicationId, summary.id);
      if (!mountedRef.current) return;
      applyProject(loaded);
      setSummaries(list => upsertSummary(list, summaryFor(loaded)));
      setNotice("已打开画布「" + loaded.title + "」。");
    } catch (openError) {
      if (mountedRef.current) setError(canvasErrorText(openError, "打开画布项目失败。"));
    } finally {
      openInFlight.current = false;
      if (mountedRef.current) setOpeningId(null);
    }
  }, [applicationId, applyProject, confirmDiscard]);

  const createProject = useCallback(async () => {
    if (createInFlight.current || busyRef.current || saveInFlight.current || openInFlight.current) return;
    if (!confirmDiscard("新建画布")) return;
    createInFlight.current = true;
    setError("");
    setNotice("");
    try {
      const { project: created } = await createCanvasProject(applicationId, "画布 " + (summaries.length + 1));
      if (!mountedRef.current) return;
      applyProject(created);
      setSummaries(list => upsertSummary(list, summaryFor(created)));
      setNotice("已新建空白画布；添加节点后按 Ctrl+S 保存。");
    } catch (createError) {
      if (mountedRef.current) setError(canvasErrorText(createError, "新建画布项目失败。"));
    } finally {
      createInFlight.current = false;
    }
  }, [applicationId, applyProject, confirmDiscard, summaries.length]);

  const reloadCurrentProject = useCallback(async () => {
    const current = projectRef.current;
    if (!current || openInFlight.current || busyRef.current || saveInFlight.current) return;
    if (!confirmDiscard("重新加载")) return;
    openInFlight.current = true;
    setOpeningId(current.id);
    setError("");
    try {
      const { project: loaded } = await loadCanvasProject(applicationId, current.id);
      if (!mountedRef.current) return;
      applyProject(loaded);
      setSummaries(list => upsertSummary(list, summaryFor(loaded)));
      setNotice("已重新加载项目。");
    } catch (reloadError) {
      if (mountedRef.current) setError(canvasErrorText(reloadError, "重新加载画布项目失败。"));
    } finally {
      openInFlight.current = false;
      if (mountedRef.current) setOpeningId(null);
    }
  }, [applicationId, applyProject, confirmDiscard]);

  const removeProject = useCallback(async (summary: CanvasProjectSummary) => {
    if (deleteInFlight.current || busyRef.current || saveInFlight.current) return;
    const active = projectRef.current?.id === summary.id;
    if (active && !confirmDiscard("删除当前画布")) return;
    deleteInFlight.current = true;
    setDeletingProjectId(summary.id);
    setError("");
    setNotice("");
    try {
      await deleteCanvasProject(applicationId, summary.id);
      if (!mountedRef.current) return;
      const projects = await reloadSummaries();
      if (!mountedRef.current) return;
      if (active) {
        const next = projects[0];
        if (next) {
          const { project: loaded } = await loadCanvasProject(applicationId, next.id);
          if (mountedRef.current) applyProject(loaded);
        } else {
          clearProject();
        }
      }
      setNotice("已删除画布「" + summary.title + "」。");
    } catch (deleteError) {
      if (mountedRef.current) setError(canvasErrorText(deleteError, "删除画布项目失败。"));
    } finally {
      deleteInFlight.current = false;
      if (mountedRef.current) setDeletingProjectId(null);
    }
  }, [applicationId, applyProject, clearProject, confirmDiscard, reloadSummaries]);

  const placementForNewNode = useCallback((kind: CanvasNodeKind): { x: number; y: number } => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const viewport = viewportRef.current;
    const width = rect?.width ?? 900;
    const height = rect?.height ?? 560;
    const size = NODE_DEFAULT_SIZE[kind];
    const centerX = (width / 2 - viewport.x) / viewport.zoom;
    const centerY = (height / 2 - viewport.y) / viewport.zoom;
    // 新节点落在当前可见画布中心附近，以 2×2 网格级联（每个偏移一个节点宽/高外加间距），四步后回绕；
    // 偏移量使用画布坐标，因此缩放后仍能保持不重叠的视觉间距。
    const gap = 32;
    const stepX = size.width + gap;
    const stepY = Math.max(120, Math.round(size.height * 0.7)) + gap;
    const index = cascadeRef.current % 4;
    cascadeRef.current += 1;
    const column = index % 2;
    const row = index < 2 ? 0 : 1;
    const blockWidth = stepX * 2 - gap;
    const blockHeight = stepY * 2 - gap;
    return {
      x: clampCoordinate(Math.round(centerX - blockWidth / 2 + column * stepX)),
      y: clampCoordinate(Math.round(centerY - blockHeight / 2 + row * stepY))
    };
  }, []);

  const createFlowNode = useCallback((kind: CanvasNodeKind, current: CanvasProject, at?: { x: number; y: number }): CanvasFlowNode => {
    const size = NODE_DEFAULT_SIZE[kind];
    return {
      id: crypto.randomUUID(),
      type: kind,
      position: at ?? placementForNewNode(kind),
      style: { width: size.width, height: size.height },
      data: {
        kind,
        applicationId,
        projectId: current.id,
        text: "",
        ...defaultUiData(kind),
        ...canvasCallbacks
      }
    };
  }, [applicationId, canvasCallbacks, placementForNewNode]);

  const addNode = useCallback((kind: CanvasNodeKind, at?: { x: number; y: number }) => {
    const current = projectRef.current;
    if (!current || busyRef.current || saveInFlight.current) return;
    if (nodesRef.current.length + unsupportedNodesRef.current.length >= CANVAS_LIMITS.nodes) {
      setError("每个画布最多 " + CANVAS_LIMITS.nodes + " 个节点，请先删除部分节点。");
      return;
    }
    commitHistory();
    const node = createFlowNode(kind, current, at);
    setNodes(items => [...items, node]);
    markDirty();
    if (kind === "generation") setGenerationTargetId(node.id);
  }, [commitHistory, createFlowNode, markDirty, setNodes]);

  const insertAssetNode = useCallback((asset: CanvasProjectAsset, asReference: boolean) => {
    const current = projectRef.current;
    if (!current) return;
    if (nodesRef.current.length + unsupportedNodesRef.current.length >= CANVAS_LIMITS.nodes) {
      setError("每个画布最多 " + CANVAS_LIMITS.nodes + " 个节点，请先删除部分节点。");
      return;
    }
    const mediaKind = canvasAssetKind(asset.mimeType);
    const kind: CanvasNodeKind = asReference ? "asset" : mediaKind ?? "image";
    const size = NODE_DEFAULT_SIZE[kind];
    commitHistory();
    const node: CanvasFlowNode = {
      id: crypto.randomUUID(),
      type: kind,
      position: placementForNewNode(kind),
      style: { width: size.width, height: size.height },
      data: {
        kind,
        applicationId,
        projectId: current.id,
        text: "",
        assetId: asset.assetId,
        assetName: asset.name,
        ...canvasCallbacks
      }
    };
    setNodes(items => [...items, node]);
    markDirty();
    setNotice("素材「" + asset.name + "」已插入画布，按 Ctrl+S 保存项目引用。");
  }, [applicationId, canvasCallbacks, commitHistory, markDirty, placementForNewNode, setNodes]);

  const onFlowNodesChange = useCallback((changes: NodeChange<CanvasFlowNode>[]) => {
    onNodesChange(changes);
    if (changes.some(change => change.type === "position" || change.type === "remove")) markDirty();
    const removed: string[] = [];
    for (const change of changes) if (change.type === "remove") removed.push(change.id);
    if (removed.length) {
      setEdges(current => current.filter(edge => !removed.includes(edge.source) && !removed.includes(edge.target)));
      setNodes(current => current.map(node => removed.reduce((next, removedId) => withoutNodeReference(next, removedId), node)));
    }
  }, [markDirty, onNodesChange, setEdges, setNodes]);

  const onFlowEdgesChange = useCallback((changes: EdgeChange<Edge>[]) => {
    onEdgesChange(changes);
    if (changes.some(change => change.type === "remove")) markDirty();
  }, [markDirty, onEdgesChange]);

  const onConnect = useCallback((connection: Connection) => {
    if (!projectRef.current) return;
    if (edgesRef.current.length + unsupportedEdgesRef.current.length >= CANVAS_LIMITS.edges) {
      setError("每个画布最多 " + CANVAS_LIMITS.edges + " 条连线，请先删除部分连线。");
      return;
    }
    if (!connection.source || !connection.target || connection.source === connection.target) return;
    commitHistory();
    setEdges(current => addEdge({ ...connection, id: crypto.randomUUID(), type: "smoothstep" }, current));
    markDirty();
  }, [commitHistory, markDirty, setEdges]);

  const saveProjectNow = useCallback(async (force = false): Promise<CanvasProject | null> => {
    const current = projectRef.current;
    if (!current || saveInFlight.current || busyRef.current) return current;
    if (!dirtyRef.current && !force) return current;
    const nextTitle = titleRef.current.trim();
    if (!nextTitle) {
      setError("项目名称不能为空（1–80 个字符）。");
      return null;
    }
    let persisted: CanvasNode[];
    let persistedEdges: CanvasEdge[];
    try {
      persisted = persistedNodesFrom(nodesRef.current, current, unsupportedNodesRef.current);
      persistedEdges = persistedEdgesFrom(edgesRef.current, unsupportedEdgesRef.current);
    } catch (dataError) {
      setError(canvasErrorText(dataError, "节点数据无法保存。"));
      return null;
    }
    saveInFlight.current = true;
    setSaving(true);
    setError("");
    setNotice("");
    const revision = editRevision.current;
    const payload = buildCanvasProjectPayload({ project: current, title: nextTitle, viewport: viewportRef.current, nodes: persisted, edges: persistedEdges });
    try {
      const { project: saved } = await saveCanvasProject(applicationId, current.id, current.updatedAt, payload);
      if (!mountedRef.current) return saved;
      projectRef.current = saved;
      setProject(saved);
      setSummaries(list => upsertSummary(list, summaryFor(saved, saved.nodes.length)));
      setConflict(false);
      if (editRevision.current === revision) {
        setTitle(saved.title);
        setNodes(flowNodesFrom(saved, canvasCallbacks).nodes);
        setEdges(flowEdgesFrom(saved, new Set(saved.nodes.filter(node => knownKind(node.type)).map(node => node.id))).edges);
        setDirty(false);
        setNotice("画布已保存。");
      } else {
        setNotice("本次更改已保存；保存期间的新编辑仍未保存。");
      }
      return saved;
    } catch (saveError) {
      if (!mountedRef.current) return null;
      if (isConflictError(saveError)) {
        setConflict(true);
        setError("项目已在其他窗口或设备更新（HTTP 409）。请重新加载后再保存，避免覆盖对方的修改。");
      } else {
        setError(canvasErrorText(saveError, "保存画布项目失败。"));
      }
      return null;
    } finally {
      saveInFlight.current = false;
      if (mountedRef.current) setSaving(false);
    }
  }, [applicationId, canvasCallbacks, setEdges, setNodes]);

  const saveAndCloseDirectorDesk = useCallback(async () => {
    const saved = await saveProjectNow();
    if (saved) setDirectorDeskNodeId(null);
  }, [saveProjectNow]);

  saveActionRef.current = () => { void saveProjectNow(); };

  const restoreSnapshot = useCallback((snapshot: CanvasSnapshot) => {
    setNodes(snapshot.nodes);
    setEdges(snapshot.edges);
    markDirty();
    setHistoryRevision(current => current + 1);
  }, [markDirty, setEdges, setNodes]);

  const undo = useCallback(() => {
    flushPendingHistory();
    if (saveInFlight.current || busyRef.current) return;
    const history = historyRef.current;
    const previous = history.past.pop();
    if (!previous) return;
    history.future.push(snapshotNow());
    if (history.future.length > HISTORY_LIMIT) history.future.shift();
    restoreSnapshot(previous);
    setNotice("已撤销上一步编辑。");
  }, [flushPendingHistory, restoreSnapshot, snapshotNow]);

  const redo = useCallback(() => {
    if (saveInFlight.current || busyRef.current) return;
    const history = historyRef.current;
    const next = history.future.pop();
    if (!next) return;
    history.past.push(snapshotNow());
    if (history.past.length > HISTORY_LIMIT) history.past.shift();
    restoreSnapshot(next);
    setNotice("已重做。");
  }, [restoreSnapshot, snapshotNow]);

  const startOperation = useCallback((kind: CanvasOperation) => {
    busyRef.current = true;
    setOperation(kind);
    setError("");
    setNotice("");
    setProgressNote("");
  }, []);

  const finishOperation = useCallback(() => {
    busyRef.current = false;
    if (!mountedRef.current) return;
    setOperation(null);
    setProgressNote("");
    setDeletingAssetId(null);
  }, []);

  const uploadAsset = useCallback(async (file: File, insertIntoCanvas: boolean) => {
    const current = projectRef.current;
    if (!current || busyRef.current || saveInFlight.current) return;
    const kind = canvasAssetKind(file.type);
    if (!kind || !file.type) {
      setError("资产库只支持 PNG、JPEG、WebP 图片，MP4、WebM 视频或 MP3、WAV、Ogg 音频。");
      return;
    }
    const limit = canvasAssetByteLimit(file.type);
    if (file.size > limit) {
      setError((kind === "image" ? "图片" : kind === "video" ? "视频" : "音频") + "不能超过 " + formatCanvasBytes(limit) + "。");
      return;
    }
    if (current.assets.length >= CANVAS_LIMITS.assets) {
      setError("每个画布最多保存 " + CANVAS_LIMITS.assets + " 个素材，请先删除不需要的素材。");
      return;
    }
    const totalBytes = current.assets.reduce((total, asset) => total + asset.bytes, 0) + file.size;
    if (totalBytes > CANVAS_LIMITS.projectAssetBytes) {
      setError("画布素材总量不能超过 " + formatCanvasBytes(CANVAS_LIMITS.projectAssetBytes) + "，请先删除部分素材。");
      return;
    }
    startOperation("upload");
    try {
      const uploaded = await uploadCanvasAsset(applicationId, current.id, current.updatedAt, file.name.slice(0, 120), file, file.type);
      if (!mountedRef.current) return;
      updateProjectMeta(uploaded.project);
      const asset = uploaded.project.assets[uploaded.project.assets.length - 1];
      if (asset && insertIntoCanvas) insertAssetNode(asset, false);
      setNotice("已上传素材「" + (asset?.name ?? file.name) + "」。");
    } catch (uploadError) {
      if (!mountedRef.current) return;
      if (isConflictError(uploadError)) {
        setConflict(true);
        setError("项目已在其他窗口或设备更新（HTTP 409）。请重新加载后再上传素材。");
      } else {
        setError(canvasErrorText(uploadError, "上传画布素材失败。"));
      }
    } finally {
      finishOperation();
    }
  }, [applicationId, finishOperation, insertAssetNode, startOperation, updateProjectMeta]);

  const removeAsset = useCallback(async (asset: CanvasProjectAsset) => {
    const current = projectRef.current;
    if (!current || busyRef.current || saveInFlight.current) return;
    const referenced = assetReferenceCount(nodesRef.current, asset.assetId);
    if (referenced > 0) {
      setAssetsOpen(true);
      setError("素材「" + asset.name + "」仍被 " + referenced + " 个节点引用，请先移除这些引用。");
      return;
    }
    if (!window.confirm("删除素材「" + asset.name + "」？删除后不可恢复。")) return;
    startOperation("asset-delete");
    setDeletingAssetId(asset.assetId);
    try {
      const updated = await deleteCanvasAsset(applicationId, current.id, asset.assetId, current.updatedAt);
      if (!mountedRef.current) return;
      updateProjectMeta(updated.project);
      setNotice("已删除素材「" + asset.name + "」。");
    } catch (removeError) {
      if (!mountedRef.current) return;
      if (isConflictError(removeError)) {
        setConflict(true);
        setError("项目已在其他窗口或设备更新（HTTP 409）。请重新加载后再删除素材。");
      } else {
        setError(canvasErrorText(removeError, "删除画布素材失败。"));
      }
    } finally {
      finishOperation();
    }
  }, [applicationId, finishOperation, startOperation, updateProjectMeta]);

  const copyAssetReference = useCallback(async (asset: CanvasProjectAsset) => {
    try {
      await navigator.clipboard.writeText("@" + asset.name);
      setNotice("已复制 @" + asset.name + "，可粘贴到生成提示词里引用该素材。");
    } catch {
      setError("浏览器未允许写入剪贴板；可以直接在提示词里输入 @ 选择素材。");
    }
  }, []);

  const downloadJson = useCallback((fileName: string, content: string) => {
    const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
    downloadUrlsRef.current.add(url);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = "noopener";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    scheduleTimer(() => {
      downloadUrlsRef.current.delete(url);
      URL.revokeObjectURL(url);
    }, 10_000);
  }, [scheduleTimer]);

  const exportProject = useCallback(async () => {
    const current = projectRef.current;
    if (!current || busyRef.current || saveInFlight.current) return;
    const exportTitle = (titleRef.current.trim() || current.title).slice(0, CANVAS_LIMITS.titleLength);
    const estimatedBytes = current.assets.reduce((total, asset) => total + estimateBase64Length(asset.bytes), 0);
    if (estimatedBytes > MAX_TRANSFER_BYTES) {
      setError("素材转成 base64 后约 " + formatCanvasBytes(estimatedBytes) + "，超过 " + formatCanvasBytes(MAX_TRANSFER_BYTES) + " 导出上限。请先删除部分素材。");
      return;
    }
    startOperation("export");
    setProgressNote("正在整理画布 JSON…");
    try {
      const exportedAssets = await collectCanvasExportAssets(applicationId, current, message => {
        if (mountedRef.current) setProgressNote(message);
      });
      let persisted: CanvasNode[];
      try {
        persisted = persistedNodesFrom(nodesRef.current, current, unsupportedNodesRef.current);
      } catch (dataError) {
        throw new Error(canvasErrorText(dataError, "节点数据无法导出。"));
      }
      const documentValue = buildCanvasExportDocument({
        title: exportTitle,
        viewport: viewportRef.current,
        nodes: persisted,
        edges: persistedEdgesFrom(edgesRef.current, unsupportedEdgesRef.current),
        assets: exportedAssets,
        exportedAt: new Date().toISOString()
      });
      const content = JSON.stringify(documentValue);
      if (content.length > MAX_TRANSFER_BYTES) throw new Error("导出的 JSON 超过 " + formatCanvasBytes(MAX_TRANSFER_BYTES) + " 上限。");
      downloadJson(canvasExportFileName(exportTitle), content);
      if (mountedRef.current) setNotice(dirtyRef.current ? "已导出当前画布（包含未保存的更改）。" : "已导出画布 JSON 文件。");
    } catch (exportError) {
      if (mountedRef.current) setError(canvasErrorText(exportError, "导出画布失败。"));
    } finally {
      finishOperation();
    }
  }, [applicationId, downloadJson, finishOperation, startOperation]);

  const importProjectFile = useCallback(async (file: File) => {
    if (busyRef.current || saveInFlight.current) return;
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setError("导入文件超过 " + formatCanvasBytes(MAX_IMPORT_FILE_BYTES) + " 上限。");
      return;
    }
    if (!confirmDiscard("导入画布")) return;
    startOperation("import");
    try {
      setProgressNote("正在读取导入文件…");
      const bundle = parseCanvasImport(await file.text());
      const imported = await importCanvasProject(applicationId, bundle, message => {
        if (mountedRef.current) setProgressNote(message);
      });
      if (!mountedRef.current) return;
      applyProject(imported);
      setSummaries(list => upsertSummary(list, summaryFor(imported)));
      setNotice("已导入画布「" + imported.title + "」。");
    } catch (importError) {
      if (mountedRef.current) setError("导入失败：" + canvasErrorText(importError, "无法读取导入文件。"));
    } finally {
      finishOperation();
    }
  }, [applicationId, applyProject, confirmDiscard, finishOperation, startOperation]);

  const handleImportInput = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) void importProjectFile(file);
  }, [importProjectFile]);

  const handleUploadInput = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) void uploadAsset(file, true);
  }, [uploadAsset]);

  const handleRail = useCallback((key: CanvasNodeKind | "assets" | "upload") => {
    if (key === "assets") {
      setAssetsOpen(current => !current);
      setChatOpen(false);
      return;
    }
    if (key === "upload") {
      uploadInputRef.current?.click();
      return;
    }
    if (key === "image" || key === "video" || key === "audio") {
      setAssetsOpen(true);
      setChatOpen(false);
      setNotice("请从资产库上传或选择" + CANVAS_NODE_LABELS[key] + "素材后插入画布。");
      return;
    }
    addNode(key);
  }, [addNode]);

  const handleStageDoubleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest(".react-flow__node, .lfaa-cnv-rail, .lfaa-cnv-topbar, .lfaa-cnv-generate, .lfaa-cnv-zoom, .lfaa-cnv-drawer, .react-flow__minimap, .ant-popover")) return;
    if (!projectRef.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const position = flowRef.current?.screenToFlowPosition({ x: event.clientX, y: event.clientY }) ?? { x: 0, y: 0 };
    setAddMenu({ x: event.clientX - rect.left, y: event.clientY - rect.top, position });
  }, []);

  const addNodeAtMenu = useCallback((kind: CanvasNodeKind) => {
    const menu = addMenu;
    if (!menu) return;
    const size = NODE_DEFAULT_SIZE[kind];
    addNode(kind, {
      x: clampCoordinate(Math.round(menu.position.x - size.width / 2)),
      y: clampCoordinate(Math.round(menu.position.y - 32))
    });
    setAddMenu(null);
  }, [addMenu, addNode]);

  const aiSettings = settings.aiRuntime;
  const imageGenerationConfigured = aiSettings.imageGenerationMode === "local"
    ? Boolean(aiSettings.imageGenerationLocalModelId)
    : Boolean(aiSettings.imageGenerationAccountId && aiSettings.imageGenerationModelId);
  const videoGenerationConfigured = aiSettings.videoGenerationMode === "local"
    ? Boolean(aiSettings.videoGenerationLocalModelId)
    : Boolean(aiSettings.videoGenerationAccountId && aiSettings.videoGenerationModelId);

  const runGeneration = useCallback(async () => {
    const current = projectRef.current;
    if (!current || generationInFlight.current || busyRef.current || saveInFlight.current) return;
    let trimmedPrompt = promptRef.current.trim();
    if (!trimmedPrompt) {
      // 回退到当前选中 generation 节点里真实保存的提示词，避免“节点有 prompt 但面板为空”导致误报。
      const target = generationTargetIdRef.current
        ? nodesRef.current.find(node => node.id === generationTargetIdRef.current && node.data.kind === "generation")
        : undefined;
      const nodePrompt = target?.data.generation?.prompt.trim() ?? "";
      if (nodePrompt) {
        trimmedPrompt = nodePrompt;
        setPrompt(nodePrompt.slice(0, CANVAS_LIMITS.textLength));
      }
    }
    if (!trimmedPrompt) {
      if (compactViewport) setGenerateExpanded(true);
      setError("请先输入提示词再生成。");
      return;
    }
    const references = referenceIdsRef.current.filter(assetId => current.assets.some(asset => asset.assetId === assetId));
    generationInFlight.current = true;
    setGenerationBusy(true);
    setError("");
    setNotice("");
    try {
      let targetId = generationTargetIdRef.current;
      if (!targetId || !nodesRef.current.some(node => node.id === targetId && node.data.kind === "generation")) {
        const created = createFlowNode("generation", current);
        targetId = created.id;
        setNodes(items => [...items, created]);
        setGenerationTargetId(created.id);
        markDirty();
      }
      // 生成前必须保证 nodeId 已在服务端项目中；画布干净且节点已存在时不重复写入。
      const latestProject = projectRef.current;
      const nodePersisted = Boolean(latestProject?.nodes.some(node => node.id === targetId));
      const saved = dirtyRef.current || !nodePersisted || !latestProject ? await saveProjectNow(true) : latestProject;
      if (!saved) return;
      const requestBase = {
        expectedUpdatedAt: saved.updatedAt,
        nodeId: targetId,
        prompt: trimmedPrompt,
        aspectRatio,
        referenceAssetIds: references
      };
      if (generationKind === "image") {
        const result = await generateCanvasImage(applicationId, current.id, requestBase);
        if (!mountedRef.current) return;
        applyGenerationResult(result.project, targetId);
        setNotice("图片已生成并写入项目资产库（素材 " + result.asset.name + "）。");
      } else {
        const result = await startCanvasVideo(applicationId, current.id, { ...requestBase, durationSeconds });
        if (!mountedRef.current) return;
        applyGenerationResult(result.project, targetId);
        setNotice("视频任务已提交；状态以服务端真实任务为准，可在生成节点刷新。");
      }
      setMode("canvas");
      setGenerationTargetId(targetId);
    } catch (generateError) {
      if (!mountedRef.current) return;
      if (isConflictError(generateError)) {
        setConflict(true);
        setError("项目已在其他窗口或设备更新（HTTP 409）。请重新加载后再生成。");
      } else {
        setError(canvasErrorText(generateError, "生成失败。"));
      }
    } finally {
      generationInFlight.current = false;
      if (mountedRef.current) setGenerationBusy(false);
    }
  }, [applicationId, applyGenerationResult, aspectRatio, compactViewport, createFlowNode, durationSeconds, generationKind, markDirty, saveProjectNow, setNodes]);

  const runningVideoNodeIds = useMemo(
    () => nodes.filter(node => node.data.kind === "generation" && node.data.generation?.kind === "video" && node.data.generation.status === "running").map(node => node.id),
    [nodes]
  );
  const runningVideoSignature = runningVideoNodeIds.join(",");
  runningVideoRef.current = runningVideoNodeIds;

  // 视频任务轮询：只在页面可见、任务未结束且没有在途请求时发起单个刷新请求；卸载时清理计时器。
  useEffect(() => {
    if (!runningVideoSignature) return;
    let active = true;
    const timer = window.setInterval(() => {
      if (!active || refreshInFlight.current || document.visibilityState !== "visible") return;
      const nodeId = runningVideoRef.current[0];
      if (nodeId) void refreshGeneration(nodeId);
    }, 5_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [runningVideoSignature, refreshGeneration]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        saveActionRef.current();
        return;
      }
      const target = event.target as HTMLElement | null;
      const editing = Boolean(target?.closest("input, textarea, [contenteditable='true']"));
      if (editing) return;
      if (key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (key === "y") {
        event.preventDefault();
        redo();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [redo, undo]);

  useEffect(() => {
    if (!dirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  const nodeOptionSignature = nodes.map(node => node.id + ":" + node.data.kind).join("|");
  const nodeOptions = useMemo<CanvasNodeOption[]>(() => nodes.map(node => {
    const data = node.data;
    const label = data.kind === "text" || data.kind === "note"
      ? (data.text.trim().split("\n")[0] ?? "").slice(0, 40) || CANVAS_NODE_LABELS[data.kind]
      : data.assetName || data.generation?.prompt.trim().slice(0, 40) || data.subject?.name || data.script?.title || CANVAS_NODE_LABELS[data.kind];
    return { id: node.id, label, kind: data.kind };
  }), [nodeOptionSignature]);

  const nodeContextValue = useMemo(() => ({ assets: project?.assets ?? EMPTY_ASSETS, nodeOptions }), [project?.assets, nodeOptions]);
  const historyState = useMemo(
    () => ({ canUndo: historyRef.current.past.length > 0, canRedo: historyRef.current.future.length > 0 }),
    [historyRevision]
  );

  const generationTargetNode = generationTargetId ? nodes.find(node => node.id === generationTargetId && node.data.kind === "generation") ?? null : null;
  const generationConfigured = generationKind === "image" ? imageGenerationConfigured : videoGenerationConfigured;
  const directorDeskNode = directorDeskNodeId ? nodes.find(node => node.id === directorDeskNodeId && node.data.kind === "director-desk") ?? null : null;

  // 选中生成节点时把它的提示词/比例带进生成工作台，便于直接“重新生成”（数据来自项目真实记录）。
  useEffect(() => {
    if (!generationTargetId) return;
    const node = nodesRef.current.find(item => item.id === generationTargetId);
    const generation = node && node.data.kind === "generation" ? node.data.generation : undefined;
    if (!generation) return;
    if (generation.prompt) setPrompt(generation.prompt.slice(0, CANVAS_LIMITS.textLength));
    if (generation.kind) setGenerationKind(generation.kind);
    if (generation.aspectRatio) setAspectRatio(generation.aspectRatio);
    if (typeof generation.durationSeconds === "number" && generation.durationSeconds > 0) setDurationSeconds(generation.durationSeconds);
  }, [generationTargetId]);
  const generationTargetState = generationTargetNode?.data.generation ?? null;
  const interactionLocked = saving || operation !== null || openingId !== null || deletingProjectId !== null;
  const totalNodeCount = nodes.length + unsupportedNodesRef.current.length;
  const backRoute = applicationId === "workspace" ? "/work" : "/apps/" + encodeURIComponent(applicationId) + "/normal";
  const statusText = saving
    ? "正在保存…"
    : operation === "import" ? (progressNote || "正在导入画布…")
      : operation === "export" ? (progressNote || "正在导出画布…")
        : operation === "upload" ? "正在上传素材…"
          : operation === "asset-delete" ? "正在删除素材…"
            : openingId ? "正在打开项目…"
              : conflict ? "保存冲突：需要重新加载"
                : dirty ? "有未保存更改（Ctrl+S 保存）"
                  : notice || (project ? "已保存" : "尚未打开画布");
  const mentionOptions = mention
    ? (project?.assets ?? []).filter(asset => !mention.query || asset.name.toLowerCase().includes(mention.query.toLowerCase())).slice(0, 12)
    : [];
  const appOptions = applications
    .filter(item => Boolean(item.applicationId))
    .map(item => ({ value: item.applicationId as ApplicationId, label: item.title }))
    .filter((item, index, list) => list.findIndex(entry => entry.value === item.value) === index);

  const applyMention = useCallback((asset: CanvasProjectAsset) => {
    const activeMention = mention;
    if (!activeMention) return;
    setPrompt(prompt.slice(0, activeMention.start) + prompt.slice(activeMention.end));
    setReferenceIds(current => current.includes(asset.assetId) ? current : [...current, asset.assetId].slice(0, CANVAS_LIMITS.assets));
    setMention(null);
  }, [mention, prompt]);

  return (
    <div className="lfaa-cnv-outer">
      <section className="lfaa-cnv-workspace" aria-label="无限画布工作区" aria-busy={loading || saving || operation !== null} data-testid="canvas-workspace">
        <ResizableWorkbench
          className="lfaa-cnv-workbench"
          rootElementRef={workbenchRef}
          left={null}
          leftVisible={false}
          leftCollapsed
          centerRegionClassName="lfaa-cnv-workbench__center"
          rightRegionClassName="lfaa-cnv-workbench__right"
          rightLimits={chatRightLimits}
          containerWidth={workbenchMetrics.containerWidth}
          minCenterWidth={workbenchMetrics.minCenterWidth}
          layoutMode={workbenchMetrics.mode}
          responsiveRightDock
          persistState={false}
          rightCollapsed={!chatOpen}
          onRightCollapsedChange={handleRightCollapsedChange}
          center={
          <div className="lfaa-cnv-center-content">
          <div className="lfaa-cnv-stage" ref={canvasRef} onDoubleClick={handleStageDoubleClick}>
          {loading ? (
            <div className="lfaa-cnv-loading"><Spin /><span>正在读取当前 App 的画布项目…</span></div>
          ) : project ? (
            <CanvasNodeContextProvider value={nodeContextValue}>
              <ReactFlow
                key={project.id + ":" + flowRevision}
                nodes={nodes}
                edges={edges}
                nodeTypes={CANVAS_NODE_TYPES}
                onNodesChange={onFlowNodesChange}
                onEdgesChange={onFlowEdgesChange}
                onConnect={onConnect}
                onNodeClick={(_event, node) => {
                  if (node.data.kind !== "generation") return;
                  const generation = node.data.generation;
                  setGenerationTargetId(node.id);
                  if (generation?.prompt) setPrompt(generation.prompt.slice(0, CANVAS_LIMITS.textLength));
                  if (generation?.kind) setGenerationKind(generation.kind);
                  if (generation?.aspectRatio) setAspectRatio(generation.aspectRatio);
                  if (typeof generation?.durationSeconds === "number" && generation.durationSeconds > 0) setDurationSeconds(generation.durationSeconds);
                }}
                onNodeDragStart={() => commitHistory()}
                onMoveEnd={(_event, nextViewport) => { viewportRef.current = nextViewport; setZoom(nextViewport.zoom); }}
                onInit={(instance: ReactFlowInstance<CanvasFlowNode, Edge>) => {
                  flowRef.current = instance;
                  if (nodesRef.current.length > 0) window.requestAnimationFrame(() => fitCanvasToNodes());
                }}
                onPaneClick={() => setAddMenu(null)}
                zoomOnDoubleClick={false}
                defaultViewport={project.viewport ?? DEFAULT_VIEWPORT}
                defaultEdgeOptions={{ type: "smoothstep", style: { stroke: "var(--color-border-strong)", strokeWidth: 1.6 }, markerEnd: { type: MarkerType.ArrowClosed, color: "var(--color-border-strong)" } }}
                deleteKeyCode={interactionLocked ? null : "Delete"}
                selectionKeyCode="Shift"
                nodesDraggable={!interactionLocked}
                nodesConnectable={!interactionLocked}
                elementsSelectable={!interactionLocked}
                snapToGrid={canvasSettings.snapToGrid}
                snapGrid={[24, 24]}
                minZoom={CANVAS_LIMITS.minZoom}
                maxZoom={CANVAS_LIMITS.maxZoom}
                onlyRenderVisibleElements
                proOptions={{ hideAttribution: true }}
              >
                {canvasSettings.gridStyle === "none" ? null : (
                  <Background
                    variant={canvasSettings.gridStyle === "lines" ? BackgroundVariant.Lines : BackgroundVariant.Dots}
                    gap={22}
                    size={1.4}
                    color="var(--lfaa-cnv-grid)"
                  />
                )}
                {canvasSettings.showMiniMap ? (
                  <MiniMap
                    className="lfaa-cnv-minimap"
                    position="top-left"
                    pannable
                    zoomable
                    ariaLabel="画布缩略图"
                    nodeStrokeWidth={2}
                    nodeColor={() => "var(--color-brand)"}
                    nodeStrokeColor="var(--color-border-strong)"
                    maskColor="var(--color-canvas)"
                  />
                ) : null}
              </ReactFlow>
            </CanvasNodeContextProvider>
          ) : null}

          {project && nodes.length === 0 && unsupportedNodesRef.current.length === 0 ? (
            <div className="lfaa-cnv-empty" data-testid="canvas-empty">
              <span className="lfaa-cnv-empty__hint">双击画布</span>
              <Button type="text" className="lfaa-cnv-empty__action" data-testid="canvas-empty-create" onClick={() => addNode("text")}>创建节点</Button>
            </div>
          ) : null}

          {!loading && !project ? (
            <div className="lfaa-cnv-empty lfaa-cnv-empty--project">
              <Typography.Title level={3}>先新建一个画布</Typography.Title>
              <p>画布项目与素材只属于当前账户与当前 App。</p>
              <Button type="primary" data-testid="canvas-empty-create" loading={createInFlight.current} onClick={() => void createProject()}>新建画布</Button>
            </div>
          ) : null}

          {addMenu ? (
            <div className="lfaa-cnv-add-menu" data-testid="canvas-add-node-menu" style={{ left: addMenu.x, top: addMenu.y }} role="menu" aria-label="新建节点菜单">
              {ADD_MENU_ITEMS.map(item => (
                <button key={item.kind} type="button" role="menuitem" className="lfaa-cnv-add-menu__item" onClick={() => addNodeAtMenu(item.kind)}>{item.label}</button>
              ))}
              <button type="button" role="menuitem" className="lfaa-cnv-add-menu__item lfaa-cnv-add-menu__cancel" onClick={() => setAddMenu(null)}>取消</button>
            </div>
          ) : null}

          {openingId ? <div className="lfaa-cnv-stage__busy" role="status"><Spin size="small" /><span>正在打开项目…</span></div> : null}
        </div>

        <header className="lfaa-cnv-topbar">
          <div className="lfaa-cnv-topbar__project">
            <Select
              size="small"
              className="lfaa-cnv-project-switch"
              aria-label="切换画布项目"
              data-testid="canvas-project-switcher"
              value={project?.id}
              placeholder="选择画布项目"
              disabled={interactionLocked || !project}
              options={summaries.map(summary => ({ value: summary.id, label: summary.title }))}
              onChange={(projectId: string) => { const summary = summaries.find(item => item.id === projectId); if (summary) void openProject(summary); }}
            />
            <span className="lfaa-cnv-save-status" role="status" aria-live="polite" data-testid="canvas-save-status">{statusText}</span>
          </div>
          <Segmented
            className="lfaa-cnv-mode-switch"
            value={mode}
            onChange={value => { setMode(value as CanvasMode); setAddMenu(null); }}
            options={[
              { value: "generate", label: <span data-testid="canvas-mode-generate">生成</span> },
              { value: "canvas", label: <span data-testid="canvas-mode-canvas">画布</span> }
            ]}
          />
          <div className="lfaa-cnv-topbar__group lfaa-cnv-topbar__group--actions">
            <Tooltip title="撤销（Ctrl+Z）"><Button size="small" type="text" className="lfaa-cnv-topbar__icon lfaa-cnv-wide-only" aria-label="撤销" data-testid="canvas-undo" icon={<UndoOutlined />} disabled={!historyState.canUndo} onClick={undo} /></Tooltip>
            <Tooltip title="重做（Ctrl+Shift+Z）"><Button size="small" type="text" className="lfaa-cnv-topbar__icon lfaa-cnv-wide-only" aria-label="重做" data-testid="canvas-redo" icon={<RedoOutlined />} disabled={!historyState.canRedo} onClick={redo} /></Tooltip>
            <Tooltip title="保存画布（Ctrl+S）"><Button size="small" type="text" className="lfaa-cnv-topbar__icon" aria-label="保存画布" data-testid="canvas-save" aria-keyshortcuts="Control+S" icon={<SaveOutlined />} loading={saving} disabled={!project || !dirty || interactionLocked} onClick={() => void saveProjectNow()} /></Tooltip>
            <Tooltip title="设置中心"><Button size="small" type="text" className="lfaa-cnv-topbar__icon" aria-label="设置中心" icon={<SettingOutlined />} onClick={onOpenSettings} /></Tooltip>
            <Dropdown
              trigger={["click"]}
              menu={{
                items: [
                  { key: "back", label: "返回本 App" },
                  { key: "home", label: "画布首页" },
                  ...(appOptions.length > 1 ? [{ key: "app-switch", label: "切换 App", children: appOptions.map(option => ({ key: "app:" + option.value, label: option.label })) }] : []),
                  { type: "divider" as const },
                  { key: "undo", label: "撤销（Ctrl+Z）", disabled: !historyState.canUndo },
                  { key: "redo", label: "重做（Ctrl+Shift+Z）", disabled: !historyState.canRedo },
                  { key: "rename", label: "重命名当前画布", disabled: !project },
                  { key: "settings", label: "打开设置中心" },
                  { type: "divider" as const },
                  { key: "new", label: "新建画布" },
                  { key: "import", label: "导入画布 JSON" },
                  { key: "export", label: "导出画布 JSON" },
                  { type: "divider" as const },
                  { key: "delete", label: "删除当前项目管理", disabled: !project }
                ],
                onClick: ({ key }) => {
                  if (key === "back") onNavigate(backRoute);
                  else if (key === "home") onNavigate("/canvas");
                  else if (key.startsWith("app:")) {
                    const next = key.slice(4) as ApplicationId;
                    if (next !== applicationId && appOptions.some(option => option.value === next)) onNavigate("/apps/" + encodeURIComponent(next) + "/canvas");
                  }
                  else if (key === "undo") undo();
                  else if (key === "redo") redo();
                  else if (key === "rename" && project) {
                    const next = window.prompt("画布名称（1–80 个字符）", titleRef.current);
                    if (next && next.trim()) {
                      setTitle(next.trim().slice(0, CANVAS_LIMITS.titleLength));
                      markDirty();
                    }
                  } else if (key === "settings") onOpenSettings();
                  else if (key === "new") void createProject();
                  else if (key === "import") importInputRef.current?.click();
                  else if (key === "export") void exportProject();
                  else if (key === "delete" && project) {
                    const summary = summaries.find(item => item.id === project.id) ?? summaryFor(project, totalNodeCount);
                    void removeProject(summary);
                  }
                }
              }}
            >
              <Button size="small" type="text" className="lfaa-cnv-topbar__icon" aria-label="更多画布操作" title="更多画布操作" icon={<EllipsisOutlined />} loading={operation === "export" || operation === "import"} />
            </Dropdown>
          </div>
          {error ? <Alert className="lfaa-cnv-alert" type="error" showIcon closable message={error} onClose={() => setError("")} action={<Button size="small" onClick={onOpenSettings}>设置中心</Button>} /> : null}
          {conflict ? <Alert className="lfaa-cnv-alert" type="warning" showIcon message="保存冲突（HTTP 409）" description="项目已在其他窗口或设备更新。重新加载后可以继续编辑并保存，避免覆盖对方的修改。" action={<Button size="small" loading={openingId !== null} onClick={() => void reloadCurrentProject()}>重新加载</Button>} /> : null}
          {!loading && project && unsupportedNodesRef.current.length > 0 ? (
            <p className="lfaa-cnv-unsupported" role="status">
              当前客户端暂不支持 {unsupportedNodesRef.current.length} 个节点类型（{unsupportedNodesRef.current.map(node => node.type).join("、")}），它们会原样保留但不可编辑。
            </p>
          ) : null}
        </header>

        <input ref={uploadInputRef} className="lfaa-cnv-hidden-input" type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,audio/mpeg,audio/wav,audio/ogg" aria-label="选择要上传的图片、视频或音频素材" onChange={handleUploadInput} />
        <input ref={importInputRef} className="lfaa-cnv-hidden-input" type="file" accept=".json,application/json" aria-label="选择要导入的画布 JSON 文件" onChange={handleImportInput} />

        <nav className="lfaa-cnv-rail" aria-label="画布工具轨">
          {RAIL_ITEMS.map(item => (
            <Tooltip key={item.key} title={item.label} placement="right">
              <button
                type="button"
                className={"lfaa-cnv-rail__item" + (item.key === "assets" && assetsOpen ? " is-active" : "")}
                data-testid={item.testId}
                data-separator-before={item.separatorBefore ? "true" : undefined}
                aria-label={item.label}
                onClick={() => handleRail(item.key)}
              >
                <span className="lfaa-cnv-rail__icon" aria-hidden="true">{item.icon}</span>
              </button>
            </Tooltip>
          ))}
        </nav>

        <div className="lfaa-cnv-zoom" role="group" aria-label="画布缩放">
          <Button size="small" type="text" aria-label="缩小画布" onClick={() => { void flowRef.current?.zoomOut({ duration: 160 }); }}>−</Button>
          <span className="lfaa-cnv-zoom__value" data-testid="canvas-zoom-value">{Math.round(zoom * 100)}%</span>
          <Button size="small" type="text" aria-label="放大画布" onClick={() => { void flowRef.current?.zoomIn({ duration: 160 }); }}>＋</Button>
          <Button size="small" type="text" aria-label="适应画布内容" onClick={() => fitCanvasToNodes()}>适应</Button>
        </div>

        {mode === "generate" ? (compactViewport && !generateExpanded ? (
          <section className="lfaa-cnv-generate lfaa-cnv-generate--collapsed" aria-label="生成工作台（已折叠）" data-testid="canvas-generate-panel">
            <span className="lfaa-cnv-generate__collapsed-type">{generationKind === "image" ? "图片生成" : "视频生成"}</span>
            <span className="lfaa-cnv-generate__collapsed-prompt" title={prompt}>{prompt.trim() || "未输入提示词"}</span>
            <Button size="small" type="primary" data-testid="canvas-node-generation-generate" loading={generationBusy} disabled={!project || interactionLocked} onClick={() => void runGeneration()}>生成</Button>
            <Button size="small" onClick={() => setGenerateExpanded(true)}>展开</Button>
          </section>
        ) : (
          <section className="lfaa-cnv-generate" aria-label="生成工作台" data-testid="canvas-generate-panel">
            <div className="lfaa-cnv-generate__head">
              <Segmented
                size="small"
                value={generationKind}
                onChange={value => {
                  const next = value as "image" | "video";
                  setGenerationKind(next);
                  setAspectRatio(next === "video" ? "16:9" : aspectRatio);
                }}
                options={[{ value: "image", label: "图片" }, { value: "video", label: "视频" }]}
              />
              <Select
                size="small"
                className="lfaa-cnv-generate__aspect"
                aria-label="生成比例"
                value={aspectRatio}
                options={CANVAS_ASPECT_RATIO_OPTIONS.map(option => ({ value: option.value, label: option.label, title: option.note }))}
                onChange={(value: CanvasAspectRatio) => setAspectRatio(value)}
              />
              {generationKind === "video" ? (
                <Select
                  size="small"
                  aria-label="视频时长"
                  value={durationSeconds}
                  options={[5, 10].map(seconds => ({ value: seconds, label: seconds + " 秒" }))}
                  onChange={(value: number) => setDurationSeconds(value)}
                />
              ) : null}
              <span className={"lfaa-cnv-generate__config" + (generationConfigured ? "" : " is-missing")}>
                {generationConfigured
                  ? "生成账户已配置（来自设置中心）"
                  : "尚未在设置中心配置" + (generationKind === "image" ? "图片" : "视频") + "生成账户/模型，生成会显示服务端真实错误"}
                <Button size="small" type="link" onClick={onOpenSettings}>打开设置中心</Button>
              </span>
            </div>
            {aspectRatio === "2:1" ? <p className="lfaa-cnv-generate__note">2:1 只表示“全景比例图像”（按 2:1 图片生成），不是球面全景渲染。</p> : null}
            <div className="lfaa-cnv-generate__prompt">
              <Input.TextArea
                className="nodrag nowheel"
                aria-label="生成提示词"
                placeholder="描述你想生成的画面；输入 @ 引用项目素材"
                maxLength={CANVAS_LIMITS.textLength}
                value={prompt}
                onChange={event => {
                  const value = event.target.value;
                  setPrompt(value);
                  const cursor = event.target.selectionStart ?? value.length;
                  const match = value.slice(0, cursor).match(/@([^\s@]*)$/u);
                  if (match) setMention({ query: match[1] ?? "", start: cursor - match[0].length, end: cursor });
                  else setMention(null);
                }}
                onKeyDown={event => { if (event.key === "Escape") setMention(null); }}
              />
              {mention ? (
                <div className="lfaa-cnv-mention" role="listbox" aria-label="素材引用">
                  {mentionOptions.length === 0 ? <p className="lfaa-cnv-mention__empty">没有匹配的项目素材。</p> : mentionOptions.map(asset => (
                    <button key={asset.assetId} type="button" role="option" aria-selected={false} className="lfaa-cnv-mention__item" onClick={() => applyMention(asset)}>
                      <span>{asset.name}</span><small>{asset.mimeType}</small>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="lfaa-cnv-generate__refs">
              <Select
                size="small"
                mode="multiple"
                className="lfaa-cnv-generate__refs-select"
                aria-label="参考素材"
                placeholder="参考素材（@ 引用）"
                value={referenceIds}
                options={(project?.assets ?? []).map(asset => ({ value: asset.assetId, label: asset.name }))}
                onChange={(next: string[]) => setReferenceIds(next.slice(0, CANVAS_LIMITS.assets))}
              />
            </div>
            <div className="lfaa-cnv-generate__actions">
              <Button type="primary" data-testid="canvas-node-generation-generate" loading={generationBusy} disabled={!project || interactionLocked} onClick={() => void runGeneration()}>
                {generationTargetState && (generationTargetState.status === "succeeded" || generationTargetState.status === "failed")
                  ? "重新生成"
                  : generationKind === "image" ? "生成图片" : "生成视频"}
              </Button>
              <Button disabled title="画质增强未接入：当前没有已核实的图像增强 Owner">画质增强（未接入）</Button>
              {generationTargetState && generationTargetState.status === "running" ? (
                <>
                  <Button onClick={() => void refreshGeneration(generationTargetId!)}>刷新状态</Button>
                  <Button danger onClick={() => void cancelGeneration(generationTargetId!)}>取消任务</Button>
                </>
              ) : null}
              <span className="lfaa-cnv-generate__hint">画质增强未接入：本轮没有已核实的图像增强 Owner，按钮保持禁用，不做假生成。</span>
              {compactViewport ? <Button size="small" onClick={() => setGenerateExpanded(false)}>收起</Button> : null}
            </div>
          </section>
        )) : null}

          </div>
          }
          right={chatMounted ? (
            <aside
              id="canvas-chat-panel"
              className="lfaa-cnv-chat-pane"
              aria-label="小鱼助手对话"
              data-testid="canvas-chat-drawer"
            >
              <header className="lfaa-cnv-chat-pane__header">
                <strong>小鱼助手</strong>
                <Button className="lfaa-cnv-chat-pane__close" size="small" type="text" aria-label="关闭小鱼助手" onClick={closeChatPanel}>关闭</Button>
              </header>
              <div className="lfaa-cnv-chat-pane__body">{chatPanel}</div>
            </aside>
          ) : null}
          overlay={!chatOpen ? (
            <Button
              ref={chatLaunchButtonRef}
              className="lfaa-cnv-chat-launch"
              type="default"
              aria-label="与 AI 对话"
              aria-expanded={false}
              aria-controls="canvas-chat-panel"
              data-testid="canvas-chat-launch"
              onClick={openChatPanel}
            >
              <span className="lfaa-cnv-chat-launch__craft" aria-hidden="true">
                <MessageOutlined />
                <span className="lfaa-cnv-chat-launch__label">与 AI 对话</span>
              </span>
              <span className="lfaa-cnv-chat-launch__effects" aria-hidden="true">
                <span className="lfaa-cnv-chat-launch__smoke" />
                <span className="lfaa-cnv-chat-launch__jet lfaa-cnv-chat-launch__jet--left" />
                <span className="lfaa-cnv-chat-launch__jet lfaa-cnv-chat-launch__jet--right" />
              </span>
            </Button>
          ) : null}
        />

        {directorDeskNode ? (
          <CanvasDirectorDeskEditor
            key={directorDeskNode.id}
            desk={directorDeskNode.data.desk ?? { shotNodeIds: [] }}
            snapToGrid={canvasSettings.snapToGrid}
            saving={saving}
            disabled={interactionLocked || generationBusy || !project}
            error={error}
            onChange={desk => onPatch(directorDeskNode.id, { desk })}
            onClose={() => setDirectorDeskNodeId(null)}
            onSaveAndClose={() => { void saveAndCloseDirectorDesk(); }}
          />
        ) : null}

        {assetsOpen ? <button type="button" className="lfaa-cnv-scrim" aria-label="关闭资产库" onClick={() => setAssetsOpen(false)} /> : null}
        <CanvasAssetPanel
          project={project}
          open={assetsOpen}
          disabled={!project || interactionLocked}
          uploading={operation === "upload"}
          deletingAssetId={deletingAssetId}
          onUpload={file => void uploadAsset(file, false)}
          onInsert={asset => insertAssetNode(asset, false)}
          onInsertReference={asset => insertAssetNode(asset, true)}
          onCopyReference={asset => void copyAssetReference(asset)}
          onDelete={asset => void removeAsset(asset)}
          onClose={() => setAssetsOpen(false)}
        />
      </section>
    </div>
  );
}
