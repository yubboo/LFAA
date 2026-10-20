/** 功能：提供 GitHub App 用户连接与只读数据 API。作用：由 Credentials 加密持有账户令牌并限制 OAuth/REST 范围。关联文件：api/github-connection-controller、credentials、launch-environment。 */
import type { Context } from "@deepseek-ai/cordis";
import { randomUUID } from "node:crypto";
import { credentialReference, type CredentialRecord, type CredentialConsumer } from "lfaa-credentials/src/index.js";
import { config } from "lfaa-launch-environment/src/config.js";

const reference = credentialReference("lfaa-github-integration", "github");
const maxDeviceFlows = 128;
const apiRoot = "https://api.github.com";
const oauthRoot = "https://github.com";
const requestTimeoutMs = 15_000;

export interface GitHubIntegrationStatus {
  configured: boolean;
  connected: boolean;
  login: string | null;
  connectedAt: string | null;
  expiresAt: string | null;
  remoteRevocationAvailable: boolean;
}

export interface GitHubDeviceAuthorization {
  attemptId: string;
  verificationUri: string;
  userCode: string;
  expiresAt: string;
  intervalSeconds: number;
}

export type GitHubDevicePollResult =
  | { status: "pending"; retryAfterSeconds: number }
  | { status: "authorized"; login: string }
  | { status: "expired" }
  | { status: "cancelled" };

export interface GitHubRepository {
  id: number;
  fullName: string;
  description: string | null;
  private: boolean;
  url: string;
  defaultBranch: string;
  updatedAt: string;
}

export interface GitHubIssue {
  number: number;
  title: string;
  state: string;
  author: string | null;
  url: string;
  updatedAt: string;
  labels: string[];
}

export interface GitHubPullRequest extends GitHubIssue {
  baseBranch: string;
  headBranch: string;
}

export interface GitHubIntegrationService {
  status(ownerId: string): GitHubIntegrationStatus;
  beginAuthorization(ownerId: string): Promise<GitHubDeviceAuthorization>;
  pollAuthorization(ownerId: string, attemptId: string, signal?: AbortSignal): Promise<GitHubDevicePollResult>;
  cancelAuthorization(ownerId: string, attemptId: string): boolean;
  disconnect(ownerId: string, signal?: AbortSignal): Promise<{ remoteRevoked: boolean }>;
  listRepositories(ownerId: string, page: number, signal?: AbortSignal): Promise<{ repositories: GitHubRepository[]; truncated: boolean }>;
  listIssues(ownerId: string, repository: string, signal?: AbortSignal): Promise<GitHubIssue[]>;
  listPullRequests(ownerId: string, repository: string, signal?: AbortSignal): Promise<GitHubPullRequest[]>;
  close(): void;
}

interface GitHubCredential {
  version: 1;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  refreshTokenExpiresAt: string | null;
  login: string;
  connectedAt: string;
  scopes: readonly string[];
}

interface DeviceFlow {
  readonly id: string;
  readonly ownerId: string;
  readonly deviceCode: string;
  readonly userCode: string;
  readonly verificationUri: string;
  readonly expiresAtMs: number;
  intervalMs: number;
  nextPollAtMs: number;
  polling: boolean;
  pollController: AbortController | null;
}

export class GitHubIntegrationError extends Error {
  constructor(readonly code: string, message: string, readonly statusCode = 400) {
    super(message);
    this.name = "GitHubIntegrationError";
  }
}

export interface GitHubCredentialAccess {
  read(ownerId: string): CredentialRecord | null;
  write(ownerId: string, payload: GitHubCredential): void;
  delete(ownerId: string): boolean;
}

