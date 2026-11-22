// 渲染内置 Git 与代码审查工作台主界面：仓储分支管理、暂存提交、PR 草案、Diff 查看与代码审查报告。
import { useCallback, useEffect, useState } from "react";
import { IconGitBranch, IconPlus, IconRefresh, IconSettings, IconShieldCheck } from "@tabler/icons-react";
import { StatusBanner } from "@lfaa/ui-primitives/client";
import {
  fetchCodeReviewReports,
  fetchCodingSettings,
  fetchGitDiff,
  fetchGitStatus,
  postGitBranch,
  postGitCommit,
  postGitCommitDraft,
  postGitPrDraft,
  postGitStage,
  postGitUnstage,
  postRunCodeReview,
  type CodeReviewReport,
  type GitCodingSettings,
  type GitStatusSnapshot,
} from "@lfaa/chat/client";
import type { ChatClientStore } from "@lfaa/chat/client";
import type { ChatLocaleMessages } from "@lfaa/chat/client";
import { CodeReviewDiffPane } from "./CodeReviewDiffPane";
import { CodeReviewListPane } from "./CodeReviewListPane";
import styles from "./CodeReviewView.module.css";

/** 定义代码审查工作台的页面标签，左侧导航与中央视图共用。 */
export type CodeReviewDomainTab = "cr-changes" | "cr-commits" | "cr-reports";

