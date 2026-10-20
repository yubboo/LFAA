import { loadAiSkillDirectory } from "lfaa-client-connection/src/api.js";
/**
 * 文件：ApplicationWorkspace.tsx
 * 功能：装配 SteamCMD、Minecraft、写作应用内部的工作台界面。
 * 作用：连接导航轨、应用侧栏、中心工作区、右侧工具栏和底部终端区域，并提供设置入口、通知卡片与工作区 Chrome 状态。
 * 关联文件：packages/client/ui-layout/src/Workbench.tsx、packages/client/ui-settings/src/SettingsPage.tsx、packages/client/ui-sidebar/src/GlobalNavigationRail.tsx、packages/client/resources/src/notification-runtime.ts、packages/client/store/src/scroll-restoration.ts、packages/client/ui-dockkit/src/ResizableWorkbench.tsx、packages/client/ui-workspace/src/module-workbench.css。
 * 修改注意事项：工作区导航只负责切换界面；用户设置与快捷键保存由设置页面和控制端 API 负责。
 */
import { DshSlotOutlet, loadClientModule } from "lfaa-client-modules/src/client/index.js";
import { sidebarRightRuntime, useSidebarRightSnapshot } from "./sidebar-right-runtime.js";

import { createElement, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Alert, Dropdown, Popover, Tag, Typography } from "antd";
import { archiveAiSession, getErrorMessage, initializeDefaultWorkspace, isDesktopApp, hasAdminAccess, loadAiExtensions, loadAiSessions, loadWorkspaceProjects, loadWritingWorkspace, userRoleLabel, type AiExtension, type AiSession, type ApplicationId, type ApplicationMode, type UserRole, type UserSettings, type WorkspaceDaemonNode, type WorkspaceProject, type WritingWorkspace as WritingWorkspaceData } from "lfaa-client-connection/src/api.js";
import type { AiWorkGoalRequest, AiWorkNotification, AiWorkNotificationInput } from "lfaa-client-resources/src/notification-runtime.js";
import { resolveWorkbenchLayoutMetrics, type WorkbenchLayoutMetrics } from "lfaa-client-ui-dockkit/src/workbench-layout.config.js";
import type { WorkbenchLayoutMode } from "lfaa-client-ui-dockkit/src/workbench-layout.types.js";
import { ResizableWorkbench } from "lfaa-client-ui-dockkit/src/ResizableWorkbench.js";
import { useWorkbenchMetrics } from "lfaa-client-ui-dockkit/src/use-workbench-metrics.js";
import { readWorkbenchLeftWidth, saveWorkbenchLeftWidth } from "lfaa-client-ui-dockkit/src/workbench-preferences.js";
import { createScrollRestorationKey, useScrollRestoration } from "lfaa-client-store/src/scroll-restoration.js";
import { MAX_PINNED_AI_SESSIONS, readPinnedAiSessionIds, writePinnedAiSessionIds } from "lfaa-client-store/src/ai-session-pins.js";
import { ServiceStatus, type ServiceState } from "lfaa-client-ui-primitives/src/ServiceStatus.js";
import { GLOBAL_NAVIGATION_RAIL_COMPACT_WIDTH, GLOBAL_NAVIGATION_RAIL_WIDTH, GlobalNavigationRail, type ApplicationNavigationItem } from "lfaa-client-ui-sidebar/src/GlobalNavigationRail.js";
import { SecondaryNavigation, type SecondaryNavigationGroup } from "lfaa-client-ui-sidebar/src/SecondaryNavigation.js";
import { resolveShortcutSettings } from "lfaa-client-ui-settings-general/src/default-settings.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import { TaskTerminal } from "./TaskTerminal.js";
import "./module-workbench.css";

// 按当前应用模式分别加载业务面板，避免工作台外壳等待无关应用代码。
const AiWorkChat = lazy(() => loadClientModule<typeof import("lfaa-client-ui-chat/src/AiWorkChat.js")>("lfaa-client-ui-chat/src/AiWorkChat.js").then((module) => ({ default: module.AiWorkChat })));
const AiWorkSideChat = lazy(() => loadClientModule<typeof import("lfaa-client-ui-chat/src/AiWorkSideChat.js")>("lfaa-client-ui-chat/src/AiWorkSideChat.js").then((module) => ({ default: module.AiWorkSideChat })));
const GitChangeSummary = lazy(() => import("./GitChangeSummary.js").then((module) => ({ default: module.GitChangeSummary })));
const GitChangeActivityReview = lazy(() => import("./GitChangeSummary.js").then((module) => ({ default: module.GitChangeActivityReview })));
const MinecraftWorkspace = lazy(() => loadClientModule<typeof import("lfaa-client-ui-minecraft/src/MinecraftWorkspace.js")>("lfaa-client-ui-minecraft/src/MinecraftWorkspace.js").then((module) => ({ default: module.MinecraftWorkspace })));
const ConnectivityWorkspace = lazy(() => loadClientModule<typeof import("lfaa-client-ui-connectivity/src/ConnectivityWorkspace.js")>("lfaa-client-ui-connectivity/src/ConnectivityWorkspace.js").then((module) => ({ default: module.ConnectivityWorkspace })));
const WritingBookInfo = lazy(() => loadClientModule<typeof import("lfaa-client-ui-writing/src/normal/WritingBookInfo.js")>("lfaa-client-ui-writing/src/normal/WritingBookInfo.js").then((module) => ({ default: module.WritingBookInfo })));
const WritingWorkspace = lazy(() => loadClientModule<typeof import("lfaa-client-ui-writing/src/normal/WritingWorkspace.js")>("lfaa-client-ui-writing/src/normal/WritingWorkspace.js").then((module) => ({ default: module.WritingWorkspace })));
const AiVideoCanvasWorkspace = lazy(() => import("./AiVideoCanvasWorkspace.js").then((module) => ({ default: module.AiVideoCanvasWorkspace })));

// 占位位于已挂载的主题容器中，沿用外观设置的颜色、字体和减少动态效果偏好。
function ApplicationContentLoading() {
  return (
    <div className="loading-page loading-page--compact" role="status" aria-live="polite">
      <span className="loading-indicator" aria-hidden="true" />
      <span>正在加载工作区内容…</span>
    </div>
  );
}

type ApplicationSummary = {
  id: ApplicationId;
  title: string;
  initials: string;
  color: "blue" | "green" | "plum";
};

interface ApplicationWorkspaceProps {
  userId: string;
  app: ApplicationId;
  mode: ApplicationMode;
  section: string;
  settings: UserSettings;
  onSettingsChange: (settings: UserSettings) => void;
  apps: ApplicationSummary[];
  applicationNavigationItems: ApplicationNavigationItem[];
  username: string;
  role: UserRole;
  serverState: ServiceState;
  error: string | null;
  onNavigate: (path: string) => void;
  onBack: () => void;
  onSelectedModeHome: () => void;
  onOpenSelectedApplication: () => Promise<void>;
  onOpenSettings: (section?: "ai" | "permissions") => void;
  onOpenApplication: (app: ApplicationId, mode: ApplicationMode) => Promise<void>;
  recentSessionsOpenRequestId: number | null;
  onRecentSessionsOpenRequestHandled: (requestId: number) => void;
  rightPanelSection: "context" | "applications";
  onRightPanelSectionChange: (section: "context" | "applications") => void;
  applicationsOpenRequestId: number | null;
  onApplicationsOpenRequestHandled: (requestId: number) => void;
  activeAiSessionId: string | null;
  aiDraft: string;
  aiWorkGoal: AiWorkGoalRequest | null;
  notifications: AiWorkNotification[];
  onNotification: (notification: AiWorkNotificationInput) => void;
  onMarkNotificationsRead: () => void;
  onClearNotifications: () => void;
  onOpenNotification: (notification: AiWorkNotification) => void;
  onActiveAiSessionChange: (sessionId: string | null) => void;
  onAiDraftChange: (draft: string) => void;
  onAiWorkGoalConsumed: (requestId: string) => void;
  onLogout: () => void;
}

interface ChromeState {
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  terminalOpen: boolean;
}

const CHROME_KEY = "lfaa.module-workbench.chrome.v2";
const LEGACY_CHROME_KEY = "lfaa.module-workbench.chrome.v1";
const LAYOUT_KEY = "lfaa.module-workbench.layout.v1";
const aiExtensionSnapshots = new Map<string, AiExtension[]>();
const aiSessionSnapshots = new Map<string, AiSession[]>();
const workspaceProjectSnapshots = new Map<string, { projects: WorkspaceProject[]; nodes: WorkspaceDaemonNode[]; truncated: boolean; defaultProjectId?: string | null }>();
type NavigationLayout = UserSettings["general"]["navigationLayout"];

interface ChromeStorageMetadata {
  hasSavedState: boolean;
  navigationLayout: NavigationLayout | null;
}

function initialMetrics(responsiveRightDock = false): WorkbenchLayoutMetrics {
  if (typeof window === "undefined") return resolveWorkbenchLayoutMetrics(1440 - GLOBAL_NAVIGATION_RAIL_WIDTH, 900, responsiveRightDock);
  const railWidth = window.innerWidth <= 420 ? GLOBAL_NAVIGATION_RAIL_COMPACT_WIDTH : GLOBAL_NAVIGATION_RAIL_WIDTH;
  return resolveWorkbenchLayoutMetrics(window.innerWidth - railWidth, window.innerHeight, responsiveRightDock);
}

function defaultChrome(mode: WorkbenchLayoutMode): ChromeState {
  if (mode === "mobile") return { leftCollapsed: true, rightCollapsed: true, terminalOpen: false };
  if (mode === "compact") return { leftCollapsed: false, rightCollapsed: true, terminalOpen: false };
  return { leftCollapsed: false, rightCollapsed: false, terminalOpen: false };
}

