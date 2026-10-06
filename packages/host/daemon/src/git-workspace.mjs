/**
 * 功能：为已登记的项目执行受限 Git 状态、隔离 Worktree 与恢复操作。
 * 作用：Git 参数始终作为参数数组传递；受管工作树固定存放在 Daemon 数据目录下。
 * 不负责：任意 Shell、远端 Git、提交、推送、合并或 Pull Request。
 */
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { lstat, mkdir, readFile, realpath, rm, stat } from "node:fs/promises";
import { promisify } from "node:util";
import { isAbsolute, relative, resolve, sep } from "node:path";

const execFileAsync = promisify(execFile);
const outputLimit = 384 * 1024;
const diffLimit = 128 * 1024;
const untrackedFileLimit = 200;
const untrackedByteLimit = 1024 * 1024;
const worktreeIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const shaPattern = /^[0-9a-f]{40,64}$/iu;
const dataRoot = process.env.LFAA_DAEMON_DATA_ROOT ? resolve(process.env.LFAA_DAEMON_DATA_ROOT) : null;

function assertInside(root, path) {
  const value = relative(root, path);
  if (!value || value === ".." || value.startsWith(`..${sep}`) || isAbsolute(value)) {
    if (value === "") return;
    throw new Error("Git 工作树路径超出 LFAA 管理目录。");
  }
}

function isInside(root, path) {
  const value = relative(root, path);
  return value === "" || value !== ".." && !value.startsWith(`..${sep}`) && !isAbsolute(value);
}

function assertOutside(root, path, message) {
  if (isInside(root, path)) throw new Error(message);
}

function worktreesRoot() {
  if (!dataRoot) throw new Error("Daemon 未报告持久化数据目录，无法安全管理 Git 工作树。");
  return resolve(dataRoot, "git-worktrees");
}

async function assertManagedWorktree(id) {
  if (typeof id !== "string" || !worktreeIdPattern.test(id)) throw new Error("Git 工作树标识无效。");
  const canonicalParent = await realpath(worktreesRoot()).catch(() => null);
  if (!canonicalParent) throw new Error("Git 工作树管理目录不存在或路径无效。");
  const root = resolve(canonicalParent, id.toLocaleLowerCase("en-US"));
  const canonical = await realpath(root);
  if (resolve(canonical) !== resolve(root)) throw new Error("Git 工作树不能经过符号链接访问。");
  const details = await stat(canonical);
  if (!details.isDirectory()) throw new Error("Git 工作树路径不是目录。");
  return canonical;
}

async function runGit(directory, args, options = {}) {
  const env = { ...process.env, GIT_OPTIONAL_LOCKS: "0", ...(options.env ?? {}) };
  const safeArgs = ["--no-pager", "-c", "core.fsmonitor=false"];
  if (dataRoot) {
    const hooksPath = resolve(dataRoot, `git-disabled-hooks-${randomUUID()}`);
    safeArgs.push("-c", `core.hooksPath=${hooksPath}`);
  }
  const result = await execFileAsync("git", [...safeArgs, "-C", directory, ...args], {
    cwd: directory,
    env,
    windowsHide: true,
    timeout: options.timeout ?? 12_000,
    maxBuffer: options.maxBuffer ?? outputLimit,
    encoding: "utf8"
  });
  return options.preserveTrailingNewline ? result.stdout : result.stdout.trimEnd();
}

async function runGitDiff(directory, args, options = {}) {
  try { return await runGit(directory, args, { ...options, preserveTrailingNewline: true }); }
  catch (error) {
    if (error?.code === 1 && typeof error.stdout === "string" && error.stdout.length) return error.stdout;
    throw error;
  }
}

