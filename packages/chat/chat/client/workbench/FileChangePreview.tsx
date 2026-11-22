// VS Code 风格只读代码与 Diff 查看器：支持可点击面包屑、更多菜单 5 项、内嵌搜索、刷新、切换侧栏、精确行定位及行内 + 批注；代码区支持自动换行开关。
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { IconPlus } from "@tabler/icons-react";
import type { ChatClientStore } from "../store/chat-store";
import type { AgentStepItem, FilePreviewTab } from "../store/chat-types";
import { highlightDocumentLines, isHighlightableCodeFile } from "../conversation/code-highlight";
import { fetchGitDiff } from "../settings/coding-settings-client";
import { getFileActivityKind } from "../shared/file-activity";
import { timelineMessages } from "../locales";
import { CodeBreadcrumbBar } from "./CodeBreadcrumbBar";
import { CodeSearchBar } from "./CodeSearchBar";
import { splitFromFragments, splitFromUnifiedDiff, type SplitLine, type SplitSide } from "./diff-view";
import { renderLineWithSearch } from "./file-search-highlight";
import { InlineComment } from "./InlineComment";
import syntaxStyles from "./CodeSyntax.module.css";
import styles from "./FileChangePreview.module.css";
import diffStyles from "./FileChangePreview.diff.module.css";

/** Diff 分栏中的单侧行：行号、+/- 标记与代码文本。 */
function SplitSideCell({ side }: { side: SplitSide }) {
  const sign = side.kind === "del" ? "-" : side.kind === "add" ? "+" : " ";
  return (
    <div className={diffStyles.splitSide} data-kind={side.kind} role="cell">
      <span className={diffStyles.splitNo} aria-hidden="true">{side.lineNo ?? ""}</span>
      <span className={diffStyles.splitSign} aria-hidden="true">{sign}</span>
      <code className={diffStyles.splitCode}>{side.text || "\u00A0"}</code>
    </div>
  );
}

/** 左右分栏的变更对照：左侧修改前、右侧修改后，hunk 头横跨两栏。 */
function SplitDiff({ lines }: { lines: SplitLine[] }) {
  if (lines.length === 0) return null;
  return (
    <div className={diffStyles.diffSplit} role="table" aria-label="diff">
      {lines.map((line, index) => line.kind === "header" ? (
        <div key={index} className={diffStyles.hunkHeader} role="row">{line.header}</div>
      ) : (
        <div key={index} className={diffStyles.splitRow} role="row">
          <SplitSideCell side={line.left} />
          <SplitSideCell side={line.right} />
        </div>
      ))}
    </div>
  );
}