function readChrome(mode: WorkbenchLayoutMode, responsiveRightDock = false): ChromeState {
  if (typeof window === "undefined") return defaultChrome(mode);
  try {
    const current = window.localStorage.getItem(CHROME_KEY);
    const usesPreviousDefaults = current === null;
    const value = JSON.parse(current ?? window.localStorage.getItem(LEGACY_CHROME_KEY) ?? "null") as Partial<ChromeState> | null;
    if (!value) return defaultChrome(mode);
    const stored = {
      leftCollapsed: Boolean(value.leftCollapsed),
      rightCollapsed: usesPreviousDefaults ? true : Boolean(value.rightCollapsed),
      terminalOpen: Boolean(value.terminalOpen),
    };
    if (mode === "mobile") return { ...stored, leftCollapsed: true, rightCollapsed: responsiveRightDock ? stored.rightCollapsed : true, terminalOpen: false };
    if (mode === "compact" && !responsiveRightDock) return { ...stored, rightCollapsed: true };
    return stored;
  } catch {
    return defaultChrome(mode);
  }
}

function readChromeStorageMetadata(): ChromeStorageMetadata {
  if (typeof window === "undefined") return { hasSavedState: false, navigationLayout: null };
  try {
    const current = window.localStorage.getItem(CHROME_KEY);
    const legacy = window.localStorage.getItem(LEGACY_CHROME_KEY);
    const value = JSON.parse(current ?? legacy ?? "null") as { navigationLayout?: unknown } | null;
    const savedLayout = value?.navigationLayout;
    const navigationLayout = savedLayout === "left-two-column"
      || savedLayout === "three-column"
      || savedLayout === "right-tools"
      || savedLayout === "focus"
      ? savedLayout
      : null;
    const hasSavedState = value !== null && typeof value === "object" && (current !== null || legacy !== null);
    return { hasSavedState, navigationLayout };
  } catch {
    return { hasSavedState: false, navigationLayout: null };
  }
}

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (
    target.isContentEditable || Boolean(target.closest("input, textarea, select, [contenteditable='true']"))
  );
}

interface ApplicationSidebarProps extends Pick<ApplicationWorkspaceProps, "userId" | "app" | "mode" | "apps" | "onNavigate" | "onOpenApplication" | "onOpenSelectedApplication"> {
  layoutMode: WorkbenchLayoutMode;
  onToggleLeft: () => void;
  notifications: AiWorkNotification[];
  onMarkNotificationsRead: () => void;
  onClearNotifications: () => void;
  onOpenNotification: (notification: AiWorkNotification) => void;
  sessions: AiSession[];
  aiDraft: string;
  pinnedSessionIds: string[];
  onTogglePinnedSession: (sessionId: string) => void;
  workspaceProjects: WorkspaceProject[];
  projectLoadError: string;
  onRetryProjects: () => void;
  activeSessionId: string | null;
  sessionsLoading: boolean;
  sessionsError: string;
  chatBusy: boolean;
  providerStatus: string | null;
  onNewSession: (projectId?: string) => void;
  onSelectSession: (sessionId: string) => void;
  onArchiveSession: (session: AiSession) => void;
}

function ApplicationSidebar({ userId, app, mode, apps, layoutMode, onNavigate, onOpenApplication, onOpenSelectedApplication, onToggleLeft, notifications, onMarkNotificationsRead, onClearNotifications, onOpenNotification, sessions, aiDraft, pinnedSessionIds, onTogglePinnedSession, workspaceProjects, projectLoadError, onRetryProjects, activeSessionId, sessionsLoading, sessionsError, chatBusy, providerStatus, onNewSession, onSelectSession, onArchiveSession }: ApplicationSidebarProps) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [sessionMenuId, setSessionMenuId] = useState<string | null>(null);
  useEffect(() => { setSessionMenuId(null); }, [layoutMode]);
  useEffect(() => {
    if (!sessionMenuId) return;
    const dismissEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setSessionMenuId(null);
    };
    const dismissOutside = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && (target.closest(".module-session-menu") || target.closest('button[aria-haspopup="menu"]'))) return;
      setSessionMenuId(null);
    };
    window.addEventListener("keydown", dismissEscape, true);
    document.addEventListener("pointerdown", dismissOutside);
    return () => {
      window.removeEventListener("keydown", dismissEscape, true);
      document.removeEventListener("pointerdown", dismissOutside);
    };
  }, [sessionMenuId]);
  const appSessions = sessions.filter((session) => !session.archived);
  const pinnedSessionSet = new Set(pinnedSessionIds);
  const pinnedSessions = appSessions.filter(session => pinnedSessionSet.has(session.id));
  const projectsById = new Map(workspaceProjects.map(project => [project.id, project]));
  const projectGroups = new Map<string, { project: WorkspaceProject | null; title: string; sessions: AiSession[] }>();
  for (const session of appSessions) {
    if (!session.projectId || pinnedSessionSet.has(session.id)) continue;
    const project = projectsById.get(session.projectId) ?? null;
    const group = projectGroups.get(session.projectId) ?? { project, title: project?.title ?? session.projectTitle ?? "已移除项目", sessions: [] };
    group.sessions.push(session);
    projectGroups.set(session.projectId, group);
  }
  const recentSessions = appSessions.filter(session => !session.projectId && !pinnedSessionSet.has(session.id));
  const hasDraft = app === "workspace" && Boolean(aiDraft.trim());
  const sessionsScroll = useScrollRestoration(createScrollRestorationKey(userId, "module-session-list", app), !sessionsLoading);
  const nextMode: ApplicationMode = mode === "normal" ? "ai-work" : "normal";
  const nextModeLabel = nextMode === "normal" ? "应用" : "工作";
  const unreadNotifications = notifications.filter((notification) => !notification.read).length;
  const renderSession = (session: AiSession, nested = false) => {
    const isPinned = pinnedSessionSet.has(session.id);
    const menu = { items: [
      { key: "pin", label: isPinned ? "取消置顶" : "置顶", disabled: chatBusy },
      { key: "archive", label: "归档", icon: <WorkbenchIcon name="archive" size={14} />, disabled: chatBusy },
    ], onClick: ({ key }: { key: string }) => {
      setSessionMenuId(null);
      if (key === "pin") onTogglePinnedSession(session.id);
      if (key === "archive") onArchiveSession(session);
    } };
    return <Dropdown key={session.id} menu={menu} trigger={isDesktopApp() ? ["contextMenu"] : []}
      open={sessionMenuId === session.id} onOpenChange={open => setSessionMenuId(open ? session.id : null)}
      placement="bottomRight" autoAdjustOverflow overlayClassName="module-session-menu"
      getPopupContainer={trigger => trigger.closest<HTMLElement>(".module-workbench-stage") ?? trigger.parentElement!}>
      <div className={`module-sidebar__session${nested ? " module-sidebar__session--nested" : ""}${session.id === activeSessionId ? " is-active" : ""}`}>
        <button type="button" disabled={chatBusy} aria-current={session.id === activeSessionId ? "page" : undefined} onClick={() => { setSessionMenuId(null); onSelectSession(session.id); if (layoutMode === "mobile") onToggleLeft(); }} title={session.title}><WorkbenchIcon name="history" size={14} /><span>{session.title}</span></button>
        <div className="module-sidebar__session-actions">
          <button type="button" disabled={chatBusy} aria-label={`会话菜单：${session.title}`} aria-haspopup="menu" aria-expanded={sessionMenuId === session.id} title="会话菜单" onClick={event => { event.stopPropagation(); setSessionMenuId(current => current === session.id ? null : session.id); }}><WorkbenchIcon name="dots" size={15} /></button>
        </div>
      </div>
    </Dropdown>;
  };

  useEffect(() => {
    if (!notificationsOpen) return;
    const dismissEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNotificationsOpen(false);
    };
    window.addEventListener("keydown", dismissEscape);
    return () => window.removeEventListener("keydown", dismissEscape);
  }, [notificationsOpen]);

  return (
    <div className="module-sidebar" data-ui="left-sidebar" data-layout-mode={layoutMode}>
      <header className="module-sidebar__brand-row">
        <button className="module-sidebar__brand" type="button" onClick={() => { if (mode === "ai-work") void onOpenSelectedApplication(); else void onOpenApplication("workspace", "ai-work"); }} aria-label={app === "workspace" ? "切换到上次使用的应用" : `切换到${nextModeLabel}`} title={app === "workspace" ? "切换到上次使用的应用" : `切换到${nextModeLabel}`}>
          <span className="module-sidebar__brand-mark">L</span><strong>LFAA</strong><WorkbenchIcon name="chevron" size={15} />
        </button>
        <div className="module-sidebar__brand-actions">
          <Popover
            arrow={false}
            content={<section className="module-sidebar__notifications" id="module-sidebar-notifications" role="dialog" aria-labelledby="module-sidebar-notifications-title">
              <header>
                <div><strong id="module-sidebar-notifications-title">通知</strong><span>小鱼会话提醒</span></div>
                <button type="button" disabled={!notifications.length} onClick={onClearNotifications}>清空</button>
              </header>
              {notifications.length ? <div className="module-sidebar__notification-list" aria-live="polite">
                {notifications.map((notification) => <button className={`module-sidebar__notification${notification.read ? " is-read" : ""}`} key={notification.id} type="button" aria-label={`${notification.applicationName}：${notification.title}，点击查看会话`} onClick={() => { setNotificationsOpen(false); onOpenNotification(notification); }}>
                  <span className="module-sidebar__notification-dot" aria-hidden="true" />
                  <div><strong>{notification.applicationName} · {notification.title}</strong><span>{notification.body}</span></div>
                  <time dateTime={new Date(notification.createdAt).toISOString()}>{new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(notification.createdAt)}</time>
                </button>)}
              </div> : <div className="module-sidebar__notification-empty"><WorkbenchIcon name="bell" size={20} /><strong>暂无通知</strong><span>回复完成、审批待处理或会话失败时会显示在这里。</span></div>}
            </section>}
            getPopupContainer={(trigger) => trigger.closest(".workbench-shell") ?? document.body}
            onOpenChange={(open) => {
              if (open) onMarkNotificationsRead();
              setNotificationsOpen(open);
            }}
            open={notificationsOpen}
            overlayClassName="module-sidebar-notification-overlay"
            placement="bottomLeft"
            trigger="click"
          >
            <button className={`module-icon-button module-icon-button--notifications${unreadNotifications ? " has-unread" : ""}`} type="button" aria-label={unreadNotifications ? `通知，${unreadNotifications} 条未读` : "通知"} title="通知" aria-haspopup="dialog" aria-expanded={notificationsOpen} aria-controls="module-sidebar-notifications">
              <WorkbenchIcon name="bell" size={16} />
              {unreadNotifications ? <span className="module-sidebar__notification-badge" aria-hidden="true">{unreadNotifications}</span> : null}
            </button>
          </Popover>
          <button className="module-icon-button module-sidebar__close" type="button" aria-label="收起应用导航" title="收起应用导航" onClick={() => { setNotificationsOpen(false); onToggleLeft(); }}><WorkbenchIcon name="close" size={16} /></button>
        </div>
      </header>
      {mode === "ai-work" ? <section className="module-sidebar__sessions" aria-label={`${apps.find((item) => item.id === app)?.title ?? "当前应用"} 会话`}>
        <div className="module-sidebar__sessions-heading"><span>{apps.find(item => item.id === app)?.title ?? "当前应用"} 项目与会话</span><span className="module-sidebar__sessions-count">{appSessions.length}</span><button type="button" aria-label="新建会话" title="新建会话" disabled={chatBusy} onClick={() => { onNewSession(); if (layoutMode === "mobile") onToggleLeft(); }}><WorkbenchIcon name="plus" size={15} /></button></div>
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
              <div className="module-sidebar__category-heading"><span>置顶</span><small>{pinnedSessions.length}</small></div>
              {pinnedSessions.map(session => renderSession(session))}
              {!pinnedSessions.length ? <span className="module-sidebar__session-message">用星标收纳常用会话</span> : null}
            </section>
            {projectGroups.size ? <section className="module-sidebar__session-category" aria-label="项目会话">
              <div className="module-sidebar__category-heading"><span>项目</span><small>{[...projectGroups.values()].reduce((count, group) => count + group.sessions.length, 0)}</small></div>
              {[...projectGroups.entries()].map(([projectId, group]) => <section className="module-sidebar__project-group" key={projectId}>
                <button className="module-sidebar__project-heading" type="button" disabled={chatBusy || !group.project} title={group.project ? `在 ${group.title} 中新建会话` : `${group.title} 的目录登记已移除，现有会话仍保留原节点目录上下文`} onClick={() => { if (group.project) { onNewSession(group.project.id); if (layoutMode === "mobile") onToggleLeft(); } }}><WorkbenchIcon name="folder" size={14} /><span>{group.title}</span><small>{group.sessions.length}</small></button>
                {group.sessions.map(session => renderSession(session, true))}
              </section>)}
            </section> : null}
            {recentSessions.length ? <section className="module-sidebar__session-category" aria-label="最近会话">
              <div className="module-sidebar__category-heading"><span>最近</span><small>{recentSessions.length}</small></div>
              {recentSessions.map(session => renderSession(session))}
            </section> : null}
          </>}
          {!sessionsLoading && !appSessions.length ? <span className="module-sidebar__session-message">还没有会话</span> : null}
        </div>
        <div className="module-sidebar__provider"><Tag color={providerStatus && providerStatus !== "未配置模型" && providerStatus !== "模型状态不可用" ? "green" : "default"}>{providerStatus ?? "正在读取模型…"}</Tag></div>
      </section> : null}
      <div className="module-sidebar__footer">
        <span>当前区域</span>
        <strong>{mode === "normal" ? "应用面板" : "智能体工作区"}</strong>
      </div>
    </div>
  );
}

