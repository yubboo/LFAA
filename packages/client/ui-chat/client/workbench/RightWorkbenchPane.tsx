// IDE 化右侧工作台主壳：承接右侧栏状态持久化与请求，装配顶部标签、主体舞台与最右图标轨。
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { WorkbenchContextPanelContribution } from "@lfaa/ui-layout";
import type { ChatClientStore } from "../store/chat-store";
import { useChatSelector } from "../store/use-chat-selector";
import type { ChatLocaleMessages } from "../locales";
import { isBrowserAutomationStep } from "../shared/agent-workbench-sync";
import { useAuxResize } from "./useAuxResize";
import { patchWorkbenchSessionState, readWorkbenchSessionState } from "../store/workbench-persist";
import { RightUtilityRail, type RightAuxTab } from "./RightUtilityRail";
import { RightWorkbenchActions } from "./RightWorkbenchActions";
import { WorkbenchAuxBody } from "./WorkbenchAuxBody";
import { WorkbenchAuxPane } from "./WorkbenchAuxPane";
import { WorkbenchStageContent } from "./WorkbenchStageContent";
import { useWorkbenchBrowser } from "./useWorkbenchBrowser";
import { useWorkbenchRequests } from "./useWorkbenchRequests";
import { useWorkbenchSubagents } from "./useWorkbenchSubagents";
import { WorkbenchTabs } from "./WorkbenchTabs";
import { useWorkbenchSummary } from "./useWorkbenchSummary";
import { useWorkbenchTabClose } from "./useWorkbenchTabClose";
import { useWorkbenchAuxTabs } from "./useWorkbenchAuxTabs";
import { useWorkbenchBlankTab } from "./useWorkbenchBlankTab";
import { useWorkbenchOpeners } from "./useWorkbenchOpeners";
import { workbenchAuxTitles } from "./workbench-titles";
import styles from "./RightWorkbenchPane.module.css";

