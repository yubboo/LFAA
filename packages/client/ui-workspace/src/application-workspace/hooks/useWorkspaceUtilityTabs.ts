/**
 * 文件：useWorkspaceUtilityTabs.ts
 * 功能：维护当前工作区工具页签、浏览器地址动作和相关临时交互状态。
 * 作用：通过既有 Browser、Connection、Client Store Owner 协调请求与清理。
 * 关联文件：../../ApplicationWorkspace.tsx、../types.ts、Browser Dock/Session Owners。
 */
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { getErrorMessage, loadBrowserRecentSites, recordBrowserRecentSites, type AiActivityFileChange, type AiHostTask, type ApplicationId, type BrowserProviderId, type BrowserRecentSite, type UserSettings, type WorkspaceProject } from "lfaa-client-connection/src/api.js";
import { resolveBrowserAddress } from "lfaa-client-ui-sidebar-browser/src/browser-address.js";
import type { BrowserDockTabsUpdate } from "lfaa-client-ui-sidebar-browser/src/browser-tabs-update.js";
import { matchesAgentBrowserDockSyncRequest, shouldSyncAgentBrowserDockPage, type BrowserDockAgentSyncRequest } from "../../browser-dock-sync.js";
import { sidebarRightRuntime } from "../../sidebar-right-runtime.js";
import { resolveRecentItems } from "lfaa-util-values/src/recent-window.js";
import { findAssetWorkspaceUtilityTab, findGitWorkspaceUtilityTab } from "../pure-utils.js";
import type { BrowserOpenTab, WorkspaceUtilityTab } from "../types.js";
import type { WorkbenchLayoutMode } from "lfaa-client-ui-dockkit/src/workbench-layout.types.js";

export interface UseWorkspaceUtilityTabsOptions {
  userId: string;
  app: ApplicationId;
  mode: "normal" | "ai-work";
  activeSessionId: string | null;
  settings: UserSettings;
  layoutMode: WorkbenchLayoutMode;
  rightPanelSection: "context" | "applications";
  onRightPanelSectionChange: (section: "context" | "applications") => void;
  sidebarRight: { activeId: string | null; tabs: Array<{ id: string; kind: string }> };
  setChrome: Dispatch<SetStateAction<{ leftCollapsed: boolean; centerCollapsed: boolean; rightCollapsed: boolean; terminalOpen: boolean }>>;
  showRightPanelSection: (section: "context" | "applications") => void;
  setCenterCollapsed: (next: boolean | ((current: boolean) => boolean)) => void;
  setCenterCollapsePreview: (preview: boolean | null) => void;
  workspaceProjects: WorkspaceProject[];
}

