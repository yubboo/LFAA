// IDE 化右侧工作台主壳：承接右侧栏状态持久化与请求，装配顶部标签、主体舞台与最右图标轨。
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { WorkbenchContextPanelContribution } from "@lfaa/ui-layout";
import type { WorkbenchClientService } from "@lfaa/ui-layout/client";
import type { ChatClientStore } from "../store/chat-store";
import { useChatSelector } from "../store/use-chat-selector";
import type { ChatLocaleMessages } from "../locales";
import { isBrowserAutomationStep } from "../shared/agent-workbench-sync";
import { useAuxResize } from "./useAuxResize";
import { readWorkbenchSessionState } from "../store/workbench-persist";
import { RightUtilityRail, type RightAuxTab } from "./RightUtilityRail";
import { renderPaneAuxBody, type PaneAuxBodyProps } from "./pane/PaneAuxBody";
import { buildPaneTabProps } from "./pane/PaneTabProps";
import { WorkbenchAuxPane } from "./WorkbenchAuxPane";
import { WorkbenchStageContent } from "./WorkbenchStageContent";
import { useWorkbenchBrowser } from "./useWorkbenchBrowser";
import { TerminalDockPane } from "./TerminalDockPane";
import { useWorkbenchRequests } from "./useWorkbenchRequests";
import { useWorkbenchSubagents } from "./useWorkbenchSubagents";
import { useWorkbenchSummary } from "./useWorkbenchSummary";
import { useWorkbenchTabClose } from "./useWorkbenchTabClose";
import { useWorkbenchSessionState } from "./useWorkbenchSessionState";
import { useWorkbenchAuxTabs } from "./useWorkbenchAuxTabs";
import { useWorkbenchBlankTab } from "./useWorkbenchBlankTab";
import { shouldBootstrapBlankTab, shouldDropBlankTabForContent } from "./blank-tab-policy";
import { useWorkbenchOpeners } from "./useWorkbenchOpeners";
import { workbenchAuxTitles } from "./workbench-titles";
import { WorkbenchTopBar } from "./WorkbenchTopBar";
import styles from "./RightWorkbenchPane.module.css";

