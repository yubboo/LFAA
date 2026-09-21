/**
 * 文件：RightSidebarRegion.tsx
 * 作用：工作台右侧“工具与资源”完整模块。
 * 负责：右侧 Header、真实工具入口、资源分组与当前模式说明。
 * 不负责：终端 PTY、未注册工具的假执行、Resize 算法、Center/Left 私有状态。
 * 状态归属：无跨区域状态；资源、Workspace Mode 与开合状态由父级显式传入。
 * 对外接口：RightSidebarRegion。
 * 修改注意事项：只有真实已接入的 Tool 才允许可点击；Manual 必须能在没有模型时继续使用这些工具。
 */
import type { WorkspaceMode } from "@lfaa/workspace";
import { WorkbenchIcon } from "#workbench/shared";
import type { AgentWorkbenchProps, DevResourceItem, LayoutMode, ResourceKind } from "#workbench/contracts";
import { RightShellActions } from "#workbench/shell";
import styles from "../styles/RightSidebar.module.css";

const resourceLabels: Record<ResourceKind,string> = { skills:"Skills", experts:"Experts", plugins:"Plugins", extensions:"Extensions", mcp:"MCP" };
function groupResources(resources:readonly DevResourceItem[]) { return (Object.keys(resourceLabels) as ResourceKind[]).map((kind)=>({kind,items:resources.filter((resource)=>resource.kind===kind)})); }

export interface RightSidebarRegionProps extends Pick<AgentWorkbenchProps,"resources"|"resourceBridgeStatus"> {
  layoutMode: LayoutMode;
  workspaceMode: WorkspaceMode;
  terminalOpen: boolean;
  rightCollapsed: boolean;
  onToggleTerminal: () => void;
  onToggleRight: () => void;
}

export function RightSidebarRegion({ resources=[], resourceBridgeStatus="offline", layoutMode, workspaceMode, terminalOpen, rightCollapsed, onToggleTerminal, onToggleRight }:RightSidebarRegionProps) {
  const groups=groupResources(resources);
  const statusText=resourceBridgeStatus==="connected"?"已连接":resourceBridgeStatus==="refreshing"?"刷新中":"未连接";
  const manual = workspaceMode === "manual";
  return <aside className={styles.root} data-layout-mode={layoutMode} data-ui="right-sidebar">
    {layoutMode==="desktop"?<header className={styles.shellHeader}><RightShellActions terminalOpen={terminalOpen} rightCollapsed={rightCollapsed} onToggleTerminal={onToggleTerminal} onToggleRight={onToggleRight}/></header>:null}
    <div className={styles.body}>
      <header className={styles.header}><div className={styles.headerPrimary}><strong>工具与资源</strong><span>Runtime Registry</span></div><div className={styles.headerActions}><span className={styles.bridge} data-status={resourceBridgeStatus}><i/>{statusText}</span></div></header>
      <div className={styles.toolList}>
        <button type="button" disabled title="审查 Tool 尚未注册到当前 Web Host"><WorkbenchIcon name="review"/><span>审查</span><kbd>待接入</kbd></button>
        <button type="button" data-active={terminalOpen} onClick={onToggleTerminal}><WorkbenchIcon name="terminal"/><span>终端</span><kbd>Ctrl+J</kbd></button>
        <button type="button" disabled title="浏览器 Tool 尚未注册到当前 Web Host"><WorkbenchIcon name="browser"/><span>浏览器</span><kbd>待接入</kbd></button>
        <button type="button" disabled title="文件 Tool 尚未注册到当前 Web Host"><WorkbenchIcon name="file"/><span>文件</span><kbd>待接入</kbd></button>
      </div>
      <div className={styles.resourceHead}><span>能力资源</span><b className={styles.count}>{resources.length}</b></div>
      <div className={styles.resourceGroups}>{groups.map(({kind,items})=><section key={kind}><header className={styles.groupHeader}><span>{resourceLabels[kind]}</span><b className={styles.count}>{items.length}</b></header>{items.length===0?<p className={styles.empty}>暂无注册资源</p>:items.map((item)=><div className={styles.resource} key={`${kind}:${item.relativePath}`}><WorkbenchIcon name={item.entryType==="directory"?"folder":"file"} size={15}/><div className={styles.resourceBody}><strong>{item.name}</strong><small>{item.relativePath}</small></div></div>)}</section>)}</div>
      <div className={styles.devNote}><strong>{manual?"Manual Tool Runtime":"Unified Tool Runtime"}</strong><p>{manual?"手动模式不使用模型；已注册工具仍可由用户直接触发。当前 Web Host 已真实接通终端，其余入口只在 Registry 真正提供实现后开放。":"Chat / Work 共用同一套 Tool / Skill / MCP 能力；右侧只展示真实注册状态，不因表现层切换能力。"}</p></div>
    </div>
  </aside>;
}
