/** 功能：无限画布工作区。作用：按账户管理画布项目，用 React Flow 编辑文本/图片/视频/备注节点与素材，并保存到画布服务端。关联文件：CanvasNodeCards.tsx、CanvasAssetPanel.tsx、CanvasProjectTransfer.ts、canvas-workspace.css、dist/.tmp/canvas/CONTRACT.md。 */
import { addEdge, Background, Controls, MiniMap, ReactFlow, useEdgesState, useNodesState, type Connection, type Edge, type EdgeChange, type NodeChange, type Viewport } from "@xyflow/react";
import { Alert, Button, Dropdown, Input, Popconfirm, Select, Spin, Typography } from "antd";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  ApiError, canvasAssetUrl, createCanvasProject, deleteCanvasAsset, deleteCanvasProject, getErrorMessage,
  loadCanvasProject, loadCanvasProjects, saveCanvasProject, uploadCanvasAsset,
  type ApplicationId, type CanvasEdge, type CanvasNode, type CanvasProject, type CanvasProjectSummary, type User, type UserSettings
} from "lfaa-client-connection/src/api.js";
import type { ServiceState } from "lfaa-client-ui-primitives/src/ServiceStatus.js";
import { GlobalNavigationRail, type ApplicationNavigationItem } from "lfaa-client-ui-sidebar/src/GlobalNavigationRail.js";
import { CanvasAssetPanel, type CanvasProjectAsset } from "./CanvasAssetPanel.js";
import { CANVAS_NODE_TYPES, type CanvasFlowNode, type CanvasNodeData, type CanvasNodeKind } from "./CanvasNodeCards.js";
import {
  CANVAS_LIMITS, MAX_IMPORT_FILE_BYTES, MAX_TRANSFER_BYTES, buildCanvasExportDocument, bytesToBase64,
  canvasAssetKind, canvasExportFileName, estimateBase64Length, formatCanvasBytes, parseCanvasImport, type CanvasExportAsset
} from "./CanvasProjectTransfer.js";
import "@xyflow/react/dist/style.css";
import "./canvas-workspace.css";

type CanvasOperation = "upload" | "asset-delete" | "import" | "export";
type CanvasAddKind = "text" | "note" | "image" | "video";

const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };
/** 新建节点的默认尺寸；仍受画布服务端 120–800 的权威范围校验。 */
const NODE_DEFAULT_SIZE: Record<CanvasNodeKind, { width: number; height: number }> = {
  text: { width: 320, height: 220 },
  note: { width: 280, height: 190 },
  image: { width: 320, height: 260 },
  video: { width: 320, height: 260 }
};

function canvasErrorText(error: unknown, fallback: string): string {
  const message = getErrorMessage(error);
  return !message || message === "发生了未知错误，请重试。" ? fallback : message;
}

function isConflictError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409;
}

function clampCoordinate(value: number): number {
  return Math.min(CANVAS_LIMITS.coordinate, Math.max(-CANVAS_LIMITS.coordinate, value));
}

function summaryFor(project: CanvasProject, nodeCount = project.nodes.length): CanvasProjectSummary {
  return { id: project.id, title: project.title, nodeCount, assetCount: project.assets.length, createdAt: project.createdAt, updatedAt: project.updatedAt };
}

function upsertSummary(list: CanvasProjectSummary[], summary: CanvasProjectSummary): CanvasProjectSummary[] {
  const index = list.findIndex(item => item.id === summary.id);
  if (index === -1) return [summary, ...list];
  const next = list.slice();
  next[index] = summary;
  return next;
}

function flowNodesFrom(project: CanvasProject, onTextChange: CanvasNodeData["onTextChange"], onRemove: CanvasNodeData["onRemove"]): CanvasFlowNode[] {
  return project.nodes.map(node => {
    const defaultSize = NODE_DEFAULT_SIZE[node.type];
    const width = Math.min(CANVAS_LIMITS.maxNodeSize, Math.max(CANVAS_LIMITS.minNodeSize, node.width || defaultSize.width));
    const height = Math.min(CANVAS_LIMITS.maxNodeSize, Math.max(CANVAS_LIMITS.minNodeSize, node.height || defaultSize.height));
    return {
      id: node.id,
      type: node.type,
      position: { x: node.x, y: node.y },
      style: { width, height },
      data: {
        kind: node.type,
        projectId: project.id,
        text: typeof node.data.text === "string" ? node.data.text.slice(0, CANVAS_LIMITS.textLength) : "",
        ...(typeof node.data.assetId === "string" ? { assetId: node.data.assetId } : {}),
        ...(typeof node.data.assetName === "string" ? { assetName: node.data.assetName } : {}),
        onTextChange,
        onRemove
      }
    };
  });
}

function flowEdgesFrom(project: CanvasProject): Edge[] {
  return project.edges.map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    ...(edge.sourceHandle ? { sourceHandle: edge.sourceHandle } : {}),
    ...(edge.targetHandle ? { targetHandle: edge.targetHandle } : {}),
    type: "smoothstep"
  }));
}

