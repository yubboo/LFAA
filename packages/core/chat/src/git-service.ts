// 提供 LFAA 内置 Git 服务：仓储探测、状态与差异读取、分支切换/前缀新建、暂存与提交、PR 草案生成。
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve } from "node:path";
import { promisify } from "node:util";
import type { GitCodingSettings } from "./coding-settings";

const execFileAsync = promisify(execFile);

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

async function runGit(cwd: string, args: string[], timeoutMs = 10000): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    timeout: timeoutMs,
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", LC_ALL: "C" },
  });
  return stdout;
}

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

function validateSafeRelativeFile(repoRoot: string, filePath: string): string {
  const clean = filePath.trim();
  if (!clean || clean.startsWith("-")) {
    throw new Error(`非法文件路径：${filePath}`);
  }
  const abs = resolve(repoRoot, clean);
  const rel = relative(resolve(repoRoot), abs);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`禁止访问仓库目录外的路径：${filePath}`);
  }
  return rel.replace(/\\/gu, "/");
}

function validateBranchName(rawName: string): string {
  const cleaned = rawName.trim();
  if (
    !cleaned ||
    cleaned.startsWith("-") ||
    cleaned.includes("..") ||
    /[\s~^:?*[\\\x00-\x1f]/u.test(cleaned) ||
    cleaned.endsWith(".") ||
    cleaned.endsWith("/")
  ) {
    throw new Error(`非法 Git 分支名称：${rawName}`);
  }
  return cleaned;
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

export async function getGitDiff(
  repoRoot: string,
  options?: { filePath?: string; staged?: boolean; commitHash?: string },
): Promise<{ diff: string; stat: string }> {
  const absRoot = resolve(repoRoot);
  if (options?.commitHash) {
    const hash = options.commitHash.trim();
    if (!/^[a-f0-9]{4,40}$/iu.test(hash)) {
      throw new Error("非法提交哈希。");
    }
    const [stat, diff] = await Promise.all([
      runGit(absRoot, ["show", "--stat", "--format=%h %s (%an, %ai)", hash]),
      runGit(absRoot, ["show", "--format=", "--no-color", hash]).catch(() => ""),
    ]);
    return { stat: stat.trim(), diff: diff.slice(0, 60000) };
  }

  const fileArgs = options?.filePath ? ["--", validateSafeRelativeFile(absRoot, options.filePath)] : [];
  if (options?.staged) {
    const [stat, diff] = await Promise.all([
      runGit(absRoot, ["diff", "--cached", "--stat", ...fileArgs]).catch(() => ""),
      runGit(absRoot, ["diff", "--cached", "--no-color", ...fileArgs]).catch(() => ""),
    ]);
    return { stat: stat.trim(), diff: diff.slice(0, 60000) };
  }

  const [statHead, diffUnstaged, diffStaged] = await Promise.all([
    runGit(absRoot, ["diff", "HEAD", "--stat", ...fileArgs]).catch(() =>
      runGit(absRoot, ["diff", "--stat", ...fileArgs]).catch(() => ""),
    ),
    runGit(absRoot, ["diff", "--no-color", ...fileArgs]).catch(() => ""),
    runGit(absRoot, ["diff", "--cached", "--no-color", ...fileArgs]).catch(() => ""),
  ]);

  const combined = [diffStaged && `# Staged Diff\n${diffStaged}`, diffUnstaged && `# Unstaged Diff\n${diffUnstaged}`]
    .filter(Boolean)
    .join("\n\n");
  return { stat: statHead.trim(), diff: combined.slice(0, 60000) };
}

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

export function buildCommitDraft(status: GitStatusSnapshot, gitSettings: GitCodingSettings): {
  message: string;
  appliedInstructions: string;
} {
  const staged = status.files.filter((f) => f.staged);
  const targetFiles = staged.length > 0 ? staged : status.files;
  if (targetFiles.length === 0) {
    return {
      message: "chore: sync workspace state",
      appliedInstructions: gitSettings.commitInstructions.trim(),
    };
  }
  const hasAdded = targetFiles.some((f) => f.untracked || f.indexStatus === "A");
  const hasDocs = targetFiles.every((f) => f.path.endsWith(".md") || f.path.startsWith("docs/"));
  const prefix = hasDocs ? "docs" : hasAdded ? "feat" : "chore";
  const topFiles = targetFiles
    .slice(0, 3)
    .map((f) => basename(f.path))
    .join(", ");
  const suffix = targetFiles.length > 3 ? ` 等 ${targetFiles.length} 个文件` : "";
  const extra = gitSettings.commitInstructions.trim();
  const body = extra ? `\n\n# 已应用提交指令：${extra}` : "";
  return {
    message: `${prefix}: update ${topFiles}${suffix}${body}`,
    appliedInstructions: extra,
  };
}

export function buildPrDraft(status: GitStatusSnapshot, gitSettings: GitCodingSettings): {
  title: string;
  body: string;
  mergeMethod: string;
  draft: boolean;
  pushCommand: string;
} {
  const latestCommit = status.commits[0]?.subject || `Update ${status.branch || "feature"} changes`;
  const changedList = status.files
    .slice(0, 12)
    .map((f) => `- \`${f.displayCode}\` ${f.path}`)
    .join("\n");
  const commitList = status.commits
    .slice(0, 5)
    .map((c) => `- \`${c.shortHash}\` ${c.subject}`)
    .join("\n");
  const prNote = gitSettings.prInstructions.trim()
    ? `\n\n### Pull Request 指引要求\n${gitSettings.prInstructions.trim()}`
    : "";
  const pushFlag = gitSettings.alwaysForcePush ? " --force-with-lease" : "";
  const mergeLabel = gitSettings.prMergeMethod === "squash" ? "压缩合并 (Squash)" : "标准合并 (Merge)";

  return {
    title: gitSettings.createDraftPr ? `[Draft] ${latestCommit}` : latestCommit,
    body: [
      `## 变更概览`,
      `- 分支：\`${status.branch || "HEAD"}\``,
      `- 合并策略：${mergeLabel}`,
      `- 默认草稿 PR：${gitSettings.createDraftPr ? "是" : "否"}`,
      commitList ? `\n### 最近提交\n${commitList}` : "",
      changedList ? `\n### 当前未提交变更 (${status.files.length})\n${changedList}` : "",
      prNote,
    ]
      .filter(Boolean)
      .join("\n"),
    mergeMethod: gitSettings.prMergeMethod,
    draft: gitSettings.createDraftPr,
    pushCommand: `git push -u origin ${status.branch || "HEAD"}${pushFlag}`,
  };
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