export function RightWorkbenchPane({
  locale,
  store,
  boundProjectId,
  boundProjectName,
  boundWorktreeId,
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
  /** 当前会话绑定的工作树 id；缺省按项目根展示文件。 */
  boundWorktreeId?: string | undefined;
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
  // 首次挂载懒读取持久化右栏状态，避免在后续流式更新中重复同步读取 localStorage。
  const [initialSaved] = useState(() => {
    const snap = store.getSnapshot();
    return readWorkbenchSessionState(snap.activeSession?.id ?? snap.activeSessionId ?? "default");
  });
  const [reviewTabOpen, setReviewTabOpen] = useState(initialSaved.reviewTabOpen);
  const [reviewMessageId, setReviewMessageId] = useState(initialSaved.reviewMessageId);
  const [selectedJobId, setSelectedJobId] = useState<string>();
  const [selectedSubagentId, setSelectedSubagentId] = useState<string>();
  const [fileTreeOpen, setFileTreeOpen] = useState(false);
  const { tabs: auxTabs, active: activeAuxTab, openAuxTab, closeAuxTab, toggleAuxTab, hideAuxTab, restoreAuxTab } = useWorkbenchAuxTabs();
  const auxOpen = auxTabs.length > 0;
  const [devtoolsRequest, setDevtoolsRequest] = useState<{ tab: "console" | "network"; nonce: number }>();
  // 精确订阅右栏所需切片：流式正文与思考增量不会触发右栏重渲染与重复读盘。
  const state = useChatSelector(store, (snap) => {
    const activeTab = showFilePreview ? snap.filePreviewTabs.find((tab) => tab.id === snap.activeFilePreviewId) : undefined;
    const msgs = snap.activeSession?.messages;
    const browserStep = snap.runningRunId && msgs?.at(-1)?.steps?.find((step) =>
      step.status === "running" && isBrowserAutomationStep(step));
    const browserAction = browserStep ? browserStep.subagent?.steps?.find((step) => step.status === "running") : undefined;
    const selectedStep = activeTab?.messageId && activeTab?.stepId
      ? msgs?.find((m) => m.id === activeTab.messageId)?.steps?.find((s) => s.id === activeTab.stepId)
      : undefined;
    return {
      sessionId: snap.activeSession?.id ?? snap.activeSessionId ?? "default",
      agentRunning: Boolean(snap.runningRunId),
      browserAutomationActive: Boolean(browserStep),
      browserActivity: browserAction?.label
        ? [browserAction.label, browserAction.target].filter(Boolean).join(" · ")
        : browserStep
          ? (browserStep.subagent?.liveAction?.trim() || "深度思考…")
          : undefined,
      filePreviewTabs: snap.filePreviewTabs,
      activeFilePreviewId: snap.activeFilePreviewId,
      rightStageKind: snap.rightStageKind,
      rightPanelRequest: snap.rightPanelRequest,
      profiles: snap.profiles,
      activeProfileId: snap.activeProfileId,
      rules: snap.rules,
      memoriesCount: snap.memories.length,
      selectedStep,
      reviewMessage: reviewMessageId ? msgs?.find((m) => m.id === reviewMessageId) : undefined,
    };
  });
  const sessionId = state.sessionId;
  const [hydratedSessionId, setHydratedSessionId] = useState(sessionId);
  const { jobs, subagents } = useWorkbenchSummary(
    sessionId,
    state.agentRunning || (activeAuxTab === "terminal" || activeAuxTab === "subagents"),
  );
  const syncedSessionRef = useRef<string | null>(null);
  const splitAreaRef = useRef<HTMLDivElement>(null);
  const { auxWidth, dragging: auxDragging, startResize: startAuxResize, handleKeyResize: handleAuxKeyResize } = useAuxResize(splitAreaRef);

  const fileTabs = showFilePreview ? state.filePreviewTabs : [];
  const activeFileTab = fileTabs.find((tab) => tab.id === state.activeFilePreviewId);
  const selectedStep = state.selectedStep;
  const {
    browserOpen, browserTabs, browserInitialUrl, browserExternalState,
    setBrowserOpen, setBrowserInitialUrl, handleBrowserSnapshot,
    handleOpenNewBrowserTab, handleActivateBrowserTab, handleCloseBrowserTab, handleOpenUrl, restoreBrowser, syncHostBrowser,
  } = useWorkbenchBrowser({ sessionId, store, activeFileTab, syncedSessionRef, initialOpen: initialSaved.browserOpen });
  const {
    subagentTabs, activeSubagentTabId, openSubagentTab, selectSubagentTab, closeSubagentTab,
  } = useWorkbenchSubagents({ sessionId, store, subagents });
  const activeSubagentTab = subagentTabs.find((tab) => tab.id === activeSubagentTabId);

  const stageKind = activeAuxTab && !(activeAuxTab === "filesTree" && state.rightStageKind === "file" && activeFileTab) ? "utility"
    : state.rightStageKind === "subagent" && activeSubagentTab ? "subagent"
      : state.rightStageKind === "review" && reviewTabOpen ? "review"
        : state.rightStageKind === "browser" && browserOpen ? "browser"
          : activeFileTab ? "file"
            : activeSubagentTab ? "subagent"
              : browserOpen ? "browser"
                : reviewTabOpen ? "review" : "welcome";

  const activeBrowserTab = browserTabs.find((tab) => tab.active);
  const browserIsBlank = activeBrowserTab ? !activeBrowserTab.url || activeBrowserTab.url === "about:blank" : !browserInitialUrl;
  const showStartPage = stageKind === "welcome" || (stageKind === "browser" && browserIsBlank);

  // 只有用户主动打开的文件树可与文件共用舞台。
  const effectiveAuxTab = stageKind === "utility" ? activeAuxTab
    : stageKind === "file" && (fileTreeOpen || (auxOpen && activeAuxTab === "filesTree")) ? "filesTree" : null;

  // 切换会话或刷新挂载时恢复已持久化的右侧栏状态，并拉取宿主机已开启的浏览器标签。
  useEffect(() => {
    const saved = readWorkbenchSessionState(sessionId);
    syncedSessionRef.current = null;
    const cancelBrowserRestore = restoreBrowser(sessionId, saved.browserOpen, saved.browserUrl);
    setReviewTabOpen(saved.reviewTabOpen);
    setReviewMessageId(saved.reviewMessageId);
    setFileTreeOpen(false);
    restoreAuxTab(saved.auxOpen, saved.activeAux);
    syncedSessionRef.current = sessionId;
    setHydratedSessionId(sessionId);
    return cancelBrowserRestore;
  }, [restoreBrowser, sessionId]);

  useEffect(() => {
    // 只有当前会话状态已真正恢复并提交渲染后才写回 localStorage，避免把旧会话状态写进新会话。
    if (hydratedSessionId !== sessionId || syncedSessionRef.current !== sessionId) return;
    patchWorkbenchSessionState(sessionId, {
      browserOpen,
      ...(browserInitialUrl ? { browserUrl: browserInitialUrl } : {}),
      reviewTabOpen,
      reviewMessageId,
      fileTreeOpen,
      auxOpen,
      activeAux: activeAuxTab ?? auxTabs[0] ?? initialSaved.activeAux,
    });
  }, [activeAuxTab, auxOpen, auxTabs, browserInitialUrl, browserOpen, fileTreeOpen, hydratedSessionId, reviewMessageId, reviewTabOpen, sessionId]);

  useEffect(() => {
    onStageWideChange?.(stageKind !== "welcome" || effectiveAuxTab !== null);
  }, [effectiveAuxTab, onStageWideChange, stageKind]);

  useWorkbenchRequests({
    request: state.rightPanelRequest,
    sessionId,
    stageKind,
    store,
    syncHostBrowser,
    setAuxOpen: (open: boolean) => { if (!open) hideAuxTab(); },
    setActiveAux: openAuxTab,
    setBrowserOpen,
    setBrowserInitialUrl,
    setDevtoolsRequest,
    setReviewMessageId,
    setReviewTabOpen,
    setFileTreeOpen,
    setSelectedJobId,
    setSelectedSubagentId,
    openSubagentTab,
  });

  const blankTabActive = stageKind === "browser" && browserIsBlank;
  const openNewBrowserTab = () => { hideAuxTab(); if (!blankTabActive) handleOpenNewBrowserTab(); };

  // 当前是空白标签时，点击终端/变更/文件等直接把它变成对应标签，而不是再开一个。
  const dismissBlankTab = () => { if (blankTabActive) handleCloseBrowserTab(); };

  // 面板展开但一个标签都没有时，自动补一个「新标签页」。
  useWorkbenchBlankTab({
    shouldBootstrap: hydratedSessionId === sessionId && !browserOpen && auxTabs.length === 0 && fileTabs.length === 0 && !reviewTabOpen && subagentTabs.length === 0,
    bootstrap: handleOpenNewBrowserTab,
  });

  const { handleToggleAux, openAux, openReview } = useWorkbenchOpeners({
    store, stageKind, effectiveAuxTab, setFileTreeOpen, hideAuxTab, toggleAuxTab, openAuxTab, dismissBlankTab,
    setReviewMessageId, setReviewTabOpen,
  });

  const activeProfile = state.profiles.find((p) => p.id === state.activeProfileId) ?? state.profiles[0];
  const activeRulesCount = state.rules.filter((r) => r.content.trim().length > 0).length;
  const runningJobsCount = jobs.filter((j) => j.status === "running").length;
  const runningSubsCount = subagents.filter((s) => s.status === "running").length;

  const auxTitles = workbenchAuxTitles(locale.isZh);

  const renderAuxBody = (tab: RightAuxTab) => (
    <WorkbenchAuxBody
      tab={tab}
      locale={locale}
      store={store}
      sessionId={sessionId}
      boundProjectId={boundProjectId}
      boundProjectName={boundProjectName}
      boundWorktreeId={boundWorktreeId}
      activeFilePath={stageKind === "file" ? activeFileTab?.path : undefined}
      projectContext={projectContext}
      utilityPanels={utilityPanels}
      activeProfileName={activeProfile ? `${activeProfile.name} (${activeProfile.model})` : "-"}
      activeProfileId={state.activeProfileId || undefined}
      memoriesCount={state.memoriesCount}
      activeRulesCount={activeRulesCount}
      selectedJobId={selectedJobId}
      selectedSubagentId={selectedSubagentId}
      onOpenSettings={onOpenSettings}
    />
  );

  const auxPane = effectiveAuxTab ? (
    <WorkbenchAuxPane
      locale={locale}
      title={auxTitles[effectiveAuxTab]}
      compact={compact}
      width={auxWidth}
      dragging={auxDragging}
      hideHeader={stageKind === "file" && effectiveAuxTab === "filesTree"}
      body={renderAuxBody(effectiveAuxTab)}
      onResizeStart={startAuxResize}
      onKeyResize={handleAuxKeyResize}
      onClose={() => { if (activeAuxTab) closeAuxTabAndMaybeCollapse(activeAuxTab); }}
    />
  ) : null;

  // 关闭标签后，若右栏已没有任何内容标签则整体收起。
  const { closeBrowserTab, closeFileTab, closeReviewTab, closeAuxTab: closeAuxTabAndMaybeCollapse } = useWorkbenchTabClose({
    browserTabs: browserTabs.length, fileTabs: fileTabs.length, browserOpen, activeFileTab: Boolean(activeFileTab),
    reviewTabOpen, subagentTabs: subagentTabs.length, auxTabs: auxTabs.length,
    closeBrowserTab: (tabId) => handleCloseBrowserTab(tabId),
    closeFileTab: (tabId) => store.closeFilePreview(tabId),
    closeReviewTab: () => { setReviewTabOpen(false); if (state.rightStageKind === "review") store.setRightStageKind(activeFileTab ? "file" : browserOpen ? "browser" : null); },
    closeAuxTab,
    collapse: onCollapseRightPanel,
  });

  return (
    <div className={styles.workbench}>
      <header className={styles.topHeader}>
        <WorkbenchTabs
          isZh={locale.isZh}
          stageKind={stageKind}
          auxTabs={auxTabs.map((id) => ({ id, title: auxTitles[id] }))}
          activeAuxTab={activeAuxTab}
          onSelectAuxTab={(tab) => { setFileTreeOpen(false); openAuxTab(tab); }}
          onCloseAuxTab={closeAuxTabAndMaybeCollapse}
          fileTabs={fileTabs}
          activeFileTab={activeFileTab}
          browserOpen={browserOpen}
          browserTabs={browserTabs}
          browserIsBlank={browserIsBlank}
          reviewTabOpen={reviewTabOpen}
          reviewMessageId={reviewMessageId}
          subagentTabs={subagentTabs}
          activeSubagentTabId={activeSubagentTabId}
          onSelectFile={(tabId) => { hideAuxTab(); setFileTreeOpen(false); store.selectFilePreview(tabId); }}
          onCloseFile={closeFileTab}
          onSelectBrowser={() => { hideAuxTab(); store.setRightStageKind("browser"); }}
          onCloseBrowser={() => closeBrowserTab()}
          onActivateBrowserTab={(bTab) => {
            hideAuxTab();
            store.setRightStageKind("browser");
            if (!bTab.active) handleActivateBrowserTab(bTab.tabId);
          }}
          onCloseBrowserTab={closeBrowserTab}
          onSelectReview={() => { hideAuxTab(); store.setRightStageKind("review"); }}
          onCloseReview={closeReviewTab}
          onSelectSubagentTab={(subId) => { hideAuxTab(); selectSubagentTab(subId); }}
          onCloseSubagentTab={(subId) => closeSubagentTab(subId, () => (activeFileTab ? "file" : browserOpen ? "browser" : reviewTabOpen ? "review" : null))}
          onNewBrowserTab={openNewBrowserTab}
        />

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
            onOpenTerminal={(jobId) => { setSelectedJobId(jobId); openAux("terminal"); }}
            onOpenSubagents={(subId) => {
              if (subId) { hideAuxTab(); openSubagentTab(subId); }
              else { openAux("subagents"); }
            }}
            onNewBrowserTab={openNewBrowserTab}
            onOpenExtensions={onOpenExtensions}
            onToggleMaximize={onToggleMaximizeRightPanel}
            onCollapsePanel={() => {
              if (compact && onCloseDrawer) { onCloseDrawer(); return; }
              onCollapseRightPanel?.();
            }}
          />
        </div>
      </header>

      <div ref={splitAreaRef} className={styles.bodySplit}>
        <WorkbenchStageContent
          locale={locale}
          store={store}
          sessionId={sessionId}
          boundProjectId={boundProjectId}
          boundProjectName={boundProjectName}
          boundWorktreeId={boundWorktreeId}
          stageKind={stageKind}
          activeAux={activeAuxTab ?? "terminal"}
          auxTitle={auxTitles[activeAuxTab ?? "terminal"]}
          activeFileTab={activeFileTab}
          activeSubagentTab={activeSubagentTab}
          selectedStep={selectedStep}
          effectiveAuxTab={effectiveAuxTab}
          reviewMessage={state.reviewMessage}
          reviewMessageId={reviewMessageId}
          browserInitialUrl={browserInitialUrl}
          browserExternalState={browserExternalState}
          agentRunning={state.agentRunning}
          browserAutomationActive={state.browserAutomationActive}
          browserActivity={state.browserActivity}
          devtoolsRequest={devtoolsRequest}
          showStartPage={showStartPage}
          activeBrowserTabId={activeBrowserTab?.tabId}
          jobs={jobs}
          subagents={subagents}
          auxPane={auxPane}
          renderAuxBody={renderAuxBody}
          onCloseAux={() => hideAuxTab()}
          onToggleFileSidebar={() => { hideAuxTab(); setFileTreeOpen(effectiveAuxTab !== "filesTree"); }}
          onOpenUrl={handleOpenUrl}
          onOpenTerminal={() => openAux("terminal")}
          onOpenReview={openReview}
          onOpenFiles={() => openAux("filesTree")}
          onOpenSideAsk={() => openAux("sideAsk")}
          onSnapshotChange={handleBrowserSnapshot}
          onAttachPage={(snap) => {
            store.enqueueComposerInsert(`当前内置浏览器页面：${snap.title || "未命名"} (${snap.url})，控制台异常数：${snap.errorCount}`);
          }}
          onOpenCodeReview={onOpenCodeReview}
          onSelectSubagent={(subId) => { hideAuxTab(); openSubagentTab(subId); }}
          onSelectJob={(jobId) => { setSelectedJobId(jobId); openAux("terminal"); }}
        />

        <RightUtilityRail
          isZh={locale.isZh}
          activeAux={effectiveAuxTab ?? activeAuxTab ?? "terminal"}
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
