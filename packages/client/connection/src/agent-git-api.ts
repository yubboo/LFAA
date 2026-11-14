/**
 * Agent Git 账户仓库、会话绑定与固定 Git 操作端点适配。
 */
import { request, requestBinary } from "./http-client.js";
import type { WorkspaceGitFileDiff, WorkspaceGitOperationInput, WorkspaceGitOperationResult, WorkspaceGitStatus, WorkspaceProjectTextFile } from "./workspace-types.js";



export interface AgentGitRepository {
  id: string;
  userId: string;
  path: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}


export interface AgentDeliverable {
  id: string;
  userId: string;
  repositoryId: string;
  sessionId: string;
  sessionTitle?: string;
  path: string;
  title: string;
  artifactKind: "minecraft-plugin" | "minecraft-mod" | "other";
  fileName: string;
  sha256: string;
  sizeBytes: number;
  modifiedAt: string;
  publishedAt: string;
}


export function loadAgentGitRepositories(signal?: AbortSignal): Promise<{ repositories: AgentGitRepository[] }> {
  return request("/agent/git/repositories", signal ? { signal } : {});
}


export function loadAgentDeliverables(repositoryId: string, signal?: AbortSignal): Promise<{ deliverables: AgentDeliverable[] }> {
  return request(`/agent/git/repositories/${encodeURIComponent(repositoryId)}/deliverables`, signal ? { signal } : {});
}


export function checkAgentDeliverableDownload(deliverableId: string): Promise<void> {
  return requestBinary(`/agent/git/deliverables/${encodeURIComponent(deliverableId)}/download`, { method: "HEAD" }).then(() => undefined);
}


export function registerAgentGitRepository(path: string, title = ""): Promise<{ repository: AgentGitRepository }> {
  return request("/agent/git/repositories", { method: "POST", body: JSON.stringify({ path, title }) });
}


export function removeAgentGitRepository(repositoryId: string): Promise<void> {
  return request(`/agent/git/repositories/${encodeURIComponent(repositoryId)}`, { method: "DELETE" });
}


export function loadAgentGitSessionRepository(sessionId: string): Promise<{ repository: AgentGitRepository | null }> {
  return request(`/agent/git/sessions/${encodeURIComponent(sessionId)}/repository`);
}


export function ensureAgentGitSessionRepository(sessionId: string): Promise<{ repository: AgentGitRepository | null }> {
  return request(`/agent/git/sessions/${encodeURIComponent(sessionId)}/repository/ensure`, { method: "POST" });
}


export function bindAgentGitSessionRepository(sessionId: string, repositoryId: string | null): Promise<{ repository: AgentGitRepository | null }> {
  return request(`/agent/git/sessions/${encodeURIComponent(sessionId)}/repository`, { method: "PUT", body: JSON.stringify({ repositoryId }) });
}


export function loadAgentGitStatus(repositoryId: string, signal?: AbortSignal): Promise<{ status: WorkspaceGitStatus }> {
  return request(`/agent/git/repositories/${encodeURIComponent(repositoryId)}/status`, { method: "POST", ...(signal ? { signal } : {}) });
}


export function loadAgentGitFileDiff(repositoryId: string, path: string, options: { ignoreWhitespace?: boolean; wordDiff?: boolean; contextLines?: number; signal?: AbortSignal } = {}): Promise<{ diff: WorkspaceGitFileDiff }> {
  const { signal, ...parameters } = options;
  return request(`/agent/git/repositories/${encodeURIComponent(repositoryId)}/file-diff`, { method: "POST", body: JSON.stringify({ path, ...parameters }), ...(signal ? { signal } : {}) });
}


export function loadAgentGitFile(repositoryId: string, path: string, options: { offset?: number; limit?: number } = {}): Promise<{ file: WorkspaceProjectTextFile }> {
  return request(`/agent/git/repositories/${encodeURIComponent(repositoryId)}/file`, { method: "POST", body: JSON.stringify({ operation: "read", path, ...options }) });
}


export function saveAgentGitFile(repositoryId: string, path: string, content: string, sha256: string): Promise<{ file: WorkspaceProjectTextFile }> {
  return request(`/agent/git/repositories/${encodeURIComponent(repositoryId)}/file`, { method: "POST", body: JSON.stringify({ operation: "write", path, content, sha256 }) });
}


export function initializeAgentGitRepository(repositoryId: string): Promise<{ status: WorkspaceGitStatus }> {
  return request(`/agent/git/repositories/${encodeURIComponent(repositoryId)}/initialize`, { method: "POST" });
}


export function runAgentGitOperation(repositoryId: string, input: WorkspaceGitOperationInput): Promise<WorkspaceGitOperationResult> {
  return request(`/agent/git/repositories/${encodeURIComponent(repositoryId)}/operation`, { method: "POST", body: JSON.stringify(input) });
}


export function saveAgentGitRemoteCredential(repositoryId: string, remote: string, username: string, token: string): Promise<void> {
  return request(`/agent/git/repositories/${encodeURIComponent(repositoryId)}/remotes/${encodeURIComponent(remote)}/credential`, {
    method: "PUT", body: JSON.stringify({ username, token })
  });
}


export function removeAgentGitRemoteCredential(repositoryId: string, remote: string): Promise<void> {
  return request(`/agent/git/repositories/${encodeURIComponent(repositoryId)}/remotes/${encodeURIComponent(remote)}/credential`, { method: "DELETE" });
}


export function agentDeliverableDownloadUrl(deliverableId: string): string {
  return `/api/agent/git/deliverables/${encodeURIComponent(deliverableId)}/download`;
}