export function useWorkspaceUtilityTabs({ userId, app, mode, activeSessionId, settings, layoutMode, rightPanelSection, onRightPanelSectionChange, sidebarRight, setChrome, showRightPanelSection, setCenterCollapsed, setCenterCollapsePreview, workspaceProjects }: UseWorkspaceUtilityTabsOptions) {
  const [sideChatOpen, setSideChatOpen] = useState(false);
  const [sideChatInitialQuestion, setSideChatInitialQuestion] = useState("");
  const [sideChatQuestionRevision, setSideChatQuestionRevision] = useState(0);
  const [aiWorkView, setAiWorkView] = useState<"chat" | "git">("chat");
  const [tabs, setTabs] = useState<WorkspaceUtilityTab[]>([{ id: "workspace-tab-1", kind: "new" }]);
  const [activeTabId, setActiveTabId] = useState("workspace-tab-1");
  const activeTab = tabs.find(tab => tab.id === activeTabId) ?? null;
  const activeTabKind = activeTab?.kind ?? null;
  const [previewOpenId, setPreviewOpenId] = useState("");
  const [browserPreviewRequest, setBrowserPreviewRequest] = useState<{ tabId: string; requestId: number } | null>(null);
  const [browserPreviewImage, setBrowserPreviewImage] = useState<{ tabId: string; requestId: number; dataUrl: string } | null>(null);
  const browserPreviewSequenceRef = useRef(0);
  const browserPreviewRequestRef = useRef<{ tabId: string; requestId: number } | null>(null);
  const previewOpenRef = useRef("");
  const [preferredBrowserProvider, setPreferredBrowserProvider] = useState<{ providerId: BrowserProviderId; requestId: number } | null>(null);
  const browserProviderSelectionSequence = useRef(0);
  const pendingAgentBrowserDockSyncRef = useRef<BrowserDockAgentSyncRequest | null>(null);
  const [browserAddress, setBrowserAddress] = useState("");
  const [browserAddressError, setBrowserAddressError] = useState("");
  const [browserAddressFocused, setBrowserAddressFocused] = useState(false);
  const browserAddressInputRef = useRef<HTMLInputElement | null>(null);
  const browserAddressEditingRef = useRef(false);
  const [browserOpenTabs, setBrowserOpenTabs] = useState<BrowserOpenTab[]>([]);
  const [browserRecentSitesState, setBrowserRecentSitesState] = useState<{ userId: string; sites: BrowserRecentSite[] }>({ userId, sites: [] });
  const [browserRecentSitesNow, setBrowserRecentSitesNow] = useState(() => Date.now());
  const reportedBrowserTabUrlsRef = useRef(new Map<string, string>());
  const recentSiteReportTailRef = useRef(Promise.resolve());
  const currentRecentSiteOwnerRef = useRef(userId);
  currentRecentSiteOwnerRef.current = userId;
  const utilityTabId = useRef(1);
  const browserNavigationRequestSequence = useRef(0);
  const browserActionRequestSequence = useRef(0);
  const utilityScope = useRef({ userId, mode });

  const browserRecentSitesForDisplay = useMemo(() => settings.browserUse.recordRecentSites && browserRecentSitesState.userId === userId
    ? resolveRecentItems(browserRecentSitesState.sites, site => site.visitedAt, browserRecentSitesNow)
    : { items: [] as BrowserRecentSite[], nextExpiryAt: null },
  [browserRecentSitesNow, browserRecentSitesState.sites, browserRecentSitesState.userId, settings.browserUse.recordRecentSites, userId]);

  const showWorkspaceUtilityTab = useCallback((tab: WorkspaceUtilityTab) => {
    setChrome(current => ({ ...current, rightCollapsed: false, ...(layoutMode !== "desktop" ? { leftCollapsed: true } : {}) }));
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
  }, [layoutMode, onRightPanelSectionChange, setChrome, showRightPanelSection, sidebarRight.tabs]);

  useEffect(() => {
    if (utilityScope.current.userId === userId && utilityScope.current.mode === mode) return;
    utilityScope.current = { userId, mode };
    const nextTab = { id: `workspace-tab-${++utilityTabId.current}`, kind: "new" as const };
    setTabs([nextTab]);
    setActiveTabId(nextTab.id);
    setCenterCollapsed(false);
    setSideChatOpen(false);
    setAiWorkView("chat");
    sidebarRightRuntime.select(null);
  }, [mode, setCenterCollapsed, userId]);

  useEffect(() => { setBrowserOpenTabs([]); }, [activeSessionId, mode, userId]);
  useEffect(() => { reportedBrowserTabUrlsRef.current.clear(); }, [userId]);
  useEffect(() => {
    if (mode !== "ai-work" || activeTabKind !== "new") return;
    if (!settings.browserUse.recordRecentSites) {
      setBrowserRecentSitesState({ userId, sites: [] });
      return;
    }
    const controller = new AbortController();
    void loadBrowserRecentSites(12, controller.signal).then(result => {
      if (!controller.signal.aborted) setBrowserRecentSitesState({ userId, sites: result.sites });
    }).catch(() => undefined);
    return () => controller.abort();
  }, [activeTabId, activeTabKind, mode, settings.browserUse.recordRecentSites, userId]);
  useEffect(() => {
    const { nextExpiryAt } = browserRecentSitesForDisplay;
    if (nextExpiryAt === null) return;
    const timeoutId = window.setTimeout(() => setBrowserRecentSitesNow(Date.now()), Math.max(1, nextExpiryAt - Date.now() + 1));
    return () => window.clearTimeout(timeoutId);
  }, [browserRecentSitesForDisplay.nextExpiryAt]);

  const openWorkspaceUtility = useCallback((kind: Exclude<WorkspaceUtilityTab["kind"], "new" | "project-file" | "session-files" | "agent-host-task">, extensionId?: string) => {
    if (kind === "git") {
      const existing = findGitWorkspaceUtilityTab(tabs);
      if (existing) { setActiveTabId(existing.id); showWorkspaceUtilityTab(existing); return; }
    }
    if (kind === "assets") {
      const existing = findAssetWorkspaceUtilityTab(tabs);
      if (existing) { setActiveTabId(existing.id); showWorkspaceUtilityTab(existing); return; }
    }
    const active = tabs.find(tab => tab.id === activeTabId);
    if (active?.kind === "new") {
      const next = { ...active, kind, ...(extensionId ? { extensionId } : {}) } as WorkspaceUtilityTab;
      setTabs(current => current.map(tab => tab.id === next.id ? next : tab));
      showWorkspaceUtilityTab(next);
      return;
    }
    const next = { id: `workspace-tab-${++utilityTabId.current}`, kind, ...(extensionId ? { extensionId } : {}) } as WorkspaceUtilityTab;
    setTabs(current => [...current, next]);
    setActiveTabId(next.id);
    showWorkspaceUtilityTab(next);
  }, [activeTabId, showWorkspaceUtilityTab, tabs]);

  const openProjectFile = useCallback((projectId: string, path: string, sourceId?: string, initialView: "source" | "diff" = "source") => {
    if ((app !== "workspace" && app !== "minecraft") || !path || path.length > 1024 || path.startsWith("/") || path.startsWith("\\") || path.includes("\\") || path.split("/").some(segment => !segment || segment === "." || segment === "..")) return;
    const project = workspaceProjects.find(item => item.id === projectId && (!item.appId || item.appId === app));
    if (!project) return;
    const existing = tabs.find(tab => tab.kind === "project-file" && tab.projectId === projectId && tab.filePath === path && (tab.sourceId ?? "") === (sourceId ?? ""));
    if (existing) {
      const next = { ...existing, initialView };
      setTabs(current => current.map(tab => tab.id === existing.id ? next : tab));
      setActiveTabId(next.id);
      setBrowserAddress("");
      showWorkspaceUtilityTab(next);
      return;
    }
    const active = tabs.find(tab => tab.id === activeTabId);
    const reuseBlank = active?.kind === "new" && !active.browserUrl && !active.browserNavigationRequest && !active.browserActionRequest;
    const next: WorkspaceUtilityTab = { id: reuseBlank ? active.id : `workspace-tab-${++utilityTabId.current}`, kind: "project-file", projectId, filePath: path, ...(sourceId ? { sourceId } : {}), initialView };
    setTabs(current => reuseBlank ? current.map(tab => tab.id === active.id ? next : tab) : [...current, next]);
    setActiveTabId(next.id);
    setBrowserAddress("");
    showWorkspaceUtilityTab(next);
  }, [activeTabId, app, showWorkspaceUtilityTab, tabs, workspaceProjects]);

  const openBrowserWebsite = useCallback((url: string) => {
    setBrowserAddressError("");
    const active = tabs.find(tab => tab.id === activeTabId);
    const request = { id: `browser-navigation-${++browserNavigationRequestSequence.current}`, url };
    setBrowserAddress(url);
    if (active?.kind === "new") {
      const next: WorkspaceUtilityTab = { ...active, browserUrl: url, browserNavigationRequest: request, browserActionRequest: undefined };
      setTabs(current => current.map(tab => tab.id === next.id ? next : tab));
      setActiveTabId(next.id);
      showWorkspaceUtilityTab(next);
      return;
    }
    const next: WorkspaceUtilityTab = { id: `workspace-tab-${++utilityTabId.current}`, kind: "new", browserUrl: url, browserNavigationRequest: request };
    setTabs(current => [...current, next]);
    setActiveTabId(next.id);
    showWorkspaceUtilityTab(next);
  }, [activeTabId, showWorkspaceUtilityTab, tabs]);

  const openBrowserDockForAgent = useCallback((providerId: BrowserProviderId) => {
    const requestId = ++browserProviderSelectionSequence.current;
    pendingAgentBrowserDockSyncRef.current = { providerId, requestId };
    setPreferredBrowserProvider({ providerId, requestId });
    const active = tabs.find(tab => tab.id === activeTabId);
    const browserTab = active?.kind === "new" && !active.browserNavigationRequest && !active.browserActionRequest
      ? active
      : tabs.find(tab => tab.kind === "new" && !tab.browserNavigationRequest && !tab.browserActionRequest);
    const next = browserTab ?? { id: `workspace-tab-${++utilityTabId.current}`, kind: "new" as const };
    if (!browserTab) {
      setBrowserAddress("");
      setBrowserAddressError("");
      setTabs(current => [...current, next]);
    }
    setActiveTabId(next.id);
    showWorkspaceUtilityTab(next);
  }, [activeTabId, showWorkspaceUtilityTab, tabs]);

  const submitBrowserAddress = useCallback((event: FormEvent<HTMLFormElement>) => {
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
    const active = tabs.find(tab => tab.id === activeTabId);
    const activeBrowserTab = browserOpenTabs.find(tab => tab.active);
    const next: WorkspaceUtilityTab = active?.kind === "new"
      ? { ...active, browserUrl: active.browserUrl ?? activeBrowserTab?.url, browserActionRequest: request }
      : { id: `workspace-tab-${++utilityTabId.current}`, kind: "new", browserUrl: activeBrowserTab?.url, browserActionRequest: request };
    setTabs(current => active?.kind === "new" ? current.map(tab => tab.id === next.id ? next : tab) : [...current, next]);
    setActiveTabId(next.id);
    showWorkspaceUtilityTab(next);
  }, [activeTabId, browserOpenTabs, showWorkspaceUtilityTab, tabs]);

  const handleBrowserActionRequest = useCallback((requestId: string) => setTabs(current => current.map(tab => tab.browserActionRequest?.id === requestId ? { ...tab, browserActionRequest: undefined } : tab)), []);
  const handleBrowserNavigationRequest = useCallback((requestId: string) => setTabs(current => current.map(tab => tab.browserNavigationRequest?.id === requestId ? { ...tab, browserNavigationRequest: undefined } : tab)), []);

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
        const key = `${activeSessionId ?? "no-session"}:${tab.id}`;
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
    const activeUtilityTab = tabs.find(tab => tab.id === activeTabId);
    const activeBrowserTab = safeTabs.find(tab => tab.active);
    const previousActiveBrowserTab = browserOpenTabs.find(tab => tab.active);
    const isAgentSyncResponse = matchesAgentBrowserDockSyncRequest(pendingAgentBrowserDockSyncRef.current, update);
    const shouldSyncAgentPage = shouldSyncAgentBrowserDockPage(pendingAgentBrowserDockSyncRef.current, update, activeUtilityTab?.kind === "new", Boolean(activeBrowserTab), Boolean(activeUtilityTab?.browserNavigationRequest || activeUtilityTab?.browserActionRequest));
    const activeBrowserPageChanged = Boolean(previousActiveBrowserTab && (previousActiveBrowserTab.id !== activeBrowserTab?.id || previousActiveBrowserTab.url !== activeBrowserTab.url));
    const keepSavedAddressDuringOwnerRecovery = activeBrowserTab?.url === "about:blank" && /^https?:\/\//iu.test(activeUtilityTab?.browserUrl ?? "");
    if (isAgentSyncResponse && update.snapshotReady && activeUtilityTab?.kind === "new") pendingAgentBrowserDockSyncRef.current = null;
    if (activeUtilityTab?.kind === "new" && activeBrowserTab && !keepSavedAddressDuringOwnerRecovery && (shouldSyncAgentPage || activeUtilityTab.browserUrl !== undefined || activeBrowserPageChanged || browserOpenTabs.length === 0)) {
      setTabs(current => current.map(tab => tab.id === activeUtilityTab.id && tab.kind === "new" && tab.browserUrl !== activeBrowserTab.url ? { ...tab, browserUrl: activeBrowserTab.url } : tab));
      if (!browserAddressEditingRef.current) setBrowserAddress(activeBrowserTab.url);
    }
    setBrowserOpenTabs(safeTabs);
  }, [activeSessionId, activeTabId, browserOpenTabs, settings.browserUse.recordRecentSites, tabs, userId]);

  const createWorkspaceUtilityTab = useCallback(() => {
    const next: WorkspaceUtilityTab = { id: `workspace-tab-${++utilityTabId.current}`, kind: "new" };
    setBrowserAddress("");
    setTabs(current => [...current, next]);
    setActiveTabId(next.id);
    showWorkspaceUtilityTab(next);
  }, [showWorkspaceUtilityTab]);
  const selectWorkbenchTab = useCallback((tabId: "chat" | string) => {
    setCenterCollapsePreview(null);
    if (tabId === "chat") { setCenterCollapsed(false); return; }
    const selectedTab = tabs.find(item => item.id === tabId);
    if (!selectedTab) return;
    setBrowserAddress(selectedTab.browserUrl ?? "");
    setActiveTabId(selectedTab.id);
    showWorkspaceUtilityTab(selectedTab);
    setCenterCollapsed(true);
  }, [setCenterCollapsed, setCenterCollapsePreview, showWorkspaceUtilityTab, tabs]);
  const selectRightUtilityTab = useCallback((tab: WorkspaceUtilityTab) => {
    setBrowserAddress(tab.browserUrl ?? "");
    setActiveTabId(tab.id);
    showWorkspaceUtilityTab(tab);
  }, [showWorkspaceUtilityTab]);
  const toggleCenterCollapsed = useCallback(() => {
    setCenterCollapsePreview(null);
    setCenterCollapsed(collapsed => !collapsed);
  }, [setCenterCollapsed, setCenterCollapsePreview]);
  const handleCenterCollapsedChange = useCallback((collapsed: boolean) => {
    setCenterCollapsed(collapsed);
    if (!collapsed) { setCenterCollapsePreview(null); return; }
    let selectedTab = tabs.find(item => item.id === activeTabId);
    if (!selectedTab) {
      setBrowserAddress("");
      selectedTab = { id: `workspace-tab-${++utilityTabId.current}`, kind: "new" };
      setTabs(current => [...current, selectedTab!]);
      setActiveTabId(selectedTab.id);
    }
    showWorkspaceUtilityTab(selectedTab);
  }, [activeTabId, setCenterCollapsed, setCenterCollapsePreview, showWorkspaceUtilityTab, tabs]);
  const closeWorkspaceUtilityTab = useCallback((tabId: string) => {
    const index = tabs.findIndex(tab => tab.id === tabId);
    if (index < 0) return;
    const nextTabs = tabs.filter(tab => tab.id !== tabId);
    if (!nextTabs.length) {
      setBrowserAddress("");
      const replacement: WorkspaceUtilityTab = { id: `workspace-tab-${++utilityTabId.current}`, kind: "new" };
      setTabs([replacement]);
      setActiveTabId(replacement.id);
      showWorkspaceUtilityTab(replacement);
      setChrome(current => ({ ...current, rightCollapsed: true }));
      return;
    }
    setTabs(nextTabs);
    if (activeTabId === tabId) {
      const next = nextTabs[Math.min(index, nextTabs.length - 1)];
      setBrowserAddress(next.browserUrl ?? "");
      setActiveTabId(next.id);
      showWorkspaceUtilityTab(next);
    }
  }, [activeTabId, setChrome, showWorkspaceUtilityTab, tabs]);

  const openSessionFiles = useCallback((sessionId: string, sessionFiles: AiActivityFileChange[]) => {
    const files = sessionFiles.slice(0, 256);
    const existing = tabs.find(tab => tab.kind === "session-files" && tab.sessionId === sessionId);
    const nextTab: WorkspaceUtilityTab = existing
      ? { ...existing, sessionFiles: files }
      : { id: `workspace-tab-${++utilityTabId.current}`, kind: "session-files", sessionId, sessionFiles: files };
    setTabs(current => existing ? current.map(tab => tab.id === existing.id ? nextTab : tab) : [...current, nextTab]);
    setActiveTabId(nextTab.id);
    showWorkspaceUtilityTab(nextTab);
  }, [showWorkspaceUtilityTab, tabs]);

  const openAiHostTask = useCallback((task: AiHostTask) => {
    const existing = tabs.find(tab => tab.kind === "agent-host-task" && tab.hostTaskId === task.id);
    const nextTab: WorkspaceUtilityTab = existing
      ? { ...existing, hostTaskSnapshot: task }
      : { id: `workspace-tab-${++utilityTabId.current}`, kind: "agent-host-task", hostTaskId: task.id, hostTaskSnapshot: task };
    setTabs(current => existing ? current.map(tab => tab.id === existing.id ? nextTab : tab) : [...current, nextTab]);
    setActiveTabId(nextTab.id);
    showWorkspaceUtilityTab(nextTab);
  }, [showWorkspaceUtilityTab, tabs]);

  const openSideChat = useCallback((initialQuestion = "") => {
    setSideChatInitialQuestion(initialQuestion);
    setSideChatQuestionRevision(revision => revision + 1);
    openWorkspaceUtility("side-chat");
  }, [openWorkspaceUtility]);
  const closeSideChat = useCallback(() => {
    setSideChatOpen(false);
    const current = tabs.find(tab => tab.id === activeTabId);
    if (current?.kind === "side-chat") closeWorkspaceUtilityTab(current.id);
  }, [activeTabId, closeWorkspaceUtilityTab, tabs]);

  const handleWorkbenchTabPreviewOpen = useCallback((tab: WorkspaceUtilityTab, selectedTab: string) => {
    setPreviewOpenId(tab.id);
    previewOpenRef.current = tab.id;
    setBrowserPreviewImage(null);
    const activeBrowserTab = browserOpenTabs.find(item => item.active);
    if (tab.kind === "new" && selectedTab === tab.id && rightPanelSection === "context" && sidebarRight.activeId === null && tab.browserUrl && activeBrowserTab?.url === tab.browserUrl) {
      const request = { tabId: tab.id, requestId: ++browserPreviewSequenceRef.current };
      browserPreviewRequestRef.current = request;
      setBrowserPreviewRequest(request);
    } else {
      browserPreviewRequestRef.current = null;
      setBrowserPreviewRequest(null);
    }
  }, [browserOpenTabs, rightPanelSection, sidebarRight.activeId]);
  const handleWorkbenchTabPreviewClose = useCallback((tabId: string) => {
    if (previewOpenRef.current !== tabId) return;
    previewOpenRef.current = "";
    setPreviewOpenId("");
    browserPreviewRequestRef.current = null;
    setBrowserPreviewRequest(null);
    setBrowserPreviewImage(null);
  }, []);
  const handleChatTabPreviewOpenChange = useCallback((open: boolean) => {
    if (!open) { handleWorkbenchTabPreviewClose("chat"); return; }
    previewOpenRef.current = "chat";
    setPreviewOpenId("chat");
    browserPreviewRequestRef.current = null;
    setBrowserPreviewRequest(null);
    setBrowserPreviewImage(null);
  }, [handleWorkbenchTabPreviewClose]);
  const handleBrowserTabPreviewCapture = useCallback((requestId: number, dataUrl: string | null) => {
    const request = browserPreviewRequestRef.current;
    if (!request || request.requestId !== requestId || previewOpenRef.current !== request.tabId) return;
    setBrowserPreviewImage(dataUrl ? { ...request, dataUrl } : null);
  }, []);

  return {
    sideChatOpen, setSideChatOpen, sideChatInitialQuestion, sideChatQuestionRevision,
    aiWorkView, setAiWorkView,
    tabs, setTabs, activeTab, activeTabId, activeTabKind, setActiveTabId,
    previewOpenId, browserPreviewRequest, browserPreviewImage,
    preferredBrowserProvider, browserAddress, setBrowserAddress, browserAddressError, setBrowserAddressError,
    browserAddressFocused, setBrowserAddressFocused, browserAddressInputRef, browserAddressEditingRef,
    browserOpenTabs, browserRecentSitesForDisplay,
    openWorkspaceUtility, openProjectFile, openBrowserWebsite, openBrowserDockForAgent,
    submitBrowserAddress, openBrowserDockAction, handleBrowserActionRequest, handleBrowserNavigationRequest, handleBrowserOpenTabsChange,
    createWorkspaceUtilityTab, selectWorkbenchTab, selectRightUtilityTab, toggleCenterCollapsed, handleCenterCollapsedChange,
    closeWorkspaceUtilityTab, showWorkspaceUtilityTab, openSessionFiles, openAiHostTask,
    openSideChat,
    closeSideChat,
    handleWorkbenchTabPreviewOpen,
    handleWorkbenchTabPreviewClose,
    handleChatTabPreviewOpenChange,
    handleBrowserTabPreviewCapture,
  };
}