async function findRepository(projectDirectory) {
  if (typeof projectDirectory !== "string" || !isAbsolute(projectDirectory)) throw new Error("Git 项目必须是 Daemon 已登记的绝对路径。");
  const projectPath = await realpath(projectDirectory);
  const projectInfo = await stat(projectPath);
  if (!projectInfo.isDirectory()) throw new Error("Git 项目路径不是目录。");
  const root = await runGit(projectPath, ["rev-parse", "--show-toplevel"]);
  const canonicalRoot = await realpath(root);
  if (dataRoot) {
    assertOutside(dataRoot, canonicalRoot, "Git 仓库不能位于 Daemon 数据目录内。");
    const dataWithinRepo = relative(canonicalRoot, dataRoot);
    if (dataWithinRepo === "" || dataWithinRepo !== ".." && !dataWithinRepo.startsWith(`..${sep}`) && !isAbsolute(dataWithinRepo)) {
      throw new Error("Git 仓库不能包含 Daemon 持久化数据目录。");
    }
  }
  const relativeProject = relative(canonicalRoot, projectPath);
  if (relativeProject === ".." || relativeProject.startsWith(`..${sep}`) || isAbsolute(relativeProject)) throw new Error("登记的项目目录不在 Git 仓库内。");
  const head = await runGit(canonicalRoot, ["rev-parse", "--verify", "HEAD"]);
  if (!shaPattern.test(head)) throw new Error("此 Git 仓库没有可用的 HEAD 提交，请先在源项目中创建初始提交。");
  return { root: canonicalRoot, projectPath, projectRelativePath: relativeProject.split(sep).join("/") };
}

function pathspec(relativePath) {
  return relativePath ? `:(literal)${relativePath}` : ".";
}

function gitNullDevice() { return process.platform === "win32" ? "NUL" : "/dev/null"; }

