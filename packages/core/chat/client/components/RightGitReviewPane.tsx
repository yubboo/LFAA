// 右侧工作台「审查」标签页视图（图九）：同屏呈现 Git 分支统计、多文件 Unified Diff 与右侧变更文件清单（支持暂存/取消暂存及跳转到代码视图）。
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { IconCheck, IconCode, IconGitBranch, IconPlus, IconRefresh } from "@tabler/icons-react";
import type { ChatClientStore } from "../chat-store";
import {
  fetchGitDiff,
  fetchGitStatus,
  postGitStage,
  postGitUnstage,
  type GitStatusSnapshot,
} from "../coding-settings-client";
import { FileTypeIcon } from "./file-icons";
import styles from "./RightWorkbenchActions.module.css";

function countDiffLines(diffText: string): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const line of diffText.split(/\r?\n/u)) {
    if (line.startsWith("+") && !line.startsWith("+++")) added += 1;
    else if (line.startsWith("-") && !line.startsWith("---")) removed += 1;
  }
  return { added, removed };
}

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
  const [diffText, setDiffText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const running = useSyncExternalStore(store.subscribe, () => Boolean(store.getSnapshot().runningRunId), () => false);
  const loadSequence = useRef(0);

  const loadGit = useCallback(async (filePath?: string | null) => {
    const sequence = ++loadSequence.current;
    try {
      const [gitSnap, diffRes] = await Promise.all([
        fetchGitStatus(projectId),
        fetchGitDiff({ projectId, ...(filePath ? { filePath } : {}) }),
      ]);
      if (sequence === loadSequence.current) {
        setStatus(gitSnap);
        setDiffText(diffRes.diff);
        setError("");
      }
    } catch (err) {
      if (sequence === loadSequence.current) setError(err instanceof Error ? err.message : String(err));
    }
  }, [projectId]);

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

  const counts = countDiffLines(diffText);
  const files = status?.files ?? [];
  const diffLines = diffText ? diffText.split(/\r?\n/u).slice(0, 600) : [];

  const handleStageToggle = async (filePath: string[] | "all", staged: boolean) => {
    setBusy(true);
    try {
      const next = staged && filePath !== "all" ? await postGitUnstage(projectId, filePath) : await postGitStage(projectId, filePath);
      setStatus(next);
      const diffRes = await fetchGitDiff({ projectId, ...(selectedFile ? { filePath: selectedFile } : {}) });
      setDiffText(diffRes.diff);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.reviewRoot}>
      <div className={styles.reviewHeader}>
        <div className={styles.reviewHeaderLeft}>
          <span className={styles.reviewBranch}>
            <IconGitBranch size={13} aria-hidden="true" />
            <span>{status?.branch || (isZh ? "未提交变更" : "Uncommitted")}</span>
          </span>
          <span className={styles.diffPlus}>+{counts.added}</span>
          <span className={styles.diffMinus}>-{counts.removed}</span>
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

      <div className={styles.reviewSplit}>
        <div className={styles.reviewDiffPane}>
          {diffLines.length === 0 ? (
            <div className={styles.reviewEmpty}>
              {!status?.isGitRepo
                ? (status?.error || (isZh ? "当前工作区尚未初始化 Git 仓库。" : "Not a Git repository."))
                : files.length > 0
                  ? (isZh ? "此视图暂无差异文本。可从变更文件列表打开源码。" : "No diff text here. Open a changed file to view its source.")
                  : (isZh ? "工作区干净，暂无未提交 Diff。" : "Working tree clean.")}
            </div>
          ) : (
            <pre className={styles.diffCode}>
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
            </pre>
          )}
        </div>

        <aside className={styles.reviewFilesPane} aria-label={isZh ? "Git 变更文件" : "Changed files"}>
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
            {files.length === 0 ? (
              <div className={styles.reviewEmptySmall}>{isZh ? "无变更文件" : "No modified files"}</div>
            ) : (
              files.map((file) => {
                const name = file.path.split("/").pop() || file.path;
                const active = selectedFile === file.path;
                return (
                  <div key={file.path} className={`${styles.reviewFileRow} ${active ? styles.reviewFileRowActive : ""}`}>
                    <button
                      type="button"
                      className={styles.reviewFileBtn}
                      title={file.path}
                      onClick={() => setSelectedFile((prev) => (prev === file.path ? null : file.path))}
                    >
                      <FileTypeIcon name={name} kind="file" />
                      <span className={styles.reviewFileName}>{name}</span>
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
                );
              })
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