function persistedDataFrom(data: CanvasNodeData): Record<string, unknown> {
  if (data.kind === "text" || data.kind === "note") return { text: data.text.slice(0, CANVAS_LIMITS.textLength) };
  return {
    ...(data.assetId ? { assetId: data.assetId } : {}),
    ...(data.assetName ? { assetName: data.assetName } : {})
  };
}

function persistedNodesFrom(nodes: CanvasFlowNode[]): CanvasNode[] {
  return nodes.map(node => {
    const defaultSize = NODE_DEFAULT_SIZE[node.data.kind];
    const width = Math.min(CANVAS_LIMITS.maxNodeSize, Math.max(CANVAS_LIMITS.minNodeSize, Math.round(node.measured?.width ?? defaultSize.width)));
    const height = Math.min(CANVAS_LIMITS.maxNodeSize, Math.max(CANVAS_LIMITS.minNodeSize, Math.round(node.measured?.height ?? defaultSize.height)));
    return {
      id: node.id,
      type: node.data.kind,
      x: Math.round(node.position.x),
      y: Math.round(node.position.y),
      width,
      height,
      data: persistedDataFrom(node.data)
    };
  });
}

function persistedEdgesFrom(edges: Edge[]): CanvasEdge[] {
  return edges.map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    ...(edge.sourceHandle ? { sourceHandle: edge.sourceHandle } : {}),
    ...(edge.targetHandle ? { targetHandle: edge.targetHandle } : {})
  }));
}

function payloadFor(project: CanvasProject, title: string, viewport: Viewport, nodes: CanvasFlowNode[], edges: Edge[]): CanvasProject {
  return {
    format: "lfaa-canvas-project",
    formatVersion: 1,
    id: project.id,
    title,
    viewport: {
      x: Math.min(CANVAS_LIMITS.coordinate, Math.max(-CANVAS_LIMITS.coordinate, viewport.x)),
      y: Math.min(CANVAS_LIMITS.coordinate, Math.max(-CANVAS_LIMITS.coordinate, viewport.y)),
      zoom: viewport.zoom
    },
    nodes: persistedNodesFrom(nodes),
    edges: persistedEdgesFrom(edges),
    assets: project.assets,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt
  };
}

export interface CanvasWorkspaceProps {
  user: User;
  settings: UserSettings;
  serverState: ServiceState;
  applications: ApplicationNavigationItem[];
  navigationApplications: ApplicationNavigationItem[];
  onNavigate: (path: string) => void;
  onOpenApplication: (app: ApplicationId, mode: "normal") => Promise<void>;
  onOpenApplications?: () => void;
  onOpenRecentSessions: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

export function CanvasWorkspace({ user, settings, serverState, applications, navigationApplications, onNavigate, onOpenApplication, onOpenApplications, onOpenRecentSessions, onOpenSettings, onLogout }: CanvasWorkspaceProps) {
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
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [conflict, setConflict] = useState(false);
  const [flowRevision, setFlowRevision] = useState(0);

  const mountedRef = useRef(true);
  const projectRef = useRef<CanvasProject | null>(null);
  const nodesRef = useRef<CanvasFlowNode[]>([]);
  const dirtyRef = useRef(false);
  const saveInFlight = useRef(false);
  const busyRef = useRef(false);
  const editRevision = useRef(0);
  const viewportRef = useRef<Viewport>(DEFAULT_VIEWPORT);
  const canvasRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const timersRef = useRef<Set<number>>(new Set());
  const downloadUrlsRef = useRef<Set<string>>(new Set());
  const createInFlight = useRef(false);
  const openInFlight = useRef(false);
  const deleteInFlight = useRef(false);
  const saveActionRef = useRef<() => void>(() => undefined);

  projectRef.current = project;
  nodesRef.current = nodes;
  dirtyRef.current = dirty;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => () => {
    for (const timer of timersRef.current) window.clearTimeout(timer);
    timersRef.current.clear();
    for (const url of downloadUrlsRef.current) URL.revokeObjectURL(url);
    downloadUrlsRef.current.clear();
  }, []);

  const scheduleTimer = useCallback((callback: () => void, delay: number) => {
    const timer = window.setTimeout(() => { timersRef.current.delete(timer); callback(); }, delay);
    timersRef.current.add(timer);
  }, []);

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

  const markDirty = useCallback(() => {
    editRevision.current += 1;
    setDirty(true);
    setNotice("");
  }, []);

  const onTextChange = useCallback((id: string, text: string) => {
    const value = text.slice(0, CANVAS_LIMITS.textLength);
    setNodes(current => current.map(node => node.id === id ? { ...node, data: { ...node.data, text: value } } : node));
    markDirty();
  }, [markDirty, setNodes]);

  const onRemove = useCallback((id: string) => {
    setNodes(current => current.filter(node => node.id !== id));
    setEdges(current => current.filter(edge => edge.source !== id && edge.target !== id));
    markDirty();
  }, [markDirty, setEdges, setNodes]);

