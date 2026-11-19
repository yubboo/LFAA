// 工作台快捷操作与概览控制：桌面常规模式下 `⋮` 与 `概览` 紧贴右面板左上缘置于 WorkspaceBar，最右上角仅保留最大化与切换侧面板；窄屏/最大化模式下收纳回右面板顶栏。
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import {
  IconArchive,
  IconCheck,
  IconChevronRight,
  IconCircleX,
  IconClock,
  IconCopy,
  IconDotsVertical,
  IconFile,
  IconFileDiff,
  IconFolder,
  IconLayoutColumns,
  IconLayoutList,
  IconLayoutSidebarRight,
  IconMaximize,
  IconMinimize,
  IconPencil,
  IconPin,
  IconPlayerStop,
  IconPuzzle,
  IconTerminal2,
  IconWorld,
  IconX,
} from "@tabler/icons-react";
import type { ChatClientStore } from "../chat-store";
import { fetchGitDiff } from "../coding-settings-client";
import type { RightJobItem } from "./RightTerminalPane";
import type { RightSubagentItem } from "./RightSubagentsPane";
import styles from "./RightWorkbenchActions.module.css";

function parseDiffSummary(diffText: string): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const line of diffText.split(/\r?\n/u)) {
    if (line.startsWith("+") && !line.startsWith("+++")) added += 1;
    else if (line.startsWith("-") && !line.startsWith("---")) removed += 1;
  }
  return { added, removed };
}

