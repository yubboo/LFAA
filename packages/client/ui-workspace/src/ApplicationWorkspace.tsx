import { loadAiSkillDirectory } from "lfaa-client-connection/src/api.js";
/**
 * 文件：ApplicationWorkspace.tsx
 * 功能：装配 SteamCMD、Minecraft、写作应用内部的工作台界面。
 * 作用：连接导航轨、应用侧栏、中心工作区、右侧工具栏和底部终端区域，并提供设置入口、通知卡片与工作区 Chrome 状态。
 * 关联文件：packages/client/ui-layout/src/Workbench.tsx、packages/client/ui-settings/src/SettingsPage.tsx、packages/client/ui-sidebar/src/GlobalNavigationRail.tsx、packages/client/resources/src/notification-runtime.ts、packages/client/store/src/scroll-restoration.ts、packages/client/ui-dockkit/src/ResizableWorkbench.tsx、packages/client/ui-workspace/src/module-workbench.css 与 css/workbench-regions.css。
 * 修改注意事项：工作区导航只负责切换界面；用户设置与快捷键保存由设置页面和控制端 API 负责。
 */
import { DshSlotOutlet, loadClientModule } from "lfaa-client-modules/src/client/index.js";
import { APPLICATION_ROUTE_PATTERN } from "lfaa-util-values/src/application-id.js";
import { sidebarRightRuntime, useSidebarRightSnapshot } from "./sidebar-right-runtime.js";
import { shouldAutoOpenGitSummary } from "./git-summary-layout.config.js";
import { AiWorkProjectFileDock } from "./AiWorkProjectFileDock.js";
import { openWorkspaceProjectManager } from "lfaa-client-ui-chat/src/project-manager-events.js";
import { setFileManagerLocation } from "lfaa-client-connection/src/file-manager-location.js";
import { TerminalManagerRightSidebar } from "lfaa-client-ui-sidebar-terminal/src/index.js";

import { createElement, lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent as ReactFormEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { Alert, Button, Dropdown, Popover, Segmented, Tag, Typography } from "antd";
import { archiveAiSession, getErrorMessage, initializeDefaultWorkspace, isDesktopApp, hasAdminAccess, loadAiExtensions, loadAiSessions, loadAgentGitRepositories, ensureAgentGitSessionRepository, loadAgentGitStatus, loadBrowserRecentSites, recordBrowserRecentSites, loadWorkspaceProjects, loadWorkspaceSessionDirectoryAvailability, loadWritingWorkspace, userRoleLabel, type AgentGitRepository, type AiActivityFileChange, type AiExtension, type AiSession, type AiWorkbenchView, type ApplicationId, type ApplicationMode, type BrowserProviderId, type BrowserRecentSite, type UserRole, type UserSettings, type WorkspaceDaemonNode, type WorkspaceGitStatus, type WorkspaceProject, type WritingWorkspace as WritingWorkspaceData } from "lfaa-client-connection/src/api.js";
import type { AiWorkGoalRequest, AiWorkNotification, AiWorkNotificationInput } from "lfaa-client-resources/src/notification-runtime.js";
import { hasUnreadSessionCompletionNotification } from "./session-completion-indicator.js";
import { resolveWorkbenchLayoutMetrics, type WorkbenchLayoutMetrics } from "lfaa-client-ui-dockkit/src/workbench-layout.config.js";
import type { WorkbenchLayoutMode } from "lfaa-client-ui-dockkit/src/workbench-layout.types.js";
import { ResizableWorkbench } from "lfaa-client-ui-dockkit/src/ResizableWorkbench.js";
import { readWorkbenchLeadingInsetWidth, useWorkbenchMetrics } from "lfaa-client-ui-dockkit/src/use-workbench-metrics.js";
import { readWorkbenchLeftWidth, saveWorkbenchLeftWidth } from "lfaa-client-ui-dockkit/src/workbench-preferences.js";
import { createScrollRestorationKey, useScrollRestoration } from "lfaa-client-store/src/scroll-restoration.js";
import { MAX_PINNED_AI_SESSIONS, readPinnedAiSessionIds, writePinnedAiSessionIds } from "lfaa-client-store/src/ai-session-pins.js";
import { MAX_AI_WORK_SIDEBAR_GROUP_PREFERENCES, MAX_AI_WORK_SIDEBAR_VISIBLE_SESSIONS, readAiWorkSidebarPreferences, writeAiWorkSidebarPreferences, type AiWorkSidebarPreferences } from "lfaa-client-store/src/ai-work-sidebar.js";
import { ServiceStatus, type ServiceState } from "lfaa-client-ui-primitives/src/ServiceStatus.js";
import { GLOBAL_NAVIGATION_RAIL_COMPACT_WIDTH, GLOBAL_NAVIGATION_RAIL_WIDTH, GlobalNavigationRail, type ApplicationNavigationItem } from "lfaa-client-ui-sidebar/src/GlobalNavigationRail.js";
import { SecondaryNavigation, type SecondaryNavigationGroup } from "lfaa-client-ui-sidebar/src/SecondaryNavigation.js";
import { resolveShortcutSettings } from "lfaa-client-ui-settings-general/src/default-settings.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import { resolveBrowserAddress } from "lfaa-client-ui-sidebar-browser/src/browser-address.js";
import { BUILTIN_BROWSER_WORKSPACE_ID } from "lfaa-util-values/src/browser-provider.js";
import { matchesAgentBrowserDockSyncRequest, shouldSyncAgentBrowserDockPage, type BrowserDockAgentSyncRequest } from "./browser-dock-sync.js";
import { createAgentWorkbenchView } from "./agent-workbench-view.js";
import type { BrowserDockTabsUpdate } from "lfaa-client-ui-sidebar-browser/src/browser-tabs-update.js";
import { TaskTerminal } from "./TaskTerminal.js";
import "./module-workbench.css";
import "./css/secondary-navigation.css";
import "./css/center-workspace.css";
import "./css/right-menu.css";
import "./css/workbench-regions.css";

// 按当前应用模式分别加载业务面板，避免工作台外壳等待无关应用代码。
const AiWorkChat = lazy(() => loadClientModule<typeof import("lfaa-client-ui-chat/src/AiWorkChat.js")>("lfaa-client-ui-chat/src/AiWorkChat.js").then((module) => ({ default: module.AiWorkChat })));
const AiWorkSideChat = lazy(() => loadClientModule<typeof import("lfaa-client-ui-chat/src/AiWorkSideChat.js")>("lfaa-client-ui-chat/src/AiWorkSideChat.js").then((module) => ({ default: module.AiWorkSideChat })));
const CanvasWorkspace = lazy(() => loadClientModule<typeof import("lfaa-client-ui-workspace/src/CanvasWorkspace.js")>("lfaa-client-ui-workspace/src/CanvasWorkspace.js").then(module => ({ default: module.CanvasWorkspace })));
const MinecraftWorkflowCanvas = lazy(() => loadClientModule<typeof import("lfaa-client-ui-minecraft/src/MinecraftWorkflowCanvas.js")>("lfaa-client-ui-minecraft/src/MinecraftWorkflowCanvas.js").then(module => ({ default: module.MinecraftWorkflowCanvas })));
const ApplicationWorkflowCanvas = lazy(() => loadClientModule<typeof import("lfaa-client-ui-workflow/src/ApplicationWorkflowCanvas.js")>("lfaa-client-ui-workflow/src/ApplicationWorkflowCanvas.js").then(module => ({ default: module.ApplicationWorkflowCanvas })));
const BrowserPanel = lazy(() => loadClientModule<typeof import("lfaa-client-ui-sidebar-browser/src/BrowserPanel.js")>("lfaa-client-ui-sidebar-browser/src/BrowserPanel.js").then(module => ({ default: module.BrowserPanel })));
const GitChangeSummary = lazy(() => import("./GitChangeSummary.js").then((module) => ({ default: module.GitChangeSummary })));
const AgentAssetLibrary = lazy(() => loadClientModule<typeof import("lfaa-client-ui-deliverables/src/AgentAssetLibrary.js")>("lfaa-client-ui-deliverables/src/AgentAssetLibrary.js").then(module => ({ default: module.AgentAssetLibrary })));
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

type BrowserOpenTab = { id: string; title: string; url: string; active: boolean };

type WorkspaceUtilityTab = {
  id: string;
  kind: "new" | "git" | "assets" | "applications" | "side-chat" | "extension" | "project-file";
  projectId?: string;
  filePath?: string;
  sourceId?: string;
  initialView?: "source" | "diff";
  browserUrl?: string;
  extensionId?: string;
  browserNavigationRequest?: { id: string; url: string };
  browserActionRequest?: { id: string; action: "back" | "forward" | "reload" };
};

function findGitWorkspaceUtilityTab(tabs: WorkspaceUtilityTab[]): WorkspaceUtilityTab | undefined {
  return tabs.find(tab => tab.kind === "git");
}

function findAssetWorkspaceUtilityTab(tabs: WorkspaceUtilityTab[]): WorkspaceUtilityTab | undefined {
  return tabs.find(tab => tab.kind === "assets");
}

function browserSiteHost(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

function browserAddressForDisplay(address: string, showFullUrl: boolean, focused: boolean): string {
  if (!address || showFullUrl || focused) return address;
  try {
    const parsed = new URL(address);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.origin : address;
  } catch { return address; }
}

function browserVisitTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const now = new Date();
  const sameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  return new Intl.DateTimeFormat(undefined, { ...(sameDay ? {} : { month: "numeric", day: "numeric" }), hour: "2-digit", minute: "2-digit" }).format(date);
}

interface ApplicationWorkspaceProps {
  userId: string;
  app: ApplicationId;
  mode: ApplicationMode;
  section: string;
  gameLibrary?: boolean;
  workspaceTitle?: string;
  applicationContent?: ReactNode;
  canvasWorkspace?: {
    applicationId: ApplicationId;
    initialProjectId?: string;
    applications: Array<{ title: string; applicationId: ApplicationId }>;
  };
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
  onOpenSelectedApplication: () => Promise<void>;
  onOpenSettings: (section?: "ai" | "permissions", focusTarget?: string) => void;
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
  onMarkSessionNotificationsRead: (appId: ApplicationId, sessionId: string) => void;
  onClearNotifications: () => void;
  onOpenNotification: (notification: AiWorkNotification) => void;
  onActiveAiSessionChange: (sessionId: string | null) => void;
  onAiDraftChange: (draft: string) => void;
  onAiWorkGoalConsumed: (requestId: string) => void;
  onLogout: () => void;
}

interface ChromeState {
  leftCollapsed: boolean;
  centerCollapsed: boolean;
  rightCollapsed: boolean;
  terminalOpen: boolean;
}

const CHROME_KEY = "lfaa.module-workbench.chrome.v2";
const LEGACY_CHROME_KEY = "lfaa.module-workbench.chrome.v1";
const LAYOUT_KEY = "lfaa.module-workbench.layout.v1";
const aiExtensionSnapshots = new Map<string, AiExtension[]>();
const aiSessionSnapshots = new Map<string, AiSession[]>();
const workspaceProjectSnapshots = new Map<string, { projects: WorkspaceProject[]; nodes: WorkspaceDaemonNode[]; truncated: boolean; defaultProjectId?: string | null }>();
const canvasChatOpenByApplication = new Map<string, boolean>();
let canvasChatStateOwnerId: string | null = null;

function getCanvasChatOpenOverride(userId: string, applicationId: string): boolean | undefined {
  if (canvasChatStateOwnerId !== userId) {
    canvasChatOpenByApplication.clear();
    canvasChatStateOwnerId = userId;
  }
  return canvasChatOpenByApplication.get(applicationId);
}

function setCanvasChatOpenOverride(userId: string, applicationId: string, open: boolean): void {
  if (canvasChatStateOwnerId !== userId) {
    canvasChatOpenByApplication.clear();
    canvasChatStateOwnerId = userId;
  }
  if (!canvasChatOpenByApplication.has(applicationId) && canvasChatOpenByApplication.size >= 32) {
    const oldestApplicationId = canvasChatOpenByApplication.keys().next().value;
    if (oldestApplicationId) canvasChatOpenByApplication.delete(oldestApplicationId);
  }
  canvasChatOpenByApplication.set(applicationId, open);
}
// 项目侧栏每次按产品约定最多追加 5 条会话。
const AI_WORK_PROJECT_SESSION_PAGE_SIZE = 5;
const emptySessionDirectoryIds: ReadonlySet<string> = new Set();
const initializedDefaultWorkspaceUsers = new Set<string>();
const emptySessionFileChanges: AiActivityFileChange[] = [];
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
  if (mode === "mobile") return { leftCollapsed: true, centerCollapsed: false, rightCollapsed: true, terminalOpen: false };
  if (mode === "compact") return { leftCollapsed: false, centerCollapsed: false, rightCollapsed: true, terminalOpen: false };
  return { leftCollapsed: false, centerCollapsed: false, rightCollapsed: false, terminalOpen: false };
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
      centerCollapsed: Boolean(value.centerCollapsed),
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

interface ApplicationSidebarProps extends Pick<ApplicationWorkspaceProps, "userId" | "app" | "mode" | "section" | "gameLibrary" | "workspaceTitle" | "apps" | "applicationNavigationItems" | "onNavigate" | "onOpenApplication" | "onOpenSelectedApplication"> {
  layoutMode: WorkbenchLayoutMode;
  onWritingLibraryPortalTargetChange: (target: HTMLDivElement | null) => void;
  onToggleLeft: () => void;
  notifications: AiWorkNotification[];
  onMarkNotificationsRead: () => void;
  onMarkSessionNotificationsRead: (appId: ApplicationId, sessionId: string) => void;
  onClearNotifications: () => void;
  onOpenNotification: (notification: AiWorkNotification) => void;
  sessions: AiSession[];
  missingSessionDirectoryIds: ReadonlySet<string>;
  aiDraft: string;
  pinnedSessionIds: string[];
  onTogglePinnedSession: (sessionId: string) => void;
  workspaceProjects: WorkspaceProject[];
  workspaceProjectsReady: boolean;
  sessionsDataReady: boolean;
  recentSessionsExpandRequestId: number;
  projectLoadError: string;
  onRetryProjects: () => void;
  activeSessionId: string | null;
  sessionsLoading: boolean;
  sessionsError: string;
  providerStatus: string | null;
  gitSummaryOpen: boolean;
  gitSummaryContent: ReactNode;
  onNewSession: (projectId?: string) => void;
  onSelectSession: (sessionId: string) => void;
  onArchiveSession: (session: AiSession) => void;
  onCloseGitSummary: () => void;
  onPreviewMouseLeave: () => void;
  onPreviewBlur: () => void;
}

function ApplicationSidebar({ userId, app, mode, section, gameLibrary, workspaceTitle, apps, applicationNavigationItems, layoutMode, onWritingLibraryPortalTargetChange, onNavigate, onOpenApplication, onOpenSelectedApplication, onToggleLeft, notifications, onMarkNotificationsRead, onMarkSessionNotificationsRead, onClearNotifications, onOpenNotification, sessions, missingSessionDirectoryIds, aiDraft, pinnedSessionIds, onTogglePinnedSession, workspaceProjects, workspaceProjectsReady, sessionsDataReady, recentSessionsExpandRequestId, projectLoadError, onRetryProjects, activeSessionId, sessionsLoading, sessionsError, providerStatus, gitSummaryOpen, gitSummaryContent, onNewSession, onSelectSession, onArchiveSession, onCloseGitSummary, onPreviewMouseLeave, onPreviewBlur }: ApplicationSidebarProps) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [sessionMenuId, setSessionMenuId] = useState<string | null>(null);
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
  const recentSessions = appSessions.filter(session => !pinnedSessionSet.has(session.id));
  const hasDraft = app === "workspace" && Boolean(aiDraft.trim());
  const sessionsScroll = useScrollRestoration(createScrollRestorationKey(userId, "module-session-list", app), !sessionsLoading);
  const nextMode: ApplicationMode = mode === "normal" ? "ai-work" : "normal";
  const nextModeLabel = nextMode === "normal" ? "应用" : "工作";
  const unreadNotifications = notifications.filter((notification) => !notification.read).length;
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
  const renderSession = (session: AiSession, nested = false) => {
    const isPinned = pinnedSessionSet.has(session.id);
    const directoryMissing = missingSessionDirectoryIds.has(session.id);
    const hasUnreadCompletion = hasUnreadSessionCompletionNotification(notifications, session.appId, session.id);
    const menu = { items: [
      { key: "pin", label: isPinned ? "取消置顶" : "置顶" },
      { key: "archive", label: "归档", icon: <WorkbenchIcon name="archive" size={14} /> },
    ], onClick: ({ key }: { key: string }) => {
      setSessionMenuId(null);
      if (key === "pin") onTogglePinnedSession(session.id);
      if (key === "archive") onArchiveSession(session);
    } };
    return <Dropdown key={session.id} menu={menu} trigger={isDesktopApp() ? ["contextMenu"] : []}
      open={sessionMenuId === session.id} onOpenChange={open => setSessionMenuId(open ? session.id : null)}
      placement="bottomRight" autoAdjustOverflow overlayClassName="module-session-menu"
      getPopupContainer={trigger => trigger.closest<HTMLElement>(".module-workbench-stage") ?? trigger.parentElement!}>
      <div className={`module-sidebar__session${nested ? " module-sidebar__session--nested" : ""}${session.id === activeSessionId ? " is-active" : ""}${directoryMissing ? " is-project-directory-missing" : ""}`}>
        <button type="button" aria-current={session.id === activeSessionId ? "page" : undefined} aria-label={`${session.title}${hasUnreadCompletion ? "，有未读的回复完成提醒" : ""}`} onClick={() => { setSessionMenuId(null); if (hasUnreadCompletion) onMarkSessionNotificationsRead(session.appId, session.id); onSelectSession(session.id); if (layoutMode === "mobile") onToggleLeft(); }} title={`${directoryMissing ? `${session.title} · 项目目录已删除或移动，历史记录仍可查看` : session.title}${hasUnreadCompletion ? " · 回复已完成，打开会话查看" : ""}`}><WorkbenchIcon name="history" size={14} /><span>{session.title}</span></button>
        <div className="module-sidebar__session-actions">
          {hasUnreadCompletion ? <span className="module-sidebar__session-completion-dot" aria-hidden="true" /> : null}
          <button type="button" aria-label={`会话菜单：${session.title}`} aria-haspopup="menu" aria-expanded={sessionMenuId === session.id} title="会话菜单" onClick={event => { event.stopPropagation(); setSessionMenuId(current => current === session.id ? null : session.id); }}><WorkbenchIcon name="dots" size={15} /></button>
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
        {visibleSessions.map(session => renderSession(session, true))}
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

  useEffect(() => {
    if (!notificationsOpen) return;
    const dismissEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNotificationsOpen(false);
    };
    window.addEventListener("keydown", dismissEscape);
    return () => window.removeEventListener("keydown", dismissEscape);
  }, [notificationsOpen]);

  return (
    <div className="module-sidebar" data-ui="left-sidebar" data-layout-mode={layoutMode} onMouseLeave={onPreviewMouseLeave} onBlur={onPreviewBlur}>
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
          <button className="module-icon-button module-sidebar__close" type="button" aria-label="收起应用导航" title="收起应用导航" onClick={() => { setNotificationsOpen(false); onCloseGitSummary(); onToggleLeft(); }}><WorkbenchIcon name="close" size={16} /></button>
        </div>
      </header>
      {mode === "normal" ? <ApplicationNavigationPanel
        userId={userId}
        app={app}
        mode={mode}
        section={section}
        gameLibrary={gameLibrary}
        workspaceTitle={workspaceTitle}
        apps={apps}
        applicationNavigationItems={applicationNavigationItems}
        onNavigate={onNavigate}
        onOpenApplication={onOpenApplication}
        onWritingLibraryPortalTargetChange={onWritingLibraryPortalTargetChange}
        hidden={false}
      /> : null}
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
                {recentSessions.map(session => renderSession(session))}
              </div>
            </section> : null}
          </>}
          {!sessionsLoading && !appSessions.length ? <span className="module-sidebar__session-message">还没有会话</span> : null}
        </div>
        <div className="module-sidebar__provider"><Tag color={providerStatus && providerStatus !== "未配置模型" && providerStatus !== "模型状态不可用" ? "green" : "default"}>{providerStatus ?? "正在读取模型…"}</Tag></div>
        </>}
      </section> : null}
      <div className="module-sidebar__footer">
        <span>当前区域</span>
        <strong>{mode === "normal" ? "应用面板" : "智能体工作区"}</strong>
      </div>
    </div>
  );
}

