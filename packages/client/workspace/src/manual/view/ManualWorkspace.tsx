/**
 * 文件：ManualWorkspace.tsx
 * 作用：完全手动模式的中心工作区。
 * 负责：复用 Work 无限画布、节点人工编辑和无需模型即可使用的真实本地工具入口。
 * 不负责：Agent Run、模型选择、自动规划、Provider 调用、PTY 生命周期。
 * 状态归属：画布状态继续由 Work Canvas Controller 持有；工具执行状态归各 Tool Host。
 * 对外接口：ManualWorkspace({ workspaceId, terminalOpen, onToggleTerminal })。
 * 关联文件：#workspace/work、../styles/ManualWorkspace.module.css、@lfaa/ui。
 * 修改注意事项：Manual 只能复用现有工具与画布，禁止复制第二套 Runtime/Canvas Core。
 */
import { InfiniteCanvas } from "@lfaa/ui";
import { INITIAL_WORK_EDGES, useWorkCanvasController, WorkCanvasNodeEditor } from "#workspace/work";
import styles from "../styles/ManualWorkspace.module.css";

export function ManualWorkspace({ workspaceId, terminalOpen, onToggleTerminal }: {
  workspaceId: string | undefined;
  terminalOpen: boolean;
  onToggleTerminal: () => void;
}) {
  const controller = useWorkCanvasController({ workspaceId: `${workspaceId ?? "lfaa"}:manual`, lastRunInput: null });
  return (
    <div className={styles.root} data-ui="manual-workspace">
      <div className={styles.banner}>
        <div><strong>手动模式</strong><span>不使用大模型 · 无限画布与真实本地工具仍可直接操作</span></div>
        <button type="button" data-active={terminalOpen} onClick={onToggleTerminal}>{terminalOpen ? "关闭终端" : "打开终端"}</button>
      </div>
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
