import type { ApplicationId, WorkspaceProjectContextApplicationId } from "lfaa-util-values/src/application-id.js";

export type WorkspaceProjectApplicationId = "workspace" | "minecraft";

export interface WorkspaceProject {
  id: string;
  userId: string;
  appId: WorkspaceProjectApplicationId | null;
  applicationIds: WorkspaceProjectContextApplicationId[];
  nodeId: string | null;
  path: string;
  title: string;
  instructions: string;
  memoryMode: "default" | "project_only";
  sources: Array<{ id: string; path: string; position: number }>;
  createdAt: string;
  updatedAt: string;
  gitWorktree: { projectId: string; sourceProjectId: string; nodeId: string; worktreeId: string; worktreeRoot: string; projectRelativePath: string; branch: string; baseCommit: string; sourceHead: string; createdAt: string } | null;
}

export type KnowledgeLibraryKind = "knowledge" | "skill" | "prompt" | "expert";
export type KnowledgeLibraryScope = ApplicationId | "all";

export interface KnowledgeLibraryItemSummary {
  id: string;
  applicationId: KnowledgeLibraryScope;
  kind: KnowledgeLibraryKind;
  title: string;
  description: string;
  contentSha256: string;
  sourceKind: "upload" | "conversation" | "manual";
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeLibraryItem extends KnowledgeLibraryItemSummary {
  contentMarkdown: string;
}

export interface KnowledgeLibraryProjectSource {
  id: string;
  applicationId: KnowledgeLibraryScope;
  projectId: string;
  projectApplicationId: WorkspaceProjectApplicationId;
  relativePath: string;
  title: string;
  createdAt: string;
}

export interface KnowledgeLibraryUsage {
  resources: number;
  limit: number;
}

export interface WorkspaceDaemonNode {
  id: string;
  displayName: string;
  platform: string;
  architecture: string;
  version: string;
  status: "online" | "offline";
  lastSeenAt: string;
  local?: boolean;
}

export interface WorkspaceGitStatus {
  repositoryState: "not-repository" | "unborn" | "ready";
  repository: string | null;
  projectRelativePath: string;
  worktreeId: string | null;
  branch: string;
  upstream: string | null;
  ahead: number;
  behind: number;
  remotes: string[];
  authenticatedRemotes?: string[];
  credentialCapableRemotes?: string[];
  syncCapableRemotes?: string[];
  head: string | null;
  baseline: string | null;
  clean: boolean;
  changedFileCount: number;
  shownFileCount: number;
  files: Array<{ status: string; path: string; projectPath: string; displayPath: string; insertions: number | null; deletions: number | null }>;
  insertions: number;
  deletions: number;
  unknownLineCounts: number;
  diff: string;
  diffTruncated: boolean;
  statusTruncated: boolean;
}

export interface WorkspaceGitSummaryStatus {
  repositoryState: "not-repository" | "unborn" | "ready";
  repository: string | null;
  projectRelativePath: string;
  worktreeId: string | null;
  branch: string;
  clean: boolean;
  changedFileCount: number;
  insertions: number;
  deletions: number;
  unknownLineCounts: number;
}

export interface WorkspaceProjectGitSummaryFolder {
  sourceId: string | null;
  path: string;
  position: number;
  isPrimary: boolean;
  status?: WorkspaceGitSummaryStatus;
  error?: string;
}

export interface WorkspaceGitCommit {
  hash: string;
  shortHash: string;
  subject: string;
  author: string;
  authoredAt: string;
  parents: string[];
}

export interface WorkspaceGitBranch {
  name: string;
  head: string;
  current: boolean;
}

export type WorkspaceGitOperationInput =
  | { operation: "stage" | "unstage"; paths?: string[]; sourceId?: string }
  | { operation: "commit"; message: string; sourceId?: string }
  | { operation: "history"; limit?: number; sourceId?: string }
  | { operation: "branches"; sourceId?: string }
  | { operation: "branch-create" | "branch-switch" | "branch-delete"; branch: string; sourceId?: string }
  | { operation: "fetch"; remote?: string }
  | { operation: "pull" | "push" }
  | { operation: "push-upstream" | "remote-remove"; remote: string }
  | { operation: "remote-add"; remote: string; url: string; username?: string; token?: string };

export type WorkspaceGitOperationResult =
  | { status: WorkspaceGitStatus }
  | { commits: WorkspaceGitCommit[] }
  | { branches: WorkspaceGitBranch[]; head: string | null };

export interface WorkspaceGitFileDiff {
  path: string;
  status: string;
  diff: string;
  diffTruncated: boolean;
  wordDiff: boolean;
  ignoreWhitespace: boolean;
}

export interface WorkspaceProjectTextFile {
  path: string;
  content: string;
  offset: number;
  totalCharacters: number;
  truncated: boolean;
  sha256: string;
}
