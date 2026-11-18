// 客户端访问「设置 → 编码（Git 与代码审查）」与内置 Git / 审查接口的类型与请求函数。
export type PrMergeMethod = "merge" | "squash";
export type ReviewDisplayMode = "inline" | "separate";
export type ReviewTriggerCondition = "on_pr_open" | "on_push" | "manual";
export type RepoAutoReviewMode = "inherit" | "enabled" | "disabled";
export type RepoProviderKind = "local" | "github";
export type ReviewAgentFocus = "balanced" | "security" | "performance" | "strict";

export interface GitCodingSettings {
  branchPrefix: string;
  prMergeMethod: PrMergeMethod;
  alwaysForcePush: boolean;
  createDraftPr: boolean;
  reviewDisplayMode: ReviewDisplayMode;
  commitInstructions: string;
  prInstructions: string;
}

export interface CodeReviewCodingSettings {
  activeSubTab: "preferences" | "agent";
  repoProvider: RepoProviderKind;
  autoReview: boolean;
  triggerCondition: ReviewTriggerCondition;
  thoroughReview: boolean;
  useQuotaForReview: boolean;
  reviewAgentFocus: ReviewAgentFocus;
  customReviewInstructions: string;
  repoOverrides: Record<string, RepoAutoReviewMode>;
}

export interface CodingSettingsConfig {
  schemaVersion: number;
  git: GitCodingSettings;
  codeReview: CodeReviewCodingSettings;
  updatedAt: number;
}

export interface GitChangedFile {
  path: string;
  indexStatus: string;
  workTreeStatus: string;
  staged: boolean;
  unstaged: boolean;
  untracked: boolean;
  displayCode: string;
}

export interface GitBranchInfo {
  name: string;
  current: boolean;
}

export interface GitCommitSummary {
  hash: string;
  shortHash: string;
  subject: string;
  author: string;
  date: string;
}

export interface GitRepoDiscoveryItem {
  id: string;
  slug: string;
  name: string;
  rootPath: string;
  remoteUrl: string;
  provider: "github" | "local";
  branch: string;
  dirtyCount: number;
  projectId?: string;
}

export interface GitStatusSnapshot {
  isGitRepo: boolean;
  gitAvailable: boolean;
  repoRoot: string;
  repoSlug: string;
  remoteUrl: string;
  branch: string;
  branches: GitBranchInfo[];
  ahead: number;
  behind: number;
  files: GitChangedFile[];
  commits: GitCommitSummary[];
  error?: string;
}

export interface CodeReviewFinding {
  id: string;
  severity: "critical" | "warning" | "info";
  file: string;
  line?: number;
  title: string;
  detail: string;
  suggestion: string;
}

export interface CodeReviewReport {
  id: string;
  repoRoot: string;
  repoSlug: string;
  branch: string;
  scope: "working_tree" | "staged" | "commit";
  commitHash?: string;
  focus: string;
  thorough: boolean;
  filesReviewed: number;
  additions: number;
  deletions: number;
  summary: string;
  findings: CodeReviewFinding[];
  createdAt: number;
}

export function createDefaultCodingSettingsClient(): CodingSettingsConfig {
  return {
    schemaVersion: 1,
    git: {
      branchPrefix: "lfaa/",
      prMergeMethod: "merge",
      alwaysForcePush: false,
      createDraftPr: true,
      reviewDisplayMode: "inline",
      commitInstructions: "",
      prInstructions: "",
    },
    codeReview: {
      activeSubTab: "preferences",
      repoProvider: "local",
      autoReview: false,
      triggerCondition: "on_pr_open",
      thoroughReview: false,
      useQuotaForReview: false,
      reviewAgentFocus: "balanced",
      customReviewInstructions: "",
      repoOverrides: {},
    },
    updatedAt: 0,
  };
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `请求失败 (${res.status})`);
  }
  return data;
}