export function FileChangePreview({
  step,
  tab,
  sessionId,
  projectId,
  worktreeId,
  boundProjectName,
  sidebarOpen,
  auxPane,
  isZh,
  store,
  onToggleSidebar,
}: {
  step?: AgentStepItem | undefined;
  tab: FilePreviewTab;
  sessionId: string;
  projectId: string | null;
  /** 当前会话工作树 id；缺省按项目根读取文件与差异。 */
  worktreeId?: string | undefined;
  boundProjectName?: string | null | undefined;
  sidebarOpen?: boolean | undefined;
  auxPane?: ReactNode;
  isZh: boolean;
  store: ChatClientStore;
  onToggleSidebar?: (() => void) | undefined;
}) {
  const labels = timelineMessages[isZh ? "zh" : "en"];
  const { path, relativePath, messageId, stepId, targetLine, endLine } = tab;
  const change = step?.fileChange;
  const hasStepSource = Boolean(messageId && stepId);
  const [showChanges, setShowChanges] = useState(false);
  const [source, setSource] = useState<{ content: string; truncated: boolean; error?: string } | null>(null);
  const [legacyDiff, setLegacyDiff] = useState<{ text: string; error?: string } | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [notice, setNotice] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wrap, setWrap] = useState(true);
  const [activeMatchIdx, setActiveMatchIdx] = useState(0);
  const [commentLine, setCommentLine] = useState<number | null>(null);
  const sourceRef = useRef<HTMLDivElement>(null);
  const focusLineRef = useRef<HTMLDivElement>(null);
  const matchLineRef = useRef<HTMLDivElement>(null);

  const effectiveProjectId = tab.projectId ?? projectId;
  const effectiveWorktreeId = tab.worktreeId ?? worktreeId;
  const canReadGit = Boolean(effectiveProjectId) && showChanges;
  const displayPath = (relativePath || path).replace(/\\/gu, "/");
  const focusStart = targetLine ?? change?.firstLine ?? 1;
  const focusEnd = endLine ?? (change ? change.firstLine + Math.max(0, change.after.split("\n").length - 1) : focusStart);

  useEffect(() => {
    setCommentLine(null);
    setNotice("");
    setShowChanges(false);
  }, [tab.id]);

  useEffect(() => {
    const controller = new AbortController();
    setSource(null);
    const preferLiveDisk = reloadNonce > 0 && Boolean(effectiveProjectId);
    if (!preferLiveDisk && hasStepSource && messageId && stepId) {
      void store.readFileActivity(sessionId, messageId, stepId, controller.signal).then(
        (value) => { if (!controller.signal.aborted) setSource(value); },
        (error: unknown) => {
          if (!controller.signal.aborted) {
            setSource({ content: "", truncated: false, error: error instanceof Error ? error.message : String(error) });
          }
        },
      );
    } else if (effectiveProjectId) {
      void store.readProjectFile(effectiveProjectId, path, controller.signal, effectiveWorktreeId).then(
        (value) => { if (!controller.signal.aborted) setSource({ content: value.content, truncated: value.truncated }); },
        (error: unknown) => {
          if (!controller.signal.aborted) {
            setSource({ content: "", truncated: false, error: error instanceof Error ? error.message : String(error) });
          }
        },
      );
    } else {
      setSource({ content: "", truncated: false, error: isZh ? "未关联项目或文件快照" : "No workspace file source" });
    }
    return () => controller.abort();
  }, [store, sessionId, messageId, stepId, hasStepSource, effectiveProjectId, path, isZh, reloadNonce]);

  useLayoutEffect(() => {
    if (!showChanges && sourceRef.current && focusLineRef.current) {
      const container = sourceRef.current;
      const target = focusLineRef.current;
      container.scrollTop = Math.max(0, target.offsetTop - Math.round(container.clientHeight * 0.25));
    }
  }, [source, showChanges, focusStart, tab.id]);

  useEffect(() => {
    if (!canReadGit || !effectiveProjectId || change) return;
    let current = true;
    void fetchGitDiff({ projectId: effectiveProjectId, sessionId, filePath: displayPath }).then(
      ({ diff }) => { if (current) setLegacyDiff({ text: diff }); },
      (error: unknown) => {
        if (current) setLegacyDiff({ text: "", error: error instanceof Error ? error.message : String(error) });
      },
    );
    return () => { current = false; };
  }, [canReadGit, change, displayPath, effectiveProjectId, reloadNonce]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f" && sourceRef.current?.contains(document.activeElement)) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const allLines = useMemo(() => source?.content.split(/\r?\n/u) ?? [], [source?.content]);
  const lines = useMemo(() => allLines.slice(0, 2600), [allLines]);
  const code = isHighlightableCodeFile(path);
  const highlightedLines = useMemo(
    () => (code ? highlightDocumentLines(lines) : lines.map((l) => [l || "\u00A0"])),
    [code, lines],
  );

  const searchMatchLines = useMemo(() => {
    if (!searchOpen || !searchQuery) return [];
    const needle = caseSensitive ? searchQuery : searchQuery.toLowerCase();
    const matched: number[] = [];
    lines.forEach((line, idx) => {
      const hay = caseSensitive ? line : line.toLowerCase();
      if (hay.includes(needle)) matched.push(idx + 1);
    });
    return matched;
  }, [caseSensitive, lines, searchOpen, searchQuery]);

  const safeMatchIdx = searchMatchLines.length > 0 ? activeMatchIdx % searchMatchLines.length : 0;
  const activeMatchLine = searchMatchLines[safeMatchIdx] ?? null;

  useLayoutEffect(() => {
    if (activeMatchLine !== null && sourceRef.current && matchLineRef.current) {
      const c = sourceRef.current;
      c.scrollTop = Math.max(0, matchLineRef.current.offsetTop - Math.round(c.clientHeight * 0.3));
    }
  }, [activeMatchLine, safeMatchIdx]);

  const handleCopyContent = () => {
    if (!source?.content) return;
    void navigator.clipboard?.writeText(source.content);
  };

  const handleDownloadFile = () => {
    if (!source?.content) return;
    const blob = new Blob([source.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = displayPath.split("/").pop() || "file.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyPath = () => {
    const loc = focusStart > 1 ? `${displayPath}#L${focusStart}` : displayPath;
    void navigator.clipboard?.writeText(loc);
  };

  const handleRevealInExplorer = () => {
    if (!effectiveProjectId) return;
    setNotice("");
    void fetch(`/api/workspace/projects/${encodeURIComponent(effectiveProjectId)}/reveal-file`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    })
      .then((r) => r.json() as Promise<{ opened?: boolean; error?: string }>)
      .then((res) => {
        if (!res.opened && res.error) setNotice(res.error);
      })
      .catch((err) => setNotice(err instanceof Error ? err.message : String(err)));
  };

  const focusBadge = (change || targetLine)
    ? (focusEnd > focusStart ? `L${focusStart}-${focusEnd}` : `L${focusStart}`)
    : undefined;

  return (
    <section className={styles.viewer} aria-label={labels.preview}>
      <CodeBreadcrumbBar
        displayPath={displayPath}
        projectId={effectiveProjectId}
        worktreeId={effectiveWorktreeId}
        boundProjectName={boundProjectName}
        isZh={isZh}
        hasDiffToggle={Boolean(change || effectiveProjectId)}
        showChanges={showChanges}
        focusBadge={focusBadge}
        sidebarOpen={sidebarOpen}
        hasSource={Boolean(source?.content)}
        wrapEnabled={wrap}
        store={store}
        onToggleDiff={() => setShowChanges((v) => !v)}
        onRefresh={() => setReloadNonce((n) => n + 1)}
        onToggleSidebar={onToggleSidebar}
        onToggleWrap={() => setWrap((v) => !v)}
        onCopyContent={handleCopyContent}
        onDownloadFile={handleDownloadFile}
        onCopyPath={handleCopyPath}
        onOpenSearch={() => { setShowChanges(false); setSearchOpen(true); }}
        onRevealInExplorer={effectiveProjectId ? handleRevealInExplorer : undefined}
      />

      {notice && <div className={styles.noticeBanner} role="status">{notice}</div>}

      <div className={styles.editorSplit}>
        <div className={styles.editorMain}>
          {searchOpen && !showChanges && (
            <CodeSearchBar
              isZh={isZh}
              query={searchQuery}
              caseSensitive={caseSensitive}
              matchCount={searchMatchLines.length}
              activeIndex={safeMatchIdx}
              onChangeQuery={(val) => { setSearchQuery(val); setActiveMatchIdx(0); }}
              onToggleCase={() => setCaseSensitive((v) => !v)}
              onPrev={() => setActiveMatchIdx((i) => (searchMatchLines.length > 0 ? (i - 1 + searchMatchLines.length) % searchMatchLines.length : 0))}
              onNext={() => setActiveMatchIdx((i) => (searchMatchLines.length > 0 ? (i + 1) % searchMatchLines.length : 0))}
              onClose={() => { setSearchOpen(false); setSearchQuery(""); }}
            />
          )}

          {!showChanges ? (
            source === null || source.error ? (
              <div role="status" className={styles.stateBox}>{source?.error ?? labels.loadingSource}</div>
            ) : (
              <>
                <div ref={sourceRef} className={`${styles.source} ${syntaxStyles.syntax}`} data-wrap={wrap ? "true" : "false"} tabIndex={0} aria-label={labels.source}>
                  {lines.map((line, index) => {
                    const number = index + 1;
                    const isTarget = Boolean(change || targetLine) && number >= focusStart && number <= focusEnd;
                    const isFirstFocus = number === focusStart;
                    const isSearchMatch = number === activeMatchLine;
                    const commentOpen = commentLine === number;
                    return (
                      <Fragment key={number}>
                        <div
                          ref={isSearchMatch ? matchLineRef : (isFirstFocus ? focusLineRef : undefined)}
                          className={styles.sourceLine}
                          data-changed={isTarget ? "true" : undefined}
                          data-search-match={isSearchMatch ? "true" : undefined}
                        >
                          <button
                            type="button"
                            className={styles.addCommentGutter}
                            aria-label={isZh ? `在第 ${number} 行添加批注` : `Comment on line ${number}`}
                            title={isZh ? "添加行内批注发给 Agent" : "Add line comment"}
                            onClick={() => setCommentLine((prev) => (prev === number ? null : number))}
                          >
                            <IconPlus size={12} />
                          </button>
                          <span className={styles.lineNumber} aria-hidden="true">{number}</span>
                          <code className={styles.codeContent}>
                            {renderLineWithSearch(line, searchOpen ? searchQuery : "", caseSensitive, highlightedLines[index] ?? [line || "\u00A0"])}
                          </code>
                        </div>

                        {commentOpen && (
                          <InlineComment
                            key={number}
                            lineNumber={number}
                            lineText={line}
                            displayPath={displayPath}
                            isZh={isZh}
                            store={store}
                            onClose={() => setCommentLine(null)}
                          />
                        )}
                      </Fragment>
                    );
                  })}
                </div>
                {(source.truncated || allLines.length > lines.length) && (
                  <div className={styles.limitNotice}>{labels.sourceLimit}</div>
                )}
              </>
            )
          ) : (
            <div className={diffStyles.diffBody}>
              {change ? (
                <>
                  <div className={diffStyles.diffMeta}>
                    <span>{labels.fileKinds[getFileActivityKind(step!)]}</span>
                    {(change.before || change.after) && <span>{labels.fromLine(change.firstLine)}</span>}
                  </div>
                  {change.before || change.after ? (
                    <SplitDiff lines={splitFromFragments(change.before, change.after, change.firstLine)} />
                  ) : (
                    <p className={diffStyles.diffHint}>{change.operation === "created" ? labels.emptyFile : labels.noTextChange}</p>
                  )}
                  {change.truncated && <small className={diffStyles.diffHint}>{labels.clipped}</small>}
                </>
              ) : legacyDiff?.text ? (
                <SplitDiff lines={splitFromUnifiedDiff(legacyDiff.text)} />
              ) : (
                <p className={diffStyles.diffHint}>{legacyDiff === null ? labels.loadingDiff : (legacyDiff.error || labels.noDiff)}</p>
              )}
            </div>
          )}
        </div>
        {auxPane}
      </div>
    </section>
  );
}