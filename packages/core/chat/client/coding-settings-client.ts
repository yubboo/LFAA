// 客户端访问「设置 → 编码（Git 与代码审查）」与内置 Git / 审查接口的类型与请求函数。
export type PrMergeMethod = "merge" | "squash";
export type ReviewDisplayMode = "inline" | "separate";
export type ReviewTriggerCondition = "on_pr_open" | "on_push" | "manual";
export type RepoAutoReviewMode = "inherit" | "enabled" | "disabled";
export type RepoProviderKind = "local" | "github";
export type ReviewAgentFocus = "balanced" | "security" | "performance" | "strict";

/** 定义浏览器端 Git 表单与 Host 设置接口交换的字段。 */
export interface GitCodingSettings {
  branchPrefix: string;
  prMergeMethod: PrMergeMethod;
  alwaysForcePush: boolean;
  createDraftPr: boolean;
  reviewDisplayMode: ReviewDisplayMode;
  commitInstructions: string;
  prInstructions: string;
}

/** 定义审查偏好表单及其持久化数据。 */
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

/** 归集分支、暂存变更及提交历史，便于审查界面统一刷新。 */
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

/** 定义从 Host 返回并在历史清单中展示的审查结果。 */
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

/** 提供 Host 设置尚未加载时使用的浏览器表单初值。 */
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

/** 从 Host 读取已保存的编码设置。 */
export async function fetchCodingSettings(): Promise<CodingSettingsConfig> {
  const res = await requestJson<{ settings: CodingSettingsConfig }>("/api/chat/coding-settings");
  return res.settings;
}

/** 把编辑过的设置字段提交给 Host，由 Host 合并持久化。 */
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

/** 查询项目目录中的 Git 仓库候选项。 */
export async function fetchDiscoveredGitRepos(): Promise<GitRepoDiscoveryItem[]> {
  const res = await requestJson<{ repos: GitRepoDiscoveryItem[] }>("/api/git/repos");
  return res.repos;
}

/** 读取指定仓库的分支、变更和历史快照。 */
export async function fetchGitStatus(projectId?: string | null): Promise<GitStatusSnapshot> {
  const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  const res = await requestJson<{ status: GitStatusSnapshot }>(`/api/git/status${q}`);
  return res.status;
}

/** 查询当前范围的差异文本，供差异视图着色与定位。 */
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

/** 请求 Host 暂存选择的文件，并取得操作后的状态。 */
export async function postGitStage(projectId: string | null | undefined, files: string[] | "all") {
  const res = await requestJson<{ status: GitStatusSnapshot }>("/api/git/stage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...(projectId ? { projectId } : {}), files }),
  });
  return res.status;
}

/** 请求 Host 取消暂存，保留当前工作树内容。 */
export async function postGitUnstage(projectId: string | null | undefined, files: string[] | "all") {
  const res = await requestJson<{ status: GitStatusSnapshot }>("/api/git/unstage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...(projectId ? { projectId } : {}), files }),
  });
  return res.status;
}

/** 根据用户请求切换现有分支或创建分支。 */
export async function postGitBranch(options: { projectId?: string | null; name: string; create?: boolean }) {
  const res = await requestJson<{ status: GitStatusSnapshot }>("/api/git/branch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });
  return res.status;
}

/** 请求 Host 根据仓库状态生成可编辑的提交说明。 */
export async function postGitCommitDraft(projectId?: string | null) {
  const res = await requestJson<{ draft: { message: string; appliedInstructions: string } }>("/api/git/commit-draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...(projectId ? { projectId } : {}) }),
  });
  return res.draft;
}

/** 提交当前暂存区，使用用户确认的提交文本。 */
export async function postGitCommit(projectId: string | null | undefined, message: string) {
  return requestJson<{ commitHash: string; status: GitStatusSnapshot }>("/api/git/commit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...(projectId ? { projectId } : {}), message }),
  });
}

/** 请求生成 PR 草案供浏览器展示。 */
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

/** 根据已选文件向 Host 提交撤销工作区变更的请求。 */
export async function postGitRevertFiles(projectId: string | null | undefined, files: string[]) {
  return requestJson<{ reverted: string[]; status: GitStatusSnapshot }>("/api/git/revert-files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...(projectId ? { projectId } : {}), files }),
  });
}

/** 载入已保存的审查报告历史。 */
export async function fetchCodeReviewReports(): Promise<CodeReviewReport[]> {
  const res = await requestJson<{ reports: CodeReviewReport[] }>("/api/code-review/reports");
  return res.reports;
}

/** 启动指定范围的差异审查，并返回新报告。 */
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
