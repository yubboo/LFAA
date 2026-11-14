/**
 * 文件：ApplicationGitSummary.tsx
 * 功能：呈现 Agent Git 摘要、文件范围与 Host Task 摘要。
 * 作用：只显示 Hook 提供的状态并调用已校验回调；Git 和任务结果由各自 Owner 管理。
 * 关联文件：../../ApplicationWorkspace.tsx、../hooks/useGitWorkspace.ts、../pure-utils.ts。
 */
import { Button } from "antd";
import type { MutableRefObject } from "react";
import type { AiActivityFileChange, AiHostTask, AiSession, ApplicationId, WorkspaceProject, WorkspaceProjectGitSummaryFolder } from "lfaa-client-connection/src/api.js";
import { aiHostTaskShellLabel, aiHostTaskStatusLabel } from "../pure-utils.js";
import type { WorkbenchLayoutMode } from "lfaa-client-ui-dockkit/src/workbench-layout.types.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";

interface ApplicationGitSummaryProps {
  app: ApplicationId;
  layoutMode: WorkbenchLayoutMode;
  activeSession: AiSession | null;
  projects: WorkspaceProject[];
  folderMatches: boolean;
  folders: WorkspaceProjectGitSummaryFolder[];
  foldersLoading: boolean;
  foldersError: string;
  actionFolderKey: string | null;
  onActionFolderKeyChange: (key: string | null) => void;
  actionMenuRef: MutableRefObject<HTMLDivElement | null>;
  actionTriggerRefs: MutableRefObject<Map<string, HTMLElement>>;
  sessionFileChangesState: { sessionId: string | null; changes: AiActivityFileChange[] };
  sessionFileSummary: { outputs: AiActivityFileChange[]; sources: AiActivityFileChange[] };
  hostTasks: AiHostTask[];
  hostTasksLoading: boolean;
  hostTasksError: string;
  hostTaskStopError: string;
  stoppingHostTaskId: string | null;
  onOpenFolder: (folder: WorkspaceProjectGitSummaryFolder, action?: "commit" | "push" | "branch-create" | "branch-switch") => void;
  onOpenHostTask: (task: AiHostTask) => void;
  onStopHostTask: (task: AiHostTask) => void;
  onOpenSessionFiles: () => void;
  onOpenProjectFile: (projectId: string, path: string, sourceId?: string) => void;
}

const canOpenFile = (projectId: string | null, path: string, projects: WorkspaceProject[], app: ApplicationId) => Boolean(
  projectId && projects.some(project => project.id === projectId && (!project.appId || project.appId === app))
  && path && !path.startsWith("/") && !path.startsWith("\\") && !path.includes("\\")
  && !path.split("/").some(segment => !segment || segment === "." || segment === "..")
);

