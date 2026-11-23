// 渲染内置代码审查工作台左侧清单面板：工作区变更暂存与提交、提交历史浏览及审查报告列表。
import type { CodeReviewReport, GitStatusSnapshot } from "@lfaa/client-ui-chat/client";
import styles from "./CodeReviewView.module.css";

/** 根据工作台标签显示已暂存和未暂存变更、提交记录或审查报告。 */
export function CodeReviewListPane({
  isZh,
  activeTab,
  status,
  reports,
  selectedFile,
  selectedCommit,
  activeReportId,
  commitMessage,
  busy,
  onInspectFile,
  onInspectCommit,
  onSelectReport,
  onStageToggle,
  onStageAll,
  onCommitMessageChange,
  onDraftCommit,
  onCommit,
  onRunCommitReview,
}: {
  isZh: boolean;
  activeTab: "cr-changes" | "cr-commits" | "cr-reports";
  status: GitStatusSnapshot | null;
  reports: CodeReviewReport[];
  selectedFile: string | null;
  selectedCommit: string | null;
  activeReportId: string | null;
  commitMessage: string;
  busy: boolean;
  onInspectFile: (filePath: string) => void;
  onInspectCommit: (hash: string) => void;
  onSelectReport: (report: CodeReviewReport) => void;
  onStageToggle: (filePath: string, staged: boolean) => void;
  onStageAll: () => void;
  onCommitMessageChange: (val: string) => void;
  onDraftCommit: () => void;
  onCommit: () => void;
  onRunCommitReview: (hash: string) => void;
}) {
  return (
    <div className={styles.panelCard}>
      {activeTab === "cr-changes" && (
        <>
          <div className={styles.panelHead}>
            <span className={styles.panelTitle}>{isZh ? "变更文件" : "Changed Files"}</span>
            {status && status.files.length > 0 && (
              <button type="button" className={styles.miniBtn} onClick={onStageAll}>
                {isZh ? "全部暂存" : "Stage All"}
              </button>
            )}
          </div>
          {!status?.isGitRepo ? (
            <p className={styles.mutedText}>{status?.error || (isZh ? "未检测到 Git 仓库。" : "Not a Git repository.")}</p>
          ) : status.files.length === 0 ? (
            <p className={styles.mutedText}>{isZh ? "工作区干净，暂无未提交改动。" : "Working tree clean."}</p>
          ) : (
            status.files.map((file) => (
              <div
                key={file.path}
                className={`${styles.fileRow} ${selectedFile === file.path ? styles.fileRowActive : ""}`}
                onClick={() => onInspectFile(file.path)}
              >
                <div className={styles.fileMain}>
                  <span className={styles.statusTag}>{file.displayCode}</span>
                  <span className={styles.fileName} title={file.path}>
                    {file.path.split("/").pop() || file.path}
                    {file.path.includes("/") && (
                      <span className={styles.fileDirHint}>
                        {file.path.slice(0, file.path.lastIndexOf("/"))}
                      </span>
                    )}
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.miniBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    onStageToggle(file.path, file.staged);
                  }}
                >
                  {file.staged ? (isZh ? "取消暂存" : "Unstage") : (isZh ? "暂存" : "Stage")}
                </button>
              </div>
            ))
          )}

          <div className={styles.commitArea}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>{isZh ? "提交变更 (Commit)" : "Commit Changes"}</span>
              <button type="button" className={styles.miniBtn} onClick={onDraftCommit}>
                {isZh ? "按指引生成" : "Auto Draft"}
              </button>
            </div>
            <textarea
              className={styles.textarea}
              value={commitMessage}
              placeholder={isZh ? "输入提交信息..." : "Commit message..."}
              onChange={(e) => onCommitMessageChange(e.target.value)}
            />
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={busy || !commitMessage.trim() || !status?.files.some((f) => f.staged)}
              onClick={onCommit}
            >
              <span>{isZh ? "提交已暂存更改" : "Commit Staged"}</span>
            </button>
          </div>
        </>
      )}

      {activeTab === "cr-commits" && (
        <>
          <div className={styles.panelHead}>
            <span className={styles.panelTitle}>{isZh ? "最近提交 (Git Log)" : "Recent Commits"}</span>
          </div>
          {(status?.commits ?? []).map((commit) => (
            <div
              key={commit.hash}
              className={`${styles.fileRow} ${selectedCommit === commit.hash ? styles.fileRowActive : ""}`}
              onClick={() => onInspectCommit(commit.hash)}
            >
              <div className={styles.fileMain}>
                <span className={styles.statusTag}>{commit.shortHash}</span>
                <span className={styles.fileName} title={commit.subject}>{commit.subject}</span>
              </div>
              <button
                type="button"
                className={styles.miniBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  onRunCommitReview(commit.hash);
                }}
              >
                {isZh ? "审查" : "Review"}
              </button>
            </div>
          ))}
        </>
      )}

      {activeTab === "cr-reports" && (
        <>
          <div className={styles.panelHead}>
            <span className={styles.panelTitle}>{isZh ? "历史审查报告" : "Review Reports"}</span>
          </div>
          {reports.length === 0 ? (
            <p className={styles.mutedText}>
              {isZh ? "暂无审查报告，点击右上角「运行代码审查」或输入 /review 即可生成。" : "No review reports yet."}
            </p>
          ) : (
            reports.map((rep) => (
              <div
                key={rep.id}
                className={`${styles.fileRow} ${activeReportId === rep.id ? styles.fileRowActive : ""}`}
                onClick={() => onSelectReport(rep)}
              >
                <div className={styles.fileMain}>
                  <span className={styles.statusTag}>{rep.findings.length}</span>
                  <span className={styles.fileName}>{rep.branch} · {rep.summary}</span>
                </div>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}
