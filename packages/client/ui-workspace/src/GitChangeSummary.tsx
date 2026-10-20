/**
 * 功能：显示当前 AI Work 项目的真实 Git 差异、受管 Worktree 恢复入口和活动文件审阅桥接。
 * 作用：差异由 LFAA 本机 Git Owner 读取完整仓库根；活动桥接核对 Agent 项目路径后复用 GitChangeReview。
 * 不负责：自动提交、强制覆盖、远端 PR 或凭据明文持久化。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Checkbox, Input, Modal, Popconfirm, Select, Spin, Tag } from "antd";
import { getErrorMessage, loadWorkspaceGitStatus, removeAgentGitRemoteCredential, resetWorkspaceGitWorktree, runAgentGitOperation, runWorkspaceGitOperation, saveAgentGitRemoteCredential, type WorkspaceGitBranch, type WorkspaceGitCommit, type WorkspaceGitOperationInput, type WorkspaceGitStatus, type WorkspaceProject, type WorkspaceProjectApplicationId } from "lfaa-client-connection/src/api.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import { GitChangeReview } from "./GitChangeReview.js";

interface GitChangeSummaryProps {
  appId?: WorkspaceProjectApplicationId;
  project?: WorkspaceProject | null;
  repositoryId?: string | null;
  repositoryTitle?: string;
  status: WorkspaceGitStatus | null;
  loading: boolean;
  loadError: string;
  onRefresh: () => Promise<void>;
  onStatusChange: (status: WorkspaceGitStatus) => void;
  embedded?: boolean;
}

function statusLabel(status: string): string {
  if (status === "??") return "未跟踪";
  if (status === "C") return "已提交差异";
  const staged = status[0] !== " ";
  const unstaged = status[1] !== " ";
  if (staged && unstaged) return "部分暂存";
  if (staged) return "已暂存";
  if (unstaged) return "未暂存";
  return "变更";
}

function shortCommit(value: string): string {
  return value.slice(0, 8);
}

export function GitChangeSummary({ appId, project = null, repositoryId = null, repositoryTitle = "", status, loading, loadError, onRefresh, onStatusChange, embedded = false }: GitChangeSummaryProps) {
  const [actionBusy, setActionBusy] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const [metadataMode, setMetadataMode] = useState<"history" | "branches" | null>(null);
  const [history, setHistory] = useState<WorkspaceGitCommit[]>([]);
  const [branches, setBranches] = useState<WorkspaceGitBranch[]>([]);
  const [branchName, setBranchName] = useState("");
  const [selectedRemote, setSelectedRemote] = useState("");
  const [newRemoteName, setNewRemoteName] = useState("origin");
  const [newRemoteUrl, setNewRemoteUrl] = useState("");
  const [remoteUsername, setRemoteUsername] = useState("");
  const [remoteToken, setRemoteToken] = useState("");
  const [remoteModalMode, setRemoteModalMode] = useState<"add" | "credential">("add");
  const [remoteModalOpen, setRemoteModalOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(embedded);
  const [reviewPath, setReviewPath] = useState("");
  const [showAllFiles, setShowAllFiles] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setCommitMessage("");
    setMetadataMode(null);
    setHistory([]);
    setBranches([]);
    setBranchName("");
    setSelectedRemote("");
  }, [project?.id]);

  useEffect(() => {
    if (status?.remotes.length) {
      setSelectedRemote(current => status.remotes.includes(current) ? current : status.remotes[0] ?? "");
    } else {
      setSelectedRemote("");
    }
  }, [status?.repository, status?.remotes.join("\u0000")]);

  async function reset(): Promise<void> {
    if (!project?.gitWorktree || !appId || !resetConfirmed) return;
    setActionBusy(true);
    setError("");
    try {
      const result = await resetWorkspaceGitWorktree(project.id, appId);
      onStatusChange(result.status);
      setReviewOpen(false);
      setResetOpen(false);
      setResetConfirmed(false);
    } catch (resetError) { setError(getErrorMessage(resetError)); }
    finally { setActionBusy(false); }
  }

  async function operate(input: WorkspaceGitOperationInput): Promise<void> {
    if (!project && !repositoryId) return;
    setActionBusy(true);
    setError("");
    try {
      const result = repositoryId ? await runAgentGitOperation(repositoryId, input) : await runWorkspaceGitOperation(project!.id, appId!, input);
      if ("status" in result) onStatusChange(result.status);
      else if ("commits" in result) setHistory(result.commits);
      else setBranches(result.branches);
      if (input.operation === "remote-add") {
        setRemoteModalOpen(false);
        setNewRemoteName("origin");
        setNewRemoteUrl("");
        setRemoteUsername("");
        setRemoteToken("");
      }
      if (input.operation === "commit") setCommitMessage("");
      if (input.operation.startsWith("branch-")) {
        await onRefresh();
        const listed = repositoryId ? await runAgentGitOperation(repositoryId, { operation: "branches" }) : await runWorkspaceGitOperation(project!.id, appId!, { operation: "branches" });
        if ("branches" in listed) setBranches(listed.branches);
      }
    } catch (operationError) { setError(getErrorMessage(operationError)); }
    finally { setActionBusy(false); }
  }

  async function openMetadata(mode: "history" | "branches"): Promise<void> {
    setMetadataMode(mode);
    if (mode === "history") await operate({ operation: "history", limit: 30 });
    else await operate({ operation: "branches" });
  }

  async function submitRemoteModal(): Promise<void> {
    if (!repositoryId) return;
    setActionBusy(true);
    setError("");
    try {
      if (remoteModalMode === "add") {
        const hasUsername = Boolean(remoteUsername.trim());
        const hasToken = Boolean(remoteToken);
        if (hasUsername !== hasToken) { setError("HTTPS 用户名和访问令牌需要同时填写。"); return; }
        await operate({ operation: "remote-add", remote: newRemoteName.trim(), url: newRemoteUrl.trim(), ...(hasUsername ? { username: remoteUsername.trim(), token: remoteToken } : {}) });
      } else {
        if (!remoteUsername.trim() || !remoteToken) return;
        await saveAgentGitRemoteCredential(repositoryId, selectedRemote, remoteUsername.trim(), remoteToken);
        setRemoteModalOpen(false);
        setRemoteUsername("");
        setRemoteToken("");
        await onRefresh();
      }
    } catch (credentialError) { setError(getErrorMessage(credentialError)); }
    finally { setActionBusy(false); }
  }

  async function removeRemoteCredential(): Promise<void> {
    if (!repositoryId || !selectedRemote) return;
    setActionBusy(true);
    setError("");
    try { await removeAgentGitRemoteCredential(repositoryId, selectedRemote); await onRefresh(); }
    catch (credentialError) { setError(getErrorMessage(credentialError)); }
    finally { setActionBusy(false); }
  }

  const stageableFiles = status?.files.filter(file => file.status !== "C") ?? [];
  const hasUnstaged = stageableFiles.some(file => file.status === "??" || file.status[1] !== " ");
  const hasStaged = stageableFiles.some(file => file.status[0] !== " " && file.status !== "??");
  const upstreamRemote = status?.upstream?.split("/", 1)[0] ?? "";
  const canSyncSelectedRemote = Boolean(selectedRemote && status?.syncCapableRemotes?.includes(selectedRemote));
  const canSyncUpstream = Boolean(upstreamRemote && status?.syncCapableRemotes?.includes(upstreamRemote));

  return <section className={`module-context__git${embedded ? " is-embedded" : ""}`} aria-label="Git 变更管理">
    <header className="module-context__git-heading">
      <div><strong>Git 变更</strong><span>由 LFAA 本机 Git 管理器读取</span></div>
      {project || repositoryId ? <Button type="text" size="small" aria-label="刷新 Git 状态" title="刷新 Git 状态" disabled={loading || actionBusy} onClick={() => void onRefresh()} icon={<WorkbenchIcon name="refresh" size={14} />} /> : null}
    </header>
    {!project && !repositoryId ? <p className="module-context__git-empty">选择 Agent Git 仓库后显示真实状态与差异。</p> : null}
    {loading && !status ? <div className="module-context__git-loading"><Spin size="small" /><span>读取 Git 状态…</span></div> : null}
    {error || loadError ? <Alert className="module-context__git-error" type="warning" showIcon message={error || loadError} /> : null}
    {(project || repositoryId) && status?.repositoryState === "not-repository" ? <p className="module-context__git-empty">项目已随当前 Agent 会话关联。首次获准创建或写入文件时会自动初始化 Git；查看摘要和聊天不会改动项目目录。</p> : null}
    {(project || repositoryId) && status ? <>
      {status.repositoryState !== "not-repository" ? <>
      <div className="module-context__git-branch"><WorkbenchIcon name="branch" size={14} /><code title={status.upstream ? `${status.branch} → ${status.upstream}` : status.branch}>{status.branch}{status.upstream ? ` → ${status.upstream}` : ""}</code><Tag>{status.worktreeId ? "AI Worktree" : "仓库"}</Tag>{status.upstream ? <span className="module-context__git-ahead-behind"><b>↑{status.ahead}</b><i>↓{status.behind}</i></span> : null}</div>
      <div className="module-context__git-baseline">{status.worktreeId ? `恢复基线 ${status.baseline ? shortCommit(status.baseline) : "待建立"}` : status.head ? `HEAD ${shortCommit(status.head)}` : "仓库已初始化，尚无首次提交"}</div>
      {status.repositoryState === "unborn" ? <p className="module-context__git-empty">这是一个尚无提交记录的新仓库；当前新增文件会按真实 Git 状态列出。</p> : null}
      <div className="module-context__git-stats">
        <span>{status.changedFileCount} 个文件</span><span className="is-added">+{status.insertions}</span><span className="is-removed">−{status.deletions}</span>
        {status.unknownLineCounts ? <small>{status.unknownLineCounts} 个二进制或大文件未统计行数</small> : null}
      </div>
      <div className="module-context__git-actions">
        <Button size="small" disabled={!hasUnstaged || actionBusy} onClick={() => void operate({ operation: "stage" })}>暂存全部变更</Button>
        <Button size="small" disabled={!hasStaged || actionBusy} onClick={() => void operate({ operation: "unstage" })}>取消全部暂存</Button>
      </div>
      {!embedded && status.clean ? <p className="module-context__git-empty">工作区干净，暂无相对基线的改动。</p> : null}
      {!embedded && !status.clean ? <>
        <ul className="module-context__git-files" aria-label="变更文件">
          {status.files.slice(0, showAllFiles ? status.files.length : 5).map((file) => <li key={file.path} title={file.displayPath}>
            <span className="module-context__git-file-status">{statusLabel(file.status)}</span>
            <button type="button" className="module-context__git-file-button" onClick={() => { setReviewPath(file.path); setReviewOpen(true); }}><code>{file.displayPath}</code></button>
            <span className="is-added">{file.insertions === null ? "·" : `+${file.insertions}`}</span><span className="is-removed">{file.deletions === null ? "·" : `−${file.deletions}`}</span>
            <span className="module-context__git-file-actions">
              {(file.status === "??" || file.status[1] !== " ") && file.status !== "C" ? <Button size="small" type="text" disabled={actionBusy} onClick={() => void operate({ operation: "stage", paths: [file.path] })}>暂存</Button> : null}
              {file.status !== "??" && file.status !== "C" && file.status[0] !== " " ? <Button size="small" type="text" disabled={actionBusy} onClick={() => void operate({ operation: "unstage", paths: [file.path] })}>取消暂存</Button> : null}
            </span>
          </li>)}
        </ul>
        {status.files.length > 5 ? <Button className="module-context__git-show-all" size="small" type="text" onClick={() => setShowAllFiles(value => !value)}>{showAllFiles ? "收起文件" : `再显示 ${status.files.length - 5} 个文件`} <WorkbenchIcon name="chevron" size={13} /></Button> : null}
        {status.statusTruncated ? <p className="module-context__git-truncated">仅返回前 {status.shownFileCount} 个文件。</p> : null}
        <Button className="module-context__git-review" size="small" onClick={() => { setReviewPath(status.files[0]?.path ?? ""); setReviewOpen(true); }}>查看全部变更</Button>
      </> : null}
      <div className="module-context__git-commit">
        <Input.TextArea aria-label="提交信息" value={commitMessage} maxLength={5000} autoSize={{ minRows: 2, maxRows: 4 }} placeholder="提交信息；提交前请先暂存变更" onChange={event => setCommitMessage(event.target.value)} />
        <Button type="primary" size="small" disabled={!commitMessage.trim() || !hasStaged || actionBusy} onClick={() => void operate({ operation: "commit", message: commitMessage })}>提交暂存的变更</Button>
      </div>
      <div className="module-context__git-actions">
        <Button size="small" disabled={actionBusy} onClick={() => void openMetadata("history")}>提交历史</Button>
        <Button size="small" disabled={actionBusy || Boolean(status.worktreeId)} onClick={() => void openMetadata("branches")}>分支</Button>
      </div>
      {repositoryId && !status.worktreeId ? <section className="module-context__git-remote" aria-label="Git 远端同步">
        <header><strong>远端同步</strong><span>{status.upstream ? `跟踪 ${status.upstream}` : "当前分支尚未发布"}</span></header>
        <div className="module-context__git-remote-controls">
          <Select aria-label="选择 Git remote" size="small" value={selectedRemote || undefined} placeholder="选择 Git remote" options={status.remotes.map(remote => ({ value: remote, label: remote }))} onChange={setSelectedRemote} />
          <Button size="small" disabled={actionBusy || !canSyncSelectedRemote} loading={actionBusy} onClick={() => void operate({ operation: "fetch", remote: selectedRemote })}>获取</Button>
          <Button size="small" disabled={actionBusy || !canSyncUpstream || !status.behind || !status.clean || Boolean(status.ahead)} loading={actionBusy} onClick={() => void operate({ operation: "pull" })}>拉取</Button>
          <Button size="small" type={status.upstream ? "default" : "primary"} disabled={actionBusy || !(status.upstream ? canSyncUpstream : canSyncSelectedRemote) || !status.head || Boolean(status.upstream && (!status.ahead || status.behind))} loading={actionBusy} onClick={() => void operate(status.upstream ? { operation: "push" } : { operation: "push-upstream", remote: selectedRemote })}>{status.upstream ? "推送" : "发布分支"}</Button>
          {selectedRemote && status.credentialCapableRemotes?.includes(selectedRemote) ? <Button size="small" onClick={() => { setRemoteModalMode("credential"); setRemoteModalOpen(true); }}> {status.authenticatedRemotes?.includes(selectedRemote) ? "更新凭据" : "设置凭据"}</Button> : null}
          {selectedRemote && status.authenticatedRemotes?.includes(selectedRemote) ? <Popconfirm title={`删除 ${selectedRemote} 的账户凭据？`} description="只删除 LFAA 加密保存的凭据，不会修改 remote 或 Git 提交。" okText="删除凭据" cancelText="取消" onConfirm={() => void removeRemoteCredential()}>
            <Button size="small" danger disabled={actionBusy}>删除凭据</Button>
          </Popconfirm> : null}
          <Button size="small" onClick={() => { setRemoteModalMode("add"); setRemoteModalOpen(true); }}>添加远端</Button>
          {selectedRemote ? <Popconfirm title={`移除远端 ${selectedRemote}？`} description="只会移除此仓库中的 remote 配置，不会删除提交或文件。" okText="移除远端" cancelText="取消" onConfirm={() => void operate({ operation: "remote-remove", remote: selectedRemote })}>
            <Button size="small" danger disabled={actionBusy}>移除</Button>
          </Popconfirm> : null}
        </div>
        {!status.remotes.length ? <p className="module-context__git-empty">当前仓库没有配置远端；添加 HTTPS 或本机 bare 仓库后可同步。</p> : null}
        {selectedRemote && !canSyncSelectedRemote ? <p className="module-context__git-empty">此 remote 类型暂未接入账户隔离的同步凭据；获取、拉取和推送不可用。</p> : null}
      </section> : null}
      {project?.gitWorktree ? <Popconfirm title="恢复到 AI Worktree 基线？" description="会撤销这棵隔离工作树中的已跟踪改动和非忽略未跟踪文件。源项目、忽略文件及其他工作树不受影响。" okText="继续恢复" cancelText="取消" onConfirm={() => { setResetConfirmed(false); setResetOpen(true); }}>
        <Button className="module-context__git-reset" size="small" danger disabled={actionBusy}>{actionBusy ? "正在恢复…" : "恢复 AI Worktree"}</Button>
      </Popconfirm> : null}
      </> : null}
    </> : null}
    <Modal title="确认恢复 AI Worktree" open={resetOpen} onCancel={() => { if (!actionBusy) { setResetOpen(false); setResetConfirmed(false); } }} onOk={() => void reset()} okText="恢复到基线" cancelText="保留当前改动" okButtonProps={{ danger: true, disabled: !resetConfirmed }} confirmLoading={actionBusy} closable={!actionBusy} maskClosable={!actionBusy}>
      <p>此操作只重置此 AI Worktree 到 <code>{project?.gitWorktree?.baseCommit.slice(0, 8)}</code>，并删除其中非忽略的未跟踪文件。已忽略文件会保留，源项目不变。</p>
      <Checkbox checked={resetConfirmed} onChange={event => setResetConfirmed(event.target.checked)}>我确认丢弃此 AI Worktree 的当前改动</Checkbox>
    </Modal>
    <Modal title={remoteModalMode === "add" ? "添加 Git 远端" : `配置 ${selectedRemote} 的 HTTPS 凭据`} open={remoteModalOpen} onCancel={() => { if (!actionBusy) { setRemoteModalOpen(false); setRemoteUsername(""); setRemoteToken(""); } }} onOk={() => void submitRemoteModal()} okText={remoteModalMode === "add" ? "添加远端并保存凭据" : "加密保存凭据"} cancelText="取消" okButtonProps={{ disabled: remoteModalMode === "add" ? !newRemoteName.trim() || !newRemoteUrl.trim() : !selectedRemote || !remoteUsername.trim() || !remoteToken }} confirmLoading={actionBusy} closable={!actionBusy} maskClosable={!actionBusy}>
      <div className="module-context__git-remote-form">{remoteModalMode === "add" ? <><label>远端名称<Input aria-label="远端名称" maxLength={100} value={newRemoteName} onChange={event => setNewRemoteName(event.target.value)} placeholder="origin" /></label><label>HTTPS 或本机 bare 仓库地址<Input aria-label="Git 远端地址" maxLength={2048} value={newRemoteUrl} onChange={event => { const value = event.target.value; setNewRemoteUrl(value); if (!/^https:\/\//iu.test(value.trim())) { setRemoteUsername(""); setRemoteToken(""); } }} placeholder="https://… 或 file:///…" /></label></> : null}
        {remoteModalMode === "credential" || /^https:\/\//iu.test(newRemoteUrl.trim()) ? <><label>HTTPS 用户名<Input aria-label="HTTPS 用户名" maxLength={256} autoComplete="username" value={remoteUsername} onChange={event => setRemoteUsername(event.target.value)} /></label><label>访问令牌<Input.Password aria-label="Git HTTPS 访问令牌" maxLength={16384} autoComplete="new-password" value={remoteToken} onChange={event => setRemoteToken(event.target.value)} /></label></> : null}
        <p>HTTPS 凭据按当前 LFAA 账户加密保存；认证时不会调用操作系统共享的 Git 凭据助手，也不会把令牌放进远端地址、命令参数或返回给页面。留空凭据可用于公开远端。</p></div>
    </Modal>
    <Modal className="module-context__git-metadata-modal" title={metadataMode === "history" ? "提交历史" : "Git 分支"} open={metadataMode !== null} onCancel={() => { if (!actionBusy) setMetadataMode(null); }} footer={null} destroyOnClose width="min(560px, calc(100vw - 32px))" getContainer={() => document.querySelector(".workbench-shell") ?? document.body}>
      {metadataMode === "history" ? <div className="module-context__git-history">
        {history.length ? history.map(commit => <article key={commit.hash}>
          <code>{commit.shortHash}</code><strong>{commit.subject || "（无提交说明）"}</strong>
          <span>{commit.author} · {new Date(commit.authoredAt).toLocaleString("zh-CN")}</span>
        </article>) : <p className="module-context__git-empty">当前仓库还没有提交记录。</p>}
      </div> : null}
      {metadataMode === "branches" ? <div className="module-context__git-branch-manager">
        {branches.map(branch => <div key={branch.name}>
          <button type="button" aria-label={`切换到分支 ${branch.name}`} disabled={branch.current || actionBusy} onClick={() => void operate({ operation: "branch-switch", branch: branch.name })}>
            <code>{branch.name}</code>{branch.current ? <Tag>当前</Tag> : null}
          </button>
          <Popconfirm title={`删除分支 ${branch.name}？`} description="只允许删除已合并的分支，未合并分支会由 Git 拒绝。" okText="删除分支" cancelText="取消" onConfirm={() => void operate({ operation: "branch-delete", branch: branch.name })}>
            <Button size="small" danger disabled={branch.current || actionBusy}>删除</Button>
          </Popconfirm>
        </div>)}
        <div className="module-context__git-create-branch">
          <Input aria-label="新分支名称" value={branchName} maxLength={250} placeholder="新分支名称（自动添加前缀）" onChange={event => setBranchName(event.target.value)} />
          <Button size="small" type="primary" disabled={!branchName.trim() || actionBusy} loading={actionBusy} onClick={() => void operate({ operation: "branch-create", branch: branchName.trim() })}>创建并切换</Button>
        </div>
        {!branches.length ? <p className="module-context__git-empty">没有可列出的分支；新仓库可以先创建一个分支，再提交首个版本。</p> : null}
      </div> : null}
      {error || loadError ? <Alert className="module-context__git-error" type="warning" showIcon message={error || loadError} /> : null}
    </Modal>
    {(project || repositoryId) && status && status.repositoryState !== "not-repository" ? <GitChangeReview appId={appId} projectId={repositoryId ?? project!.id} projectTitle={repositoryId ? repositoryTitle ?? "" : project!.title} repositoryId={repositoryId ?? undefined} status={status} initialPath={reviewPath || status.files[0]?.path || ""} open={reviewOpen} embedded={embedded} onClose={() => setReviewOpen(false)} onRefresh={onRefresh} /> : null}
  </section>;
}

interface GitChangeActivityReviewProps {
  appId: WorkspaceProjectApplicationId;
  project: WorkspaceProject;
  path: string;
  requestId: number;
  onClose: () => void;
  onRefresh: () => void;
}

/** 活动记录只提供项目相对路径；此处必须以已登记项目的 Git 状态精确映射后才打开审阅器。 */
export function GitChangeActivityReview({ appId, project, path, requestId, onClose, onRefresh }: GitChangeActivityReviewProps) {
  const [status, setStatus] = useState<WorkspaceGitStatus | null>(null);
  const [reviewPath, setReviewPath] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestRevision = useRef(0);

  useEffect(() => {
    let active = true;
    const revision = ++requestRevision.current;
    setStatus(null);
    setReviewPath("");
    setLoading(true);
    setError("");
    void loadWorkspaceGitStatus(project.id, appId).then(({ status: current }) => {
      if (!active || requestRevision.current !== revision) return;
    const repositoryPath = current.projectRelativePath && path !== current.projectRelativePath && !path.startsWith(`${current.projectRelativePath}/`)
      ? `${current.projectRelativePath}/${path}` : path;
    const changedFile = current.files.find(file => file.projectPath === repositoryPath || file.projectPath === path);
      if (!changedFile) throw new Error("当前 Git 差异结果未包含此文件；它可能已提交、被忽略、超出返回列表，或项目状态已经变化。");
      setStatus(current);
      setReviewPath(changedFile.path);
    }).catch(loadError => {
      if (active && requestRevision.current === revision) setError(getErrorMessage(loadError));
    }).finally(() => {
      if (active && requestRevision.current === revision) setLoading(false);
    });
    return () => {
      active = false;
      requestRevision.current += 1;
    };
  }, [appId, path, project.id, requestId]);

  const refresh = useCallback(async () => {
    const revision = ++requestRevision.current;
    try {
      const { status: current } = await loadWorkspaceGitStatus(project.id, appId);
      if (requestRevision.current !== revision) return;
      const repositoryPath = current.projectRelativePath && path !== current.projectRelativePath && !path.startsWith(`${current.projectRelativePath}/`)
        ? `${current.projectRelativePath}/${path}` : path;
      const changedFile = current.files.find(file => file.projectPath === repositoryPath || file.projectPath === path);
      if (!changedFile) throw new Error("当前 Git 差异结果未包含此文件；请刷新后从当前差异列表重新打开。");
      setStatus(current);
      setReviewPath(changedFile.path);
      onRefresh();
    } catch (refreshError) {
      if (requestRevision.current !== revision) return;
      setStatus(null);
      setReviewPath("");
      setError(getErrorMessage(refreshError));
      setLoading(false);
    }
  }, [appId, onRefresh, path, project.id]);

  return status && reviewPath
    ? <GitChangeReview appId={appId} projectId={project.id} projectTitle={project.title} status={status} initialPath={reviewPath} open onClose={onClose} onRefresh={refresh} />
    : <Modal
        open
        title="打开文件差异"
        footer={null}
        onCancel={onClose}
        getContainer={() => document.querySelector(".workbench-shell") ?? document.body}
      >
        {loading ? <div className="module-context__git-loading"><Spin size="small" /><span>正在核对项目 Git 状态…</span></div> : null}
        {error ? <Alert type="warning" showIcon message={error} action={<Button size="small" onClick={onClose}>关闭</Button>} /> : null}
      </Modal>;
}
