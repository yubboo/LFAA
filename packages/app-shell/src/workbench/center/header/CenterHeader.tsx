/** 中央区顶部 Header。只消费 Shell 状态，不拥有 Conversation/Composer 状态。 */
import type { AgentSurfaceMode } from "@lfaa/agent-runtime";
import { IconButton, RightShellActions, ShellHeaderButton, WorkbenchIcon } from "../center-dependencies";
import type { LayoutMode } from "../center-dependencies";
import styles from "./CenterHeader.module.css";

export function CenterHeader({ layoutMode,leftCollapsed,rightCollapsed,terminalOpen,agentSurface,runtimeConnected,onToggleLeft,onToggleRight,onToggleTerminal,onLeftHoverEnter,onLeftHoverLeave }: {
  layoutMode: LayoutMode; leftCollapsed:boolean; rightCollapsed:boolean; terminalOpen:boolean; agentSurface:AgentSurfaceMode; runtimeConnected:boolean;
  onToggleLeft:()=>void; onToggleRight:()=>void; onToggleTerminal:()=>void; onLeftHoverEnter:()=>void; onLeftHoverLeave:()=>void;
}) {
  return <header className={styles.root} data-layout-mode={layoutMode} data-ui="center-header">
    <div className={styles.left}>
      <ShellHeaderButton label="切换侧边栏" shortcut="Ctrl+B" expanded={!leftCollapsed} onClick={onToggleLeft} onMouseEnter={onLeftHoverEnter} onMouseLeave={onLeftHoverLeave} onFocus={onLeftHoverEnter} onBlur={onLeftHoverLeave} tooltipAlign="start"><WorkbenchIcon name="panelLeft" size={16}/></ShellHeaderButton>
      <div className={styles.title}><WorkbenchIcon name="folder" size={16}/><strong>{agentSurface==="chat"?"聊天":"工作"}</strong></div>
    </div>
    <div className={styles.right}>
      <span className={`${styles.runtimeState}${runtimeConnected?` ${styles.connected}`:""}`}>{runtimeConnected?"Runtime 已连接":"Runtime 未连接"}</span>
      <IconButton className={styles.moreButton} type="button" aria-label="更多" title="更多"><WorkbenchIcon name="dots" size={16}/></IconButton>
      <button className={styles.ghostButton} type="button">分享</button>
      {rightCollapsed||layoutMode!=="desktop"?<><span className={styles.divider} aria-hidden="true"/><RightShellActions terminalOpen={terminalOpen} rightCollapsed={rightCollapsed} onToggleTerminal={onToggleTerminal} onToggleRight={onToggleRight}/></>:null}
    </div>
  </header>;
}
