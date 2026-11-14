/** 功能：提供 Workspace 项目、目录、Git 操作和知识库来源的认证请求适配；真实文件与仓库仍由 Workspace/Host Owner 管理。 */
import type { ApplicationId, WorkspaceProjectContextApplicationId } from "lfaa-util-values/src/application-id.js";
import type { KnowledgeLibraryItem, KnowledgeLibraryItemSummary, KnowledgeLibraryKind, KnowledgeLibraryProjectSource, KnowledgeLibraryScope, KnowledgeLibraryUsage, WorkspaceDaemonNode, WorkspaceGitFileDiff, WorkspaceGitOperationInput, WorkspaceGitOperationResult, WorkspaceGitStatus, WorkspaceProject, WorkspaceProjectApplicationId, WorkspaceProjectGitSummaryFolder, WorkspaceProjectTextFile } from "./workspace-types.js";
import { request } from "./http-client.js";

export function loadWorkspaceProjects(options: { appId?: WorkspaceProjectApplicationId; query?: string; signal?: AbortSignal } = {}): Promise<{ projects: WorkspaceProject[]; nodes: WorkspaceDaemonNode[]; truncated: boolean; defaultProjectId?: string | null }> {
  const parameters = new URLSearchParams();
  if (options.appId) parameters.set("appId", options.appId);
  if (options.query?.trim()) parameters.set("query", options.query.trim());
  const suffix = parameters.size ? `?${parameters.toString()}` : "";
  return request<{ projects: WorkspaceProject[]; nodes: WorkspaceDaemonNode[]; truncated: boolean; defaultProjectId?: string | null }>(`/workspace/projects${suffix}`, options.signal ? { signal: options.signal } : {});
}

export function loadWorkspaceSessionDirectoryAvailability(sessionIds: string[], signal?: AbortSignal): Promise<{ sessions: Record<string, "available" | "missing" | "unknown"> }> {
  return request<{ sessions: Record<string, "available" | "missing" | "unknown"> }>("/workspace/sessions/directory-availability", {
    method: "POST",
    body: JSON.stringify({ sessionIds }),
    ...(signal ? { signal } : {})
  });
}

export function initializeDefaultWorkspace(signal?: AbortSignal): Promise<{ project: WorkspaceProject | null; defaultProjectId: string | null }> {
  return request<{ project: WorkspaceProject | null; defaultProjectId: string | null }>("/workspace/projects/initialize-default", { method: "POST", ...(signal ? { signal } : {}) });
}

export function loadKnowledgeLibrary(applicationId?: ApplicationId): Promise<{ items: KnowledgeLibraryItemSummary[]; sources: KnowledgeLibraryProjectSource[]; usage: KnowledgeLibraryUsage }> {
  const suffix = applicationId ? `?applicationId=${encodeURIComponent(applicationId)}` : "";
  return request<{ items: KnowledgeLibraryItemSummary[]; sources: KnowledgeLibraryProjectSource[]; usage: KnowledgeLibraryUsage }>(`/knowledge/items${suffix}`);
}

export function loadKnowledgeLibraryItem(id: string, applicationId: ApplicationId): Promise<{ item: KnowledgeLibraryItem }> {
  return request<{ item: KnowledgeLibraryItem }>(`/knowledge/items/${encodeURIComponent(id)}?applicationId=${encodeURIComponent(applicationId)}`);
}

export function createKnowledgeLibraryItem(input: { applicationId: KnowledgeLibraryScope; kind: KnowledgeLibraryKind; title: string; description: string; contentMarkdown: string; sourceKind: "upload" | "manual" }): Promise<{ item: KnowledgeLibraryItem }> {
  return request<{ item: KnowledgeLibraryItem }>("/knowledge/items", { method: "POST", body: JSON.stringify(input) });
}

