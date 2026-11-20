// IDE 化右侧工作台主壳：对齐中间栏顶栏的统一 Tab 栏、全高代码/浏览器舞台、可折叠右辅助栏与最右图标轨。
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  IconCheck, IconClock, IconCircleX, IconFileDiff,
  IconLayoutGrid, IconPlus, IconWorld, IconX,
} from "@tabler/icons-react";
import { fetchBrowserState, manageBrowserTab, navigateBrowser, RightBrowserPane, type BrowserSessionSnapshot, type BrowserTabItem } from "@lfaa/browser/client";
import type { WorkbenchContextPanelContribution } from "@lfaa/ui-layout";
import type { ChatClientStore } from "../chat-store";
import type { ChatLocaleMessages } from "../locales";
import { useAuxResize } from "../useAuxResize";
import { patchWorkbenchSessionState, readWorkbenchSessionState } from "../workbench-persist";
import { FileChangePreview } from "./FileChangePreview";
import { FileTypeIcon } from "./file-icons";
import { RightFileTreePane } from "./RightFileTreePane";
import { RightGitReviewPane } from "./RightGitReviewPane";
import { RightSideAskPane } from "./RightSideAskPane";
import { RightSubagentsPane, type RightSubagentItem } from "./RightSubagentsPane";
import { RightTerminalPane, type RightJobItem } from "./RightTerminalPane";
import { RightUtilityRail, type RightAuxTab } from "./RightUtilityRail";
import { RightWorkbenchActions } from "./RightWorkbenchActions";
import { RightWorkbenchStart } from "./Right-Workbench-Start";
import { TurnChanges } from "./Turn-Changes";
import styles from "./RightWorkbenchPane.module.css";

function baseFileName(filePath: string): string {
  const parts = filePath.replace(/\\/gu, "/").split("/");
  return parts[parts.length - 1] || filePath;
}