export function RightWorkbenchPane({
  locale,
  store,
  workbench,
  boundProjectId,
  boundProjectName,
  boundWorktreeId,
  showFilePreview,
  utilityPanels = [],
  projectContext = null,
  compact = false,
  hideCollapse = false,
  layoutMode = "chat-center",
  rightPanelMaximized = false,
  onToggleMaximizeRightPanel,
  onCollapseRightPanel,
  onLastTabClose,
  onCloseDrawer,
  onOpenSettings,
  onOpenCodeReview,
  onOpenExtensions,
  onStageWideChange,
}: {
  locale: ChatLocaleMessages;
  store: ChatClientStore;
  /** 工作台服务：标签级快捷键注册与菜单键位提示都从它取。测试可省略。 */
  workbench?: WorkbenchClientService | undefined;
  boundProjectId: string | null;
  boundProjectName: string | null;
  /** 当前会话绑定的工作树 id；缺省按项目根展示文件。 */
  boundWorktreeId?: string | undefined;
  showFilePreview: boolean;
  utilityPanels?: WorkbenchContextPanelContribution<ReactNode>[] | undefined;
  projectContext?: ReactNode | null | undefined;
  compact?: boolean | undefined;
  /** 预览区在左时收起按钮改由会话顶栏承担，这里隐藏，避免出现两个。 */
  hideCollapse?: boolean | undefined;
  /** 页面排版：预览区在左时工作台居中间列，图标轨移到左缘。 */
  layoutMode?: "chat-center" | "preview-center" | undefined;
  rightPanelMaximized?: boolean | undefined;
  onToggleMaximizeRightPanel?: (() => void) | undefined;
  onCollapseRightPanel?: (() => void) | undefined;
  /** 最后一个内容标签被关掉时的收尾；预览区在左时它才收起预览列，与顶栏那枚开关分开。 */
  onLastTabClose?: (() => void) | undefined;
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
    handleOpenNewBrowserTab, handleActivateBrowserTab, handleCloseBrowserTab, closeBrowserTabsExcept, handleOpenUrl, restoreBrowser, syncHostBrowser,
  } = useWorkbenchBrowser({ sessionId, store, activeFileTab, syncedSessionRef, initialOpen: initialSaved.browserOpen && Boolean(initialSaved.browserUrl) });
  const {
    subagentTabs, activeSubagentTabId, openSubagentTab, selectSubagentTab, closeSubagentTab,
  } = useWorkbenchSubagents({ sessionId, store, subagents });
  const activeSubagentTab = subagentTabs.find((tab) => tab.id === activeSubagentTabId);

  const stageKind = activeAuxTab ? "utility"
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

  // 辅助面板只在与主舞台并列时出现；文件树已移到左二「项目工作区」，右栏不再承载它。
  const effectiveAuxTab = stageKind === "utility" ? activeAuxTab : null;

  // 会话切换/刷新时读回右栏状态，恢复完成后再写回；细节收在同名 hook 里。
  useWorkbenchSessionState({
    sessionId,
    hydratedSessionId,
    setHydratedSessionId,
    syncedSessionRef,
    initialSaved,
    restoreBrowser,
    restoreAuxTab,
    setReviewTabOpen,
    setReviewMessageId,
    persist: { browserOpen, browserUrl: browserInitialUrl, reviewTabOpen, reviewMessageId, auxOpen, activeAuxTab, auxTabs },
  });

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
    setSelectedJobId,
    setSelectedSubagentId,
    openSubagentTab,
  });

  const blankTabActive = stageKind === "browser" && browserIsBlank;
  const openNewBrowserTab = () => { hideAuxTab(); handleOpenNewBrowserTab(); };

  // 当前是空白标签时，点击终端/变更/文件等直接把它变成对应标签，而不是再开一个。
  const dismissBlankTab = () => { if (blankTabActive) handleCloseBrowserTab(); };

  // 面板空着才补「新标签页」；切到文件/辅助/子智能体/审查标签时让位，避免用户没点「+」却多出一个标签。
  useWorkbenchBlankTab({
    shouldBootstrap: hydratedSessionId === sessionId && shouldBootstrapBlankTab({ browserOpen, fileTabs: fileTabs.length, auxTabs: auxTabs.length, subagentTabs: subagentTabs.length, reviewTabOpen }),
    shouldDrop: shouldDropBlankTabForContent({ stageKind, browserOpen, browserTabs: browserTabs.length, browserBlank: browserIsBlank }),
    bootstrap: handleOpenNewBrowserTab,
    // 让位后舞台落到用户真正打开的内容上，而不是被浏览器关闭强行拉回文件标签。
    dismiss: () => handleCloseBrowserTab(undefined, stageKind === "file" || stageKind === "review" || stageKind === "subagent" ? stageKind : null),
  });

  const { handleToggleAux, openAux, openReview } = useWorkbenchOpeners({
    store, stageKind, effectiveAuxTab, hideAuxTab, toggleAuxTab, openAuxTab, dismissBlankTab, setReviewMessageId, setReviewTabOpen,
  });

  const activeProfile = state.profiles.find((p) => p.id === state.activeProfileId) ?? state.profiles[0];
  const activeRulesCount = state.rules.filter((r) => r.content.trim().length > 0).length;
  const runningJobsCount = jobs.filter((j) => j.status === "running").length;
  const runningSubsCount = subagents.filter((s) => s.status === "running").length;

  const auxTitles = workbenchAuxTitles(locale.isZh);

  // 辅助面板的 props 一次性组装，具体渲染搬到 pane/PaneAuxBody。
  const auxBodyProps: PaneAuxBodyProps = {
    locale, store, sessionId, boundProjectId, boundProjectName, boundWorktreeId,
    activeFilePath: stageKind === "file" ? activeFileTab?.path : undefined,
    projectContext, utilityPanels,
    activeProfileName: activeProfile ? `${activeProfile.name} (${activeProfile.model})` : "-",
    activeProfileId: state.activeProfileId || undefined,
    memoriesCount: state.memoriesCount, activeRulesCount,
    selectedJobId, selectedSubagentId, onOpenSettings, workbench,
  };
  const renderAuxBody = (tab: RightAuxTab) => renderPaneAuxBody(auxBodyProps, tab);

  const auxPane = effectiveAuxTab ? (
    <WorkbenchAuxPane
      locale={locale}
      title={auxTitles[effectiveAuxTab]}
      compact={compact}
      width={auxWidth}
      dragging={auxDragging}
      hideHeader={false}
      body={renderAuxBody(effectiveAuxTab)}
      onResizeStart={startAuxResize}
      onKeyResize={handleAuxKeyResize}
      onClose={() => { if (activeAuxTab) closeAuxTabAndMaybeCollapse(activeAuxTab); }}
    />
  ) : null;

  const { closeBrowserTab, closeFileTab, closeReviewTab, closeAuxTab: closeAuxTabAndMaybeCollapse } = useWorkbenchTabClose({
    browserTabs: browserTabs.length, fileTabs: fileTabs.length, browserOpen, activeFileTab: Boolean(activeFileTab),
    reviewTabOpen, subagentTabs: subagentTabs.length, auxTabs: auxTabs.length,
    closeBrowserTab: (tabId) => handleCloseBrowserTab(tabId),
    closeFileTab: (tabId) => store.closeFilePreview(tabId),
    closeReviewTab: () => { setReviewTabOpen(false); if (state.rightStageKind === "review") store.setRightStageKind(activeFileTab ? "file" : browserOpen ? "browser" : null); },
    closeAuxTab,
    collapse: onLastTabClose ?? onCollapseRightPanel,
  });

  return (
    <div className={styles.workbench} data-layout={layoutMode}>
<WorkbenchTopBar
        tabProps={buildPaneTabProps({
          isZh: locale.isZh, stageKind, auxTabs, auxTitles, activeAuxTab, fileTabs, activeFileTab,
          browserOpen, browserTabs, browserIsBlank, reviewTabOpen, reviewMessageId,
          subagentTabs, activeSubagentTabId, rightStageKind: state.rightStageKind,
          store, workbench, hideAuxTab, openAuxTab, closeAuxTab, closeAuxTabAndMaybeCollapse,
          closeFileTab, closeBrowserTab, handleActivateBrowserTab, closeReviewTab,
          setReviewTabOpen, selectSubagentTab, closeSubagentTab, openNewBrowserTab, closeBrowserTabsExcept,
        })}
        actionProps={{
          variant: compact || rightPanelMaximized ? "full" : "workbenchOnly",
          isZh: locale.isZh,
          store,
          projectId: boundProjectId,
          projectName: boundProjectName ?? undefined,
          jobs,
          subagents,
          compact,
          rightPanelMaximized,
          onOpenReviewTab: openReview,
          onOpenTerminal: (jobId) => { setSelectedJobId(jobId); openAux("terminal"); },
          onOpenSubagents: (subId?: string) => {
            if (subId) { hideAuxTab(); openSubagentTab(subId); }
            else { openAux("subagents"); }
          },
          onNewBrowserTab: openNewBrowserTab,
          onOpenExtensions,
          onToggleMaximize: onToggleMaximizeRightPanel,
          onCollapsePanel: hideCollapse ? undefined : () => {
            if (compact && onCloseDrawer) { onCloseDrawer(); return; }
            onCollapseRightPanel?.();
          },
        }}
      />

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
          onOpenUrl={handleOpenUrl}
          onOpenTerminal={() => openAux("shell")}
          onOpenReview={openReview}
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
      {workbench && <TerminalDockPane sessionId={sessionId} isZh={locale.isZh} workbench={workbench} />}
    </div>
  );
}
