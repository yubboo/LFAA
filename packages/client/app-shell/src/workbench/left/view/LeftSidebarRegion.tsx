/**
 * 左侧栏完整模块。局部 brand menu 状态只在本模块；宽度/收起/Preview 归 Shell。
 */
import { useState } from "react";
import type { AgentWorkspaceMode } from "@lfaa/agent-runtime";
import { useDismissibleLayer, type ThemePreference } from "@lfaa/ui";
import { WorkbenchIcon } from "#workbench/shared";
import type { ResolvedTheme } from "#workbench/contracts";
import { IconButton } from "#workbench/shared";
import { ProfileBar } from "./ProfileBar";
import styles from "../styles/LeftSidebar.module.css";

const recentRuns = ["配置系统", "Web 工作台", "热插拔测试", "模型接入规划"];

export function LeftSidebarRegion({ resolvedTheme, themePreference, workspaceMode, onWorkspaceModeChange, onOpenProfile, onOpenThemeMenu, onRequestUpdate }: {
  resolvedTheme: ResolvedTheme;
  themePreference: ThemePreference;
  workspaceMode: AgentWorkspaceMode;
  onWorkspaceModeChange: (mode: AgentWorkspaceMode) => void;
  onOpenProfile: () => void;
  onOpenThemeMenu: () => void;
  onRequestUpdate: () => void;
}) {
  const [brandMenuOpen, setBrandMenuOpen] = useState(false);
  const brandMenuRef = useDismissibleLayer<HTMLDivElement>({ open: brandMenuOpen, onDismiss: () => setBrandMenuOpen(false) });
  return (
    <aside className={styles.root} data-ui="left-sidebar">
      <div className={styles.brandRow}>
        <div className={styles.brandSwitcher} ref={brandMenuRef}>
          <button className={styles.brand} type="button" aria-label="切换聊天或工作" aria-expanded={brandMenuOpen} onClick={() => setBrandMenuOpen((value) => !value)}>
            <span className={styles.brandMark}>L</span><strong>LFAA</strong><WorkbenchIcon name="chevron" size={15} />
          </button>
          {brandMenuOpen ? <div className={styles.brandMenu} role="menu" aria-label="LFAA 模式">
            <button className={workspaceMode === "chat" ? styles.active : ""} type="button" role="menuitem" onClick={() => { onWorkspaceModeChange("chat"); setBrandMenuOpen(false); }}><span><WorkbenchIcon name="spark" size={17} /><strong>聊天</strong></span><small>一句话直接完成任务</small></button>
            <button className={workspaceMode === "work" ? styles.active : ""} type="button" role="menuitem" onClick={() => { onWorkspaceModeChange("work"); setBrandMenuOpen(false); }}><span><WorkbenchIcon name="grid" size={17} /><strong>工作</strong></span><small>无限画布组织和执行任务</small></button>
          </div> : null}
        </div>
        <div className={styles.brandActions}><IconButton type="button" aria-label="搜索"><WorkbenchIcon name="search" /></IconButton></div>
      </div>
      <button className={styles.newTask} type="button"><WorkbenchIcon name="new" />新建任务<span>⌘ K</span></button>
      <nav className={styles.nav} aria-label="主导航"><button type="button"><WorkbenchIcon name="tools" />工具与技能</button><button type="button"><WorkbenchIcon name="archive" />知识库</button></nav>
      <div className={styles.sectionTitle}><span>项目</span><button type="button" aria-label="新建项目"><WorkbenchIcon name="plus" size={15} /></button></div>
      <div className={styles.projects}><button type="button"><WorkbenchIcon name="folder" />lfaa</button></div>
      <div className={`${styles.sectionTitle} ${styles.recentTitle}`}><span>最近</span></div>
      <div className={styles.history}>{recentRuns.map((item,index)=><button type="button" key={item} className={index===1?styles.current:""}>{item}</button>)}</div>
      <ProfileBar resolvedTheme={resolvedTheme} themePreference={themePreference} onOpenProfile={onOpenProfile} onOpenThemeMenu={onOpenThemeMenu} onRequestUpdate={onRequestUpdate} />
    </aside>
  );
}
