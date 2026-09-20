/**
 * 文件：WorkCanvasRegion.tsx
 * 作用：Conversation/Work Surface 的无限画布产品视图。
 * 负责：装配 Work Canvas Controller 与 @lfaa/ui InfiniteCanvas。
 * 不负责：Chat Timeline、Composer、Agent Run、Canvas Pointer 算法。
 */
import { InfiniteCanvas } from "@lfaa/ui";
import { INITIAL_WORK_EDGES } from "../contracts/work-canvas.model";
import { useWorkCanvasController } from "../logic/useWorkCanvasController";
import styles from "../styles/WorkCanvas.module.css";

export function WorkCanvasRegion({ workspaceId, lastRunInput }: {
  workspaceId?: string;
  lastRunInput: string | null;
}) {
  const controller = useWorkCanvasController({ workspaceId, lastRunInput });
  return (
    <div className={styles.root} data-ui="work-canvas">
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