  const applyProject = useCallback((next: CanvasProject) => {
    editRevision.current += 1;
    projectRef.current = next;
    viewportRef.current = next.viewport ?? DEFAULT_VIEWPORT;
    setProject(next);
    setTitle(next.title);
    setNodes(flowNodesFrom(next, onTextChange, onRemove));
    setEdges(flowEdgesFrom(next));
    setDirty(false);
    setConflict(false);
    setError("");
    setNotice("");
    setFlowRevision(current => current + 1);
  }, [onRemove, onTextChange, setEdges, setNodes]);

  const clearProject = useCallback(() => {
    editRevision.current += 1;
    projectRef.current = null;
    viewportRef.current = DEFAULT_VIEWPORT;
    setProject(null);
    setTitle("");
    setNodes([]);
    setEdges([]);
    setDirty(false);
    setConflict(false);
    setFlowRevision(current => current + 1);
  }, [setEdges, setNodes]);

  const updateProjectMeta = useCallback((updated: CanvasProject) => {
    projectRef.current = updated;
    setProject(updated);
    setSummaries(list => upsertSummary(list, summaryFor(updated, nodesRef.current.length)));
  }, []);

  const confirmDiscard = useCallback((action: string): boolean => {
    if (!dirtyRef.current) return true;
    return window.confirm(`当前画布有未保存更改，${action}后将丢弃这些更改。要继续吗？`);
  }, []);

  const reloadSummaries = useCallback(async () => {
    const { projects } = await loadCanvasProjects();
    if (mountedRef.current) setSummaries(projects);
    return projects;
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { projects } = await loadCanvasProjects();
        if (!active) return;
        setSummaries(projects);
        const first = projects[0];
        if (first) {
          const { project: loaded } = await loadCanvasProject(first.id);
          if (active) applyProject(loaded);
        }
      } catch (loadError) {
        if (active) setError(canvasErrorText(loadError, "无法加载画布项目。"));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [applyProject]);

  const openProject = useCallback(async (summary: CanvasProjectSummary) => {
    if (projectRef.current?.id === summary.id || openInFlight.current || busyRef.current || saveInFlight.current) return;
    if (!confirmDiscard("切换项目")) return;
    openInFlight.current = true;
    setOpeningId(summary.id);
    setError("");
    setNotice("");
    try {
      const { project: loaded } = await loadCanvasProject(summary.id);
      if (mountedRef.current) {
        applyProject(loaded);
        setSummaries(list => upsertSummary(list, summaryFor(loaded)));
        setNotice(`已打开画布「${loaded.title}」。`);
      }
    } catch (openError) {
      if (mountedRef.current) setError(canvasErrorText(openError, "打开画布项目失败。"));
    } finally {
      openInFlight.current = false;
      if (mountedRef.current) setOpeningId(null);
    }
  }, [applyProject, confirmDiscard]);

  const createProject = useCallback(async () => {
    if (createInFlight.current || busyRef.current || saveInFlight.current || openInFlight.current) return;
    if (!confirmDiscard("新建画布")) return;
    createInFlight.current = true;
    setError("");
    setNotice("");
    try {
      const { project: created } = await createCanvasProject(`画布 ${summaries.length + 1}`);
      if (!mountedRef.current) return;
      applyProject(created);
      setSummaries(list => upsertSummary(list, summaryFor(created)));
      setNotice("已新建画布，添加节点后按 Ctrl+S 保存。");
    } catch (createError) {
      if (mountedRef.current) setError(canvasErrorText(createError, "新建画布项目失败。"));
    } finally {
      createInFlight.current = false;
    }
  }, [applyProject, confirmDiscard, summaries.length]);

  const reloadCurrentProject = useCallback(async () => {
    const current = projectRef.current;
    if (!current || openInFlight.current || busyRef.current || saveInFlight.current) return;
    if (!confirmDiscard("重新加载")) return;
    openInFlight.current = true;
    setOpeningId(current.id);
    setError("");
    try {
      const { project: loaded } = await loadCanvasProject(current.id);
      if (mountedRef.current) {
        applyProject(loaded);
        setSummaries(list => upsertSummary(list, summaryFor(loaded)));
        setNotice("已重新加载项目。");
      }
    } catch (reloadError) {
      if (mountedRef.current) setError(canvasErrorText(reloadError, "重新加载画布项目失败。"));
    } finally {
      openInFlight.current = false;
      if (mountedRef.current) setOpeningId(null);
    }
  }, [applyProject, confirmDiscard]);

  const removeProject = useCallback(async (summary: CanvasProjectSummary) => {
    if (deleteInFlight.current || busyRef.current || saveInFlight.current) return;
    const active = projectRef.current?.id === summary.id;
    if (active && !confirmDiscard("删除当前画布")) return;
    deleteInFlight.current = true;
    setDeletingProjectId(summary.id);
    setError("");
    setNotice("");
    try {
      await deleteCanvasProject(summary.id);
      if (!mountedRef.current) return;
      const projects = await reloadSummaries();
      if (!mountedRef.current) return;
      if (active) {
        const next = projects[0];
        if (next) {
          const { project: loaded } = await loadCanvasProject(next.id);
          if (mountedRef.current) applyProject(loaded);
        } else {
          clearProject();
        }
      }
      setNotice(`已删除画布「${summary.title}」。`);
    } catch (deleteError) {
      if (mountedRef.current) setError(canvasErrorText(deleteError, "删除画布项目失败。"));
    } finally {
      deleteInFlight.current = false;
      if (mountedRef.current) setDeletingProjectId(null);
    }
  }, [applyProject, clearProject, confirmDiscard, reloadSummaries]);

  const placementForNewNode = useCallback((): { x: number; y: number } => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const viewport = viewportRef.current;
    const width = rect?.width ?? 900;
    const height = rect?.height ?? 560;
    const centerX = (width / 2 - viewport.x) / viewport.zoom;
    const centerY = (height / 2 - viewport.y) / viewport.zoom;
    const offset = (nodesRef.current.length % 5) * 26;
    return { x: clampCoordinate(Math.round(centerX - 160 + offset)), y: clampCoordinate(Math.round(centerY - 120 + offset)) };
  }, []);

