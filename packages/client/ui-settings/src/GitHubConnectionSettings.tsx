/** 功能：展示当前账户的 GitHub 授权和只读资源。作用：通过认证 Connection API 使用 GitHub Integration Owner。关联文件：ManagedPluginsSettings、client/connection。 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, List, Space, Spin, Tag } from "antd";
import { beginGitHubAuthorization, cancelGitHubAuthorization, disconnectGitHub, getErrorMessage, getGitHubConnectionStatus, listGitHubIssues, listGitHubPullRequests, listGitHubRepositories, pollGitHubAuthorization, type GitHubConnectionStatus, type GitHubIssue, type GitHubPullRequest, type GitHubRepository } from "lfaa-client-connection/src/api.js";
import { SettingGroup, SettingRow } from "lfaa-client-ui-primitives/src/settings-controls.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";

interface DeviceAuthorization {
  attemptId: string;
  verificationUri: string;
  userCode: string;
  expiresAt: string;
  intervalSeconds: number;
}

type ResourceSelection = { repository: string; kind: "issues"; items: GitHubIssue[] }
  | { repository: string; kind: "pulls"; items: GitHubPullRequest[] };

export function GitHubConnectionSettings({ searchQuery }: { searchQuery: string }) {
  const [connection, setConnection] = useState<GitHubConnectionStatus | null>(null);
  const [device, setDevice] = useState<DeviceAuthorization | null>(null);
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [hasMoreRepositories, setHasMoreRepositories] = useState(false);
  const [repositoryPage, setRepositoryPage] = useState(1);
  const [resourceSelection, setResourceSelection] = useState<ResourceSelection | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [loadingRepositories, setLoadingRepositories] = useState(false);
  const [loadingResource, setLoadingResource] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const currentRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void getGitHubConnectionStatus(controller.signal).then(result => {
      if (active) setConnection(result.connection);
    }).catch(loadError => {
      if (active && !controller.signal.aborted) setError(`读取 GitHub 连接状态失败：${getErrorMessage(loadError)}`);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); currentRequest.current?.abort(); };
  }, []);

  useEffect(() => {
    if (!device) return;
    let active = true;
    let timer: number | null = null;
    const schedule = (seconds: number) => {
      if (active) timer = window.setTimeout(() => { void poll(); }, Math.max(1, seconds) * 1000);
    };
    const poll = async () => {
      if (!active) return;
      try {
        const result = await pollGitHubAuthorization(device.attemptId);
        if (!active) return;
        if (result.result.status === "pending") {
          schedule(Math.max(device.intervalSeconds, result.result.retryAfterSeconds));
          return;
        }
        setDevice(null);
        if (result.result.status === "authorized") {
          setNotice(`已连接 GitHub 账户 ${result.result.login}。`);
          const status = await getGitHubConnectionStatus();
          if (active) setConnection(status.connection);
          return;
        }
        setError(result.result.status === "expired" ? "GitHub 授权码已过期，请重新连接。" : "GitHub 授权已取消。" );
      } catch (pollError) {
        if (active) {
          setDevice(null);
          setError(`GitHub 授权状态读取失败：${getErrorMessage(pollError)}`);
        }
      }
    };
    schedule(device.intervalSeconds);
    return () => {
      active = false;
      if (timer !== null) window.clearTimeout(timer);
      void cancelGitHubAuthorization(device.attemptId).catch(() => undefined);
    };
  }, [device?.attemptId]);

  const visibleRepositories = useMemo(() => {
    const normalized = searchQuery.trim().toLocaleLowerCase("zh-CN");
    return normalized ? repositories.filter(repository => [repository.fullName, repository.description ?? ""]
      .some(value => value.toLocaleLowerCase("zh-CN").includes(normalized))) : repositories;
  }, [repositories, searchQuery]);

  async function refreshStatus(): Promise<void> {
    const result = await getGitHubConnectionStatus();
    setConnection(result.connection);
  }

  async function startAuthorization(): Promise<void> {
    setConnecting(true);
    setError("");
    setNotice("");
    try {
      const result = await beginGitHubAuthorization();
      setDevice(result.device);
    } catch (startError) {
      setError(`无法开始 GitHub 授权：${getErrorMessage(startError)}`);
    } finally { setConnecting(false); }
  }

  async function cancelAuthorization(): Promise<void> {
    if (!device) return;
    const current = device;
    setDevice(null);
    try { await cancelGitHubAuthorization(current.attemptId); }
    catch (cancelError) { setError(`取消 GitHub 授权失败：${getErrorMessage(cancelError)}`); }
  }

  async function copyUserCode(): Promise<void> {
    if (!device) return;
    try {
      await navigator.clipboard.writeText(device.userCode);
      setNotice("验证码已复制。" );
    } catch { setError("无法访问剪贴板，请手动复制验证码。" ); }
  }

  async function loadRepositories(page = 1): Promise<void> {
    if (loadingRepositories) return;
    const controller = new AbortController();
    currentRequest.current?.abort();
    currentRequest.current = controller;
    setLoadingRepositories(true);
    setError("");
    try {
      const result = await listGitHubRepositories(page, controller.signal);
      if (controller.signal.aborted) return;
      setRepositories(current => page === 1 ? result.repositories : [...current, ...result.repositories]);
      setRepositoryPage(page);
      setHasMoreRepositories(result.truncated);
      setResourceSelection(null);
    } catch (loadError) {
      if (!controller.signal.aborted) setError(`读取 GitHub 仓库失败：${getErrorMessage(loadError)}`);
    } finally {
      if (currentRequest.current === controller) currentRequest.current = null;
      if (!controller.signal.aborted) setLoadingRepositories(false);
    }
  }

  async function loadRepositoryResources(repository: GitHubRepository, kind: "issues" | "pulls"): Promise<void> {
    const ownerAndName = repository.fullName.split("/");
    if (ownerAndName.length !== 2) return;
    const controller = new AbortController();
    currentRequest.current?.abort();
    currentRequest.current = controller;
    const key = `${repository.fullName}:${kind}`;
    setLoadingResource(key);
    setError("");
    try {
      if (kind === "issues") {
        const result = await listGitHubIssues(ownerAndName[0]!, ownerAndName[1]!, controller.signal);
        if (!controller.signal.aborted) setResourceSelection({ repository: repository.fullName, kind, items: result.issues });
      } else {
        const result = await listGitHubPullRequests(ownerAndName[0]!, ownerAndName[1]!, controller.signal);
        if (!controller.signal.aborted) setResourceSelection({ repository: repository.fullName, kind, items: result.pullRequests });
      }
    } catch (loadError) {
      if (!controller.signal.aborted) setError(`读取 ${kind === "issues" ? "Issue" : "Pull Request"} 失败：${getErrorMessage(loadError)}`);
    } finally {
      if (currentRequest.current === controller) currentRequest.current = null;
      if (!controller.signal.aborted) setLoadingResource("");
    }
  }

  async function disconnect(): Promise<void> {
    setDisconnecting(true);
    setError("");
    setNotice("");
    currentRequest.current?.abort();
    setRepositories([]);
    setResourceSelection(null);
    try {
      const result = await disconnectGitHub();
      await refreshStatus();
      setNotice(result.remoteRevoked
        ? "已断开 GitHub，并确认撤销远端授权。"
        : "已删除本地授权记录。请在 GitHub 的 Settings → Applications 中撤销 LFAA 授权。" );
    } catch (disconnectError) {
      setError(`断开 GitHub 失败：${getErrorMessage(disconnectError)}`);
    } finally { setDisconnecting(false); }
  }

  return <div className="settings-github-connection">
    {error ? <Alert type="error" showIcon message={error} /> : null}
    {notice ? <Alert type="success" showIcon message={notice} /> : null}
    <SettingGroup title="外部应用连接">
      {loading ? <div className="settings-profile-plugins__state" role="status"><Spin size="small" /><span>正在读取 GitHub 连接状态…</span></div>
        : !connection ? <div className="settings-profile-plugins__state" role="status"><span>GitHub 连接状态当前不可用。</span></div>
          : !connection.configured ? <div className="settings-profile-plugins__market">
          <WorkbenchIcon name="branch" size={22} />
          <strong>GitHub 尚未配置</strong>
          <span>请管理员在控制端配置 LFAA_GITHUB_APP_CLIENT_ID，并在 GitHub App 开启 Device Flow；仓库 Metadata、Issues、Pull requests 权限应设为只读。</span>
        </div>
          : <SettingRow title="GitHub" description="连接 GitHub 后，在这里查看授权账户可访问的仓库、Issue 和 Pull Request。LFAA 只读取这些资料。" status={connection.connected ? `已连接 · ${connection.login}` : "未连接"}>
            <Space wrap>
              {connection.connected
                ? <Button danger loading={disconnecting} disabled={disconnecting} onClick={() => void disconnect()}>断开连接</Button>
                : <Button type="primary" loading={connecting} disabled={connecting || Boolean(device)} onClick={() => void startAuthorization()}>连接 GitHub</Button>}
            </Space>
          </SettingRow>}
    </SettingGroup>
    {device ? <section className="settings-profile-plugins__market" aria-labelledby="settings-github-device-title">
      <WorkbenchIcon name="branch" size={22} />
      <strong id="settings-github-device-title">完成 GitHub 授权</strong>
      <span>在 GitHub 验证页面输入下方验证码。验证码有效至 {new Date(device.expiresAt).toLocaleTimeString()}。</span>
      <code className="settings-github-connection__code">{device.userCode}</code>
      <Space wrap>
        <Button onClick={() => void copyUserCode()}>复制验证码</Button>
        <Button type="primary" href={device.verificationUri} target="_blank" rel="noreferrer">打开 GitHub 验证页</Button>
        <Button onClick={() => void cancelAuthorization()}>取消</Button>
      </Space>
      <span>状态将按 GitHub 返回的安全轮询间隔自动更新。</span>
    </section> : null}
    {connection?.connected ? <SettingGroup title="已授权仓库">
      <div className="settings-github-connection__repo-actions">
        <span>授权范围由 GitHub App 的仓库选择与只读权限决定。</span>
        <Button loading={loadingRepositories} disabled={loadingRepositories} onClick={() => void loadRepositories(1)}>{repositories.length ? "刷新仓库" : "读取仓库"}</Button>
      </div>
      {loadingRepositories && repositories.length === 0 ? <div className="settings-profile-plugins__state" role="status"><Spin size="small" /><span>正在从 GitHub 读取仓库…</span></div>
        : repositories.length === 0 ? <div className="settings-profile-plugins__state"><span>尚未读取仓库清单。</span></div>
          : visibleRepositories.length === 0 ? <div className="settings-profile-plugins__state"><span>没有符合当前搜索的仓库。</span></div>
            : <List className="settings-github-connection__repositories" dataSource={visibleRepositories} renderItem={repository => <List.Item key={repository.id}>
              <div className="settings-github-connection__repository">
                <div className="settings-github-connection__repository-copy">
                  <a href={repository.url} target="_blank" rel="noreferrer">{repository.fullName}</a>
                  <span>{repository.description || "此仓库没有说明。"}</span>
                  <small>{repository.private ? "Private" : "Public"} · {repository.defaultBranch || "默认分支未提供"}</small>
                </div>
                <Space wrap>
                  <Button size="small" loading={loadingResource === `${repository.fullName}:issues`} onClick={() => void loadRepositoryResources(repository, "issues")}>Issues</Button>
                  <Button size="small" loading={loadingResource === `${repository.fullName}:pulls`} onClick={() => void loadRepositoryResources(repository, "pulls")}>PR</Button>
                </Space>
              </div>
            </List.Item>} />}
      {hasMoreRepositories ? <div className="settings-github-connection__more"><Button loading={loadingRepositories} disabled={loadingRepositories || repositoryPage >= 100} onClick={() => void loadRepositories(repositoryPage + 1)}>加载更多仓库</Button></div> : null}
      {resourceSelection ? <div className="settings-github-connection__resources">
        <h3>{resourceSelection.repository} · {resourceSelection.kind === "issues" ? "Open Issues" : "Open Pull Requests"}</h3>
        {resourceSelection.items.length === 0 ? <span>没有打开的条目。</span> : <List size="small" dataSource={resourceSelection.items} renderItem={item => <List.Item key={`${resourceSelection.repository}:${item.number}`}>
          <div className="settings-github-connection__resource">
            <a href={item.url} target="_blank" rel="noreferrer">#{item.number} {item.title}</a>
            <span>{item.author ? `@${item.author} · ` : ""}{new Date(item.updatedAt).toLocaleDateString()} · {item.state}</span>
            {resourceSelection.kind === "pulls" ? <small>{(item as GitHubPullRequest).headBranch} → {(item as GitHubPullRequest).baseBranch}</small> : null}
            <Space wrap>{item.labels.map(label => <Tag key={label}>{label}</Tag>)}</Space>
          </div>
        </List.Item>} />}
      </div> : null}
    </SettingGroup> : null}
    <p className="settings-github-connection__scope">授权后仅执行仓库、Issue 和 Pull Request 的 GET 读取；不创建、更新、评论、合并或删除 GitHub 内容。</p>
  </div>;
}