export async function fetchCodingSettings(): Promise<CodingSettingsConfig> {
  const res = await requestJson<{ settings: CodingSettingsConfig }>("/api/chat/coding-settings");
  return res.settings;
}

export async function patchCodingSettings(
  patch: Partial<{ git: Partial<GitCodingSettings>; codeReview: Partial<CodeReviewCodingSettings> }>,
): Promise<CodingSettingsConfig> {
  const res = await requestJson<{ settings: CodingSettingsConfig }>("/api/chat/coding-settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return res.settings;
}

export async function fetchDiscoveredGitRepos(): Promise<GitRepoDiscoveryItem[]> {
  const res = await requestJson<{ repos: GitRepoDiscoveryItem[] }>("/api/git/repos");
  return res.repos;
}

export async function fetchGitStatus(projectId?: string | null): Promise<GitStatusSnapshot> {
  const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  const res = await requestJson<{ status: GitStatusSnapshot }>(`/api/git/status${q}`);
  return res.status;
}

export async function fetchGitDiff(options: {
  projectId?: string | null;
  filePath?: string;
  staged?: boolean;
  commitHash?: string;
}): Promise<{ diff: string; stat: string }> {
  const sp = new URLSearchParams();
  if (options.projectId) sp.set("projectId", options.projectId);
  if (options.filePath) sp.set("filePath", options.filePath);
  if (options.commitHash) sp.set("commitHash", options.commitHash);
  if (options.staged) sp.set("staged", "1");
  const qs = sp.toString();
  return requestJson<{ diff: string; stat: string }>(`/api/git/diff${qs ? `?${qs}` : ""}`);
}

export async function postGitStage(projectId: string | null | undefined, files: string[] | "all") {
  const res = await requestJson<{ status: GitStatusSnapshot }>("/api/git/stage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...(projectId ? { projectId } : {}), files }),
  });
  return res.status;
}

export async function postGitUnstage(projectId: string | null | undefined, files: string[] | "all") {
  const res = await requestJson<{ status: GitStatusSnapshot }>("/api/git/unstage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...(projectId ? { projectId } : {}), files }),
  });
  return res.status;
}

export async function postGitBranch(options: { projectId?: string | null; name: string; create?: boolean }) {
  const res = await requestJson<{ status: GitStatusSnapshot }>("/api/git/branch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });
  return res.status;
}

export async function postGitCommitDraft(projectId?: string | null) {
  const res = await requestJson<{ draft: { message: string; appliedInstructions: string } }>("/api/git/commit-draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...(projectId ? { projectId } : {}) }),
  });
  return res.draft;
}

export async function postGitCommit(projectId: string | null | undefined, message: string) {
  return requestJson<{ commitHash: string; status: GitStatusSnapshot }>("/api/git/commit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...(projectId ? { projectId } : {}), message }),
  });
}

export async function postGitPrDraft(projectId?: string | null) {
  const res = await requestJson<{
    draft: { title: string; body: string; mergeMethod: string; draft: boolean; pushCommand: string };
  }>("/api/git/pr-draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...(projectId ? { projectId } : {}) }),
  });
  return res.draft;
}

export async function postGitRevertFiles(projectId: string | null | undefined, files: string[]) {
  return requestJson<{ reverted: string[]; status: GitStatusSnapshot }>("/api/git/revert-files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...(projectId ? { projectId } : {}), files }),
  });
}

export async function fetchCodeReviewReports(): Promise<CodeReviewReport[]> {
  const res = await requestJson<{ reports: CodeReviewReport[] }>("/api/code-review/reports");
  return res.reports;
}

export async function postRunCodeReview(options: {
  projectId?: string | null;
  scope?: "working_tree" | "staged" | "commit";
  commitHash?: string;
}): Promise<CodeReviewReport> {
  const res = await requestJson<{ report: CodeReviewReport }>("/api/code-review/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });
  return res.report;
}
