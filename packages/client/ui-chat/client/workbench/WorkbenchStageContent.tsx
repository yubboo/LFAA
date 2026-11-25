// 右侧工作台主体舞台：按当前标签渲染文件预览、工作区/本轮变更、内置浏览器或欢迎页，并组合辅助面板。
import type { ReactNode } from "react";
import { IconX } from "@tabler/icons-react";
import { RightBrowserPane, type BrowserSessionSnapshot } from "@lfaa/client-ui-browser/client";
import type { ChatClientStore } from "../store/chat-store";
import type { ChatLocaleMessages } from "../locales";
import { FileChangePreview } from "./FileChangePreview";
import { RightGitReviewPane } from "./RightGitReviewPane";
import { RightWorkbenchStart } from "./Right-Workbench-Start";
import { SubagentStageView } from "./Subagent-Stage-View";
import type { SubagentStageTab } from "./useWorkbenchSubagents";
import type { RightAuxTab } from "./RightUtilityRail";
import { TurnChanges } from "../conversation/Turn-Changes";
import { WorkbenchStatusList } from "./WorkbenchStatusList";
import type { RightJobItem } from "./RightTerminalPane";
import type { RightSubagentItem } from "./RightSubagentsPane";
import type { AgentStepItem, ChatMessageItem, FilePreviewTab } from "../store/chat-types";
import type { RightStageKind } from "./WorkbenchTabs";
import styles from "./RightWorkbenchPane.module.css";

