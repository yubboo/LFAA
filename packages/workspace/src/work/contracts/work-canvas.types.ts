/** Work Canvas 只持久化视觉布局；业务字段永远不进入该 Snapshot。 */
import type { InfiniteCanvasNode, InfiniteCanvasViewport } from "@lfaa/ui";

export interface WorkCanvasNodePosition {
  readonly x: number;
  readonly y: number;
}

export interface WorkCanvasLayoutSnapshot {
  readonly version: 1;
  readonly viewport: InfiniteCanvasViewport;
  readonly nodePositions: Readonly<Record<string, WorkCanvasNodePosition>>;
}

export interface WorkCanvasController {
  readonly canvasKey: string;
  readonly nodes: readonly InfiniteCanvasNode[];
  readonly initialViewport: InfiniteCanvasViewport;
  onNodesChange(nodes: readonly InfiniteCanvasNode[]): void;
  onNodesCommit(nodes: readonly InfiniteCanvasNode[]): void;
  onViewportCommit(viewport: InfiniteCanvasViewport): void;
}