function safeDisplayPath(value) {
  return value.replace(/[\u0000-\u001f\u007f]/gu, character => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

function parseStatus(raw) {
  const values = raw.split("\0").filter(Boolean);
  return values.map(value => ({
    status: value.slice(0, 2),
    path: value.slice(3),
    displayPath: safeDisplayPath(value.slice(3))
  }));
}

function parseNumstat(raw) {
  const result = new Map();
  for (const row of raw.split("\0").filter(Boolean)) {
    const first = row.indexOf("\t");
    const second = row.indexOf("\t", first + 1);
    if (first < 0 || second < 0) continue;
    const added = row.slice(0, first);
    const removed = row.slice(first + 1, second);
    result.set(row.slice(second + 1), {
      insertions: added === "-" ? null : Number(added),
      deletions: removed === "-" ? null : Number(removed)
    });
  }
  return result;
}

async function countUntrackedTextLines(root, path) {
  const absolutePath = resolve(root, path);
  const value = relative(root, absolutePath);
  if (value === ".." || value.startsWith(`..${sep}`) || isAbsolute(value)) return null;
  const details = await lstat(absolutePath);
  if (!details.isFile() || details.isSymbolicLink() || details.size > 128 * 1024) return null;
  const bytes = await readFile(absolutePath);
  if (bytes.includes(0)) return null;
  let content;
  try { content = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { return null; }
  return bytes.length === 0 ? 0 : content.split(/\r?\n/u).length - (content.endsWith("\n") || content.endsWith("\r") ? 1 : 0);
}

async function snapshotStatus(root, projectRelativePath, baseline, worktreeId = null) {
  if (baseline && !shaPattern.test(baseline)) throw new Error("Git 工作树的恢复基线无效。");
  const scope = projectRelativePath ? ["--", pathspec(projectRelativePath)] : ["--"];
  const branch = await runGit(root, ["branch", "--show-current"]);
  const head = await runGit(root, ["rev-parse", "--verify", "HEAD"]);
  const compareTo = baseline ?? "HEAD";
  const status = await runGit(root, ["status", "--porcelain=v1", "-z", "--no-renames", "--untracked-files=all", ...scope]);
  const statusFiles = parseStatus(status);
  const statusByPath = new Map(statusFiles.map(file => [file.path, file]));
  const baselineChanges = await runGit(root, ["diff", "--no-ext-diff", "--no-textconv", "--name-status", "-z", "--no-renames", compareTo, ...scope]);
  const baselineRows = baselineChanges.split("\0").filter(Boolean);
  for (let index = 0; index + 1 < baselineRows.length; index += 2) {
    const change = baselineRows[index] ?? "M";
    const path = baselineRows[index + 1] ?? "";
    if (!statusByPath.has(path)) statusByPath.set(path, { status: "C", path, displayPath: safeDisplayPath(path), baselineChange: change });
  }
  const allFiles = [...statusByPath.values()].sort((left, right) => left.path.localeCompare(right.path, "en"));
  const files = allFiles.slice(0, untrackedFileLimit).map(file => ({
    ...file,
    projectPath: projectRelativePath
      ? file.path === projectRelativePath ? "" : file.path.startsWith(`${projectRelativePath}/`) ? file.path.slice(projectRelativePath.length + 1) : file.path
      : file.path
  }));
  const numstat = parseNumstat(await runGit(root, ["diff", "--no-ext-diff", "--no-textconv", "--numstat", "-z", compareTo, ...scope]));
  let insertions = 0;
  let deletions = 0;
  let unknownLineCounts = Math.max(0, allFiles.length - files.length);
  let untrackedBytes = 0;
  for (const file of files) {
    let counts = numstat.get(file.path);
    if (file.status === "??") {
      try {
        const size = (await lstat(resolve(root, file.path))).size;
        if (untrackedBytes + size <= untrackedByteLimit) {
          untrackedBytes += size;
          const lines = await countUntrackedTextLines(root, file.path);
          counts = lines === null ? { insertions: null, deletions: null } : { insertions: lines, deletions: 0 };
        } else counts = { insertions: null, deletions: null };
      } catch { counts = { insertions: null, deletions: null }; }
    }
    counts ??= { insertions: 0, deletions: 0 };
    if (counts.insertions === null || counts.deletions === null) unknownLineCounts += 1;
    else { insertions += counts.insertions; deletions += counts.deletions; }
    file.insertions = counts.insertions;
    file.deletions = counts.deletions;
  }

  let diff = await runGit(root, ["diff", "--no-ext-diff", "--no-textconv", "--unified=2", compareTo, ...scope], { maxBuffer: outputLimit });
  const pieces = [diff];
  let remaining = diffLimit - Buffer.byteLength(diff);
  if (remaining > 0) {
    for (const file of files) {
      if (file.status !== "??" || remaining <= 0) continue;
      const absolutePath = resolve(root, file.path);
      try {
        const details = await lstat(absolutePath);
        if (!details.isFile() || details.isSymbolicLink() || details.size > 48 * 1024) continue;
        const piece = await runGitDiff(root, ["diff", "--no-index", "--no-ext-diff", "--no-textconv", "--unified=3", "--", gitNullDevice(), file.path], { maxBuffer: outputLimit });
        if (/\bBinary files\b/u.test(piece)) continue;
        const bounded = Buffer.from(piece).subarray(0, remaining).toString("utf8");
        pieces.push(bounded);
        remaining -= Buffer.byteLength(bounded);
      } catch { /* 二进制、损坏编码或并发删除文件只保留状态行。 */ }
    }
  }
  diff = pieces.join("\n");
  const diffTruncated = Buffer.byteLength(diff) > diffLimit || allFiles.length > files.length;
  if (Buffer.byteLength(diff) > diffLimit) diff = Buffer.from(diff).subarray(0, diffLimit).toString("utf8");
  return {
    repository: root,
    projectRelativePath,
    worktreeId,
    branch: branch || "(分离 HEAD)",
    head,
    baseline: baseline ?? head,
    clean: !allFiles.length,
    changedFileCount: allFiles.length,
    shownFileCount: files.length,
    files,
    insertions,
    deletions,
    unknownLineCounts,
    diff,
    diffTruncated,
    statusTruncated: allFiles.length > files.length
  };
}

async function snapshotFileDiff(root, projectRelativePath, baseline, filePath, options = {}) {
  if (typeof filePath !== "string" || !filePath || filePath.startsWith("/") || filePath.includes("\\") || /[\u0000-\u001f\u007f]/u.test(filePath)
    || filePath.split("/").some(segment => !segment || segment === "." || segment === "..")) {
    throw new Error("Git 文件相对路径无效。");
  }
  if (projectRelativePath && filePath !== projectRelativePath && !filePath.startsWith(`${projectRelativePath}/`)) {
    throw new Error("Git 文件不属于当前登记项目目录。");
  }
  const compareTo = baseline ?? "HEAD";
  const selectedPath = pathspec(filePath);
  const statusRows = parseStatus(await runGit(root, ["status", "--porcelain=v1", "-z", "--no-renames", "--untracked-files=all", "--", selectedPath]));
  const status = statusRows.find(file => file.path === filePath)?.status ?? "";
  const baselineRows = (await runGit(root, ["diff", "--no-ext-diff", "--no-textconv", "--name-status", "-z", "--no-renames", compareTo, "--", selectedPath])).split("\0").filter(Boolean);
  if (!status && baselineRows.length < 2) throw new Error("此文件当前没有 Git 差异，请刷新文件列表。");

  let diff = "";
  let diffTruncated = false;
  if (status === "??") {
    try {
      diff = await runGitDiff(root, ["diff", "--no-index", "--no-ext-diff", "--no-textconv", "--unified=3", "--", gitNullDevice(), filePath], { maxBuffer: outputLimit });
      if (/\bBinary files\b/u.test(diff)) { diff = ""; diffTruncated = true; }
    } catch { /* 文件并发删除、二进制或编码错误时由文件读取操作给出准确状态。 */ }
    if (!diff) diffTruncated = true;
  } else {
    const args = ["diff", "--no-ext-diff", "--no-textconv", "--unified=3"];
    if (options.ignoreWhitespace) args.push("--ignore-all-space");
    if (options.wordDiff) args.push("--word-diff=plain");
    args.push(compareTo, "--", selectedPath);
    diff = await runGitDiff(root, args, { maxBuffer: outputLimit });
  }
  const bytes = Buffer.from(diff, "utf8");
  if (bytes.length > diffLimit) {
    diffTruncated = true;
    diff = bytes.subarray(0, diffLimit).toString("utf8");
  }
  return { path: filePath, status: status || "C", diff, diffTruncated, wordDiff: options.wordDiff === true, ignoreWhitespace: options.ignoreWhitespace === true };
}

async function createSnapshotCommit(root, head, indexPath, projectTitle) {
  const env = { GIT_INDEX_FILE: indexPath };
  await runGit(root, ["read-tree", head], { env });
  await runGit(root, ["add", "-A", "--", "."], { env, timeout: 30_000 });
  const tree = await runGit(root, ["write-tree"], { env });
  const headTree = await runGit(root, ["rev-parse", `${head}^{tree}`]);
  if (tree === headTree) return head;
  const title = String(projectTitle ?? "项目").replace(/[\r\n\0]/gu, " ").slice(0, 60);
  return runGit(root, ["-c", "user.name=LFAA Worktree Snapshot", "-c", "user.email=lfaa-worktree@invalid", "commit-tree", tree, "-p", head, "-m", `LFAA AI Worktree snapshot: ${title}`], { env });
}

async function createWorktree(input) {
  const { root, projectPath, projectRelativePath } = await findRepository(input.projectDirectory);
  if (typeof input.worktreeId !== "string" || !worktreeIdPattern.test(input.worktreeId)) throw new Error("Git 工作树标识无效。");
  const rootForTrees = worktreesRoot();
  await mkdir(rootForTrees, { recursive: true });
  if ((await lstat(rootForTrees)).isSymbolicLink()) throw new Error("Git 工作树管理目录不能是符号链接。");
  const canonicalTreesRoot = await realpath(rootForTrees);
  const target = resolve(canonicalTreesRoot, input.worktreeId.toLocaleLowerCase("en-US"));
  assertInside(canonicalTreesRoot, target);
  assertOutside(root, target, "受管 Git 工作树必须位于源仓库之外。");
  if (isInside(root, canonicalTreesRoot)) throw new Error("Daemon 工作树存储目录不能位于源仓库内。");
  try { await lstat(target); throw new Error("Git 工作树目标已经存在。"); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const head = await runGit(root, ["rev-parse", "--verify", "HEAD"]);
  if (!shaPattern.test(head)) throw new Error("此 Git 仓库没有可用的 HEAD 提交。");
  const prefix = typeof input.branchPrefix === "string" ? input.branchPrefix : "codex/";
  const prefixSegments = prefix.slice(0, -1).split("/");
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,63}\/$/u.test(prefix) || prefix.includes("..") || prefix.includes("@{")
    || prefixSegments.some(segment => !segment || segment.startsWith(".") || segment.endsWith(".") || segment.toLocaleLowerCase("en-US").endsWith(".lock"))) {
    throw new Error("Git 分支前缀无效，请在 Git 设置中检查后重试。");
  }
  const slug = String(input.projectTitle ?? "task").normalize("NFKD").replace(/[^A-Za-z0-9-]+/gu, "-").replace(/^-+|-+$/gu, "").toLocaleLowerCase("en-US").slice(0, 36) || "task";
  const branch = `${prefix}${slug}-${input.worktreeId.slice(0, 8).toLocaleLowerCase("en-US")}`;
  await runGit(root, ["check-ref-format", "--branch", branch]);
  const indexPath = resolve(dataRoot, `git-index-${randomUUID()}`);
  let added = false;
  try {
    const baseline = await createSnapshotCommit(root, head, indexPath, input.projectTitle);
    await runGit(root, ["worktree", "add", "-b", branch, target, baseline], { timeout: 60_000 });
    added = true;
    const projectDirectory = projectRelativePath ? resolve(target, projectRelativePath) : target;
    return { worktreeId: input.worktreeId, worktreeRoot: target, projectDirectory, projectRelativePath, branch, baseline, sourceHead: head };
  } catch (error) {
    if (added) await runGit(root, ["worktree", "remove", "--force", target], { timeout: 30_000 }).catch(() => undefined);
    await rm(target, { recursive: true, force: true }).catch(() => undefined);
    await runGit(root, ["branch", "-D", branch]).catch(() => undefined);
    throw error;
  } finally { await rm(indexPath, { force: true }).catch(() => undefined); }
}

async function resetWorktree(input) {
  const root = await assertManagedWorktree(input.worktreeId);
  if (typeof input.baseline !== "string" || !shaPattern.test(input.baseline)) throw new Error("Git 工作树恢复基线无效。");
  const top = await realpath(await runGit(root, ["rev-parse", "--show-toplevel"]));
  if (resolve(top) !== resolve(root)) throw new Error("受管 Git 工作树根目录与记录不匹配。");
  const target = `${input.baseline}^{commit}`;
  await runGit(root, ["cat-file", "-e", target]);
  await runGit(root, ["reset", "--hard", input.baseline], { timeout: 30_000 });
  await runGit(root, ["clean", "-fd", "--", "."], { timeout: 30_000 });
  return await snapshotStatus(root, "", input.baseline, input.worktreeId);
}

async function removeWorktree(input) {
  const root = await findRepository(input.sourceDirectory);
  const target = await assertManagedWorktree(input.worktreeId);
  const expectedBranch = typeof input.branch === "string" ? input.branch : "";
  const actualBranch = await runGit(target, ["branch", "--show-current"]);
  if (!expectedBranch || actualBranch !== expectedBranch) throw new Error("Git 工作树分支与登记信息不匹配，未删除文件。");
  await runGit(root.root, ["worktree", "remove", "--force", target], { timeout: 60_000 });
  return { removed: true, worktreeId: input.worktreeId };
}

export async function executeGitWorkspace(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Git 工作区操作无效。");
  if (input.operation === "create-worktree") return createWorktree(input);
  if (input.operation === "reset-worktree") return resetWorktree(input);
  if (input.operation === "remove-worktree") return removeWorktree(input);
  if (input.operation === "status") {
    if (typeof input.worktreeId === "string") {
      const root = await assertManagedWorktree(input.worktreeId);
      const top = await realpath(await runGit(root, ["rev-parse", "--show-toplevel"]));
      if (resolve(top) !== resolve(root)) throw new Error("受管 Git 工作树根目录与登记信息不匹配。");
      const relativeProject = typeof input.projectRelativePath === "string" ? input.projectRelativePath : "";
      if (relativeProject.startsWith("/") || relativeProject.split(/[\\/]/u).includes("..")) throw new Error("Git 项目相对路径无效。");
      return snapshotStatus(root, relativeProject, input.baseline, input.worktreeId);
    }
    const project = await findRepository(input.projectDirectory);
    return snapshotStatus(project.root, project.projectRelativePath, null);
  }
  if (input.operation === "file-diff") {
    const options = { ignoreWhitespace: input.ignoreWhitespace === true, wordDiff: input.wordDiff === true };
    if (typeof input.worktreeId === "string") {
      const root = await assertManagedWorktree(input.worktreeId);
      const top = await realpath(await runGit(root, ["rev-parse", "--show-toplevel"]));
      if (resolve(top) !== resolve(root)) throw new Error("受管 Git 工作树根目录与登记信息不匹配。");
      const relativeProject = typeof input.projectRelativePath === "string" ? input.projectRelativePath : "";
      if (relativeProject.startsWith("/") || relativeProject.split(/[\\/]/u).includes("..")) throw new Error("Git 项目相对路径无效。");
      if (typeof input.baseline !== "string" || !shaPattern.test(input.baseline)) throw new Error("Git 工作树恢复基线无效。");
      return snapshotFileDiff(root, relativeProject, input.baseline, input.path, options);
    }
    const project = await findRepository(input.projectDirectory);
    return snapshotFileDiff(project.root, project.projectRelativePath, null, input.path, options);
  }
  throw new Error("Git 工作区不支持此操作。");
}
