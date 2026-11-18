// 渲染内置代码审查工作台右侧面板：着色 Unified Diff 查看器、PR 草案预览与代码审查发现列表。
import type { CodeReviewReport } from "../coding-settings-client";
import styles from "./CodeReviewView.module.css";

/** 展示当前选中的差异、PR 草案或审查发现，右栏内容跟随清单选择切换。 */
export function CodeReviewDiffPane({
  isZh,
  diffTitle,
  diffText,
  diffStat,
  prDraft,
  activeReport,
  onSendReportToChat,
}: {
  isZh: boolean;
  diffTitle: string;
  diffText: string;
  diffStat: string;
  prDraft: { title: string; body: string; pushCommand: string } | null;
  activeReport: CodeReviewReport | null;
  onSendReportToChat: (report: CodeReviewReport) => void;
}) {
  const diffLines = diffText ? diffText.split(/\r?\n/u).slice(0, 400) : [];

  return (
    <div className={styles.panelCard}>
      {activeReport && (
        <section aria-label={isZh ? "最新代码审查结果" : "Latest Code Review"} style={{ display: "grid", gap: "0.5rem" }}>
          <div className={styles.panelHead}>
            <span className={styles.panelTitle}>
              {isZh ? "代码审查结果" : "Code Review Result"} · {activeReport.branch}
            </span>
            <button type="button" className={styles.miniBtn} onClick={() => onSendReportToChat(activeReport)}>
              {isZh ? "发送到聊天处理" : "Send to Chat"}
            </button>
          </div>
          <p className={styles.mutedText}>{activeReport.summary}</p>
          {activeReport.findings.map((finding) => (
            <div key={finding.id} className={styles.findingCard}>
              <div className={styles.panelHead}>
                <span
                  className={
                    finding.severity === "critical"
                      ? styles.sevCritical
                      : finding.severity === "warning"
                        ? styles.sevWarning
                        : styles.sevInfo
                  }
                >
                  {finding.severity.toUpperCase()} · {finding.title}
                </span>
                <span className={styles.statusTag}>
                  {finding.file}
                  {finding.line ? `:${finding.line}` : ""}
                </span>
              </div>
              <p className={styles.mutedText}>{finding.detail}</p>
              <p className={styles.mutedText}>
                {isZh ? "建议：" : "Fix: "}
                {finding.suggestion}
              </p>
            </div>
          ))}
        </section>
      )}

      {prDraft && (
        <section style={{ display: "grid", gap: "0.45rem" }}>
          <div className={styles.panelHead}>
            <span className={styles.panelTitle}>{isZh ? "Pull Request 草案" : "Pull Request Draft"}</span>
            <span className={styles.metaPill}>{prDraft.pushCommand}</span>
          </div>
          <div className={styles.findingCard}>
            <strong className={styles.panelTitle}>{prDraft.title}</strong>
            <pre className={styles.diffBox}>{prDraft.body}</pre>
          </div>
        </section>
      )}

      <div className={styles.panelHead}>
        <span className={styles.panelTitle}>
          {diffTitle || (isZh ? "工作区差异预览 (Diff)" : "Workspace Diff Preview")}
        </span>
        {diffStat && <span className={styles.mutedText}>{diffStat.split("\n").pop()}</span>}
      </div>

      {diffLines.length === 0 ? (
        <p className={styles.mutedText}>
          {isZh ? "当前选定文件或工作区暂无行级 Git Diff（未跟踪新文件可暂存后查看完整 Diff）。" : "No unified diff in selection."}
        </p>
      ) : (
        <pre className={styles.diffBox}>
          {diffLines.map((line, index) => {
            const cls = line.startsWith("+") && !line.startsWith("+++")
              ? styles.diffAdd
              : line.startsWith("-") && !line.startsWith("---")
                ? styles.diffDel
                : line.startsWith("@@")
                  ? styles.diffHunk
                  : undefined;
            return (
              <div key={`${index}-${line.slice(0, 12)}`} className={cls}>
                {line}
              </div>
            );
          })}
        </pre>
      )}
    </div>
  );
}
