// 右侧工作台 Git 变更列表，在文件行下方按需读取并展示真实差异。
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { IconArrowBackUp, IconCheck, IconChevronRight, IconCode, IconGitBranch, IconPlus, IconRefresh } from "@tabler/icons-react";
import type { ChatClientStore } from "../store/chat-store";
import {
  fetchGitDiff,
  fetchGitStatus,
  parseDiffSummary,
  postGitRevertFiles,
  postGitStage,
  postGitUnstage,
  type GitStatusSnapshot,
} from "../settings/coding-settings-client";
import { FileTypeIcon } from "@lfaa/ui-icons/client";
import styles from "./RightWorkbenchActions.module.css";
import reviewStyles from "./RightGitReviewPane.module.css";

export function RightGitReviewPane({
  isZh,
  projectId,
  sessionId,
  worktreeId,
  store,
  onOpenFullCodeReview,
}: {
  isZh: boolean;
  projectId: string | null;
  /** 传入时 Host 以该会话的工作树目录作为 Git 根。 */
  sessionId?: string;
  /** 当前会话绑定的工作树 id；打开代码文件时透传以指向工作树副本。 */
  worktreeId?: string | undefined;
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
        fetchGitStatus(projectId, sessionId),
        fetchGitDiff({ projectId, sessionId, statOnly: true }),
        filePath ? fetchGitDiff({ projectId, sessionId, filePath }) : null,
      ]);
      if (sequence === loadSequence.current) {
        setDiff({ text: fileDiff?.diff ?? "", truncated: fileDiff?.truncated === true });
        setStatus(gitSnap);
        setCounts(gitSnap.isGitRepo ? parseDiffSummary(total.stat) : null);
        setError("");
      }
    } catch (err) {
      if (sequence === loadSequence.current) setError(err instanceof Error ? err.message : String(err));
    }
  }, [projectId, sessionId, store]);

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
      const next = staged && filePath !== "all"
        ? await postGitUnstage(projectId, filePath, sessionId)
        : await postGitStage(projectId, filePath, sessionId);
      setStatus(next);
      await loadGit(selectedFile);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRevertFile = async (filePath: string) => {
    const confirmText = isZh
      ? `确定放弃「${filePath}」的未提交更改？此操作不可撤销。`
      : `Discard uncommitted changes to "${filePath}"? This cannot be undone.`;
    if (typeof window !== "undefined" && !window.confirm(confirmText)) return;
    setBusy(true);
    try {
      const res = await postGitRevertFiles(projectId, [filePath], sessionId);
      setStatus(res.status);
      if (selectedFile === filePath) setSelectedFile(null);
      await loadGit(selectedFile === filePath ? null : selectedFile);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (!projectId) {
    return <p className={reviewStyles.reviewEmpty}>{isZh ? "先绑定 Git 项目，再查看工作区变更。" : "Link a Git project to view working tree changes."}</p>;
  }

  return (
    <div className={reviewStyles.reviewRoot}>
      <div className={reviewStyles.reviewHeader}>
        <div className={reviewStyles.reviewHeaderLeft}>
          <span className={reviewStyles.reviewBranch}>
            <IconGitBranch size={13} aria-hidden="true" />
            <span>{status?.branch || (isZh ? "工作区变更" : "Workspace changes")}</span>
          </span>
          {counts && <><span className={styles.diffPlus}>+{counts.added}</span><span className={styles.diffMinus}>-{counts.removed}</span></>}
          {selectedFile && (
            <button type="button" className={reviewStyles.reviewChipBtn} onClick={() => setSelectedFile(null)}>
              {isZh ? "全部变更" : "All changes"}
            </button>
          )}
        </div>
        <div className={reviewStyles.reviewHeaderRight}>
          <button type="button" className={reviewStyles.reviewIconBtn} title={isZh ? "刷新 Git 状态" : "Refresh"} onClick={() => void loadGit(selectedFile)}>
            <IconRefresh size={13} />
          </button>
          {onOpenFullCodeReview && (
            <button type="button" className={reviewStyles.reviewChipBtn} onClick={onOpenFullCodeReview}>
              {isZh ? "完整代码审查" : "Full Review"}
            </button>
          )}
        </div>
      </div>

      {error && <div className={reviewStyles.reviewError}>{error}</div>}

      <div className={reviewStyles.reviewFilesHead}>
        <span>{isZh ? `变更文件 (${files.length})` : `Changed (${files.length})`}</span>
        {files.length > 0 && (
          <button
            type="button"
            className={reviewStyles.reviewChipBtn}
            disabled={busy}
            onClick={() => void handleStageToggle("all", false)}
          >
            {isZh ? "全部暂存" : "Stage all"}
          </button>
        )}
      </div>
      <div className={reviewStyles.reviewFilesList}>
        {!status ? (!error && <p className={reviewStyles.reviewEmpty}>{isZh ? "正在读取 Git 变更…" : "Loading Git changes…"}</p>) : files.length === 0 ? (
          <p className={reviewStyles.reviewEmpty}>{status.isGitRepo ? (isZh ? "工作区没有未提交变更。" : "Working tree clean.") : (status.error || (isZh ? "当前工作区尚未初始化 Git 仓库。" : "Not a Git repository."))}</p>
        ) : (
          files.map((file) => {
            const active = selectedFile === file.path;
            return (
              <div key={file.path}>
                <div className={`${reviewStyles.reviewFileRow} ${active ? reviewStyles.reviewFileRowActive : ""}`}>
                  <button
                    type="button"
                    className={reviewStyles.reviewFileBtn}
                    title={file.path}
                    aria-expanded={active}
                    onClick={() => { setDiff(null); setSelectedFile((prev) => (prev === file.path ? null : file.path)); }}
                  >
                    <IconChevronRight className={reviewStyles.reviewChevron} size={14} aria-hidden="true" />
                    <FileTypeIcon name={file.path} kind="file" />
                    <span className={reviewStyles.reviewFileName}>{file.path}</span>
                    <span className={reviewStyles.reviewStatusCode}>{file.displayCode || "M"}</span>
                  </button>
                  {projectId && (
                    <button
                      type="button"
                      className={reviewStyles.reviewMiniAction}
                      title={isZh ? "在代码查看器中打开" : "Open file"}
                      onClick={() => store.openWorkspaceFile(projectId, file.path, file.path, undefined, undefined, worktreeId)}
                    >
                      <IconCode size={12} />
                    </button>
                  )}
                  <button
                    type="button"
                    className={reviewStyles.reviewMiniAction}
                    disabled={busy}
                    title={isZh ? "放弃更改" : "Discard changes"}
                    aria-label={isZh ? `放弃 ${file.path} 的更改` : `Discard changes to ${file.path}`}
                    onClick={() => void handleRevertFile(file.path)}
                  >
                    <IconArrowBackUp size={12} />
                  </button>
                  <button
                    type="button"
                    className={reviewStyles.reviewMiniAction}
                    disabled={busy}
                    title={file.staged ? (isZh ? "取消暂存" : "Unstage") : (isZh ? "暂存" : "Stage")}
                    onClick={() => void handleStageToggle([file.path], file.staged)}
                  >
                    {file.staged ? <IconCheck size={12} /> : <IconPlus size={12} />}
                  </button>
                </div>
                {active && (
                  <div className={reviewStyles.reviewDiffPane} role="region" aria-label={file.path}>
                    {!diff && !error && <p className={reviewStyles.reviewEmptySmall}>{isZh ? "正在读取文件差异…" : "Loading file diff…"}</p>}
                    {diff && diffLines.length === 0 && <p className={reviewStyles.reviewEmptySmall}>{isZh ? "此文件暂无可显示的文本差异。" : "No text diff for this file."}</p>}
                    {diffLines.length > 0 && (
                      <>
                        <div className={reviewStyles.diffCode}>
                          {diffLines.map((line, idx) => {
                            const kind = line.startsWith("+") && !line.startsWith("+++")
                              ? "add"
                              : line.startsWith("-") && !line.startsWith("---")
                                ? "del"
                                : line.startsWith("@@") || line.startsWith("diff ")
                                  ? "hunk"
                                  : "ctx";
                            return (
                              <div key={idx} className={reviewStyles.diffLine} data-diff-kind={kind}>
                                {line || "\u00A0"}
                              </div>
                            );
                          })}
                        </div>
                        {(diff?.truncated || allDiffLines.length > 600) && <p className={reviewStyles.reviewEmptySmall}>{isZh ? "差异预览已截断" : "Diff preview truncated"}</p>}
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
