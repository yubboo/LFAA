/**
 * 功能：在 Canvas Owner 项目格式与 React Flow 展示模型之间做纯转换。
 * 作用：保留未知节点/连线，清洗可见节点数据，并维护 UI 默认尺寸与引用关系。
 * 不负责：项目 API、版本冲突、持久化、生成任务或 Canvas 页面状态。
 * 关联文件：../CanvasWorkspace.tsx、../CanvasNodeCards.tsx、../CanvasProjectTransfer.ts。
 */
import type { Edge } from "@xyflow/react";
import type { CanvasAsset, CanvasEdge, CanvasNode, CanvasProject, CanvasProjectSummary } from "lfaa-client-connection/src/api.js";
import { CANVAS_LIMITS, normalizeCanvasNodeData, type CanvasGenerationData, type CanvasNodeKind } from "../CanvasProjectTransfer.js";
import { CANVAS_NODE_LABELS, type CanvasFlowNode, type CanvasNodeCallbacks, type CanvasNodeData } from "../CanvasNodeCards.js";

/** 新建节点的默认尺寸；仍受画布服务端权威范围校验。 */
export const NODE_DEFAULT_SIZE: Record<CanvasNodeKind, { width: number; height: number }> = {
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
  asset: { width: 300, height: 220 },
  shot: { width: 360, height: 560 },
  "aivideo-reference": { width: 340, height: 430 },
  "aivideo-timeline": { width: 440, height: 520 },
  "aivideo-director": { width: 420, height: 480 }
};

export function clampCoordinate(value: number): number {
  return Math.min(CANVAS_LIMITS.coordinate, Math.max(-CANVAS_LIMITS.coordinate, value));
}

export function clampNodeSize(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(CANVAS_LIMITS.maxNodeSize, Math.max(CANVAS_LIMITS.minNodeSize, Math.round(value)));
}

export function styleSize(value: unknown, fallback: number): number {
  if (typeof value === "number") return clampNodeSize(value, fallback);
  if (typeof value === "string") return clampNodeSize(Number.parseFloat(value), fallback);
  return fallback;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function summaryFor(project: CanvasProject, nodeCount = project.nodes.length): CanvasProjectSummary {
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

export function upsertSummary(list: CanvasProjectSummary[], summary: CanvasProjectSummary): CanvasProjectSummary[] {
  const index = list.findIndex(item => item.id === summary.id);
  if (index === -1) return [summary, ...list];
  const next = list.slice();
  next[index] = summary;
  return next;
}

export function knownKind(value: string): CanvasNodeKind | null {
  return (Object.keys(NODE_DEFAULT_SIZE) as CanvasNodeKind[]).includes(value as CanvasNodeKind) ? value as CanvasNodeKind : null;
}

/** 服务端保存的 data 形状 → 节点卡片使用的界面字段；只映射现有合同字段。 */
export function uiPatchFromPersisted(kind: CanvasNodeKind, data: Record<string, unknown>): Partial<CanvasNodeData> {
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
    case "shot":
      return isRecord(data.shot) ? { shot: data.shot as unknown as CanvasNodeData["shot"] } : {};
    case "aivideo-reference":
      return isRecord(data.reference) ? { reference: data.reference as unknown as CanvasNodeData["reference"] } : {};
    case "aivideo-timeline":
      return Array.isArray(data.clips) ? { clips: data.clips as unknown as CanvasNodeData["clips"] } : {};
    case "aivideo-director":
      return isRecord(data.whiteModel) ? { whiteModel: data.whiteModel as unknown as CanvasNodeData["whiteModel"] } : {};
    default:
      return {};
  }
}

/** 新建节点时写入的空数据；随后由用户在卡片里真实编辑。 */
export function defaultUiData(kind: CanvasNodeKind): Partial<CanvasNodeData> {
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
    case "shot":
      return { shot: { id: "", title: "新镜头", description: "", dialogue: "", durationSeconds: 5, x: 0, y: 0, characterIds: [] } };
    case "aivideo-reference":
      return { reference: { id: "", name: "新角色", description: "", kind: "characters" } };
    case "aivideo-timeline":
      return { clips: [] };
    case "aivideo-director":
      return { whiteModel: { items: [], camera: { x: 0, y: 1.6, z: -8, yaw: 0, pitch: -4, focalLength: 50 }, ratio: "16:9" } };
    default:
      return {};
  }
}

export function flowNodesFrom(project: CanvasProject, callbacks: CanvasNodeCallbacks): { nodes: CanvasFlowNode[]; unsupported: CanvasNode[] } {
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

export function flowEdgesFrom(project: CanvasProject, knownNodeIds: Set<string>): { edges: Edge[]; unsupported: CanvasEdge[] } {
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

export function persistedNodesFrom(flowNodes: CanvasFlowNode[], project: CanvasProject, unsupported: CanvasNode[]): CanvasNode[] {
  const assetIds = new Set(project.assets.map((asset: CanvasAsset) => asset.assetId));
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

export function persistedEdgesFrom(flowEdges: Edge[], unsupported: CanvasEdge[]): CanvasEdge[] {
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
export function assetReferenceCount(flowNodes: CanvasFlowNode[], assetId: string): number {
  let count = 0;
  for (const node of flowNodes) {
    const data = node.data;
    if (data.assetId === assetId) count += 1;
    if (data.generation?.assetId === assetId) count += 1;
    if (data.subject?.assetIds.includes(assetId)) count += 1;
    if (data.timeline?.clips.some(clip => clip.assetId === assetId)) count += 1;
    if (data.shot?.imageAssetId === assetId || data.shot?.videoAssetId === assetId) count += 1;
    if (data.reference?.imageAssetId === assetId) count += 1;
    if (data.clips?.some(clip => clip.assetId === assetId)) count += 1;
  }
  return count;
}

/** 删除节点时清理其它节点对它的引用（时间线片段、导演台镜头）。 */
export function withoutNodeReference(node: CanvasFlowNode, removedId: string): CanvasFlowNode {
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
  if (data.kind === "shot" && data.shot?.characterIds.includes(removedId)) {
    data = { ...data, shot: { ...data.shot, characterIds: data.shot.characterIds.filter(id => id !== removedId) } };
    changed = true;
  }
  if (data.kind === "shot" && data.shot?.locationId === removedId) {
    const shot = { ...data.shot };
    delete shot.locationId;
    data = { ...data, shot };
    changed = true;
  }
  return changed ? { ...node, data } : node;
}
