/**
 * 文件：ApplicationWorkspace.tsx
 * 功能：装配 SteamCMD、Minecraft、写作应用内部的工作台界面。
 * 作用：连接导航轨、应用侧栏、中心工作区、右侧工具栏和底部终端区域，并提供设置入口、通知卡片与窗格交换偏好。
 * 关联文件：frontend/src/components/Workbench.tsx、frontend/src/components/SettingsPage.tsx、frontend/src/shared/scroll-restoration.ts、frontend/src/workbench/ResizableWorkbench.tsx、frontend/src/components/module-workbench.css。
 * 修改注意事项：工作区导航只负责切换界面；用户设置与快捷键保存由设置页面和控制端 API 负责。
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Alert, Popover, Tag, Typography } from "antd";
import { archiveAiSession, getErrorMessage, loadAiExtensions, loadAiSessions, type AiExtension, type AiSession, type ApplicationId, type ApplicationMode, type UserRole, type UserSettings } from "../api.js";
import { resolveWorkbenchLayoutMetrics, type WorkbenchLayoutMetrics } from "../workbench/workbench-layout.config.js";
import type { WorkbenchLayoutMode } from "../workbench/workbench-layout.types.js";
import { ResizableWorkbench } from "../workbench/ResizableWorkbench.js";
import { readWorkbenchLeftWidth, saveWorkbenchLeftWidth } from "../workbench/workbench-preferences.js";
import { createScrollRestorationKey, useScrollRestoration } from "../shared/scroll-restoration.js";
import { ServiceStatus, type ServiceState } from "./ServiceStatus.js";
import { WorkbenchIcon } from "./workbench/shared/WorkbenchIcon.js";
import { AiWorkChat } from "./AiWorkChat.js";
import { MinecraftWorkspace } from "./MinecraftWorkspace.js";
import "./module-workbench.css";

type ApplicationSummary = {
  id: ApplicationId;
  title: string;
  initials: string;
  color: "blue" | "green" | "plum";
};

type WorkspaceNotification = {
  id: string;
  applicationName: string;
  createdAt: number;
  read: boolean;
};

interface ApplicationWorkspaceProps {
  userId: string;
  app: ApplicationId;
  mode: ApplicationMode;
  section: string;
  settings: UserSettings;
  apps: ApplicationSummary[];
  username: string;
  role: UserRole;
  serverState: ServiceState;
  error: string | null;
  onNavigate: (path: string) => void;
  onBack: () => void;
  onModeHome: () => void;
  onOpenSettings: () => void;
  onOpenApplication: (app: ApplicationId, mode: ApplicationMode) => Promise<void>;
  activeAiSessionId: string | null;
  aiDraft: string;
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
const NAVIGATION_RAIL_WIDTH = 64;

type NavigationLayout = UserSettings["general"]["navigationLayout"];

interface ChromeStorageMetadata {
  hasSavedState: boolean;
  navigationLayout: NavigationLayout | null;
}

function initialMetrics(): WorkbenchLayoutMetrics {
  return typeof window === "undefined"
    ? resolveWorkbenchLayoutMetrics(1440 - NAVIGATION_RAIL_WIDTH, 900)
    : resolveWorkbenchLayoutMetrics(window.innerWidth - NAVIGATION_RAIL_WIDTH, window.innerHeight);
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

interface ApplicationSidebarProps extends Pick<ApplicationWorkspaceProps, "userId" | "app" | "mode" | "section" | "apps" | "onBack" | "onNavigate" | "onOpenApplication"> {
  layoutMode: WorkbenchLayoutMode;
  onToggleLeft: () => void;
  notifications: WorkspaceNotification[];
  onMarkNotificationsRead: () => void;
  onClearNotifications: () => void;
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

function ApplicationSidebar({ userId, app, mode, section, apps, layoutMode, onBack, onNavigate, onOpenApplication, onToggleLeft, notifications, onMarkNotificationsRead, onClearNotifications, sessions, activeSessionId, sessionsLoading, sessionsError, chatBusy, providerStatus, onNewSession, onSelectSession, onArchiveSession }: ApplicationSidebarProps) {
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const visibleApps = apps.filter((item) => item.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const appSessions = sessions.filter((session) => session.appId === app && !session.archived);
  const appsScroll = useScrollRestoration(createScrollRestorationKey(userId, "module-app-list"));
  const appMenuScroll = useScrollRestoration(createScrollRestorationKey(userId, "module-app-menu", app));
  const sessionsScroll = useScrollRestoration(createScrollRestorationKey(userId, "module-session-list", app), !sessionsLoading);
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
        <button className="module-sidebar__brand" type="button" onClick={() => void onOpenApplication(app, nextMode)} aria-label={`切换到${nextModeLabel}`} title={`切换到${nextModeLabel}`}>
          <span className="module-sidebar__brand-mark">L</span><strong>LFAA</strong><WorkbenchIcon name="chevron" size={15} />
        </button>
        <div className="module-sidebar__brand-actions">
          <Popover
            arrow={false}
            content={<section className="module-sidebar__notifications" id="module-sidebar-notifications" role="dialog" aria-labelledby="module-sidebar-notifications-title">
              <header>
                <div><strong id="module-sidebar-notifications-title">通知</strong><span>AI Work 回复完成</span></div>
                <button type="button" disabled={!notifications.length} onClick={onClearNotifications}>清空</button>
              </header>
              {notifications.length ? <div className="module-sidebar__notification-list" aria-live="polite">
                {notifications.map((notification) => <article className={`module-sidebar__notification${notification.read ? " is-read" : ""}`} key={notification.id}>
                  <span className="module-sidebar__notification-dot" aria-hidden="true" />
                  <div><strong>{notification.applicationName} · AI Work</strong><span>回复已完成</span></div>
                  <time dateTime={new Date(notification.createdAt).toISOString()}>{new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(notification.createdAt)}</time>
                </article>)}
              </div> : <div className="module-sidebar__notification-empty"><WorkbenchIcon name="bell" size={20} /><strong>暂无通知</strong><span>AI Work 回复完成后会显示在这里。</span></div>}
            </section>}
            getPopupContainer={() => document.body}
            onOpenChange={(open) => {
              if (open) {
                setSearchOpen(false);
                onMarkNotificationsRead();
              }
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
          <button className="module-icon-button" type="button" aria-label={searchOpen ? "关闭应用搜索" : "搜索应用"} title="搜索应用" aria-expanded={searchOpen} onClick={() => { setNotificationsOpen(false); setSearchOpen((value) => !value); setSearch(""); }}>
            <WorkbenchIcon name="search" size={16} />
          </button>
          <button className="module-icon-button module-sidebar__close" type="button" aria-label="收起应用导航" title="收起应用导航" onClick={() => { setNotificationsOpen(false); onToggleLeft(); }}><WorkbenchIcon name="close" size={16} /></button>
        </div>
      </header>
      <button className="module-sidebar__back" type="button" onClick={onBack}><WorkbenchIcon name="home" size={16} /><span>应用中心</span></button>
      {searchOpen ? <label className="module-sidebar__search"><WorkbenchIcon name="search" size={15} /><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") { setSearchOpen(false); setSearch(""); } }} placeholder="搜索应用" aria-label="搜索应用" /><button type="button" aria-label="清除搜索" disabled={!search} onClick={() => setSearch("")}><WorkbenchIcon name="close" size={14} /></button></label> : null}
      <div className="module-sidebar__section-title"><span>应用</span><span className="module-sidebar__count">{visibleApps.length}</span></div>
      <div ref={appsScroll.ref} onScroll={appsScroll.onScroll} className="module-sidebar__apps">
        {visibleApps.map((item) => (
          <button key={item.id} type="button" disabled className={`module-sidebar__app${item.id === app ? " is-active" : ""}`} aria-current={item.id === app ? "page" : undefined} title={item.id === app ? "当前应用" : "请先返回应用中心，再切换到该应用"}>
            <span className={`application-monogram application-monogram--${item.color}`} aria-hidden="true">{item.initials}</span>
            <span className="module-sidebar__app-title">{item.title}</span>
            {item.id === app ? <span className="module-sidebar__active-label">当前</span> : null}
          </button>
        ))}
        {!visibleApps.length ? <p className="module-sidebar__empty">没有匹配的应用</p> : null}
      </div>
      {apps.length > 1 ? <p className="module-sidebar__app-switch-note">切换应用请先返回应用中心。</p> : null}
      {app === "minecraft" && mode === "normal" ? <nav ref={appMenuScroll.ref} onScroll={appMenuScroll.onScroll} className="module-sidebar__app-menu" aria-label="Minecraft 管理菜单">
        <div className="module-sidebar__section-title"><span>Minecraft 管理</span></div>
        {([
          ["overview", "总览"], ["instances", "实例"], ["java", "Java 环境"], ["tasks", "任务"]
        ] as const).map(([key, label]) => <button type="button" key={key} className={`module-sidebar__menu-item${section === key || key === "instances" && section.startsWith("instance/") ? " is-active" : ""}`} aria-current={section === key ? "page" : undefined} onClick={() => onNavigate(`/apps/minecraft/normal/${key}`)}><span aria-hidden="true" />{label}</button>)}
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

function NavigationRail({ username, role, serverState, shortcuts, onBack, onModeHome, onOpenSettings, onLogout, onToggleRight }: Pick<ApplicationWorkspaceProps, "username" | "role" | "serverState" | "onBack" | "onModeHome" | "onOpenSettings" | "onLogout"> & { shortcuts: UserSettings["shortcuts"]; onToggleRight: () => void }) {
  const [openPopover, setOpenPopover] = useState<"menu" | "shortcuts" | "profile" | null>(null);
  const railRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!openPopover) return;
    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !railRef.current?.contains(event.target)) {
        setOpenPopover(null);
      }
    };
    const dismissEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenPopover(null);
      }
    };
    document.addEventListener("pointerdown", dismissOutside);
    window.addEventListener("keydown", dismissEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      window.removeEventListener("keydown", dismissEscape);
    };
  }, [openPopover]);
  return (
    <nav className="module-navigation-rail" aria-label="LFAA 主导航" ref={railRef}>
      <div className="module-navigation-rail__primary">
        <button className="module-navigation-rail__button is-active" type="button" aria-label="返回工作模式首页" title="返回工作模式首页" onClick={() => { setOpenPopover(null); onModeHome(); }}><WorkbenchIcon name="home" size={19} /></button>
        <button className="module-navigation-rail__button" type="button" aria-label="最近会话" title="当前项目尚未接入会话功能" disabled><WorkbenchIcon name="history" size={19} /></button>
        <button className="module-navigation-rail__button" type="button" aria-label="工具与资源" title="工具与资源" aria-keyshortcuts="Control+Alt+B Meta+Alt+B" onClick={() => { setOpenPopover(null); onToggleRight(); }}><WorkbenchIcon name="tools" size={19} /></button>
        <button className="module-navigation-rail__button" type="button" aria-label="设置中心" title="设置中心" aria-keyshortcuts="Control+, Meta+," onClick={() => { setOpenPopover(null); onOpenSettings(); }}><WorkbenchIcon name="settings" size={19} /></button>
      </div>
      <div className="module-navigation-rail__footer">
        {openPopover === "menu" ? <section className="module-navigation-rail__popover" role="dialog" aria-label="更多入口">
          <header><strong>更多入口</strong><button type="button" aria-label="关闭更多入口" onClick={() => setOpenPopover(null)}><WorkbenchIcon name="close" size={14} /></button></header>
          <div className="module-navigation-rail__popover-actions">
            <button type="button" onClick={() => { setOpenPopover(null); onBack(); }}><WorkbenchIcon name="home" size={16} /><span>应用中心</span></button>
            <button type="button" onClick={() => { setOpenPopover(null); onToggleRight(); }}><WorkbenchIcon name="tools" size={16} /><span>工具与资源</span></button>
            <button type="button" onClick={() => setOpenPopover("shortcuts")}><WorkbenchIcon name="keyboard" size={16} /><span>键盘快捷键</span></button>
          </div>
        </section> : null}
        {openPopover === "shortcuts" ? <section className="module-navigation-rail__popover module-navigation-rail__popover--shortcuts" role="dialog" aria-label="工作台键盘快捷键">
          <header><strong>键盘快捷键</strong><button type="button" aria-label="关闭快捷键列表" onClick={() => setOpenPopover(null)}><WorkbenchIcon name="close" size={14} /></button></header>
          <dl>
            <div><dt>切换应用导航</dt><dd><kbd>{shortcuts.toggleSidebar.join(" / ") || "未分配"}</kbd></dd></div>
            <div><dt>切换工具与资源</dt><dd><kbd>{shortcuts.toggleContextPanel.join(" / ") || "未分配"}</kbd></dd></div>
            <div><dt>切换底部面板</dt><dd><kbd>{shortcuts.toggleBottomPanel.join(" / ") || "未分配"}</kbd></dd></div>
            <div><dt>打开终端面板</dt><dd><kbd>{shortcuts.openTerminal.join(" / ") || "未分配"}</kbd></dd></div>
            <div><dt>常规模式</dt><dd><kbd>{shortcuts.switchNormalMode.join(" / ") || "未分配"}</kbd></dd></div>
            <div><dt>AI Work</dt><dd><kbd>{shortcuts.switchAiWorkMode.join(" / ") || "未分配"}</kbd></dd></div>
          </dl>
        </section> : null}
        <button className={`module-navigation-rail__button${openPopover === "shortcuts" ? " is-active" : ""}`} type="button" aria-label="键盘快捷键" title="键盘快捷键" aria-expanded={openPopover === "shortcuts"} onClick={() => setOpenPopover((current) => current === "shortcuts" ? null : "shortcuts")}><WorkbenchIcon name="keyboard" size={18} /></button>
        <button className={`module-navigation-rail__button${openPopover === "menu" ? " is-active" : ""}`} type="button" aria-label="更多入口" title="更多入口" aria-expanded={openPopover === "menu"} onClick={() => setOpenPopover((current) => current === "menu" ? null : "menu")}><WorkbenchIcon name="dots" size={19} /></button>
        <span className={`module-navigation-rail__status module-navigation-rail__status--${serverState}`} title={serverState === "online" ? "控制端已连接" : serverState === "checking" ? "正在检查控制端" : "控制端未连接"} />
        {openPopover === "profile" ? <section className="module-navigation-rail__popover module-navigation-rail__popover--profile" role="dialog" aria-label="个人账户">
          <header><div><strong>{username}</strong><span>{role === "admin" ? "管理员" : "普通账户"}</span></div><button type="button" aria-label="关闭个人账户" onClick={() => setOpenPopover(null)}><WorkbenchIcon name="close" size={14} /></button></header>
          <div className="module-navigation-rail__popover-actions">
            <button type="button" onClick={() => { setOpenPopover(null); onOpenSettings(); }}><WorkbenchIcon name="settings" size={16} /><span>设置中心</span></button>
            <button type="button" onClick={() => { setOpenPopover(null); onLogout(); }}><WorkbenchIcon name="user" size={16} /><span>退出登录</span></button>
          </div>
        </section> : null}
        <div className="module-navigation-rail__profile">
          <button className="module-navigation-rail__avatar" type="button" aria-label={`个人中心：${username}`} title={`个人中心：${username}`} aria-expanded={openPopover === "profile"} onClick={() => setOpenPopover((current) => current === "profile" ? null : "profile")}>{username.slice(0, 1).toLocaleUpperCase()}</button>
        </div>
      </div>
    </nav>
  );
}

function PanelControl({ name, title, shortcut, active, onClick }: { name: "terminal" | "panelRight"; title: string; shortcut: string; active: boolean; onClick: () => void }) {
  const ariaShortcuts = shortcut.split(" / ").map((chord) => chord.replace("Ctrl", "Control")).join(" ");
  return <button className="module-panel-control" type="button" aria-label={title} aria-keyshortcuts={ariaShortcuts} aria-pressed={active} title={`${title} · ${shortcut || "未分配"}`} onClick={onClick}><WorkbenchIcon name={name} size={16} /><span>{title}</span></button>;
}

export function ApplicationWorkspace({ userId, app, mode, section, apps, username, role, serverState, error, settings, onBack, onModeHome, onNavigate, onOpenSettings, onOpenApplication, activeAiSessionId, aiDraft, onActiveAiSessionChange, onAiDraftChange, onLogout }: ApplicationWorkspaceProps) {
  const layoutRef = useRef<HTMLDivElement>(null);
  const previewCloseTimer = useRef<number | null>(null);
  const [metrics, setMetrics] = useState(initialMetrics);
  const [chrome, setChrome] = useState(() => readChrome(metrics.mode));
  const [chromeStorageMetadata] = useState(readChromeStorageMetadata);
  const [leftPaneWidth, setLeftPaneWidth] = useState(() => readWorkbenchLeftWidth(metrics.left, metrics.containerWidth));
  const [leftPreviewOpen, setLeftPreviewOpen] = useState(false);
  const [registeredExtensions, setRegisteredExtensions] = useState<AiExtension[]>([]);
  const [extensionsLoading, setExtensionsLoading] = useState(true);
  const [aiSessions, setAiSessions] = useState<AiSession[]>([]);
  const [aiSessionsLoading, setAiSessionsLoading] = useState(mode === "ai-work");
  const [aiSessionsError, setAiSessionsError] = useState("");
  const [aiChatBusy, setAiChatBusy] = useState(false);
  const [aiProviderStatus, setAiProviderStatus] = useState<string | null>(null);
  const [newAiSessionKey, setNewAiSessionKey] = useState(0);
  const [minecraftContentReady, setMinecraftContentReady] = useState(app !== "minecraft");
  const [notifications, setNotifications] = useState<WorkspaceNotification[]>([]);
  const notificationSequence = useRef(0);
  const appliedLayoutMode = useRef(metrics.mode);
  const appliedNavigationLayout = useRef<NavigationLayout | null>(chromeStorageMetadata.navigationLayout);
  const activeAiSessionIdRef = useRef(activeAiSessionId);
  activeAiSessionIdRef.current = activeAiSessionId;
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
  const statusLabel = serverState === "online" ? "控制端已连接" : serverState === "checking" ? "正在检查控制端" : "控制端未连接";

  const addNotification = useCallback((applicationName: string) => {
    notificationSequence.current += 1;
    const notification = {
      id: `${Date.now()}-${notificationSequence.current}`,
      applicationName,
      createdAt: Date.now(),
      read: false,
    };
    setNotifications((current) => [notification, ...current].slice(0, 8));
  }, []);
  const markNotificationsRead = useCallback(() => {
    setNotifications((current) => current.map((notification) => notification.read ? notification : { ...notification, read: true }));
  }, []);
  const clearNotifications = useCallback(() => setNotifications([]), []);

  useEffect(() => {
    let alive = true;
    void loadAiExtensions().then((result) => { if (alive) setRegisteredExtensions(result.extensions); }).catch(() => { if (alive) setRegisteredExtensions([]); }).finally(() => { if (alive) setExtensionsLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    setAiSessions([]);
    setAiProviderStatus(null);
    setAiSessionsError("");
    if (mode !== "ai-work") {
      setAiSessionsLoading(false);
      return () => { alive = false; };
    }
    setAiSessionsLoading(true);
    void loadAiSessions({ appId: app }).then((result) => {
      if (alive) {
        setAiSessions(result.sessions);
        const activeSessionId = activeAiSessionIdRef.current;
        if (activeSessionId && !result.sessions.some((session) => session.id === activeSessionId && !session.archived)) onActiveAiSessionChange(null);
      }
    }).catch((loadError: unknown) => {
      if (alive) setAiSessionsError(getErrorMessage(loadError));
    }).finally(() => {
      if (alive) setAiSessionsLoading(false);
    });
    return () => { alive = false; };
  }, [app, mode]);

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
  const toggleTerminal = useCallback(() => setChrome((current) => ({ ...current, terminalOpen: !current.terminalOpen })), []);
  const openTerminal = useCallback(() => setChrome((current) => current.terminalOpen ? current : { ...current, terminalOpen: true }), []);

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
        [settings.shortcuts.switchNormalMode, () => { void onOpenApplication(app, "normal"); }],
        [settings.shortcuts.switchAiWorkMode, () => { void onOpenApplication(app, "ai-work"); }]
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
  }, [app, metrics.mode, onOpenApplication, openTerminal, settings.shortcuts, toggleLeft, toggleRight, toggleTerminal]);

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
    await onOpenApplication(nextApp, nextMode);
    if (metrics.mode === "mobile") setChrome((current) => ({ ...current, leftCollapsed: true }));
  };
  const navigateWithinApplication = (path: string) => {
    onNavigate(path);
    if (metrics.mode === "mobile") setChrome((current) => ({ ...current, leftCollapsed: true }));
  };
  const startNewAiSession = () => {
    onActiveAiSessionChange(null);
    setNewAiSessionKey((current) => current + 1);
    setAiSessionsError("");
  };
  const archiveAiWorkSession = async (session: AiSession) => {
    try {
      await archiveAiSession(session.id, true);
      setAiSessions((current) => current.filter((item) => item.id !== session.id));
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
    onBack={onBack}
    onNavigate={navigateWithinApplication}
    onOpenApplication={openSidebarMode}
    onToggleLeft={toggleLeft}
    notifications={notifications}
    onMarkNotificationsRead={markNotificationsRead}
    onClearNotifications={clearNotifications}
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
      <header className="module-center__header" data-layout-mode={metrics.mode}>
        <div className="module-center__heading">
          <button className="module-shell-icon-button" type="button" aria-label="切换应用导航" aria-expanded={!chrome.leftCollapsed} aria-keyshortcuts={settings.shortcuts.toggleSidebar.map((chord) => chord.replace("Ctrl", "Control")).join(" ")} title={`切换应用导航 · ${settings.shortcuts.toggleSidebar.join(" / ") || "未分配"}`} onClick={toggleLeft} onMouseEnter={openLeftPreview} onMouseLeave={closeLeftPreview} onFocus={openLeftPreview} onBlur={closeLeftPreview}><WorkbenchIcon name="panelLeft" size={16} /></button>
          <div className="module-center__title"><WorkbenchIcon name={mode === "normal" ? "folder" : "spark"} size={16} /><strong>{selectedApp.title}</strong></div>
        </div>
        <div className="module-center__mode" role="tablist" aria-label="应用模式">
          <button type="button" role="tab" aria-selected={mode === "normal"} aria-keyshortcuts="Alt+1" title="常规模式 · Alt+1" onClick={() => void onOpenApplication(app, "normal")}>常规</button>
          <button type="button" role="tab" aria-selected={mode === "ai-work"} aria-keyshortcuts="Alt+2" title="AI Work · Alt+2" onClick={() => void onOpenApplication(app, "ai-work")}>AI Work</button>
        </div>
        <div className="module-center__actions">
          <span className={`module-runtime-state${serverState === "online" ? " is-connected" : ""}`}><i aria-hidden="true" />{statusLabel}</span>
          {settings.general.showBottomPanelControl && (chrome.rightCollapsed || metrics.mode !== "desktop") ? <PanelControl name="terminal" title="底部终端" shortcut={settings.shortcuts.toggleBottomPanel.join(" / ")} active={chrome.terminalOpen} onClick={toggleTerminal} /> : null}
          {(chrome.rightCollapsed || metrics.mode !== "desktop") ? <PanelControl name="panelRight" title="上下文栏" shortcut={settings.shortcuts.toggleContextPanel.join(" / ")} active={!chrome.rightCollapsed} onClick={toggleRight} /> : null}
        </div>
      </header>
      <main ref={moduleContentScroll.ref} onScroll={moduleContentScroll.onScroll} className={`module-center__content${mode === "ai-work" ? " module-center__content--ai-work" : ""}`} aria-label={mode === "ai-work" ? `${selectedApp.title} AI Work 对话` : undefined} aria-labelledby={mode === "normal" && app !== "minecraft" ? "module-heading" : undefined}>
        {mode === "ai-work" ? <>
          {error ? <Alert className="page-alert" type="error" showIcon message={error} /> : null}
          <AiWorkChat
            userId={userId}
            appId={app}
            settings={settings}
            sessions={aiSessions}
            activeSessionId={activeAiSessionId}
            initialDraft={aiDraft}
            newSessionKey={newAiSessionKey}
            onSessionsChange={setAiSessions}
            onActiveSessionChange={onActiveAiSessionChange}
            onDraftChange={onAiDraftChange}
            onProviderStatusChange={setAiProviderStatus}
            onBusyChange={setAiChatBusy}
            onOpenSettings={onOpenSettings}
            onNotification={addNotification}
          />
        </> : app === "minecraft" ? <MinecraftWorkspace userId={userId} section={section} role={role} onNavigate={navigateWithinApplication} onContentReady={setMinecraftContentReady} /> : <>
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
    <aside className="module-context" aria-label="工具与资源" data-layout-mode={metrics.mode}>
      {metrics.mode === "desktop" && !chrome.rightCollapsed ? <header className="module-context__shell-actions">
          {settings.general.showBottomPanelControl ? <PanelControl name="terminal" title="底部终端" shortcut={settings.shortcuts.toggleBottomPanel.join(" / ")} active={chrome.terminalOpen} onClick={toggleTerminal} /> : null}
          <PanelControl name="panelRight" title="收起上下文栏" shortcut={settings.shortcuts.toggleContextPanel.join(" / ")} active onClick={toggleRight} />
      </header> : null}
      <div ref={contextBodyScroll.ref} onScroll={contextBodyScroll.onScroll} className="module-context__body">
      <header className="module-context__heading"><div><strong>工具与资源</strong><span>Runtime Registry</span></div><span className={`module-context__connection module-context__connection--${serverState}`}><i aria-hidden="true" />{serverState === "online" ? "已连接" : serverState === "checking" ? "检查中" : "未连接"}</span><button className="module-shell-icon-button module-context__close" type="button" aria-label="收起工具与资源" title="收起工具与资源" onClick={toggleRight}><WorkbenchIcon name="close" size={15} /></button></header>
        <div className="module-context__tools">
          {settings.general.showBottomPanelControl ? <button type="button" onClick={openTerminal} aria-keyshortcuts={settings.shortcuts.openTerminal.map((chord) => chord.replace("Ctrl", "Control")).join(" ")}><WorkbenchIcon name="terminal" size={16} /><span>终端</span><kbd>{settings.shortcuts.openTerminal.join(" / ") || "未分配"}</kbd></button> : null}
          <button type="button" disabled title="当前 Web Host 尚未接入审查工具"><WorkbenchIcon name="review" size={16} /><span>审查</span><kbd>待接入</kbd></button>
          <button type="button" disabled title="当前 Web Host 尚未接入浏览器工具"><WorkbenchIcon name="browser" size={16} /><span>浏览器</span><kbd>待接入</kbd></button>
          <button type="button" disabled title="当前 Web Host 尚未接入文件工具"><WorkbenchIcon name="file" size={16} /><span>文件</span><kbd>待接入</kbd></button>
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
        <div className="module-context__account"><WorkbenchIcon name="user" size={15} /><span>{username}</span><small>{role === "admin" ? "管理员" : "普通账户"}</small></div>
      </div>
    </aside>
  );

  const bottom = (
    <section className="module-terminal" aria-label="底部终端面板">
      <header className="module-terminal__header"><div><WorkbenchIcon name="terminal" size={15} /><strong>终端</strong><span>当前宿主未提供终端后端</span></div><button className="module-shell-icon-button" type="button" aria-label="关闭底部终端" title="关闭终端" onClick={() => setChrome((current) => ({ ...current, terminalOpen: false }))}><WorkbenchIcon name="close" size={15} /></button></header>
      <div className="module-terminal__body"><span className="module-terminal__prompt">LFAA</span><span>当前宿主没有提供终端后端，暂时无法执行命令。</span></div>
    </section>
  );

  const previewStyle = { "--module-left-preview-width": `${leftPaneWidth}px` } as CSSProperties;
  return (
    <div className="module-workbench-stage" style={previewStyle} data-layout-mode={metrics.mode}>
      <NavigationRail username={username} role={role} serverState={serverState} shortcuts={settings.shortcuts} onBack={onBack} onModeHome={onModeHome} onOpenSettings={onOpenSettings} onLogout={onLogout} onToggleRight={toggleRight} />
      <div ref={layoutRef} className="module-workbench-layout" data-layout-mode={metrics.mode}>
        {chrome.leftCollapsed && metrics.mode !== "mobile" ? <div className={`module-left-preview${leftPreviewOpen ? " is-visible" : ""}`} data-layout-mode={metrics.mode} aria-hidden={!leftPreviewOpen} onMouseEnter={openLeftPreview} onMouseLeave={closeLeftPreview}>{left}</div> : null}
        <ResizableWorkbench
          left={left}
          center={center}
          right={right}
          rightPaneSwapped={chrome.rightSwapped && !chrome.rightCollapsed}
          onSwapPanes={togglePaneOrder}
          bottom={bottom}
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
          bottomOpen={chrome.terminalOpen}
          onBottomOpenChange={(terminalOpen) => setChrome((current) => ({ ...current, terminalOpen }))}
        />
      </div>
    </div>
  );
}
