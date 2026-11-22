// 工作台快捷操作与概览控制：组合顶栏按钮组、“更多”与“概览”两个弹层，并持有菜单状态与任务数据。
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import type { ChatClientStore } from "../store/chat-store";
import { fetchGitDiff, fetchGitStatus, parseDiffSummary } from "../settings/coding-settings-client";
import { WorkbenchMoreMenu } from "./WorkbenchMoreMenu";
import { WorkbenchOverviewMenu } from "./WorkbenchOverviewMenu";
import { WorkbenchTopActions } from "./WorkbenchTopActions";
import type { RightJobItem } from "./RightTerminalPane";
import type { RightSubagentItem } from "./RightSubagentsPane";
import styles from "./RightWorkbenchActions.module.css";

/** 桌面常规模式下 `⋮` 与 `概览` 紧贴右面板左上缘，最右上角仅保留最大化与切换侧面板；窄屏/最大化模式下收纳回右面板顶栏。 */
export function RightWorkbenchActions({
  variant = "full",
  isZh,
  store,
  projectId,
  projectName,
  jobs,
  subagents,
  compact = false,
  rightPanelMaximized = false,
  onEnsureRightPanelOpen,
  onOpenReviewTab,
  onOpenFileTree,
  onOpenTerminal,
  onOpenSubagents,
  onNewBrowserTab,
  onOpenExtensions,
  onToggleMaximize,
  onCollapsePanel,
}: {
  variant?: "full" | "sessionOnly" | "workbenchOnly";
  isZh: boolean;
  store: ChatClientStore;
  projectId: string | null;
  projectName?: string | undefined;
  jobs?: RightJobItem[] | undefined;
  subagents?: RightSubagentItem[] | undefined;
  compact?: boolean | undefined;
  rightPanelMaximized?: boolean | undefined;
  onEnsureRightPanelOpen?: (() => void) | undefined;
  onOpenReviewTab?: (() => void) | undefined;
  onOpenFileTree?: (() => void) | undefined;
  onOpenTerminal?: ((jobId?: string) => void) | undefined;
  onOpenSubagents?: ((subagentId?: string) => void) | undefined;
  onNewBrowserTab?: (() => void) | undefined;
  onOpenExtensions?: (() => void) | undefined;
  onToggleMaximize?: (() => void) | undefined;
  onCollapsePanel?: (() => void) | undefined;
}) {
  const showSessionControls = variant !== "workbenchOnly";
  const showPanelControls = variant !== "sessionOnly";
  const [menuOpen, setMenuOpen] = useState<"more" | "overview" | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameText, setRenameText] = useState("");
  const [showAllSubs, setShowAllSubs] = useState(false);
  const [showAllJobs, setShowAllJobs] = useState(false);
  const [diffSummary, setDiffSummary] = useState<{ added: number; removed: number } | null>(null);
  const [diffError, setDiffError] = useState(false);
  const [changedFiles, setChangedFiles] = useState<number | null>(null);
  const [fetchedJobs, setFetchedJobs] = useState<RightJobItem[] | null>(null);
  const [fetchedSubagents, setFetchedSubagents] = useState<RightSubagentItem[] | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const snap = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const activeSession = snap.activeSession;
  const sessionId = activeSession?.id ?? "default";
  const effectiveJobs = jobs ?? fetchedJobs ?? [];
  const effectiveSubagents = subagents ?? fetchedSubagents ?? [];
  const hasJobFeed = jobs !== undefined;
  const hasSubagentFeed = subagents !== undefined;
  const foreground = snap.runningRunId
    ? activeSession?.messages.at(-1)?.steps?.find((step) => step.status === "running" && step.commandTrace)
    : undefined;

  useEffect(() => {
    if (!showSessionControls) return;
    const onOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenuOpen(null);
        setRenaming(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        setMenuOpen((prev) => (prev === "overview" ? null : "overview"));
      } else if (e.key === "Escape") {
        setMenuOpen(null);
        setRenaming(false);
      }
    };
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [showSessionControls]);

  useEffect(() => {
    if (!showSessionControls || menuOpen !== "overview") return;
    let current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setChangedFiles(null);
    setDiffSummary(null);
    setDiffError(false);
    setFetchedJobs(null);
    setFetchedSubagents(null);
    const refresh = async () => {
      // Git 状态包含尚未暂存的新文件，独立于差异行数。
      await Promise.allSettled([
        projectId && fetchGitStatus(projectId, sessionId).then((git) => {
          if (current) { setChangedFiles(git.isGitRepo ? git.files.length : null); if (!git.isGitRepo) setDiffError(true); }
        }).catch(() => { if (current) setDiffError(true); }),
        projectId && fetchGitDiff({ projectId, sessionId, statOnly: true }).then((res) => {
          if (current) setDiffSummary(parseDiffSummary(res.stat));
        }).catch(() => { if (current) setDiffError(true); }),
        !hasJobFeed && fetch(`/api/jobs?sessionId=${encodeURIComponent(sessionId)}`)
          .then((r) => r.ok ? r.json() : null).then((list) => {
            if (current && Array.isArray(list?.jobs)) setFetchedJobs(list.jobs);
          }),
        !hasSubagentFeed && fetch(`/api/subagents?sessionId=${encodeURIComponent(sessionId)}`)
          .then((r) => r.ok ? r.json() : null).then((list) => {
            if (current && Array.isArray(list?.subagents)) setFetchedSubagents(list.subagents);
          }),
      ]);
      if (current) timer = setTimeout(() => void refresh(), 2000);
    };
    void refresh();
    return () => { current = false; clearTimeout(timer); };
  }, [hasJobFeed, hasSubagentFeed, menuOpen, projectId, sessionId, showSessionControls]);

  const handleRenameSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (activeSession && renameText.trim()) {
      void store.updateSessionMeta(activeSession.id, { title: renameText.trim() });
    }
    setRenaming(false);
    setMenuOpen(null);
  };

  const handleStopJob = (jobId: string) => {
    void fetch(`/api/jobs/${encodeURIComponent(jobId)}/stop`, { method: "POST" });
  };

  const triggerReview = () => {
    onEnsureRightPanelOpen?.();
    if (onOpenReviewTab) onOpenReviewTab();
    else store.requestRightPanel("review");
    setMenuOpen(null);
  };

  const triggerFiles = () => {
    onEnsureRightPanelOpen?.();
    if (onOpenFileTree) onOpenFileTree();
    else store.requestRightPanel("files");
    setMenuOpen(null);
  };

  const triggerTerminal = (jobId?: string) => {
    onEnsureRightPanelOpen?.();
    if (onOpenTerminal) onOpenTerminal(jobId);
    else store.requestRightPanel("terminal", jobId);
    setMenuOpen(null);
  };

  const triggerSubagents = (subId?: string) => {
    onEnsureRightPanelOpen?.();
    if (onOpenSubagents) onOpenSubagents(subId);
    else store.requestRightPanel("subagents", subId);
    setMenuOpen(null);
  };

  const triggerBrowser = () => {
    onEnsureRightPanelOpen?.();
    if (onNewBrowserTab) onNewBrowserTab();
    else store.requestRightPanel("browser");
    setMenuOpen(null);
  };

  // 顶栏两个菜单互斥开关，切换时结束进行中的重命名。
  const toggleMenu = (kind: "more" | "overview") => {
    setRenaming(false);
    setMenuOpen((prev) => (prev === kind ? null : kind));
  };

  const handleStartRename = () => {
    if (!activeSession) return;
    setRenameText(activeSession.title);
    setRenaming(true);
  };

  const handleTogglePinned = () => {
    if (activeSession) void store.updateSessionMeta(activeSession.id, { pinned: !activeSession.pinned });
    setMenuOpen(null);
  };

  const handleToggleArchived = () => {
    if (activeSession) void store.updateSessionMeta(activeSession.id, { archived: !activeSession.archived });
    setMenuOpen(null);
  };

  const handleCopySession = () => {
    void navigator.clipboard?.writeText(activeSession?.title || window.location.href);
    setMenuOpen(null);
  };

  return (
    <div ref={wrapRef} className={styles.actionsWrap}>
      <WorkbenchTopActions
        isZh={isZh}
        compact={compact}
        rightPanelMaximized={rightPanelMaximized}
        menuOpen={menuOpen}
        showSessionControls={showSessionControls}
        showPanelControls={showPanelControls}
        onToggleMore={() => toggleMenu("more")}
        onToggleOverview={() => toggleMenu("overview")}
        onToggleMaximize={onToggleMaximize}
        onCollapsePanel={onCollapsePanel}
      />

      {showSessionControls && menuOpen === "more" && (
        <WorkbenchMoreMenu
          isZh={isZh}
          activeSession={activeSession}
          renaming={renaming}
          renameText={renameText}
          onRenameTextChange={setRenameText}
          onRenameSubmit={handleRenameSubmit}
          onStartRename={handleStartRename}
          onTogglePinned={handleTogglePinned}
          onToggleArchived={handleToggleArchived}
          onTriggerBrowser={triggerBrowser}
          onTriggerFiles={triggerFiles}
          onCopy={handleCopySession}
          onOpenExtensions={onOpenExtensions}
          onCloseMenu={() => setMenuOpen(null)}
        />
      )}

      {showSessionControls && menuOpen === "overview" && (
        <WorkbenchOverviewMenu
          isZh={isZh}
          projectName={projectName}
          projectId={projectId}
          changedFiles={changedFiles}
          diffError={diffError}
          diffSummary={diffSummary}
          foreground={foreground}
          jobs={effectiveJobs}
          subagents={effectiveSubagents}
          jobsLoaded={hasJobFeed || fetchedJobs !== null}
          subagentsLoaded={hasSubagentFeed || fetchedSubagents !== null}
          showAllJobs={showAllJobs}
          showAllSubs={showAllSubs}
          onToggleShowAllJobs={() => setShowAllJobs((value) => !value)}
          onToggleShowAllSubs={() => setShowAllSubs((value) => !value)}
          onTriggerReview={triggerReview}
          onTriggerFiles={triggerFiles}
          onTriggerTerminal={triggerTerminal}
          onTriggerSubagents={triggerSubagents}
          onStopJob={handleStopJob}
          onOpenExtensions={onOpenExtensions}
          onCloseMenu={() => setMenuOpen(null)}
        />
      )}
    </div>
  );
}