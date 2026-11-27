// 画布连线合法性校验与节点端口辅助函数：供 Canvas-Editor 消费，避免编辑器组件过长。
import type { Connection, Edge, EdgeChange, NodeChange } from "@xyflow/react";
import { inputPorts, outputPorts, type CanvasAsset, type CanvasGraph, type CanvasNode, type CanvasNodeKind, type CanvasRun } from "@lfaa/canvas/contract";
import type { CanvasLabels } from "../locales";
import type { FlowNode } from "./Graph-Node";

/** 构造新建节点默认参数。 */
export function createCanvasNode(kind: CanvasNodeKind, position: { x: number; y: number }): CanvasNode {
  const settings = kind === "image"
    ? { ratio: "16:9" }
    : kind === "video"
      ? { ratio: "16:9", resolution: "720p", duration: 5, mode: "reference" as const }
      : {};
  return { id: crypto.randomUUID(), kind, position, settings };
}

/** 拆解 ReactFlow 节点变更事件中的选中、删除与位置补丁。 */
export function parseNodeChanges(changes: NodeChange<FlowNode>[]) {
  const selectChanges: Array<{ id: string; selected: boolean }> = [];
  const removals: string[] = [];
  const positions = new Map<string, { x: number; y: number }>();
  for (const event of changes) {
    if (event.type === "select") selectChanges.push({ id: event.id, selected: event.selected });
    else if (event.type === "remove") removals.push(event.id);
    else if (event.type === "position" && event.position) positions.set(event.id, event.position);
  }
  return { selectChanges, removals, positions };
}

/** 合并一次拖动的最终位置，没有坐标变化时保持原快照以跳过保存与历史。 */
export function moveCanvasNodes(graph: CanvasGraph, positions: ReadonlyMap<string, CanvasNode["position"]>): CanvasGraph {
  let changed = false;
  const nodes = graph.nodes.map((node) => {
    const position = positions.get(node.id);
    if (!position || (position.x === node.position.x && position.y === node.position.y)) return node;
    changed = true;
    return { ...node, position };
  });
  return changed ? { ...graph, nodes } : graph;
}

/** 拆解 ReactFlow 连线变更事件中的选中与删除。 */
export function parseEdgeChanges(changes: EdgeChange[]) {
  const selectChanges: Array<{ id: string; selected: boolean }> = [];
  const removals: string[] = [];
  for (const event of changes) {
    if (event.type === "select") selectChanges.push({ id: event.id, selected: event.selected });
    else if (event.type === "remove") removals.push(event.id);
  }
  return { selectChanges, removals };
}

/** 将文档节点映射为 ReactFlow 渲染节点并绑定运行状态与交互回调。 */
export function buildFlowNodes(params: {
  nodes: CanvasNode[];
  selected: string[];
  assets: CanvasAsset[];
  runs: CanvasRun[];
  path: string;
  t: CanvasLabels;
  onPatchPrompt: (id: string, prompt: string) => void;
  onUploadFile: (id: string, file: File) => void;
  onOpenPrevis: (id: string) => void;
  onRemoveNode: (id: string) => void;
}): FlowNode[] {
  const { nodes, selected, assets, runs, path, t, onPatchPrompt, onUploadFile, onOpenPrevis, onRemoveNode } = params;
  return nodes.map((node, index) => {
    const latest = runs.find((run) => run.nodeId === node.id);
    return {
      id: node.id,
      type: "canvas",
      position: node.position,
      selected: selected.includes(node.id),
      data: {
        node,
        index,
        assets,
        path,
        t,
        ...(latest ? { runStatus: t[latest.status] } : {}),
        onPatchPrompt,
        onUploadFile,
        onOpenPrevis,
        onRemoveNode,
      },
    };
  });
}

/** 将文档连线映射为带流光/待运行态的 ReactFlow 自定义边。 */
export function buildFlowEdges(graph: CanvasGraph, runs: CanvasRun[], selectedEdges: string[]): Edge[] {
  return graph.edges.map((edge) => {
    const targetRun = runs.find((run) => run.nodeId === edge.target);
    return {
      id: edge.id,
      type: "canvasEdge",
      source: edge.source,
      sourceHandle: edge.sourcePort,
      target: edge.target,
      targetHandle: edge.targetPort,
      selected: selectedEdges.includes(edge.id),
      data: {
        pending: !edge.assetId && edge.targetPort !== "prompt",
        running: targetRun?.status === "starting" || targetRun?.status === "running",
      },
    };
  });
}

/** 校验拖线两端端口类型、空闲状态与无环约束；通过返回来源资产 id（文本端口返回 undefined），失败返回 null。 */
export function resolveConnectionAsset(
  connection: Connection | Edge,
  graph: CanvasGraph,
  assets: CanvasAsset[],
): string | null | undefined {
  const source = graph.nodes.find((node) => node.id === connection.source);
  const target = graph.nodes.find((node) => node.id === connection.target);
  if (!source || !target || source.id === target.id) return null;
  if (graph.edges.some((edge) => edge.target === target.id && edge.targetPort === connection.targetHandle)) return null;

  const out = outputPorts(source, assets).find((port) => port.id === connection.sourceHandle);
  const into = inputPorts(target).find((port) => port.id === connection.targetHandle);
  if (!out || out.kind !== into?.kind || (out.kind !== "text" && !out.assetId)) return null;

  const seen = new Set<string>();
  const pending = [target.id];
  while (pending.length) {
    const current = pending.pop()!;
    if (current === source.id) return null;
    if (seen.has(current)) continue;
    seen.add(current);
    pending.push(...graph.edges.filter((edge) => edge.source === current).map((edge) => edge.target));
  }
  return out.assetId;
}
