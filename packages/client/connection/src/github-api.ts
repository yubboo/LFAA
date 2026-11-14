/**
 * GitHub Integration Connection DTO 与授权/只读请求适配。
 */
import { request } from "./http-client.js";



export interface GitHubConnectionStatus {
  configured: boolean;
  connected: boolean;
  login: string | null;
  connectedAt: string | null;
  expiresAt: string | null;
  remoteRevocationAvailable: boolean;
}

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

export interface GitHubPullRequest extends GitHubIssue { baseBranch: string; headBranch: string }


export function getGitHubConnectionStatus(signal?: AbortSignal): Promise<{ connection: GitHubConnectionStatus }> {
  return request("/integrations/github/status", signal ? { signal } : {});
}

export function beginGitHubAuthorization(): Promise<{ device: { attemptId: string; verificationUri: string; userCode: string; expiresAt: string; intervalSeconds: number } }> {
  return request("/integrations/github/device", { method: "POST", body: "{}" });
}

export function pollGitHubAuthorization(attemptId: string, signal?: AbortSignal): Promise<{ result: { status: "pending"; retryAfterSeconds: number } | { status: "authorized"; login: string } | { status: "expired" } | { status: "cancelled" } }> {
  return request("/integrations/github/device/poll", { method: "POST", body: JSON.stringify({ attemptId }), ...(signal ? { signal } : {}) });
}

export function cancelGitHubAuthorization(attemptId: string): Promise<void> {
  return request(`/integrations/github/device/${encodeURIComponent(attemptId)}`, { method: "DELETE" });
}

export function disconnectGitHub(): Promise<{ disconnected: true; remoteRevoked: boolean }> {
  return request("/integrations/github", { method: "DELETE" });
}

export function listGitHubRepositories(page = 1, signal?: AbortSignal): Promise<{ repositories: GitHubRepository[]; truncated: boolean }> {
  const query = new URLSearchParams({ page: String(page) });
  return request(`/integrations/github/repositories?${query}`, signal ? { signal } : {});
}

export function listGitHubIssues(owner: string, name: string, signal?: AbortSignal): Promise<{ issues: GitHubIssue[] }> {
  return request(`/integrations/github/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/issues`, signal ? { signal } : {});
}

export function listGitHubPullRequests(owner: string, name: string, signal?: AbortSignal): Promise<{ pullRequests: GitHubPullRequest[] }> {
  return request(`/integrations/github/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/pulls`, signal ? { signal } : {});
}