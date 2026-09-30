/**
 * 文件：ApplicationWorkspace.tsx
 * 功能：装配 SteamCMD、Minecraft、写作应用内部的工作台界面。
 * 作用：连接导航轨、应用侧栏、中心工作区、右侧工具栏和底部终端区域，并提供设置入口、通知卡片与窗格交换偏好。
 * 关联文件：packages/client/ui-layout/src/Workbench.tsx、packages/client/ui-settings/src/SettingsPage.tsx、packages/client/ui-sidebar/src/GlobalNavigationRail.tsx、packages/client/resources/src/notification-runtime.ts、packages/client/store/src/scroll-restoration.ts、packages/client/ui-dockkit/src/ResizableWorkbench.tsx、packages/client/ui-workspace/src/module-workbench.css。
 * 修改注意事项：工作区导航只负责切换界面；用户设置与快捷键保存由设置页面和控制端 API 负责。
 */
import { loadClientModule } from "lfaa-client-modules/src/client/index.js";

import { lazy, Suspense, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Alert, Popover, Tag, Typography } from "antd";
import { archiveAiSession, getErrorMessage, loadAiExtensions, loadAiSessions, loadWritingWorkspace, userRoleLabel, type AiExtension, type AiSession, type ApplicationId, type ApplicationMode, type UserRole, type UserSettings, type WritingWorkspace as WritingWorkspaceData } from "lfaa-client-connection/src/api.js";
import type { AiWorkNotification, AiWorkNotificationInput } from "lfaa-client-resources/src/notification-runtime.js";
import { resolveWorkbenchLayoutMetrics, type WorkbenchLayoutMetrics } from "lfaa-client-ui-dockkit/src/workbench-layout.config.js";
import type { WorkbenchLayoutMode } from "lfaa-client-ui-dockkit/src/workbench-layout.types.js";
import { ResizableWorkbench } from "lfaa-client-ui-dockkit/src/ResizableWorkbench.js";
import { readWorkbenchLeftWidth, saveWorkbenchLeftWidth } from "lfaa-client-ui-dockkit/src/workbench-preferences.js";
import { createScrollRestorationKey, useScrollRestoration } from "lfaa-client-store/src/scroll-restoration.js";
import { ServiceStatus, type ServiceState } from "lfaa-client-ui-primitives/src/ServiceStatus.js";
import { GLOBAL_NAVIGATION_RAIL_COMPACT_WIDTH, GLOBAL_NAVIGATION_RAIL_WIDTH, GlobalNavigationRail } from "lfaa-client-ui-sidebar/src/GlobalNavigationRail.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import { TaskTerminal } from "./TaskTerminal.js";
import "./module-workbench.css";

// 按当前应用模式分别加载业务面板，避免工作台外壳等待无关应用代码。
const AiWorkChat = lazy(() => loadClientModule<typeof import("lfaa-client-ui-chat/src/AiWorkChat.js")>("lfaa-client-ui-chat/src/AiWorkChat.js").then((module) => ({ default: module.AiWorkChat })));
const MinecraftWorkspace = lazy(() => loadClientModule<typeof import("lfaa-client-ui-minecraft/src/MinecraftWorkspace.js")>("lfaa-client-ui-minecraft/src/MinecraftWorkspace.js").then((module) => ({ default: module.MinecraftWorkspace })));
const WritingAiContext = lazy(() => loadClientModule<typeof import("lfaa-client-ui-writing/src/ai-work/WritingAiContext.js")>("lfaa-client-ui-writing/src/ai-work/WritingAiContext.js").then((module) => ({ default: module.WritingAiContext })));
const WritingWorkspace = lazy(() => loadClientModule<typeof import("lfaa-client-ui-writing/src/normal/WritingWorkspace.js")>("lfaa-client-ui-writing/src/normal/WritingWorkspace.js").then((module) => ({ default: module.WritingWorkspace })));

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
  username: string;
  role: UserRole;
  serverState: ServiceState;
  error: string | null;
  onNavigate: (path: string) => void;
  onBack: () => void;
  onSelectedModeHome: () => void;
  onOpenSettings: (section?: "ai" | "permissions") => void;
  onOpenApplication: (app: ApplicationId, mode: ApplicationMode) => Promise<void>;
  activeAiSessionId: string | null;
  aiDraft: string;
  notifications: AiWorkNotification[];
  onNotification: (notification: AiWorkNotificationInput) => void;
  onMarkNotificationsRead: () => void;
  onClearNotifications: () => void;
  onOpenNotification: (notification: AiWorkNotification) => void;
  onActiveAiSessionChange: (sessionId: string | null) => void;
  onAiDraftChange: (draft: string) => void;
  onLogout: () => void;
}

interface ChromeState {
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  rightSwapped: boolean;
  terminalOpen: boolean;
}

const CHROME_KEY = "lfaa.module-workbench.chrome.v2";
const LEGACY_CHROME_KEY = "lfaa.module-workbench.chrome.v1";
const LAYOUT_KEY = "lfaa.module-workbench.layout.v1";
const aiExtensionSnapshots = new Map<string, AiExtension[]>();
const aiSessionSnapshots = new Map<string, AiSession[]>();
type NavigationLayout = UserSettings["general"]["navigationLayout"];

