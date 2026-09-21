/**
 * 文件：LeftSidebarRegion.tsx
 * 作用：Workbench 稳定左侧导航与左上角工作方式切换入口。
 * 负责：品牌模式菜单、新建 Session、真实最近 Session、工具设置入口与 ProfileBar。
 * 不负责：根据 Chat/Work/Manual 重建整套菜单、Session 持久化实现、Agent Runtime。
 * 状态归属：模式/Session 真值由上层 Session Controller 传入；本组件只拥有品牌菜单开关。
 * 对外接口：LeftSidebarRegion。
 * 关联文件：AgentWorkbench.tsx、@lfaa/session、ProfileBar.tsx。
 * 修改注意事项：左栏结构必须跨模式稳定；未实现功能必须 disabled，禁止展示可点击假入口。
 */
import { useState } from "react";
import type { UpdateWorkspaceProjectInput, WorkspaceProjectRecord, WorkspaceSessionSummary } from "@lfaa/session";
import type { WorkspaceMode } from "@lfaa/workspace";
import { useDismissibleLayer, type ThemePreference } from "@lfaa/ui";
import { WorkbenchIcon, IconButton } from "#workbench/shared";
import type { ResolvedTheme } from "#workbench/contracts";
import { ProfileBar } from "./ProfileBar";
import styles from "../styles/LeftSidebar.module.css";