interface ApplicationNavigationPanelProps extends Pick<ApplicationWorkspaceProps, "app" | "mode" | "section" | "applicationNavigationItems" | "onNavigate" | "onOpenApplication"> {
  userId: string;
  hidden: boolean;
  onWritingLibraryPortalTargetChange: (target: HTMLDivElement | null) => void;
}

function ApplicationNavigationPanel({ userId, app, mode, section, applicationNavigationItems, hidden, onNavigate, onOpenApplication, onWritingLibraryPortalTargetChange }: ApplicationNavigationPanelProps) {
  const appMenuScroll = useScrollRestoration(createScrollRestorationKey(userId, "module-app-menu", app));
  const minecraftMenuCategory = section === "connectivity" ? "network" : section === "java" ? "environment" : section === "overview" || section === "nodes" ? "monitor" : "management";
  const applicationNavigationGroups = useMemo<SecondaryNavigationGroup[]>(() => [{
    id: "module-context-applications-group",
    label: "应用",
    collapsible: false,
    items: applicationNavigationItems.map((item) => ({
      id: `module-context-application-${item.id}`,
      label: item.title,
      description: item.description,
      icon: item.id === "games" ? "grid"
        : item.id === "steamcmd" ? "terminal"
          : item.id === "minecraft" ? "monitor"
            : item.id === "connectivity" ? "branch"
              : item.id === "writing" ? "book" : "spark",
      trailingIcon: "chevron",
      active: Boolean(item.applicationId && item.applicationId === app),
      onSelect: () => {
        if (item.route) onNavigate(item.route);
        else if (item.applicationId) void onOpenApplication(item.applicationId, "normal").catch(() => undefined);
      },
    })),
  }], [app, applicationNavigationItems, onNavigate, onOpenApplication]);

  return <section className="module-context__applications" id="module-context-applications" aria-label="应用导航" hidden={hidden}>
    <div ref={appMenuScroll.ref} onScroll={appMenuScroll.onScroll} className="module-context__application-menu">
      <header className="module-context__heading"><div><strong>应用</strong><span>切换工作区与应用页面</span></div></header>
      {app === "writing" && mode === "normal" ? <div ref={onWritingLibraryPortalTargetChange} className="module-context__writing-library-portal" /> : null}
      <SecondaryNavigation ariaLabel="应用导航" className="module-context__application-navigation" groups={applicationNavigationGroups} activateOnArrow />
      {app === "minecraft" && mode === "normal" ? <nav className="module-context__app-menu" aria-label="Minecraft 工作区菜单">
        <div className="module-context__section-title"><span>Minecraft 工作区</span></div>
        <div className="module-context__menu-tabs" role="group" aria-label="Minecraft 工作区分类">
          <button type="button" aria-pressed={minecraftMenuCategory === "monitor"} onClick={() => onNavigate("/apps/minecraft/normal/overview")}>监控</button>
          <button type="button" aria-pressed={minecraftMenuCategory === "management"} onClick={() => onNavigate("/apps/minecraft/normal/instances")}>管理</button>
          <button type="button" aria-pressed={minecraftMenuCategory === "environment"} onClick={() => onNavigate("/apps/minecraft/normal/java")}>环境</button>
          <button type="button" aria-pressed={minecraftMenuCategory === "network"} onClick={() => void onOpenApplication("connectivity", "normal")}>联机</button>
        </div>
        {(minecraftMenuCategory === "monitor"
          ? [["overview", "总览"], ["nodes", "控制节点"]]
          : minecraftMenuCategory === "management"
            ? [["deployment", "部署"], ["instances", "实例"], ["tasks", "任务"], ["workflows", "工作流"], ["files", "文件管理"]]
            : minecraftMenuCategory === "network" ? [["connectivity", "LFAA 世界联机"]] : [["java", "Java 环境"]]
        ).map(([key, label]) => <button type="button" key={key} className={`module-context__menu-item${section === key || key === "instances" && section.startsWith("instance/") ? " is-active" : ""}`} aria-current={section === key ? "page" : undefined} onClick={() => key === "connectivity" ? void onOpenApplication("connectivity", "normal") : onNavigate(key === "files" ? "/files" : `/apps/minecraft/normal/${key}`)}><span aria-hidden="true" />{label}</button>)}
        {section.startsWith("instance/") ? <>
          <div className="module-context__section-title module-context__section-title--instance"><span>当前实例</span></div>
          {([[
            "overview", "实例概览"
          ], ["configuration", "服务器配置"], ["logs", "控制台日志"], ["backup", "世界备份"]] as const).map(([view, label]) => <button type="button" key={view} className={`module-context__menu-item module-context__menu-item--nested${section.endsWith(`/${view}`) ? " is-active" : ""}`} aria-current={section.endsWith(`/${view}`) ? "page" : undefined} onClick={() => onNavigate(`/apps/minecraft/normal/${section.replace(/\/(overview|configuration|logs|backup)$/u, "")}/${view}`)}><span aria-hidden="true" />{label}</button>)}
        </> : null}
      </nav> : null}
      {app === "connectivity" && mode === "normal" ? <nav className="module-context__app-menu" aria-label="LFAA 联机服务菜单">
        <div className="module-context__section-title"><span>联机服务</span></div>
        {[["overview", "总览"], ["room-domain", "房间域名"], ["self-managed", "自备穿透"], ["providers", "穿透 Provider"], ["plugins", "组网与扩展"]].map(([key, label]) => <button type="button" key={key} className={`module-context__menu-item${section === key ? " is-active" : ""}`} aria-current={section === key ? "page" : undefined} onClick={() => onNavigate(`/apps/connectivity/normal/${key}`)}><span aria-hidden="true" />{label}</button>)}
      </nav> : null}
    </div>
  </section>;
}

function PanelControl({ name, title, shortcut, active, onClick }: { name: "terminal" | "panelRight"; title: string; shortcut: string; active: boolean; onClick: () => void }) {
  const ariaShortcuts = shortcut.split(" / ").map((chord) => chord.replace("Ctrl", "Control")).join(" ");
  return <button className="module-panel-control" type="button" aria-label={title} aria-keyshortcuts={ariaShortcuts} aria-pressed={active} title={`${title} · ${shortcut || "未分配"}`} onClick={onClick}><WorkbenchIcon name={name} size={16} /><span>{title}</span></button>;
}