export function updateKnowledgeLibraryItem(id: string, input: { applicationId: ApplicationId; title: string; description: string; contentMarkdown: string; expectedContentSha256: string }): Promise<{ item: KnowledgeLibraryItem }> {
  return request<{ item: KnowledgeLibraryItem }>(`/knowledge/items/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function removeKnowledgeLibraryItem(id: string): Promise<void> {
  return request<void>(`/knowledge/items/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function createKnowledgeLibraryProjectSource(input: { applicationId: WorkspaceProjectApplicationId; projectId: string; projectApplicationId: WorkspaceProjectApplicationId; relativePath: string; title: string }): Promise<{ source: KnowledgeLibraryProjectSource }> {
  return request<{ source: KnowledgeLibraryProjectSource }>("/knowledge/sources", { method: "POST", body: JSON.stringify(input) });
}

export function removeKnowledgeLibraryProjectSource(id: string): Promise<void> {
  return request<void>(`/knowledge/sources/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function browseWorkspaceDirectory(appId: "minecraft", nodeId: string, operation: "home" | "list" | "create-directory", path?: string, name?: string): Promise<{ result: { path: string; root?: string; home?: string; roots?: string[]; entries?: string[]; truncated?: boolean; created?: boolean; name?: string } }> {
  return request<{ result: { path: string; root?: string; home?: string; roots?: string[]; entries?: string[]; truncated?: boolean; created?: boolean; name?: string } }>("/workspace/projects/browse", { method: "POST", body: JSON.stringify({ appId, nodeId, operation, ...(path ? { path } : {}), ...(name ? { name } : {}) }) });
}

export function createWorkspaceProject(appId: "minecraft", nodeId: string, path: string, title: string): Promise<{ project: WorkspaceProject }> {
  return request<{ project: WorkspaceProject }>("/workspace/projects", { method: "POST", body: JSON.stringify({ appId, nodeId, path, title }) });
}

export type WorkspaceProjectMemoryMode = "default" | "project_only";

export function createLocalWorkspaceProject(input: { title: string; parentPath: string; instructions: string; memoryMode: WorkspaceProjectMemoryMode; applicationIds?: WorkspaceProjectContextApplicationId[]; sourcePaths: string[] }): Promise<{ project: WorkspaceProject }> {
  return request<{ project: WorkspaceProject }>("/workspace/projects", { method: "POST", body: JSON.stringify({ appId: "workspace", ...input }) });
}

export function updateLocalWorkspaceProject(projectId: string, input: { title: string; instructions: string; memoryMode: WorkspaceProjectMemoryMode; applicationIds?: WorkspaceProjectContextApplicationId[]; sourcePaths: string[] }): Promise<{ project: WorkspaceProject }> {
  return request<{ project: WorkspaceProject }>(`/workspace/projects/${encodeURIComponent(projectId)}`, { method: "PATCH", body: JSON.stringify({ appId: "workspace", ...input }) });
}

export function replaceLocalWorkspaceProjectSources(projectId: string, paths: string[]): Promise<{ project: WorkspaceProject }> {
  return request<{ project: WorkspaceProject }>(`/workspace/projects/${encodeURIComponent(projectId)}/sources`, { method: "PUT", body: JSON.stringify({ appId: "workspace", paths }) });
}

export function browseLocalWorkspaceDirectory(operation: "home" | "list" | "inspect", path?: string): Promise<{ result: { path: string; root?: string; home?: string; roots?: string[]; entries?: string[]; truncated?: boolean; directory?: boolean } }> {
  return request<{ result: { path: string; root?: string; home?: string; roots?: string[]; entries?: string[]; truncated?: boolean; directory?: boolean } }>("/workspace/projects/local/browse", { method: "POST", body: JSON.stringify({ operation, ...(path ? { path } : {}) }) });
}

export function renameWorkspaceProject(projectId: string, title: string, appId: WorkspaceProjectApplicationId): Promise<{ project: WorkspaceProject }> {
  return request<{ project: WorkspaceProject }>(`/workspace/projects/${encodeURIComponent(projectId)}`, { method: "PATCH", body: JSON.stringify({ appId, title }) });
}

export function removeWorkspaceProject(projectId: string, deleteManagedWorktree: boolean, appId: WorkspaceProjectApplicationId): Promise<void> {
  return request<void>(`/workspace/projects/${encodeURIComponent(projectId)}`, { method: "DELETE", body: JSON.stringify({ appId, deleteManagedWorktree }) });
}

export function loadWorkspaceGitStatus(projectId: string, appId: WorkspaceProjectApplicationId, sourceId?: string, signal?: AbortSignal): Promise<{ status: WorkspaceGitStatus }> {
  return request<{ status: WorkspaceGitStatus }>(`/workspace/projects/${encodeURIComponent(projectId)}/git/status`, { method: "POST", body: JSON.stringify({ appId, ...(sourceId ? { sourceId } : {}) }), ...(signal ? { signal } : {}) });
}

export function loadWorkspaceProjectGitSummary(projectId: string, signal?: AbortSignal): Promise<{ folders: WorkspaceProjectGitSummaryFolder[] }> {
  return request<{ folders: WorkspaceProjectGitSummaryFolder[] }>(`/workspace/projects/${encodeURIComponent(projectId)}/git/summary`, {
    method: "POST", body: JSON.stringify({ appId: "workspace" }), ...(signal ? { signal } : {})
  });
}

export function initializeWorkspaceGitRepository(projectId: string, appId: WorkspaceProjectApplicationId, sourceId?: string): Promise<{ status: WorkspaceGitStatus }> {
  return request<{ status: WorkspaceGitStatus }>(`/workspace/projects/${encodeURIComponent(projectId)}/git/initialize`, { method: "POST", body: JSON.stringify({ appId, ...(sourceId ? { sourceId } : {}) }) });
}

export function runWorkspaceGitOperation(projectId: string, appId: WorkspaceProjectApplicationId, input: WorkspaceGitOperationInput): Promise<WorkspaceGitOperationResult> {
  return request<WorkspaceGitOperationResult>(`/workspace/projects/${encodeURIComponent(projectId)}/git/operation`, { method: "POST", body: JSON.stringify({ appId, ...input }) });
}

export function loadWorkspaceGitFileDiff(projectId: string, appId: WorkspaceProjectApplicationId, path: string, options: { sourceId?: string; ignoreWhitespace?: boolean; wordDiff?: boolean; contextLines?: number; signal?: AbortSignal } = {}): Promise<{ file: WorkspaceGitFileDiff }> {
  const { signal, ...parameters } = options;
  return request<{ file: WorkspaceGitFileDiff }>(`/workspace/projects/${encodeURIComponent(projectId)}/git/file-diff`, { method: "POST", body: JSON.stringify({ appId, path, ignoreWhitespace: parameters.ignoreWhitespace === true, wordDiff: parameters.wordDiff === true, ...(parameters.contextLines === undefined ? {} : { contextLines: parameters.contextLines }), ...(parameters.sourceId ? { sourceId: parameters.sourceId } : {}) }), ...(signal ? { signal } : {}) });
}

export function readWorkspaceProjectTextFile(projectId: string, appId: WorkspaceProjectApplicationId, path: string, offset = 0, limit = 40000, sourceId?: string, signal?: AbortSignal): Promise<{ file: WorkspaceProjectTextFile }> {
  return request<{ file: WorkspaceProjectTextFile }>(`/workspace/projects/${encodeURIComponent(projectId)}/files/read`, { method: "POST", body: JSON.stringify({ appId, path, offset, limit, ...(sourceId ? { sourceId } : {}) }), ...(signal ? { signal } : {}) });
}

export function writeWorkspaceProjectTextFile(projectId: string, appId: WorkspaceProjectApplicationId, path: string, content: string, sha256: string, sourceId?: string): Promise<{ result: { path: string; sha256: string; changed: boolean; bytes: number } }> {
  return request<{ result: { path: string; sha256: string; changed: boolean; bytes: number } }>(`/workspace/projects/${encodeURIComponent(projectId)}/files/write`, { method: "POST", body: JSON.stringify({ appId, path, content, sha256, ...(sourceId ? { sourceId } : {}) }) });
}

export function createWorkspaceGitWorktree(projectId: string, appId: WorkspaceProjectApplicationId): Promise<{ project: WorkspaceProject }> {
  return request<{ project: WorkspaceProject }>(`/workspace/projects/${encodeURIComponent(projectId)}/git/worktrees`, { method: "POST", body: JSON.stringify({ appId }) });
}

export function resetWorkspaceGitWorktree(projectId: string, appId: WorkspaceProjectApplicationId): Promise<{ status: WorkspaceGitStatus }> {
  return request<{ status: WorkspaceGitStatus }>(`/workspace/projects/${encodeURIComponent(projectId)}/git/reset`, { method: "POST", body: JSON.stringify({ appId }) });
}