export function ApplicationGitSummary({ app, layoutMode, activeSession, projects, folderMatches, folders, foldersLoading, foldersError, actionFolderKey, onActionFolderKeyChange, actionMenuRef, actionTriggerRefs, sessionFileChangesState, sessionFileSummary, hostTasks, hostTasksLoading, hostTasksError, hostTaskStopError, stoppingHostTaskId, onOpenFolder, onOpenHostTask, onStopHostTask, onOpenSessionFiles, onOpenProjectFile }: ApplicationGitSummaryProps) {
  const folderKey = (folder: WorkspaceProjectGitSummaryFolder) => folder.sourceId ?? folder.path;
  const folderTitle = (folder: WorkspaceProjectGitSummaryFolder) => folder.path.split(/[\\/]/u).filter(Boolean).at(-1) || folder.path;
  const folderStateLabel = (folder: WorkspaceProjectGitSummaryFolder) => folder.error ? "状态读取失败"
    : !folder.status ? foldersLoading ? "正在读取…" : "状态未知"
      : folder.status.repositoryState === "not-repository" ? "未初始化"
        : folder.status.clean ? "工作区干净" : `${folder.status.changedFileCount} 项变更`;
  const visibleFolders = folderMatches ? folders : [];
  const visibleLoading = folderMatches && foldersLoading;
  const visibleError = folderMatches ? foldersError : "";
  const visiblePrimaryFolder = visibleFolders.find(folder => folder.isPrimary) ?? visibleFolders[0] ?? null;
  const visibleSecondaryFolders = visibleFolders.filter(folder => folder !== visiblePrimaryFolder);
  const renderFile = (change: AiActivityFileChange, type: "output" | "source") => {
    const projectTitle = projects.find(project => project.id === change.projectId)?.title ?? activeSession?.projectTitle ?? "默认工作区";
    const projectId = change.projectId ?? activeSession?.projectId ?? null;
    const allowed = canOpenFile(projectId, change.path, projects, app);
    return <Button type="text" className="module-git-summary__file-row" key={`${type}:${change.projectId ?? ""}:${change.path}`} aria-label={`查看${type === "output" ? "输出" : "来源"}文件 ${change.path}`} title={allowed ? `在右侧查看 ${change.path}` : "此文件没有关联可读取的项目文件夹"} disabled={!allowed} onClick={() => { if (projectId) onOpenProjectFile(projectId, change.path, change.sourceId); }}>
      <WorkbenchIcon name="file" size={14} /><span className="module-git-summary__file-copy"><strong title={change.path}>{change.path}</strong><small>{projectTitle} · {type === "source" ? "已读取" : change.operation === "created" ? "新建" : "修改"}</small></span>
    </Button>;
  };

  return <section className={`module-git-summary${actionFolderKey !== null ? " is-actions-open" : ""}${layoutMode === "mobile" ? " is-embedded" : ""}`} data-layout-mode={layoutMode} id={layoutMode === "mobile" ? "module-sidebar-git-summary" : undefined} aria-label="项目摘要">
    {actionFolderKey ? <div id="module-git-summary-git-actions" ref={actionMenuRef} className="module-git-summary__operations-menu" role="menu" aria-label="Git 操作">
      {([["commit", "提交"], ["push", "推送"], ["branch-create", "创建分支"], ["branch-switch", "切换分支"]] as const).map(([action, title]) => <button key={action} type="button" role="menuitem" onClick={() => {
        const folder = visibleFolders.find(candidate => folderKey(candidate) === actionFolderKey);
        onActionFolderKeyChange(null);
        if (folder) onOpenFolder(folder, action);
      }}>{title}</button>)}
    </div> : null}
    <div className="module-git-summary__body">
      {visibleLoading ? <p className="module-git-summary__empty">正在读取当前项目文件夹…</p> : null}
      {visibleError ? <p className="module-git-summary__error" role="alert">{visibleError}</p> : null}
      {!visibleLoading && !visibleError && !visibleFolders.length ? <p className="module-git-summary__empty">{activeSession?.projectId ? "当前会话没有可读取的本机项目文件夹。" : "选择一个项目会话后显示其文件夹 Git 状态。"}</p> : null}
      {visiblePrimaryFolder ? (() => {
        const folder = visiblePrimaryFolder;
        const status = folder.status;
        const title = folderTitle(folder);
        const state = folderStateLabel(folder);
        const branch = folder.error ? "状态读取失败" : status?.repositoryState === "not-repository" ? "未初始化" : status?.branch || (visibleLoading ? "读取中…" : "状态未知");
        const key = folderKey(folder);
        return <article className="module-git-summary__project-card">
          <header className="module-git-summary__project-header"><strong className="module-git-summary__project-title" title={folder.path}>{title} · 主要</strong><span className="module-git-summary__branch" title={folder.error ?? folder.path}>{branch}</span></header>
          <div className={`module-git-summary__change-row${actionFolderKey === key ? " is-open" : ""}`}>
            <Button className="module-git-summary__root-change" type="text" aria-label={`打开 ${title} 的 Git 变更`} onClick={() => onOpenFolder(folder)}><WorkbenchIcon name="review" size={15} /><span>变更</span><span className="module-git-summary__endcap">{status && status.repositoryState !== "not-repository" && !folder.error ? <span className="module-git-summary__counts" aria-label={`新增 ${status.insertions} 行，删除 ${status.deletions} 行`}><b>+{status.insertions}</b><i>−{status.deletions}</i></span> : <span className="module-git-summary__item-state">{state}</span>}<WorkbenchIcon name="chevron" size={14} /></span></Button>
            <Button ref={element => { if (element) actionTriggerRefs.current.set(key, element); else actionTriggerRefs.current.delete(key); }} className="module-git-summary__operations-trigger" type="text" aria-label={`打开 ${title} 的 Git 操作`} title="Git 操作" aria-controls="module-git-summary-git-actions" aria-haspopup="menu" aria-expanded={actionFolderKey === key} onClick={() => onActionFolderKeyChange(actionFolderKey === key ? null : key)}><WorkbenchIcon name="branch" size={17} /></Button>
          </div>
        </article>;
      })() : null}
      {visibleSecondaryFolders.length ? <div className="module-git-summary__folders" aria-label="其他项目文件夹">
        {visibleSecondaryFolders.map(folder => {
          const state = folderStateLabel(folder); const title = folderTitle(folder); const key = folderKey(folder); const status = folder.status;
          return <div key={key} className={`module-git-summary__change-row${actionFolderKey === key ? " is-open" : ""}`}>
            <Button className="module-git-summary__folder-row" type="text" aria-label={`打开 ${title} 的 Git 变更：${state}`} onClick={() => onOpenFolder(folder)}><WorkbenchIcon name="folder" size={15} /><span className="module-git-summary__folder-name" title={folder.path}>{title}</span><span className="module-git-summary__endcap">{status && status.repositoryState !== "not-repository" && !folder.error ? <span className="module-git-summary__counts" aria-label={`新增 ${status.insertions} 行，删除 ${status.deletions} 行`}><b>+{status.insertions}</b><i>−{status.deletions}</i></span> : <span className="module-git-summary__folder-state">{state}</span>}<WorkbenchIcon name="chevron" size={14} /></span></Button>
            <Button ref={element => { if (element) actionTriggerRefs.current.set(key, element); else actionTriggerRefs.current.delete(key); }} className="module-git-summary__operations-trigger" type="text" aria-label={`打开 ${title} 的 Git 操作`} title="Git 操作" aria-controls="module-git-summary-git-actions" aria-haspopup="menu" aria-expanded={actionFolderKey === key} onClick={() => onActionFolderKeyChange(actionFolderKey === key ? null : key)}><WorkbenchIcon name="branch" size={17} /></Button>
          </div>;
        })}
      </div> : null}
      <section className="module-git-summary__file-section" aria-label="输出内容"><header><strong>输出内容</strong><span>{sessionFileSummary.outputs.length || ""}</span></header>
        {sessionFileChangesState.sessionId !== activeSession?.id ? <p className="module-git-summary__empty">正在读取当前会话记录…</p> : sessionFileSummary.outputs.length ? sessionFileSummary.outputs.slice(0, 3).map(change => renderFile(change, "output")) : <p className="module-git-summary__empty">当前会话暂无文件输出</p>}
      </section>
      <section className="module-git-summary__file-section" aria-label="后台进程"><header><strong>后台进程</strong><span>{hostTasks.length || ""}</span></header>
        {hostTasksError ? <p className="module-git-summary__error" role="alert">后台进程读取失败：{hostTasksError}</p> : hostTasksLoading && !hostTasks.length ? <p className="module-git-summary__empty">正在读取后台进程…</p> : hostTasks.length ? hostTasks.map(task => {
          const shellLabel = aiHostTaskShellLabel(task.shell);
          return <div className="module-git-summary__process-row" key={task.id}><Button type="text" className="module-git-summary__process-open" aria-label={`查看后台进程：${shellLabel}`} title={task.workingDirectory || task.message} onClick={() => onOpenHostTask(task)}><WorkbenchIcon name="terminal" size={14} /><span className="module-git-summary__file-copy"><strong>{shellLabel}</strong><small>{aiHostTaskStatusLabel(task)} · {task.message}</small></span></Button><Button type="text" className="module-git-summary__process-stop" aria-label={`停止后台进程：${shellLabel}`} title={task.cancelRequested ? "正在等待节点确认停止" : "停止任务"} disabled={stoppingHostTaskId === task.id || task.cancelRequested} onClick={() => onStopHostTask(task)}><WorkbenchIcon name="close" size={13} /></Button></div>;
        }) : <p className="module-git-summary__empty">当前应用没有运行中的后台进程</p>}
        {hostTaskStopError ? <p className="module-git-summary__error" role="alert">{hostTaskStopError}</p> : null}
      </section>
      <section className="module-git-summary__file-section" aria-label="来源"><header><strong>来源</strong><span>{sessionFileSummary.sources.length || ""}</span></header>
        {sessionFileChangesState.sessionId !== activeSession?.id ? <p className="module-git-summary__empty">正在读取当前会话记录…</p> : sessionFileSummary.sources.length ? sessionFileSummary.sources.slice(0, 3).map(change => renderFile(change, "source")) : <p className="module-git-summary__empty">当前会话暂无文件来源</p>}
      </section>
    </div>
    {sessionFileSummary.outputs.length + sessionFileSummary.sources.length > 0 ? <Button className="module-git-summary__view-all" type="text" onClick={onOpenSessionFiles}>查看全部</Button> : null}
  </section>;
}