export function createGitHubIntegrationService(options: {
  clientId: string;
  clientSecret?: string;
  credentials: GitHubCredentialAccess;
  fetchImpl?: typeof fetch;
  now?: () => number;
}): GitHubIntegrationService {
  const clientId = options.clientId.trim();
  const clientSecret = options.clientSecret?.trim() ?? "";
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const flows = new Map<string, DeviceFlow>();
  const flowsByOwner = new Map<string, string>();
  const refreshInFlight = new Map<string, Promise<GitHubCredential>>();
  let closed = false;

  function ensureOpen(): void {
    if (closed) throw new GitHubIntegrationError("integration_closed", "GitHub 连接服务已卸载。", 503);
  }
  function ensureConfigured(): void {
    ensureOpen();
    if (!clientId) throw new GitHubIntegrationError("github_app_not_configured", "管理员尚未配置 GitHub App Client ID。", 503);
  }
  function readCredential(ownerId: string): GitHubCredential | null {
    const record = options.credentials.read(ownerId);
    if (!record) return null;
    if (record.kind !== "grant") throw new GitHubIntegrationError("github_credential_invalid", "GitHub 连接记录格式无效。", 409);
    return normalizeCredential(record.payload);
  }
  function status(ownerId: string): GitHubIntegrationStatus {
    ensureOpen();
    const credential = readCredential(ownerId);
    return Object.freeze({
      configured: Boolean(clientId),
      connected: Boolean(credential),
      login: credential?.login ?? null,
      connectedAt: credential?.connectedAt ?? null,
      expiresAt: credential?.expiresAt ?? null,
      remoteRevocationAvailable: Boolean(clientId && clientSecret)
    });
  }

  async function beginAuthorization(ownerId: string): Promise<GitHubDeviceAuthorization> {
    ensureConfigured();
    expireFlows();
    if (flowsByOwner.has(ownerId)) throw new GitHubIntegrationError("github_authorization_in_progress", "此账户已有一项 GitHub 授权正在等待完成。", 409);
    if (flows.size >= maxDeviceFlows) throw new GitHubIntegrationError("github_authorization_capacity", "GitHub 授权请求过多，请稍后重试。", 429);
    const body = await oauthRequest("/login/device/code", { client_id: clientId }, undefined, "GitHub App 无法开始设备授权，请检查 App 是否启用了 Device Flow。");
    const deviceCode = readString(body.device_code, 4096);
    const userCode = readString(body.user_code, 128);
    const verificationUri = readVerificationUri(body.verification_uri);
    const expiresIn = readBoundedInteger(body.expires_in, 30, 900, "GitHub Device Flow 有效期无效。");
    const intervalSeconds = readBoundedInteger(body.interval, 1, 60, "GitHub Device Flow 轮询间隔无效。");
    const flow: DeviceFlow = {
      id: randomUUID(), ownerId, deviceCode, userCode, verificationUri,
      expiresAtMs: now() + expiresIn * 1000, intervalMs: intervalSeconds * 1000,
      nextPollAtMs: 0, polling: false, pollController: null
    };
    flows.set(flow.id, flow);
    flowsByOwner.set(ownerId, flow.id);
    return Object.freeze({ attemptId: flow.id, verificationUri, userCode, expiresAt: new Date(flow.expiresAtMs).toISOString(), intervalSeconds });
  }

  async function pollAuthorization(ownerId: string, attemptId: string, signal?: AbortSignal): Promise<GitHubDevicePollResult> {
    ensureConfigured();
    expireFlows();
    const flow = flows.get(attemptId);
    if (!flow || flow.ownerId !== ownerId) return { status: "expired" };
    if (flow.polling) throw new GitHubIntegrationError("github_authorization_poll_in_progress", "GitHub 授权状态正在读取。", 409);
    const remainingSeconds = Math.ceil((flow.nextPollAtMs - now()) / 1000);
    if (remainingSeconds > 0) return { status: "pending", retryAfterSeconds: remainingSeconds };
    flow.polling = true;
    const pollController = new AbortController();
    flow.pollController = pollController;
    const pollSignal = signal ? AbortSignal.any([signal, pollController.signal]) : pollController.signal;
    try {
      const body = await oauthRequest("/login/oauth/access_token", {
        client_id: clientId,
        device_code: flow.deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code"
      }, pollSignal, "GitHub 暂时无法返回授权状态，请稍后重试。");
      if (body.error === "authorization_pending") {
        flow.nextPollAtMs = now() + flow.intervalMs;
        return { status: "pending", retryAfterSeconds: Math.ceil(flow.intervalMs / 1000) };
      }
      if (body.error === "slow_down") {
        flow.intervalMs = Math.min(flow.intervalMs + 5000, 60_000);
        flow.nextPollAtMs = now() + flow.intervalMs;
        return { status: "pending", retryAfterSeconds: Math.ceil(flow.intervalMs / 1000) };
      }
      if (body.error === "expired_token" || body.error === "access_denied") {
        removeFlow(flow);
        return body.error === "expired_token" ? { status: "expired" } : { status: "cancelled" };
      }
      if (body.error) throw new GitHubIntegrationError("github_authorization_failed", oauthErrorMessage(String(body.error)), 400);
      const credential = await createCredential(body, pollSignal);
      if (closed || flows.get(flow.id) !== flow || pollSignal.aborted) return { status: "cancelled" };
      options.credentials.write(ownerId, credential);
      removeFlow(flow);
      return { status: "authorized", login: credential.login };
    } finally {
      flow.polling = false;
      if (flow.pollController === pollController) flow.pollController = null;
    }
  }

  function cancelAuthorization(ownerId: string, attemptId: string): boolean {
    const flow = flows.get(attemptId);
    if (!flow || flow.ownerId !== ownerId) return false;
    removeFlow(flow);
    return true;
  }

  async function disconnect(ownerId: string, signal?: AbortSignal): Promise<{ remoteRevoked: boolean }> {
    ensureOpen();
    const credential = readCredential(ownerId);
    cancelOwnerFlow(ownerId);
    if (!credential) return { remoteRevoked: false };
    let remoteRevoked = false;
    if (clientId && clientSecret) {
      const authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64")}`;
      try {
        const response = await fetchImpl(`${apiRoot}/applications/${encodeURIComponent(clientId)}/grant`, {
          method: "DELETE",
          headers: { Authorization: authorization, Accept: "application/vnd.github+json", "Content-Type": "application/json", "X-GitHub-Api-Version": "2022-11-28" },
          body: JSON.stringify({ access_token: credential.accessToken }),
          signal: requestSignal(signal)
        });
        remoteRevoked = response.ok || response.status === 404;
      } catch { /* Always remove the local encrypted grant; UI reports if remote revocation could not be confirmed. */ }
    }
    options.credentials.delete(ownerId);
    return { remoteRevoked };
  }

  async function listRepositories(ownerId: string, page: number, signal?: AbortSignal): Promise<{ repositories: GitHubRepository[]; truncated: boolean }> {
    const credential = await getUsableCredential(ownerId, signal);
    const url = new URL(`${apiRoot}/user/repos`);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("sort", "updated");
    url.searchParams.set("page", String(page));
    const response = await apiRequest(url, credential.accessToken, signal);
    if (!Array.isArray(response.body)) throw new GitHubIntegrationError("github_response_invalid", "GitHub 返回的仓库清单格式无效。", 502);
    return {
      repositories: response.body.slice(0, 100).map(normalizeRepository),
      truncated: hasNextPage(response.link)
    };
  }

  async function listIssues(ownerId: string, repository: string, signal?: AbortSignal): Promise<GitHubIssue[]> {
    const credential = await getUsableCredential(ownerId, signal);
    const { owner, name } = parseRepository(repository);
    const url = new URL(`${apiRoot}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/issues`);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("state", "open");
    const response = await apiRequest(url, credential.accessToken, signal);
    if (!Array.isArray(response.body)) throw new GitHubIntegrationError("github_response_invalid", "GitHub 返回的 Issue 清单格式无效。", 502);
    return response.body.filter(item => isObject(item) && !isObject(item.pull_request)).slice(0, 100).map(normalizeIssue);
  }

  async function listPullRequests(ownerId: string, repository: string, signal?: AbortSignal): Promise<GitHubPullRequest[]> {
    const credential = await getUsableCredential(ownerId, signal);
    const { owner, name } = parseRepository(repository);
    const url = new URL(`${apiRoot}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/pulls`);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("state", "open");
    const response = await apiRequest(url, credential.accessToken, signal);
    if (!Array.isArray(response.body)) throw new GitHubIntegrationError("github_response_invalid", "GitHub 返回的 Pull Request 清单格式无效。", 502);
    return response.body.slice(0, 100).map(normalizePullRequest);
  }

  async function createCredential(body: Record<string, unknown>, signal?: AbortSignal): Promise<GitHubCredential> {
    const accessToken = readString(body.access_token, 16_384);
    const tokenType = typeof body.token_type === "string" ? body.token_type.toLowerCase() : "bearer";
    if (tokenType !== "bearer") throw new GitHubIntegrationError("github_token_type_invalid", "GitHub 返回了不支持的令牌类型。", 502);
    const userResponse = await apiRequest(new URL(`${apiRoot}/user`), accessToken, signal);
    if (!isObject(userResponse.body)) throw new GitHubIntegrationError("github_user_invalid", "GitHub 用户身份格式无效。", 502);
    const login = readString(userResponse.body.login, 128);
    if (!/^[A-Za-z0-9-]+$/u.test(login)) throw new GitHubIntegrationError("github_user_invalid", "GitHub 用户身份格式无效。", 502);
    const nowIso = new Date(now()).toISOString();
    const expiresIn = optionalBoundedInteger(body.expires_in, 60, 365 * 24 * 60 * 60);
    const refreshTokenExpiresIn = optionalBoundedInteger(body.refresh_token_expires_in, 60, 365 * 24 * 60 * 60);
    const refreshToken = optionalToken(body.refresh_token);
    return Object.freeze({
      version: 1,
      accessToken,
      refreshToken,
      expiresAt: expiresIn === null ? null : new Date(now() + expiresIn * 1000).toISOString(),
      refreshTokenExpiresAt: refreshTokenExpiresIn === null ? null : new Date(now() + refreshTokenExpiresIn * 1000).toISOString(),
      login,
      connectedAt: nowIso,
      scopes: parseScopes(body.scope)
    });
  }

  async function getUsableCredential(ownerId: string, signal?: AbortSignal): Promise<GitHubCredential> {
    ensureConfigured();
    const current = readCredential(ownerId);
    if (!current) throw new GitHubIntegrationError("github_connection_required", "请先连接 GitHub 账户。", 409);
    if (!current.expiresAt || Date.parse(current.expiresAt) > now() + 60_000) return current;
    if (!current.refreshToken || current.refreshTokenExpiresAt && Date.parse(current.refreshTokenExpiresAt) <= now()) {
      throw new GitHubIntegrationError("github_reauthorization_required", "GitHub 授权已过期，请重新连接账户。", 401);
    }
    let pending = refreshInFlight.get(ownerId);
    if (!pending) {
      pending = refreshCredential(ownerId, current, signal);
      refreshInFlight.set(ownerId, pending);
      void pending.finally(() => { if (refreshInFlight.get(ownerId) === pending) refreshInFlight.delete(ownerId); }).catch(() => undefined);
    }
    return pending;
  }

  async function refreshCredential(ownerId: string, current: GitHubCredential, signal?: AbortSignal): Promise<GitHubCredential> {
    const body = await oauthRequest("/login/oauth/access_token", {
      client_id: clientId,
      grant_type: "refresh_token",
      refresh_token: current.refreshToken
    }, signal, "GitHub 令牌刷新失败，请重新授权。");
    if (body.error) throw new GitHubIntegrationError("github_reauthorization_required", "GitHub 授权已过期，请重新连接账户。", 401);
    const accessToken = readString(body.access_token, 16_384);
    const refreshToken = optionalToken(body.refresh_token) ?? current.refreshToken;
    const expiresIn = readBoundedInteger(body.expires_in, 60, 365 * 24 * 60 * 60, "GitHub 返回的访问令牌有效期无效。");
    const refreshExpiresIn = optionalBoundedInteger(body.refresh_token_expires_in, 60, 365 * 24 * 60 * 60);
    const updated: GitHubCredential = Object.freeze({
      ...current,
      accessToken,
      refreshToken,
      expiresAt: new Date(now() + expiresIn * 1000).toISOString(),
      refreshTokenExpiresAt: refreshExpiresIn === null ? current.refreshTokenExpiresAt : new Date(now() + refreshExpiresIn * 1000).toISOString()
    });
    options.credentials.write(ownerId, updated);
    return updated;
  }

  async function oauthRequest(path: string, body: Record<string, unknown>, signal: AbortSignal | undefined, errorMessage: string): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await fetchImpl(`${oauthRoot}${path}`, {
        method: "POST", signal: requestSignal(signal),
        headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "LFAA" },
        body: JSON.stringify(body)
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new GitHubIntegrationError("github_service_unavailable", errorMessage, 502);
    }
    const parsed = await readJson(response);
    if (!response.ok) throw new GitHubIntegrationError("github_service_unavailable", errorMessage, response.status >= 500 ? 502 : response.status);
    if (!isObject(parsed)) throw new GitHubIntegrationError("github_response_invalid", "GitHub 返回了无效授权响应。", 502);
    return parsed;
  }

  async function apiRequest(url: URL, token: string, signal?: AbortSignal): Promise<{ body: Record<string, unknown> | unknown[]; link: string | null }> {
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: "GET", signal: requestSignal(signal),
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "LFAA" }
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new GitHubIntegrationError("github_service_unavailable", "GitHub 暂时无法读取数据，请稍后重试。", 502);
    }
    const body = await readJson(response);
    if (!response.ok) {
      if (response.status === 401) throw new GitHubIntegrationError("github_reauthorization_required", "GitHub 授权已过期，请重新连接账户。", 401);
      if (response.status === 403 || response.status === 404) throw new GitHubIntegrationError("github_resource_unavailable", "GitHub 未返回此资源；请检查 App 权限和仓库授权范围。", 403);
      if (response.status === 429) throw new GitHubIntegrationError("github_rate_limited", "GitHub API 当前达到速率限制，请稍后重试。", 429);
      throw new GitHubIntegrationError("github_service_unavailable", "GitHub 暂时无法读取数据，请稍后重试。", response.status >= 500 ? 502 : response.status);
    }
    if (!isObject(body) && !Array.isArray(body)) throw new GitHubIntegrationError("github_response_invalid", "GitHub 返回了无效数据。", 502);
    return { body, link: response.headers.get("link") };
  }

  function expireFlows(): void {
    for (const flow of flows.values()) if (flow.expiresAtMs <= now()) removeFlow(flow);
  }
  function removeFlow(flow: DeviceFlow): void {
    flow.pollController?.abort();
    flows.delete(flow.id);
    if (flowsByOwner.get(flow.ownerId) === flow.id) flowsByOwner.delete(flow.ownerId);
  }
  function cancelOwnerFlow(ownerId: string): void {
    const id = flowsByOwner.get(ownerId);
    const flow = id ? flows.get(id) : null;
    if (flow) removeFlow(flow);
  }

  return Object.freeze({
    status,
    beginAuthorization,
    pollAuthorization,
    cancelAuthorization,
    disconnect,
    listRepositories,
    listIssues,
    listPullRequests,
    close() {
      if (closed) return;
      closed = true;
      for (const flow of flows.values()) flow.pollController?.abort();
      flows.clear();
      flowsByOwner.clear();
      refreshInFlight.clear();
    }
  });

}

