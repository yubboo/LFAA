// 提供 LFAA 内置 Git 服务：仓储探测、状态与差异读取、分支切换/前缀新建、暂存与提交、PR 草案生成。
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve } from "node:path";
import { runGit, validateBranchName, validateSafeRelativeFile } from "./git-run";

// 差异读取、提交与 PR 草稿已拆到独立模块；这里保留同名再导出，导入方无需改动。
export { getGitDiff, type GitDiffOptions } from "./git-diff";
export { buildCommitDraft, buildPrDraft } from "./commit-drafts";

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

/** 供代码审查工作台共用的仓库状态快照，包含分支、变更和历史信息。 */
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

/** 为仓库清单提取远程仓库标识，无可识别远程时保留本地目录标识。 */
export function extractRepoSlug(remoteUrl: string, fallbackDir: string): { slug: string; provider: "github" | "local" } {
  const trimmed = remoteUrl.trim();
  if (trimmed) {
    const githubMatch = trimmed.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/iu);
    if (githubMatch?.[1]) {
      return { slug: githubMatch[1], provider: "github" };
    }
    const genericMatch = trimmed.match(/[:/]([^/]+\/[^/]+?)(?:\.git)?$/u);
    if (genericMatch?.[1]) {
      return { slug: genericMatch[1], provider: "local" };
    }
  }
  return { slug: basename(resolve(fallbackDir)) || "workspace", provider: "local" };
}

function parsePorcelainStatus(output: string): { branch: string; ahead: number; behind: number; files: GitChangedFile[] } {
  const lines = output.split(/\r?\n/u);
  let branch = "HEAD";
  let ahead = 0;
  let behind = 0;
  const files: GitChangedFile[] = [];

  for (const rawLine of lines) {
    if (!rawLine) continue;
    if (rawLine.startsWith("## ")) {
      const header = rawLine.slice(3);
      const branchPart = header.split("...")[0]?.trim() || header.trim();
      branch = branchPart.replace(/^No commits yet on\s+/iu, "") || "HEAD";
      const aheadMatch = header.match(/ahead\s+(\d+)/iu);
      const behindMatch = header.match(/behind\s+(\d+)/iu);
      ahead = aheadMatch ? Number(aheadMatch[1]) : 0;
      behind = behindMatch ? Number(behindMatch[1]) : 0;
      continue;
    }
    if (rawLine.length < 4) continue;
    const x = rawLine[0] ?? " ";
    const y = rawLine[1] ?? " ";
    let filePath = rawLine.slice(3).trim();
    if (filePath.includes(" -> ")) {
      filePath = filePath.split(" -> ").pop()?.trim() || filePath;
    }
    filePath = filePath.replace(/^"|"$/gu, "");
    const untracked = x === "?" && y === "?";
    const staged = !untracked && x !== " ";
    const unstaged = !untracked && y !== " ";
    files.push({
      path: filePath,
      indexStatus: x,
      workTreeStatus: y,
      staged,
      unstaged,
      untracked,
      displayCode: untracked ? "??" : `${x}${y}`.trim() || "M",
    });
  }
  return { branch, ahead, behind, files };
}

/** 从工作区候选目录发现 Git 仓库，形成设置页可选择的仓库清单。 */
export async function discoverGitRepositories(
  candidates: Array<{ rootPath: string; name?: string; projectId?: string }>,
): Promise<GitRepoDiscoveryItem[]> {
  const seenRoots = new Set<string>();
  const repos: GitRepoDiscoveryItem[] = [];

  for (const candidate of candidates) {
    const absRoot = resolve(candidate.rootPath);
    if (seenRoots.has(absRoot) || !existsSync(absRoot)) continue;
    try {
      const top = (await runGit(absRoot, ["rev-parse", "--show-toplevel"])).trim();
      const normalizedTop = resolve(top);
      if (seenRoots.has(normalizedTop)) continue;
      seenRoots.add(normalizedTop);

      const [remoteUrl, statusOut] = await Promise.all([
        runGit(normalizedTop, ["remote", "get-url", "origin"]).catch(() => ""),
        runGit(normalizedTop, ["status", "--porcelain=v1", "-b"]).catch(() => "## HEAD"),
      ]);
      const parsed = parsePorcelainStatus(statusOut);
      const slugInfo = extractRepoSlug(remoteUrl, normalizedTop);
      repos.push({
        id: candidate.projectId ? `project:${candidate.projectId}` : `repo:${normalizedTop}`,
        slug: slugInfo.slug,
        name: candidate.name || basename(normalizedTop),
        rootPath: normalizedTop,
        remoteUrl: remoteUrl.trim(),
        provider: slugInfo.provider,
        branch: parsed.branch,
        dirtyCount: parsed.files.length,
        ...(candidate.projectId ? { projectId: candidate.projectId } : {}),
      });
    } catch {
      // 非 Git 目录安全跳过
    }
  }
  return repos;
}