  const addNode = useCallback((kind: CanvasNodeKind) => {
    const current = projectRef.current;
    if (!current || busyRef.current || saveInFlight.current) return;
    if (nodesRef.current.length >= CANVAS_LIMITS.nodes) {
      setError(`每个画布最多 ${CANVAS_LIMITS.nodes} 个节点，请先删除部分节点。`);
      return;
    }
    const size = NODE_DEFAULT_SIZE[kind];
    const node: CanvasFlowNode = {
      id: crypto.randomUUID(),
      type: kind,
      position: placementForNewNode(),
      style: { width: size.width, height: size.height },
      data: { kind, projectId: current.id, text: "", onTextChange, onRemove }
    };
    setNodes(items => [...items, node]);
    markDirty();
  }, [markDirty, onRemove, onTextChange, placementForNewNode, setNodes]);

  const handleAddNode = useCallback((kind: CanvasAddKind) => {
    if (kind === "text" || kind === "note") {
      addNode(kind);
      return;
    }
    setAssetsOpen(true);
    setNotice(kind === "image" ? "请从素材面板选择图片并点击「插入画布」。" : "请从素材面板选择视频并点击「插入画布」。");
  }, [addNode]);

  const insertAsset = useCallback((asset: CanvasProjectAsset) => {
    const current = projectRef.current;
    if (!current) return;
    if (nodesRef.current.length >= CANVAS_LIMITS.nodes) {
      setError(`每个画布最多 ${CANVAS_LIMITS.nodes} 个节点，请先删除部分节点。`);
      return;
    }
    const kind: CanvasNodeKind = asset.mimeType.startsWith("video/") ? "video" : "image";
    const size = NODE_DEFAULT_SIZE[kind];
    const node: CanvasFlowNode = {
      id: crypto.randomUUID(),
      type: kind,
      position: placementForNewNode(),
      style: { width: size.width, height: size.height },
      data: { kind, projectId: current.id, text: "", assetId: asset.assetId, assetName: asset.name, onTextChange, onRemove }
    };
    setNodes(items => [...items, node]);
    markDirty();
    setNotice(`素材「${asset.name}」已插入画布，保存项目后引用才会保存。`);
  }, [markDirty, onRemove, onTextChange, placementForNewNode, setNodes]);

  const onFlowNodesChange = useCallback((changes: NodeChange<CanvasFlowNode>[]) => {
    onNodesChange(changes);
    if (changes.some(change => change.type === "position" || change.type === "remove")) markDirty();
    const removed: string[] = [];
    for (const change of changes) if (change.type === "remove") removed.push(change.id);
    if (removed.length) setEdges(current => current.filter(edge => !removed.includes(edge.source) && !removed.includes(edge.target)));
  }, [markDirty, onNodesChange, setEdges]);

  const onFlowEdgesChange = useCallback((changes: EdgeChange<Edge>[]) => {
    onEdgesChange(changes);
    if (changes.some(change => change.type === "remove")) markDirty();
  }, [markDirty, onEdgesChange]);

  const onConnect = useCallback((connection: Connection) => {
    if (!projectRef.current) return;
    if (edges.length >= CANVAS_LIMITS.edges) {
      setError(`每个画布最多 ${CANVAS_LIMITS.edges} 条连线，请先删除部分连线。`);
      return;
    }
    if (!connection.source || !connection.target || connection.source === connection.target) return;
    setEdges(current => addEdge({ ...connection, id: crypto.randomUUID(), type: "smoothstep" }, current));
    markDirty();
  }, [edges.length, markDirty, setEdges]);

