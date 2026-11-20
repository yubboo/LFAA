// 右侧工作台 Git 变更列表，在文件行下方按需读取并展示真实差异。
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { IconCheck, IconChevronRight, IconCode, IconGitBranch, IconPlus, IconRefresh } from "@tabler/icons-react";
import type { ChatClientStore } from "../chat-store";
import {
  fetchGitDiff,
  fetchGitStatus,
  parseDiffSummary,
  postGitStage,
  postGitUnstage,
  type GitStatusSnapshot,
} from "../coding-settings-client";
import { FileTypeIcon } from "./file-icons";
import styles from "./RightWorkbenchActions.module.css";

export function RightGitReviewPane({
  isZh,
  projectId,
  store,
  onOpenFullCodeReview,
}: {
  isZh: boolean;
  projectId: string | null;
  store: ChatClientStore;
  onOpenFullCodeReview?: (() => void) | undefined;
}) {
  const [status, setStatus] = useState<GitStatusSnapshot | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diff, setDiff] = useState<{ text: string; truncated?: boolean } | null>(null);
  const [counts, setCounts] = useState<ReturnType<typeof parseDiffSummary> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const running = useSyncExternalStore(store.subscribe, () => Boolean(store.getSnapshot().runningRunId), () => false);
  const loadSequence = useRef(0);

  const loadGit = useCallback(async (filePath?: string | null) => {
    if (!projectId) return;
    const sequence = ++loadSequence.current;
    try {
      const [gitSnap, total, fileDiff] = await Promise.all([
        fetchGitStatus(projectId),
        fetchGitDiff({ projectId, statOnly: true }),
        filePath ? fetchGitDiff({ projectId, filePath }) : null,
      ]);
      if (sequence === loadSequence.current) {
        const untracked = !!filePath && gitSnap.files.some((file) => file.path === filePath && file.untracked);
        if (untracked && filePath) {
          const source = await store.readProjectFile(projectId, filePath, AbortSignal.timeout(10000));
          if (sequence !== loadSequence.current) return;
          const lines = source.content ? source.content.replace(/\r?\n$/u, "").split(/\r?\n/u) : [];
          setDiff({ text: lines.map((line) => `+${line}`).join("\n"), truncated: source.truncated });
        } else {
          setDiff({ text: fileDiff?.diff ?? "", truncated: fileDiff?.truncated === true });
        }
        setStatus(gitSnap);
        setCounts(gitSnap.isGitRepo ? parseDiffSummary(total.stat) : null);
        setError("");
      }
    } catch (err) {
      if (sequence === loadSequence.current) setError(err instanceof Error ? err.message : String(err));
    }
  }, [projectId, store]);

  useEffect(() => {
    if (busy) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      await loadGit(selectedFile);
      if (active && running) timer = setTimeout(() => void refresh(), 2000);
    };
    void refresh();
    return () => { active = false; clearTimeout(timer); ++loadSequence.current; };
  }, [busy, loadGit, running, selectedFile]);

  const files = status?.files ?? [];
  const allDiffLines = diff?.text ? diff.text.split(/\r?\n/u) : [];
  const diffLines = allDiffLines.slice(0, 600);

  const handleStageToggle = async (filePath: string[] | "all", staged: boolean) => {
    setBusy(true);
    try {
      const next = staged && filePath !== "all" ? await postGitUnstage(projectId, filePath) : await postGitStage(projectId, filePath);
      setStatus(next);
      await loadGit(selectedFile);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (!projectId) {
    return <p className={styles.reviewEmpty}>{isZh ? "先绑定 Git 项目，再查看工作区变更。" : "Link a Git project to view working tree changes."}</p>;
  }

  return (
    <div className={styles.reviewRoot}>
      <div className={styles.reviewHeader}>
        <div className={styles.reviewHeaderLeft}>
          <span className={styles.reviewBranch}>
            <IconGitBranch size={13} aria-hidden="true" />
            <span>{status?.branch || (isZh ? "工作区变更" : "Workspace changes")}</span>
          </span>
          {counts && <><span className={styles.diffPlus}>+{counts.added}</span><span className={styles.diffMinus}>-{counts.removed}</span></>}
          {selectedFile && (
            <button type="button" className={styles.reviewChipBtn} onClick={() => setSelectedFile(null)}>
              {isZh ? "全部变更" : "All changes"}
            </button>
          )}
        </div>
        <div className={styles.reviewHeaderRight}>
          <button type="button" className={styles.reviewIconBtn} title={isZh ? "刷新 Git 状态" : "Refresh"} onClick={() => void loadGit(selectedFile)}>
            <IconRefresh size={13} />
          </button>
          {onOpenFullCodeReview && (
            <button type="button" className={styles.reviewChipBtn} onClick={onOpenFullCodeReview}>
              {isZh ? "完整代码审查" : "Full Review"}
            </button>
          )}
        </div>
      </div>

      {error && <div className={styles.reviewError}>{error}</div>}

      <div className={styles.reviewFilesHead}>
        <span>{isZh ? `变更文件 (${files.length})` : `Changed (${files.length})`}</span>
        {files.length > 0 && (
          <button
            type="button"
            className={styles.reviewChipBtn}
            disabled={busy}
            onClick={() => void handleStageToggle("all", false)}
          >
            {isZh ? "全部暂存" : "Stage all"}
          </button>
        )}
      </div>
      <div className={styles.reviewFilesList}>
        {!status ? (!error && <p className={styles.reviewEmpty}>{isZh ? "正在读取 Git 变更…" : "Loading Git changes…"}</p>) : files.length === 0 ? (
          <p className={styles.reviewEmpty}>{status.isGitRepo ? (isZh ? "工作区没有未提交变更。" : "Working tree clean.") : (status.error || (isZh ? "当前工作区尚未初始化 Git 仓库。" : "Not a Git repository."))}</p>
        ) : (
          files.map((file) => {
            const active = selectedFile === file.path;
            return (
              <div key={file.path}>
                <div className={`${styles.reviewFileRow} ${active ? styles.reviewFileRowActive : ""}`}>
                  <button
                    type="button"
                    className={styles.reviewFileBtn}
                    title={file.path}
                    aria-expanded={active}
                    onClick={() => { setDiff(null); setSelectedFile((prev) => (prev === file.path ? null : file.path)); }}
                  >
                    <IconChevronRight className={styles.reviewChevron} size={14} aria-hidden="true" />
                    <FileTypeIcon name={file.path} kind="file" />
                    <span className={styles.reviewFileName}>{file.path}</span>
                    <span className={styles.reviewStatusCode}>{file.displayCode || "M"}</span>
                  </button>
                  {projectId && (
                    <button
                      type="button"
                      className={styles.reviewMiniAction}
                      title={isZh ? "在代码查看器中打开" : "Open file"}
                      onClick={() => store.openWorkspaceFile(projectId, file.path, file.path)}
                    >
                      <IconCode size={12} />
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.reviewMiniAction}
                    disabled={busy}
                    title={file.staged ? (isZh ? "取消暂存" : "Unstage") : (isZh ? "暂存" : "Stage")}
                    onClick={() => void handleStageToggle([file.path], file.staged)}
                  >
                    {file.staged ? <IconCheck size={12} /> : <IconPlus size={12} />}
                  </button>
                </div>
                {active && (
                  <div className={styles.reviewDiffPane} role="region" aria-label={file.path}>
                    {!diff && !error && <p className={styles.reviewEmptySmall}>{isZh ? "正在读取文件差异…" : "Loading file diff…"}</p>}
                    {diff && diffLines.length === 0 && <p className={styles.reviewEmptySmall}>{isZh ? "此文件暂无可显示的文本差异。" : "No text diff for this file."}</p>}
                    {diffLines.length > 0 && (
                      <>
                        <div className={styles.diffCode}>
                          {diffLines.map((line, idx) => {
                            const kind = line.startsWith("+") && !line.startsWith("+++")
                              ? "add"
                              : line.startsWith("-") && !line.startsWith("---")
                                ? "del"
                                : line.startsWith("@@") || line.startsWith("diff ")
                                  ? "hunk"
                                  : "ctx";
                            return (
                              <div key={idx} className={styles.diffLine} data-diff-kind={kind}>
                                {line || "\u00A0"}
                              </div>
                            );
                          })}
                        </div>
                        {(diff?.truncated || allDiffLines.length > 600) && <p className={styles.reviewEmptySmall}>{isZh ? "差异预览已截断" : "Diff preview truncated"}</p>}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
