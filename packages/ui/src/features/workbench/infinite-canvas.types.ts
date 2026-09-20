/**
 * 文件：infinite-canvas.types.ts
 * 作用：定义 Infinite Canvas 通用 Renderer / Interaction 类型。
 * 负责：节点、连线、视口与组件 Props。
 * 不负责：Run/Session/Artifact 业务真值，也不决定持久化介质或 workspace key。
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

export interface InfiniteCanvasViewport {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

export interface InfiniteCanvasProps {
  nodes: readonly InfiniteCanvasNode[];
  edges?: readonly InfiniteCanvasEdge[];
  /** 高频节点拖动视觉更新。持久化方不得在这里每像素同步写磁盘/localStorage。 */
  onNodesChange?: (nodes: readonly InfiniteCanvasNode[]) => void;
  /** 节点拖动完成后的低频提交 seam，用于上层持久化最终排版。 */
  onNodesCommit?: (nodes: readonly InfiniteCanvasNode[]) => void;
  onNodeActivate?: (nodeId: string) => void;
  /** 只作为本次 Canvas mount 的起始视口；后续 pan/zoom 由 Canvas 内部持有，避免上层高频重渲染。 */
  initialViewport?: InfiniteCanvasViewport;
  /** pan/zoom/reset 稳定后的低频提交 seam；UI 本身不访问 localStorage。 */
  onViewportCommit?: (viewport: InfiniteCanvasViewport) => void;
  emptyHint?: string;
}
