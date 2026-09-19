/**
 * 文件：infinite-canvas.types.ts
 * 作用：定义 Infinite Canvas 纯 UI Projection 类型。
 * 负责：节点、连线、视口与组件 Props。
 * 不负责：Run/Session/Artifact 业务真值。
 */
export type InfiniteCanvasNodeKind = "goal" | "agent" | "tool" | "app" | "artifact";

export interface InfiniteCanvasNode {
  readonly id: string;
  readonly kind: InfiniteCanvasNodeKind;
  readonly title: string;
  readonly description?: string;
  readonly status?: "idle" | "running" | "done" | "blocked";
  readonly x: number;
  readonly y: number;
}

export interface InfiniteCanvasEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly label?: string;
}

export interface InfiniteCanvasProps {
  nodes: readonly InfiniteCanvasNode[];
  edges?: readonly InfiniteCanvasEdge[];
  onNodesChange?: (nodes: readonly InfiniteCanvasNode[]) => void;
  onNodeActivate?: (nodeId: string) => void;
  emptyHint?: string;
}
