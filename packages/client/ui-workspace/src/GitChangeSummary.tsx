/**
 * 功能：显示当前 AI Work 项目的真实 Git 差异和受管 Worktree 恢复入口。
 * 作用：差异由目标 Daemon 的 Git 状态 API 提供；组件不接受模型生成的摘要。
 * 不负责：源项目修改、提交、推送、合并或远端 Pull Request。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Checkbox, Modal, Popconfirm, Spin, Tag } from "antd";
import { getErrorMessage, loadWorkspaceGitStatus, resetWorkspaceGitWorktree, type WorkspaceGitStatus, type WorkspaceProject, type WorkspaceProjectApplicationId } from "lfaa-client-connection/src/api.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import { GitChangeReview } from "./GitChangeReview.js";

interface GitChangeSummaryProps {
  appId: WorkspaceProjectApplicationId;
  project: WorkspaceProject | null;
  refreshRevision: number;
}

function statusLabel(status: string): string {
  if (status === "??" || status === "A") return "新增";
  if (status === "D") return "删除";
  if (status === "R") return "重命名";
  if (status === "C") return "已提交差异";
  if (status.includes("M")) return "修改";
  return status.trim() || "变更";
}

function shortCommit(value: string): string {
  return value.slice(0, 8);
}

export function GitChangeSummary({ appId, project, refreshRevision }: GitChangeSummaryProps) {
  const [status, setStatus] = useState<WorkspaceGitStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewPath, setReviewPath] = useState("");
  const [showAllFiles, setShowAllFiles] = useState(false);
  const [error, setError] = useState("");
  const requestRevision = useRef(0);

  const refresh = useCallback(async (projectId: string, alive?: () => boolean): Promise<void> => {
    const revision = ++requestRevision.current;
    setLoading(true);
    setError("");
    try {
      const result = await loadWorkspaceGitStatus(projectId, appId);
      if (requestRevision.current !== revision || alive && !alive()) return;
      setStatus(result.status);
    } catch (loadError) {
      if (requestRevision.current === revision && (!alive || alive())) setError(getErrorMessage(loadError));
    } finally { if (requestRevision.current === revision && (!alive || alive())) setLoading(false); }
  }, [appId]);

  useEffect(() => {
    let active = true;
    setStatus(null);
    if (!project) {
      setError("");
      setLoading(false);
      return () => { active = false; };
    }
    void refresh(project.id, () => active);
    return () => { active = false; };
  }, [project?.id, refreshRevision, refresh]);

  async function reset(): Promise<void> {
    if (!project?.gitWorktree || !resetConfirmed) return;
    setActionBusy(true);
    setError("");
    try {
      const result = await resetWorkspaceGitWorktree(project.id, appId);
      requestRevision.current += 1;
      setStatus(result.status);
      setReviewOpen(false);
      setResetOpen(false);
      setResetConfirmed(false);
    } catch (resetError) { setError(getErrorMessage(resetError)); }
    finally { setActionBusy(false); }
  }

  return <section className="module-context__git" aria-label="Git 变更摘要">
    <header className="module-context__git-heading">
      <div><strong>变更摘要</strong><span>由 Daemon Git 状态生成</span></div>
      {project ? <Button type="text" size="small" aria-label="刷新 Git 状态" title="刷新 Git 状态" disabled={loading || actionBusy} onClick={() => void refresh(project.id)} icon={<WorkbenchIcon name="refresh" size={14} />} /> : null}
    </header>
    {!project ? <p className="module-context__git-empty">选择项目后显示真实 Git 状态和差异。</p> : null}
    {loading && !status ? <div className="module-context__git-loading"><Spin size="small" /><span>读取 Git 状态…</span></div> : null}
    {error ? <Alert className="module-context__git-error" type="warning" showIcon message={error} /> : null}
    {project && status ? <>
      <div className="module-context__git-branch"><WorkbenchIcon name="file" size={14} /><code title={status.branch}>{status.branch}</code><Tag>{status.worktreeId ? "AI Worktree" : "源项目"}</Tag></div>
      <div className="module-context__git-baseline">{status.worktreeId ? `恢复基线 ${shortCommit(status.baseline)}` : `HEAD ${shortCommit(status.head)}`}</div>
      <div className="module-context__git-stats">
        <span>{status.changedFileCount} 个文件</span><span className="is-added">+{status.insertions}</span><span className="is-removed">−{status.deletions}</span>
        {status.unknownLineCounts ? <small>{status.unknownLineCounts} 个二进制或大文件未统计行数</small> : null}
      </div>
      {status.clean ? <p className="module-context__git-empty">工作区干净，暂无相对基线的改动。</p> : <>
        <ul className="module-context__git-files" aria-label="变更文件">
          {status.files.slice(0, showAllFiles ? status.files.length : 5).map((file) => <li key={file.path} title={file.displayPath}>
            <span className="module-context__git-file-status">{statusLabel(file.status)}</span>
            <button type="button" className="module-context__git-file-button" onClick={() => { setReviewPath(file.path); setReviewOpen(true); }}><code>{file.displayPath}</code></button>
            <span className="is-added">{file.insertions === null ? "·" : `+${file.insertions}`}</span><span className="is-removed">{file.deletions === null ? "·" : `−${file.deletions}`}</span>
          </li>)}
        </ul>
        {status.files.length > 5 ? <Button className="module-context__git-show-all" size="small" type="text" onClick={() => setShowAllFiles(value => !value)}>{showAllFiles ? "收起文件" : `再显示 ${status.files.length - 5} 个文件`} <WorkbenchIcon name="chevron" size={13} /></Button> : null}
        {status.statusTruncated ? <p className="module-context__git-truncated">仅返回前 {status.shownFileCount} 个文件。</p> : null}
        <Button className="module-context__git-review" size="small" onClick={() => { setReviewPath(status.files[0]?.path ?? ""); setReviewOpen(true); }}>查看全部变更</Button>
      </>}
      {project.gitWorktree ? <Popconfirm title="恢复到 AI Worktree 基线？" description="会撤销这棵隔离工作树中的已跟踪改动和非忽略未跟踪文件。源项目、忽略文件及其他工作树不受影响。" okText="继续恢复" cancelText="取消" onConfirm={() => { setResetConfirmed(false); setResetOpen(true); }}>
        <Button className="module-context__git-reset" size="small" danger disabled={actionBusy}>{actionBusy ? "正在恢复…" : "恢复 AI Worktree"}</Button>
      </Popconfirm> : null}
    </> : null}
    <Modal title="确认恢复 AI Worktree" open={resetOpen} onCancel={() => { if (!actionBusy) { setResetOpen(false); setResetConfirmed(false); } }} onOk={() => void reset()} okText="恢复到基线" cancelText="保留当前改动" okButtonProps={{ danger: true, disabled: !resetConfirmed }} confirmLoading={actionBusy} closable={!actionBusy} maskClosable={!actionBusy}>
      <p>此操作只重置此 AI Worktree 到 <code>{project?.gitWorktree?.baseCommit.slice(0, 8)}</code>，并删除其中非忽略的未跟踪文件。已忽略文件会保留，源项目不变。</p>
      <Checkbox checked={resetConfirmed} onChange={event => setResetConfirmed(event.target.checked)}>我确认丢弃此 AI Worktree 的当前改动</Checkbox>
    </Modal>
    {project && status ? <GitChangeReview appId={appId} project={project} status={status} initialPath={reviewPath} open={reviewOpen} onClose={() => setReviewOpen(false)} onRefresh={() => refresh(project.id)} /> : null}
  </section>;
}