export function RightWorkbenchActions({
  variant = "full",
  isZh,
  store,
  projectId,
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
  const [diffSummary, setDiffSummary] = useState<{ added: number; removed: number }>({ added: 0, removed: 0 });
  const [fetchedJobs, setFetchedJobs] = useState<RightJobItem[]>([]);
  const [fetchedSubagents, setFetchedSubagents] = useState<RightSubagentItem[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  const snap = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const activeSession = snap.activeSession;
  const sessionId = activeSession?.id ?? "default";
  const effectiveJobs = jobs ?? fetchedJobs;
  const effectiveSubagents = subagents ?? fetchedSubagents;

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
    void fetchGitDiff({ projectId }).then(
      (res) => { if (current) setDiffSummary(parseDiffSummary(res.diff)); },
      () => {},
    );
    if (!jobs || !subagents) {
      void Promise.all([
        jobs ? Promise.resolve(null) : fetch(`/api/jobs?sessionId=${encodeURIComponent(sessionId)}`).then((r) => (r.ok ? r.json() : { jobs: [] })),
        subagents ? Promise.resolve(null) : fetch(`/api/subagents?sessionId=${encodeURIComponent(sessionId)}`).then((r) => (r.ok ? r.json() : { subagents: [] })),
      ]).then(([jobsRes, subsRes]) => {
        if (!current) return;
        if (jobsRes && Array.isArray(jobsRes.jobs)) setFetchedJobs(jobsRes.jobs);
        if (subsRes && Array.isArray(subsRes.subagents)) setFetchedSubagents(subsRes.subagents);
      }).catch(() => {});
    }
    return () => { current = false; };
  }, [jobs, menuOpen, projectId, sessionId, showSessionControls, subagents]);

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

  const visibleSubs = showAllSubs ? effectiveSubagents : effectiveSubagents.slice(0, 2);
  const visibleJobs = showAllJobs ? effectiveJobs : effectiveJobs.slice(0, 2);

  return (
    <div ref={wrapRef} className={styles.actionsWrap}>
      {showSessionControls && (
        <>
          <button
            type="button"
            className={`${styles.topIconBtn} ${menuOpen === "more" ? styles.topIconBtnActive : ""}`}
            aria-label={isZh ? "工作台更多选项" : "More workbench options"}
            aria-expanded={menuOpen === "more"}
            title={isZh ? "更多操作" : "More actions"}
            onClick={() => { setRenaming(false); setMenuOpen((p) => (p === "more" ? null : "more")); }}
          >
            <IconDotsVertical size={15} />
          </button>

          <button
            type="button"
            className={`${styles.topIconBtn} ${menuOpen === "overview" ? styles.topIconBtnActive : ""}`}
            aria-label={isZh ? "切换概览面板 Ctrl+Alt+O" : "Toggle overview Ctrl+Alt+O"}
            aria-expanded={menuOpen === "overview"}
            title={isZh ? "切换概览面板 Ctrl+Alt+O" : "Toggle overview (Ctrl+Alt+O)"}
            onClick={() => { setRenaming(false); setMenuOpen((p) => (p === "overview" ? null : "overview")); }}
          >
            <IconLayoutList size={15} />
          </button>
        </>
      )}

      {showPanelControls && !compact && onToggleMaximize && (
        <button
          type="button"
          className={`${styles.topIconBtn} ${rightPanelMaximized ? styles.topIconBtnActive : ""}`}
          aria-label={rightPanelMaximized ? (isZh ? "还原窗格 Ctrl+Shift+M" : "Restore pane") : (isZh ? "最大化窗格 Ctrl+Shift+M" : "Maximize pane")}
          aria-pressed={rightPanelMaximized}
          title={rightPanelMaximized ? (isZh ? "还原窗格 Ctrl+Shift+M" : "Restore pane (Ctrl+Shift+M)") : (isZh ? "最大化窗格 Ctrl+Shift+M" : "Maximize pane (Ctrl+Shift+M)")}
          onClick={onToggleMaximize}
        >
          {rightPanelMaximized ? <IconMinimize size={15} /> : <IconMaximize size={15} />}
        </button>
      )}

      {showPanelControls && onCollapsePanel && (
        <button
          type="button"
          className={styles.topIconBtn}
          aria-label={compact ? (isZh ? "关闭右侧工作台" : "Close right workbench") : (isZh ? "切换侧面板 Ctrl+Shift+B" : "Toggle right panel")}
          title={compact ? (isZh ? "关闭右侧工作台" : "Close") : (isZh ? "切换侧面板 Ctrl+Shift+B" : "Toggle right panel (Ctrl+Shift+B)")}
          onClick={onCollapsePanel}
        >
          {compact ? <IconX size={15} /> : <IconLayoutSidebarRight size={15} />}
        </button>
      )}

      {showSessionControls && menuOpen === "more" && (
        <div className={styles.popover} role="menu" aria-label={isZh ? "会话与工作台操作" : "Workbench actions"}>
          {renaming && activeSession ? (
            <form className={styles.renameForm} onSubmit={handleRenameSubmit}>
              <input
                autoFocus
                value={renameText}
                onChange={(e) => setRenameText(e.target.value)}
                placeholder={isZh ? "输入会话新名称…" : "Session title..."}
              />
              <button type="submit" className={styles.renameSave}>{isZh ? "保存" : "Save"}</button>
            </form>
          ) : (
            <button
              type="button"
              role="menuitem"
              className={styles.menuItem}
              disabled={!activeSession}
              onClick={() => {
                if (activeSession) {
                  setRenameText(activeSession.title);
                  setRenaming(true);
                }
              }}
            >
              <IconPencil size={14} />
              <span>{isZh ? "重命名" : "Rename"}</span>
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className={styles.menuItem}
            disabled={!activeSession}
            onClick={() => {
              if (activeSession) void store.updateSessionMeta(activeSession.id, { pinned: !activeSession.pinned });
              setMenuOpen(null);
            }}
          >
            <IconPin size={14} />
            <span>{activeSession?.pinned ? (isZh ? "取消置顶" : "Unpin") : (isZh ? "置顶" : "Pin")}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={styles.menuItem}
            disabled={!activeSession}
            onClick={() => {
              if (activeSession) void store.updateSessionMeta(activeSession.id, { archived: !activeSession.archived });
              setMenuOpen(null);
            }}
          >
            <IconArchive size={14} />
            <span>{activeSession?.archived ? (isZh ? "取消归档" : "Unarchive") : (isZh ? "归档" : "Archive")}</span>
          </button>
          <div className={styles.divider} />
          <button type="button" role="menuitem" className={styles.menuItem} onClick={triggerBrowser}>
            <IconLayoutColumns size={14} />
            <span>{isZh ? "分屏打开内置浏览器" : "Split browser tab"}</span>
            <IconWorld size={13} className={styles.trailingIcon} />
          </button>
          <button type="button" role="menuitem" className={styles.menuItem} onClick={triggerFiles}>
            <IconFolder size={14} />
            <span>{isZh ? "切换工作区文件树" : "Toggle file tree"}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={styles.menuItem}
            onClick={() => {
              void navigator.clipboard?.writeText(activeSession?.title || window.location.href);
              setMenuOpen(null);
            }}
          >
            <IconCopy size={14} />
            <span>{isZh ? "复制" : "Copy"}</span>
            <IconChevronRight size={13} className={styles.trailingIcon} />
          </button>
          {onOpenExtensions && (
            <>
              <div className={styles.divider} />
              <button type="button" role="menuitem" className={styles.menuItem} onClick={() => { onOpenExtensions(); setMenuOpen(null); }}>
                <IconPuzzle size={14} />
                <span>{isZh ? "扩展" : "Extensions"}</span>
                <IconChevronRight size={13} className={styles.trailingIcon} />
              </button>
            </>
          )}
        </div>
      )}

      {showSessionControls && menuOpen === "overview" && (
        <div className={`${styles.popover} ${styles.overviewPopover}`} role="dialog" aria-label={isZh ? "工作台概览" : "Workbench overview"}>
          <div className={styles.overviewSectionHead}>{isZh ? "概览" : "Overview"}</div>
          <button type="button" className={styles.menuItem} onClick={triggerReview}>
            <IconFileDiff size={14} />
            <span>{isZh ? "审查" : "Review"}</span>
            {(diffSummary.added > 0 || diffSummary.removed > 0) && (
              <span className={styles.diffDelta}>
                <em className={styles.diffPlus}>+{diffSummary.added}</em>
                <em className={styles.diffMinus}>-{diffSummary.removed}</em>
              </span>
            )}
          </button>
          <button type="button" className={styles.menuItem} onClick={triggerFiles}>
            <IconFile size={14} />
            <span>{isZh ? "文件" : "Files"}</span>
          </button>
          <button type="button" className={styles.menuItem} onClick={() => triggerTerminal()}>
            <IconTerminal2 size={14} />
            <span>{isZh ? "终端" : "Terminal"}</span>
          </button>
          {onOpenExtensions && (
            <button type="button" className={styles.menuItem} onClick={() => { onOpenExtensions(); setMenuOpen(null); }}>
              <IconPuzzle size={14} />
              <span>{isZh ? "扩展" : "Extensions"}</span>
              <IconChevronRight size={13} className={styles.trailingIcon} />
            </button>
          )}

          <div className={styles.divider} />
          <div className={styles.overviewSectionHead}>
            <span>{isZh ? "子智能体" : "Subagents"}</span>
            <span className={styles.countPill}>{effectiveSubagents.length}</span>
          </div>
          {visibleSubs.map((sub) => {
            const Icon = sub.status === "running" ? IconClock : sub.status === "done" ? IconCheck : IconCircleX;
            return (
              <button key={sub.id} type="button" className={styles.menuItem} onClick={() => triggerSubagents(sub.id)}>
                <Icon size={13} className={styles.statusIcon} data-status={sub.status} />
                <span className={styles.itemEllipsis}>{sub.role}</span>
              </button>
            );
          })}
          {effectiveSubagents.length > 2 && (
            <button type="button" className={styles.viewAllLink} onClick={() => setShowAllSubs((v) => !v)}>
              {showAllSubs ? (isZh ? "收起" : "Show less") : (isZh ? "查看全部" : "View all")}
            </button>
          )}

          <div className={styles.divider} />
          <div className={styles.overviewSectionHead}>
            <span>{isZh ? "后台任务" : "Background tasks"}</span>
            <span className={styles.countPill}>{effectiveJobs.length}</span>
          </div>
          {visibleJobs.map((job) => {
            const Icon = job.status === "running" ? IconTerminal2 : job.status === "done" ? IconCheck : IconCircleX;
            return (
              <div key={job.id} className={styles.jobRowWrap}>
                <button type="button" className={styles.menuItem} onClick={() => triggerTerminal(job.id)}>
                  <Icon size={13} className={styles.statusIcon} data-status={job.status} />
                  <span className={styles.itemEllipsis}>{job.title}</span>
                </button>
                {job.status === "running" && (
                  <button
                    type="button"
                    className={styles.stopJobBtn}
                    title={isZh ? "停止任务" : "Stop job"}
                    onClick={() => handleStopJob(job.id)}
                  >
                    <IconPlayerStop size={12} />
                  </button>
                )}
              </div>
            );
          })}
          {effectiveJobs.length > 2 && (
            <button type="button" className={styles.viewAllLink} onClick={() => setShowAllJobs((v) => !v)}>
              {showAllJobs ? (isZh ? "收起" : "Show less") : (isZh ? "查看全部" : "View all")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