export function WorkbenchStageContent({
  locale,
  store,
  sessionId,
  boundProjectId,
  boundProjectName,
  boundWorktreeId,
  stageKind,
  activeAux,
  auxTitle,
  activeFileTab,
  activeSubagentTab,
  selectedStep,
  effectiveAuxTab,
  reviewMessage,
  reviewMessageId,
  browserInitialUrl,
  browserExternalState,
  agentRunning,
  browserAutomationActive,
  browserActivity,
  devtoolsRequest,
  showStartPage,
  activeBrowserTabId,
  jobs,
  subagents,
  auxPane,
  renderAuxBody,
  onCloseAux,
  onToggleFileSidebar,
  onOpenUrl,
  onOpenTerminal,
  onOpenReview,
  onOpenFiles,
  onOpenSideAsk,
  onSnapshotChange,
  onAttachPage,
  onOpenCodeReview,
  onSelectSubagent,
  onSelectJob,
}: {
  locale: ChatLocaleMessages;
  store: ChatClientStore;
  sessionId: string;
  boundProjectId: string | null;
  boundProjectName: string | null;
  boundWorktreeId?: string | undefined;
  stageKind: RightStageKind;
  activeAux: RightAuxTab;
  auxTitle: string;
  activeFileTab: FilePreviewTab | undefined;
  activeSubagentTab?: SubagentStageTab | undefined;
  selectedStep: AgentStepItem | undefined;
  effectiveAuxTab: RightAuxTab | null;
  reviewMessage: ChatMessageItem | undefined;
  reviewMessageId: string | undefined;
  browserInitialUrl: string | undefined;
  browserExternalState: { snap: BrowserSessionSnapshot; nonce: number } | undefined;
  agentRunning: boolean;
  browserAutomationActive: boolean;
  browserActivity?: string | undefined;
  devtoolsRequest?: { tab: "console" | "network"; nonce: number } | undefined;
  showStartPage: boolean;
  activeBrowserTabId: string | undefined;
  jobs: RightJobItem[];
  subagents: RightSubagentItem[];
  auxPane: ReactNode;
  renderAuxBody: (tab: RightAuxTab) => ReactNode;
  onCloseAux: () => void;
  onToggleFileSidebar: () => void;
  onOpenUrl: (url: string) => Promise<void>;
  onOpenTerminal: () => void;
  onOpenReview: () => void;
  onOpenFiles: () => void;
  onOpenSideAsk: () => void;
  onSnapshotChange: (snap: BrowserSessionSnapshot) => void;
  onAttachPage: (snap: BrowserSessionSnapshot) => void;
  onOpenCodeReview?: (() => void) | undefined;
  onSelectSubagent: (subagentId: string) => void;
  onSelectJob: (jobId: string) => void;
}) {
  if (stageKind === "utility") {
    return (
      <div className={styles.mainStage}>
        <div className={styles.auxHeader}>
          <span>{auxTitle}</span>
          <button type="button" className={styles.tabClose} aria-label={locale.isZh ? "关闭面板" : "Close pane"} onClick={onCloseAux}>
            <IconX size={12} />
          </button>
        </div>
        <div className={styles.auxContent}>{renderAuxBody(activeAux)}</div>
      </div>
    );
  }

  if (stageKind === "file" && activeFileTab) {
    return (
      <div className={styles.mainStage}>
        <FileChangePreview
          step={selectedStep}
          tab={activeFileTab}
          sessionId={sessionId}
          projectId={boundProjectId}
          worktreeId={boundWorktreeId}
          boundProjectName={boundProjectName}
          sidebarOpen={effectiveAuxTab === "filesTree"}
          auxPane={auxPane}
          isZh={locale.isZh}
          store={store}
          onToggleSidebar={onToggleFileSidebar}
        />
      </div>
    );
  }

  if (stageKind === "subagent" && activeSubagentTab) {
    return (
      <>
        <div className={styles.mainStage}>
          <SubagentStageView
            key={activeSubagentTab.id}
            subagentId={activeSubagentTab.id}
            fallbackRole={activeSubagentTab.role}
            locale={locale}
          />
        </div>
        {auxPane}
      </>
    );
  }

  return (
    <>
      <div className={styles.mainStage}>
        {stageKind === "review" && (reviewMessageId ? (
          <TurnChanges key={reviewMessageId} sessionId={sessionId} isZh={locale.isZh}
            message={reviewMessage}
            onOpenWorkspace={onOpenReview} />
        ) : (
          <RightGitReviewPane
            key={`${boundProjectId ?? ""}:${sessionId}:${boundWorktreeId ?? ""}`}
            isZh={locale.isZh}
            projectId={boundProjectId}
            sessionId={sessionId}
            worktreeId={boundWorktreeId}
            store={store}
            onOpenFullCodeReview={onOpenCodeReview}
          />
        ))}
        {stageKind === "browser" && (
          // 空白时浏览器仍订阅宿主机状态，小鱼打开页面后可直接切回实时视口。
          <div className={styles.browserView} data-covered={showStartPage || undefined} inert={showStartPage}>
            <RightBrowserPane
              key={sessionId}
              sessionId={sessionId}
              isZh={locale.isZh}
              initialUrl={browserInitialUrl}
              hideTabStrip={true}
              agentRunning={agentRunning}
              browserAutomationActive={browserAutomationActive}
              browserActivity={browserActivity}
              externalState={browserExternalState}
              devtoolsRequest={devtoolsRequest}
              onSnapshotChange={onSnapshotChange}
              onAttachPage={onAttachPage}
            />
          </div>
        )}
        {showStartPage && (
          <RightWorkbenchStart
            key={`${sessionId}:${boundProjectId ?? ""}:${activeBrowserTabId ?? stageKind}`}
            isZh={locale.isZh}
            store={store}
            projectId={boundProjectId}
            worktreeId={boundWorktreeId}
            projectName={boundProjectName}
            onOpenUrl={onOpenUrl}
            onOpenTerminal={onOpenTerminal}
            onOpenReview={onOpenReview}
            onOpenFiles={onOpenFiles}
            onOpenSideAsk={onOpenSideAsk}
          >
            {(jobs.length > 0 || subagents.length > 0) && (
              <WorkbenchStatusList
                subagents={subagents}
                jobs={jobs}
                onSelectSubagent={onSelectSubagent}
                onSelectJob={onSelectJob}
              />
            )}
          </RightWorkbenchStart>
        )}
      </div>
      {auxPane}
    </>
  );
}