export function RightWorkbenchPane({
  locale,
  store,
  boundProjectId,
  boundProjectName,
  showFilePreview,
  utilityPanels = [],
  projectContext = null,
  compact = false,
  rightPanelMaximized = false,
  onToggleMaximizeRightPanel,
  onCollapseRightPanel,
  onCloseDrawer,
  onOpenSettings,
  onOpenCodeReview,
  onOpenExtensions,
  onStageWideChange,
}: {
  locale: ChatLocaleMessages;
  store: ChatClientStore;
  boundProjectId: string | null;
  boundProjectName: string | null;
  showFilePreview: boolean;
  utilityPanels?: WorkbenchContextPanelContribution<ReactNode>[] | undefined;
  projectContext?: ReactNode | null | undefined;
  compact?: boolean | undefined;
  rightPanelMaximized?: boolean | undefined;
  onToggleMaximizeRightPanel?: (() => void) | undefined;
  onCollapseRightPanel?: (() => void) | undefined;
  onCloseDrawer?: (() => void) | undefined;
  onOpenSettings: () => void;
  onOpenCodeReview?: (() => void) | undefined;
  onOpenExtensions?: (() => void) | undefined;
  onStageWideChange?: ((wide: boolean) => void) | undefined;
}) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const sessionId = state.activeSession?.id ?? state.activeSessionId ?? "default";
  const persistedInit = readWorkbenchSessionState(sessionId);
  const [browserOpen, setBrowserOpen] = useState(persistedInit.browserOpen);
  const [browserTabs, setBrowserTabs] = useState<BrowserTabItem[]>([]);
  const [browserInitialUrl, setBrowserInitialUrl] = useState<string | undefined>(persistedInit.browserUrl);
  const [browserExternalState, setBrowserExternalState] = useState<{ snap: BrowserSessionSnapshot; nonce: number }>();
  const [reviewTabOpen, setReviewTabOpen] = useState(persistedInit.reviewTabOpen);
  const [reviewMessageId, setReviewMessageId] = useState(persistedInit.reviewMessageId);
  const [selectedJobId, setSelectedJobId] = useState<string>();
  const [selectedSubagentId, setSelectedSubagentId] = useState<string>();
  const [fileTreeOpen, setFileTreeOpen] = useState(false);
  const [auxOpen, setAuxOpen] = useState(false);
  const [activeAux, setActiveAux] = useState<RightAuxTab>(persistedInit.activeAux);
  const [jobs, setJobs] = useState<RightJobItem[]>([]);
  const [subagents, setSubagents] = useState<RightSubagentItem[]>([]);
  const syncedSessionRef = useRef<string | null>(null);
  const splitAreaRef = useRef<HTMLDivElement>(null);
  const { auxWidth, dragging: auxDragging, startResize: startAuxResize, handleKeyResize: handleAuxKeyResize } = useAuxResize(splitAreaRef);

  const fileTabs = showFilePreview ? state.filePreviewTabs : [];
  const activeFileTab = fileTabs.find((tab) => tab.id === state.activeFilePreviewId);
  const selectedStep = activeFileTab?.messageId && activeFileTab?.stepId
    ? state.activeSession?.messages.find((m) => m.id === activeFileTab.messageId)?.steps?.find((s) => s.id === activeFileTab.stepId)
    : undefined;

  const stageKind = auxOpen && !(activeAux === "filesTree" && state.rightStageKind === "file" && activeFileTab)
    ? "utility"
    : state.rightStageKind === "review" && reviewTabOpen
    ? "review"
    : state.rightStageKind === "browser" && browserOpen
      ? "browser"
      : activeFileTab
        ? "file"
        : browserOpen
          ? "browser"
          : reviewTabOpen
            ? "review"
            : "welcome";

  const activeBrowserTab = browserTabs.find((tab) => tab.active);
  const browserIsBlank = activeBrowserTab ? !activeBrowserTab.url || activeBrowserTab.url === "about:blank" : !browserInitialUrl;
  const showStartPage = stageKind === "welcome" || (stageKind === "browser" && browserIsBlank);

  // 只有用户主动打开的文件树可与文件共用舞台。
  const effectiveAuxTab = stageKind === "utility" ? activeAux
    : stageKind === "file" && (fileTreeOpen || (auxOpen && activeAux === "filesTree")) ? "filesTree" : null;

  // 切换会话或刷新挂载时恢复已持久化的右侧栏状态，并拉取宿主机已开启的浏览器标签。
  useEffect(() => {
    const saved = readWorkbenchSessionState(sessionId);
    syncedSessionRef.current = null;
    setBrowserOpen(saved.browserOpen);
    setBrowserInitialUrl(saved.browserUrl);
    setBrowserTabs([]);
    setBrowserExternalState(undefined);
    setReviewTabOpen(saved.reviewTabOpen);
    setReviewMessageId(saved.reviewMessageId);
    setFileTreeOpen(false);
    setAuxOpen(false);
    setActiveAux(saved.activeAux);
    syncedSessionRef.current = sessionId;

    let current = true;
    void fetchBrowserState(sessionId).then((res) => {
      if (!current) return;
      if (res.state.active && res.state.tabs.length > 0) {
        setBrowserTabs(res.state.tabs);
        setBrowserExternalState((prev) => ({ snap: res.state, nonce: (prev?.nonce ?? 0) + 1 }));
        setBrowserOpen(true);
      }
    }).catch(() => {});
    return () => { current = false; };
  }, [sessionId]);

  useEffect(() => {
    if (syncedSessionRef.current !== sessionId) return;
    patchWorkbenchSessionState(sessionId, {
      browserOpen,
      ...(browserInitialUrl ? { browserUrl: browserInitialUrl } : {}),
      reviewTabOpen,
      reviewMessageId,
      fileTreeOpen,
      auxOpen,
      activeAux,
    });
  }, [activeAux, auxOpen, browserInitialUrl, browserOpen, fileTreeOpen, reviewMessageId, reviewTabOpen, sessionId]);

  useEffect(() => {
    onStageWideChange?.(stageKind !== "welcome" || effectiveAuxTab !== null);
  }, [effectiveAuxTab, onStageWideChange, stageKind]);

  // 响应聊天消息打开文件或「浏览器」入口请求。
  useEffect(() => {
    if (!state.rightPanelRequest) return;
    const req = state.rightPanelRequest;
    if (req.tab === "browser") {
      setAuxOpen(false);
      setBrowserOpen(true);
      store.setRightStageKind("browser");
      if (req.url) setBrowserInitialUrl(req.url);
    } else if (req.tab === "review") {
      setAuxOpen(false);
      setReviewMessageId(req.url);
      setReviewTabOpen(true);
      store.setRightStageKind("review");
    } else if (req.tab === "file-preview") {
      setAuxOpen(false);
      setFileTreeOpen(false);
    } else if (req.tab === "files") {
      store.setRightStageKind(null);
      setActiveAux("filesTree");
      setAuxOpen(true);
    } else if (req.tab === "terminal") {
      if (req.url) setSelectedJobId(req.url);
      setActiveAux("terminal");
      setAuxOpen(true);
    } else if (req.tab === "subagents") {
      if (req.url) setSelectedSubagentId(req.url);
      setActiveAux("subagents");
      setAuxOpen(true);
    } else if (req.tab === "sideAsk" || req.tab === "details") {
      setActiveAux(req.tab);
      setAuxOpen(true);
    }
  }, [state.rightPanelRequest, store]);

  useEffect(() => {
    let active = true;
    const loadSummary = async () => {
      try {
        const [jobsRes, subsRes] = await Promise.all([
          fetch(`/api/jobs?sessionId=${encodeURIComponent(sessionId)}`).then((r) => (r.ok ? r.json() : { jobs: [] })),
          fetch(`/api/subagents?sessionId=${encodeURIComponent(sessionId)}`).then((r) => (r.ok ? r.json() : { subagents: [] })),
        ]);
        if (!active) return;
        if (Array.isArray(jobsRes.jobs)) setJobs(jobsRes.jobs);
        if (Array.isArray(subsRes.subagents)) setSubagents(subsRes.subagents);
      } catch {
        // 忽略后台概览轮询偶发失败
      }
    };
    void loadSummary();
    const timer = setInterval(() => void loadSummary(), 2500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [sessionId]);

  const handleBrowserSnapshot = useCallback((snap: BrowserSessionSnapshot) => {
    setBrowserTabs(snap.tabs ?? []);
    if (snap.url && snap.url !== "about:blank") {
      setBrowserInitialUrl(snap.url);
      patchWorkbenchSessionState(sessionId, { browserOpen: true, browserUrl: snap.url });
    }
  }, [sessionId]);

  const handleOpenNewBrowserTab = () => {
    setAuxOpen(false);
    const wasOpen = browserOpen;
    setBrowserOpen(true);
    store.setRightStageKind("browser");
    if (!wasOpen && browserTabs.length === 0) return;
    void manageBrowserTab(sessionId, { action: "new" })
      .then((r) => {
        setBrowserTabs(r.state.tabs ?? []);
        setBrowserExternalState((prev) => ({ snap: r.state, nonce: (prev?.nonce ?? 0) + 1 }));
      })
      .catch(() => {});
  };

  const handleCloseBrowserTab = (tabId?: string) => {
    if (!tabId || browserTabs.length <= 1) {
      setBrowserOpen(false);
      setBrowserTabs([]);
      setBrowserInitialUrl(undefined);
      setBrowserExternalState(undefined);
      patchWorkbenchSessionState(sessionId, { browserOpen: false, browserUrl: "" });
      store.setRightStageKind(activeFileTab ? "file" : null);
      return;
    }
    void manageBrowserTab(sessionId, { action: "close", tabId })
      .then((r) => {
        setBrowserTabs(r.state.tabs ?? []);
        setBrowserExternalState((prev) => ({ snap: r.state, nonce: (prev?.nonce ?? 0) + 1 }));
      })
      .catch(() => {});
  };

  const handleToggleAux = (tab: RightAuxTab) => {
    if (tab === "filesTree" && stageKind === "file") {
      setFileTreeOpen(effectiveAuxTab !== "filesTree");
      setAuxOpen(false);
      return;
    }
    if (auxOpen && activeAux === tab) {
      setAuxOpen(false);
    } else {
      if (tab === "filesTree") store.setRightStageKind(null);
      setActiveAux(tab);
      setAuxOpen(true);
    }
  };

  const handleOpenUrl = async (url: string) => {
    const { state: snap } = await navigateBrowser(sessionId, url);
    if (syncedSessionRef.current !== sessionId) return;
    setBrowserInitialUrl(undefined);
    setBrowserTabs(snap.tabs);
    setBrowserExternalState((prev) => ({ snap, nonce: (prev?.nonce ?? 0) + 1 }));
    setBrowserOpen(true);
    patchWorkbenchSessionState(sessionId, { browserOpen: true, browserUrl: snap.url });
    store.setRightStageKind("browser");
  };

  const openAux = (tab: RightAuxTab) => {
    if (tab === "filesTree") store.setRightStageKind(null);
    setActiveAux(tab);
    setAuxOpen(true);
  };

  const openReview = () => {
    setAuxOpen(false);
    setFileTreeOpen(false);
    setReviewMessageId(undefined);
    setReviewTabOpen(true);
    store.setRightStageKind("review");
  };

  const activeProfile = state.profiles.find((p) => p.id === state.activeProfileId) ?? state.profiles[0];
  const activeRulesCount = state.rules.filter((r) => r.content.trim().length > 0).length;
  const runningJobsCount = jobs.filter((j) => j.status === "running").length;
  const runningSubsCount = subagents.filter((s) => s.status === "running").length;

  const auxTitles: Record<RightAuxTab, string> = {
    filesTree: locale.isZh ? "工作区文件" : "Workspace Files",
    workspaceContext: locale.isZh ? "工作区上下文" : "Workspace Context",
    terminal: locale.isZh ? "终端与后台任务" : "Terminal & Tasks",
    subagents: locale.isZh ? "子智能体团队" : "Subagents",
    sideAsk: locale.isZh ? "侧边提问" : "Side Ask",
    details: locale.isZh ? "工作详情" : "Work Details",
  };

  const renderBrowserHeaderTabs = () => {
    if (!browserOpen) return null;
    if (browserTabs.length === 0) {
      return (
        <div className={`${styles.tabItem} ${stageKind === "browser" ? styles.tabItemActive : ""}`}>
          <button
            type="button"
            role="tab"
            aria-selected={stageKind === "browser"}
            className={styles.tabBtn}
            onClick={() => { setAuxOpen(false); store.setRightStageKind("browser"); }}
          >
            <IconWorld size={13} aria-hidden="true" />
            <span>{browserIsBlank ? (locale.isZh ? "新标签页" : "New tab") : (locale.isZh ? "内置浏览器" : "Browser")}</span>
          </button>
          <button type="button" className={styles.tabClose} aria-label={locale.isZh ? "关闭浏览器标签" : "Close browser tab"} onClick={() => handleCloseBrowserTab()}>
            <IconX size={11} />
          </button>
        </div>
      );
    }
    return browserTabs.map((bTab) => {
      const active = stageKind === "browser" && bTab.active;
      const tabLabel = bTab.title && bTab.title !== "about:blank"
        ? bTab.title
        : (bTab.url && bTab.url !== "about:blank" ? bTab.url : (locale.isZh ? "新标签页" : "New Tab"));
      return (
        <div key={bTab.tabId} className={`${styles.tabItem} ${active ? styles.tabItemActive : ""}`}>
          <button
            type="button"
            role="tab"
            aria-selected={active}
            className={styles.tabBtn}
            title={bTab.url && bTab.url !== "about:blank" ? bTab.url : tabLabel}
            onClick={() => {
              setAuxOpen(false);
              store.setRightStageKind("browser");
              if (!bTab.active) {
                void manageBrowserTab(sessionId, { action: "activate", tabId: bTab.tabId })
                  .then((r) => {
                    setBrowserTabs(r.state.tabs ?? []);
                    setBrowserExternalState((prev) => ({ snap: r.state, nonce: (prev?.nonce ?? 0) + 1 }));
                  })
                  .catch(() => {});
              }
            }}
          >
            <IconWorld size={13} aria-hidden="true" />
            <span>{tabLabel}</span>
          </button>
          <button
            type="button"
            className={styles.tabClose}
            aria-label={locale.isZh ? "关闭浏览器标签" : "Close browser tab"}
            onClick={() => handleCloseBrowserTab(bTab.tabId)}
          >
            <IconX size={11} />
          </button>
        </div>
      );
    });
  };

  const renderAuxBody = (tab: RightAuxTab) => {
    if (tab === "filesTree") {
      return (
        <RightFileTreePane
          projectId={boundProjectId}
          projectName={boundProjectName}
          activeFilePath={stageKind === "file" ? activeFileTab?.path : undefined}
          isZh={locale.isZh}
          store={store}
        />
      );
    }
    if (tab === "workspaceContext") {
      return (
        <div className={styles.auxScroll}>
          {projectContext}
          {utilityPanels.map((p) => (
            <section key={p.id} className={styles.auxCard}>
              <h4 className={styles.auxCardTitle}>{p.title}</h4>
              <div className={styles.auxCardBody}>{p.render()}</div>
            </section>
          ))}
        </div>
      );
    }
    if (tab === "terminal") return <div className={styles.auxPad}><RightTerminalPane sessionId={sessionId} isZh={locale.isZh} selectedJobId={selectedJobId} /></div>;
    if (tab === "subagents") return <div className={styles.auxPad}><RightSubagentsPane sessionId={sessionId} isZh={locale.isZh} selectedSubagentId={selectedSubagentId} /></div>;
    if (tab === "sideAsk") {
      return (
        <div className={styles.auxPad}>
          <RightSideAskPane
            isZh={locale.isZh}
            profileId={state.activeProfileId || undefined}
            contextHint={boundProjectName ? `当前绑定项目：${boundProjectName}` : ""}
          />
        </div>
      );
    }
    return (
      <div className={styles.auxScroll}>
        <div className={styles.auxCard}>
          <div className={styles.detailRow}><span>{locale.brainLabel}</span><strong>{activeProfile ? `${activeProfile.name} (${activeProfile.model})` : "-"}</strong></div>
          <div className={styles.detailRow}><span>{locale.toolsLabel}</span><strong>{boundProjectName || locale.toolsUnbound}</strong></div>
          <div className={styles.detailRow}><span>{locale.memoryLabel}</span><strong>{`${state.memories.length} ${locale.memoryCountSuffix}`}</strong></div>
          <div className={styles.detailRow}><span>{locale.rulesLabel}</span><strong>{`${activeRulesCount} ${locale.rulesLayersCountSuffix}`}</strong></div>
        </div>
        <button type="button" className={styles.auxActionBtn} onClick={onOpenSettings}>{locale.openAgentSettings}</button>
      </div>
    );
  };

  return (
    <div className={styles.workbench}>
      <header className={styles.topHeader}>
        <div className={styles.tabBar} role="tablist" aria-label={locale.isZh ? "右侧打开标签" : "Right workbench tabs"}>
          {(stageKind === "welcome" || stageKind === "utility") && (
            <div className={`${styles.tabItem} ${styles.tabItemActive}`}>
              <span className={styles.tabBtn} role="tab" aria-selected="true">
                <IconLayoutGrid size={14} aria-hidden="true" />
                <span>{stageKind === "utility" ? auxTitles[activeAux] : locale.isZh ? "工作台" : "Workbench"}</span>
              </span>
            </div>
          )}
          {fileTabs.map((tab) => {
            const active = stageKind === "file" && tab.id === activeFileTab?.id;
            const fileName = baseFileName(tab.path);
            return (
              <div key={tab.id} className={`${styles.tabItem} ${active ? styles.tabItemActive : ""}`}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={styles.tabBtn}
                  title={tab.path}
                  onClick={() => { setAuxOpen(false); setFileTreeOpen(false); store.selectFilePreview(tab.id); }}
                >
                  <FileTypeIcon name={fileName} kind="file" />
                  <span>{fileName}</span>
                </button>
                <button
                  type="button"
                  className={styles.tabClose}
                  aria-label={locale.isZh ? `关闭 ${baseFileName(tab.path)}` : `Close ${baseFileName(tab.path)}`}
                  onClick={() => store.closeFilePreview(tab.id)}
                >
                  <IconX size={11} />
                </button>
              </div>
            );
          })}
          {renderBrowserHeaderTabs()}
          {reviewTabOpen && (
            <div className={`${styles.tabItem} ${stageKind === "review" ? styles.tabItemActive : ""}`}>
              <button
                type="button"
                role="tab"
                aria-selected={stageKind === "review"}
                className={styles.tabBtn}
                onClick={() => { setAuxOpen(false); store.setRightStageKind("review"); }}
              >
                <IconFileDiff size={13} aria-hidden="true" />
                <span>{reviewMessageId ? (locale.isZh ? "本轮变更" : "Turn changes") : (locale.isZh ? "工作区变更" : "Workspace changes")}</span>
              </button>
              <button
                type="button"
                className={styles.tabClose}
                aria-label={locale.isZh ? "关闭审查标签" : "Close review tab"}
                onClick={() => {
                  setReviewTabOpen(false);
                  if (state.rightStageKind === "review") {
                    store.setRightStageKind(activeFileTab ? "file" : browserOpen ? "browser" : null);
                  }
                }}
              >
                <IconX size={11} />
              </button>
            </div>
          )}
          <button
            type="button"
            className={styles.addTabBtn}
            title={locale.isZh ? "新建浏览器标签页" : "New browser tab"}
            aria-label={locale.isZh ? "新建浏览器标签页" : "New browser tab"}
            onClick={handleOpenNewBrowserTab}
          >
            <IconPlus size={16} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.topActions}>
          <RightWorkbenchActions
            variant={compact || rightPanelMaximized ? "full" : "workbenchOnly"}
            isZh={locale.isZh}
            store={store}
            projectId={boundProjectId}
            projectName={boundProjectName ?? undefined}
            jobs={jobs}
            subagents={subagents}
            compact={compact}
            rightPanelMaximized={rightPanelMaximized}
            onOpenReviewTab={openReview}
            onOpenFileTree={() => openAux("filesTree")}
            onOpenTerminal={(jobId) => {
              setSelectedJobId(jobId);
              setActiveAux("terminal");
              setAuxOpen(true);
            }}
            onOpenSubagents={(subId) => {
              setSelectedSubagentId(subId);
              setActiveAux("subagents");
              setAuxOpen(true);
            }}
            onNewBrowserTab={handleOpenNewBrowserTab}
            onOpenExtensions={onOpenExtensions}
            onToggleMaximize={onToggleMaximizeRightPanel}
            onCollapsePanel={() => {
              if (compact && onCloseDrawer) {
                onCloseDrawer();
                return;
              }
              onCollapseRightPanel?.();
            }}
          />
        </div>
      </header>

      <div ref={splitAreaRef} className={styles.bodySplit}>
        {(() => {
          if (stageKind === "utility") return (
            <div className={styles.mainStage}>
              <div className={styles.auxHeader}>
                <span>{auxTitles[activeAux]}</span>
                <button type="button" className={styles.tabClose} aria-label={locale.isZh ? "关闭面板" : "Close pane"} onClick={() => setAuxOpen(false)}>
                  <IconX size={12} />
                </button>
              </div>
              <div className={styles.auxContent}>{renderAuxBody(activeAux)}</div>
            </div>
          );
          const hideAuxHeader = stageKind === "file" && effectiveAuxTab === "filesTree";
          const auxPaneNode = effectiveAuxTab ? (
            <>
              {!compact && (
                <div
                  role="separator"
                  tabIndex={0}
                  aria-orientation="vertical"
                  aria-label={locale.isZh ? "调整工作区文件树与辅助栏宽度" : "Resize utility sidebar"}
                  className={`${styles.auxResizer} ${auxDragging ? styles.auxResizerActive : ""}`}
                  onPointerDown={startAuxResize}
                  onKeyDown={(e) => handleAuxKeyResize(e.key)}
                />
              )}
              <aside
                className={styles.auxDrawer}
                style={!compact ? { flexBasis: `${auxWidth}px` } : undefined}
                aria-label={auxTitles[effectiveAuxTab]}
              >
                {!hideAuxHeader && (
                  <div className={styles.auxHeader}>
                    <span>{auxTitles[effectiveAuxTab]}</span>
                    <button type="button" className={styles.tabClose} aria-label="Close pane" onClick={() => setAuxOpen(false)}>
                      <IconX size={12} />
                    </button>
                  </div>
                )}
                <div className={styles.auxContent}>{renderAuxBody(effectiveAuxTab)}</div>
              </aside>
            </>
          ) : null;

          if (stageKind === "file" && activeFileTab) {
            return (
              <div className={styles.mainStage}>
                <FileChangePreview
                  step={selectedStep}
                  tab={activeFileTab}
                  sessionId={sessionId}
                  projectId={boundProjectId}
                  boundProjectName={boundProjectName}
                  sidebarOpen={effectiveAuxTab === "filesTree"}
                  auxPane={auxPaneNode}
                  isZh={locale.isZh}
                  store={store}
                  onToggleSidebar={() => { setAuxOpen(false); setFileTreeOpen(effectiveAuxTab !== "filesTree"); }}
                />
              </div>
            );
          }

          return (
            <>
              <div className={styles.mainStage}>
                {stageKind === "review" && (reviewMessageId ? (
                  <TurnChanges key={reviewMessageId} isZh={locale.isZh}
                    message={state.activeSession?.messages.find((message) => message.id === reviewMessageId)}
                    onOpenWorkspace={openReview} />
                ) : (
                  <RightGitReviewPane
                    key={boundProjectId}
                    isZh={locale.isZh}
                    projectId={boundProjectId}
                    store={store}
                    onOpenFullCodeReview={onOpenCodeReview}
                  />
                ))}
                {stageKind === "browser" && (
                  // 空白时浏览器仍订阅宿主机状态，小鱼打开页面后可直接切回实时视口。
                  <div className={styles.browserView} data-covered={showStartPage || undefined} inert={showStartPage}>
                    <RightBrowserPane
                      sessionId={sessionId}
                      isZh={locale.isZh}
                      initialUrl={browserInitialUrl}
                      hideTabStrip={true}
                      externalState={browserExternalState}
                      onSnapshotChange={handleBrowserSnapshot}
                      onAttachPage={(snap) => {
                        store.enqueueComposerInsert(`当前内置浏览器页面：${snap.title || "未命名"} (${snap.url})，控制台异常数：${snap.errorCount}`);
                      }}
                    />
                  </div>
                )}
                {showStartPage && (
                  <RightWorkbenchStart
                    key={`${sessionId}:${boundProjectId ?? ""}:${activeBrowserTab?.tabId ?? stageKind}`}
                    isZh={locale.isZh}
                    store={store}
                    projectId={boundProjectId}
                    projectName={boundProjectName}
                    onOpenUrl={handleOpenUrl}
                    onOpenTerminal={() => openAux("terminal")}
                    onOpenReview={openReview}
                    onOpenFiles={() => openAux("filesTree")}
                    onOpenSideAsk={() => openAux("sideAsk")}
                  >
                    {(jobs.length > 0 || subagents.length > 0) && (
                      <div className={styles.welcomeStatusList}>
                        {subagents.slice(0, 3).map((sub) => (
                          <button key={sub.id} type="button" className={styles.statusRow} onClick={() => { setSelectedSubagentId(sub.id); openAux("subagents"); }}>
                            {sub.status === "running" ? <IconClock size={13} /> : sub.status === "done" ? <IconCheck size={13} /> : <IconCircleX size={13} />}
                            <span>{sub.role}</span>
                          </button>
                        ))}
                        {jobs.slice(0, 3).map((job) => (
                          <button key={job.id} type="button" className={styles.statusRow} onClick={() => { setSelectedJobId(job.id); openAux("terminal"); }}>
                            {job.status === "running" ? <IconClock size={13} /> : job.status === "done" ? <IconCheck size={13} /> : <IconCircleX size={13} />}
                            <span>{job.title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </RightWorkbenchStart>
                )}
              </div>
              {auxPaneNode}
            </>
          );
        })()}

        <RightUtilityRail
          isZh={locale.isZh}
          activeAux={effectiveAuxTab ?? activeAux}
          auxOpen={effectiveAuxTab !== null}
          runningJobsCount={runningJobsCount}
          runningSubagentsCount={runningSubsCount}
          onToggleAux={handleToggleAux}
          onOpenCodeReview={onOpenCodeReview}
          onOpenExtensions={onOpenExtensions}
          onOpenSettings={onOpenSettings}
        />
      </div>
    </div>
  );
}
