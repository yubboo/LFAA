/**
 * 文件：WorkWorkspace.tsx
 * 作用：Workspace / Work 模式的无限画布产品投影。
 * 负责：装配 Work Canvas Controller 与 @lfaa/ui InfiniteCanvas。
 * 不负责：Chat Timeline、Composer、Agent Run、Canvas Pointer 算法。
 * 状态归属：节点/viewport 视觉布局由 work/logic 拥有；Run 真值由 shared Session 提供。
 * 对外接口：WorkWorkspace({ workspaceId, lastRunInput })。
 * 关联文件：../logic/useWorkCanvasController.ts、../styles/WorkWorkspace.module.css、@lfaa/ui InfiniteCanvas。
 * 修改注意事项：不得把高频 Pointer 算法或 Agent Runtime 真值复制进本 View。
 */
import { InfiniteCanvas } from "@lfaa/ui";
import { INITIAL_WORK_EDGES } from "../contracts/work-canvas.model";
import { useWorkCanvasController } from "../logic/useWorkCanvasController";
import styles from "../styles/WorkWorkspace.module.css";

export function WorkWorkspace({ workspaceId, lastRunInput }: {
  workspaceId?: string;
  lastRunInput: string | null;
}) {
  const controller = useWorkCanvasController({ workspaceId, lastRunInput });
  return (
    <div className={styles.root} data-ui="work-workspace">
      <div className={styles.title}><strong>工作</strong><span>无限画布</span></div>
      <InfiniteCanvas
        key={controller.canvasKey}
        nodes={controller.nodes}
        edges={INITIAL_WORK_EDGES}
        initialViewport={controller.initialViewport}
        onNodesChange={controller.onNodesChange}
        onNodesCommit={controller.onNodesCommit}
        onViewportCommit={controller.onViewportCommit}
      />
    </div>
  );
}