export function ApplicationWorkspace({ userId, app, mode, section, apps, applicationNavigationItems, username, role, serverState, error, settings, onSettingsChange, onBack, onSelectedModeHome, onOpenSelectedApplication, onNavigate, onOpenSettings, onOpenApplication, recentSessionsOpenRequestId, onRecentSessionsOpenRequestHandled, rightPanelSection, onRightPanelSectionChange, applicationsOpenRequestId, onApplicationsOpenRequestHandled, activeAiSessionId, aiDraft, aiWorkGoal, notifications, onNotification, onMarkNotificationsRead, onClearNotifications, onOpenNotification, onActiveAiSessionChange, onAiDraftChange, onAiWorkGoalConsumed, onLogout }: ApplicationWorkspaceProps) {
  // 旧版 Host 可能缺少后续新增的快捷键项；由 Settings 默认值补齐，不覆盖已保存的空数组。
  const shortcuts = useMemo(() => resolveShortcutSettings(settings.shortcuts), [settings.shortcuts]);
  const sideChatShortcuts = shortcuts.openSideChat;
  const layoutRef = useRef<HTMLDivElement>(null);
  const previewCloseTimer = useRef<number | null>(null);
  const responsiveAppDock = true;
  const metrics = useWorkbenchMetrics(layoutRef, () => initialMetrics(responsiveAppDock), responsiveAppDock);
  const sidebarRight = useSidebarRightSnapshot();
  const [chrome, setChrome] = useState(() => readChrome(metrics.mode, responsiveAppDock));
  const [chromeStorageMetadata] = useState(readChromeStorageMetadata);
  const [leftPaneWidth, setLeftPaneWidth] = useState(() => readWorkbenchLeftWidth(metrics.left, metrics.containerWidth));
  const [leftPreviewOpen, setLeftPreviewOpen] = useState(false);
  const [registeredExtensions, setRegisteredExtensions] = useState<AiExtension[]>(() => aiExtensionSnapshots.get(userId) ?? []);
  const [skillReferences, setSkillReferences] = useState<Array<{ id: string; name: string; kind: "skill" }>>([]);
  const [skillReferencesError, setSkillReferencesError] = useState("");
  const needsExtensions = mode === "ai-work";
  const [extensionsLoading, setExtensionsLoading] = useState(() => needsExtensions && !aiExtensionSnapshots.has(userId));
  const [aiSessionsState, setAiSessionsState] = useState(() => ({ userId, sessions: aiSessionSnapshots.get(userId) ?? [] }));
  const aiSessions = aiSessionsState.userId === userId ? aiSessionsState.sessions : aiSessionSnapshots.get(userId) ?? [];
  const aiSessionsRequestRef = useRef<{ userId: string; controller: AbortController } | null>(null);
  const [pinnedSessionState, setPinnedSessionState] = useState(() => ({ userId, ids: readPinnedAiSessionIds(userId) }));
  const pinnedSessionIds = pinnedSessionState.userId === userId ? pinnedSessionState.ids : [];
  const [workspaceProjects, setWorkspaceProjects] = useState<WorkspaceProject[]>(() => workspaceProjectSnapshots.get(`${userId}:${app}`)?.projects ?? []);
  const [workspaceNodes, setWorkspaceNodes] = useState<WorkspaceDaemonNode[]>(() => workspaceProjectSnapshots.get(`${userId}:${app}`)?.nodes ?? []);
  const [workspaceProjectsTruncated, setWorkspaceProjectsTruncated] = useState(() => workspaceProjectSnapshots.get(`${userId}:${app}`)?.truncated ?? false);
  const [defaultWorkspaceProjectId, setDefaultWorkspaceProjectId] = useState<string | null>(() => workspaceProjectSnapshots.get(`${userId}:${app}`)?.defaultProjectId ?? null);
  const [workspaceProjectsError, setWorkspaceProjectsError] = useState("");
  const [workspaceProjectsRevision, setWorkspaceProjectsRevision] = useState(0);
  const [aiSessionsLoading, setAiSessionsLoading] = useState(() => mode === "ai-work" && !aiSessionSnapshots.has(userId));
  const [aiSessionsError, setAiSessionsError] = useState("");
  const [aiChatBusy, setAiChatBusy] = useState(false);
  const [sideChatOpen, setSideChatOpen] = useState(false);
  const [sideChatInitialQuestion, setSideChatInitialQuestion] = useState("");
  const [sideChatQuestionRevision, setSideChatQuestionRevision] = useState(0);
  const [gitRefreshRevision, setGitRefreshRevision] = useState(0);
  const [fileReviewRequest, setFileReviewRequest] = useState<{ projectId: string; path: string; requestId: number } | null>(null);
  const [aiProviderStatus, setAiProviderStatus] = useState<string | null>(null);
  const [newAiSessionKey, setNewAiSessionKey] = useState(0);
  const [newAiSessionProjectId, setNewAiSessionProjectId] = useState<string | null>(null);
  const [writingWorkspace, setWritingWorkspace] = useState<WritingWorkspaceData | null>(null);
  const [writingWorkspaceLoading, setWritingWorkspaceLoading] = useState(app === "writing");
  const [writingWorkspaceError, setWritingWorkspaceError] = useState("");
  const [writingLibraryPortalTarget, setWritingLibraryPortalTarget] = useState<HTMLDivElement | null>(null);
  const writingFlushRef = useRef<(() => Promise<void>) | null>(null);
  const [minecraftContentReady, setMinecraftContentReady] = useState(app !== "minecraft");
  const togglePinnedSession = useCallback((sessionId: string) => {
    setPinnedSessionState(current => {
      const ids = current.userId === userId ? current.ids : readPinnedAiSessionIds(userId);
      const nextIds = ids.includes(sessionId)
        ? ids.filter(id => id !== sessionId)
        : [sessionId, ...ids].slice(0, MAX_PINNED_AI_SESSIONS);
      return { userId, ids: nextIds };
    });
  }, [userId]);
  const onAiChatBusyChange = useCallback((busy: boolean) => {
    setAiChatBusy(busy);
    if (!busy) setGitRefreshRevision((revision) => revision + 1);
  }, []);
  const appliedLayoutMode = useRef(metrics.mode);
  const appliedNavigationLayout = useRef<NavigationLayout | null>(chromeStorageMetadata.navigationLayout);
  const activeAiSessionIdRef = useRef(activeAiSessionId);
  activeAiSessionIdRef.current = activeAiSessionId;
  const activeAiSessionChangeRef = useRef(onActiveAiSessionChange);
  activeAiSessionChangeRef.current = onActiveAiSessionChange;
  const updateAiSessions = useCallback((update: (current: AiSession[]) => AiSession[]) => {
    const pendingRequest = aiSessionsRequestRef.current;
    if (pendingRequest) {
      pendingRequest.controller.abort();
      aiSessionsRequestRef.current = null;
    }
    setAiSessionsState((currentState) => {
      const current = currentState.userId === userId ? currentState.sessions : aiSessionSnapshots.get(userId) ?? [];
      const next = update(current);
      aiSessionSnapshots.set(userId, next);
      return { userId, sessions: next };
    });
    setAiSessionsLoading(false);
    setAiSessionsError("");
  }, [userId]);
  const rememberAiSession = useCallback((session: AiSession) => {
    updateAiSessions((current) => [session, ...current.filter((item) => item.id !== session.id)]);
  }, [updateAiSessions]);
  const refreshAiSessions = useCallback(() => {
    if (mode !== "ai-work") return;
    const pendingRequest = aiSessionsRequestRef.current;
    if (pendingRequest?.userId === userId && !pendingRequest.controller.signal.aborted) return;
    pendingRequest?.controller.abort();
    const controller = new AbortController();
    const request = { userId, controller };
    aiSessionsRequestRef.current = request;
    setAiSessionsLoading(true);
    setAiSessionsError("");
    void loadAiSessions({ signal: controller.signal }).then(({ sessions }) => {
      if (controller.signal.aborted || aiSessionsRequestRef.current !== request) return;
      aiSessionSnapshots.set(userId, sessions);
      setAiSessionsState({ userId, sessions });
      const activeSessionId = activeAiSessionIdRef.current;
      if (activeSessionId && !sessions.some((session) => session.id === activeSessionId && !session.archived)) activeAiSessionChangeRef.current(null);
    }).catch((loadError: unknown) => {
      if (!controller.signal.aborted && aiSessionsRequestRef.current === request) setAiSessionsError(getErrorMessage(loadError));
    }).finally(() => {
      if (aiSessionsRequestRef.current === request) {
        aiSessionsRequestRef.current = null;
        setAiSessionsLoading(false);
      }
    });
  }, [mode, userId]);
  const moduleContentScroll = useScrollRestoration(
    mode === "ai-work" ? "" : createScrollRestorationKey(userId, "module-page", app, mode, section),
    minecraftContentReady
  );
  const contextBodyScroll = useScrollRestoration(
    createScrollRestorationKey(userId, "module-context", app, mode),
    !extensionsLoading
  );

  useEffect(() => {
    if (pinnedSessionState.userId !== userId) {
      setPinnedSessionState({ userId, ids: readPinnedAiSessionIds(userId) });
      return;
    }
    writePinnedAiSessionIds(userId, pinnedSessionState.ids);
  }, [pinnedSessionState, userId]);

  const selectedApp = apps.find((item) => item.id === app);
  const modeLabel = mode === "normal" ? "应用" : "工作";
  const writingNormal = app === "writing" && mode === "normal";
  const aiVideoNormal = app === "aivideo" && mode === "normal";
  const terminalPanelAvailable = app !== "writing";
  const activeAiSessionTitle = aiSessions.find((session) => session.id === activeAiSessionId)?.title ?? null;
  const activeAiSession = aiSessions.find((session) => session.id === activeAiSessionId) ?? null;
  const selectedGitProjectId = activeAiSession?.projectId ?? (!activeAiSessionId ? newAiSessionProjectId : null);
  const selectedGitProject = workspaceProjects.find((project) => project.id === selectedGitProjectId) ?? null;
  const fileReviewProject = fileReviewRequest ? workspaceProjects.find(project => project.id === fileReviewRequest.projectId && (app === "workspace" || !project.appId || project.appId === app)) ?? null : null;
  const statusLabel = serverState === "online" ? "控制端已连接" : serverState === "checking" ? "正在检查控制端" : "控制端未连接";
  const contextLabel = writingNormal ? "作品信息" : mode === "ai-work" ? "工具与资源" : "应用工具";

  const registerWritingFlush = useCallback((flush: (() => Promise<void>) | null) => {
    writingFlushRef.current = flush;
  }, []);
  const openProjectFileReview = useCallback((projectId: string, path: string) => {
    if (app !== "workspace" && app !== "minecraft") return;
    const project = workspaceProjects.find(item => item.id === projectId && (app === "workspace" || !item.appId || item.appId === app));
    if (!project || !path) return;
    setFileReviewRequest(current => ({ projectId, path, requestId: (current?.requestId ?? 0) + 1 }));
  }, [app, workspaceProjects]);
  const openApplication = useCallback(async (nextApp: ApplicationId, nextMode: ApplicationMode) => {
    if (app === "writing" && mode === "normal" && writingFlushRef.current) {
      try {
        await writingFlushRef.current();
      } catch {
        // 编辑器已显示保存错误；保留当前模式，避免未保存正文与后续写回并发。
        return;
      }
    }
    await onOpenApplication(nextApp, nextMode);
  }, [app, mode, onOpenApplication]);
  useEffect(() => {
    if (mode !== "ai-work") return;
    const controller = new AbortController();
    setSkillReferencesError("");
    void loadAiSkillDirectory(controller.signal).then(result => { if (!controller.signal.aborted) setSkillReferences(result.skills); })
      .catch(error => { if (!controller.signal.aborted) setSkillReferencesError(getErrorMessage(error)); });
    return () => controller.abort();
  }, [userId, mode, settings.plugins.enabled, settings.plugins.skillDirectories]);
  useEffect(() => {
    if (!needsExtensions) { setExtensionsLoading(false); return; }
    const controller = new AbortController();
    setRegisteredExtensions(aiExtensionSnapshots.get(userId) ?? []);
    setExtensionsLoading(!aiExtensionSnapshots.has(userId));
    void loadAiExtensions(controller.signal).then((result) => {
      if (!controller.signal.aborted) {
        aiExtensionSnapshots.set(userId, result.extensions);
        setRegisteredExtensions(result.extensions);
      }
    }).catch(() => { if (!controller.signal.aborted && !aiExtensionSnapshots.has(userId)) setRegisteredExtensions([]); }).finally(() => { if (!controller.signal.aborted) setExtensionsLoading(false); });
    return () => controller.abort();
  }, [userId, needsExtensions, settings.plugins.enabled]);

  useEffect(() => {
    let alive = true;
    if (app !== "writing") {
      setWritingWorkspace(null);
      setWritingWorkspaceLoading(false);
      setWritingWorkspaceError("");
      return () => { alive = false; };
    }
    setWritingWorkspace(null);
    setWritingWorkspaceLoading(true);
    setWritingWorkspaceError("");
    void loadWritingWorkspace().then((result) => {
      if (alive) setWritingWorkspace(result.workspace);
    }).catch((loadError: unknown) => {
      if (alive) setWritingWorkspaceError(getErrorMessage(loadError));
    }).finally(() => { if (alive) setWritingWorkspaceLoading(false); });
    return () => { alive = false; };
  }, [app, userId]);

  async function retryWritingWorkspace(): Promise<void> {
    setWritingWorkspaceLoading(true);
    setWritingWorkspaceError("");
    try {
      const result = await loadWritingWorkspace();
      setWritingWorkspace(result.workspace);
    } catch (loadError: unknown) {
      setWritingWorkspaceError(getErrorMessage(loadError));
    } finally {
      setWritingWorkspaceLoading(false);
    }
  }

  useEffect(() => {
    setAiProviderStatus(null);
    setAiSessionsError("");
    if (mode !== "ai-work") {
      setAiSessionsLoading(false);
      return;
    }
    const cacheKey = userId;
    const cachedSessions = aiSessionSnapshots.get(cacheKey);
    setAiSessionsState({ userId, sessions: cachedSessions ?? [] });
    setAiSessionsLoading(cachedSessions === undefined);
    refreshAiSessions();
    return () => {
      const pendingRequest = aiSessionsRequestRef.current;
      if (pendingRequest?.userId === userId) {
        pendingRequest.controller.abort();
        aiSessionsRequestRef.current = null;
      }
    };
  }, [mode, refreshAiSessions, userId]);

  useEffect(() => {
    if (app !== "minecraft" && app !== "workspace") {
      setWorkspaceProjects([]);
      setWorkspaceNodes([]);
      setWorkspaceProjectsTruncated(false);
      return;
    }
    const cacheKey = `${userId}:${app}`;
    const cached = workspaceProjectSnapshots.get(cacheKey);
    setWorkspaceProjects(cached?.projects ?? []);
    setWorkspaceNodes(cached?.nodes ?? []);
    setWorkspaceProjectsTruncated(cached?.truncated ?? false);
    setDefaultWorkspaceProjectId(cached?.defaultProjectId ?? null);
    setWorkspaceProjectsError("");
    if (mode !== "ai-work") return;
    const controller = new AbortController();
    setWorkspaceProjectsError("");
    void (async () => {
      let initializationError = "";
      if (app === "workspace") {
        try { await initializeDefaultWorkspace(controller.signal); }
        catch (projectError) {
          if (controller.signal.aborted) return;
          initializationError = `默认工作区初始化失败：${getErrorMessage(projectError)}`;
        }
      }
      try {
        const { projects, nodes, truncated, defaultProjectId } = await loadWorkspaceProjects({ signal: controller.signal });
        if (controller.signal.aborted) return;
        workspaceProjectSnapshots.set(cacheKey, { projects, nodes, truncated, defaultProjectId });
        setWorkspaceProjects(projects);
        setWorkspaceNodes(nodes);
        setWorkspaceProjectsTruncated(truncated);
        setDefaultWorkspaceProjectId(defaultProjectId ?? null);
        setWorkspaceProjectsError(initializationError);
      } catch (projectError) {
        if (!controller.signal.aborted) setWorkspaceProjectsError(initializationError || getErrorMessage(projectError));
      }
    })();
    return () => controller.abort();
  }, [userId, app, mode, workspaceProjectsRevision]);

  const retryWorkspaceProjects = useCallback(() => setWorkspaceProjectsRevision(revision => revision + 1), []);

  useEffect(() => {
    if (appliedLayoutMode.current === metrics.mode) return;
    appliedLayoutMode.current = metrics.mode;
    if (metrics.mode === "mobile") setChrome((current) => ({ ...current, leftCollapsed: true, terminalOpen: false }));
    else if (metrics.mode === "compact" && mode === "ai-work") setChrome(current => current.rightCollapsed ? current : { ...current, leftCollapsed: true });
  }, [metrics.mode, mode]);

  useEffect(() => {
    const previousNavigationLayout = appliedNavigationLayout.current;
    if (previousNavigationLayout === settings.general.navigationLayout) return;
    appliedNavigationLayout.current = settings.general.navigationLayout;
    // 已保存的工作区状态优先于挂载默认值；旧版记录没有布局快照时也保留其开合选择。
    if (previousNavigationLayout === null && chromeStorageMetadata.hasSavedState) return;
    const initialPreference = previousNavigationLayout === null;
    const mobile = metrics.mode === "mobile";
    const hidesLeft = settings.general.navigationLayout === "right-tools" || settings.general.navigationLayout === "focus";
    const hidesRight = settings.general.navigationLayout === "left-two-column" || settings.general.navigationLayout === "focus";
    const keepsThreeColumnDefaultClosed = initialPreference && settings.general.navigationLayout === "three-column";
    setChrome((current) => ({
      ...current,
      leftCollapsed: mobile || hidesLeft,
      rightCollapsed: keepsThreeColumnDefaultClosed ? current.rightCollapsed : hidesRight,
    }));
  }, [chromeStorageMetadata.hasSavedState, metrics.mode, settings.general.navigationLayout]);

  useEffect(() => {
    window.localStorage.setItem(CHROME_KEY, JSON.stringify({ ...chrome, navigationLayout: settings.general.navigationLayout }));
  }, [chrome, settings.general.navigationLayout]);

  useEffect(() => {
    saveWorkbenchLeftWidth(leftPaneWidth, metrics.left);
  }, [leftPaneWidth, metrics.left.max, metrics.left.min]);

  useEffect(() => () => {
    if (previewCloseTimer.current !== null) window.clearTimeout(previewCloseTimer.current);
  }, []);

  const toggleLeft = useCallback(() => setChrome((current) => ({
    ...current,
    leftCollapsed: !current.leftCollapsed,
    ...(metrics.mode !== "desktop" && current.leftCollapsed ? { rightCollapsed: true } : {}),
  })), [metrics.mode]);
  const showRightPanelSection = useCallback((nextSection: "context" | "applications") => {
    onRightPanelSectionChange(nextSection);
    sidebarRightRuntime.select(null);
    setChrome((current) => ({
      ...current,
      rightCollapsed: false,
      ...(metrics.mode !== "desktop" ? { leftCollapsed: true } : {}),
    }));
  }, [metrics.mode, onRightPanelSectionChange]);
  const toggleApplicationsPanel = useCallback(() => {
    if (rightPanelSection === "applications" && !chrome.rightCollapsed) {
      setChrome((current) => ({ ...current, rightCollapsed: true }));
      return;
    }
    showRightPanelSection("applications");
  }, [chrome.rightCollapsed, rightPanelSection, showRightPanelSection]);
  const openToolsPanel = useCallback(() => {
    if (rightPanelSection === "context" && !chrome.rightCollapsed) {
      setChrome((current) => ({ ...current, rightCollapsed: true }));
      return;
    }
    showRightPanelSection("context");
  }, [chrome.rightCollapsed, rightPanelSection, showRightPanelSection]);
  const showRecentSessions = useCallback(() => {
    setChrome((current) => ({
      ...current,
      leftCollapsed: false,
      ...(metrics.mode !== "desktop" ? { rightCollapsed: true } : {}),
    }));
    if (mode === "ai-work") refreshAiSessions();
    else void openApplication("workspace", "ai-work").catch(() => undefined);
  }, [metrics.mode, mode, openApplication, refreshAiSessions]);
  useEffect(() => {
    if (mode !== "ai-work" || recentSessionsOpenRequestId === null) return;
    showRecentSessions();
    onRecentSessionsOpenRequestHandled(recentSessionsOpenRequestId);
  }, [mode, onRecentSessionsOpenRequestHandled, recentSessionsOpenRequestId, showRecentSessions]);
  useEffect(() => {
    if (applicationsOpenRequestId === null) return;
    showRightPanelSection("applications");
    onApplicationsOpenRequestHandled(applicationsOpenRequestId);
  }, [applicationsOpenRequestId, onApplicationsOpenRequestHandled, showRightPanelSection]);
  const toggleRight = useCallback(() => {
    if (chrome.rightCollapsed) {
      showRightPanelSection("context");
      return;
    }
    setChrome((current) => ({ ...current, rightCollapsed: true }));
  }, [chrome.rightCollapsed, showRightPanelSection]);
  const openSideChat = useCallback((initialQuestion = "") => {
    onRightPanelSectionChange("context");
    sidebarRightRuntime.select(null);
    setSideChatOpen(true);
    setSideChatInitialQuestion(initialQuestion);
    setSideChatQuestionRevision((revision) => revision + 1);
    setChrome((current) => ({ ...current, rightCollapsed: false, ...(metrics.mode === "mobile" ? { leftCollapsed: true } : {}) }));
  }, [metrics.mode, onRightPanelSectionChange]);
  const closeSideChat = useCallback(() => setSideChatOpen(false), []);
  const toggleSideChat = useCallback(() => {
    if (sideChatOpen) closeSideChat();
    else openSideChat();
  }, [closeSideChat, openSideChat, sideChatOpen]);
  useEffect(() => sidebarRightRuntime.bindExpansion(() => !chrome.rightCollapsed, toggleRight), [chrome.rightCollapsed, toggleRight]);
  const toggleTerminal = useCallback(() => {
    if (settings.general.terminalPosition === "right") showRightPanelSection("context");
    setChrome((current) => ({ ...current, terminalOpen: !current.terminalOpen, ...(settings.general.terminalPosition === "right" ? { rightCollapsed: false } : {}) }));
  }, [settings.general.terminalPosition, showRightPanelSection]);
  const openTerminal = useCallback(() => {
    if (settings.general.terminalPosition === "right") showRightPanelSection("context");
    setChrome((current) => ({ ...current, terminalOpen: true, ...(settings.general.terminalPosition === "right" ? { rightCollapsed: false } : {}) }));
  }, [settings.general.terminalPosition, showRightPanelSection]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.isComposing) return;
      const key = event.key.toLocaleLowerCase();
      const matches = (chord: string) => {
        const parts = chord.split("+").map((part) => part.toLocaleLowerCase());
        const targetKey = parts.at(-1) ?? "";
        return key === targetKey
          && Boolean(event.ctrlKey || event.metaKey) === parts.includes("ctrl")
          && Boolean(event.altKey) === parts.includes("alt")
          && Boolean(event.shiftKey) === parts.includes("shift");
      };
      const region = isEditableTarget(event.target) ? "editable" : "page";
      if (shortcuts.wallpaperSidebarToggle.some((chord) => chord && matches(chord))
        && sidebarRightRuntime.runShortcut(event, region)) {
        event.preventDefault();
        return;
      }
      if (mode === "ai-work" && sideChatShortcuts.some((chord) => chord && matches(chord))) {
        event.preventDefault();
        toggleSideChat();
        return;
      }
      if (region === "editable") return;
      const actionGroups: Array<[string[], () => void]> = [
        [shortcuts.toggleContextPanel, toggleRight],
        [shortcuts.toggleSidebar, toggleLeft],
        [terminalPanelAvailable ? shortcuts.toggleBottomPanel : [], toggleTerminal],
        [terminalPanelAvailable ? shortcuts.openTerminal : [], openTerminal],
        [shortcuts.switchNormalMode, onBack],
        [shortcuts.switchAiWorkMode, () => { void openApplication(app, "ai-work"); }]
      ];
      const actions = actionGroups.flatMap(([chords, action]) => chords.filter(Boolean).map((chord) => [chord, action] as [string, () => void]));
      const action = actions.find(([chord]) => matches(chord));
      if (action) {
        event.preventDefault();
        action[1]();
        return;
      }
      if (event.key === "Escape" && metrics.mode === "mobile") {
        setChrome((current) => ({ ...current, leftCollapsed: true, rightCollapsed: true }));
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [app, metrics.mode, mode, openApplication, openTerminal, shortcuts, sideChatShortcuts, toggleLeft, toggleRight, toggleSideChat, toggleTerminal]);

  const clearPreviewClose = useCallback(() => {
    if (previewCloseTimer.current !== null) {
      window.clearTimeout(previewCloseTimer.current);
      previewCloseTimer.current = null;
    }
  }, []);
  const openLeftPreview = useCallback(() => {
    if (!chrome.leftCollapsed || metrics.mode === "mobile") return;
    clearPreviewClose();
    setLeftPreviewOpen(true);
  }, [chrome.leftCollapsed, clearPreviewClose, metrics.mode]);
  const closeLeftPreview = useCallback(() => {
    clearPreviewClose();
    if (!chrome.leftCollapsed || metrics.mode === "mobile") {
      setLeftPreviewOpen(false);
      return;
    }
    previewCloseTimer.current = window.setTimeout(() => {
      previewCloseTimer.current = null;
      setLeftPreviewOpen(false);
    }, 160);
  }, [chrome.leftCollapsed, clearPreviewClose, metrics.mode]);

  useEffect(() => {
    if (!chrome.leftCollapsed || metrics.mode === "mobile") {
      clearPreviewClose();
      setLeftPreviewOpen(false);
    }
  }, [chrome.leftCollapsed, clearPreviewClose, metrics.mode]);

  if (!selectedApp) return null;

  const openSidebarMode = async (nextApp: ApplicationId, nextMode: ApplicationMode) => {
    await openApplication(nextApp, nextMode);
    if (metrics.mode === "mobile") setChrome((current) => ({ ...current, leftCollapsed: true }));
  };
  const navigateWithinApplication = useCallback((path: string) => {
    onNavigate(path);
    if (metrics.mode === "mobile") setChrome((current) => ({ ...current, leftCollapsed: true }));
  }, [metrics.mode, onNavigate]);
  const startNewAiSession = (projectId?: string) => {
    onActiveAiSessionChange(null);
    setNewAiSessionProjectId(projectId ?? defaultWorkspaceProjectId);
    setNewAiSessionKey((current) => current + 1);
    setAiSessionsError("");
  };
  const archiveAiWorkSession = async (session: AiSession) => {
    try {
      await archiveAiSession(session.id, true);
      updateAiSessions((current) => current.filter((item) => item.id !== session.id));
      if (activeAiSessionId === session.id) onActiveAiSessionChange(null);
    } catch (archiveError: unknown) {
      setAiSessionsError(getErrorMessage(archiveError));
    }
  };
  const sidebarProps: ApplicationSidebarProps = {
    userId,
    app,
    mode,
    apps,
    onOpenSelectedApplication,
    layoutMode: metrics.mode,
    onNavigate: navigateWithinApplication,
    onOpenApplication: openSidebarMode,
    onToggleLeft: toggleLeft,
    notifications,
    onMarkNotificationsRead,
    onClearNotifications,
    onOpenNotification,
    sessions: aiSessions,
    aiDraft,
    pinnedSessionIds,
    onTogglePinnedSession: togglePinnedSession,
    workspaceProjects,
    projectLoadError: workspaceProjectsError,
    onRetryProjects: retryWorkspaceProjects,
    activeSessionId: activeAiSessionId,
    sessionsLoading: aiSessionsLoading,
    sessionsError: aiSessionsError,
    chatBusy: aiChatBusy,
    providerStatus: aiProviderStatus,
    onNewSession: startNewAiSession,
    onSelectSession: (sessionId) => { onActiveAiSessionChange(sessionId); setNewAiSessionProjectId(null); setAiSessionsError(""); },
    onArchiveSession: (session) => { void archiveAiWorkSession(session); },
  };
  const left = <ApplicationSidebar {...sidebarProps} />;
  const leftPreview = <ApplicationSidebar {...sidebarProps} />;
  const center = (
    <div className="module-center">
      <header className="module-center__header" data-layout-mode={metrics.mode}>
        <div className="module-center__heading">
          <button className="module-shell-icon-button" type="button" aria-label="切换会话与项目栏" aria-expanded={!chrome.leftCollapsed} aria-keyshortcuts={shortcuts.toggleSidebar.map((chord) => chord.replace("Ctrl", "Control")).join(" ")} title={`切换会话与项目栏 · ${shortcuts.toggleSidebar.join(" / ") || "未分配"}`} onClick={toggleLeft} onMouseEnter={openLeftPreview} onMouseLeave={closeLeftPreview} onFocus={openLeftPreview} onBlur={closeLeftPreview}><WorkbenchIcon name="panelLeft" size={16} /></button>
          <div className="module-center__title"><WorkbenchIcon name={mode === "normal" ? "folder" : "spark"} size={16} /><strong>{mode === "ai-work" ? "小鱼智能体" : selectedApp.title}</strong></div>
        </div>
        <div className="module-center__actions">
          {settings.general.showServiceStatus ? <span className={`module-runtime-state${serverState === "online" ? " is-connected" : ""}`}><i aria-hidden="true" />{statusLabel}</span> : null}
          {terminalPanelAvailable && settings.general.showBottomPanelControl && (chrome.rightCollapsed || metrics.mode !== "desktop") ? <PanelControl name="terminal" title="底部终端" shortcut={shortcuts.toggleBottomPanel.join(" / ")} active={chrome.terminalOpen} onClick={toggleTerminal} /> : null}
          {(chrome.rightCollapsed || metrics.mode !== "desktop") ? <PanelControl name="panelRight" title="上下文栏" shortcut={shortcuts.toggleContextPanel.join(" / ")} active={!chrome.rightCollapsed} onClick={toggleRight} /> : null}
        </div>
      </header>
      <main ref={moduleContentScroll.ref} onScroll={moduleContentScroll.onScroll} className={`module-center__content${mode === "ai-work" ? " module-center__content--ai-work" : ""}${writingNormal ? " module-center__content--writing-normal" : ""}${aiVideoNormal ? " module-center__content--aivideo" : ""}`} aria-label={mode === "ai-work" ? "小鱼智能体对话" : writingNormal ? "写作正文编辑区" : aiVideoNormal ? "AI 漫剧分镜画布" : undefined} aria-labelledby={mode === "normal" && app !== "minecraft" && !writingNormal && !aiVideoNormal ? "module-heading" : undefined}>
        {mode === "ai-work" ? <>
          {error ? <Alert className="page-alert" type="error" showIcon message={error} /> : null}
          <Suspense fallback={<ApplicationContentLoading />}>
            <AiWorkChat
              userId={userId}
              capabilities={[
                ...registeredExtensions.filter(item => ["skill", "prompt", "expert"].includes(item.kind)
                  && (item.kind !== "skill" || !settings.plugins.disabledSkillNames.includes(item.id.startsWith("skill.") ? item.id.slice("skill.".length).split(".").at(-1) ?? item.id : item.id))),
                ...skillReferences.filter(skill => !settings.plugins.disabledSkillNames.includes(skill.name))
              ]}
              capabilitiesError={skillReferencesError}
              appId={activeAiSession?.appId ?? "workspace"}
              settings={settings}
              onSettingsChange={onSettingsChange}
              sessions={aiSessions}
              activeSessionId={activeAiSessionId}
              newSessionProjectId={newAiSessionProjectId}
              defaultWorkspaceProjectId={defaultWorkspaceProjectId}
              workspaceProjects={workspaceProjects}
              workspaceProjectsTruncated={workspaceProjectsTruncated}
              workspaceNodes={workspaceNodes}
              workspaceProjectsError={workspaceProjectsError}
              onRetryWorkspaceProjects={retryWorkspaceProjects}
              onWorkspaceProjectsChange={(projects) => {
                const truncated = workspaceProjectsTruncated || projects.length > 200;
                workspaceProjectSnapshots.set(`${userId}:${app}`, { projects: projects.slice(0, 200), nodes: workspaceNodes, truncated, defaultProjectId: defaultWorkspaceProjectId });
                setWorkspaceProjects(projects.slice(0, 200));
                setWorkspaceProjectsTruncated(truncated);
              }}
              initialDraft={aiDraft}
              autoSubmitGoal={aiWorkGoal}
              onAutoSubmitGoalConsumed={onAiWorkGoalConsumed}
              newSessionKey={newAiSessionKey}
              onSessionsChange={(sessions) => {
                updateAiSessions(() => sessions);
              }}
              onActiveSessionChange={onActiveAiSessionChange}
              onDraftChange={onAiDraftChange}
              onProviderStatusChange={setAiProviderStatus}
              onBusyChange={onAiChatBusyChange}
              onSelectedProjectChange={setNewAiSessionProjectId}
              onOpenSettings={onOpenSettings}
              onNotification={onNotification}
              onOpenSideChat={openSideChat}
              onWritingWorkspaceChange={setWritingWorkspace}
              onOpenProjectFileReview={openProjectFileReview}
            />
          </Suspense>
        </> : app === "minecraft" ? <Suspense fallback={<ApplicationContentLoading />}><MinecraftWorkspace onPrepareWithAi={prompt=>{onAiDraftChange(aiDraft.trim()?`${aiDraft}\n\n${prompt}`:prompt);void openApplication("workspace", "ai-work");}} userId={userId} section={section} role={role} settings={settings} onNavigate={navigateWithinApplication} onOpenConnectivity={() => { void openApplication("connectivity", "normal"); }} onContentReady={setMinecraftContentReady} /></Suspense> : app === "connectivity" && mode === "normal" ? <Suspense fallback={<ApplicationContentLoading />}><ConnectivityWorkspace section={section} isAdmin={hasAdminAccess(role)} /></Suspense> : writingNormal ? <Suspense fallback={<ApplicationContentLoading />}><WritingWorkspace workspace={writingWorkspace} loading={writingWorkspaceLoading} loadError={writingWorkspaceError} libraryPortalTarget={writingLibraryPortalTarget} onRetry={() => { void retryWritingWorkspace(); }} onWorkspaceChange={setWritingWorkspace} onRegisterFlush={registerWritingFlush} /></Suspense> : aiVideoNormal ? <Suspense fallback={<ApplicationContentLoading />}><AiVideoCanvasWorkspace /></Suspense> : <>
          <div className={`module-heading module-heading--workspace module-heading--${app}`}>
            <div className="module-heading__labels"><Tag className="development-tag">开发中</Tag><Tag className="module-mode-tag">{modeLabel}</Tag></div>
            <Typography.Title id="module-heading" level={2}>{selectedApp.title}</Typography.Title>
            <Typography.Paragraph>{modeLabel} · 应用工作区</Typography.Paragraph>
          </div>
          {error ? <Alert className="page-alert" type="error" showIcon message={error} /> : null}
          <section className="module-notice-card" aria-label="模块状态">
            <span className="module-notice-card__icon" aria-hidden="true"><WorkbenchIcon name="spark" size={19} /></span>
            <div><Typography.Title level={4}>这个入口尚未连接业务能力</Typography.Title><Typography.Paragraph>常规模式的游戏安装、主机文件操作和作品存储需要对应业务模块与 Daemon 节点；小鱼智能体 对话已接入独立的模型 Runtime。</Typography.Paragraph></div>
          </section>
          <div className="module-content-placeholder"><span className="module-content-placeholder__dot" aria-hidden="true" /><span>业务面板接入后会显示在这里。</span></div>
        </>}
      </main>
    </div>
  );

  const right = (
    <aside className="module-context" aria-label={contextLabel} data-layout-mode={metrics.mode}>
      {metrics.mode === "desktop" && !chrome.rightCollapsed ? <header className="module-context__shell-actions">
          {terminalPanelAvailable && settings.general.showBottomPanelControl ? <PanelControl name="terminal" title="底部终端" shortcut={shortcuts.toggleBottomPanel.join(" / ")} active={chrome.terminalOpen} onClick={toggleTerminal} /> : null}
          <PanelControl name="panelRight" title="收起上下文栏" shortcut={shortcuts.toggleContextPanel.join(" / ")} active onClick={toggleRight} />
      </header> : null}
      <div ref={contextBodyScroll.ref} onScroll={contextBodyScroll.onScroll} className="module-context__body">
      {mode === "ai-work" ? <div className="module-context__side-chat" hidden={!sideChatOpen}>
        <Suspense fallback={<ApplicationContentLoading />}><AiWorkSideChat
          key={activeAiSessionId ?? "no-session"}
          appId={app}
          sourceSessionId={activeAiSessionId}
          sourceSessionTitle={activeAiSessionTitle}
          open={sideChatOpen}
          initialQuestion={sideChatInitialQuestion}
          initialQuestionRevision={sideChatQuestionRevision}
          onClose={closeSideChat}
          onSessionCreated={rememberAiSession}
        /></Suspense>
      </div> : null}
      <div className="module-context__default-content" hidden={mode === "ai-work" && sideChatOpen}>
      {terminalPanelAvailable && chrome.terminalOpen && settings.general.terminalPosition === "right" ? <div style={{ height: metrics.bottom.initial }}><TaskTerminal appId={app} settings={settings} sessionId={activeAiSessionId} role={role} onClose={toggleTerminal} /></div> : null}
      <nav className="module-context__tabs" aria-label="右侧菜单">
        <button type="button" className={sidebarRight.activeId === null && rightPanelSection === "context" ? "is-active" : ""} aria-pressed={sidebarRight.activeId === null && rightPanelSection === "context"} onClick={() => showRightPanelSection("context")}>{contextLabel}</button>
        <button type="button" className={sidebarRight.activeId === null && rightPanelSection === "applications" ? "is-active" : ""} aria-pressed={sidebarRight.activeId === null && rightPanelSection === "applications"} aria-controls="module-context-applications" onClick={() => showRightPanelSection("applications")}>应用</button>
        {sidebarRight.tabs.flatMap((tab) => {
          const guideItems = [...(tab.guide ?? [])].sort((first, second) => first.order - second.order);
          if (guideItems.length === 0) {
            return [<button key={tab.id} type="button" className={sidebarRight.activeId === tab.id ? "is-active" : ""} aria-pressed={sidebarRight.activeId === tab.id} onClick={() => { onRightPanelSectionChange("context"); sidebarRightRuntime.control.openTab(tab.kind); }}>{typeof tab.title === "function" ? tab.title() : tab.title}</button>];
          }
          return guideItems.map((guide) => {
            const title = typeof guide.title === "function" ? guide.title() : guide.title;
            const description = typeof guide.description === "function" ? guide.description() : guide.description;
            return <button key={`${tab.id}:${guide.id}`} type="button" className={`module-context__tab-guide${sidebarRight.activeId === tab.id ? " is-active" : ""}`} aria-label={title} aria-pressed={sidebarRight.activeId === tab.id} title={description ? `${title} — ${description}` : title} onClick={() => { onRightPanelSectionChange("context"); sidebarRightRuntime.control.openTab(tab.kind); }}>
              {guide.icon ? createElement(guide.icon, { size: 16, className: "module-context__tab-guide-icon" }) : title}
            </button>;
          });
        })}
      </nav>
      {sidebarRight.tabs.map((tab) => tab.keepMounted || sidebarRight.activeId === tab.id ? <div key={tab.id} className="module-context__tab-panel" hidden={sidebarRight.activeId !== tab.id} aria-hidden={sidebarRight.activeId !== tab.id}>{createElement(DshSlotOutlet, { name: "sidebar.right.pane.tab", entryKey: tab.id, fallback: <Alert type="warning" showIcon message="扩展面板尚未加载内容" description="此入口已登记，但当前没有 DSH Client 内容提供面板。请检查当前 Profile 的插件状态及 Client 入口加载错误。" /> })}</div> : null)}
      <ApplicationNavigationPanel userId={userId} app={app} mode={mode} section={section} applicationNavigationItems={applicationNavigationItems} onNavigate={navigateWithinApplication} onOpenApplication={openSidebarMode} onWritingLibraryPortalTargetChange={setWritingLibraryPortalTarget} hidden={rightPanelSection !== "applications" || sidebarRight.activeId !== null} />
      {sidebarRight.activeId === null && rightPanelSection === "context" ? writingNormal ? <Suspense fallback={<ApplicationContentLoading />}><WritingBookInfo
        workspace={writingWorkspace}
        workspaceLoading={writingWorkspaceLoading}
        onWorkspaceChange={setWritingWorkspace}
        onClose={toggleRight}
      /></Suspense> : <>
      <header className="module-context__heading"><div><strong>{contextLabel}</strong><span>{mode === "ai-work" ? "当前可用能力" : "手动操作与管理"}</span></div><span className={`module-context__connection module-context__connection--${serverState}`}><i aria-hidden="true" />{serverState === "online" ? "已连接" : serverState === "checking" ? "检查中" : "未连接"}</span><button className="module-shell-icon-button module-context__close" type="button" aria-label={`收起${contextLabel}`} title={`收起${contextLabel}`} onClick={toggleRight}><WorkbenchIcon name="close" size={15} /></button></header>
        {(app === "workspace" || app === "minecraft") && mode === "ai-work" ? <Suspense fallback={<div className="module-context__git-loading"><span>正在准备 Git 摘要…</span></div>}><GitChangeSummary appId={selectedGitProject?.appId ?? "workspace"} project={selectedGitProject} refreshRevision={gitRefreshRevision} /></Suspense> : null}
        <div className="module-context__tools">
          {terminalPanelAvailable && settings.general.showBottomPanelControl ? <button type="button" onClick={openTerminal} aria-keyshortcuts={shortcuts.openTerminal.map((chord) => chord.replace("Ctrl", "Control")).join(" ")}><WorkbenchIcon name="terminal" size={16} /><span>终端</span><kbd>{shortcuts.openTerminal.join(" / ") || "未分配"}</kbd></button> : null}
          {mode === "ai-work" ? <button type="button" className="module-context__side-chat-action" onClick={() => openSideChat()} title="主聊天任务会继续运行；侧聊使用已记录的上下文快照。" aria-keyshortcuts={sideChatShortcuts.map((chord) => chord.replace("Ctrl", "Control")).join(" ")}><WorkbenchIcon name="help" size={16} /><span>侧边聊天</span><kbd>{sideChatShortcuts.join(" / ") || "未分配"}</kbd></button> : null}
          {mode === "ai-work" ? <><button type="button" disabled title="当前 Web Host 尚未接入审查工具"><WorkbenchIcon name="review" size={16} /><span>审查</span><kbd>待接入</kbd></button>
          <button type="button" disabled title="当前 Web Host 尚未接入浏览器工具"><WorkbenchIcon name="browser" size={16} /><span>浏览器</span><kbd>待接入</kbd></button></> : null}
          <button type="button" onClick={() => onNavigate("/files")} title="打开已接入的节点文件管理"><WorkbenchIcon name="file" size={16} /><span>节点文件</span></button>
        </div>
        {mode === "ai-work" ? <section className="module-context__section module-context__resources"><header><span>能力资源</span><b>{registeredExtensions.length}</b></header>
          {(["skill", "expert", "prompt", "tool"] as const).map((kind) => {
            const resources = registeredExtensions.filter((extension) => extension.kind === kind && (!extension.applicationIds || extension.applicationIds.includes(app)));
            const groupName = kind === "skill" ? "Skills" : kind === "expert" ? "Experts" : kind === "prompt" ? "Prompts" : "Tools";
            return <section className="module-context__resource-group" key={kind}><header><span>{groupName}</span><b>{resources.length}</b></header>{resources.length ? resources.map((item) => <p title={item.description} key={item.id}>{item.name}</p>) : <p>暂无登记资源</p>}</section>;
          })}
        </section> : null}
        <section className="module-context__section">
          <header><span>当前应用</span><b>1</b></header>
          <div className="module-context__app">
            <span className={`application-monogram application-monogram--${selectedApp.color}`} aria-hidden="true">{selectedApp.initials}</span>
            <div><strong>{selectedApp.title}</strong><small>{modeLabel}</small></div>
          </div>
        </section>
        <section className="module-context__section"><header><span>服务状态</span></header><div className="module-context__service"><ServiceStatus state={serverState} /><small>控制端健康状态</small></div></section>
        <section className="module-context__note"><strong>{mode === "ai-work" ? "工作区能力" : "应用面板"}</strong><p>{mode === "ai-work" ? "工具与资源会在当前宿主接入后显示。尚未连接的入口保持禁用状态。" : "在这里查看和操作应用数据；需要智能体协助时，从左侧导航进入小鱼智能体。"}</p></section>
      </> : null}
        <div className="module-context__account"><WorkbenchIcon name="user" size={15} /><span>{username}</span><small>{userRoleLabel(role)}</small></div>
      </div>
      </div>
    </aside>
  );

  const bottom = terminalPanelAvailable ? <TaskTerminal appId={app} settings={settings} sessionId={activeAiSessionId} role={role} onClose={toggleTerminal} /> : null;

  const previewStyle = { "--module-left-preview-width": `${leftPaneWidth}px` } as CSSProperties;
  return (
    <div className="module-workbench-stage" style={previewStyle} data-layout-mode={metrics.mode}>
      <GlobalNavigationRail username={username} role={role} serverState={serverState} shortcuts={shortcuts} activePage="home" homeLabel="返回当前模式首页" applications={applicationNavigationItems} onOpenRecentSessions={showRecentSessions} showServiceStatus={settings.general.showServiceStatus} onHome={onSelectedModeHome} onNavigate={onNavigate} onOpenApplication={openApplication} onOpenWork={() => void openApplication("workspace", "ai-work")} onOpenFiles={() => onNavigate("/files")} onOpenSettings={onOpenSettings} onLogout={onLogout} onToggleTools={openToolsPanel} applicationsExpanded={rightPanelSection === "applications" && !chrome.rightCollapsed} applicationsTargetId="module-context-applications" onToggleApplications={toggleApplicationsPanel} />
      <div ref={layoutRef} className="module-workbench-layout" data-layout-mode={metrics.mode}>
        {chrome.leftCollapsed && metrics.mode !== "mobile" ? <div className={`module-left-preview${leftPreviewOpen ? " is-visible" : ""}`} data-layout-mode={metrics.mode} aria-hidden={!leftPreviewOpen} onMouseEnter={openLeftPreview} onMouseLeave={closeLeftPreview}>{leftPreview}</div> : null}
        <ResizableWorkbench
          left={left}
          center={center}
          right={right}
          bottom={terminalPanelAvailable && chrome.terminalOpen && settings.general.terminalPosition === "bottom" ? bottom : null}
          storageKey={LAYOUT_KEY}
          leftLimits={metrics.left}
          rightLimits={metrics.right}
          bottomLimits={metrics.bottom}
          containerWidth={metrics.containerWidth}
          snapCaptureRatio={metrics.snapCaptureRatio}
          snapHysteresis={metrics.snapHysteresis}
          minCenterWidth={metrics.minCenterWidth}
          layoutMode={metrics.mode}
          responsiveRightDock
          responsiveLeftDock
          leftWidth={leftPaneWidth}
          onLeftWidthChange={setLeftPaneWidth}
          leftCollapsed={chrome.leftCollapsed}
          onLeftCollapsedChange={(leftCollapsed) => setChrome((current) => ({ ...current, leftCollapsed }))}
          rightCollapsed={chrome.rightCollapsed}
          onRightCollapsedChange={(rightCollapsed) => setChrome((current) => ({ ...current, rightCollapsed }))}
          bottomOpen={terminalPanelAvailable && chrome.terminalOpen && settings.general.terminalPosition === "bottom"}
          onBottomOpenChange={(terminalOpen) => setChrome((current) => ({ ...current, terminalOpen }))}
        />
      </div>
      {fileReviewRequest && fileReviewProject && (app === "workspace" || app === "minecraft") ? <Suspense fallback={null}><GitChangeActivityReview
        key={`${fileReviewRequest.projectId}:${fileReviewRequest.path}:${fileReviewRequest.requestId}`}
        appId={app}
        project={fileReviewProject}
        path={fileReviewRequest.path}
        requestId={fileReviewRequest.requestId}
        onClose={() => setFileReviewRequest(null)}
        onRefresh={() => setGitRefreshRevision(revision => revision + 1)}
      /></Suspense> : null}
    </div>
  );
}