/** 协调已选仓库、变更清单和差异预览，并将 Git 操作发往 Host。 */
export function CodeReviewView({
  locale,
  store,
  boundProjectId,
  boundSessionId,
  activeDomainItem,
  onSelectDomainItem,
  onOpenGitSettings,
  onOpenReviewSettings,
  onNavigateToChat,
}: {
  locale: ChatLocaleMessages;
  store: ChatClientStore;
  boundProjectId: string | null;
  /** 当前会话 id：绑定工作树时 Git 操作以工作树目录为准。 */
  boundSessionId?: string | undefined;
  activeDomainItem: string | null;
  onSelectDomainItem: (item: CodeReviewDomainTab) => void;
  onOpenGitSettings: () => void;
  onOpenReviewSettings: () => void;
  onNavigateToChat: () => void;
}) {
  const isZh = locale.isZh;
  const activeTab: CodeReviewDomainTab =
    activeDomainItem === "cr-commits" || activeDomainItem === "cr-reports" ? activeDomainItem : "cr-changes";

  const [status, setStatus] = useState<GitStatusSnapshot | null>(null);
  const [gitCfg, setGitCfg] = useState<GitCodingSettings | null>(null);
  const [reports, setReports] = useState<CodeReviewReport[]>([]);
  const [activeReport, setActiveReport] = useState<CodeReviewReport | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [diffText, setDiffText] = useState("");
  const [diffStat, setDiffStat] = useState("");
  const [commitMessage, setCommitMessage] = useState("");
  const [newBranchName, setNewBranchName] = useState("");
  const [prDraft, setPrDraft] = useState<{ title: string; body: string; pushCommand: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const loadWorkspace = useCallback(async () => {
    try {
      const [gitSnap, codingCfg, reportList, diffRes] = await Promise.all([
        fetchGitStatus(boundProjectId, boundSessionId),
        fetchCodingSettings(),
        fetchCodeReviewReports(),
        fetchGitDiff({ projectId: boundProjectId, sessionId: boundSessionId }),
      ]);
      setStatus(gitSnap);
      setGitCfg(codingCfg.git);
      setReports(reportList);
      if (reportList[0]) {
        setActiveReport((prev) => prev ?? reportList[0] ?? null);
      }
      setDiffText(diffRes.diff);
      setDiffStat(diffRes.stat);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    }
  }, [boundProjectId, boundSessionId]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const inspectFileDiff = async (filePath: string) => {
    setSelectedFile(filePath);
    setSelectedCommit(null);
    const res = await fetchGitDiff({ projectId: boundProjectId, sessionId: boundSessionId, filePath });
    setDiffText(res.diff);
    setDiffStat(res.stat);
  };

  const inspectCommitDiff = async (hash: string) => {
    setSelectedCommit(hash);
    setSelectedFile(null);
    const res = await fetchGitDiff({ projectId: boundProjectId, sessionId: boundSessionId, commitHash: hash });
    setDiffText(res.diff);
    setDiffStat(res.stat);
  };

  const handleStageToggle = async (filePath: string, currentlyStaged: boolean) => {
    setBusy(true);
    setNotice("");
    try {
      const next = currentlyStaged
        ? await postGitUnstage(boundProjectId, [filePath], boundSessionId)
        : await postGitStage(boundProjectId, [filePath], boundSessionId);
      setStatus(next);
      const diffRes = await fetchGitDiff({ projectId: boundProjectId, sessionId: boundSessionId, filePath });
      setDiffText(diffRes.diff);
      setDiffStat(diffRes.stat);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleStageAll = async () => {
    setBusy(true);
    setNotice("");
    try {
      const next = await postGitStage(boundProjectId, "all", boundSessionId);
      setStatus(next);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleBranchSwitch = async (name: string, create = false) => {
    if (!name.trim()) return;
    setBusy(true);
    setNotice("");
    try {
      const next = await postGitBranch({ projectId: boundProjectId, sessionId: boundSessionId, name: name.trim(), create });
      setStatus(next);
      setNewBranchName("");
      setNotice(isZh ? `已切换至分支 ${next.branch}` : `Checked out ${next.branch}`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDraftCommit = async () => {
    setBusy(true);
    try {
      const draft = await postGitCommitDraft(boundProjectId, boundSessionId);
      setCommitMessage(draft.message);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) return;
    setBusy(true);
    setNotice("");
    try {
      const res = await postGitCommit(boundProjectId, commitMessage.trim(), boundSessionId);
      setStatus(res.status);
      setCommitMessage("");
      setNotice(isZh ? `已提交 ${res.commitHash}` : `Committed ${res.commitHash}`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handlePrDraft = async () => {
    setBusy(true);
    try {
      const draft = await postGitPrDraft(boundProjectId, boundSessionId);
      setPrDraft(draft);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRunReview = async (scope: "working_tree" | "commit", commitHash?: string) => {
    setBusy(true);
    setNotice("");
    try {
      const report = await postRunCodeReview({
        projectId: boundProjectId,
        scope,
        ...(commitHash ? { commitHash } : {}),
      });
      setActiveReport(report);
      setReports((prev) => [report, ...prev.filter((r) => r.id !== report.id)]);
      setNotice(report.summary);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSendReportToChat = async (report: CodeReviewReport) => {
    const mode = gitCfg?.reviewDisplayMode ?? "inline";
    if (mode === "separate") {
      store.startNewChatDraft({ projectId: boundProjectId });
    }
    const details = report.findings
      .slice(0, 8)
      .map((f, idx) => `${idx + 1}. [${f.severity}] ${f.file}${f.line ? `:${f.line}` : ""} ${f.title} — ${f.suggestion}`)
      .join("\n");
    const prompt = `请根据以下内置代码审查结果（仓库 ${report.repoSlug}，分支 ${report.branch}）给出修复建议并协助处理：\n${report.summary}${details ? `\n\n${details}` : ""}`;
    onNavigateToChat();
    await store.sendMessage(prompt);
  };

  return (
    <section className={styles.root} aria-label={isZh ? "代码审查与内置 Git" : "Built-in Git & Code Review"}>
      <header className={styles.topBar}>
        <div className={styles.titleRow}>
          <div className={styles.titleLeft}>
            <h1 className={styles.title}>{isZh ? "内置 Git 与代码审查" : "Built-in Git & Code Review"}</h1>
            {status?.isGitRepo && (
              <>
                <span className={styles.metaPill}>{status.repoSlug}</span>
                <span className={styles.metaPill}>
                  <IconGitBranch size={13} stroke={1.9} />
                  {status.branch}
                </span>
              </>
            )}
          </div>
          <div className={styles.actionsRow}>
            <button type="button" className={styles.btn} onClick={() => void loadWorkspace()} disabled={busy}>
              <IconRefresh size={14} stroke={1.8} />
              <span>{isZh ? "刷新" : "Refresh"}</span>
            </button>
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={busy || !status?.isGitRepo}
              onClick={() => void handleRunReview(selectedCommit ? "commit" : "working_tree", selectedCommit ?? undefined)}
            >
              <IconShieldCheck size={14} stroke={1.8} />
              <span>{isZh ? "运行代码审查" : "Run Code Review"}</span>
            </button>
            <button type="button" className={styles.btn} onClick={onOpenGitSettings}>
              <IconSettings size={14} stroke={1.8} />
              <span>{isZh ? "Git 设置" : "Git Settings"}</span>
            </button>
            <button type="button" className={styles.btn} onClick={onOpenReviewSettings}>
              <span>{isZh ? "审查偏好" : "Review Settings"}</span>
            </button>
          </div>
        </div>

        {status?.isGitRepo && (
          <div className={styles.branchBar}>
            <select
              className={styles.select}
              aria-label={isZh ? "切换分支" : "Switch Branch"}
              value={status.branch}
              onChange={(e) => void handleBranchSwitch(e.target.value, false)}
            >
              {status.branches.map((b) => (
                <option key={b.name} value={b.name}>{b.name}</option>
              ))}
            </select>
            <input
              type="text"
              className={styles.input}
              value={newBranchName}
              placeholder={isZh ? `新分支名（自动加前缀 ${gitCfg?.branchPrefix ?? "lfaa/"}）` : `New branch (${gitCfg?.branchPrefix ?? "lfaa/"})`}
              onChange={(e) => setNewBranchName(e.target.value)}
            />
            <button
              type="button"
              className={styles.btn}
              disabled={busy || !newBranchName.trim()}
              onClick={() => void handleBranchSwitch(newBranchName, true)}
            >
              <IconPlus size={14} stroke={1.8} />
              <span>{isZh ? "创建并切换分支" : "Create Branch"}</span>
            </button>
            <button type="button" className={styles.btn} disabled={busy} onClick={() => void handlePrDraft()}>
              <span>{isZh ? "生成 PR 草案" : "Draft PR"}</span>
            </button>
          </div>
        )}
        {notice && (
          <StatusBanner
            tone="info"
            message={notice}
            onDismiss={() => setNotice("")}
          />
        )}
      </header>

      <nav className={styles.tabStrip} aria-label={isZh ? "代码审查视图切换" : "Review Tabs"}>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === "cr-changes" ? styles.tabBtnActive : ""}`}
          onClick={() => onSelectDomainItem("cr-changes")}
        >
          <span>{isZh ? `工作区变更 (${status?.files.length ?? 0})` : `Changes (${status?.files.length ?? 0})`}</span>
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === "cr-commits" ? styles.tabBtnActive : ""}`}
          onClick={() => onSelectDomainItem("cr-commits")}
        >
          <span>{isZh ? `提交历史 (${status?.commits.length ?? 0})` : `Commits (${status?.commits.length ?? 0})`}</span>
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === "cr-reports" ? styles.tabBtnActive : ""}`}
          onClick={() => onSelectDomainItem("cr-reports")}
        >
          <span>{isZh ? `审查报告 (${reports.length})` : `Reports (${reports.length})`}</span>
        </button>
      </nav>

      <div className={styles.splitGrid}>
        <CodeReviewListPane
          isZh={isZh}
          activeTab={activeTab}
          status={status}
          reports={reports}
          selectedFile={selectedFile}
          selectedCommit={selectedCommit}
          activeReportId={activeReport?.id ?? null}
          commitMessage={commitMessage}
          busy={busy}
          onInspectFile={(filePath) => void inspectFileDiff(filePath)}
          onInspectCommit={(hash) => void inspectCommitDiff(hash)}
          onSelectReport={(rep) => setActiveReport(rep)}
          onStageToggle={(filePath, staged) => void handleStageToggle(filePath, staged)}
          onStageAll={() => void handleStageAll()}
          onCommitMessageChange={setCommitMessage}
          onDraftCommit={() => void handleDraftCommit()}
          onCommit={() => void handleCommit()}
          onRunCommitReview={(hash) => void handleRunReview("commit", hash)}
        />

        <CodeReviewDiffPane
          isZh={isZh}
          diffTitle={selectedCommit ? `Commit ${selectedCommit.slice(0, 7)}` : selectedFile || ""}
          diffText={diffText}
          diffStat={diffStat}
          prDraft={prDraft}
          activeReport={activeReport}
          onSendReportToChat={(report) => void handleSendReportToChat(report)}
        />
      </div>
    </section>
  );
}
