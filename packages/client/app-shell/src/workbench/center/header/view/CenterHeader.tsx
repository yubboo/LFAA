/**
 * 文件：CenterHeader.tsx
 * 作用：中央区顶部 Header 与第二个工作方式切换入口。
 * 负责：Shell 快捷操作、当前 Runtime 状态、Chat/Work/Manual segmented switch。
 * 不负责：改变左侧导航结构、Agent 能力选择、Conversation/Canvas 状态。
 * 状态归属：workspaceMode 由统一 Session Controller 持有，本组件只派发切换意图。
 * 对外接口：CenterHeader。
 * 关联文件：CenterWorkspaceRegion.tsx、LeftSidebarRegion.tsx、@lfaa/workspace。
 * 修改注意事项：左上角与中央 switch 必须控制同一个 mode；切换只能改变中央表现层，不能创建第二套 Runtime。
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

export function CenterHeader({ layoutMode,leftCollapsed,rightCollapsed,terminalOpen,workspaceMode,runtimeConnected,onWorkspaceModeChange,onToggleLeft,onToggleRight,onToggleTerminal,onLeftHoverEnter,onLeftHoverLeave }: {
  layoutMode: LayoutMode; leftCollapsed:boolean; rightCollapsed:boolean; terminalOpen:boolean; workspaceMode:WorkspaceMode; runtimeConnected:boolean;
  onWorkspaceModeChange:(mode:WorkspaceMode)=>void; onToggleLeft:()=>void; onToggleRight:()=>void; onToggleTerminal:()=>void; onLeftHoverEnter:()=>void; onLeftHoverLeave:()=>void;
}) {
  const manual = workspaceMode === "manual";
  return <header className={styles.root} data-layout-mode={layoutMode} data-ui="center-header">
    <div className={styles.left}>
      <ShellHeaderButton label="切换侧边栏" shortcut="Ctrl+B" expanded={!leftCollapsed} onClick={onToggleLeft} onMouseEnter={onLeftHoverEnter} onMouseLeave={onLeftHoverLeave} onFocus={onLeftHoverEnter} onBlur={onLeftHoverLeave} tooltipAlign="start"><WorkbenchIcon name="panelLeft" size={16}/></ShellHeaderButton>
      <div className={styles.title}><WorkbenchIcon name={manual ? "tools" : workspaceMode === "work" ? "grid" : "folder"} size={16}/><strong>{titleForMode(workspaceMode)}</strong></div>
    </div>
    <div className={styles.modeSwitch} role="tablist" aria-label="工作方式">
      <button type="button" role="tab" aria-selected={workspaceMode==="chat"} data-active={workspaceMode==="chat"} onClick={()=>onWorkspaceModeChange("chat")}>聊天</button>
      <button type="button" role="tab" aria-selected={workspaceMode==="work"} data-active={workspaceMode==="work"} onClick={()=>onWorkspaceModeChange("work")}>工作</button>
      <button type="button" role="tab" aria-selected={workspaceMode==="manual"} data-active={workspaceMode==="manual"} onClick={()=>onWorkspaceModeChange("manual")}>手动</button>
    </div>
    <div className={styles.right}>
      <span className={`${styles.runtimeState}${manual||runtimeConnected?` ${styles.connected}`:""}`}>{manual?"手动工具可用":runtimeConnected?"Agent Runtime 已连接":"Agent Runtime 未连接"}</span>
      <IconButton className={styles.moreButton} type="button" aria-label="更多" title="更多"><WorkbenchIcon name="dots" size={16}/></IconButton>
      <button className={styles.ghostButton} type="button">分享</button>
      {rightCollapsed||layoutMode!=="desktop"?<><span className={styles.divider} aria-hidden="true"/><RightShellActions terminalOpen={terminalOpen} rightCollapsed={rightCollapsed} onToggleTerminal={onToggleTerminal} onToggleRight={onToggleRight}/></>:null}
    </div>
  </header>;
}