export function LeftSidebarRegion({ resolvedTheme, themePreference, profileDisplayName, profileSubtitle, workspaceMode, projects, activeProjectId, recentSessions, pinnedSessions, activeSessionId, sessionError, onWorkspaceModeChange, onCreateSession, onSelectSession, onToggleSessionPinned, onCreateProject, onSelectProject, onUpdateProject, onDeleteProject, onOpenToolsAndSkills, onOpenProfile, onOpenThemeMenu, onRequestUpdate }: {
  resolvedTheme: ResolvedTheme;
  themePreference: ThemePreference;
  profileDisplayName: string;
  profileSubtitle: string;
  workspaceMode: WorkspaceMode;
  projects: readonly WorkspaceProjectRecord[];
  activeProjectId: string;
  recentSessions: readonly WorkspaceSessionSummary[];
  pinnedSessions: readonly WorkspaceSessionSummary[];
  activeSessionId: string | null;
  sessionError: string | null;
  onWorkspaceModeChange: (mode: WorkspaceMode) => void;
  onCreateSession: () => void;
  onSelectSession: (sessionId: string) => void;
  onToggleSessionPinned: (sessionId: string) => void;
  onCreateProject: (name: string) => void;
  onSelectProject: (projectId: string) => void;
  onUpdateProject: (projectId: string, input: UpdateWorkspaceProjectInput) => void;
  onDeleteProject: (projectId: string) => void;
  onOpenToolsAndSkills: () => void;
  onOpenProfile: () => void;
  onOpenThemeMenu: () => void;
  onRequestUpdate: () => void;
}) {
  const [brandMenuOpen, setBrandMenuOpen] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const brandMenuRef = useDismissibleLayer<HTMLDivElement>({ open: brandMenuOpen, onDismiss: () => setBrandMenuOpen(false) });
  const chooseMode = (mode: WorkspaceMode) => { onWorkspaceModeChange(mode); setBrandMenuOpen(false); };
  const pinnedProjects = projects.filter((item) => item.pinned);
  const submitProject = () => {
    const name = newProjectName.trim();
    if (!name) return;
    onCreateProject(name); setNewProjectName(""); setCreatingProject(false);
  };
  const renameProject = (project: WorkspaceProjectRecord) => {
    const name = window.prompt("重命名项目", project.name)?.trim();
    if (name && name !== project.name) onUpdateProject(project.id, { name });
  };
  const removeProject = (project: WorkspaceProjectRecord) => {
    if (window.confirm(`删除项目“${project.name}”及其会话？此操作不可撤销。`)) onDeleteProject(project.id);
  };
  return (
    <aside className={styles.root} data-ui="left-sidebar">
      <div className={styles.brandRow}>
        <div className={styles.brandSwitcher} ref={brandMenuRef}>
          <button className={styles.brand} type="button" aria-label="切换工作方式" aria-expanded={brandMenuOpen} onClick={() => setBrandMenuOpen((value) => !value)}>
            <span className={styles.brandMark}>L</span><strong>LFAA</strong><WorkbenchIcon name="chevron" size={15} />
          </button>
          {brandMenuOpen ? <div className={styles.brandMenu} role="menu" aria-label="LFAA 工作方式">
            <button className={workspaceMode === "chat" ? styles.active : ""} type="button" role="menuitem" onClick={() => chooseMode("chat")}><span><WorkbenchIcon name="spark" size={17} /><strong>聊天 Agent</strong></span><small>对话表现层 · 与画布 Agent 共用同一套 Agent Core</small></button>
            <button className={workspaceMode === "work" ? styles.active : ""} type="button" role="menuitem" onClick={() => chooseMode("work")}><span><WorkbenchIcon name="grid" size={17} /><strong>画布 Agent</strong></span><small>无限画布表现层 · 同一自动化能力与交付质量</small></button>
            <button className={workspaceMode === "manual" ? styles.active : ""} type="button" role="menuitem" onClick={() => chooseMode("manual")}><span><WorkbenchIcon name="tools" size={17} /><strong>手动模式</strong></span><small>关闭 AI 决策层，继续使用同一套本地工具</small></button>
          </div> : null}
        </div>
        <div className={styles.brandActions}><IconButton type="button" aria-label="搜索" disabled title="全局搜索尚未接入"><WorkbenchIcon name="search" /></IconButton></div>
      </div>

      <button className={styles.newTask} type="button" onClick={onCreateSession}><WorkbenchIcon name="new" />新建任务<span>⌘ K</span></button>
      <nav className={styles.nav} aria-label="LFAA 主导航">
        <button type="button" onClick={onOpenToolsAndSkills}><WorkbenchIcon name="tools" />工具与技能</button>
        <button type="button" disabled title="知识库能力尚未接入"><WorkbenchIcon name="archive" />知识库</button>
      </nav>
      {pinnedProjects.length || pinnedSessions.length ? <>
        <div className={styles.sectionTitle}><span>置顶</span></div>
        <div className={styles.pinnedList}>
          {pinnedProjects.map((project) => <button type="button" key={`project:${project.id}`} onClick={() => onSelectProject(project.id)} className={project.id === activeProjectId ? styles.current : ""}><WorkbenchIcon name="folder" />{project.name}</button>)}
          {pinnedSessions.map((item) => <button type="button" key={`session:${item.id}`} onClick={() => onSelectSession(item.id)} className={item.id === activeSessionId ? styles.current : ""}>{item.title}</button>)}
        </div>
      </> : null}
      <div className={styles.sectionTitle}><span>项目</span><button type="button" aria-label="新建项目" aria-expanded={creatingProject} onClick={() => setCreatingProject((value) => !value)}><WorkbenchIcon name="plus" size={15} /></button></div>
      {creatingProject ? <div className={styles.projectForm}>
        <input autoFocus value={newProjectName} onChange={(event) => setNewProjectName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submitProject(); if (event.key === "Escape") setCreatingProject(false); }} placeholder="项目名称" aria-label="项目名称" />
        <button type="button" onClick={submitProject} disabled={!newProjectName.trim()}>创建</button><button type="button" onClick={() => setCreatingProject(false)}>取消</button>
      </div> : null}
      <div className={styles.projects}>{projects.map((project) => <div className={styles.projectGroup} key={project.id} data-active={project.id === activeProjectId}>
        <div className={styles.projectRow}>
          <button type="button" className={styles.expandButton} aria-label={`${project.expanded ? "折叠" : "展开"}${project.name}`} aria-expanded={project.expanded} onClick={() => onUpdateProject(project.id, { expanded: !project.expanded })}><WorkbenchIcon name="chevron" size={13} /></button>
          <button type="button" className={styles.projectButton} onClick={() => onSelectProject(project.id)}><WorkbenchIcon name="folder" />{project.name}</button>
          <button type="button" className={styles.rowAction} aria-label={`${project.pinned ? "取消置顶" : "置顶"}${project.name}`} onClick={() => onUpdateProject(project.id, { pinned: !project.pinned })}>{project.pinned ? "★" : "☆"}</button>
          <button type="button" className={styles.rowAction} aria-label={`重命名${project.name}`} onClick={() => renameProject(project)}>✎</button>
          <button type="button" className={styles.rowAction} aria-label={`删除${project.name}`} disabled={projects.length <= 1} onClick={() => removeProject(project)}>×</button>
        </div>
        {project.expanded && project.id === activeProjectId ? <div className={styles.projectSessions}>{recentSessions.map((item) => <button type="button" key={item.id} className={item.id === activeSessionId ? styles.current : ""} onClick={() => onSelectSession(item.id)}>{item.title}</button>)}</div> : null}
      </div>)}</div>
      <div className={`${styles.sectionTitle} ${styles.recentTitle}`}><span>最近</span></div>
      <div className={styles.history}>
        {recentSessions.length ? recentSessions.map((item) => (
          <div className={styles.historyRow} key={item.id}><button type="button" className={item.id === activeSessionId ? styles.current : ""} onClick={() => onSelectSession(item.id)} title={item.preview || item.title}>{item.title}</button><button type="button" className={styles.rowAction} aria-label={`${item.pinned ? "取消置顶" : "置顶"}${item.title}`} onClick={() => onToggleSessionPinned(item.id)}>{item.pinned ? "★" : "☆"}</button></div>
        )) : <div className={styles.emptyHistory}>{sessionError ? `会话存储不可用：${sessionError}` : "还没有会话"}</div>}
      </div>
      <ProfileBar resolvedTheme={resolvedTheme} themePreference={themePreference} displayName={profileDisplayName} subtitle={profileSubtitle} onOpenProfile={onOpenProfile} onOpenThemeMenu={onOpenThemeMenu} onRequestUpdate={onRequestUpdate} />
    </aside>
  );
}
