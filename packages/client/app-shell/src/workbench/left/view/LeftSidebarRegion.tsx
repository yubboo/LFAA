/**
 * 文件：LeftSidebarRegion.tsx
 * 作用：LFAA 左侧栏完整产品导航。
 * 负责：Chat / Work / Manual 三种工作方式的模式切换与对应导航。
 * 不负责：Agent Runtime、模型能力差异、终端 PTY、无限画布状态。
 * 状态归属：brand menu 局部状态归本模块；Workspace Mode 真值归 @lfaa/workspace Session Controller。
 * 对外接口：LeftSidebarRegion。
 * 关联文件：ProfileBar.tsx、@lfaa/workspace、AgentWorkbench.tsx。
 * 修改注意事项：Chat/Work 只能改变表现与人工干预方式，禁止在导航层制造不同能力等级；Manual 不要求模型。
 */
import { useState } from "react";
import type { WorkspaceMode } from "@lfaa/workspace";
import { useDismissibleLayer, type ThemePreference } from "@lfaa/ui";
import { WorkbenchIcon } from "#workbench/shared";
import type { ResolvedTheme } from "#workbench/contracts";
import { IconButton } from "#workbench/shared";
import { ProfileBar } from "./ProfileBar";
import styles from "../styles/LeftSidebar.module.css";

const recentRuns = ["配置系统", "Web 工作台", "热插拔测试", "模型接入规划"];

export function LeftSidebarRegion({ resolvedTheme, themePreference, workspaceMode, onWorkspaceModeChange, onToggleTerminal, onOpenProfile, onOpenThemeMenu, onRequestUpdate }: {
  resolvedTheme: ResolvedTheme;
  themePreference: ThemePreference;
  workspaceMode: WorkspaceMode;
  onWorkspaceModeChange: (mode: WorkspaceMode) => void;
  onToggleTerminal: () => void;
  onOpenProfile: () => void;
  onOpenThemeMenu: () => void;
  onRequestUpdate: () => void;
}) {
  const [brandMenuOpen, setBrandMenuOpen] = useState(false);
  const brandMenuRef = useDismissibleLayer<HTMLDivElement>({ open: brandMenuOpen, onDismiss: () => setBrandMenuOpen(false) });
  const chooseMode = (mode: WorkspaceMode) => { onWorkspaceModeChange(mode); setBrandMenuOpen(false); };
  return (
    <aside className={styles.root} data-ui="left-sidebar">
      <div className={styles.brandRow}>
        <div className={styles.brandSwitcher} ref={brandMenuRef}>
          <button className={styles.brand} type="button" aria-label="切换工作方式" aria-expanded={brandMenuOpen} onClick={() => setBrandMenuOpen((value) => !value)}>
            <span className={styles.brandMark}>L</span><strong>LFAA</strong><WorkbenchIcon name="chevron" size={15} />
          </button>
          {brandMenuOpen ? <div className={styles.brandMenu} role="menu" aria-label="LFAA 工作方式">
            <button className={workspaceMode === "chat" ? styles.active : ""} type="button" role="menuitem" onClick={() => chooseMode("chat")}><span><WorkbenchIcon name="spark" size={17} /><strong>聊天 Agent</strong></span><small>对话驱动，同一套 Agent Core 全自动完成任务</small></button>
            <button className={workspaceMode === "work" ? styles.active : ""} type="button" role="menuitem" onClick={() => chooseMode("work")}><span><WorkbenchIcon name="grid" size={17} /><strong>画布 Agent</strong></span><small>无限画布驱动，可直接人工调整执行结构</small></button>
            <button className={workspaceMode === "manual" ? styles.active : ""} type="button" role="menuitem" onClick={() => chooseMode("manual")}><span><WorkbenchIcon name="tools" size={17} /><strong>手动模式</strong></span><small>不使用模型，完全手动操作画布与本地工具</small></button>
          </div> : null}
        </div>
        <div className={styles.brandActions}><IconButton type="button" aria-label="搜索"><WorkbenchIcon name="search" /></IconButton></div>
      </div>
      {workspaceMode === "chat" ? (
        <>
          <button className={styles.newTask} type="button"><WorkbenchIcon name="new" />新建对话<span>⌘ K</span></button>
          <nav className={styles.nav} aria-label="聊天 Agent 导航">
            <button type="button"><WorkbenchIcon name="tools" />工具与技能</button>
            <button type="button"><WorkbenchIcon name="archive" />知识库</button>
          </nav>
          <div className={`${styles.sectionTitle} ${styles.recentTitle}`}><span>最近对话</span></div>
          <div className={styles.history}>{recentRuns.map((item,index)=><button type="button" key={item} className={index===1?styles.current:""}>{item}</button>)}</div>
        </>
      ) : workspaceMode === "work" ? (
        <>
          <button className={styles.newTask} type="button"><WorkbenchIcon name="new" />新建工作<span>⌘ K</span></button>
          <nav className={styles.nav} aria-label="画布 Agent 导航">
            <button type="button"><WorkbenchIcon name="grid" />工作区</button>
            <button type="button"><WorkbenchIcon name="tools" />任务与运行</button>
            <button type="button"><WorkbenchIcon name="folder" />文件</button>
            <button type="button" onClick={onToggleTerminal}><WorkbenchIcon name="terminal" />终端</button>
            <button type="button"><WorkbenchIcon name="archive" />变更与审查</button>
          </nav>
          <div className={styles.sectionTitle}><span>项目</span><button type="button" aria-label="新建项目"><WorkbenchIcon name="plus" size={15} /></button></div>
          <div className={styles.projects}><button type="button"><WorkbenchIcon name="folder" />lfaa</button></div>
          <div className={`${styles.sectionTitle} ${styles.recentTitle}`}><span>最近工作</span></div>
          <div className={styles.history}>{recentRuns.map((item,index)=><button type="button" key={item} className={index===1?styles.current:""}>{item}</button>)}</div>
        </>
      ) : (
        <>
          <button className={styles.newTask} type="button"><WorkbenchIcon name="new" />新建手动工作区<span>⌘ K</span></button>
          <nav className={styles.nav} aria-label="手动模式导航">
            <button type="button"><WorkbenchIcon name="grid" />无限画布</button>
            <button type="button" onClick={onToggleTerminal}><WorkbenchIcon name="terminal" />终端</button>
            <button type="button"><WorkbenchIcon name="tools" />工具与资源</button>
          </nav>
          <div className={styles.sectionTitle}><span>项目</span><button type="button" aria-label="新建项目"><WorkbenchIcon name="plus" size={15} /></button></div>
          <div className={styles.projects}><button type="button"><WorkbenchIcon name="folder" />lfaa</button></div>
          <div className={`${styles.sectionTitle} ${styles.recentTitle}`}><span>最近手动工作</span></div>
          <div className={styles.history}>{recentRuns.map((item,index)=><button type="button" key={item} className={index===1?styles.current:""}>{item}</button>)}</div>
        </>
      )}
      <ProfileBar resolvedTheme={resolvedTheme} themePreference={themePreference} onOpenProfile={onOpenProfile} onOpenThemeMenu={onOpenThemeMenu} onRequestUpdate={onRequestUpdate} />
    </aside>
  );
}
