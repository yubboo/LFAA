/**
 * 文件：work-canvas.types.ts
 * 作用：定义 Work / Manual 共用无限画布控制器的产品状态契约。
 * 负责：画布布局、节点人工编辑、上下文投影与编辑器控制类型。
 * 不负责：Agent Run、模型调用、Tool 执行、Provider 状态或 Runtime 生命周期。
 * 状态归属：布局/节点内容属于 Workspace Canvas；Agent Run 仍由 shared Session 唯一拥有。
 * 对外接口：WorkCanvasLayoutSnapshot / WorkCanvasController。
 * 关联文件：useWorkCanvasController.ts、work-canvas-content.ts、WorkWorkspace.tsx、ManualWorkspace.tsx。
 * 修改注意事项：Chat/Work/Manual 只能共享 Canvas/Tool 基础能力，禁止把画布状态升级成第二套 Agent Runtime。
 */
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
  readonly activeNode: InfiniteCanvasNode | null;
  readonly contextText: string;
  onNodesChange(nodes: readonly InfiniteCanvasNode[]): void;
  onNodesCommit(nodes: readonly InfiniteCanvasNode[]): void;
  onViewportCommit(viewport: InfiniteCanvasViewport): void;
  activateNode(nodeId: string): void;
  closeNodeEditor(): void;
  updateActiveNodeContent(title: string, description: string): void;
}
