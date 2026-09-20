/**
 * 文件：RightSidebarRegion.tsx
 * 作用：工作台右侧“工具与资源”完整模块。
 * 负责：右侧 Header、工具入口、资源分组与只读说明；样式全部归 RightSidebar.module.css。
 * 不负责：终端 PTY、Resize 算法、Center/Left 私有状态。
 * 状态归属：无跨区域状态；资源与开合状态由父级显式传入。
 * 对外接口：RightSidebarRegion。
 */
import { WorkbenchIcon } from "#workbench/shared";
import type { AgentWorkbenchProps, DevResourceItem, LayoutMode, ResourceKind } from "#workbench/contracts";
import { RightShellActions } from "#workbench/shell";
import styles from "../styles/RightSidebar.module.css";

const resourceLabels: Record<ResourceKind,string> = { skills:"Skills", experts:"Experts", plugins:"Plugins", extensions:"Extensions", mcp:"MCP" };
function groupResources(resources:readonly DevResourceItem[]) { return (Object.keys(resourceLabels) as ResourceKind[]).map((kind)=>({kind,items:resources.filter((resource)=>resource.kind===kind)})); }

export interface RightSidebarRegionProps extends Pick<AgentWorkbenchProps,"resources"|"resourceBridgeStatus"> {
  layoutMode: LayoutMode;
  terminalOpen: boolean;
  rightCollapsed: boolean;
  onToggleTerminal: () => void;
  onToggleRight: () => void;
}

export function RightSidebarRegion({ resources=[], resourceBridgeStatus="offline", layoutMode, terminalOpen, rightCollapsed, onToggleTerminal, onToggleRight }:RightSidebarRegionProps) {
  const groups=groupResources(resources);
  const statusText=resourceBridgeStatus==="connected"?"已连接":resourceBridgeStatus==="refreshing"?"刷新中":"未连接";
  return <aside className={styles.root} data-layout-mode={layoutMode} data-ui="right-sidebar">
    {layoutMode==="desktop"?<header className={styles.shellHeader}><RightShellActions terminalOpen={terminalOpen} rightCollapsed={rightCollapsed} onToggleTerminal={onToggleTerminal} onToggleRight={onToggleRight}/></header>:null}
    <div className={styles.body}>
      <header className={styles.header}><div className={styles.headerPrimary}><strong>工具与资源</strong><span>Runtime Registry</span></div><div className={styles.headerActions}><span className={styles.bridge} data-status={resourceBridgeStatus}><i/>{statusText}</span></div></header>
      <div className={styles.toolList}>
        <button type="button"><WorkbenchIcon name="review"/><span>审查</span><kbd>Ctrl+Shift+G</kbd></button>
        <button type="button" data-active={terminalOpen} onClick={onToggleTerminal}><WorkbenchIcon name="terminal"/><span>终端</span><kbd>Ctrl+J</kbd></button>
        <button type="button"><WorkbenchIcon name="browser"/><span>浏览器</span><kbd>Ctrl+T</kbd></button>
        <button type="button"><WorkbenchIcon name="file"/><span>文件</span><kbd>Ctrl+P</kbd></button>
      </div>
      <div className={styles.resourceHead}><span>能力资源</span><b className={styles.count}>{resources.length}</b></div>
      <div className={styles.resourceGroups}>{groups.map(({kind,items})=><section key={kind}><header className={styles.groupHeader}><span>{resourceLabels[kind]}</span><b className={styles.count}>{items.length}</b></header>{items.length===0?<p className={styles.empty}>暂无注册资源</p>:items.map((item)=><div className={styles.resource} key={`${kind}:${item.relativePath}`}><WorkbenchIcon name={item.entryType==="directory"?"folder":"file"} size={15}/><div className={styles.resourceBody}><strong>{item.name}</strong><small>{item.relativePath}</small></div></div>)}</section>)}</div>
      <div className={styles.devNote}><strong>Runtime Registry</strong><p>资源区后续接入统一能力注册表；终端仍是独立本地 PTY，只执行你亲自输入的命令。</p></div>
    </div>
  </aside>;
}