function normalizeCredential(payload: unknown): GitHubCredential {
  if (!isObject(payload) || payload.version !== 1
    || typeof payload.accessToken !== "string" || payload.accessToken.length < 8 || payload.accessToken.length > 16_384
    || payload.refreshToken !== null && (typeof payload.refreshToken !== "string" || payload.refreshToken.length < 8 || payload.refreshToken.length > 16_384)
    || payload.expiresAt !== null && (typeof payload.expiresAt !== "string" || !Number.isFinite(Date.parse(payload.expiresAt)))
    || payload.refreshTokenExpiresAt !== null && (typeof payload.refreshTokenExpiresAt !== "string" || !Number.isFinite(Date.parse(payload.refreshTokenExpiresAt)))
    || typeof payload.login !== "string" || !/^[A-Za-z0-9-]{1,128}$/u.test(payload.login)
    || typeof payload.connectedAt !== "string" || !Number.isFinite(Date.parse(payload.connectedAt))
    || !Array.isArray(payload.scopes) || payload.scopes.length > 64 || payload.scopes.some(scope => typeof scope !== "string" || scope.length > 80)) {
    throw new GitHubIntegrationError("github_credential_invalid", "GitHub 连接记录格式无效。", 409);
  }
  return Object.freeze({
    version: 1,
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken as string | null,
    expiresAt: payload.expiresAt as string | null,
    refreshTokenExpiresAt: payload.refreshTokenExpiresAt as string | null,
    login: payload.login,
    connectedAt: payload.connectedAt,
    scopes: Object.freeze([...(payload.scopes as string[])])
  });
}

