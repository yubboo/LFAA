/**
 * 文件：ApplicationSidebarSessions.tsx
 * 功能：呈现左侧会话/项目列表，管理分区偏好、会话菜单、重命名和移动端收起时序。
 * 作用：把会话导航状态与其界面放在同一子模块；数据读写仍调用原 Session、Workspace 和 Client Store Owner。
 * 关联文件：./ApplicationSidebar.tsx、./sidebar-types.ts、../../session-icon.ts、../../session-completion-indicator.ts。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Dropdown, Input, message, Modal, Tag } from "antd";
import { getErrorMessage, isDesktopApp, type AiSession, type WorkspaceProject } from "lfaa-client-connection/src/api.js";
import { openWorkspaceProjectManager } from "lfaa-client-ui-chat/src/project-manager-events.js";
import { MAX_AI_WORK_SIDEBAR_GROUP_PREFERENCES, MAX_AI_WORK_SIDEBAR_VISIBLE_SESSIONS, readAiWorkSidebarPreferences, writeAiWorkSidebarPreferences, type AiWorkSidebarPreferences } from "lfaa-client-store/src/ai-work-sidebar.js";
import { createScrollRestorationKey, useScrollRestoration } from "lfaa-client-store/src/scroll-restoration.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import { hasUnreadSessionCompletionNotification } from "../../session-completion-indicator.js";
import { resolveAiSessionIconName } from "../../session-icon.js";
import { resolveRecentItems } from "lfaa-util-values/src/recent-window.js";
import type { ApplicationSidebarSessionsProps } from "./sidebar-types.js";

const AI_WORK_PROJECT_SESSION_PAGE_SIZE = 5;

export function ApplicationSidebarSessions({ userId, app, mode, layoutMode, apps, onNavigate, onToggleLeft, notifications, onMarkSessionNotificationsRead, sessions, missingSessionDirectoryIds, aiDraft, pinnedSessionIds, onTogglePinnedSession, workspaceProjects, workspaceProjectsReady, sessionsDataReady, recentSessionsExpandRequestId, projectLoadError, onRetryProjects, activeSessionId, sessionsLoading, sessionsError, providerStatus, gitSummaryOpen, gitSummaryContent, onNewSession, onSelectSession, onRenameSession, onArchiveSession, onCloseGitSummary }: ApplicationSidebarSessionsProps) {
  const [sessionMenuKey, setSessionMenuKey] = useState<string | null>(null);
  const [recentSessionsNow, setRecentSessionsNow] = useState(() => Date.now());
  useEffect(() => { setRecentSessionsNow(Date.now()); }, [userId, app]);
  const [renamingSession, setRenamingSession] = useState<AiSession | null>(null);
  const [renameSessionTitle, setRenameSessionTitle] = useState("");
  const [renameSessionError, setRenameSessionError] = useState("");
  const [renameSessionSaving, setRenameSessionSaving] = useState(false);
  const mobileSessionCloseTimerRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (mobileSessionCloseTimerRef.current !== null) window.clearTimeout(mobileSessionCloseTimerRef.current);
  }, []);
  const clearMobileSessionCloseTimer = () => {
    if (mobileSessionCloseTimerRef.current === null) return;
    window.clearTimeout(mobileSessionCloseTimerRef.current);
    mobileSessionCloseTimerRef.current = null;
  };
  useEffect(() => {
    if (layoutMode === "mobile" || mobileSessionCloseTimerRef.current === null) return;
    window.clearTimeout(mobileSessionCloseTimerRef.current);
    mobileSessionCloseTimerRef.current = null;
  }, [layoutMode]);
  const beginRenameSession = (session: AiSession) => {
    clearMobileSessionCloseTimer();
    setRenameSessionTitle(session.title);
    setRenameSessionError("");
    setRenamingSession(session);
  };
  const closeRenameSession = () => {
    if (renameSessionSaving) return;
    setRenamingSession(null);
    setRenameSessionTitle("");
    setRenameSessionError("");
  };
  const saveRenameSession = async () => {
    if (!renamingSession || renameSessionSaving) return;
    const title = renameSessionTitle.trim();
    if (!title) {
      setRenameSessionError("请输入聊天标题。");
      return;
    }
    if ([...title].length > 80) {
      setRenameSessionError("聊天标题最多 80 个字符。");
      return;
    }
    setRenameSessionSaving(true);
    setRenameSessionError("");
    try {
      await onRenameSession(renamingSession.id, title);
      closeRenameSession();
      message.success("聊天已重命名。");
    } catch (error) {
      setRenameSessionError(getErrorMessage(error));
    } finally {
      setRenameSessionSaving(false);
    }
  };
  const sidebarPreferenceScope = JSON.stringify([userId, app]);
  const [sidebarPreferenceRecord, setSidebarPreferenceRecord] = useState(() => ({
    scope: sidebarPreferenceScope,
    value: readAiWorkSidebarPreferences(userId, app),
  }));
  const sidebarPreferences = sidebarPreferenceRecord.scope === sidebarPreferenceScope
    ? sidebarPreferenceRecord.value
    : readAiWorkSidebarPreferences(userId, app);
  const updateSidebarPreferences = useCallback((update: (current: AiWorkSidebarPreferences) => AiWorkSidebarPreferences) => {
    setSidebarPreferenceRecord(current => ({
      scope: sidebarPreferenceScope,
      value: update(current.scope === sidebarPreferenceScope ? current.value : readAiWorkSidebarPreferences(userId, app)),
    }));
  }, [app, sidebarPreferenceScope, userId]);
  useEffect(() => {
    if (sidebarPreferenceRecord.scope === sidebarPreferenceScope) return;
    setSidebarPreferenceRecord({ scope: sidebarPreferenceScope, value: sidebarPreferences });
  }, [sidebarPreferenceRecord.scope, sidebarPreferenceScope, sidebarPreferences]);
  useEffect(() => {
    if (sidebarPreferenceRecord.scope !== sidebarPreferenceScope) return;
    writeAiWorkSidebarPreferences(userId, app, sidebarPreferenceRecord.value);
  }, [app, sidebarPreferenceRecord, sidebarPreferenceScope, userId]);
  useEffect(() => {
    if (recentSessionsExpandRequestId < 1) return;
    updateSidebarPreferences(current => current.recentSessionsExpanded ? current : { ...current, recentSessionsExpanded: true });
  }, [recentSessionsExpandRequestId, updateSidebarPreferences]);
  const pinnedExpanded = sidebarPreferences.pinnedExpanded;
  const projectsExpanded = sidebarPreferences.projectsExpanded;
  const recentSessionsExpanded = sidebarPreferences.recentSessionsExpanded;
  const collapsedProjectGroups = new Set(sidebarPreferences.collapsedProjectGroups);
  const projectSessionVisibleCounts = sidebarPreferences.projectSessionVisibleCounts;
  useEffect(() => { setSessionMenuKey(null); }, [layoutMode]);
  useEffect(() => {
    if (!sessionMenuKey) return;
    const dismissEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setSessionMenuKey(null);
    };
    const dismissOutside = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && (target.closest(".module-session-menu") || target.closest('button[aria-haspopup="menu"]'))) return;
      setSessionMenuKey(null);
    };
    window.addEventListener("keydown", dismissEscape, true);
    document.addEventListener("pointerdown", dismissOutside);
    return () => {
      window.removeEventListener("keydown", dismissEscape, true);
      document.removeEventListener("pointerdown", dismissOutside);
    };
  }, [sessionMenuKey]);
  const appSessions = useMemo(() => sessions.filter(session => !session.archived), [sessions]);
  const pinnedSessionSet = useMemo(() => new Set(pinnedSessionIds), [pinnedSessionIds]);
  const pinnedSessions = appSessions.filter(session => pinnedSessionSet.has(session.id));
  const projectsById = new Map(workspaceProjects.map(project => [project.id, project]));
  const pinnedProjectGroups = new Map<string, { project: WorkspaceProject | null; title: string; sessions: AiSession[] }>();
  for (const session of pinnedSessions) {
    const project = session.projectId ? projectsById.get(session.projectId) ?? null : null;
    const groupKey = session.projectId ? `project:${session.projectId}` : "unassigned";
    const group = pinnedProjectGroups.get(groupKey) ?? {
      project,
      title: project?.title ?? session.projectTitle ?? (session.projectId ? "已移除项目" : "未归属项目"),
      sessions: [],
    };
    group.sessions.push(session);
    pinnedProjectGroups.set(groupKey, group);
  }
  const projectGroups = new Map<string, { project: WorkspaceProject | null; title: string; sessions: AiSession[] }>();
  if (app === "workspace") {
    for (const project of workspaceProjects) {
      if (project.appId === "workspace" && project.nodeId === null) projectGroups.set(project.id, { project, title: project.title, sessions: [] });
    }
  }
  for (const session of appSessions) {
    if (!session.projectId || pinnedSessionSet.has(session.id)) continue;
    const project = projectsById.get(session.projectId) ?? null;
    const group = projectGroups.get(session.projectId) ?? { project, title: project?.title ?? session.projectTitle ?? "已移除项目", sessions: [] };
    group.sessions.push(session);
    projectGroups.set(session.projectId, group);
  }
  useEffect(() => {
    if (!sessionsDataReady || !workspaceProjectsReady) return;
    const activeGroupKeys = new Set([
      ...[...pinnedProjectGroups.keys()].map(projectId => `pinned:${projectId}`),
      ...[...projectGroups.keys()].map(projectId => `projects:project:${projectId}`),
    ]);
    updateSidebarPreferences(current => {
      const collapsedProjectGroups = current.collapsedProjectGroups.filter(key => activeGroupKeys.has(key));
      const projectSessionVisibleCounts = Object.fromEntries(Object.entries(current.projectSessionVisibleCounts)
        .filter(([key]) => activeGroupKeys.has(key)));
      if (collapsedProjectGroups.length === current.collapsedProjectGroups.length
        && Object.keys(projectSessionVisibleCounts).length === Object.keys(current.projectSessionVisibleCounts).length) return current;
      return { ...current, collapsedProjectGroups, projectSessionVisibleCounts };
    });
  }, [app, pinnedSessionIds, sessions, sessionsDataReady, updateSidebarPreferences, workspaceProjects, workspaceProjectsReady]);
  const toggleProjectGroup = (groupKey: string) => updateSidebarPreferences(current => {
    const collapsed = new Set(current.collapsedProjectGroups);
    if (collapsed.has(groupKey)) collapsed.delete(groupKey);
    else collapsed.add(groupKey);
    return { ...current, collapsedProjectGroups: [...collapsed].slice(-MAX_AI_WORK_SIDEBAR_GROUP_PREFERENCES) };
  });
  const renderSession = (session: AiSession, menuScope: string, nested = false) => {
    const isPinned = pinnedSessionSet.has(session.id);
    const directoryMissing = missingSessionDirectoryIds.has(session.id);
    const hasUnreadCompletion = hasUnreadSessionCompletionNotification(notifications, session.appId, session.id);
    const iconName = resolveAiSessionIconName(session);
    const menuKey = menuScope + ":" + session.id;
    const menu = { items: [
      { key: "rename", label: "重命名" },
      { key: "pin", label: isPinned ? "取消置顶" : "置顶" },
      { key: "archive", label: "归档", icon: <WorkbenchIcon name="archive" size={14} /> },
    ], onClick: ({ key }: { key: string }) => {
      setSessionMenuKey(null);
      if (key === "rename") beginRenameSession(session);
      if (key === "pin") onTogglePinnedSession(session.id);
      if (key === "archive") onArchiveSession(session);
    } };
    return <Dropdown key={menuKey} menu={menu} trigger={isDesktopApp() ? ["contextMenu"] : []}
      open={sessionMenuKey === menuKey} onOpenChange={open => setSessionMenuKey(current => open ? menuKey : current === menuKey ? null : current)}
      placement="bottomRight" align={{ points: ["tl", "tr"], offset: [8, 0] }} autoAdjustOverflow overlayClassName="module-session-menu"
      getPopupContainer={trigger => trigger.closest<HTMLElement>(".module-workbench-stage") ?? trigger.parentElement!}>
      <div className={`module-sidebar__session${nested ? " module-sidebar__session--nested" : ""}${session.id === activeSessionId ? " is-active" : ""}${directoryMissing ? " is-project-directory-missing" : ""}`}>
        <button type="button" aria-current={session.id === activeSessionId ? "page" : undefined} aria-label={`${session.title}${hasUnreadCompletion ? "，有未读的回复完成提醒" : ""}`} onClick={event => {
          setSessionMenuKey(null);
          if (event.detail > 1) { clearMobileSessionCloseTimer(); return; }
          if (hasUnreadCompletion) onMarkSessionNotificationsRead(session.appId, session.id);
          onSelectSession(session.id);
          if (layoutMode === "mobile") {
            clearMobileSessionCloseTimer();
            mobileSessionCloseTimerRef.current = window.setTimeout(() => {
              mobileSessionCloseTimerRef.current = null;
              onToggleLeft();
            }, 550);
          }
        }} onDoubleClick={() => beginRenameSession(session)} title={`${directoryMissing ? `${session.title} · 项目目录已删除或移动，历史记录仍可查看` : session.title}${hasUnreadCompletion ? " · 回复已完成，打开会话查看" : ""}`}><span className="module-sidebar__session-icon" aria-hidden="true"><WorkbenchIcon name={iconName} size={14} /></span><span className="module-sidebar__session-title">{session.title}</span></button>
        <div className="module-sidebar__session-actions">
          {hasUnreadCompletion ? <span className="module-sidebar__session-completion-dot" aria-hidden="true" /> : null}
          <button type="button" aria-label={`会话菜单：${session.title}`} aria-haspopup="menu" aria-expanded={sessionMenuKey === menuKey} title="会话菜单" onClick={event => { event.stopPropagation(); setSessionMenuKey(current => current === menuKey ? null : menuKey); }}><WorkbenchIcon name="dots" size={15} /></button>
        </div>
      </div>
    </Dropdown>;
  };
  const renderProjectGroup = (groupKey: string, group: { project: WorkspaceProject | null; title: string; sessions: AiSession[] }) => {
    const isExpanded = !collapsedProjectGroups.has(groupKey);
    const visibleCount = projectSessionVisibleCounts[groupKey] ?? AI_WORK_PROJECT_SESSION_PAGE_SIZE;
    const visibleSessions = group.sessions.slice(0, visibleCount);
    const hiddenCount = group.sessions.length - visibleSessions.length;
    const groupContentId = `module-sidebar-project-sessions-${encodeURIComponent(groupKey)}`;
    const missingForGroup = group.sessions.length > 0 && group.sessions.every(session => missingSessionDirectoryIds.has(session.id));
    return <section className="module-sidebar__project-group" key={groupKey}>
      <div className="module-sidebar__project-row" onClick={event => {
        if (event.target instanceof Element && event.target.closest("button")) return;
        toggleProjectGroup(groupKey);
      }}>
        <button className={`module-sidebar__project-heading${missingForGroup ? " is-project-directory-missing" : ""}`} type="button" aria-expanded={isExpanded} aria-controls={groupContentId} title={group.project ? `${group.title} · ${group.project.sources.map(source => source.path).join(" · ") || "尚未添加源文件夹"}` : `${group.title} · 展开或收起会话`} onClick={() => toggleProjectGroup(groupKey)}><WorkbenchIcon name="folder" size={14} /><span>{group.title}</span><small>{group.sessions.length}</small><WorkbenchIcon name="chevron" size={13} /></button>
        <div className="module-sidebar__project-actions">
          {app === "workspace" && group.project?.nodeId === null ? <button className="module-sidebar__project-edit" type="button" aria-label={`编辑项目：${group.title}`} title="编辑项目" onClick={() => openWorkspaceProjectManager(group.project!.id)}><WorkbenchIcon name="dots" size={14} /></button> : null}
          {group.project ? <button className="module-sidebar__project-new-session" type="button" aria-label={`在项目“${group.title}”中新对话`} title="在此项目中新对话" onClick={() => { onNewSession(group.project!.id); if (layoutMode === "mobile") onToggleLeft(); }}><WorkbenchIcon name="new" size={14} /></button> : null}
        </div>
      </div>
      <div id={groupContentId} className="module-sidebar__project-sessions" hidden={!isExpanded}>
        {visibleSessions.map(session => renderSession(session, "group:" + groupKey, true))}
        {hiddenCount > 0 ? <button className="module-sidebar__project-more" type="button" aria-label={`展开显示${group.title}中的更多会话，剩余 ${hiddenCount} 条`} title={`每次展开 ${AI_WORK_PROJECT_SESSION_PAGE_SIZE} 个会话`} onClick={() => updateSidebarPreferences(current => {
          const visibleCounts = { ...current.projectSessionVisibleCounts };
          visibleCounts[groupKey] = Math.min(group.sessions.length, MAX_AI_WORK_SIDEBAR_VISIBLE_SESSIONS, (visibleCounts[groupKey] ?? AI_WORK_PROJECT_SESSION_PAGE_SIZE) + AI_WORK_PROJECT_SESSION_PAGE_SIZE);
          const keys = Object.keys(visibleCounts);
          while (keys.length > MAX_AI_WORK_SIDEBAR_GROUP_PREFERENCES) {
            const removableKey = keys.find(key => key !== groupKey);
            if (!removableKey) break;
            delete visibleCounts[removableKey];
            keys.splice(keys.indexOf(removableKey), 1);
          }
          return { ...current, projectSessionVisibleCounts: visibleCounts };
        })}>展开显示</button> : null}
        {!group.sessions.length ? <span className="module-sidebar__session-message">此项目暂无会话</span> : null}
      </div>
    </section>;
  };

  const recentSessionsView = useMemo(() => resolveRecentItems(
    appSessions.filter(session => !session.projectId && !pinnedSessionSet.has(session.id)),
    session => session.updatedAt,
    recentSessionsNow
  ), [appSessions, pinnedSessionSet, recentSessionsNow]);
  const recentSessions = recentSessionsView.items;
  useEffect(() => {
    const expiryAt = recentSessionsView.nextExpiryAt;
    if (expiryAt === null) return;
    const timeoutId = window.setTimeout(() => setRecentSessionsNow(Date.now()), Math.max(1, expiryAt - Date.now() + 1));
    return () => window.clearTimeout(timeoutId);
  }, [recentSessionsView.nextExpiryAt]);
  const hasDraft = app === "workspace" && Boolean(aiDraft.trim());
  const sessionsScroll = useScrollRestoration(createScrollRestorationKey(userId, "module-session-list", app), !sessionsLoading);
  return (
    <>
      {mode === "ai-work" ? <section className={`module-sidebar__sessions${layoutMode === "mobile" && gitSummaryOpen ? " is-git-summary" : ""}`} aria-label={layoutMode === "mobile" && gitSummaryOpen ? "项目摘要" : `${apps.find((item) => item.id === app)?.title ?? "当前应用"} 会话`}>
        {layoutMode === "mobile" && gitSummaryOpen ? <>
          <div className="module-sidebar__mobile-summary-heading">
            <button type="button" onClick={onCloseGitSummary} aria-label="返回项目与会话"><WorkbenchIcon name="chevron" size={15} /><span>项目与会话</span></button>
            <strong>Git 摘要</strong>
          </div>
          <div className="module-sidebar__mobile-summary-content">{gitSummaryContent}</div>
        </> : <>
        <div className="module-sidebar__sessions-heading"><span>{apps.find(item => item.id === app)?.title ?? "当前应用"} 项目与会话</span><span className="module-sidebar__sessions-count">{appSessions.length}</span><button type="button" aria-label="新对话" title="新对话" onClick={() => { onNewSession(); if (layoutMode === "mobile") onToggleLeft(); }}><WorkbenchIcon name="plus" size={15} /><span>新对话</span></button></div>
        {sessionsError ? <p className="module-sidebar__sessions-error" role="alert">{sessionsError}</p> : null}
        {projectLoadError ? <p className="module-sidebar__sessions-error" role="alert">项目目录加载失败：{projectLoadError} <button type="button" onClick={onRetryProjects}>重试</button></p> : null}
        <div ref={sessionsScroll.ref} onScroll={sessionsScroll.onScroll} className="module-sidebar__session-list">
          {sessionsLoading ? <span className="module-sidebar__session-message">正在加载会话…</span> : <>
            {hasDraft ? <section className="module-sidebar__session-category" aria-label="草稿">
              <div className="module-sidebar__category-heading"><span>草稿</span><small>1</small></div>
              <div className="module-sidebar__session module-sidebar__session--draft">
                <button type="button" title="返回工作区继续编辑未发送草稿" aria-label="返回工作区继续编辑未发送草稿" onClick={() => onNavigate("/work")}><WorkbenchIcon name="history" size={14} /><span>继续未发送内容</span></button>
              </div>
            </section> : null}
            <section className="module-sidebar__session-category" aria-label="置顶会话">
              <button className="module-sidebar__category-toggle" type="button" aria-expanded={pinnedExpanded} aria-controls="module-sidebar-pinned-content" onClick={() => updateSidebarPreferences(current => ({ ...current, pinnedExpanded: !current.pinnedExpanded }))}><span>置顶</span><small>{pinnedSessions.length}</small><WorkbenchIcon name="chevron" size={13} /></button>
              <div id="module-sidebar-pinned-content" className="module-sidebar__category-content" hidden={!pinnedExpanded}>
                {[...pinnedProjectGroups.entries()].map(([projectId, group]) => renderProjectGroup(`pinned:${projectId}`, group))}
                {!pinnedSessions.length ? <span className="module-sidebar__session-message">用星标收纳常用会话</span> : null}
              </div>
            </section>
            {projectGroups.size || app === "workspace" ? <section className="module-sidebar__session-category" aria-label="项目">
              <div className="module-sidebar__project-toolbar" onClick={event => {
                if (event.target instanceof Element && event.target.closest("button")) return;
                updateSidebarPreferences(current => ({ ...current, projectsExpanded: !current.projectsExpanded }));
              }}>
                <button className="module-sidebar__project-section-toggle" type="button" aria-expanded={projectsExpanded} onClick={() => updateSidebarPreferences(current => ({ ...current, projectsExpanded: !current.projectsExpanded }))}><span>项目</span><small>{app === "workspace" ? projectGroups.size : [...projectGroups.values()].reduce((count, group) => count + group.sessions.length, 0)}</small><WorkbenchIcon name="chevron" size={13} /></button>
                {app === "workspace" ? <>
                  <Dropdown menu={{ items: [{ key: "refresh", label: "刷新项目列表" }, { key: "create", label: "创建项目" }], onClick: ({ key }) => { if (key === "refresh") onRetryProjects(); else if (key === "create") openWorkspaceProjectManager(); } }} trigger={["click"]} placement="bottomRight" getPopupContainer={trigger => trigger.closest<HTMLElement>(".module-workbench-stage") ?? trigger.parentElement!}>
                    <button type="button" aria-label="项目更多操作" title="项目更多操作"><WorkbenchIcon name="dots" size={15} /></button>
                  </Dropdown>
                  <button type="button" aria-label="创建项目" title="创建项目" onClick={() => openWorkspaceProjectManager()}><WorkbenchIcon name="plus" size={15} /></button>
                </> : null}
              </div>
              <div className="module-sidebar__category-content" hidden={!projectsExpanded}>
                {[...projectGroups.entries()].map(([projectId, group]) => renderProjectGroup(`projects:project:${projectId}`, group))}
                {!projectGroups.size && app === "workspace" ? <div className="module-sidebar__project-empty"><span>把相关聊天集中到一个项目中。</span><button type="button" onClick={() => openWorkspaceProjectManager()}>创建项目</button></div> : null}
              </div>
            </section> : null}
            {recentSessions.length ? <section className="module-sidebar__session-category" aria-label="最近会话">
              <button className="module-sidebar__category-toggle" type="button" aria-expanded={recentSessionsExpanded} aria-controls="module-sidebar-recent-content" onClick={() => updateSidebarPreferences(current => ({ ...current, recentSessionsExpanded: !current.recentSessionsExpanded }))}><span>最近</span><small>{recentSessions.length}</small><WorkbenchIcon name="chevron" size={13} /></button>
              <div id="module-sidebar-recent-content" className="module-sidebar__category-content" hidden={!recentSessionsExpanded}>
                {recentSessions.map(session => renderSession(session, "recent"))}
              </div>
            </section> : null}
          </>}
          {!sessionsLoading && !appSessions.length ? <span className="module-sidebar__session-message">还没有会话</span> : null}
        </div>
        <div className="module-sidebar__provider"><Tag color={providerStatus && providerStatus !== "未配置模型" && providerStatus !== "模型状态不可用" ? "green" : "default"}>{providerStatus ?? "正在读取模型…"}</Tag></div>
        </>}
      </section> : null}
      <Modal
        className="module-session-rename-modal"
        title={<div className="module-session-rename-modal__heading"><strong>重命名聊天</strong><span>保持简短且易于识别</span></div>}
        open={renamingSession !== null}
        width="min(560px, calc(100vw - 32px))"
        confirmLoading={renameSessionSaving}
        closable={!renameSessionSaving}
        maskClosable={!renameSessionSaving}
        keyboard={!renameSessionSaving}
        cancelButtonProps={{ disabled: renameSessionSaving }}
        onCancel={closeRenameSession}
        onOk={() => void saveRenameSession()}
      >
        <Input
          autoFocus
          maxLength={160}
          value={renameSessionTitle}
          showCount={{ formatter: ({ value }) => `${[...value].length}/80` }}
          onFocus={event => event.currentTarget.select()}
          onChange={event => {
            const next = [...event.target.value].slice(0, 80).join("");
            setRenameSessionTitle(next);
            if (renameSessionError) setRenameSessionError("");
          }}
          onPressEnter={event => { event.preventDefault(); void saveRenameSession(); }}
          aria-label="聊天标题"
        />
        {renameSessionError ? <Alert className="module-session-rename-modal__error" type="error" showIcon message={renameSessionError} /> : null}
      </Modal>    </>
  );
}