interface ChromeStorageMetadata {
  hasSavedState: boolean;
  navigationLayout: NavigationLayout | null;
}

function initialMetrics(): WorkbenchLayoutMetrics {
  if (typeof window === "undefined") return resolveWorkbenchLayoutMetrics(1440 - GLOBAL_NAVIGATION_RAIL_WIDTH, 900);
  const railWidth = window.innerWidth <= 420 ? GLOBAL_NAVIGATION_RAIL_COMPACT_WIDTH : GLOBAL_NAVIGATION_RAIL_WIDTH;
  return resolveWorkbenchLayoutMetrics(window.innerWidth - railWidth, window.innerHeight);
}

function defaultChrome(mode: WorkbenchLayoutMode): ChromeState {
  if (mode === "mobile") return { leftCollapsed: true, rightCollapsed: true, rightSwapped: false, terminalOpen: false };
  if (mode === "compact") return { leftCollapsed: false, rightCollapsed: true, rightSwapped: false, terminalOpen: false };
  return { leftCollapsed: false, rightCollapsed: true, rightSwapped: false, terminalOpen: false };
}

function readChrome(mode: WorkbenchLayoutMode): ChromeState {
  if (typeof window === "undefined") return defaultChrome(mode);
  try {
    const current = window.localStorage.getItem(CHROME_KEY);
    const usesPreviousDefaults = current === null;
    const value = JSON.parse(current ?? window.localStorage.getItem(LEGACY_CHROME_KEY) ?? "null") as Partial<ChromeState> | null;
    if (!value) return defaultChrome(mode);
    const stored = {
      leftCollapsed: Boolean(value.leftCollapsed),
      rightCollapsed: usesPreviousDefaults ? true : Boolean(value.rightCollapsed),
      rightSwapped: Boolean(value.rightSwapped),
      terminalOpen: Boolean(value.terminalOpen),
    };
    if (mode === "mobile") return { ...stored, leftCollapsed: true, rightCollapsed: true, terminalOpen: false };
    if (mode === "compact") return { ...stored, rightCollapsed: true };
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

interface ApplicationSidebarProps extends Pick<ApplicationWorkspaceProps, "userId" | "app" | "mode" | "section" | "apps" | "onNavigate" | "onOpenApplication"> {
  layoutMode: WorkbenchLayoutMode;
  onToggleLeft: () => void;
  notifications: AiWorkNotification[];
  onMarkNotificationsRead: () => void;
  onClearNotifications: () => void;
  onOpenNotification: (notification: AiWorkNotification) => void;
  sessions: AiSession[];
  activeSessionId: string | null;
  sessionsLoading: boolean;
  sessionsError: string;
  chatBusy: boolean;
  providerStatus: string | null;
  onNewSession: () => void;
  onSelectSession: (sessionId: string) => void;
  onArchiveSession: (session: AiSession) => void;
}

function ApplicationSidebar({ userId, app, mode, section, apps, layoutMode, onNavigate, onOpenApplication, onToggleLeft, notifications, onMarkNotificationsRead, onClearNotifications, onOpenNotification, sessions, activeSessionId, sessionsLoading, sessionsError, chatBusy, providerStatus, onNewSession, onSelectSession, onArchiveSession }: ApplicationSidebarProps) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const appSessions = sessions.filter((session) => session.appId === app && !session.archived);
  const appMenuScroll = useScrollRestoration(createScrollRestorationKey(userId, "module-app-menu", app));
  const sessionsScroll = useScrollRestoration(createScrollRestorationKey(userId, "module-session-list", app), !sessionsLoading);
  const minecraftMenuCategory = section === "java" ? "environment" : section === "overview" || section === "nodes" ? "monitor" : "management";
  const nextMode: ApplicationMode = mode === "normal" ? "ai-work" : "normal";
  const nextModeLabel = nextMode === "normal" ? "常规模式" : "AI Work";
  const unreadNotifications = notifications.filter((notification) => !notification.read).length;

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
        <button className="module-sidebar__brand" type="button" onClick={() => { if (app !== "workspace") void onOpenApplication(app, nextMode); }} aria-label={app === "workspace" ? "通用任务工作区" : `切换到${nextModeLabel}`} title={app === "workspace" ? "通用任务工作区" : `切换到${nextModeLabel}`}>
          <span className="module-sidebar__brand-mark">L</span><strong>LFAA</strong><WorkbenchIcon name="chevron" size={15} />
        </button>
        <div className="module-sidebar__brand-actions">
          <Popover
            arrow={false}
            content={<section className="module-sidebar__notifications" id="module-sidebar-notifications" role="dialog" aria-labelledby="module-sidebar-notifications-title">
              <header>
                <div><strong id="module-sidebar-notifications-title">通知</strong><span>AI Work 会话提醒</span></div>
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
      {app === "writing" && mode === "normal" ? <div className="module-sidebar__writing-library-portal" /> : null}
      {app === "minecraft" && mode === "normal" ? <nav ref={appMenuScroll.ref} onScroll={appMenuScroll.onScroll} className="module-sidebar__app-menu" aria-label="Minecraft 管理菜单">
        <div className="module-sidebar__section-title"><span>Minecraft 管理</span></div>
        <div className="module-sidebar__menu-tabs" role="group" aria-label="Minecraft 菜单分类">
          <button type="button" aria-pressed={minecraftMenuCategory === "monitor"} onClick={() => onNavigate("/apps/minecraft/normal/overview")}>监控</button>
          <button type="button" aria-pressed={minecraftMenuCategory === "management"} onClick={() => onNavigate("/apps/minecraft/normal/instances")}>管理</button>
          <button type="button" aria-pressed={minecraftMenuCategory === "environment"} onClick={() => onNavigate("/apps/minecraft/normal/java")}>环境</button>
        </div>
        {(minecraftMenuCategory === "monitor"
          ? [["overview", "总览"], ["nodes", "控制节点"]]
          : minecraftMenuCategory === "management"
            // 此入口复用全局文件工作台，避免 Minecraft 维护另一份文件管理界面。
            ? [["deployment", "部署"], ["instances", "实例"], ["tasks", "任务"], ["files", "文件管理"]]
            : [["java", "Java 环境"]]
        ).map(([key, label]) => <button type="button" key={key} className={`module-sidebar__menu-item${section === key || key === "instances" && section.startsWith("instance/") ? " is-active" : ""}`} aria-current={section === key ? "page" : undefined} onClick={() => onNavigate(key === "files" ? "/files" : `/apps/minecraft/normal/${key}`)}><span aria-hidden="true" />{label}</button>)}
        {section.startsWith("instance/") ? <>
          <div className="module-sidebar__section-title module-sidebar__section-title--instance"><span>当前实例</span></div>
          {([
            ["overview", "实例概览"], ["configuration", "服务器配置"], ["logs", "控制台日志"], ["backup", "世界备份"]
          ] as const).map(([view, label]) => <button type="button" key={view} className={`module-sidebar__menu-item module-sidebar__menu-item--nested${section.endsWith(`/${view}`) ? " is-active" : ""}`} aria-current={section.endsWith(`/${view}`) ? "page" : undefined} onClick={() => onNavigate(`/apps/minecraft/normal/${section.replace(/\/(overview|configuration|logs|backup)$/u, "")}/${view}`)}><span aria-hidden="true" />{label}</button>)}
        </> : null}
      </nav> : null}
      {mode === "ai-work" ? <section className="module-sidebar__sessions" aria-label={`${apps.find((item) => item.id === app)?.title ?? "当前应用"} 会话`}>
        <div className="module-sidebar__sessions-heading"><span>会话</span><span className="module-sidebar__sessions-count">{appSessions.length}</span><button type="button" aria-label="新建会话" title="新建会话" disabled={chatBusy} onClick={() => { onNewSession(); if (layoutMode === "mobile") onToggleLeft(); }}><WorkbenchIcon name="plus" size={15} /></button></div>
        {sessionsError ? <p className="module-sidebar__sessions-error" role="alert">{sessionsError}</p> : null}
        <div ref={sessionsScroll.ref} onScroll={sessionsScroll.onScroll} className="module-sidebar__session-list">
          {sessionsLoading ? <span className="module-sidebar__session-message">正在加载会话…</span> : appSessions.map((session) => <div className={`module-sidebar__session${session.id === activeSessionId ? " is-active" : ""}`} key={session.id}>
            <button type="button" disabled={chatBusy} aria-current={session.id === activeSessionId ? "page" : undefined} onClick={() => { onSelectSession(session.id); if (layoutMode === "mobile") onToggleLeft(); }} title={session.title}><WorkbenchIcon name="history" size={14} /><span>{session.title}</span></button>
            <button type="button" disabled={chatBusy} aria-label={`归档 ${session.title}`} title="归档会话" onClick={() => onArchiveSession(session)}><WorkbenchIcon name="archive" size={13} /></button>
          </div>)}
          {!sessionsLoading && !appSessions.length ? <span className="module-sidebar__session-message">还没有会话</span> : null}
        </div>
        <div className="module-sidebar__provider"><Tag color={providerStatus && providerStatus !== "未配置模型" && providerStatus !== "模型状态不可用" ? "green" : "default"}>{providerStatus ?? "正在读取模型…"}</Tag></div>
      </section> : null}
      <div className="module-sidebar__footer">
        <span>当前工作模式</span>
        <strong>{mode === "normal" ? "常规模式" : "AI Work"}</strong>
      </div>
    </div>
  );
}

function PanelControl({ name, title, shortcut, active, onClick }: { name: "terminal" | "panelRight"; title: string; shortcut: string; active: boolean; onClick: () => void }) {
  const ariaShortcuts = shortcut.split(" / ").map((chord) => chord.replace("Ctrl", "Control")).join(" ");
  return <button className="module-panel-control" type="button" aria-label={title} aria-keyshortcuts={ariaShortcuts} aria-pressed={active} title={`${title} · ${shortcut || "未分配"}`} onClick={onClick}><WorkbenchIcon name={name} size={16} /><span>{title}</span></button>;
}

export function ApplicationWorkspace({ userId, app, mode, section, apps, username, role, serverState, error, settings, onSettingsChange, onBack, onSelectedModeHome, onNavigate, onOpenSettings, onOpenApplication, activeAiSessionId, aiDraft, notifications, onNotification, onMarkNotificationsRead, onClearNotifications, onOpenNotification, onActiveAiSessionChange, onAiDraftChange, onLogout }: ApplicationWorkspaceProps) {
  const layoutRef = useRef<HTMLDivElement>(null);
  const previewCloseTimer = useRef<number | null>(null);
  const [metrics, setMetrics] = useState(initialMetrics);
  const [chrome, setChrome] = useState(() => readChrome(metrics.mode));
  const [chromeStorageMetadata] = useState(readChromeStorageMetadata);
  const [leftPaneWidth, setLeftPaneWidth] = useState(() => readWorkbenchLeftWidth(metrics.left, metrics.containerWidth));
  const [leftPreviewOpen, setLeftPreviewOpen] = useState(false);
  const [registeredExtensions, setRegisteredExtensions] = useState<AiExtension[]>(() => aiExtensionSnapshots.get(userId) ?? []);
  const [extensionsLoading, setExtensionsLoading] = useState(() => !aiExtensionSnapshots.has(userId));
  const [aiSessions, setAiSessions] = useState<AiSession[]>(() => aiSessionSnapshots.get(`${userId}:${app}`) ?? []);
  const [aiSessionsLoading, setAiSessionsLoading] = useState(() => mode === "ai-work" && !aiSessionSnapshots.has(`${userId}:${app}`));
  const [aiSessionsError, setAiSessionsError] = useState("");
  const [aiChatBusy, setAiChatBusy] = useState(false);
  const [aiProviderStatus, setAiProviderStatus] = useState<string | null>(null);
  const [newAiSessionKey, setNewAiSessionKey] = useState(0);
  const [writingWorkspace, setWritingWorkspace] = useState<WritingWorkspaceData | null>(null);
  const [writingWorkspaceLoading, setWritingWorkspaceLoading] = useState(app === "writing");
  const [writingWorkspaceError, setWritingWorkspaceError] = useState("");
  const writingFlushRef = useRef<(() => Promise<void>) | null>(null);
  const [minecraftContentReady, setMinecraftContentReady] = useState(app !== "minecraft");
  const appliedLayoutMode = useRef(metrics.mode);
  const appliedNavigationLayout = useRef<NavigationLayout | null>(chromeStorageMetadata.navigationLayout);
  const activeAiSessionIdRef = useRef(activeAiSessionId);
  activeAiSessionIdRef.current = activeAiSessionId;
  const activeAiSessionChangeRef = useRef(onActiveAiSessionChange);
  activeAiSessionChangeRef.current = onActiveAiSessionChange;
  const moduleContentScroll = useScrollRestoration(
    mode === "ai-work" ? "" : createScrollRestorationKey(userId, "module-page", app, mode, section),
    minecraftContentReady
  );
  const contextBodyScroll = useScrollRestoration(
    createScrollRestorationKey(userId, "module-context", app, mode),
    !extensionsLoading
  );

  const selectedApp = apps.find((item) => item.id === app);
  const modeLabel = mode === "normal" ? "常规模式" : "AI Work";
  const writingAiWork = app === "writing" && mode === "ai-work";
  const writingNormal = app === "writing" && mode === "normal";
  const activeAiSessionTitle = aiSessions.find((session) => session.id === activeAiSessionId)?.title ?? null;
  const statusLabel = serverState === "online" ? "控制端已连接" : serverState === "checking" ? "正在检查控制端" : "控制端未连接";

  const registerWritingFlush = useCallback((flush: (() => Promise<void>) | null) => {
    writingFlushRef.current = flush;
  }, []);
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
    let alive = true;
    void loadAiExtensions().then((result) => {
      if (alive) {
        aiExtensionSnapshots.set(userId, result.extensions);
        setRegisteredExtensions(result.extensions);
      }
    }).catch(() => { if (alive && !aiExtensionSnapshots.has(userId)) setRegisteredExtensions([]); }).finally(() => { if (alive) setExtensionsLoading(false); });
    return () => { alive = false; };
  }, [userId]);

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
    let alive = true;
    setAiProviderStatus(null);
    setAiSessionsError("");
    if (mode !== "ai-work") {
      setAiSessionsLoading(false);
      return () => { alive = false; };
    }
    const cacheKey = `${userId}:${app}`;
    const cachedSessions = aiSessionSnapshots.get(cacheKey);
    setAiSessionsLoading(cachedSessions === undefined);
    void loadAiSessions({ appId: app }).then((result) => {
      if (alive) {
        aiSessionSnapshots.set(cacheKey, result.sessions);
        setAiSessions(result.sessions);
        const activeSessionId = activeAiSessionIdRef.current;
        if (activeSessionId && !result.sessions.some((session) => session.id === activeSessionId && !session.archived)) activeAiSessionChangeRef.current(null);
      }
    }).catch((loadError: unknown) => {
      if (alive) setAiSessionsError(getErrorMessage(loadError));
    }).finally(() => {
      if (alive) setAiSessionsLoading(false);
    });
    return () => { alive = false; };
  }, [app, mode, userId]);

  useEffect(() => {
    const element = layoutRef.current;
    if (!element) return;
    let frame: number | null = null;
    const update = () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = null;
        const rect = element.getBoundingClientRect();
        const next = resolveWorkbenchLayoutMetrics(rect.width, rect.height);
        setMetrics((current) => current.mode === next.mode
          && current.containerWidth === next.containerWidth
          && current.containerHeight === next.containerHeight
          && current.left.min === next.left.min
          && current.left.initial === next.left.initial
          && current.left.max === next.left.max
          && current.right.min === next.right.min
          && current.right.initial === next.right.initial
          && current.right.max === next.right.max
          && current.bottom.min === next.bottom.min
          && current.bottom.initial === next.bottom.initial
          && current.bottom.max === next.bottom.max
          && current.minCenterWidth === next.minCenterWidth
          ? current : next);
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (appliedLayoutMode.current === metrics.mode) return;
    appliedLayoutMode.current = metrics.mode;
    if (metrics.mode === "compact") setChrome((current) => ({ ...current, rightCollapsed: true }));
    if (metrics.mode === "mobile") setChrome((current) => ({ ...current, leftCollapsed: true, rightCollapsed: true, terminalOpen: false }));
  }, [metrics.mode]);

  useEffect(() => {
    const previousNavigationLayout = appliedNavigationLayout.current;
    if (previousNavigationLayout === settings.general.navigationLayout) return;
    appliedNavigationLayout.current = settings.general.navigationLayout;
    // 已保存的工作区状态优先于挂载默认值；旧版记录没有布局快照时也保留其开合选择。
    if (previousNavigationLayout === null && chromeStorageMetadata.hasSavedState) return;
    const initialPreference = previousNavigationLayout === null;
    const mobile = metrics.mode === "mobile";
    const hidesLeft = settings.general.navigationLayout === "right-tools" || settings.general.navigationLayout === "focus";
    const hidesRight = settings.general.navigationLayout === "left-two-column" || settings.general.navigationLayout === "focus" || metrics.mode !== "desktop";
    const keepsThreeColumnDefaultClosed = initialPreference && settings.general.navigationLayout === "three-column" && metrics.mode === "desktop";
    setChrome((current) => ({
      ...current,
      leftCollapsed: mobile || hidesLeft,
      rightCollapsed: keepsThreeColumnDefaultClosed ? current.rightCollapsed : mobile || hidesRight,
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
    ...(metrics.mode === "mobile" && current.leftCollapsed ? { rightCollapsed: true } : {}),
  })), [metrics.mode]);
  const toggleRight = useCallback(() => setChrome((current) => ({
    ...current,
    rightCollapsed: !current.rightCollapsed,
    ...(metrics.mode === "mobile" && current.rightCollapsed ? { leftCollapsed: true } : {}),
  })), [metrics.mode]);
  const togglePaneOrder = useCallback(() => setChrome((current) => ({ ...current, rightSwapped: !current.rightSwapped })), []);
  const toggleTerminal = useCallback(() => setChrome((current) => ({ ...current, terminalOpen: !current.terminalOpen, ...(settings.general.terminalPosition === "right" ? { rightCollapsed: false } : {}) })), [settings.general.terminalPosition]);
  const openTerminal = useCallback(() => setChrome((current) => ({ ...current, terminalOpen: true, ...(settings.general.terminalPosition === "right" ? { rightCollapsed: false } : {}) })), [settings.general.terminalPosition]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || isEditableTarget(event.target)) return;
      const key = event.key.toLocaleLowerCase();
      const matches = (chord: string) => {
        const parts = chord.split("+").map((part) => part.toLocaleLowerCase());
        const targetKey = parts.at(-1) ?? "";
        return key === targetKey
          && Boolean(event.ctrlKey || event.metaKey) === parts.includes("ctrl")
          && Boolean(event.altKey) === parts.includes("alt")
          && Boolean(event.shiftKey) === parts.includes("shift");
      };
      const actionGroups: Array<[string[], () => void]> = [
        [settings.shortcuts.toggleContextPanel, toggleRight],
        [settings.shortcuts.toggleSidebar, toggleLeft],
        [settings.shortcuts.toggleBottomPanel, toggleTerminal],
        [settings.shortcuts.openTerminal, openTerminal],
        [app === "workspace" ? [] : settings.shortcuts.switchNormalMode, () => { void openApplication(app, "normal"); }],
        [settings.shortcuts.switchAiWorkMode, () => { void openApplication(app, "ai-work"); }]
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
  }, [app, metrics.mode, openApplication, openTerminal, settings.shortcuts, toggleLeft, toggleRight, toggleTerminal]);

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
  const startNewAiSession = () => {
    onActiveAiSessionChange(null);
    setNewAiSessionKey((current) => current + 1);
    setAiSessionsError("");
  };
  const archiveAiWorkSession = async (session: AiSession) => {
    try {
      await archiveAiSession(session.id, true);
      const nextSessions = aiSessions.filter((item) => item.id !== session.id);
      aiSessionSnapshots.set(`${userId}:${app}`, nextSessions);
      setAiSessions(nextSessions);
      if (activeAiSessionId === session.id) onActiveAiSessionChange(null);
      setAiSessionsError("");
    } catch (archiveError: unknown) {
      setAiSessionsError(getErrorMessage(archiveError));
    }
  };
  const left = <ApplicationSidebar
    userId={userId}
    app={app}
    mode={mode}
    section={section}
    apps={apps}
    layoutMode={metrics.mode}
    onNavigate={navigateWithinApplication}
    onOpenApplication={openSidebarMode}
    onToggleLeft={toggleLeft}
    notifications={notifications}
    onMarkNotificationsRead={onMarkNotificationsRead}
    onClearNotifications={onClearNotifications}
    onOpenNotification={onOpenNotification}
    sessions={aiSessions}
    activeSessionId={activeAiSessionId}
    sessionsLoading={aiSessionsLoading}
    sessionsError={aiSessionsError}
    chatBusy={aiChatBusy}
    providerStatus={aiProviderStatus}
    onNewSession={startNewAiSession}
    onSelectSession={(sessionId) => { onActiveAiSessionChange(sessionId); setAiSessionsError(""); }}
    onArchiveSession={(session) => { void archiveAiWorkSession(session); }}
  />;
  const center = (
    <div className="module-center">
      <header className={`module-center__header${writingAiWork ? " module-center__header--writing-ai-work" : ""}`} data-layout-mode={metrics.mode}>
        <div className="module-center__heading">
          <button className="module-shell-icon-button" type="button" aria-label="切换应用导航" aria-expanded={!chrome.leftCollapsed} aria-keyshortcuts={settings.shortcuts.toggleSidebar.map((chord) => chord.replace("Ctrl", "Control")).join(" ")} title={`切换应用导航 · ${settings.shortcuts.toggleSidebar.join(" / ") || "未分配"}`} onClick={toggleLeft} onMouseEnter={openLeftPreview} onMouseLeave={closeLeftPreview} onFocus={openLeftPreview} onBlur={closeLeftPreview}><WorkbenchIcon name="panelLeft" size={16} /></button>
          <div className="module-center__title"><WorkbenchIcon name={mode === "normal" ? "folder" : "spark"} size={16} /><strong>{writingAiWork ? "智能体对话" : selectedApp.title}</strong></div>
        </div>
        <div className="module-center__mode" role="tablist" aria-label="应用模式">
          {app !== "workspace" ? <button type="button" role="tab" aria-selected={mode === "normal"} aria-keyshortcuts="Alt+1" title="常规模式 · Alt+1" onClick={() => void openApplication(app, "normal")}>常规</button> : null}
          <button type="button" role="tab" aria-selected={mode === "ai-work"} aria-keyshortcuts="Alt+2" title="AI Work · Alt+2" onClick={() => void openApplication(app, "ai-work")}>AI Work</button>
        </div>
        <div className="module-center__actions">
          <span className={`module-runtime-state${serverState === "online" ? " is-connected" : ""}`}><i aria-hidden="true" />{statusLabel}</span>
          {settings.general.showBottomPanelControl && (chrome.rightCollapsed || metrics.mode !== "desktop") ? <PanelControl name="terminal" title="底部终端" shortcut={settings.shortcuts.toggleBottomPanel.join(" / ")} active={chrome.terminalOpen} onClick={toggleTerminal} /> : null}
          {(chrome.rightCollapsed || metrics.mode !== "desktop") ? <PanelControl name="panelRight" title="上下文栏" shortcut={settings.shortcuts.toggleContextPanel.join(" / ")} active={!chrome.rightCollapsed} onClick={toggleRight} /> : null}
        </div>
      </header>
      <main ref={moduleContentScroll.ref} onScroll={moduleContentScroll.onScroll} className={`module-center__content${mode === "ai-work" ? " module-center__content--ai-work" : ""}${writingNormal ? " module-center__content--writing-normal" : ""}`} aria-label={mode === "ai-work" ? `${selectedApp.title} AI Work 对话` : writingNormal ? "写作正文编辑区" : undefined} aria-labelledby={mode === "normal" && app !== "minecraft" && !writingNormal ? "module-heading" : undefined}>
        {mode === "ai-work" ? <>
          {error ? <Alert className="page-alert" type="error" showIcon message={error} /> : null}
          <Suspense fallback={<ApplicationContentLoading />}>
            <AiWorkChat
              userId={userId}
              appId={app}
              settings={settings}
              onSettingsChange={onSettingsChange}
              sessions={aiSessions}
              activeSessionId={activeAiSessionId}
              initialDraft={aiDraft}
              newSessionKey={newAiSessionKey}
              onSessionsChange={(sessions) => {
                aiSessionSnapshots.set(`${userId}:${app}`, sessions);
                setAiSessions(sessions);
              }}
              onActiveSessionChange={onActiveAiSessionChange}
              onDraftChange={onAiDraftChange}
              onProviderStatusChange={setAiProviderStatus}
              onBusyChange={setAiChatBusy}
              onOpenSettings={onOpenSettings}
              onNotification={onNotification}
            />
          </Suspense>
        </> : app === "minecraft" ? <Suspense fallback={<ApplicationContentLoading />}><MinecraftWorkspace userId={userId} section={section} role={role} onNavigate={navigateWithinApplication} onContentReady={setMinecraftContentReady} /></Suspense> : writingNormal ? <Suspense fallback={<ApplicationContentLoading />}><WritingWorkspace workspace={writingWorkspace} loading={writingWorkspaceLoading} loadError={writingWorkspaceError} writingSkills={registeredExtensions.filter((extension) => extension.kind === "skill" && extension.applicationIds?.includes("writing"))} skillsLoading={extensionsLoading} onRetry={() => { void retryWritingWorkspace(); }} onWorkspaceChange={setWritingWorkspace} onRegisterFlush={registerWritingFlush} /></Suspense> : <>
          <div className={`module-heading module-heading--workspace module-heading--${app}`}>
            <div className="module-heading__labels"><Tag className="development-tag">开发中</Tag><Tag className="module-mode-tag">{modeLabel}</Tag></div>
            <Typography.Title id="module-heading" level={2}>{selectedApp.title}</Typography.Title>
            <Typography.Paragraph>{modeLabel} · 应用工作区</Typography.Paragraph>
          </div>
          {error ? <Alert className="page-alert" type="error" showIcon message={error} /> : null}
          <section className="module-notice-card" aria-label="模块状态">
            <span className="module-notice-card__icon" aria-hidden="true"><WorkbenchIcon name="spark" size={19} /></span>
            <div><Typography.Title level={4}>这个入口尚未连接业务能力</Typography.Title><Typography.Paragraph>常规模式的游戏安装、主机文件操作和作品存储需要对应业务模块与 Daemon 节点；AI Work 对话已接入独立的模型 Runtime。</Typography.Paragraph></div>
          </section>
          <div className="module-content-placeholder"><span className="module-content-placeholder__dot" aria-hidden="true" /><span>业务面板接入后会显示在这里。</span></div>
        </>}
      </main>
    </div>
  );

  const right = (
    <aside className="module-context" aria-label={app === "writing" ? mode === "ai-work" ? "写作上下文" : "作品信息" : "工具与资源"} data-layout-mode={metrics.mode}>
      {metrics.mode === "desktop" && !chrome.rightCollapsed ? <header className="module-context__shell-actions">
          {settings.general.showBottomPanelControl ? <PanelControl name="terminal" title="底部终端" shortcut={settings.shortcuts.toggleBottomPanel.join(" / ")} active={chrome.terminalOpen} onClick={toggleTerminal} /> : null}
          <PanelControl name="panelRight" title="收起上下文栏" shortcut={settings.shortcuts.toggleContextPanel.join(" / ")} active onClick={toggleRight} />
      </header> : null}
      <div ref={contextBodyScroll.ref} onScroll={contextBodyScroll.onScroll} className="module-context__body">
      {chrome.terminalOpen && settings.general.terminalPosition === "right" ? <div style={{ height: metrics.bottom.initial }}><TaskTerminal onClose={toggleTerminal} /></div> : null}
      {app === "writing" ? <Suspense fallback={<ApplicationContentLoading />}><WritingAiContext
        mode={mode}
        workspace={writingWorkspace}
        workspaceLoading={writingWorkspaceLoading}
        sessionTitle={aiSessionsLoading ? "正在读取会话…" : activeAiSessionTitle ?? "新对话"}
        providerStatus={aiProviderStatus}
        onOpenNormal={() => { void openApplication(app, "normal"); }}
        onOpenAiWork={() => { void openApplication(app, "ai-work"); }}
        onClose={toggleRight}
      /></Suspense> : <>
      <header className="module-context__heading"><div><strong>工具与资源</strong><span>Runtime Registry</span></div><span className={`module-context__connection module-context__connection--${serverState}`}><i aria-hidden="true" />{serverState === "online" ? "已连接" : serverState === "checking" ? "检查中" : "未连接"}</span><button className="module-shell-icon-button module-context__close" type="button" aria-label="收起工具与资源" title="收起工具与资源" onClick={toggleRight}><WorkbenchIcon name="close" size={15} /></button></header>
        <div className="module-context__tools">
          {settings.general.showBottomPanelControl ? <button type="button" onClick={openTerminal} aria-keyshortcuts={settings.shortcuts.openTerminal.map((chord) => chord.replace("Ctrl", "Control")).join(" ")}><WorkbenchIcon name="terminal" size={16} /><span>终端</span><kbd>{settings.shortcuts.openTerminal.join(" / ") || "未分配"}</kbd></button> : null}
          <button type="button" disabled title="当前 Web Host 尚未接入审查工具"><WorkbenchIcon name="review" size={16} /><span>审查</span><kbd>待接入</kbd></button>
          <button type="button" disabled title="当前 Web Host 尚未接入浏览器工具"><WorkbenchIcon name="browser" size={16} /><span>浏览器</span><kbd>待接入</kbd></button>
          <button type="button" onClick={() => onNavigate("/files")} title="打开已接入的节点文件管理"><WorkbenchIcon name="file" size={16} /><span>节点文件</span></button>
        </div>
        <section className="module-context__section module-context__resources"><header><span>能力资源</span><b>{registeredExtensions.length}</b></header>
          {(["skill", "expert", "prompt", "tool"] as const).map((kind) => {
            const resources = registeredExtensions.filter((extension) => extension.kind === kind && (!extension.applicationIds || extension.applicationIds.includes(app)));
            const groupName = kind === "skill" ? "Skills" : kind === "expert" ? "Experts" : kind === "prompt" ? "Prompts" : "Tools";
            return <section className="module-context__resource-group" key={kind}><header><span>{groupName}</span><b>{resources.length}</b></header>{resources.length ? resources.map((item) => <p title={item.description} key={item.id}>{item.name}</p>) : <p>暂无登记资源</p>}</section>;
          })}
        </section>
        <section className="module-context__section">
          <header><span>当前应用</span><b>1</b></header>
          <div className="module-context__app">
            <span className={`application-monogram application-monogram--${selectedApp.color}`} aria-hidden="true">{selectedApp.initials}</span>
            <div><strong>{selectedApp.title}</strong><small>{modeLabel}</small></div>
          </div>
        </section>
        <section className="module-context__section"><header><span>服务状态</span></header><div className="module-context__service"><ServiceStatus state={serverState} /><small>控制端健康状态</small></div></section>
        <section className="module-context__note"><strong>工作区能力</strong><p>工具与资源会在当前宿主接入后显示。尚未连接的入口保持禁用状态。</p></section>
      </>}
        <div className="module-context__account"><WorkbenchIcon name="user" size={15} /><span>{username}</span><small>{userRoleLabel(role)}</small></div>
      </div>
    </aside>
  );

  const bottom = <TaskTerminal onClose={toggleTerminal} />;

  const previewStyle = { "--module-left-preview-width": `${leftPaneWidth}px` } as CSSProperties;
  return (
    <div className="module-workbench-stage" style={previewStyle} data-layout-mode={metrics.mode}>
      <GlobalNavigationRail username={username} role={role} serverState={serverState} shortcuts={settings.shortcuts} activePage="home" homeLabel="返回当前模式首页" onHome={onSelectedModeHome} onApplicationsHome={onBack} onOpenFiles={() => onNavigate("/files")} onOpenSettings={onOpenSettings} onLogout={onLogout} onToggleTools={toggleRight} />
      <div ref={layoutRef} className="module-workbench-layout" data-layout-mode={metrics.mode}>
        {chrome.leftCollapsed && metrics.mode !== "mobile" ? <div className={`module-left-preview${leftPreviewOpen ? " is-visible" : ""}`} data-layout-mode={metrics.mode} aria-hidden={!leftPreviewOpen} onMouseEnter={openLeftPreview} onMouseLeave={closeLeftPreview}>{left}</div> : null}
        <ResizableWorkbench
          left={left}
          center={center}
          right={right}
          rightPaneSwapped={chrome.rightSwapped && !chrome.rightCollapsed}
          onSwapPanes={togglePaneOrder}
          bottom={chrome.terminalOpen && settings.general.terminalPosition === "bottom" ? bottom : null}
          storageKey={LAYOUT_KEY}
          leftLimits={metrics.left}
          rightLimits={metrics.right}
          bottomLimits={metrics.bottom}
          containerWidth={metrics.containerWidth}
          snapCaptureRatio={metrics.snapCaptureRatio}
          snapHysteresis={metrics.snapHysteresis}
          minCenterWidth={metrics.minCenterWidth}
          layoutMode={metrics.mode}
          leftWidth={leftPaneWidth}
          onLeftWidthChange={setLeftPaneWidth}
          leftCollapsed={chrome.leftCollapsed}
          onLeftCollapsedChange={(leftCollapsed) => setChrome((current) => ({ ...current, leftCollapsed }))}
          rightCollapsed={chrome.rightCollapsed}
          onRightCollapsedChange={(rightCollapsed) => setChrome((current) => ({ ...current, rightCollapsed }))}
          bottomOpen={chrome.terminalOpen && settings.general.terminalPosition === "bottom"}
          onBottomOpenChange={(terminalOpen) => setChrome((current) => ({ ...current, terminalOpen }))}
        />
      </div>
    </div>
  );
}