  const saveProject = useCallback(async () => {
    const current = projectRef.current;
    if (!current || saveInFlight.current || busyRef.current) return;
    if (!dirtyRef.current) return;
    const nextTitle = title.trim();
    if (!nextTitle) {
      setError("项目名称不能为空（1–80 个字符）。");
      return;
    }
    saveInFlight.current = true;
    setSaving(true);
    setError("");
    setNotice("");
    const revision = editRevision.current;
    const payload = payloadFor(current, nextTitle, viewportRef.current, nodes, edges);
    try {
      const { project: saved } = await saveCanvasProject(current.id, current.updatedAt, payload);
      if (!mountedRef.current) return;
      projectRef.current = saved;
      setProject(saved);
      setSummaries(list => upsertSummary(list, summaryFor(saved)));
      setConflict(false);
      if (editRevision.current === revision) {
        setTitle(saved.title);
        setNodes(flowNodesFrom(saved, onTextChange, onRemove));
        setEdges(flowEdgesFrom(saved));
        setDirty(false);
        setNotice("画布已保存。");
      } else {
        setNotice("本次更改已保存；保存期间的新编辑仍未保存。");
      }
    } catch (saveError) {
      if (!mountedRef.current) return;
      if (isConflictError(saveError)) {
        setConflict(true);
        setError("项目已在其他窗口或设备更新（HTTP 409）。请重新加载后再保存，避免覆盖对方的修改。");
      } else {
        setError(canvasErrorText(saveError, "保存画布项目失败。"));
      }
    } finally {
      saveInFlight.current = false;
      if (mountedRef.current) setSaving(false);
    }
  }, [edges, nodes, onRemove, onTextChange, setEdges, setNodes, title]);

