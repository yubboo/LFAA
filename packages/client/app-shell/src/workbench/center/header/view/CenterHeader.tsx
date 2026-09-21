/**
 * 文件：CenterHeader.tsx
 * 作用：中央区顶部 Header。
 * 负责：展示当前 Workspace Mode 与真实 Runtime/Manual 状态，提供 Shell 快捷操作。
 * 不负责：Agent 能力选择、模型路由、Conversation/Canvas 状态。
 * 状态归属：无业务状态；全部由父级显式传入。
 * 对外接口：CenterHeader。
 * 关联文件：CenterWorkspaceRegion.tsx、@lfaa/workspace。
 * 修改注意事项：Chat/Work 都是同一 Agent Core；Manual 不能显示“Runtime 未连接”造成必须配置模型的误导。
 */
import type { WorkspaceMode } from "@lfaa/workspace";
import { IconButton, RightShellActions, ShellHeaderButton, WorkbenchIcon } from "#center/contracts";
import type { LayoutMode } from "#center/contracts";
import styles from "../styles/CenterHeader.module.css";

function titleForMode(mode: WorkspaceMode): string {
  if (mode === "chat") return "聊天 Agent";
  if (mode === "work") return "画布 Agent";
  return "手动模式";
}

export function CenterHeader({ layoutMode,leftCollapsed,rightCollapsed,terminalOpen,workspaceMode,runtimeConnected,onToggleLeft,onToggleRight,onToggleTerminal,onLeftHoverEnter,onLeftHoverLeave }: {
  layoutMode: LayoutMode; leftCollapsed:boolean; rightCollapsed:boolean; terminalOpen:boolean; workspaceMode:WorkspaceMode; runtimeConnected:boolean;
  onToggleLeft:()=>void; onToggleRight:()=>void; onToggleTerminal:()=>void; onLeftHoverEnter:()=>void; onLeftHoverLeave:()=>void;
}) {
  const manual = workspaceMode === "manual";
  return <header className={styles.root} data-layout-mode={layoutMode} data-ui="center-header">
    <div className={styles.left}>
      <ShellHeaderButton label="切换侧边栏" shortcut="Ctrl+B" expanded={!leftCollapsed} onClick={onToggleLeft} onMouseEnter={onLeftHoverEnter} onMouseLeave={onLeftHoverLeave} onFocus={onLeftHoverEnter} onBlur={onLeftHoverLeave} tooltipAlign="start"><WorkbenchIcon name="panelLeft" size={16}/></ShellHeaderButton>
      <div className={styles.title}><WorkbenchIcon name={manual ? "tools" : workspaceMode === "work" ? "grid" : "folder"} size={16}/><strong>{titleForMode(workspaceMode)}</strong></div>
    </div>
    <div className={styles.right}>
      <span className={`${styles.runtimeState}${manual||runtimeConnected?` ${styles.connected}`:""}`}>{manual?"手动工具可用":runtimeConnected?"Agent Runtime 已连接":"Agent Runtime 未连接"}</span>
      <IconButton className={styles.moreButton} type="button" aria-label="更多" title="更多"><WorkbenchIcon name="dots" size={16}/></IconButton>
      <button className={styles.ghostButton} type="button">分享</button>
      {rightCollapsed||layoutMode!=="desktop"?<><span className={styles.divider} aria-hidden="true"/><RightShellActions terminalOpen={terminalOpen} rightCollapsed={rightCollapsed} onToggleTerminal={onToggleTerminal} onToggleRight={onToggleRight}/></>:null}
    </div>
  </header>;
}
