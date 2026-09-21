/**
 * 文件：WorkWorkspace.tsx
 * 作用：Workspace / Work Agent 的无限画布表现层。
 * 负责：装配 Work Canvas Controller、InfiniteCanvas、节点人工编辑，并向同一个 Agent Core 提供画布上下文。
 * 不负责：创建独立 Work Runtime、模型选择、工具执行、Canvas Pointer 算法。
 * 状态归属：画布产品状态由 work/logic 拥有；Run 真值由 shared Session 提供。
 * 对外接口：WorkWorkspace({ workspaceId, lastRunInput, lastRunOutput, onContextChange })。
 * 关联文件：useWorkCanvasController.ts、WorkCanvasNodeEditor.tsx、@lfaa/ui InfiniteCanvas。
 * 修改注意事项：Work 与 Chat 必须共享 Agent Runtime；Canvas 是人工干预表现层，不得成为第二套 Agent Core。
 */
import { useEffect } from "react";
import { InfiniteCanvas } from "@lfaa/ui";
import { INITIAL_WORK_EDGES } from "../contracts/work-canvas.model";
import { useWorkCanvasController } from "../logic/useWorkCanvasController";
import { WorkCanvasNodeEditor } from "./WorkCanvasNodeEditor";
import styles from "../styles/WorkWorkspace.module.css";

export function WorkWorkspace({ workspaceId, lastRunInput, lastRunOutput, onContextChange }: {
  workspaceId: string | undefined;
  lastRunInput: string | null;
  lastRunOutput: string | null;
  onContextChange?: (context: string) => void;
}) {
  const controller = useWorkCanvasController({ workspaceId, lastRunInput, lastRunOutput });
  useEffect(() => { onContextChange?.(controller.contextText); }, [controller.contextText, onContextChange]);
  return (
    <div className={styles.root} data-ui="work-workspace">
      <div className={styles.title}><strong>画布 Agent</strong><span>与 Chat 共用同一 Agent Core · 双击节点可人工干预</span></div>
      <InfiniteCanvas
        key={controller.canvasKey}
        nodes={controller.nodes}
        edges={INITIAL_WORK_EDGES}
        initialViewport={controller.initialViewport}
        onNodesChange={controller.onNodesChange}
        onNodesCommit={controller.onNodesCommit}
        onViewportCommit={controller.onViewportCommit}
        onNodeActivate={controller.activateNode}
      />
      {controller.activeNode ? <WorkCanvasNodeEditor node={controller.activeNode} onSave={controller.updateActiveNodeContent} onClose={controller.closeNodeEditor} /> : null}
    </div>
  );
}