/** 查询仓库的分支及工作树状态，供提交、审查和刷新操作复用。 */
export async function getGitStatus(targetDir: string): Promise<GitStatusSnapshot> {
  const absDir = resolve(targetDir);
  try {
    const top = resolve((await runGit(absDir, ["rev-parse", "--show-toplevel"])).trim());
    const [remoteUrl, statusOut, branchesOut, logOut] = await Promise.all([
      runGit(top, ["remote", "get-url", "origin"]).catch(() => ""),
      runGit(top, ["status", "--porcelain=v1", "-b"]),
      runGit(top, ["branch", "--format=%(HEAD)%09%(refname:short)"]).catch(() => ""),
      runGit(top, ["log", "-n", "20", "--pretty=format:%H%x1f%h%x1f%s%x1f%an%x1f%ai"]).catch(() => ""),
    ]);

    const parsedStatus = parsePorcelainStatus(statusOut);
    const branches: GitBranchInfo[] = branchesOut
      .split(/\r?\n/u)
      .map((line) => line.trimEnd())
      .filter(Boolean)
      .map((line) => {
        const [marker, name] = line.split("\t");
        return { name: name ?? line.replace(/^\*\s*/u, ""), current: marker === "*" };
      })
      .filter((item) => item.name);

    const commits: GitCommitSummary[] = logOut
      .split(/\r?\n/u)
      .filter(Boolean)
      .map((line) => {
        const [hash, shortHash, subject, author, date] = line.split("\x1f");
        return {
          hash: hash ?? "",
          shortHash: shortHash ?? "",
          subject: subject ?? "",
          author: author ?? "",
          date: date ?? "",
        };
      });

    const slugInfo = extractRepoSlug(remoteUrl, top);
    return {
      isGitRepo: true,
      gitAvailable: true,
      repoRoot: top,
      repoSlug: slugInfo.slug,
      remoteUrl: remoteUrl.trim(),
      branch: parsedStatus.branch,
      branches,
      ahead: parsedStatus.ahead,
      behind: parsedStatus.behind,
      files: parsedStatus.files,
      commits,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const notGit = /not a git repository/iu.test(msg);
    return {
      isGitRepo: false,
      gitAvailable: !/ENOENT/iu.test(msg),
      repoRoot: absDir,
      repoSlug: basename(absDir),
      remoteUrl: "",
      branch: "",
      branches: [],
      ahead: 0,
      behind: 0,
      files: [],
      commits: [],
      error: notGit ? "当前目录尚未初始化 Git 仓库。" : msg,
    };
  }
}

/** 将指定变更加入 Git 暂存区，操作后返回新的仓库快照。 */
export async function stageGitFiles(repoRoot: string, files: string[] | "all"): Promise<GitStatusSnapshot> {
  const absRoot = resolve(repoRoot);
  if (files === "all") {
    await runGit(absRoot, ["add", "-A"]);
  } else if (files.length > 0) {
    const safeFiles = files.map((file) => validateSafeRelativeFile(absRoot, file));
    await runGit(absRoot, ["add", "--", ...safeFiles]);
  }
  return getGitStatus(absRoot);
}

/** 将指定变更移出 Git 暂存区，再返回当前仓库状态。 */
export async function unstageGitFiles(repoRoot: string, files: string[] | "all"): Promise<GitStatusSnapshot> {
  const absRoot = resolve(repoRoot);
  if (files === "all") {
    await runGit(absRoot, ["reset", "HEAD"]).catch(() => runGit(absRoot, ["rm", "--cached", "-r", "."]));
  } else if (files.length > 0) {
    const safeFiles = files.map((file) => validateSafeRelativeFile(absRoot, file));
    await runGit(absRoot, ["reset", "HEAD", "--", ...safeFiles]);
  }
  return getGitStatus(absRoot);
}

/** 根据请求切换或创建分支，使用 Git 的真实执行结果反馈界面。 */
export async function checkoutGitBranch(
  repoRoot: string,
  options: { name: string; create?: boolean; branchPrefix?: string },
): Promise<GitStatusSnapshot> {
  const absRoot = resolve(repoRoot);
  const rawName = options.name.trim();
  const fullName =
    options.create && options.branchPrefix && !rawName.startsWith(options.branchPrefix)
      ? `${options.branchPrefix}${rawName}`
      : rawName;
  const safeName = validateBranchName(fullName);
  const args = options.create ? ["checkout", "-b", safeName] : ["checkout", safeName];
  await runGit(absRoot, args);
  return getGitStatus(absRoot);
}

/** 使用用户提供的消息提交当前暂存区内容。 */
export async function commitGitChanges(
  repoRoot: string,
  message: string,
): Promise<{ commitHash: string; status: GitStatusSnapshot }> {
  const absRoot = resolve(repoRoot);
  const cleanMsg = message.trim();
  if (!cleanMsg) {
    throw new Error("提交信息不能为空。");
  }
  await runGit(absRoot, ["commit", "-m", cleanMsg]);
  const commitHash = (await runGit(absRoot, ["rev-parse", "--short", "HEAD"])).trim();
  const status = await getGitStatus(absRoot);
  return { commitHash, status };
}

/** 撤销指定文件的未提交修改（已跟踪文件恢复到 HEAD，未跟踪新建文件安全删除） */
export async function revertGitFiles(targetDir: string, files: string[]): Promise<{
  reverted: string[];
  status: GitStatusSnapshot;
}> {
  const repoRoot = resolve(targetDir);
  const rootStdout = await runGit(repoRoot, ["rev-parse", "--show-toplevel"]).catch(() => "");
  const gitRoot = rootStdout.trim() ? resolve(rootStdout.trim()) : repoRoot;
  const reverted: string[] = [];

  for (const rawFile of files) {
    const safeRel = validateSafeRelativeFile(gitRoot, rawFile);
    const isTracked = await runGit(gitRoot, ["ls-files", "--error-unmatch", "--", safeRel])
      .then(() => true)
      .catch(() => false);
    if (isTracked) {
      await runGit(gitRoot, ["checkout", "HEAD", "--", safeRel]);
      reverted.push(safeRel);
    } else {
      const absTarget = resolve(gitRoot, safeRel);
      const rel = relative(gitRoot, absTarget);
      if (rel && !rel.startsWith("..") && !isAbsolute(rel) && existsSync(absTarget)) {
        await rm(absTarget, { recursive: true, force: true });
        reverted.push(safeRel);
      }
    }
  }

  return {
    reverted,
    status: await getGitStatus(gitRoot),
  };
}