interface ApplicationNavigationPanelProps extends Pick<ApplicationWorkspaceProps, "app" | "mode" | "section" | "gameLibrary" | "workspaceTitle" | "apps" | "applicationNavigationItems" | "onNavigate" | "onOpenApplication"> {
  userId: string;
  hidden: boolean;
  onWritingLibraryPortalTargetChange: (target: HTMLDivElement | null) => void;
}

function ApplicationNavigationPanel({ userId, app, mode, section, gameLibrary = false, workspaceTitle, apps, applicationNavigationItems, hidden, onNavigate, onOpenApplication, onWritingLibraryPortalTargetChange }: ApplicationNavigationPanelProps) {
  const appMenuScroll = useScrollRestoration(createScrollRestorationKey(userId, "module-app-menu", app));
  const minecraftMenuCategory = section === "java" ? "environment" : section === "overview" || section === "nodes" ? "monitor" : "management";
  const minecraftLogsSection = section === "logs" || section.startsWith("logs/") || /^instance\/[0-9a-f-]{36}\/logs$/iu.test(section);
  const minecraftInstanceSection = section.startsWith("instance/") && !minecraftLogsSection;
  const currentApplicationTitle = workspaceTitle ?? apps.find(item => item.id === app)?.title ?? "当前应用";
  const applicationNavigationGroups = useMemo<SecondaryNavigationGroup[]>(() => {
    const createItems = (items: ApplicationNavigationItem[]): SecondaryNavigationGroup["items"] => items.map<SecondaryNavigationGroup["items"][number]>((item) => ({
      id: `module-context-application-${item.id}`,
      label: item.title,
      description: item.description,
      icon: item.id === "games" || item.id === "canvas" ? "grid"
        : item.id === "steamcmd" ? "terminal"
          : item.id === "minecraft" ? "monitor"
            : item.id === "connectivity" ? "branch"
              : item.id === "writing" ? "book" : "spark",
      trailingIcon: "chevron",
      active: Boolean(item.applicationId && item.applicationId === app || item.id === "games" && gameLibrary),
      onSelect: () => {
        if (item.route) onNavigate(item.route);
        else if (item.applicationId) void onOpenApplication(item.applicationId, "ai-work").catch(() => undefined);
      },
    }));
    const domainApplications = applicationNavigationItems.filter(item => item.id !== "canvas");
    const sharedCapabilities = applicationNavigationItems.filter(item => item.id === "canvas");
    return [
      ...(domainApplications.length > 0 ? [{
        id: "module-context-domain-applications",
        label: "领域应用",
        collapsible: false,
        items: createItems(domainApplications),
      }] : []),
      ...(sharedCapabilities.length > 0 ? [{
        id: "module-context-shared-capabilities",
        label: "系统共享能力",
        collapsible: false,
        items: createItems(sharedCapabilities),
      }] : []),
    ];
  }, [app, applicationNavigationItems, gameLibrary, onNavigate, onOpenApplication]);

  const locationClassName = mode === "normal" ? "module-context__applications module-sidebar__application-navigation" : "module-context__applications";
  return <section className={locationClassName} id="module-context-applications" aria-label={mode === "normal" ? `${currentApplicationTitle}功能导航` : "领域应用与共享能力导航"} hidden={hidden}>
    <div ref={appMenuScroll.ref} onScroll={appMenuScroll.onScroll} className="module-context__application-menu">
      <header className="module-context__heading"><div><strong>{mode === "normal" ? currentApplicationTitle : "应用与能力"}</strong><span>{mode === "normal" ? "当前应用功能" : "领域应用 · 跨应用共享能力"}</span></div></header>
      {mode === "ai-work" ? <button className="module-context__canvas-entry" type="button" onClick={() => onNavigate(`/apps/${app}/canvas`)} aria-label={`打开 ${applicationNavigationItems.find(item => item.applicationId === app)?.title ?? app} 的项目画布`} title="系统级共享能力：画布可绑定当前领域项目">
        <WorkbenchIcon name="grid" size={16} />
        <span><strong>当前项目画布</strong><small>系统共享能力 · 绑定当前领域</small></span>
        <WorkbenchIcon name="chevron" size={14} />
      </button> : null}
      {app === "writing" && mode === "normal" ? <div ref={onWritingLibraryPortalTargetChange} className="module-context__writing-library-portal" /> : null}
      {mode === "ai-work" ? <SecondaryNavigation ariaLabel="工作台入口导航" className="module-context__application-navigation" groups={applicationNavigationGroups} activateOnArrow /> : null}
      {gameLibrary && app === "workspace" && mode === "normal" ? <nav className="module-context__app-menu" aria-label="游戏服务菜单">
        <div className="module-context__section-title"><span>游戏服务</span></div>
        {([["/games", "服务总览"], ["/games/environments", "运行环境"], ["/games/minecraft", "Minecraft 服务端"], ["/games/steamcmd", "Steam 游戏服务器"]] as const).map(([path, label]) => {
          const active = path === "/games" ? section === "library" : path.endsWith("/environments") && section === "environments";
          return <button type="button" key={path} className={`module-context__menu-item${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined} onClick={() => onNavigate(path)}><span aria-hidden="true" />{label}</button>;
        })}
      </nav> : null}
      {app === "steamcmd" && mode === "normal" ? <nav className="module-context__app-menu" aria-label="Steam 游戏服务器菜单">
        <div className="module-context__section-title"><span>Steam 游戏服务器</span></div>
        <button type="button" className={`module-context__menu-item${section === "overview" ? " is-active" : ""}`} aria-current={section === "overview" ? "page" : undefined} onClick={() => onNavigate("/games/steamcmd")}><span aria-hidden="true" />服务器工作区</button>
      </nav> : null}
      {app === "minecraft" && mode === "normal" ? <nav className="module-context__app-menu" aria-label="Minecraft 工作区菜单">
        <div className="module-context__section-title"><span>Minecraft 工作区</span></div>
        <div className="module-context__menu-tabs" role="group" aria-label="Minecraft 工作区分类">
          <button type="button" aria-pressed={minecraftMenuCategory === "monitor"} onClick={() => onNavigate("/games/minecraft/overview")}>监控</button>
          <button type="button" aria-pressed={minecraftMenuCategory === "management"} onClick={() => onNavigate("/games/minecraft/instances")}>管理</button>
          <button type="button" aria-pressed={minecraftMenuCategory === "environment"} onClick={() => onNavigate("/games/minecraft/java")}>环境</button>
        </div>
        {(minecraftMenuCategory === "monitor"
          ? [["overview", "总览"], ["nodes", "控制节点"]]
          : minecraftMenuCategory === "management"
            ? [["deployment", "部署"], ["instances", "实例"], ["tasks", "任务"], ["workflows", "工作流"], ["files", "文件管理"], ["logs", "日志"]]
            : [["java", "Java 环境"]]
        ).map(([key, label]) => {
          const active = key === "logs" ? minecraftLogsSection : section === key || key === "instances" && minecraftInstanceSection;
          return <button type="button" key={key} className={`module-context__menu-item${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined} onClick={() => onNavigate(key === "files" ? "/files" : `/games/minecraft/${key}`)}><span aria-hidden="true" />{label}</button>;
        })}
      </nav> : null}
      {app === "connectivity" && mode === "normal" ? <nav className="module-context__app-menu" aria-label="联机管理菜单">
        <div className="module-context__section-title"><span>联机管理</span></div>
        {[["overview", "总览"], ["room-domain", "房间域名"], ["self-managed", "自备穿透"], ["providers", "穿透 Provider"], ["plugins", "组网与扩展"]].map(([key, label]) => <button type="button" key={key} className={`module-context__menu-item${section === key ? " is-active" : ""}`} aria-current={section === key ? "page" : undefined} onClick={() => onNavigate(`/apps/connectivity/normal/${key}`)}><span aria-hidden="true" />{label}</button>)}
      </nav> : null}
    </div>
  </section>;
}

function PanelControl({ name, title, shortcut, active, onClick }: { name: "terminal" | "panelRight"; title: string; shortcut: string; active: boolean; onClick: () => void }) {
  const ariaShortcuts = shortcut.split(" / ").map((chord) => chord.replace("Ctrl", "Control")).join(" ");
  return <button className="module-panel-control" type="button" aria-label={title} aria-keyshortcuts={ariaShortcuts} aria-pressed={active} title={`${title} · ${shortcut || "未分配"}`} onClick={onClick}><WorkbenchIcon name={name} size={16} /><span>{title}</span></button>;
}

export function ApplicationWorkspace({ userId, app, mode, section, gameLibrary = false, workspaceTitle, applicationContent, canvasWorkspace, apps, applicationNavigationItems, username, role, serverState, error, settings, onSettingsChange, onBack, onOpenSelectedApplication, onNavigate, onOpenSettings, onOpenApplication, recentSessionsOpenRequestId, onRecentSessionsOpenRequestHandled, rightPanelSection, onRightPanelSectionChange, applicationsOpenRequestId, onApplicationsOpenRequestHandled, activeAiSessionId, aiDraft, aiWorkGoal, notifications, onNotification, onMarkNotificationsRead, onMarkSessionNotificationsRead, onClearNotifications, onOpenNotification, onActiveAiSessionChange, onAiDraftChange, onAiWorkGoalConsumed, onLogout }: ApplicationWorkspaceProps) {
  const activeRightPanelSection = mode === "normal" ? "context" : rightPanelSection;
  const voiceMode = app === "workspace" && mode === "ai-work" && section === "voice";
  // 旧版 Host 可能缺少后续新增的快捷键项；由 Settings 默认值补齐，不覆盖已保存的空数组。
  const shortcuts = useMemo(() => resolveShortcutSettings(settings.shortcuts), [settings.shortcuts]);
  const sideChatShortcuts = shortcuts.openSideChat;
  const layoutRef = useRef<HTMLDivElement>(null);
  const previewCloseTimer = useRef<number | null>(null);
  const leftPreviewTriggerRef = useRef<HTMLButtonElement>(null);
  const responsiveAppDock = true;
  const metrics = useWorkbenchMetrics(layoutRef, () => initialMetrics(responsiveAppDock), responsiveAppDock, readWorkbenchLeadingInsetWidth);
  const leftPreviewContextRef = useRef({ app, mode, section, layoutMode: metrics.mode });
  const sidebarRight = useSidebarRightSnapshot();
  const [chrome, setChrome] = useState(() => readChrome(metrics.mode, responsiveAppDock));
  const [canvasChatOpen, setCanvasChatOpenState] = useState(() => getCanvasChatOpenOverride(userId, canvasWorkspace?.applicationId ?? app) ?? settings.canvas.agentPanelDefaultOpen);
  const canvasChatContextRef = useRef({ userId, applicationId: canvasWorkspace?.applicationId ?? app, isCanvas: Boolean(canvasWorkspace), defaultOpen: settings.canvas.agentPanelDefaultOpen });
  const canvasChatApplicationId = canvasWorkspace?.applicationId;
  const setCanvasChatOpen = useCallback((open: boolean) => {
    if (canvasChatApplicationId) setCanvasChatOpenOverride(userId, canvasChatApplicationId, open);
    setCanvasChatOpenState(open);
  }, [canvasChatApplicationId, userId]);
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
  const [missingSessionDirectoryState, setMissingSessionDirectoryState] = useState<{ key: string; ids: ReadonlySet<string> }>({ key: "", ids: new Set() });
  const [sessionDirectoryCheckRequest, setSessionDirectoryCheckRequest] = useState<{ sessionId: string; requestId: number } | null>(null);
  const sessionDirectoryCheckSequence = useRef(0);
  const sessionDirectoryBindings = useMemo(() => aiSessions.filter(session => !session.archived && session.projectId).slice(0, 200).map(session => [session.id, session.projectId] as [string, string | null]).sort(([firstId], [secondId]) => firstId.localeCompare(secondId)), [aiSessions]);
  const sessionDirectorySignature = useMemo(() => JSON.stringify(sessionDirectoryBindings), [sessionDirectoryBindings]);
  const aiSessionsRequestRef = useRef<{ userId: string; controller: AbortController } | null>(null);
  const [pinnedSessionState, setPinnedSessionState] = useState(() => ({ userId, ids: readPinnedAiSessionIds(userId) }));
  const pinnedSessionIds = pinnedSessionState.userId === userId ? pinnedSessionState.ids : [];
  const [recentSessionsExpandRequestId, setRecentSessionsExpandRequestId] = useState(0);
  const [workspaceProjects, setWorkspaceProjects] = useState<WorkspaceProject[]>(() => workspaceProjectSnapshots.get(`${userId}:${app}`)?.projects ?? []);
  const [workspaceProjectsDataScope, setWorkspaceProjectsDataScope] = useState(() => `${userId}:${app}`);
  const workspaceProjectDirectorySignature = useMemo(() => {
    const sessionProjectIds = new Set(sessionDirectoryBindings.map(([, projectId]) => projectId));
    return JSON.stringify(workspaceProjects.filter(project => sessionProjectIds.has(project.id)).map(project => [project.id, project.nodeId, project.sources.map(source => source.path), project.path]).sort(([firstId], [secondId]) => String(firstId).localeCompare(String(secondId))));
  }, [sessionDirectoryBindings, workspaceProjects]);
  const [workspaceNodes, setWorkspaceNodes] = useState<WorkspaceDaemonNode[]>(() => workspaceProjectSnapshots.get(`${userId}:${app}`)?.nodes ?? []);
  const [workspaceProjectsTruncated, setWorkspaceProjectsTruncated] = useState(() => workspaceProjectSnapshots.get(`${userId}:${app}`)?.truncated ?? false);
  const [defaultWorkspaceProjectId, setDefaultWorkspaceProjectId] = useState<string | null>(() => workspaceProjectSnapshots.get(`${userId}:${app}`)?.defaultProjectId ?? null);
  const [workspaceProjectsLoadStatus, setWorkspaceProjectsLoadStatus] = useState<"loading" | "ready" | "error">(() => workspaceProjectSnapshots.has(`${userId}:${app}`) ? "ready" : "loading");
  const [workspaceProjectsError, setWorkspaceProjectsError] = useState("");
  const [workspaceProjectsRevision, setWorkspaceProjectsRevision] = useState(0);
  const [aiSessionsLoading, setAiSessionsLoading] = useState(() => mode === "ai-work" && !aiSessionSnapshots.has(userId));
  const [aiSessionsError, setAiSessionsError] = useState("");
  const [agentGitRepositoryState, setAgentGitRepositoryState] = useState<{ userId: string; repositories: AgentGitRepository[] }>({ userId, repositories: [] });
  const agentGitRepositories = agentGitRepositoryState.userId === userId ? agentGitRepositoryState.repositories : [];
  const [agentGitRepositoriesLoading, setAgentGitRepositoriesLoading] = useState(false);
  const [agentGitRepositoriesError, setAgentGitRepositoriesError] = useState("");
  const [sessionGitBinding, setSessionGitBinding] = useState<{ sessionId: string; repositoryId: string | null; loading: boolean }>({ sessionId: "", repositoryId: null, loading: false });
  const [gitStatusSnapshot, setGitStatusSnapshot] = useState<{ repositoryId: string | null; status: WorkspaceGitStatus | null; loading: boolean; error: string }>({ repositoryId: null, status: null, loading: false, error: "" });
  const [gitManagerRepositoryState, setGitManagerRepositoryState] = useState<{ userId: string; repositoryId: string | null }>({ userId, repositoryId: null });
  const [gitSummaryOpen, setGitSummaryOpen] = useState(false);
  const gitSummaryAvailableOnRunRef = useRef(mode === "ai-work" && !voiceMode && !canvasWorkspace);
  gitSummaryAvailableOnRunRef.current = mode === "ai-work" && !voiceMode && !canvasWorkspace;

  const gitSummaryMobileOnRunRef = useRef(metrics.mode === "mobile");
  gitSummaryMobileOnRunRef.current = metrics.mode === "mobile";
  const handleGitSummaryOpenChangeRef = useRef<(open: boolean) => void>(() => undefined);
  const gitSummaryResponsiveOpenRef = useRef<boolean | null>(null);
  const [gitSummaryShowAllFiles, setGitSummaryShowAllFiles] = useState(false);
  const [gitSummaryActionRepositoryId, setGitSummaryActionRepositoryId] = useState<string | null>(null);
  const [gitManagerActionRequest, setGitManagerActionRequest] = useState<{ repositoryId: string; action: "commit" | "push" | "branch-create" | "branch-switch"; requestId: number } | null>(null);
  const [gitSummaryStatuses, setGitSummaryStatuses] = useState<Record<string, { status?: WorkspaceGitStatus; error?: string }>>({});
  const [sessionFileChangesState, setSessionFileChangesState] = useState<{ sessionId: string | null; changes: AiActivityFileChange[] }>({ sessionId: null, changes: emptySessionFileChanges });
  const gitStatusRequestRevision = useRef(0);
  const gitEnsureRequests = useRef(new Map<string, Promise<AgentGitRepository | null>>());
  const gitManagerActionRequestRevision = useRef(0);
  const gitSummaryActionMenuRef = useRef<HTMLDivElement | null>(null);
  const gitSummaryActionTriggerRefs = useRef(new Map<string, HTMLElement>());
  const [sideChatOpen, setSideChatOpen] = useState(false);
  const [sideChatInitialQuestion, setSideChatInitialQuestion] = useState("");
  const [sideChatQuestionRevision, setSideChatQuestionRevision] = useState(0);
  const [gitRefreshRevision, setGitRefreshRevision] = useState(0);
  const aiChatBusyState = useRef(false);
  const [aiWorkView, setAiWorkView] = useState<"chat" | "git">("chat");
  const [workspaceUtilityTabs, setWorkspaceUtilityTabs] = useState<WorkspaceUtilityTab[]>([{ id: "workspace-tab-1", kind: "new" }]);
  const [activeWorkspaceUtilityTabId, setActiveWorkspaceUtilityTabId] = useState("workspace-tab-1");
  const handledApplicationsOpenRequestRef = useRef<number | null>(null);
  const [preferredBrowserProvider, setPreferredBrowserProvider] = useState<{ providerId: BrowserProviderId; requestId: number } | null>(null);
  const browserProviderSelectionSequence = useRef(0);
  const pendingAgentBrowserDockSyncRef = useRef<BrowserDockAgentSyncRequest | null>(null);
  const [browserAddress, setBrowserAddress] = useState("");
  const [browserAddressError, setBrowserAddressError] = useState("");
  const [browserAddressFocused, setBrowserAddressFocused] = useState(false);
  const browserAddressInputRef = useRef<HTMLInputElement | null>(null);
  const browserAddressEditingRef = useRef(false);
  const activeWorkspaceUtilityTabKind = workspaceUtilityTabs.find(tab => tab.id === activeWorkspaceUtilityTabId)?.kind ?? null;
  const [browserOpenTabs, setBrowserOpenTabs] = useState<BrowserOpenTab[]>([]);
  const [browserRecentSitesState, setBrowserRecentSitesState] = useState<{ userId: string; sites: BrowserRecentSite[]; status: "idle" | "loading" | "ready" | "error" }>({ userId, sites: [], status: "idle" });
  const reportedBrowserTabUrlsRef = useRef(new Map<string, string>());
  const recentSiteReportTailRef = useRef(Promise.resolve());
  const currentRecentSiteOwnerRef = useRef(userId);
  currentRecentSiteOwnerRef.current = userId;
  const visibleBrowserRecentSites = browserRecentSitesState.userId === userId ? browserRecentSitesState.sites : [];
  const workspaceUtilityTabId = useRef(1);
  const browserNavigationRequestSequence = useRef(0);
  const browserActionRequestSequence = useRef(0);
  const workspaceUtilityScope = useRef({ userId, mode });
  useEffect(() => { setBrowserOpenTabs([]); }, [activeAiSessionId, mode, userId]);
  useEffect(() => { reportedBrowserTabUrlsRef.current.clear(); }, [userId]);
  useEffect(() => {
    if (mode !== "ai-work" || activeWorkspaceUtilityTabKind !== "new") return;
    if (!settings.browserUse.recordRecentSites) {
      setBrowserRecentSitesState({ userId, sites: [], status: "ready" });
      return;
    }
    const controller = new AbortController();
    setBrowserRecentSitesState(current => ({ userId, sites: current.userId === userId ? current.sites : [], status: "loading" }));
    void loadBrowserRecentSites(12, controller.signal).then(result => {
      if (!controller.signal.aborted) setBrowserRecentSitesState({ userId, sites: result.sites, status: "ready" });
    }).catch(() => {
      if (!controller.signal.aborted) setBrowserRecentSitesState(current => ({ userId, sites: current.userId === userId ? current.sites : [], status: "error" }));
    });
    return () => controller.abort();
  }, [activeWorkspaceUtilityTabId, activeWorkspaceUtilityTabKind, mode, settings.browserUse.recordRecentSites, userId]);
  const centerCollapsed = chrome.centerCollapsed;
  const setCenterCollapsed = useCallback((next: boolean | ((current: boolean) => boolean)) => {
    setChrome(current => ({
      ...current,
      centerCollapsed: typeof next === "function" ? next(current.centerCollapsed) : next,
    }));
  }, []);
  const [centerCollapsePreview, setCenterCollapsePreview] = useState<boolean | null>(null);
  const [gitRepositoryChangeError, setGitRepositoryChangeError] = useState("");
  const [aiProviderStatus, setAiProviderStatus] = useState<string | null>(null);
  const [agentCanvasContext, setAgentCanvasContext] = useState<{ canvas: AiWorkbenchView["canvas"]; workflow: AiWorkbenchView["workflow"] }>({ canvas: undefined, workflow: undefined });
  const [applicationProjectContextState, setApplicationProjectContextState] = useState<{ userId: string; project: AiWorkbenchView["applicationProject"] }>({ userId, project: undefined });
  const [canvasAgentChange, setCanvasAgentChange] = useState<{ revision: number; projectId: string | null }>({ revision: 0, projectId: null });
  const [newAiSessionKey, setNewAiSessionKey] = useState(0);
  const [newAiSessionProjectId, setNewAiSessionProjectId] = useState<string | null>(null);
  const [writingWorkspace, setWritingWorkspace] = useState<WritingWorkspaceData | null>(null);
  const [writingWorkspaceLoading, setWritingWorkspaceLoading] = useState(app === "writing");
  const [writingWorkspaceError, setWritingWorkspaceError] = useState("");
  const [writingLibraryPortalTarget, setWritingLibraryPortalTarget] = useState<HTMLDivElement | null>(null);
  const writingFlushRef = useRef<(() => Promise<void>) | null>(null);
  const [minecraftContentReady, setMinecraftContentReady] = useState(app !== "minecraft");
  useEffect(() => {
    if (workspaceUtilityScope.current.userId === userId && workspaceUtilityScope.current.mode === mode) return;
    workspaceUtilityScope.current = { userId, mode };
    const nextTab = { id: `workspace-tab-${++workspaceUtilityTabId.current}`, kind: "new" as const };
    setWorkspaceUtilityTabs([nextTab]);
    setActiveWorkspaceUtilityTabId(nextTab.id);
    setCenterCollapsed(false);
    setSideChatOpen(false);
    setAiWorkView("chat");
    sidebarRightRuntime.select(null);
  }, [mode, userId]);
  const togglePinnedSession = useCallback((sessionId: string) => {
    setPinnedSessionState(current => {
      const ids = current.userId === userId ? current.ids : readPinnedAiSessionIds(userId);
      const nextIds = ids.includes(sessionId)
        ? ids.filter(id => id !== sessionId)
        : [sessionId, ...ids].slice(0, MAX_PINNED_AI_SESSIONS);
      return { userId, ids: nextIds };
    });
  }, [userId]);
  const appliedResponsiveLayout = useRef<string | null>(null);
  const responsiveLeftRestore = useRef<boolean | null>(null);
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
  const activeApplicationTitle = workspaceTitle ?? selectedApp?.title ?? "当前应用";
  const modeLabel = mode === "normal" ? "应用" : "工作";
  const writingNormal = app === "writing" && mode === "normal";
  const aiVideoNormal = app === "aivideo" && mode === "normal";
  const terminalPanelAvailable = app !== "writing" && app !== "minecraft";
  const activeAiSessionTitle = aiSessions.find((session) => session.id === activeAiSessionId)?.title ?? null;
  const activeAiSession = aiSessions.find((session) => session.id === activeAiSessionId) ?? null;
  const applicationProjectContext = applicationProjectContextState.userId === userId ? applicationProjectContextState.project : undefined;
  const chatAppId = canvasWorkspace?.applicationId ?? (app === "workspace" ? activeAiSession?.appId ?? "workspace" : app);
  const activeChatSession = activeAiSession && ((app === "workspace" && !canvasWorkspace) || activeAiSession.appId === chatAppId) ? activeAiSession : null;
  const activeChatSessionId = activeChatSession?.id ?? null;
  const applicationModeScopeId = canvasWorkspace?.applicationId ?? (app === "workspace" ? null : app);
  const modeSwitchAppId = applicationModeScopeId ?? (app === "workspace" && mode === "ai-work" ? chatAppId : null);
  const activeCanvasProjectId = agentCanvasContext.canvas?.applicationId === modeSwitchAppId
    ? agentCanvasContext.canvas.projectId
    : modeSwitchAppId === "aivideo" && applicationProjectContext?.applicationId === "aivideo"
      ? applicationProjectContext.projectId
      : null;
  useEffect(() => {
    const previous = canvasChatContextRef.current;
    const isCanvas = Boolean(canvasWorkspace);
    const applicationId = canvasWorkspace?.applicationId ?? chatAppId;
    const ownerChanged = previous.userId !== userId;
    const applicationChanged = previous.applicationId !== applicationId || ownerChanged;
    const enteredCanvas = isCanvas && !previous.isCanvas;
    const defaultChanged = previous.defaultOpen !== settings.canvas.agentPanelDefaultOpen;

    if (canvasWorkspace) {
      const key = canvasWorkspace.applicationId;
      const explicitState = getCanvasChatOpenOverride(userId, key);
      if (applicationChanged) {
        setCanvasChatOpenState(explicitState ?? settings.canvas.agentPanelDefaultOpen);
      } else if (enteredCanvas) {
        const open = explicitState ?? true;
        setCanvasChatOpenState(open);
        if (explicitState === undefined) setCanvasChatOpenOverride(userId, key, open);
      } else if (defaultChanged && explicitState === undefined) {
        setCanvasChatOpenState(settings.canvas.agentPanelDefaultOpen);
      }
    }

    canvasChatContextRef.current = { userId, applicationId, isCanvas, defaultOpen: settings.canvas.agentPanelDefaultOpen };
  }, [app, chatAppId, userId, canvasWorkspace?.applicationId, settings.canvas.agentPanelDefaultOpen]);
  const canvasApplicationTitle = canvasWorkspace ? applicationNavigationItems.find(item => item.applicationId === canvasWorkspace.applicationId)?.title ?? activeApplicationTitle : activeApplicationTitle;
  const activeChatSessionTitle = activeChatSession?.title ?? (canvasWorkspace ? canvasApplicationTitle : chatAppId !== "workspace" ? activeApplicationTitle : "小鱼智能体");
  const missingSessionDirectoryIds = missingSessionDirectoryState.key === `${userId}:${app}:${workspaceProjectsRevision}:${sessionDirectorySignature}:${workspaceProjectDirectorySignature}`
    ? missingSessionDirectoryState.ids
    : emptySessionDirectoryIds;
  const activeChatSessionDirectoryMissing = Boolean((chatAppId === "workspace" || chatAppId === "minecraft") && activeChatSessionId && missingSessionDirectoryIds.has(activeChatSessionId));
  const gitManagerAvailable = mode === "ai-work";
  const activeSessionGitRepositoryId = activeAiSessionId && sessionGitBinding.sessionId === activeAiSessionId ? sessionGitBinding.repositoryId : null;
  const activeSessionAssetRepository = agentGitRepositories.find(repository => repository.id === activeSessionGitRepositoryId) ?? null;
  const activeSessionAssetRepositoryLoading = Boolean(activeAiSessionId && (sessionGitBinding.sessionId !== activeAiSessionId || sessionGitBinding.loading || agentGitRepositoriesLoading));
  const selectedAgentGitRepositoryId = gitManagerRepositoryState.userId === userId && gitManagerRepositoryState.repositoryId
    ? gitManagerRepositoryState.repositoryId
    : activeSessionGitRepositoryId;
  const selectedAgentGitRepository = agentGitRepositories.find(repository => repository.id === selectedAgentGitRepositoryId) ?? null;
  const refreshGitStatus = useCallback(async (repository: AgentGitRepository | null): Promise<void> => {
    const revision = ++gitStatusRequestRevision.current;
    if (!repository) {
      setGitStatusSnapshot({ repositoryId: null, status: null, loading: false, error: "" });
      return;
    }
    setGitStatusSnapshot((current) => ({ repositoryId: repository.id, status: current.repositoryId === repository.id ? current.status : null, loading: true, error: "" }));
    try {
      const result = await loadAgentGitStatus(repository.id);
      if (gitStatusRequestRevision.current !== revision) return;
      setGitStatusSnapshot({ repositoryId: repository.id, status: result.status, loading: false, error: "" });
    } catch (loadError) {
      if (gitStatusRequestRevision.current !== revision) return;
      setGitStatusSnapshot((current) => ({ repositoryId: repository.id, status: current.repositoryId === repository.id ? current.status : null, loading: false, error: getErrorMessage(loadError) }));
    }
  }, []);
  const updateGitStatus = useCallback((repositoryId: string, status: WorkspaceGitStatus) => {
    setGitStatusSnapshot((current) => current.repositoryId === repositoryId ? { repositoryId, status, loading: false, error: "" } : current);
  }, []);
  const refreshSelectedGitStatus = useCallback(() => refreshGitStatus(selectedAgentGitRepository), [refreshGitStatus, selectedAgentGitRepository]);
  const ensureSessionGitRepository = useCallback((sessionId: string): Promise<AgentGitRepository | null> => {
    const pending = gitEnsureRequests.current.get(sessionId);
    if (pending) return pending;
    setGitRepositoryChangeError("");
    setSessionGitBinding({ sessionId, repositoryId: null, loading: true });
    const request = ensureAgentGitSessionRepository(sessionId).then(({ repository }) => {
      if (activeAiSessionIdRef.current === sessionId) {
        setSessionGitBinding({ sessionId, repositoryId: repository?.id ?? null, loading: false });
        if (repository) {
          setAgentGitRepositoryState(current => {
            const previous = current.userId === userId ? current.repositories : [];
            return { userId, repositories: [repository, ...previous.filter(item => item.id !== repository.id)] };
          });
          setGitManagerRepositoryState({ userId, repositoryId: repository.id });
        }
      }
      return repository;
    }).catch(error => {
      if (activeAiSessionIdRef.current === sessionId) {
        setSessionGitBinding({ sessionId, repositoryId: null, loading: false });
        const expectedBusy = typeof error === "object" && error !== null && "code" in error && error.code === "agent_git_session_busy";
        if (!expectedBusy) setGitRepositoryChangeError(getErrorMessage(error));
      }
      return null;
    }).finally(() => {
      if (gitEnsureRequests.current.get(sessionId) === request) gitEnsureRequests.current.delete(sessionId);
    });
    gitEnsureRequests.current.set(sessionId, request);
    return request;
  }, [userId]);
  const visibleGitStatus = gitStatusSnapshot.repositoryId === selectedAgentGitRepository?.id ? gitStatusSnapshot : { repositoryId: selectedAgentGitRepository?.id ?? null, status: null, loading: false, error: "" };
  const gitSummaryText = !selectedAgentGitRepository ? "当前会话尚未写入项目文件" : visibleGitStatus.loading && !visibleGitStatus.status ? "读取中…" : visibleGitStatus.error ? "读取失败" : !visibleGitStatus.status ? "等待状态" : visibleGitStatus.status.repositoryState === "not-repository" ? "等待 Agent 首次写入" : visibleGitStatus.status.repositoryState === "unborn" ? `新仓库 · ${visibleGitStatus.status.changedFileCount} 项` : visibleGitStatus.status.clean ? "工作区干净" : `${visibleGitStatus.status.changedFileCount} 项 · +${visibleGitStatus.status.insertions} −${visibleGitStatus.status.deletions}`;
  const gitSummaryPrimaryRepository = agentGitRepositories.find(repository => repository.id === selectedAgentGitRepositoryId) ?? agentGitRepositories[0] ?? null;
  const gitSummarySecondaryRepositories = agentGitRepositories.filter(repository => repository.id !== gitSummaryPrimaryRepository?.id);
  const gitSummaryRequestedRepositories = [...(gitSummaryPrimaryRepository ? [gitSummaryPrimaryRepository] : []), ...gitSummarySecondaryRepositories].slice(0, 12);
  const gitSummaryStatusRequestedIds = new Set(gitSummaryRequestedRepositories.map(repository => repository.id));
  const onSessionFileChanges = useCallback((sessionId: string | null, changes: AiActivityFileChange[]) => {
    setSessionFileChangesState({ sessionId, changes });
  }, []);
  const currentSessionFileChanges = sessionFileChangesState.sessionId === activeAiSessionId ? sessionFileChangesState.changes : emptySessionFileChanges;
  const gitSummaryWriteSignature = useMemo(() => currentSessionFileChanges.filter(change => change.operation !== "read").map(change => `${change.projectId ?? ""}:${change.operation}:${change.path}`).join("\u0000"), [currentSessionFileChanges]);
  const sessionFileSummary = useMemo(() => {
    const latestWriteByPath = new Map<string, AiActivityFileChange>();
    for (const change of currentSessionFileChanges) {
      if (change.operation !== "read") latestWriteByPath.set(`${change.projectId ?? ""}:${change.path}`, change);
    }
    const sources = new Map<string, AiActivityFileChange>();
    for (const change of currentSessionFileChanges) {
      if (change.operation === "read") sources.set(`${change.projectId ?? ""}:${change.path}`, change);
    }
    return {
      outputs: [...latestWriteByPath.values()].filter(change => change.operation === "created" || change.operation === "modified"),
      sources: [...sources.values()].reverse()
    };
  }, [currentSessionFileChanges]);
  const handleGitSummaryFilesToggle = useCallback(() => setGitSummaryShowAllFiles(value => !value), []);
  useEffect(() => {
    if (mode !== "ai-work" || (!gitSummaryOpen && activeWorkspaceUtilityTabKind !== "git")) {
      return;
    }
    const controller = new AbortController();
    setAgentGitRepositoriesLoading(true);
    setAgentGitRepositoriesError("");
    void loadAgentGitRepositories(controller.signal).then(({ repositories }) => setAgentGitRepositoryState({ userId, repositories })).catch(error => {
      if (!controller.signal.aborted) setAgentGitRepositoriesError(getErrorMessage(error));
    }).finally(() => { if (!controller.signal.aborted) setAgentGitRepositoriesLoading(false); });
    return () => controller.abort();
  }, [activeWorkspaceUtilityTabKind, gitRefreshRevision, gitSummaryOpen, mode, userId]);
  useEffect(() => {
    if (mode !== "ai-work" || voiceMode || !activeAiSessionId) {
      setSessionGitBinding({ sessionId: "", repositoryId: null, loading: false });
    } else {
      setSessionGitBinding({ sessionId: activeAiSessionId, repositoryId: null, loading: false });
    }
    setGitManagerRepositoryState({ userId, repositoryId: null });
  }, [activeAiSessionId, mode, userId, voiceMode]);
  useEffect(() => {
    if (mode !== "ai-work" || (!gitSummaryOpen && activeWorkspaceUtilityTabKind !== "git") || !selectedAgentGitRepository) {
      gitStatusRequestRevision.current += 1;
      setGitStatusSnapshot({ repositoryId: null, status: null, loading: false, error: "" });
      return;
    }
    void refreshGitStatus(selectedAgentGitRepository);
    return () => { gitStatusRequestRevision.current += 1; };
  }, [activeWorkspaceUtilityTabKind, gitRefreshRevision, gitSummaryOpen, mode, refreshGitStatus, selectedAgentGitRepository?.id]);
  useEffect(() => {
    if (!gitSummaryOpen || mode !== "ai-work") return;
    const controller = new AbortController();
    let active = true;
    const visibleRepositories = [...(gitSummaryPrimaryRepository ? [gitSummaryPrimaryRepository] : []), ...agentGitRepositories.filter(repository => repository.id !== gitSummaryPrimaryRepository?.id)].slice(0, 12);
    const timer = window.setTimeout(() => {
      void Promise.all(visibleRepositories.map(async repository => {
        try {
          const { status } = await loadAgentGitStatus(repository.id, controller.signal);
          if (active) setGitSummaryStatuses(current => ({ ...current, [repository.id]: { status } }));
        } catch (error) {
          if (active && !controller.signal.aborted) setGitSummaryStatuses(current => ({ ...current, [repository.id]: { error: getErrorMessage(error) } }));
        }
      }));
    }, 180);
    return () => { active = false; window.clearTimeout(timer); controller.abort(); };
  }, [agentGitRepositories, gitSummaryOpen, gitSummaryPrimaryRepository?.id, gitSummaryWriteSignature, mode]);
  useEffect(() => {
    if (!gitSummaryActionRepositoryId) return;
    const frame = window.requestAnimationFrame(() => gitSummaryActionMenuRef.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [gitSummaryActionRepositoryId]);
  useEffect(() => {
    const repositoryId = gitSummaryActionRepositoryId;
    if (!repositoryId) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (gitSummaryActionMenuRef.current?.contains(target) || gitSummaryActionTriggerRefs.current.get(repositoryId)?.contains(target)) return;
      setGitSummaryActionRepositoryId(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      gitSummaryActionTriggerRefs.current.get(repositoryId)?.focus();
      setGitSummaryActionRepositoryId(null);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer, true);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer, true);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [gitSummaryActionRepositoryId]);
  const handleGitSummaryOpenChange = useCallback((open: boolean) => {
    setGitSummaryOpen(open);
    if (!open) setGitSummaryActionRepositoryId(null);
    if (open && mode === "ai-work" && activeAiSessionId) void ensureSessionGitRepository(activeAiSessionId);
  }, [activeAiSessionId, ensureSessionGitRepository, mode]);
  handleGitSummaryOpenChangeRef.current = handleGitSummaryOpenChange;
  const onAiChatBusyChange = useCallback((busy: boolean) => {
    const wasBusy = aiChatBusyState.current;
    aiChatBusyState.current = busy;
    if (!wasBusy && busy && gitSummaryAvailableOnRunRef.current) {
      if (gitSummaryMobileOnRunRef.current) setChrome(current => ({ ...current, leftCollapsed: false, rightCollapsed: true }));
      handleGitSummaryOpenChangeRef.current(true);
    }
    if (wasBusy && !busy) setGitRefreshRevision((revision) => revision + 1);
  }, []);
  useEffect(() => {
    if (mode !== "ai-work" || voiceMode || metrics.mode !== "compact") return;
    gitSummaryResponsiveOpenRef.current = null;
    setGitSummaryOpen(false);
    setGitSummaryActionRepositoryId(null);
  }, [metrics.mode, mode, voiceMode]);
  useEffect(() => {
    if (mode !== "ai-work" || metrics.mode !== "desktop" || voiceMode || chrome.rightCollapsed) return;
    const workbench = layoutRef.current;
    const rightPane = workbench?.querySelector<HTMLElement>(".module-workbench-region--right-menu");
    if (!workbench || !rightPane) return;

    let active = true;
    const syncSummaryToRightWidth = () => {
      if (!active) return;
      const shouldOpen = shouldAutoOpenGitSummary(rightPane.getBoundingClientRect().width, workbench.getBoundingClientRect().width);
      if (shouldOpen === null || gitSummaryResponsiveOpenRef.current === shouldOpen) return;
      gitSummaryResponsiveOpenRef.current = shouldOpen;
      setGitSummaryOpen(shouldOpen);
      if (!shouldOpen) setGitSummaryActionRepositoryId(null);
    };
    const observer = new ResizeObserver(syncSummaryToRightWidth);
    observer.observe(workbench);
    observer.observe(rightPane);
    syncSummaryToRightWidth();
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [chrome.rightCollapsed, metrics.mode, mode, voiceMode]);
  useEffect(() => {
    if (metrics.mode !== "mobile" || !gitSummaryOpen || gitSummaryActionRepositoryId) return;
    const closeSummaryOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      handleGitSummaryOpenChange(false);
    };
    window.addEventListener("keydown", closeSummaryOnEscape, true);
    return () => window.removeEventListener("keydown", closeSummaryOnEscape, true);
  }, [gitSummaryActionRepositoryId, gitSummaryOpen, handleGitSummaryOpenChange, metrics.mode]);
  const statusLabel = serverState === "online" ? "控制端已连接" : serverState === "checking" ? "正在检查控制端" : "控制端未连接";
  const contextLabel = writingNormal ? "作品信息" : mode === "ai-work" ? "工具与资源" : "应用工具";

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
  const openAiVideoProjectFiles = useCallback((projectId: string) => {
    setFileManagerLocation(userId, `.lfaa-library/aivideo-projects/${projectId}`);
    onNavigate("/files");
  }, [onNavigate, userId]);
  const canOpenSystemFiles = role === "super_admin" && settings.permissions.mode === "full_access";
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
    const cacheKey = `${userId}:${app}`;
    if (app !== "minecraft" && app !== "workspace") {
      setWorkspaceProjects([]);
      setWorkspaceNodes([]);
      setWorkspaceProjectsTruncated(false);
      setDefaultWorkspaceProjectId(null);
      setWorkspaceProjectsError("");
      setWorkspaceProjectsDataScope(cacheKey);
      setWorkspaceProjectsLoadStatus("ready");
      setNewAiSessionProjectId(null);
      return;
    }
    const cached = workspaceProjectSnapshots.get(cacheKey);
    setWorkspaceProjects(cached?.projects ?? []);
    setWorkspaceProjectsDataScope(cacheKey);
    setWorkspaceNodes(cached?.nodes ?? []);
    setWorkspaceProjectsTruncated(cached?.truncated ?? false);
    setDefaultWorkspaceProjectId(cached?.defaultProjectId ?? null);
    setWorkspaceProjectsError("");
    setWorkspaceProjectsLoadStatus(cached ? "ready" : "loading");
    if (mode !== "ai-work") {
      setWorkspaceProjectsLoadStatus(cached ? "ready" : "loading");
      return;
    }
    const controller = new AbortController();
    let projectLoadSequence = 0;
    let initializationError = "";
    setWorkspaceProjectsError("");
    const refreshProjects = async () => {
      const sequence = ++projectLoadSequence;
      try {
        const { projects, nodes, truncated, defaultProjectId } = await loadWorkspaceProjects({ appId: app, signal: controller.signal });
        if (controller.signal.aborted || sequence !== projectLoadSequence) return;
        workspaceProjectSnapshots.set(cacheKey, { projects, nodes, truncated, defaultProjectId });
        setWorkspaceProjects(projects);
        setWorkspaceProjectsDataScope(cacheKey);
        setWorkspaceNodes(nodes);
        setWorkspaceProjectsTruncated(truncated);
        setDefaultWorkspaceProjectId(defaultProjectId ?? null);
        setWorkspaceProjectsLoadStatus("ready");
        setWorkspaceProjectsError(initializationError);
      } catch (projectError) {
        if (!controller.signal.aborted && sequence === projectLoadSequence) {
          setWorkspaceProjectsLoadStatus("error");
          setWorkspaceProjectsError(initializationError || getErrorMessage(projectError));
        }
      }
    };
    void refreshProjects();
    if (app === "workspace" && !voiceMode && !initializedDefaultWorkspaceUsers.has(userId)) {
      void initializeDefaultWorkspace(controller.signal).then(() => {
        if (controller.signal.aborted) return;
        initializedDefaultWorkspaceUsers.add(userId);
        if (initializedDefaultWorkspaceUsers.size > 8) {
          const oldestUserId = initializedDefaultWorkspaceUsers.values().next().value;
          if (oldestUserId) initializedDefaultWorkspaceUsers.delete(oldestUserId);
        }
        return refreshProjects();
      }).catch(projectError => {
        if (controller.signal.aborted) return;
        initializationError = `默认工作区初始化失败：${getErrorMessage(projectError)}`;
        setWorkspaceProjectsError(initializationError);
      });
    }
    return () => controller.abort();
  }, [userId, app, mode, voiceMode, workspaceProjectsRevision]);

  useEffect(() => {
    const key = `${userId}:${app}:${workspaceProjectsRevision}:${sessionDirectorySignature}:${workspaceProjectDirectorySignature}`;
    if (mode !== "ai-work") {
      setMissingSessionDirectoryState({ key, ids: new Set() });
      return;
    }
    const sessionId = sessionDirectoryCheckRequest?.sessionId;
    if (aiSessionsLoading || !sessionId || sessionId !== activeAiSessionId) return;
    const hasProjectBinding = (JSON.parse(sessionDirectorySignature) as Array<[string, string | null]>).some(([id, projectId]) => id === sessionId && projectId !== null);
    if (!hasProjectBinding) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void loadWorkspaceSessionDirectoryAvailability([sessionId], controller.signal).then(({ sessions }) => {
        if (controller.signal.aborted) return;
        const status = sessions[sessionId] ?? "unknown";
        setMissingSessionDirectoryState(current => {
          const ids = new Set(current.key === key ? current.ids : []);
          if (status === "missing") ids.add(sessionId);
          else if (status === "available") ids.delete(sessionId);
          return { key, ids };
        });
      }).catch(() => {
        // 未知状态不标记为目录缺失；聊天与历史内容不等待后台目录检查。
      });
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [activeAiSessionId, aiSessionsLoading, app, mode, sessionDirectoryCheckRequest?.requestId, sessionDirectoryCheckRequest?.sessionId, sessionDirectorySignature, userId, workspaceProjectDirectorySignature, workspaceProjectsRevision]);

  const retryWorkspaceProjects = useCallback(() => setWorkspaceProjectsRevision(revision => revision + 1), []);

  useLayoutEffect(() => {
    const responsiveLayoutKey = `${metrics.mode}:${mode}`;
    if (appliedResponsiveLayout.current === responsiveLayoutKey) return;
    appliedResponsiveLayout.current = responsiveLayoutKey;
    if (metrics.mode === "desktop") {
      const previous = responsiveLeftRestore.current;
      responsiveLeftRestore.current = null;
      if (previous !== null) setChrome(current => ({ ...current, leftCollapsed: previous }));
      return;
    }
    setChrome(current => {
      const hideLeft = metrics.mode === "mobile"
        || metrics.mode === "compact" && (mode === "normal" || mode === "ai-work" && !current.rightCollapsed);
      if (hideLeft && responsiveLeftRestore.current === null) responsiveLeftRestore.current = current.leftCollapsed;
      const leftCollapsed = hideLeft || current.leftCollapsed;
      const terminalOpen = metrics.mode === "mobile" ? false : current.terminalOpen;
      if (leftCollapsed === current.leftCollapsed && terminalOpen === current.terminalOpen) return current;
      return { ...current, leftCollapsed, terminalOpen };
    });
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
    setChrome((current) => {
      const responsiveLeftCollapsed = mobile
        || metrics.mode === "compact" && (mode === "normal" || mode === "ai-work" && !current.rightCollapsed);
      const leftCollapsed = responsiveLeftCollapsed || hidesLeft;
      const rightCollapsed = keepsThreeColumnDefaultClosed ? current.rightCollapsed : hidesRight;
      if (leftCollapsed === current.leftCollapsed && rightCollapsed === current.rightCollapsed) return current;
      return {
        ...current,
        leftCollapsed,
        rightCollapsed,
      };
    });
  }, [chromeStorageMetadata.hasSavedState, metrics.mode, mode, settings.general.navigationLayout]);

  useEffect(() => {
    window.localStorage.setItem(CHROME_KEY, JSON.stringify({ ...chrome, leftCollapsed: responsiveLeftRestore.current ?? chrome.leftCollapsed, navigationLayout: settings.general.navigationLayout }));
  }, [chrome, settings.general.navigationLayout]);

  useEffect(() => {
    saveWorkbenchLeftWidth(leftPaneWidth, metrics.left);
  }, [leftPaneWidth, metrics.left.max, metrics.left.min]);

  useEffect(() => () => {
    if (previewCloseTimer.current !== null) {
      window.clearTimeout(previewCloseTimer.current);
      previewCloseTimer.current = null;
    }
  }, []);

  const toggleLeft = useCallback(() => {
    responsiveLeftRestore.current = null;
    // 中心与右栏均已收起时，关闭左二菜单必须恢复主工作区，不能把页面留成全空。
    if (!chrome.leftCollapsed && centerCollapsed && chrome.rightCollapsed) setCenterCollapsed(false);
    setChrome((current) => ({
      ...current,
      leftCollapsed: !current.leftCollapsed,
      ...(metrics.mode !== "desktop" && current.leftCollapsed ? { rightCollapsed: true } : {}),
    }));
  }, [centerCollapsed, chrome.leftCollapsed, chrome.rightCollapsed, metrics.mode]);
  const showRightPanelSection = useCallback((nextSection: "context" | "applications") => {
    const sectionToShow = mode === "normal" ? "context" : nextSection;
    onRightPanelSectionChange(sectionToShow);
    sidebarRightRuntime.select(null);
    if (sectionToShow === "applications") setAiWorkView("chat");
    setChrome((current) => ({
      ...current,
      rightCollapsed: false,
      ...(metrics.mode !== "desktop" ? { leftCollapsed: true } : {}),
    }));
  }, [metrics.mode, mode, onRightPanelSectionChange]);
  const showWorkspaceUtilityTab = useCallback((tab: WorkspaceUtilityTab) => {
    setChrome((current) => ({
      ...current,
      rightCollapsed: false,
      ...(metrics.mode !== "desktop" ? { leftCollapsed: true } : {}),
    }));
    if (tab.kind === "side-chat") {
      onRightPanelSectionChange("context");
      sidebarRightRuntime.select(null);
      setAiWorkView("chat");
      setSideChatOpen(true);
      return;
    }
    setSideChatOpen(false);
    if (tab.kind === "applications") {
      setAiWorkView("chat");
      showRightPanelSection("applications");
      return;
    }
    onRightPanelSectionChange("context");
    if (tab.kind === "extension") {
      setAiWorkView("chat");
      const extension = sidebarRight.tabs.find(item => item.id === tab.extensionId);
      if (extension) sidebarRightRuntime.control.openTab(extension.kind);
      else sidebarRightRuntime.select(null);
      return;
    }
    sidebarRightRuntime.select(null);
    setAiWorkView(tab.kind === "git" ? "git" : "chat");
  }, [metrics.mode, onRightPanelSectionChange, showRightPanelSection, sidebarRight.tabs]);
  const openWorkspaceUtility = useCallback((kind: Exclude<WorkspaceUtilityTab["kind"], "new" | "project-file">, extensionId?: string) => {
    if (kind === "git") {
      const existingGitTab = findGitWorkspaceUtilityTab(workspaceUtilityTabs);
      if (existingGitTab) {
        setActiveWorkspaceUtilityTabId(existingGitTab.id);
        showWorkspaceUtilityTab(existingGitTab);
        return;
      }
    }
    if (kind === "assets") {
      const existingAssetTab = findAssetWorkspaceUtilityTab(workspaceUtilityTabs);
      if (existingAssetTab) {
        setActiveWorkspaceUtilityTabId(existingAssetTab.id);
        showWorkspaceUtilityTab(existingAssetTab);
        return;
      }
    }
    const activeTab = workspaceUtilityTabs.find(tab => tab.id === activeWorkspaceUtilityTabId);
    if (activeTab?.kind === "new") {
      const nextTab = { ...activeTab, kind, ...(extensionId ? { extensionId } : {}) } as WorkspaceUtilityTab;
      setWorkspaceUtilityTabs(current => current.map(tab => tab.id === nextTab.id ? nextTab : tab));
      showWorkspaceUtilityTab(nextTab);
      return;
    }
    const nextTab = { id: `workspace-tab-${++workspaceUtilityTabId.current}`, kind, ...(extensionId ? { extensionId } : {}) } as WorkspaceUtilityTab;
    setWorkspaceUtilityTabs(current => [...current, nextTab]);
    setActiveWorkspaceUtilityTabId(nextTab.id);
    showWorkspaceUtilityTab(nextTab);
  }, [activeWorkspaceUtilityTabId, showWorkspaceUtilityTab, workspaceUtilityTabs]);
  const openProjectFile = useCallback((projectId: string, path: string, sourceId?: string, initialView: "source" | "diff" = "source") => {
    if ((app !== "workspace" && app !== "minecraft") || !path || path.length > 1024 || path.startsWith("/") || path.startsWith("\\")
      || path.includes("\\") || path.split("/").some(segment => !segment || segment === "." || segment === "..")) return;
    const project = workspaceProjects.find(item => item.id === projectId && (!item.appId || item.appId === app));
    if (!project) return;
    const existing = workspaceUtilityTabs.find(tab => tab.kind === "project-file" && tab.projectId === projectId
      && tab.filePath === path && (tab.sourceId ?? "") === (sourceId ?? ""));
    if (existing) {
      const nextTab = { ...existing, initialView };
      setWorkspaceUtilityTabs(current => current.map(tab => tab.id === existing.id ? nextTab : tab));
      setActiveWorkspaceUtilityTabId(nextTab.id);
      setBrowserAddress("");
      showWorkspaceUtilityTab(nextTab);
      return;
    }
    const activeTab = workspaceUtilityTabs.find(tab => tab.id === activeWorkspaceUtilityTabId);
    const reuseBlankTab = activeTab?.kind === "new" && !activeTab.browserUrl && !activeTab.browserNavigationRequest && !activeTab.browserActionRequest;
    const nextTab: WorkspaceUtilityTab = {
      id: reuseBlankTab ? activeTab.id : `workspace-tab-${++workspaceUtilityTabId.current}`,
      kind: "project-file", projectId, filePath: path, ...(sourceId ? { sourceId } : {}), initialView
    };
    setWorkspaceUtilityTabs(current => reuseBlankTab
      ? current.map(tab => tab.id === activeTab.id ? nextTab : tab)
      : [...current, nextTab]);
    setActiveWorkspaceUtilityTabId(nextTab.id);
    setBrowserAddress("");
    showWorkspaceUtilityTab(nextTab);
  }, [activeWorkspaceUtilityTabId, app, showWorkspaceUtilityTab, workspaceProjects, workspaceUtilityTabs]);
  const openBrowserWebsite = useCallback((url: string) => {
    setBrowserAddressError("");
    const activeTab = workspaceUtilityTabs.find(tab => tab.id === activeWorkspaceUtilityTabId);
    const request = { id: `browser-navigation-${++browserNavigationRequestSequence.current}`, url };
    setBrowserAddress(url);
    if (activeTab?.kind === "new") {
      const nextTab: WorkspaceUtilityTab = { ...activeTab, browserUrl: url, browserNavigationRequest: request, browserActionRequest: undefined };
      setWorkspaceUtilityTabs(current => current.map(tab => tab.id === nextTab.id ? nextTab : tab));
      setActiveWorkspaceUtilityTabId(nextTab.id);
      showWorkspaceUtilityTab(nextTab);
      return;
    }
    const nextTab: WorkspaceUtilityTab = { id: `workspace-tab-${++workspaceUtilityTabId.current}`, kind: "new", browserUrl: url, browserNavigationRequest: request };
    setWorkspaceUtilityTabs(current => [...current, nextTab]);
    setActiveWorkspaceUtilityTabId(nextTab.id);
    showWorkspaceUtilityTab(nextTab);
  }, [activeWorkspaceUtilityTabId, showWorkspaceUtilityTab, workspaceUtilityTabs]);
  const openBrowserDockForAgent = useCallback((providerId: BrowserProviderId) => {
    const requestId = ++browserProviderSelectionSequence.current;
    pendingAgentBrowserDockSyncRef.current = { providerId, requestId };
    setPreferredBrowserProvider({ providerId, requestId });
    const activeTab = workspaceUtilityTabs.find(tab => tab.id === activeWorkspaceUtilityTabId);
    const browserTab = activeTab?.kind === "new" && !activeTab.browserNavigationRequest && !activeTab.browserActionRequest
      ? activeTab
      : workspaceUtilityTabs.find(tab => tab.kind === "new" && !tab.browserNavigationRequest && !tab.browserActionRequest);
    const nextTab = browserTab ?? { id: `workspace-tab-${++workspaceUtilityTabId.current}`, kind: "new" as const };
    if (!browserTab) {
      setBrowserAddress("");
      setBrowserAddressError("");
      setWorkspaceUtilityTabs(current => [...current, nextTab]);
    }
    setActiveWorkspaceUtilityTabId(nextTab.id);
    showWorkspaceUtilityTab(nextTab);
  }, [activeWorkspaceUtilityTabId, showWorkspaceUtilityTab, workspaceUtilityTabs]);
  const submitBrowserAddress = useCallback((event: ReactFormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const url = resolveBrowserAddress(browserAddress, settings.browserUse.searchEngine);
      setBrowserAddressError("");
      openBrowserWebsite(url);
    } catch (reason) {
      setBrowserAddressError(getErrorMessage(reason));
    }
  }, [browserAddress, openBrowserWebsite, settings.browserUse.searchEngine]);
  const openBrowserDockAction = useCallback((action: "back" | "forward" | "reload") => {
    if (!browserOpenTabs.some(tab => tab.active)) return;
    const request = { id: `browser-action-${++browserActionRequestSequence.current}`, action };
    const activeTab = workspaceUtilityTabs.find(tab => tab.id === activeWorkspaceUtilityTabId);
    const activeBrowserTab = browserOpenTabs.find(tab => tab.active);
    const nextTab: WorkspaceUtilityTab = activeTab?.kind === "new"
      ? { ...activeTab, browserUrl: activeTab.browserUrl ?? activeBrowserTab?.url, browserActionRequest: request }
      : { id: `workspace-tab-${++workspaceUtilityTabId.current}`, kind: "new", browserUrl: activeBrowserTab?.url, browserActionRequest: request };
    setWorkspaceUtilityTabs(current => activeTab?.kind === "new"
      ? current.map(tab => tab.id === nextTab.id ? nextTab : tab)
      : [...current, nextTab]);
    setActiveWorkspaceUtilityTabId(nextTab.id);
    showWorkspaceUtilityTab(nextTab);
  }, [activeWorkspaceUtilityTabId, browserOpenTabs, showWorkspaceUtilityTab, workspaceUtilityTabs]);
  const handleBrowserActionRequest = useCallback((requestId: string) => {
    setWorkspaceUtilityTabs(current => current.map(tab => tab.browserActionRequest?.id === requestId
      ? { ...tab, browserActionRequest: undefined }
      : tab));
  }, []);
  const handleBrowserNavigationRequest = useCallback((requestId: string) => {
    setWorkspaceUtilityTabs(current => current.map(tab => tab.browserNavigationRequest?.id === requestId
      ? { ...tab, browserNavigationRequest: undefined }
      : tab));
  }, []);
  const handleBrowserOpenTabsChange = useCallback((update: BrowserDockTabsUpdate) => {
    const safeTabs = update.tabs.flatMap(tab => {
      try {
        const parsed = new URL(tab.url);
        if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.href.length > 2048) return [];
        return [{ id: tab.id || parsed.href, title: tab.title.trim().slice(0, 300), url: parsed.href, active: tab.active }];
      } catch { return []; }
    });
    if (settings.browserUse.recordRecentSites) {
      const changedUrls: string[] = [];
      for (const tab of safeTabs) {
        const key = `${activeAiSessionId ?? "no-session"}:${tab.id}`;
        if (reportedBrowserTabUrlsRef.current.get(key) !== tab.url) changedUrls.push(tab.url);
        reportedBrowserTabUrlsRef.current.set(key, tab.url);
      }
      while (reportedBrowserTabUrlsRef.current.size > 256) reportedBrowserTabUrlsRef.current.delete(reportedBrowserTabUrlsRef.current.keys().next().value!);
      if (changedUrls.length) {
        const pending = recentSiteReportTailRef.current.then(async () => {
          if (currentRecentSiteOwnerRef.current === userId) await recordBrowserRecentSites(changedUrls.slice(0, 64));
        });
        recentSiteReportTailRef.current = pending.then(() => undefined, () => undefined);
      }
    }
    const activeUtilityTab = workspaceUtilityTabs.find(tab => tab.id === activeWorkspaceUtilityTabId);
    const activeBrowserTab = safeTabs.find(tab => tab.active);
    const previousActiveBrowserTab = browserOpenTabs.find(tab => tab.active);
    const isAgentSyncResponse = matchesAgentBrowserDockSyncRequest(pendingAgentBrowserDockSyncRef.current, update);
    const shouldSyncAgentPage = shouldSyncAgentBrowserDockPage(
      pendingAgentBrowserDockSyncRef.current,
      update,
      activeUtilityTab?.kind === "new",
      Boolean(activeBrowserTab),
      Boolean(activeUtilityTab?.browserNavigationRequest || activeUtilityTab?.browserActionRequest),
    );
    const activeBrowserPageChanged = Boolean(previousActiveBrowserTab
      && (previousActiveBrowserTab.id !== activeBrowserTab?.id || previousActiveBrowserTab.url !== activeBrowserTab.url));
    const keepSavedAddressDuringOwnerRecovery = activeBrowserTab?.url === "about:blank" && /^https?:\/\//iu.test(activeUtilityTab?.browserUrl ?? "");
    if (isAgentSyncResponse && update.snapshotReady && activeUtilityTab?.kind === "new") pendingAgentBrowserDockSyncRef.current = null;
    if (activeUtilityTab?.kind === "new" && activeBrowserTab && !keepSavedAddressDuringOwnerRecovery && (shouldSyncAgentPage || activeUtilityTab.browserUrl !== undefined || activeBrowserPageChanged || browserOpenTabs.length === 0)) {
      setWorkspaceUtilityTabs(current => current.map(tab => tab.id === activeUtilityTab.id && tab.kind === "new" && tab.browserUrl !== activeBrowserTab.url
        ? { ...tab, browserUrl: activeBrowserTab.url }
        : tab));
      if (!browserAddressEditingRef.current) setBrowserAddress(activeBrowserTab.url);
    }
    setBrowserOpenTabs(safeTabs);
  }, [activeAiSessionId, activeWorkspaceUtilityTabId, browserOpenTabs, settings.browserUse.recordRecentSites, userId, workspaceUtilityTabs]);
  const createWorkspaceUtilityTab = useCallback(() => {
    const nextTab: WorkspaceUtilityTab = { id: `workspace-tab-${++workspaceUtilityTabId.current}`, kind: "new" };
    setBrowserAddress("");
    setWorkspaceUtilityTabs(current => [...current, nextTab]);
    setActiveWorkspaceUtilityTabId(nextTab.id);
    showWorkspaceUtilityTab(nextTab);
  }, [showWorkspaceUtilityTab]);
  const selectWorkbenchTab = useCallback((tab: "chat" | string) => {
    setCenterCollapsePreview(null);
    if (tab === "chat") {
      setCenterCollapsed(false);
      return;
    }
    const selectedTab = workspaceUtilityTabs.find(item => item.id === tab);
    if (!selectedTab) return;
    setBrowserAddress(selectedTab.browserUrl ?? "");
    setActiveWorkspaceUtilityTabId(selectedTab.id);
    showWorkspaceUtilityTab(selectedTab);
    setCenterCollapsed(true);
  }, [showWorkspaceUtilityTab, workspaceUtilityTabs]);
  const selectRightUtilityTab = useCallback((tab: WorkspaceUtilityTab) => {
    setBrowserAddress(tab.browserUrl ?? "");
    setActiveWorkspaceUtilityTabId(tab.id);
    showWorkspaceUtilityTab(tab);
  }, [showWorkspaceUtilityTab]);
  const toggleCenterCollapsed = useCallback(() => {
    setCenterCollapsePreview(null);
    setCenterCollapsed(collapsed => !collapsed);
  }, []);
  const handleCenterCollapsedChange = useCallback((collapsed: boolean) => {
    setCenterCollapsed(collapsed);
    if (!collapsed) {
      setCenterCollapsePreview(null);
      return;
    }
    let selectedTab = workspaceUtilityTabs.find(item => item.id === activeWorkspaceUtilityTabId);
    if (!selectedTab) {
      setBrowserAddress("");
      selectedTab = { id: `workspace-tab-${++workspaceUtilityTabId.current}`, kind: "new" };
      setWorkspaceUtilityTabs(current => [...current, selectedTab!]);
      setActiveWorkspaceUtilityTabId(selectedTab.id);
    }
    showWorkspaceUtilityTab(selectedTab);
  }, [activeWorkspaceUtilityTabId, showWorkspaceUtilityTab, workspaceUtilityTabs]);
  const closeWorkspaceUtilityTab = useCallback((tabId: string) => {
    const index = workspaceUtilityTabs.findIndex(tab => tab.id === tabId);
    if (index < 0) return;
    const nextTabs = workspaceUtilityTabs.filter(tab => tab.id !== tabId);
    if (nextTabs.length === 0) {
      setBrowserAddress("");
      const replacementTab: WorkspaceUtilityTab = { id: `workspace-tab-${++workspaceUtilityTabId.current}`, kind: "new" };
      setWorkspaceUtilityTabs([replacementTab]);
      setActiveWorkspaceUtilityTabId(replacementTab.id);
      showWorkspaceUtilityTab(replacementTab);
      setChrome(current => ({ ...current, rightCollapsed: true }));
      return;
    }
    setWorkspaceUtilityTabs(nextTabs);
    if (activeWorkspaceUtilityTabId === tabId) {
      const nextTab = nextTabs[Math.min(index, nextTabs.length - 1)];
      setBrowserAddress(nextTab.browserUrl ?? "");
      setActiveWorkspaceUtilityTabId(nextTab.id);
      showWorkspaceUtilityTab(nextTab);
    }
  }, [activeWorkspaceUtilityTabId, showWorkspaceUtilityTab, workspaceUtilityTabs]);
  const openGitManager = useCallback((repositoryId?: string, action?: "commit" | "push" | "branch-create" | "branch-switch") => {
    const targetRepositoryId = repositoryId ?? selectedAgentGitRepositoryId ?? agentGitRepositories[0]?.id ?? null;
    if (targetRepositoryId) setGitManagerRepositoryState({ userId, repositoryId: targetRepositoryId });
    setGitSummaryActionRepositoryId(null);
    setGitManagerActionRequest(action && targetRepositoryId ? { repositoryId: targetRepositoryId, action, requestId: ++gitManagerActionRequestRevision.current } : null);
    setGitSummaryOpen(false);
    openWorkspaceUtility("git");
    if (!targetRepositoryId && activeAiSessionId) {
      void ensureSessionGitRepository(activeAiSessionId).then(repository => {
        if (repository && activeAiSessionIdRef.current === activeAiSessionId) setGitManagerRepositoryState({ userId, repositoryId: repository.id });
      });
    }
  }, [activeAiSessionId, agentGitRepositories, ensureSessionGitRepository, openWorkspaceUtility, selectedAgentGitRepositoryId, userId]);
  const toggleApplicationsPanel = useCallback(() => {
    if (rightPanelSection === "applications" && !chrome.rightCollapsed) {
      setChrome((current) => ({ ...current, rightCollapsed: true }));
      return;
    }
    openWorkspaceUtility("applications");
  }, [chrome.rightCollapsed, openWorkspaceUtility, rightPanelSection]);
  const openToolsPanel = useCallback(() => {
    if (mode !== "ai-work") {
      if (rightPanelSection === "context" && !chrome.rightCollapsed) setChrome((current) => ({ ...current, rightCollapsed: true }));
      else showRightPanelSection("context");
      return;
    }
    const activeTab = workspaceUtilityTabs.find(tab => tab.id === activeWorkspaceUtilityTabId);
    if (rightPanelSection === "context" && !chrome.rightCollapsed && activeTab?.kind === "new" && sidebarRight.activeId === null) {
      setChrome((current) => ({ ...current, rightCollapsed: true }));
      return;
    }
    if (activeTab?.kind === "new") showWorkspaceUtilityTab(activeTab);
    else createWorkspaceUtilityTab();
  }, [activeWorkspaceUtilityTabId, chrome.rightCollapsed, createWorkspaceUtilityTab, mode, rightPanelSection, showRightPanelSection, showWorkspaceUtilityTab, sidebarRight.activeId, workspaceUtilityTabs]);
  const showRecentSessions = useCallback(() => {
    setChrome((current) => ({
      ...current,
      leftCollapsed: false,
      ...(metrics.mode !== "desktop" ? { rightCollapsed: true } : {}),
    }));
    setRecentSessionsExpandRequestId(current => current + 1);
    if (mode === "ai-work") refreshAiSessions();
    else void openApplication("workspace", "ai-work").catch(() => undefined);
  }, [metrics.mode, mode, openApplication, refreshAiSessions]);
  useEffect(() => {
    if (mode !== "ai-work" || recentSessionsOpenRequestId === null) return;
    showRecentSessions();
    onRecentSessionsOpenRequestHandled(recentSessionsOpenRequestId);
  }, [mode, onRecentSessionsOpenRequestHandled, recentSessionsOpenRequestId, showRecentSessions]);
  useEffect(() => {
    if (applicationsOpenRequestId === null || handledApplicationsOpenRequestRef.current === applicationsOpenRequestId) return;
    handledApplicationsOpenRequestRef.current = applicationsOpenRequestId;
    onApplicationsOpenRequestHandled(applicationsOpenRequestId);
    if (mode === "ai-work") openWorkspaceUtility("applications");
    else {
      onRightPanelSectionChange("context");
      setChrome((current) => ({
        ...current,
        leftCollapsed: false,
        ...(metrics.mode !== "desktop" ? { rightCollapsed: true } : {}),
      }));
    }
  }, [applicationsOpenRequestId, metrics.mode, mode, onApplicationsOpenRequestHandled, onRightPanelSectionChange, openWorkspaceUtility]);
  const toggleRight = useCallback(() => {
    if (chrome.rightCollapsed) {
      showRightPanelSection("context");
      return;
    }
    setChrome((current) => ({ ...current, rightCollapsed: true }));
  }, [chrome.rightCollapsed, showRightPanelSection]);
  const openSideChat = useCallback((initialQuestion = "") => {
    setSideChatInitialQuestion(initialQuestion);
    setSideChatQuestionRevision((revision) => revision + 1);
    openWorkspaceUtility("side-chat");
  }, [openWorkspaceUtility]);
  const closeSideChat = useCallback(() => {
    setSideChatOpen(false);
    const activeTab = workspaceUtilityTabs.find(tab => tab.id === activeWorkspaceUtilityTabId);
    if (activeTab?.kind === "side-chat") closeWorkspaceUtilityTab(activeTab.id);
  }, [activeWorkspaceUtilityTabId, closeWorkspaceUtilityTab, workspaceUtilityTabs]);
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
    const closeTimer = window.setTimeout(() => {
      if (previewCloseTimer.current !== closeTimer) return;
      previewCloseTimer.current = null;
      const previewPane = layoutRef.current?.querySelector<HTMLElement>(".module-left-preview");
      if (leftPreviewTriggerRef.current?.matches(":hover, :focus-visible") || previewPane?.matches(":hover, :focus-within")) return;
      setLeftPreviewOpen(false);
    }, 160);
    previewCloseTimer.current = closeTimer;
  }, [chrome.leftCollapsed, clearPreviewClose, metrics.mode]);

  useEffect(() => {
    if (!chrome.leftCollapsed || metrics.mode === "mobile") {
      clearPreviewClose();
      setLeftPreviewOpen(false);
    }
  }, [chrome.leftCollapsed, clearPreviewClose, metrics.mode]);

  useLayoutEffect(() => {
    const previousContext = leftPreviewContextRef.current;
    if (previousContext.app === app && previousContext.mode === mode && previousContext.section === section && previousContext.layoutMode === metrics.mode) return;
    leftPreviewContextRef.current = { app, mode, section, layoutMode: metrics.mode };
    clearPreviewClose();
    setLeftPreviewOpen(false);
  }, [app, mode, section, metrics.mode, clearPreviewClose]);

  if (!selectedApp) return null;

  const openSidebarMode = async (nextApp: ApplicationId, nextMode: ApplicationMode) => {
    await openApplication(nextApp, nextMode);
    if (metrics.mode === "mobile") setChrome((current) => ({ ...current, leftCollapsed: true }));
  };
  const navigateWithinApplication = useCallback((path: string) => {
    const appModeRoute = path.match(APPLICATION_ROUTE_PATTERN);
    if (appModeRoute && !appModeRoute[3] && appModeRoute[1] !== "workspace") {
      void openApplication(appModeRoute[1] as ApplicationId, appModeRoute[2] as ApplicationMode);
    } else onNavigate(path);
    if (metrics.mode === "mobile") setChrome((current) => ({ ...current, leftCollapsed: true }));
  }, [metrics.mode, onNavigate, openApplication]);
  const startNewAiSession = (projectId?: string) => {
    onActiveAiSessionChange(null);
    setNewAiSessionProjectId(projectId ?? null);
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
  const gitSummaryContent = <section className={`module-git-summary${gitSummaryActionRepositoryId !== null ? " is-actions-open" : ""}${metrics.mode === "mobile" ? " is-embedded" : ""}`} data-layout-mode={metrics.mode} id={metrics.mode === "mobile" ? "module-sidebar-git-summary" : undefined} aria-label="项目摘要">
                {gitSummaryActionRepositoryId ? <div id="module-git-summary-git-actions" ref={gitSummaryActionMenuRef} className="module-git-summary__operations-menu" role="menu" aria-label="Git 操作">
                  {([
                    ["commit", "提交"],
                    ["push", "推送"],
                    ["branch-create", "创建分支"],
                    ["branch-switch", "切换分支"]
                  ] as const).map(([action, title]) => <button key={action} type="button" role="menuitem" onClick={() => {
                    const repositoryId = gitSummaryActionRepositoryId;
                    setGitSummaryActionRepositoryId(null);
                    if (repositoryId) openGitManager(repositoryId, action);
                  }}>{title}</button>)}
                </div> : null}
                <div className="module-git-summary__body">
                  {agentGitRepositoriesLoading ? <p className="module-git-summary__empty">正在读取项目文件夹…</p> : null}
                  {agentGitRepositoriesError ? <p className="module-git-summary__error" role="alert">{agentGitRepositoriesError}</p> : null}
                  {!agentGitRepositoriesLoading && !agentGitRepositories.length && !agentGitRepositoriesError ? <p className="module-git-summary__empty">Agent 首次获准在项目文件夹写入时，会自动初始化 Git 并开始版本管理。</p> : null}
                  {gitSummaryPrimaryRepository ? (() => {
                    const repository = gitSummaryPrimaryRepository;
                    const entry = gitSummaryStatuses[repository.id];
                    const status = entry?.status;
                    const repositoryTitle = repository.title || repository.path;
                    const branch = entry?.error ? "状态读取失败" : status?.repositoryState === "not-repository" ? "未初始化" : status?.branch || (gitSummaryStatusRequestedIds.has(repository.id) ? "读取中…" : "状态按需读取");
                    return <article className="module-git-summary__project-card">
                      <header className="module-git-summary__project-header">
                        <strong className="module-git-summary__project-title" title={repository.path}>{repositoryTitle}</strong>
                        <span className="module-git-summary__branch" title={entry?.error ?? repository.path}>{branch}</span>
                      </header>
                      <div className={`module-git-summary__change-row${gitSummaryActionRepositoryId === repository.id ? " is-open" : ""}`}>
                        <Button className="module-git-summary__root-change" type="text" aria-label={`打开 ${repositoryTitle} 的 Git 变更`} onClick={() => openGitManager(repository.id)}>
                          <WorkbenchIcon name="review" size={15} /><span>变更</span>
                          <span className="module-git-summary__endcap">{status && status.repositoryState !== "not-repository" && !entry?.error ? <span className="module-git-summary__counts" aria-label={`新增 ${status.insertions} 行，删除 ${status.deletions} 行`}><b>+{status.insertions}</b><i>−{status.deletions}</i></span> : <span className="module-git-summary__item-state">{entry?.error ? "状态读取失败" : status?.repositoryState === "not-repository" ? "未初始化" : status ? "暂无变更" : gitSummaryStatusRequestedIds.has(repository.id) ? "正在读取…" : "点击查看"}</span>}<WorkbenchIcon name="chevron" size={14} /></span>
                        </Button>
                        <Button ref={element => { if (element) gitSummaryActionTriggerRefs.current.set(repository.id, element); else gitSummaryActionTriggerRefs.current.delete(repository.id); }} className="module-git-summary__operations-trigger" type="text" aria-label={`打开 ${repositoryTitle} 的 Git 操作`} title="Git 操作" aria-controls="module-git-summary-git-actions" aria-haspopup="menu" aria-expanded={gitSummaryActionRepositoryId === repository.id} onClick={() => setGitSummaryActionRepositoryId(current => current === repository.id ? null : repository.id)}><WorkbenchIcon name="branch" size={17} /></Button>
                      </div>
                    </article>;
                  })() : null}
                  {gitSummarySecondaryRepositories.length ? <div className="module-git-summary__folders" aria-label="其他项目文件夹">
                    {gitSummarySecondaryRepositories.map(repository => {
                      const entry = gitSummaryStatuses[repository.id];
                      const status = entry?.status;
                      const title = repository.title || repository.path;
                      const state = entry?.error ? "状态读取失败" : !status ? gitSummaryStatusRequestedIds.has(repository.id) ? "读取中…" : "状态按需读取" : status.repositoryState === "not-repository" ? "未初始化" : status.clean ? "工作区干净" : `${status.changedFileCount} 项变更`;
                      return <div key={repository.id} className={`module-git-summary__change-row${gitSummaryActionRepositoryId === repository.id ? " is-open" : ""}`}>
                        <Button className="module-git-summary__folder-row" type="text" aria-label={`打开 ${title} 的 Git 变更：${state}`} onClick={() => openGitManager(repository.id)}>
                          <WorkbenchIcon name="folder" size={15} /><span className="module-git-summary__folder-name" title={repository.path}>{title}</span>
                          <span className="module-git-summary__endcap">{status && status.repositoryState !== "not-repository" && !entry?.error ? <span className="module-git-summary__counts" aria-label={`新增 ${status.insertions} 行，删除 ${status.deletions} 行`}><b>+{status.insertions}</b><i>−{status.deletions}</i></span> : <span className="module-git-summary__folder-state">{state}</span>}<WorkbenchIcon name="chevron" size={14} /></span>
                        </Button>
                        <Button ref={element => { if (element) gitSummaryActionTriggerRefs.current.set(repository.id, element); else gitSummaryActionTriggerRefs.current.delete(repository.id); }} className="module-git-summary__operations-trigger" type="text" aria-label={`打开 ${title} 的 Git 操作`} title="Git 操作" aria-controls="module-git-summary-git-actions" aria-haspopup="menu" aria-expanded={gitSummaryActionRepositoryId === repository.id} onClick={() => setGitSummaryActionRepositoryId(current => current === repository.id ? null : repository.id)}><WorkbenchIcon name="branch" size={17} /></Button>
                      </div>;
                    })}
                  </div> : null}
                  {agentGitRepositories.length > 12 ? <p className="module-git-summary__footnote">前 12 个文件夹自动读取状态；其他项目点击后读取。</p> : null}
                  <section className="module-git-summary__file-section" aria-label="输出内容">
                    <header><strong>输出内容</strong><span>{sessionFileSummary.outputs.length || ""}</span></header>
                    {sessionFileChangesState.sessionId !== activeAiSessionId ? <p className="module-git-summary__empty">正在读取当前会话记录…</p> : sessionFileSummary.outputs.length ? sessionFileSummary.outputs.slice(0, gitSummaryShowAllFiles ? undefined : 3).map(change => {
                      const projectTitle = workspaceProjects.find(project => project.id === change.projectId)?.title ?? gitSummaryPrimaryRepository?.title ?? "默认工作区";
                      return <div className="module-git-summary__file-row" key={`output:${change.projectId ?? ""}:${change.path}`}>
                        <WorkbenchIcon name="file" size={14} /><span className="module-git-summary__file-copy"><strong title={change.path}>{change.path}</strong><small>{projectTitle} · {change.operation === "created" ? "新建" : "修改"}</small></span>
                      </div>;
                    }) : <p className="module-git-summary__empty">当前会话暂无文件输出</p>}
                  </section>
                  <section className="module-git-summary__file-section" aria-label="来源">
                    <header><strong>来源</strong><span>{sessionFileSummary.sources.length || ""}</span></header>
                    {sessionFileChangesState.sessionId !== activeAiSessionId ? <p className="module-git-summary__empty">正在读取当前会话记录…</p> : sessionFileSummary.sources.length ? sessionFileSummary.sources.slice(0, gitSummaryShowAllFiles ? undefined : 3).map(change => {
                      const projectTitle = workspaceProjects.find(project => project.id === change.projectId)?.title ?? gitSummaryPrimaryRepository?.title ?? "默认工作区";
                      return <div className="module-git-summary__file-row" key={`source:${change.projectId ?? ""}:${change.path}`}>
                        <WorkbenchIcon name="file" size={14} /><span className="module-git-summary__file-copy"><strong title={change.path}>{change.path}</strong><small>{projectTitle} · 已读取</small></span>
                      </div>;
                    }) : <p className="module-git-summary__empty">当前会话暂无文件来源</p>}
                  </section>
                </div>
                {sessionFileSummary.outputs.length + sessionFileSummary.sources.length > 3 ? <Button className="module-git-summary__view-all" type="text" onClick={handleGitSummaryFilesToggle}>{gitSummaryShowAllFiles ? "收起" : "查看全部"}</Button> : null}
              </section>;
  const sidebarProps: ApplicationSidebarProps = {
    userId,
    app,
    mode,
    section,
    gameLibrary,
    workspaceTitle,
    apps,
    applicationNavigationItems,
    onOpenSelectedApplication,
    layoutMode: metrics.mode,
    onWritingLibraryPortalTargetChange: setWritingLibraryPortalTarget,
    onNavigate: navigateWithinApplication,
    onOpenApplication: openSidebarMode,
    onToggleLeft: toggleLeft,
    notifications,
    onMarkNotificationsRead,
    onMarkSessionNotificationsRead,
    onClearNotifications,
    onOpenNotification,
    sessions: aiSessions,
    missingSessionDirectoryIds,
    aiDraft,
    pinnedSessionIds,
    onTogglePinnedSession: togglePinnedSession,
    workspaceProjects,
    workspaceProjectsReady: workspaceProjectsLoadStatus === "ready" && workspaceProjectsDataScope === `${userId}:${app}`,
    sessionsDataReady: !aiSessionsLoading && aiSessionsState.userId === userId,
    recentSessionsExpandRequestId,
    projectLoadError: workspaceProjectsError,
    onRetryProjects: retryWorkspaceProjects,
    activeSessionId: activeAiSessionId,
    sessionsLoading: aiSessionsLoading,
    sessionsError: aiSessionsError,
    providerStatus: aiProviderStatus,
    gitSummaryOpen,
    gitSummaryContent,
    onNewSession: startNewAiSession,
    onSelectSession: (sessionId) => {
      onActiveAiSessionChange(sessionId);
      setNewAiSessionProjectId(null);
      setAiSessionsError("");
      setSessionDirectoryCheckRequest({ sessionId, requestId: ++sessionDirectoryCheckSequence.current });
    },
    onArchiveSession: (session) => { void archiveAiWorkSession(session); },
    onCloseGitSummary: () => handleGitSummaryOpenChange(false),
    onPreviewMouseLeave: closeLeftPreview,
    onPreviewBlur: closeLeftPreview,
  };
  const left = <ApplicationSidebar {...sidebarProps} />;
  const showWorkbenchTabs = mode === "ai-work" && !voiceMode;
  const showRightShellControls = metrics.mode === "desktop" || (showWorkbenchTabs && metrics.mode === "compact");
  const showCenterPanelControls = chrome.rightCollapsed || metrics.mode === "mobile" || (metrics.mode === "compact" && !showWorkbenchTabs);
  const activeCenterCollapsed = centerCollapsePreview ?? centerCollapsed;
  const activeWorkspaceUtilityTab = workspaceUtilityTabs.find(tab => tab.id === activeWorkspaceUtilityTabId) ?? null;
  const hasActiveBrowserOpenTab = browserOpenTabs.some(tab => tab.active);
  const activeBrowserUrl = browserOpenTabs.find(tab => tab.active)?.url;
  const activeAgentRightPane = sidebarRight.activeId !== null ? "extension"
    : activeRightPanelSection === "applications" ? "applications"
      : aiWorkView === "git" || activeWorkspaceUtilityTabKind === "git" ? "git"
        : activeWorkspaceUtilityTabKind === "assets" ? "assets"
        : activeWorkspaceUtilityTabKind === "applications" ? "applications"
          : activeWorkspaceUtilityTabKind === "side-chat" ? "side-chat"
            : activeWorkspaceUtilityTabKind === "extension" ? "extension"
          : activeWorkspaceUtilityTabKind === "project-file" ? "project-file"
              : activeWorkspaceUtilityTabKind === "new"
                ? activeRightPanelSection === "context" && activeBrowserUrl ? "browser" : "new-tab"
                : "application-tools";
  const agentBrowserUrl = activeAgentRightPane === "browser" ? activeBrowserUrl : undefined;
  const canvasApplicationId = canvasWorkspace?.applicationId;
  const onCanvasProjectContextChange = useCallback((project: AiWorkbenchView["canvas"] | null) => {
    setAgentCanvasContext(current => {
      const previous = current.canvas;
      if (previous?.applicationId === project?.applicationId && previous?.projectId === project?.projectId && previous?.title === project?.title && previous?.updatedAt === project?.updatedAt) return current;
      return { ...current, canvas: project ?? undefined };
    });
    if (canvasApplicationId === "aivideo") setApplicationProjectContextState({ userId, project: project ?? undefined });
  }, [canvasApplicationId, userId]);
  const onWorkflowContextChange = useCallback((workflow: AiWorkbenchView["workflow"] | null) => {
    setAgentCanvasContext(current => {
      const previous = current.workflow;
      if (previous?.applicationId === workflow?.applicationId && previous?.workflowId === workflow?.workflowId && previous?.title === workflow?.title && previous?.updatedAt === workflow?.updatedAt) return current;
      return { ...current, workflow: workflow ?? undefined };
    });
  }, []);
  const onApplicationProjectContextChange = useCallback((project: AiWorkbenchView["applicationProject"] | null) => {
    setApplicationProjectContextState({ userId, project: project ?? undefined });
  }, [userId]);
  const onCanvasToolsCompleted = useCallback((projectId?: string) => {
    const applicationId = canvasWorkspace?.applicationId ?? chatAppId;
    const activeProjectId = projectId ?? (agentCanvasContext.canvas?.applicationId === applicationId ? agentCanvasContext.canvas.projectId : undefined);
    setCanvasAgentChange(current => ({ revision: current.revision + 1, projectId: activeProjectId ?? null }));
  }, [agentCanvasContext.canvas, canvasWorkspace, chatAppId]);
  const agentWorkbenchView = useMemo(() => createAgentWorkbenchView({
    rightPane: activeAgentRightPane,
    rightPaneOpen: !chrome.rightCollapsed,
    bottomTerminalOpen: chrome.terminalOpen,
    browserUseEnabled: settings.browserUse.enabled,
    ...(agentCanvasContext.canvas?.applicationId === chatAppId ? { canvas: agentCanvasContext.canvas } : {}),
    ...(agentCanvasContext.workflow?.applicationId === chatAppId ? { workflow: agentCanvasContext.workflow } : {}),
    ...(applicationProjectContext?.applicationId === chatAppId ? { applicationProject: applicationProjectContext } : {}),
    ...(agentBrowserUrl ? { activeBrowserUrl: agentBrowserUrl } : {})
  }), [activeAgentRightPane, agentBrowserUrl, agentCanvasContext.canvas, agentCanvasContext.workflow, applicationProjectContext, canvasWorkspace, chatAppId, chrome.rightCollapsed, chrome.terminalOpen, settings.browserUse.enabled]);
  const workspaceUtilityTabTitle = (tab: WorkspaceUtilityTab): string => {
    if (tab.kind === "new" && tab.browserUrl) return browserSiteHost(tab.browserUrl);
    if (tab.kind === "new") return "新标签页";
    if (tab.kind === "git") return "变更";
    if (tab.kind === "assets") return "资产库";
    if (tab.kind === "applications") return "应用";
    if (tab.kind === "side-chat") return "侧边聊天";
    if (tab.kind === "project-file") return tab.filePath?.split("/").at(-1) || "项目文件";
    const extension = sidebarRight.tabs.find(item => item.id === tab.extensionId);
    return extension ? (typeof extension.title === "function" ? extension.title() : extension.title) : "扩展面板";
  };
  const selectedWorkbenchTab = activeCenterCollapsed ? activeWorkspaceUtilityTab?.id ?? "chat" : activeWorkspaceUtilityTab?.id ?? "";
  const handleWorkbenchTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, tabId: string) => {
    const order = [...(activeCenterCollapsed ? ["chat"] : []), ...workspaceUtilityTabs.map(tab => tab.id)];
    const index = order.indexOf(tabId);
    const targetIndex = event.key === "Home" ? 0
      : event.key === "End" ? order.length - 1
        : event.key === "ArrowRight" ? (index + 1) % order.length
          : event.key === "ArrowLeft" ? (index - 1 + order.length) % order.length
            : -1;
    if (targetIndex < 0) return;
    event.preventDefault();
    const target = order[targetIndex];
    document.getElementById(`module-workbench-tab-${target}`)?.focus();
    if (activeCenterCollapsed) selectWorkbenchTab(target);
    else {
      const targetTab = workspaceUtilityTabs.find(tab => tab.id === target);
      if (targetTab) selectRightUtilityTab(targetTab);
    }
  };
  const workbenchTabs = showWorkbenchTabs ? <div className="module-workbench-tabstrip">
    <nav className="module-workbench-tabs module-workbench-tabs--context" role="tablist" aria-label="工作区标签">
      {activeCenterCollapsed ? <button id="module-workbench-tab-chat" className="module-workbench-tab" type="button" role="tab" aria-selected={selectedWorkbenchTab === "chat"} aria-controls="module-workbench-tab-panel" tabIndex={selectedWorkbenchTab === "chat" ? 0 : -1} onClick={() => selectWorkbenchTab("chat")} onKeyDown={event => handleWorkbenchTabKeyDown(event, "chat")} aria-label={activeAiSessionTitle?.trim() || "小鱼智能体"} title={activeAiSessionTitle?.trim() || "小鱼智能体"}>
        <WorkbenchIcon name="spark" size={14} /><span>{activeAiSessionTitle?.trim() || "小鱼智能体"}</span>
      </button> : null}
      {workspaceUtilityTabs.map(tab => {
        const title = workspaceUtilityTabTitle(tab);
        const selected = selectedWorkbenchTab === tab.id;
        const icon = tab.kind === "new" && tab.browserUrl ? "browser" : tab.kind === "git" ? "branch" : tab.kind === "assets" ? "archive" : tab.kind === "applications" ? "grid" : tab.kind === "side-chat" ? "help" : tab.kind === "extension" ? "extension" : tab.kind === "project-file" ? "file" : "new";
        return <div key={tab.id} className={`module-workbench-tab-item${selected ? " is-active" : ""}`} role="presentation">
          <button id={`module-workbench-tab-${tab.id}`} className="module-workbench-tab" type="button" role="tab" aria-selected={selected} aria-controls="module-workbench-tab-panel" tabIndex={selected ? 0 : -1} onClick={() => activeCenterCollapsed ? selectWorkbenchTab(tab.id) : selectRightUtilityTab(tab)} onDoubleClick={toggleCenterCollapsed} onKeyDown={event => handleWorkbenchTabKeyDown(event, tab.id)} aria-label={title} title={`${title} · 双击切换中间区`}>
            <WorkbenchIcon name={icon} size={14} /><span>{title}</span>
          </button>
          <button className="module-workbench-tab-close" type="button" aria-label={`关闭${title}`} title={`关闭${title}`} tabIndex={selected ? 0 : -1} onClick={event => { event.stopPropagation(); closeWorkspaceUtilityTab(tab.id); }}><WorkbenchIcon name="close" size={12} /></button>
        </div>;
      })}
    </nav>
    <button className="module-workbench-tab-add" type="button" aria-label="新建标签页" title="新建标签页" onClick={createWorkspaceUtilityTab}><WorkbenchIcon name="plus" size={16} /></button>
  </div> : null;
  const renderAiWorkChatContent = (workspaceHeader?: ReactNode) => <>
    {error ? <Alert className="page-alert" type="error" showIcon message={error} /> : null}
    <div className="module-ai-work-chat">
      <Suspense fallback={workspaceHeader ? <div className="module-ai-work-chat__loading">{workspaceHeader}<ApplicationContentLoading /></div> : <ApplicationContentLoading />}>
        <AiWorkChat
          workspaceHeader={workspaceHeader}
          userId={userId}
          capabilities={[
            ...registeredExtensions.filter(item => ["skill", "prompt", "expert"].includes(item.kind)
              && (item.kind !== "skill" || !settings.plugins.disabledSkillNames.includes(item.id.startsWith("skill.") ? item.id.slice("skill.".length).split(".").at(-1) ?? item.id : item.id))),
            ...skillReferences.filter(skill => !settings.plugins.disabledSkillNames.includes(skill.name))
          ]}
          capabilitiesError={skillReferencesError}
          appId={chatAppId}
          workspaceView={agentWorkbenchView}
          settings={settings}
          onSettingsChange={onSettingsChange}
          sessions={aiSessions}
          activeSessionId={activeChatSessionId}
          projectDirectoryMissing={activeChatSessionDirectoryMissing}
          newSessionProjectId={newAiSessionProjectId}
          defaultWorkspaceProjectId={defaultWorkspaceProjectId}
          newSessionGitRepositoryId={null}
          workspaceProjects={workspaceProjects}
          workspaceProjectsLoadStatus={workspaceProjectsLoadStatus}
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
          autoSubmitGoal={canvasWorkspace ? null : aiWorkGoal}
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
          onOpenProjectFile={openProjectFile}
          onSessionFileChanges={onSessionFileChanges}
          onBrowserToolCompleted={openBrowserDockForAgent}
          onCanvasToolsCompleted={onCanvasToolsCompleted}
          onOpenApplicationCanvas={() => onNavigate(`/apps/${encodeURIComponent(chatAppId)}/canvas${activeCanvasProjectId ? `/${encodeURIComponent(activeCanvasProjectId)}` : ""}`)}
          voiceMode={section === "voice"}
          onExitVoice={() => onNavigate("/work")}
        />
      </Suspense>
    </div>
  </>;
  const centerHeader = (
      <header className="module-center__header" data-layout-mode={metrics.mode} data-module-mode={mode}>
        <div className="module-center__heading">
          <button ref={leftPreviewTriggerRef} className="module-shell-icon-button module-shell-icon-button--left-preview" type="button" aria-label={mode === "normal" ? "切换当前应用功能菜单" : "切换会话与项目栏"} aria-expanded={!chrome.leftCollapsed || leftPreviewOpen} aria-keyshortcuts={shortcuts.toggleSidebar.map((chord) => chord.replace("Ctrl", "Control")).join(" ")} title={`${mode === "normal" ? "切换当前应用功能菜单" : "切换会话与项目栏"} · ${shortcuts.toggleSidebar.join(" / ") || "未分配"}`} onClick={toggleLeft} onMouseEnter={openLeftPreview} onMouseLeave={closeLeftPreview} onFocus={(event) => { if (event.currentTarget.matches(":focus-visible")) openLeftPreview(); }} onBlur={closeLeftPreview}><WorkbenchIcon name="panelLeft" size={16} /></button>
          <div className="module-center__title" title={mode === "ai-work" ? activeChatSessionTitle?.trim() || "小鱼智能体" : activeApplicationTitle}><WorkbenchIcon name={mode === "normal" ? "folder" : "spark"} size={16} /><strong>{mode === "ai-work" ? activeChatSessionTitle?.trim() || "小鱼智能体" : activeApplicationTitle}</strong></div>
        </div>
        {modeSwitchAppId && section !== "voice" ? <div className="module-center__mode-switch-slot"><Segmented
          className="module-center__mode-switch"
          size="small"
          aria-label={applicationModeScopeId ? "当前应用工作模式" : "聊天与画布工作模式"}
          value={canvasWorkspace ? "canvas" : mode === "normal" ? "manual" : "chat"}
          options={[{ label: <span className="module-center__mode-option" title="聊天"><WorkbenchIcon name="chat" size={16} /><span className="module-center__mode-option-accessible-name">聊天</span></span>, value: "chat" }, { label: <span className="module-center__mode-option" title="画布"><WorkbenchIcon name="grid" size={16} /><span className="module-center__mode-option-accessible-name">画布</span></span>, value: "canvas" }, ...(applicationModeScopeId && applicationModeScopeId !== "workspace" ? [{ label: <span className="module-center__mode-option" title="手动"><WorkbenchIcon name="new" size={16} /><span className="module-center__mode-option-accessible-name">手动</span></span>, value: "manual" }] : [])]}
          onChange={value => {
            if (value === "chat") void openApplication(modeSwitchAppId, "ai-work");
            else if (value === "canvas") {
              if (mode === "ai-work") setCanvasChatOpenOverride(userId, modeSwitchAppId, true);
              onNavigate(`/apps/${encodeURIComponent(modeSwitchAppId)}/canvas${activeCanvasProjectId ? `/${encodeURIComponent(activeCanvasProjectId)}` : ""}`);
            }
            else if (value === "manual" && applicationModeScopeId) void openApplication(applicationModeScopeId, "normal");
          }}
        /></div> : null}
        <div className="module-center__actions">
          {app === "workspace" && mode === "ai-work" && section !== "voice" ? <Button className="module-center__voice-button" type="text" size="small" aria-label="语音主脑" title="语音主脑" icon={<WorkbenchIcon name="microphone" size={15} />} onClick={() => onNavigate("/voice")}>语音主脑</Button> : null}
          {settings.general.showServiceStatus ? <span className={`module-runtime-state${serverState === "online" ? " is-connected" : ""}`} role="img" aria-label={statusLabel} title={statusLabel}><i aria-hidden="true" />{statusLabel}</span> : null}
          {gitManagerAvailable ? <div className="module-center__work-tabs" aria-label="Agent Git">
            <button type="button" aria-label={`当前 Agent 的 Git 变更：${gitSummaryText}`} aria-pressed={aiWorkView === "git"} className={aiWorkView === "git" ? "is-active" : ""} onClick={() => openGitManager()} title={`当前 Agent 的 Git 变更：${gitSummaryText}`}>
              <WorkbenchIcon name="branch" size={14} />变更{visibleGitStatus.status && visibleGitStatus.status.repositoryState !== "not-repository" ? <span>+{visibleGitStatus.status.insertions} −{visibleGitStatus.status.deletions}</span> : null}
            </button>
            {metrics.mode === "mobile" ? <Button className="module-git-summary-trigger" type="text" aria-label="在左侧打开 Git 摘要" title="Git 摘要" aria-haspopup="dialog" aria-expanded={gitSummaryOpen} aria-controls="module-sidebar-git-summary" onClick={() => {
              const open = !gitSummaryOpen;
              if (open) setChrome(current => ({ ...current, leftCollapsed: false, rightCollapsed: true }));
              handleGitSummaryOpenChange(open);
            }}><WorkbenchIcon name="summary" size={17} /></Button> : <Popover
              arrow={false}
              content={gitSummaryContent}
              getPopupContainer={trigger => trigger.closest(".module-center") ?? document.body}
              onOpenChange={handleGitSummaryOpenChange}
              open={gitSummaryOpen}
              overlayClassName="module-git-summary-popover"
              placement="bottomRight"
              trigger="click"
            >
              <Button className="module-git-summary-trigger" type="text" aria-label="打开 Git 摘要" title="Git 摘要" aria-haspopup="dialog" aria-expanded={gitSummaryOpen}><WorkbenchIcon name="summary" size={17} /></Button>
            </Popover>}
          </div> : null}
          {terminalPanelAvailable && settings.general.showBottomPanelControl && showCenterPanelControls ? <PanelControl name="terminal" title="底部终端" shortcut={shortcuts.toggleBottomPanel.join(" / ")} active={chrome.terminalOpen} onClick={toggleTerminal} /> : null}
          {canvasWorkspace ? <PanelControl name="panelRight" title={canvasChatOpen ? "收起应用聊天" : "展开应用聊天"} shortcut={shortcuts.toggleContextPanel.join(" / ")} active={canvasChatOpen} onClick={() => setCanvasChatOpen(!canvasChatOpen)} /> : showCenterPanelControls ? <PanelControl name="panelRight" title={chrome.rightCollapsed ? "展开上下文栏" : "收起上下文栏"} shortcut={shortcuts.toggleContextPanel.join(" / ")} active={!chrome.rightCollapsed} onClick={toggleRight} /> : null}
        </div>
      </header>
  );
  const center = (
    <div className="module-center">
        {mode === "ai-work" && !canvasWorkspace ? null : centerHeader}
        <main ref={moduleContentScroll.ref} onScroll={moduleContentScroll.onScroll} className={`module-center__content${mode === "ai-work" ? " module-center__content--ai-work" : ""}${canvasWorkspace ? " module-center__content--canvas" : ""}${mode === "normal" && !writingNormal && !aiVideoNormal ? " module-center__content--application" : ""}${writingNormal ? " module-center__content--writing-normal" : ""}${aiVideoNormal ? " module-center__content--aivideo" : ""}`} aria-label={canvasWorkspace ? "应用共享画布工作区" : mode === "ai-work" ? chatAppId === "workspace" ? "小鱼智能体对话" : `${activeApplicationTitle}聊天` : writingNormal ? "写作正文编辑区" : aiVideoNormal ? "AI 漫剧手动工作区" : undefined} aria-labelledby={applicationContent ? "game-library-heading" : mode === "normal" && app !== "minecraft" && !writingNormal && !aiVideoNormal ? "module-heading" : undefined}>
        {canvasWorkspace ? <Suspense fallback={<ApplicationContentLoading />}>
          <CanvasWorkspace
            applicationId={canvasWorkspace.applicationId}
            initialProjectId={canvasWorkspace.initialProjectId}
            agentChangesRevision={canvasAgentChange.revision}
            agentChangedProjectId={canvasAgentChange.projectId}
            settings={settings}
            applications={canvasWorkspace.applications}
            onNavigate={navigateWithinApplication}
            onOpenSettings={onOpenSettings}
            onProjectContextChange={onCanvasProjectContextChange}
            applicationWorkflowPanel={canvasWorkspace.applicationId === "aivideo" ? undefined : visible => canvasWorkspace.applicationId === "minecraft"
              ? <Suspense fallback={<ApplicationContentLoading />}><MinecraftWorkflowCanvas userId={userId} visible={visible} onWorkflowContextChange={onWorkflowContextChange} /></Suspense>
              : <Suspense fallback={<ApplicationContentLoading />}><ApplicationWorkflowCanvas applicationId={canvasWorkspace.applicationId} userId={userId} visible={visible} onWorkflowContextChange={onWorkflowContextChange} /></Suspense>}
          />
        </Suspense> : mode === "ai-work" ? renderAiWorkChatContent(centerHeader) : applicationContent ? applicationContent : app === "minecraft" ? <Suspense fallback={<ApplicationContentLoading />}><MinecraftWorkspace onPrepareWithAi={prompt=>{onAiDraftChange(aiDraft.trim()?`${aiDraft}\n\n${prompt}`:prompt);void openApplication("minecraft", "ai-work");}} userId={userId} section={section} role={role} settings={settings} onNavigate={navigateWithinApplication} onOpenConnectivity={() => { void openApplication("connectivity", "normal"); }} onContentReady={setMinecraftContentReady} /></Suspense> : app === "connectivity" && mode === "normal" ? <Suspense fallback={<ApplicationContentLoading />}><ConnectivityWorkspace section={section} isAdmin={hasAdminAccess(role)} /></Suspense> : writingNormal ? <Suspense fallback={<ApplicationContentLoading />}><WritingWorkspace settings={settings} onSettingsChange={onSettingsChange} workspace={writingWorkspace} loading={writingWorkspaceLoading} loadError={writingWorkspaceError} libraryPortalTarget={writingLibraryPortalTarget} onRetry={() => { void retryWritingWorkspace(); }} onWorkspaceChange={setWritingWorkspace} onRegisterFlush={registerWritingFlush} /></Suspense> : aiVideoNormal ? <Suspense fallback={<ApplicationContentLoading />}><AiVideoCanvasWorkspace canOpenFileManager={canOpenSystemFiles} onOpenFileManager={openAiVideoProjectFiles} onOpenSharedCanvas={projectId => onNavigate(`/apps/aivideo/canvas/${encodeURIComponent(projectId)}`)} onProjectContextChange={onApplicationProjectContextChange} /></Suspense> : <>
          <div className={`module-heading module-heading--workspace module-heading--${app}`}>
            <div className="module-heading__labels"><Tag className="development-tag">开发中</Tag><Tag className="module-mode-tag">{modeLabel}</Tag></div>
            <Typography.Title id="module-heading" level={2}>{activeApplicationTitle}</Typography.Title>
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

  const gitManagerPanel = gitManagerAvailable && aiWorkView === "git" ? <section className="module-git-manager" aria-label="当前 Agent Git 变更管理">
    <header className="module-git-manager__header">
      <div className="module-git-manager__title"><strong>{selectedAgentGitRepository?.title || "Git"}</strong><span>{activeAiSessionTitle ? `当前 Agent · ${activeAiSessionTitle}` : "管理 Agent 已工作的项目文件夹"}</span></div>
      <div className="module-git-manager__repository"><span title={selectedAgentGitRepository?.path ?? "首次项目写入后自动关联 Git"}>{selectedAgentGitRepository?.path ?? (sessionGitBinding.loading ? "正在读取当前项目…" : "项目文件夹会随 Agent 会话自动关联")}</span>
        {agentGitRepositories.length > 1 ? <Popover
          arrow={false}
          content={<div className="module-git-summary__list" role="listbox" aria-label="切换 Git 项目">{agentGitRepositories.map(repository => <button className="module-git-summary__item" key={repository.id} type="button" onClick={() => setGitManagerRepositoryState({ userId, repositoryId: repository.id })}><span className="module-git-summary__item-name">{repository.title || repository.path}</span><span className="module-git-summary__item-state">{repository.id === selectedAgentGitRepositoryId ? "当前管理" : "打开变更"}</span></button>)}</div>}
          getPopupContainer={trigger => trigger.closest(".module-workbench-stage") ?? document.body}
          placement="bottomRight"
          trigger="click"
        ><Button size="small">切换项目</Button></Popover> : null}
      </div>
    </header>
    {gitRepositoryChangeError || agentGitRepositoriesError ? <Alert className="module-git-manager__error" type="warning" showIcon message={gitRepositoryChangeError || agentGitRepositoriesError} /> : null}
    {!selectedAgentGitRepository && !agentGitRepositoriesLoading && !agentGitRepositoriesError ? <Alert className="module-git-manager__empty" type="info" showIcon message="当前 Agent 尚未产生 Git 仓库" description="Agent 首次在项目文件夹执行获准的创建或写入操作时，会自动初始化 Git；当前聊天仍可继续使用。" /> : null}
    <div className="module-git-manager__body">
      {selectedAgentGitRepository ? <Suspense fallback={<ApplicationContentLoading />}>
        <GitChangeSummary key={selectedAgentGitRepository.id} embedded repositoryId={selectedAgentGitRepository.id} repositoryTitle={selectedAgentGitRepository.title} status={visibleGitStatus.status} loading={visibleGitStatus.loading} loadError={visibleGitStatus.error} onRefresh={refreshSelectedGitStatus} onStatusChange={(status) => updateGitStatus(selectedAgentGitRepository.id, status)} requestedAction={gitManagerActionRequest?.repositoryId === selectedAgentGitRepository.id ? gitManagerActionRequest : null} onActionRequestHandled={requestId => setGitManagerActionRequest(current => current?.requestId === requestId ? null : current)} />
      </Suspense> : null}
    </div>
  </section> : null;

  const right = (
    <aside className="module-context" aria-label={contextLabel} data-layout-mode={metrics.mode}>
      {((!chrome.rightCollapsed && (metrics.mode === "desktop" || showWorkbenchTabs)) || (mode === "ai-work" && sidebarRight.activeId === null && rightPanelSection === "context" && aiWorkView === "chat" && activeWorkspaceUtilityTabKind === "new")) ? <div className="module-context__browser-controls">
        {!chrome.rightCollapsed && (metrics.mode === "desktop" || showWorkbenchTabs) ? <header className="module-context__shell-actions">
          {workbenchTabs}
          {showRightShellControls && terminalPanelAvailable && settings.general.showBottomPanelControl ? <PanelControl name="terminal" title="底部终端" shortcut={shortcuts.toggleBottomPanel.join(" / ")} active={chrome.terminalOpen} onClick={toggleTerminal} /> : null}
          {showRightShellControls ? <PanelControl name="panelRight" title="收起上下文栏" shortcut={shortcuts.toggleContextPanel.join(" / ")} active onClick={toggleRight} /> : null}
        </header> : null}
      {mode === "ai-work" && sidebarRight.activeId === null && rightPanelSection === "context" && aiWorkView === "chat" && activeWorkspaceUtilityTabKind === "new" ? <div className="module-context__browser-toolbar-wrap">
          <div className="module-context__browser-toolbar" aria-label="浏览器导航栏">
            <nav className="module-context__browser-navigation" aria-label="浏览器导航">
              <button type="button" aria-label="后退" title="后退" disabled={!hasActiveBrowserOpenTab} onClick={() => openBrowserDockAction("back")}>‹</button>
              <button type="button" aria-label="前进" title="前进" disabled={!hasActiveBrowserOpenTab} onClick={() => openBrowserDockAction("forward")}>›</button>
              <button type="button" aria-label="刷新网页" title="刷新网页" disabled={!hasActiveBrowserOpenTab} onClick={() => openBrowserDockAction("reload")}><WorkbenchIcon name="refresh" size={15} /></button>
            </nav>
            <form className="module-context__browser-address" onSubmit={submitBrowserAddress}>
              <input ref={browserAddressInputRef} aria-label="搜索或输入网址" type="text" inputMode="url" autoComplete="url" spellCheck={false} value={browserAddressForDisplay(browserAddress, settings.browserUse.showFullUrl, browserAddressFocused)} onFocus={() => { browserAddressEditingRef.current = true; setBrowserAddressFocused(true); }} onBlur={() => { browserAddressEditingRef.current = false; setBrowserAddressFocused(false); }} onChange={event => { setBrowserAddress(event.currentTarget.value); if (browserAddressError) setBrowserAddressError(""); }} placeholder="搜索或输入网址" />
              <button type="submit" aria-label="打开网址或搜索" title="打开网址或搜索"><WorkbenchIcon name="search" size={16} /></button>
            </form>
          </div>
          {browserAddressError ? <p className="module-context__browser-address-error" role="alert">{browserAddressError}</p> : null}
        </div> : null}
      </div> : null}
      <div id={showWorkbenchTabs && !chrome.rightCollapsed ? "module-workbench-tab-panel" : undefined} role={showWorkbenchTabs && !chrome.rightCollapsed ? "tabpanel" : undefined} aria-labelledby={showWorkbenchTabs && !chrome.rightCollapsed && selectedWorkbenchTab ? `module-workbench-tab-${selectedWorkbenchTab}` : undefined} ref={contextBodyScroll.ref} onScroll={contextBodyScroll.onScroll} className="module-context__body">
      {mode === "ai-work" ? <div className="module-context__side-chat" hidden={!sideChatOpen}>
        <Suspense fallback={<ApplicationContentLoading />}><AiWorkSideChat
          key={activeAiSessionId ?? "no-session"}
          appId={app}
          showContextUsage={settings.aiRuntime.showContextUsage}
          onOpenSettings={onOpenSettings}
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
      {mode !== "ai-work" ? <nav className="module-context__tabs" aria-label="右侧菜单">
        <button type="button" className={sidebarRight.activeId === null && activeRightPanelSection === "context" && aiWorkView === "chat" ? "is-active" : ""} aria-pressed={sidebarRight.activeId === null && activeRightPanelSection === "context" && aiWorkView === "chat"} onClick={() => { setAiWorkView("chat"); showRightPanelSection("context"); }}>{contextLabel}</button>
        {sidebarRight.tabs.flatMap((tab) => {
          const guideItems = [...(tab.guide ?? [])].sort((first, second) => first.order - second.order);
          if (guideItems.length === 0) {
            return [<button key={tab.id} type="button" className={sidebarRight.activeId === tab.id ? "is-active" : ""} aria-pressed={sidebarRight.activeId === tab.id} onClick={() => { setAiWorkView("chat"); onRightPanelSectionChange("context"); sidebarRightRuntime.control.openTab(tab.kind); }}>{typeof tab.title === "function" ? tab.title() : tab.title}</button>];
          }
          return guideItems.map((guide) => {
            const title = typeof guide.title === "function" ? guide.title() : guide.title;
            const description = typeof guide.description === "function" ? guide.description() : guide.description;
            return <button key={`${tab.id}:${guide.id}`} type="button" className={`module-context__tab-guide${sidebarRight.activeId === tab.id ? " is-active" : ""}`} aria-label={title} aria-pressed={sidebarRight.activeId === tab.id} title={description ? `${title} — ${description}` : title} onClick={() => { setAiWorkView("chat"); onRightPanelSectionChange("context"); sidebarRightRuntime.control.openTab(tab.kind); }}>
              {guide.icon ? createElement(guide.icon, { size: 16, className: "module-context__tab-guide-icon" }) : title}
            </button>;
          });
        })}
      </nav> : null}
      {sidebarRight.tabs.map((tab) => tab.keepMounted || sidebarRight.activeId === tab.id ? <div key={tab.id} className="module-context__tab-panel" hidden={sidebarRight.activeId !== tab.id} aria-hidden={sidebarRight.activeId !== tab.id}>{createElement(DshSlotOutlet, { name: "sidebar.right.pane.tab", entryKey: tab.id, fallback: <Alert type="warning" showIcon message="扩展面板尚未加载内容" description="此入口已登记，但当前没有 DSH Client 内容提供面板。请检查当前 Profile 的插件状态及 Client 入口加载错误。" /> })}</div> : null)}
      {mode === "ai-work" ? <ApplicationNavigationPanel userId={userId} app={app} mode={mode} section={section} gameLibrary={gameLibrary} workspaceTitle={workspaceTitle} apps={apps} applicationNavigationItems={applicationNavigationItems} onNavigate={navigateWithinApplication} onOpenApplication={openSidebarMode} onWritingLibraryPortalTargetChange={setWritingLibraryPortalTarget} hidden={activeRightPanelSection !== "applications" || sidebarRight.activeId !== null} /> : null}
      {sidebarRight.activeId === null && activeRightPanelSection === "context" && aiWorkView === "git" ? gitManagerPanel : null}
      {sidebarRight.activeId === null && activeRightPanelSection === "context" && aiWorkView === "chat" ? writingNormal ? <Suspense fallback={<ApplicationContentLoading />}><WritingBookInfo
        workspace={writingWorkspace}
        workspaceLoading={writingWorkspaceLoading}
        onWorkspaceChange={setWritingWorkspace}
        onClose={toggleRight}
      /></Suspense> : <>
      {mode === "ai-work" ? <>
        {activeWorkspaceUtilityTabKind === "assets" ? <Suspense fallback={<ApplicationContentLoading />}><AgentAssetLibrary repositoryId={activeSessionAssetRepository?.id ?? null} repositoryTitle={activeSessionAssetRepository?.title ?? "当前对话项目"} repositoryLoading={activeSessionAssetRepositoryLoading} /></Suspense> : null}
        {activeWorkspaceUtilityTabKind === "new" ? <Suspense fallback={<ApplicationContentLoading />}><BrowserPanel sessionId={BUILTIN_BROWSER_WORKSPACE_ID} settings={settings} browserUrl={activeWorkspaceUtilityTab?.browserUrl} preferredProviderId={preferredBrowserProvider?.providerId} providerSelectionRequestId={preferredBrowserProvider?.requestId} hidden={!activeWorkspaceUtilityTab?.browserUrl} navigationRequest={activeWorkspaceUtilityTab?.browserNavigationRequest ?? null} onNavigationRequestHandled={handleBrowserNavigationRequest} actionRequest={activeWorkspaceUtilityTab?.browserActionRequest ?? null} onActionRequestHandled={handleBrowserActionRequest} onOpenTabsChange={handleBrowserOpenTabsChange} /></Suspense> : null}
        {activeWorkspaceUtilityTabKind === "project-file" && activeWorkspaceUtilityTab?.projectId && activeWorkspaceUtilityTab.filePath ? (() => {
          const project = workspaceProjects.find(item => item.id === activeWorkspaceUtilityTab.projectId && (!item.appId || item.appId === app));
          return project && (app === "workspace" || app === "minecraft")
            ? <AiWorkProjectFileDock key={`${project.id}:${activeWorkspaceUtilityTab.sourceId ?? ""}:${activeWorkspaceUtilityTab.filePath}`} project={project} appId={app} path={activeWorkspaceUtilityTab.filePath} sourceId={activeWorkspaceUtilityTab.sourceId} initialView={activeWorkspaceUtilityTab.initialView} onOpenProjectFile={openProjectFile} />
            : <Alert type="warning" showIcon message="项目文件不可用" description="当前账户或应用中没有此活动记录绑定的项目，未改用其他项目读取。" />;
        })() : null}
        {activeWorkspaceUtilityTabKind === "new" && !activeWorkspaceUtilityTab?.browserUrl ? <>
        <div className="module-context__launcher">
          <section className="module-context__launcher-name" aria-label="名称">
            <header className="module-context__heading"><div><strong>新标签页</strong><span>选择工具，在当前标签页打开</span></div><span className={`module-context__connection module-context__connection--${serverState}`}><i aria-hidden="true" />{serverState === "online" ? "已连接" : serverState === "checking" ? "检查中" : "未连接"}</span><button className="module-shell-icon-button module-context__close" type="button" aria-label="收起工具与资源" title="收起工具与资源" onClick={toggleRight}><WorkbenchIcon name="close" size={15} /></button></header>
          </section>
          <section className="module-context__launcher-section">
            <header><strong>工具</strong></header>
            <div className="module-context__launcher-grid module-context__launcher-quick-tools">
              {gitManagerAvailable && !findGitWorkspaceUtilityTab(workspaceUtilityTabs) ? <button type="button" onClick={() => openWorkspaceUtility("git")}><WorkbenchIcon name="branch" size={16} /><span><strong>变更</strong></span></button> : null}
              <button type="button" onClick={() => openWorkspaceUtility("assets")}><WorkbenchIcon name="archive" size={16} /><span><strong>资产库</strong></span></button>
              <button type="button" onClick={() => onNavigate("/files")} title="打开已接入的节点文件管理"><WorkbenchIcon name="file" size={16} /><span><strong>文件</strong></span></button>
              <button type="button" onClick={() => openWorkspaceUtility("side-chat")} aria-keyshortcuts={shortcuts.openSideChat.map((chord) => chord.replace("Ctrl", "Control")).join(" ")}><WorkbenchIcon name="help" size={16} /><span><strong>侧边聊天</strong></span>{shortcuts.openSideChat.length > 0 ? <kbd>{shortcuts.openSideChat.join(" / ")}</kbd> : null}</button>
              <details className="module-context__launcher-more">
                <summary><WorkbenchIcon name="grid" size={16} /><span>更多工具…</span><WorkbenchIcon name="chevron" size={14} /></summary>
                <div className="module-context__launcher-more-content">
                  <div className="module-context__launcher-extra-grid">
                    {applicationNavigationItems.length > 0 ? <button type="button" onClick={() => openWorkspaceUtility("applications")}><WorkbenchIcon name="grid" size={16} /><span><strong>应用</strong></span></button> : null}
                    {sidebarRight.tabs.map(tab => <button key={tab.id} type="button" onClick={() => openWorkspaceUtility("extension", tab.id)}><WorkbenchIcon name="extension" size={16} /><span><strong>{typeof tab.title === "function" ? tab.title() : tab.title}</strong></span></button>)}
                  </div>
                  <section className="module-context__launcher-resources">
                    <header><strong>能力资源</strong><span>{extensionsLoading ? "正在读取" : `${registeredExtensions.length} 项`}</span></header>
                    {extensionsLoading ? <p className="module-context__launcher-empty">正在读取已登记能力资源…</p> : registeredExtensions.length > 0 ? <div className="module-context__resource-list">
                      {registeredExtensions.filter(item => !item.applicationIds || item.applicationIds.includes(app)).map(item => <div key={item.id} title={item.description}><WorkbenchIcon name={item.kind === "skill" ? "bolt" : item.kind === "expert" ? "spark" : item.kind === "prompt" ? "file" : "tools"} size={14} /><span><strong>{item.name}</strong><small>{item.kind === "skill" ? "Skill" : item.kind === "expert" ? "Expert" : item.kind === "prompt" ? "Prompt" : "Tool"}</small></span></div>)}
                    </div> : <p className="module-context__launcher-empty">当前没有已登记的能力资源。</p>}
                    {skillReferencesError ? <p className="module-context__launcher-empty">{skillReferencesError}</p> : null}
                  </section>
                </div>
              </details>
            </div>
          </section>
          <section className="module-context__launcher-recommendation" aria-labelledby="module-context-launcher-recommendation-title">
            <header><strong id="module-context-launcher-recommendation-title">推荐</strong></header>
            {browserOpenTabs.length ? <div className="module-context__launcher-tabs">
              {browserOpenTabs.map(tab => <button key={`${tab.id}:${tab.url}`} className="module-context__launcher-site" type="button" title={tab.url} onClick={() => openBrowserWebsite(tab.url)}>
                <WorkbenchIcon name="browser" size={22} />
                <span><strong>{tab.title || browserSiteHost(tab.url)}</strong><small>{browserSiteHost(tab.url)}{tab.active ? " · 当前标签" : ""}</small></span>
              </button>)}
            </div> : <div className="module-context__launcher-recommendation-empty"><span>打开的网页会显示在这里。</span><button type="button" onClick={() => browserAddressInputRef.current?.focus()}>输入网址</button></div>}
          </section>
          <section className="module-context__launcher-recent" aria-labelledby="module-context-launcher-recent-title">
            <header><strong id="module-context-launcher-recent-title">最近</strong></header>
            {!settings.browserUse.recordRecentSites
              ? <p className="module-context__launcher-recent-empty">最近网站记录已在浏览器设置中关闭。</p>
              : browserRecentSitesState.userId === userId && browserRecentSitesState.status === "loading" && visibleBrowserRecentSites.length === 0
                ? <p className="module-context__launcher-recent-empty" role="status">正在读取最近访问的网站…</p>
                : browserRecentSitesState.userId === userId && browserRecentSitesState.status === "error" && visibleBrowserRecentSites.length === 0
                  ? <p className="module-context__launcher-recent-empty" role="status">最近网站暂时无法读取。</p>
                  : visibleBrowserRecentSites.length > 0
                    ? <div className="module-context__launcher-recent-list">
                      {visibleBrowserRecentSites.map(site => <button key={site.url} className="module-context__launcher-recent-site" type="button" title={site.url} onClick={() => openBrowserWebsite(site.url)}>
                        <WorkbenchIcon name="browser" size={18} />
                        <span><strong>{browserSiteHost(site.url)}</strong><small>{site.url}</small></span>
                        <time dateTime={site.visitedAt}>{browserVisitTime(site.visitedAt)}</time>
                      </button>)}
                    </div>
                    : <p className="module-context__launcher-recent-empty">你或 Agent 在 LFAA 浏览器访问过的网站会显示在这里。</p>}
          </section>
        </div>
        </> : null}
      </> : <>
        <header className="module-context__heading"><div><strong>{contextLabel}</strong><span>手动操作与管理</span></div><span className={`module-context__connection module-context__connection--${serverState}`}><i aria-hidden="true" />{serverState === "online" ? "已连接" : serverState === "checking" ? "检查中" : "未连接"}</span><button className="module-shell-icon-button module-context__close" type="button" aria-label={`收起${contextLabel}`} title={`收起${contextLabel}`} onClick={toggleRight}><WorkbenchIcon name="close" size={15} /></button></header>
        <div className="module-context__tools">
          <button type="button" onClick={() => onNavigate("/files")} title="打开已接入的节点文件管理"><WorkbenchIcon name="file" size={16} /><span>节点文件</span></button>
        </div>
        <section className="module-context__section"><header><span>当前应用</span><b>1</b></header><div className="module-context__app"><span className={`application-monogram application-monogram--${selectedApp.color}`} aria-hidden="true">{selectedApp.initials}</span><div><strong>{activeApplicationTitle}</strong><small>{modeLabel}</small></div></div></section>
        <section className="module-context__section"><header><span>服务状态</span></header><div className="module-context__service"><ServiceStatus state={serverState} /><small>控制端健康状态</small></div></section>
        {app === "minecraft" ? <TerminalManagerRightSidebar /> : null}
        {app !== "minecraft" ? <section className="module-context__note"><strong>领域应用</strong><p>在这里查看和操作当前领域数据；目标理解与工具执行由小鱼 Agent 统一协调。</p></section> : null}
      </>}
      </> : null}
      </div>
      </div>
      <div className="module-context__account"><WorkbenchIcon name="user" size={15} /><span>{username}</span><small>{userRoleLabel(role)}</small></div>
    </aside>
  );

  const bottom = terminalPanelAvailable ? <TaskTerminal appId={app} settings={settings} sessionId={activeAiSessionId} role={role} onClose={toggleTerminal} /> : null;

  const previewStyle = { "--module-left-preview-width": `${leftPaneWidth}px` } as CSSProperties;
  const leftPreviewMode = chrome.leftCollapsed && metrics.mode !== "mobile";
  const leftRegionClassName = `module-workbench-region--secondary-navigation${leftPreviewMode ? ` module-left-preview${leftPreviewOpen ? " is-visible" : ""}` : ""}`;
  return (
    <div className={`module-workbench-stage module-workbench-stage--application${voiceMode ? " module-workbench-stage--voice" : ""}`} style={previewStyle} data-layout-mode={metrics.mode}>
      <ResizableWorkbench
        rootElementRef={layoutRef}
        className="module-workbench-inner module-workbench-layout"
        leading={<GlobalNavigationRail username={username} role={role} serverState={serverState} shortcuts={shortcuts} activePage="home" applications={applicationNavigationItems} onOpenRecentSessions={showRecentSessions} showServiceStatus={settings.general.showServiceStatus} onNavigate={onNavigate} onOpenApplication={openApplication} isSharedWorkHome={app === "workspace" && mode === "ai-work" && section !== "canvas"} onOpenFiles={() => onNavigate("/files")} onOpenSettings={onOpenSettings} onLogout={onLogout} onToggleTools={openToolsPanel} applicationsExpanded={mode === "normal" ? !chrome.leftCollapsed : activeRightPanelSection === "applications" && !chrome.rightCollapsed} applicationsTargetId="module-context-applications" onToggleApplications={mode === "ai-work" ? toggleApplicationsPanel : undefined} />}
        leadingRegionClassName="module-workbench-region--leading"
        leftRegionClassName={leftRegionClassName}
        centerRegionClassName="module-workbench-region--center-workspace"
        rightRegionClassName="module-workbench-region--right-menu"
        bottomRegionClassName="module-workbench-region--bottom"
        left={left}
        center={center}
        leftVisible={!voiceMode}
        right={voiceMode ? null : canvasWorkspace ? (
          <aside className="module-context module-context--canvas-chat" aria-label={`${canvasWorkspace ? canvasApplicationTitle : activeApplicationTitle}聊天`} data-layout-mode={metrics.mode} data-testid="canvas-agent-chat">
            <header className="module-context__heading">
              <div>
                <strong>{activeChatSessionTitle?.trim() || `${activeApplicationTitle}助手`}</strong>
                <span>{canvasWorkspace ? "当前项目对话" : `${activeApplicationTitle} · 当前项目对话`}</span>
              </div>
              <button type="button" className="module-shell-icon-button module-context__close" aria-label="收起应用聊天" onClick={() => setCanvasChatOpen(false)}><WorkbenchIcon name="close" size={15} /></button>
            </header>
            <div className="module-context__body module-context__body--canvas-chat">{renderAiWorkChatContent()}</div>
          </aside>
        ) : right}
        bottom={!voiceMode && terminalPanelAvailable && chrome.terminalOpen && settings.general.terminalPosition === "bottom" ? bottom : null}
        storageKey={LAYOUT_KEY}
        leftLimits={metrics.left}
        rightLimits={metrics.right}
        bottomLimits={metrics.bottom}
        containerWidth={metrics.containerWidth}
        snapCaptureRatio={metrics.snapCaptureRatio}
        snapHysteresis={metrics.snapHysteresis}
        minCenterWidth={metrics.minCenterWidth}
        centerCollapsed={showWorkbenchTabs && centerCollapsed}
        centerCollapseEnabled={showWorkbenchTabs}
        onCenterCollapsedChange={handleCenterCollapsedChange}
        onCenterCollapsePreviewChange={setCenterCollapsePreview}
        layoutMode={metrics.mode}
        responsiveRightDock
        responsiveLeftDock
        leftWidth={leftPaneWidth}
        onLeftWidthChange={setLeftPaneWidth}
        leftCollapsed={chrome.leftCollapsed}
        onLeftCollapsedChange={(leftCollapsed) => setChrome((current) => ({ ...current, leftCollapsed }))}
        rightCollapsed={canvasWorkspace ? !canvasChatOpen : chrome.rightCollapsed}
        onRightCollapsedChange={(rightCollapsed) => {
          if (canvasWorkspace) setCanvasChatOpen(!rightCollapsed);
          else setChrome((current) => ({ ...current, rightCollapsed }));
        }}
        bottomOpen={terminalPanelAvailable && chrome.terminalOpen && settings.general.terminalPosition === "bottom"}
        onBottomOpenChange={(terminalOpen) => setChrome((current) => ({ ...current, terminalOpen }))}
      />
    </div>
  );
}