  saveActionRef.current = () => { void saveProject(); };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      if (event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      saveActionRef.current();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  const uploadAsset = useCallback(async (file: File) => {
    const current = projectRef.current;
    if (!current || busyRef.current || saveInFlight.current) return;
    const kind = canvasAssetKind(file.type);
    if (!kind || !file.type) {
      setError("素材只支持 PNG、JPEG、WebP 图片或 MP4、WebM 视频。");
      return;
    }
    const limit = kind === "image" ? CANVAS_LIMITS.imageBytes : CANVAS_LIMITS.videoBytes;
    if (file.size > limit) {
      setError(`${kind === "image" ? "图片" : "视频"}不能超过 ${formatCanvasBytes(limit)}。`);
      return;
    }
    if (current.assets.length >= CANVAS_LIMITS.assets) {
      setError(`每个画布最多保存 ${CANVAS_LIMITS.assets} 个素材，请先删除不需要的素材。`);
      return;
    }
    const totalBytes = current.assets.reduce((total, asset) => total + asset.bytes, 0) + file.size;
    if (totalBytes > CANVAS_LIMITS.projectAssetBytes) {
      setError(`画布素材总量不能超过 ${formatCanvasBytes(CANVAS_LIMITS.projectAssetBytes)}，请先删除部分素材。`);
      return;
    }
    startOperation("upload");
    try {
      const { project: updated } = await uploadCanvasAsset(current.id, current.updatedAt, file.name.slice(0, 120), file, file.type);
      if (!mountedRef.current) return;
      updateProjectMeta(updated);
      const uploaded = updated.assets[updated.assets.length - 1];
      setNotice(`已上传素材「${uploaded?.name ?? file.name}」，可从素材面板插入画布。`);
    } catch (uploadError) {
      if (!mountedRef.current) return;
      if (isConflictError(uploadError)) {
        setConflict(true);
        setError("项目已在其他窗口或设备更新（HTTP 409）。请重新加载后再上传素材，避免覆盖对方的修改。");
      } else {
        setError(canvasErrorText(uploadError, "上传画布素材失败。"));
      }
    } finally {
      finishOperation();
    }
  }, [finishOperation, startOperation, updateProjectMeta]);

  const removeAsset = useCallback(async (asset: CanvasProjectAsset) => {
    const current = projectRef.current;
    if (!current || busyRef.current || saveInFlight.current) return;
    const referenced = nodesRef.current.filter(node => node.data.assetId === asset.assetId).length;
    if (referenced > 0) {
      setAssetsOpen(true);
      setError(`素材「${asset.name}」仍被 ${referenced} 个节点引用，请先删除这些节点。`);
      return;
    }
    if (!window.confirm(`删除素材「${asset.name}」？删除后不可恢复。`)) return;
    startOperation("asset-delete");
    setDeletingAssetId(asset.assetId);
    try {
      const { project: updated } = await deleteCanvasAsset(current.id, asset.assetId, current.updatedAt);
      if (!mountedRef.current) return;
      updateProjectMeta(updated);
      setNotice(`已删除素材「${asset.name}」。`);
    } catch (deleteError) {
      if (!mountedRef.current) return;
      if (isConflictError(deleteError)) {
        setConflict(true);
        setError("项目已在其他窗口或设备更新（HTTP 409）。请重新加载后再删除素材，避免覆盖对方的修改。");
      } else {
        setError(canvasErrorText(deleteError, "删除画布素材失败。"));
      }
    } finally {
      finishOperation();
    }
  }, [finishOperation, startOperation, updateProjectMeta]);

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
    const exportTitle = (title.trim() || current.title).slice(0, CANVAS_LIMITS.titleLength);
    const estimatedBytes = current.assets.reduce((total, asset) => total + estimateBase64Length(asset.bytes), 0);
    if (estimatedBytes > MAX_TRANSFER_BYTES) {
      setError(`素材转成 base64 后约 ${formatCanvasBytes(estimatedBytes)}，超过 ${formatCanvasBytes(MAX_TRANSFER_BYTES)} 导出上限。请先删除部分素材。`);
      return;
    }
    startOperation("export");
    setProgressNote("正在整理画布 JSON…");
    try {
      const exportedAssets: CanvasExportAsset[] = [];
      let usedBytes = 0;
      for (let index = 0; index < current.assets.length; index += 1) {
        const asset = current.assets[index]!;
        if (mountedRef.current) setProgressNote(`正在读取素材 ${index + 1}/${current.assets.length}…`);
        const response = await fetch(canvasAssetUrl(current.id, asset.assetId), { credentials: "same-origin", cache: "no-store" });
        if (!response.ok) throw new Error(`读取素材「${asset.name}」失败（HTTP ${response.status}）。`);
        const bytes = new Uint8Array(await response.arrayBuffer());
        const base64 = bytesToBase64(bytes);
        usedBytes += base64.length;
        if (usedBytes > MAX_TRANSFER_BYTES) throw new Error(`导出内容超过 ${formatCanvasBytes(MAX_TRANSFER_BYTES)} 上限。`);
        exportedAssets.push({ assetId: asset.assetId, name: asset.name, mimeType: asset.mimeType, bytes: bytes.byteLength, data: base64 });
      }
      const documentValue = buildCanvasExportDocument({
        title: exportTitle,
        viewport: viewportRef.current,
        nodes: persistedNodesFrom(nodes),
        edges: persistedEdgesFrom(edges),
        assets: exportedAssets,
        exportedAt: new Date().toISOString()
      });
      const content = JSON.stringify(documentValue);
      if (content.length > MAX_TRANSFER_BYTES) throw new Error(`导出的 JSON 超过 ${formatCanvasBytes(MAX_TRANSFER_BYTES)} 上限。`);
      downloadJson(canvasExportFileName(exportTitle), content);
      if (mountedRef.current) setNotice(dirtyRef.current ? "已导出当前画布（包含未保存的更改）。" : "已导出画布 JSON 文件。");
    } catch (exportError) {
      if (mountedRef.current) setError(canvasErrorText(exportError, "导出画布失败。"));
    } finally {
      finishOperation();
    }
  }, [downloadJson, edges, finishOperation, nodes, startOperation, title]);

  const importProjectFile = useCallback(async (file: File) => {
    if (busyRef.current || saveInFlight.current) return;
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setError(`导入文件超过 ${formatCanvasBytes(MAX_IMPORT_FILE_BYTES)} 上限。`);
      return;
    }
    if (!confirmDiscard("导入画布")) return;
    startOperation("import");
    let createdId: string | null = null;
    let rollbackFailed = false;
    try {
      setProgressNote("正在读取导入文件…");
      const text = await file.text();
      const bundle = parseCanvasImport(text);
      setProgressNote("正在创建导入项目…");
      const { project: created } = await createCanvasProject(bundle.title);
      createdId = created.id;
      let latest = created;
      const assetIdMap = new Map<string, string>();
      for (let index = 0; index < bundle.assets.length; index += 1) {
        const asset = bundle.assets[index]!;
        if (mountedRef.current) setProgressNote(`正在上传素材 ${index + 1}/${bundle.assets.length}…`);
        const blob = new Blob([asset.bytes], { type: asset.mimeType });
        const { project: updated } = await uploadCanvasAsset(created.id, latest.updatedAt, asset.name, blob, asset.mimeType);
        const uploaded = updated.assets[updated.assets.length - 1];
        if (uploaded) assetIdMap.set(asset.id, uploaded.assetId);
        latest = updated;
      }
      if (mountedRef.current) setProgressNote("正在保存导入项目…");
      const importedNodes = bundle.nodes.map(node => {
        const mapped = typeof node.data.assetId === "string" ? assetIdMap.get(node.data.assetId) : undefined;
        return { ...node, data: mapped ? { ...node.data, assetId: mapped } : node.data };
      });
      const payload: CanvasProject = { ...latest, title: bundle.title, viewport: bundle.viewport, nodes: importedNodes, edges: bundle.edges };
      const { project: saved } = await saveCanvasProject(created.id, latest.updatedAt, payload);
      if (!mountedRef.current) return;
      applyProject(saved);
      setSummaries(list => upsertSummary(list, summaryFor(saved)));
      setNotice(`已导入画布「${saved.title}」。`);
    } catch (importError) {
      if (createdId) {
        try {
          await deleteCanvasProject(createdId);
        } catch {
          rollbackFailed = true;
        }
        try {
          await reloadSummaries();
        } catch {
          // 列表刷新失败时保留原列表；回滚结果由下方文案说明。
        }
      }
      if (!mountedRef.current) return;
      const detail = canvasErrorText(importError, "无法读取导入文件。");
      setError(createdId
        ? rollbackFailed
          ? `导入失败：${detail}。临时项目未能删除，请在项目列表手动删除。`
          : `导入失败：${detail}（已删除临时项目）。`
        : `导入失败：${detail}`);
    } finally {
      finishOperation();
    }
  }, [applyProject, confirmDiscard, finishOperation, reloadSummaries, startOperation]);

  const handleImportInput = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) void importProjectFile(file);
  }, [importProjectFile]);

  const interactionLocked = saving || operation !== null || openingId !== null || deletingProjectId !== null;
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

  return (
    <div className="module-workbench-stage lfaa-canvas-outer">
      <GlobalNavigationRail
        username={user.username}
        role={user.role}
        serverState={serverState}
        shortcuts={settings.shortcuts}
        activePage="canvas"
        homeLabel="返回小鱼智能体"
        applications={applications}
        navigationApplications={navigationApplications}
        showServiceStatus={settings.general.showServiceStatus}
        onHome={() => onNavigate("/work")}
        onToggleApplications={onOpenApplications}
        onOpenRecentSessions={onOpenRecentSessions}
        onNavigate={onNavigate}
        onOpenApplication={onOpenApplication}
        onOpenWork={() => onNavigate("/work")}
        onOpenFiles={() => onNavigate("/files")}
        onOpenCanvas={() => onNavigate("/canvas")}
        onOpenSettings={onOpenSettings}
        onLogout={onLogout}
      />
      <section className="lfaa-canvas-workspace" aria-labelledby="lfaa-canvas-heading" aria-busy={loading || saving || operation !== null}>
      <div className="lfaa-canvas-shell">
        <header className="lfaa-canvas-header">
          <div className="lfaa-canvas-header__copy">
            <Typography.Title id="lfaa-canvas-heading" level={2}>无限画布</Typography.Title>
            <Typography.Paragraph>在一个本机项目里编排文本、图片、视频与备注节点，素材随项目保存到当前账户。</Typography.Paragraph>
          </div>
          <div className="lfaa-canvas-status" role="status" aria-live="polite">{statusText}</div>
        </header>
        <input ref={importInputRef} className="lfaa-canvas-hidden-input" type="file" accept=".json,application/json" aria-label="选择要导入的画布 JSON 文件" onChange={handleImportInput} />
        {loading ? (
          <div className="lfaa-canvas-loading"><Spin /><span>正在读取账户画布项目…</span></div>
        ) : (
          <>
            {conflict ? (
              <Alert className="lfaa-canvas-alert" type="warning" showIcon message="保存冲突（HTTP 409）" description="项目已在其他窗口或设备更新。重新加载后可以继续编辑并保存，避免覆盖对方的修改。" action={<Button size="small" loading={openingId !== null} onClick={() => void reloadCurrentProject()}>重新加载</Button>} />
            ) : null}
            {error ? <Alert className="lfaa-canvas-alert" type="error" showIcon closable message={error} onClose={() => setError("")} /> : null}
            <div className="lfaa-canvas-toolbar">
              <Select className="lfaa-canvas-toolbar__project-select" aria-label="切换画布项目" value={project?.id} placeholder="选择画布项目" disabled={interactionLocked} options={summaries.map(summary => ({ value: summary.id, label: summary.title }))} onChange={(projectId: string) => { const summary = summaries.find(item => item.id === projectId); if (summary) void openProject(summary); }} />
              <Input className="lfaa-canvas-toolbar__title" aria-label="画布项目名称" maxLength={CANVAS_LIMITS.titleLength} value={title} disabled={!project || saving} placeholder="项目名称" onChange={event => { setTitle(event.target.value.slice(0, CANVAS_LIMITS.titleLength)); markDirty(); }} />
              <Button onClick={() => void createProject()} disabled={interactionLocked}>新建画布</Button>
              <Dropdown disabled={!project || interactionLocked} trigger={["click"]} menu={{
                items: [
                  { key: "text", label: "文本节点" },
                  { key: "note", label: "备注节点" },
                  { key: "image", label: "图片节点（从素材面板插入）" },
                  { key: "video", label: "视频节点（从素材面板插入）" }
                ],
                onClick: ({ key }: { key: string }) => handleAddNode(key as CanvasAddKind)
              }}>
                <Button disabled={!project || interactionLocked}>添加节点</Button>
              </Dropdown>
              <Button className="lfaa-canvas-toolbar__assets-toggle" aria-expanded={assetsOpen} disabled={!project || interactionLocked} onClick={() => setAssetsOpen(current => !current)}>素材</Button>
              <Button disabled={busyRef.current || interactionLocked} onClick={() => importInputRef.current?.click()}>导入</Button>
              <Button loading={operation === "export"} disabled={!project || interactionLocked} onClick={() => void exportProject()}>导出</Button>
              {project ? (
                <Popconfirm title="删除当前画布项目？" description="节点、连线与素材都会一并删除，且无法恢复。" okText="删除" cancelText="取消" onConfirm={() => void removeProject({ id: project.id, title: project.title, nodeCount: nodes.length, assetCount: project.assets.length, createdAt: project.createdAt, updatedAt: project.updatedAt })}>
                  <Button danger loading={deletingProjectId === project.id} disabled={interactionLocked}>删除项目</Button>
                </Popconfirm>
              ) : null}
              <Button type="primary" aria-keyshortcuts="Control+S" loading={saving} disabled={!project || !dirty || interactionLocked} onClick={() => void saveProject()}>保存</Button>
            </div>
            <div className="lfaa-canvas-body">
              <aside className="lfaa-canvas-projects" aria-label="画布项目列表">
                <header className="lfaa-canvas-projects__header">
                  <strong>项目</strong>
                  <span>{summaries.length}</span>
                </header>
                <div className="lfaa-canvas-projects__list" role="list">
                  {summaries.map(summary => {
                    const active = project?.id === summary.id;
                    return (
                      <div key={summary.id} className={`lfaa-canvas-projects__item${active ? " is-active" : ""}`} role="listitem">
                        <button type="button" className="lfaa-canvas-projects__open" aria-current={active ? "page" : undefined} disabled={interactionLocked} onClick={() => void openProject(summary)}>
                          <span className="lfaa-canvas-projects__name" title={summary.title}>{summary.title}</span>
                          <small>{summary.nodeCount} 节点 · {summary.assetCount} 素材</small>
                        </button>
                        <Popconfirm title={`删除画布「${summary.title}」？`} description="节点、连线与素材都会一并删除，且无法恢复。" okText="删除" cancelText="取消" onConfirm={() => void removeProject(summary)}>
                          <button type="button" className="lfaa-canvas-projects__delete" aria-label={`删除画布项目：${summary.title}`} disabled={interactionLocked} title="删除项目">删</button>
                        </Popconfirm>
                      </div>
                    );
                  })}
                  {summaries.length === 0 ? <p className="lfaa-canvas-projects__empty">还没有画布项目。</p> : null}
                </div>
              </aside>
              <div className="lfaa-canvas-stage-area">
                {project ? (
                  <div className="lfaa-canvas-stage" ref={canvasRef} aria-label={`画布编辑区：${project.title}`}>
                    <ReactFlow
                      key={`${project.id}:${flowRevision}`}
                      nodes={nodes}
                      edges={edges}
                      nodeTypes={CANVAS_NODE_TYPES}
                      onNodesChange={onFlowNodesChange}
                      onEdgesChange={onFlowEdgesChange}
                      onConnect={onConnect}
                      onMoveEnd={(_event, nextViewport) => { viewportRef.current = nextViewport; }}
                      defaultViewport={project.viewport ?? DEFAULT_VIEWPORT}
                      defaultEdgeOptions={{ type: "smoothstep" }}
                      deleteKeyCode={interactionLocked ? null : "Delete"}
                      nodesDraggable={!interactionLocked}
                      nodesConnectable={!interactionLocked}
                      elementsSelectable={!interactionLocked}
                      minZoom={CANVAS_LIMITS.minZoom}
                      maxZoom={CANVAS_LIMITS.maxZoom}
                      onlyRenderVisibleElements
                      proOptions={{ hideAttribution: true }}
                    >
                      <Background gap={20} size={1} />
                      <Controls showInteractive={false} />
                      <MiniMap pannable zoomable ariaLabel="画布缩略图" />
                    </ReactFlow>
                    {openingId ? <div className="lfaa-canvas-stage__busy" role="status"><Spin size="small" /><span>正在打开项目…</span></div> : null}
                  </div>
                ) : (
                  <div className="lfaa-canvas-empty">
                    <Typography.Title level={3}>先新建一个画布</Typography.Title>
                    <Typography.Paragraph>{summaries.length ? "从项目列表打开已有画布，或新建一个画布开始编排。" : "画布项目与素材只属于当前账户，其他账户不可见。"}</Typography.Paragraph>
                    <Button type="primary" disabled={interactionLocked} onClick={() => void createProject()}>新建画布</Button>
                  </div>
                )}
              </div>
              {assetsOpen ? <button type="button" className="lfaa-canvas-scrim" aria-label="关闭素材面板" onClick={() => setAssetsOpen(false)} /> : null}
              <CanvasAssetPanel project={project} open={assetsOpen} disabled={!project || interactionLocked} uploading={operation === "upload"} deletingAssetId={deletingAssetId} onUpload={file => void uploadAsset(file)} onInsert={insertAsset} onDelete={asset => void removeAsset(asset)} onClose={() => setAssetsOpen(false)} />
            </div>
            <footer className="lfaa-canvas-footnote">
              <Typography.Text type="secondary">Shift+拖拽框选、Ctrl/⌘+点击多选、Delete 删除节点或连线；拖拽与缩放只在保存后写入本机项目。当前账户：{user.username}。下一阶段才接入 AI 生成、语音、全景与画质增强节点，本轮没有这些入口。</Typography.Text>
            </footer>
          </>
        )}
      </div>
      </section>
    </div>
  );
}