function normalizeRepository(input: unknown): GitHubRepository {
  if (!isObject(input)) throw new GitHubIntegrationError("github_response_invalid", "GitHub 返回的仓库信息格式无效。", 502);
  return Object.freeze({
    id: readBoundedInteger(input.id, 1, Number.MAX_SAFE_INTEGER, "GitHub 仓库 ID 无效。"),
    fullName: readString(input.full_name, 255),
    description: typeof input.description === "string" ? input.description.slice(0, 500) : null,
    private: input.private === true,
    url: readGitHubUrl(input.html_url),
    defaultBranch: typeof input.default_branch === "string" ? input.default_branch.slice(0, 255) : "",
    updatedAt: validDateString(input.updated_at)
  });
}

function normalizeIssue(input: unknown): GitHubIssue {
  if (!isObject(input)) throw new GitHubIntegrationError("github_response_invalid", "GitHub 返回的 Issue 信息格式无效。", 502);
  return Object.freeze({
    number: readBoundedInteger(input.number, 1, Number.MAX_SAFE_INTEGER, "GitHub Issue 编号无效。"),
    title: readString(input.title, 500),
    state: typeof input.state === "string" ? input.state.slice(0, 40) : "unknown",
    author: isObject(input.user) && typeof input.user.login === "string" ? input.user.login.slice(0, 128) : null,
    url: readGitHubUrl(input.html_url),
    updatedAt: validDateString(input.updated_at),
    labels: Array.isArray(input.labels) ? input.labels.slice(0, 30).flatMap(label => isObject(label) && typeof label.name === "string" ? [label.name.slice(0, 100)] : []) : []
  });
}

function normalizePullRequest(input: unknown): GitHubPullRequest {
  if (!isObject(input) || !isObject(input.base) || !isObject(input.head)) throw new GitHubIntegrationError("github_response_invalid", "GitHub 返回的 Pull Request 信息格式无效。", 502);
  return Object.freeze({ ...normalizeIssue(input), baseBranch: typeof input.base.ref === "string" ? input.base.ref.slice(0, 255) : "", headBranch: typeof input.head.ref === "string" ? input.head.ref.slice(0, 255) : "" });
}

function parseRepository(value: string): { owner: string; name: string } {
  const match = /^([A-Za-z0-9_.-]{1,100})\/([A-Za-z0-9_.-]{1,100})$/u.exec(value);
  if (!match) throw new GitHubIntegrationError("invalid_repository", "仓库必须使用 owner/name 格式。", 400);
  return { owner: match[1]!, name: match[2]! };
}
function readVerificationUri(value: unknown): string {
  if (typeof value !== "string") throw new GitHubIntegrationError("github_response_invalid", "GitHub Device Flow 验证地址无效。", 502);
  let url: URL;
  try { url = new URL(value); } catch { throw new GitHubIntegrationError("github_response_invalid", "GitHub Device Flow 验证地址无效。", 502); }
  if (url.origin !== "https://github.com" || url.pathname !== "/login/device" || url.search || url.hash || url.username || url.password) {
    throw new GitHubIntegrationError("github_response_invalid", "GitHub Device Flow 验证地址无效。", 502);
  }
  return url.toString();
}
function readGitHubUrl(value: unknown): string {
  if (typeof value !== "string") throw new GitHubIntegrationError("github_response_invalid", "GitHub 返回的网页地址无效。", 502);
  let url: URL;
  try { url = new URL(value); } catch { throw new GitHubIntegrationError("github_response_invalid", "GitHub 返回的网页地址无效。", 502); }
  if (url.origin !== "https://github.com" || url.username || url.password || url.search || url.hash) throw new GitHubIntegrationError("github_response_invalid", "GitHub 返回的网页地址无效。", 502);
  return url.toString();
}
function validDateString(value: unknown): string {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : "";
}
function readString(value: unknown, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max || value.includes("\0")) throw new GitHubIntegrationError("github_response_invalid", "GitHub 返回了无效授权信息。", 502);
  return value;
}
function optionalToken(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  return readString(value, 16_384);
}
function readBoundedInteger(value: unknown, min: number, max: number, message: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw new GitHubIntegrationError("github_response_invalid", message, 502);
  return value;
}
function optionalBoundedInteger(value: unknown, min: number, max: number): number | null {
  if (value === undefined || value === null) return null;
  return readBoundedInteger(value, min, max, "GitHub 返回的授权有效期无效。");
}
function parseScopes(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return [...new Set(value.split(/[ ,]+/u).filter(scope => /^[A-Za-z0-9:_-]{1,80}$/u.test(scope)))].slice(0, 64);
}
function hasNextPage(link: string | null): boolean {
  return Boolean(link?.split(",").some(entry => /;\s*rel="next"/u.test(entry)));
}
function oauthErrorMessage(code: string): string {
  return code === "incorrect_client_credentials" || code === "device_flow_disabled"
    ? "GitHub App 的 Device Flow 配置无效。请管理员检查应用设置。"
    : "GitHub 授权未完成，请重新开始连接。";
}
function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function requestSignal(signal?: AbortSignal): AbortSignal {
  return signal ? AbortSignal.any([signal, AbortSignal.timeout(requestTimeoutMs)]) : AbortSignal.timeout(requestTimeoutMs);
}
async function readJson(response: Response): Promise<unknown> {
  try { return await response.json() as unknown; } catch { return null; }
}

export const name = "lfaaGithubIntegration";
export const inject = ["lfaaCredentials"];
declare module "@deepseek-ai/cordis" { interface Context { lfaaGithubIntegration: GitHubIntegrationService } }

export function apply(ctx: Context): void {
  const consumer: CredentialConsumer = ctx.lfaaCredentials.createConsumer(ctx);
  const referenceForAccount = () => reference;
  const unregisterRecordOwner = ctx.lfaaCredentials.registerRecordOwner(ctx, ["lfaa-api-github-connection-controller"]);
  const service = createGitHubIntegrationService({
    clientId: config.githubApp.clientId,
    clientSecret: config.githubApp.clientSecret,
    credentials: {
      read: ownerId => consumer.readRecord(ownerId, referenceForAccount()),
      write: (ownerId, payload) => ctx.lfaaCredentials.commitRecord(ctx, ownerId, referenceForAccount(), { kind: "grant", payload }),
      delete: ownerId => ctx.lfaaCredentials.deleteRecord(ctx, ownerId, referenceForAccount())
    }
  });
  ctx.provide(name, service);
  ctx.effect(() => () => { service.close(); unregisterRecordOwner(); });
}
