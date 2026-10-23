/**
 * 功能：为当前 Agent 已登记的本机仓库执行受限 Git 状态、变更审阅、提交、分支和隔离 Worktree 操作。
 * 作用：由 LFAA Control Plane 本机进程运行；Git 参数始终作为数组传递，受管工作树位于 LFAA_DATA_DIR。
 * 不负责：任意 Shell、跨账户凭据共享、未接入凭据 Owner 的远端写入或 Pull Request。
 */
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { lstat, mkdir, readFile, realpath, rm, stat } from "node:fs/promises";
import { promisify } from "node:util";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "lfaa-launch-environment/src/config.js";

const execFileAsync = promisify(execFile);
const outputLimit = 384 * 1024;
const diffLimit = 128 * 1024;
const untrackedFileLimit = 200;
const untrackedByteLimit = 1024 * 1024;
const worktreeIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const shaPattern = /^[0-9a-f]{40,64}$/iu;
const remoteNamePattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/u;
function gitDataRoot() {
  // 测试夹具可在进程内提供隔离根；产品始终读取启动时解析的权威 LFAA_DATA_DIR。
  const fixtureRoot = process.env.LFAA_GIT_DATA_ROOT?.trim();
  return resolve(fixtureRoot || config.dataDirectory);
}

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
  return resolve(gitDataRoot(), "git-worktrees");
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
  const inheritedEnv = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^GIT_(?:DIR|WORK_TREE|COMMON_DIR|INDEX_FILE|CONFIG(?:_|$)|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|NAMESPACE)$/iu.test(name)));
  const env = { ...inheritedEnv, GIT_CONFIG_COUNT: "0", GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0", LC_ALL: "C", ...(options.env ?? {}) };
  const safeArgs = ["--no-pager", "-c", "core.fsmonitor=false"];
  const hooksPath = resolve(gitDataRoot(), `git-disabled-hooks-${randomUUID()}`);
  safeArgs.push("-c", `core.hooksPath=${hooksPath}`);
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

async function inspectRepository(projectDirectory) {
  if (typeof projectDirectory !== "string" || !isAbsolute(projectDirectory)) throw new Error("Git 项目必须是已登记的本机绝对路径。");
  const projectPath = await realpath(projectDirectory);
  const projectInfo = await stat(projectPath);
  if (!projectInfo.isDirectory()) throw new Error("Git 项目路径不是目录。");
  let root;
  try { root = await runGit(projectPath, ["rev-parse", "--show-toplevel"]); }
  catch (error) {
    if (error?.code === 128 && /not a git repository/iu.test(String(error.stderr ?? error.message))) return null;
    if (error?.code === "ENOENT") throw new Error("LFAA 本机应用进程找不到 Git 可执行文件，请在运行 LFAA 的主机安装 Git。");
    throw new Error("Git 仓库元数据读取失败，请检查项目目录中的 .git 数据。");
  }
  const canonicalRoot = await realpath(root);
  const dataRoot = gitDataRoot();
  assertOutside(dataRoot, canonicalRoot, "Git 仓库不能位于 LFAA 数据目录内。");
  const dataWithinRepo = relative(canonicalRoot, dataRoot);
  if (dataWithinRepo === "" || dataWithinRepo !== ".." && !dataWithinRepo.startsWith(`..${sep}`) && !isAbsolute(dataWithinRepo)) {
    throw new Error("Git 仓库不能包含 LFAA 持久化数据目录。");
  }
  const relativeProject = relative(canonicalRoot, projectPath);
  if (relativeProject === ".." || relativeProject.startsWith(`..${sep}`) || isAbsolute(relativeProject)) throw new Error("登记的项目目录不在 Git 仓库内。");
  let head = null;
  try {
    head = await runGit(canonicalRoot, ["rev-parse", "--verify", "--quiet", "HEAD"]);
    if (!shaPattern.test(head)) throw new Error("Git 仓库 HEAD 格式无效。");
  } catch (error) {
    if (error?.code !== 1 && !/Needed a single revision/iu.test(String(error.stderr ?? error.message))) throw error;
  }
  return { root: canonicalRoot, projectPath, projectRelativePath: relativeProject.split(sep).join("/"), head };
}

/** Resolve a local project folder to its canonical directory after the data-root and symlink checks. */
export async function resolveGitProjectDirectory(directory) {
  if (typeof directory !== "string" || !isAbsolute(directory)) throw new Error("Git 目录必须是用户明确选择的本机绝对路径。");
  const canonical = await realpath(directory);
  if (!(await stat(canonical)).isDirectory()) throw new Error("Git 目录必须是现存文件夹。");
  assertOutside(gitDataRoot(), canonical, "Git 目录不能位于 LFAA 数据目录内。");
  return canonical;
}

/** Resolve a manually chosen repository to its full Git root, or keep a normal folder as its future root. */
export async function resolveGitWorkspaceDirectory(directory) {
  const canonical = await resolveGitProjectDirectory(directory);
  const repository = await inspectRepository(canonical);
  return repository?.root ?? canonical;
}

async function findRepository(projectDirectory) {
  const repository = await inspectRepository(projectDirectory);
  if (!repository) throw new Error("当前项目目录尚未初始化 Git 仓库。");
  if (!repository.head) throw new Error("Git 仓库尚无首次提交，请先创建初始提交。");
  return repository;
}

async function initializeRepository(projectDirectory) {
  if (typeof projectDirectory !== "string" || !isAbsolute(projectDirectory)) throw new Error("Git 项目必须是已登记的本机绝对路径。");
  const projectPath = await realpath(projectDirectory);
  const projectInfo = await stat(projectPath);
  if (!projectInfo.isDirectory()) throw new Error("Git 项目路径不是目录。");
  const existing = await inspectRepository(projectPath);
  if (existing) throw new Error("此项目已经位于 Git 仓库中，未创建嵌套仓库。");
  assertOutside(gitDataRoot(), projectPath, "不能在 LFAA 数据目录中初始化 Git 仓库。");
  await runGit(projectPath, ["init"]);
  const created = await inspectRepository(projectPath);
  if (!created) throw new Error("Git 初始化后仍无法识别仓库；请检查目标节点上的 Git 状态。");
  return { ...await snapshotStatus(created.root, "", null), repositoryState: created.head ? "ready" : "unborn", projectRelativePath: created.projectRelativePath };
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
  const head = baseline ? await runGit(root, ["rev-parse", "--verify", "HEAD"]) : await runGit(root, ["rev-parse", "--verify", "--quiet", "HEAD"]).catch(error => {
    if (error?.code === 1 || /Needed a single revision/iu.test(String(error.stderr ?? error.message))) return "";
    throw error;
  });
  const remotes = (await runGit(root, ["remote"])).split(/\r?\n/u).filter(value => remoteNamePattern.test(value));
  let upstream = null;
  let ahead = 0;
  let behind = 0;
  if (branch && head) {
    upstream = await runGit(root, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]).catch(() => null);
    if (upstream) {
      const counts = (await runGit(root, ["rev-list", "--left-right", "--count", `${upstream}...HEAD`])).trim().split(/\s+/u).map(Number);
      behind = Number.isSafeInteger(counts[0]) ? counts[0] : 0;
      ahead = Number.isSafeInteger(counts[1]) ? counts[1] : 0;
    }
  }
  const compareTo = baseline ?? (head || null);
  const status = await runGit(root, ["status", "--porcelain=v1", "-z", "--no-renames", "--untracked-files=all", ...scope]);
  const statusFiles = parseStatus(status);
  const statusByPath = new Map(statusFiles.map(file => [file.path, file]));
  const baselineChanges = compareTo
    ? await runGit(root, ["diff", "--no-ext-diff", "--no-textconv", "--name-status", "-z", "--no-renames", compareTo, ...scope])
    : await runGit(root, ["diff", "--cached", "--no-ext-diff", "--no-textconv", "--name-status", "-z", "--no-renames", ...scope]);
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
  const numstat = parseNumstat(await runGit(root, compareTo
    ? ["diff", "--no-ext-diff", "--no-textconv", "--numstat", "-z", compareTo, ...scope]
    : ["diff", "--cached", "--no-ext-diff", "--no-textconv", "--numstat", "-z", ...scope]));
  let insertions = 0;
  let deletions = 0;
  let unknownLineCounts = Math.max(0, allFiles.length - files.length);
  let untrackedBytes = 0;
  for (const file of files) {
    let counts = numstat.get(file.path);
    if (file.status === "??" || !compareTo && file.status.includes("A")) {
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

  let diff = await runGit(root, compareTo
    ? ["diff", "--no-ext-diff", "--no-textconv", "--unified=2", compareTo, ...scope]
    : ["diff", "--cached", "--no-ext-diff", "--no-textconv", "--unified=2", ...scope], { maxBuffer: outputLimit });
  const pieces = [diff];
  let remaining = diffLimit - Buffer.byteLength(diff);
  if (remaining > 0) {
    for (const file of files) {
      if (!(file.status === "??" || !compareTo && file.status.includes("A")) || remaining <= 0) continue;
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
    branch: branch || (head ? "(分离 HEAD)" : "(未命名分支)"),
    upstream,
    ahead,
    behind,
    remotes,
    repositoryState: head ? "ready" : "unborn",
    head: head || null,
    baseline: baseline ?? (head || null),
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
  // Git 管理覆盖整个仓库根；Agent 文件工具仍按登记项目目录单独校验。
  const compareTo = baseline ?? null;
  const contextLines = Number.isInteger(options.contextLines) ? Math.max(0, Math.min(1000, options.contextLines)) : 3;
  const selectedPath = pathspec(filePath);
  const statusRows = parseStatus(await runGit(root, ["status", "--porcelain=v1", "-z", "--no-renames", "--untracked-files=all", "--", selectedPath]));
  const status = statusRows.find(file => file.path === filePath)?.status ?? "";
  const baselineRows = compareTo
    ? (await runGit(root, ["diff", "--no-ext-diff", "--no-textconv", "--name-status", "-z", "--no-renames", compareTo, "--", selectedPath])).split("\0").filter(Boolean)
    : [];
  if (!status && baselineRows.length < 2) throw new Error("此文件当前没有 Git 差异，请刷新文件列表。");

  let diff = "";
  let diffTruncated = false;
  if (status === "??" || !compareTo && status.includes("A")) {
    try {
      diff = await runGitDiff(root, ["diff", "--no-index", "--no-ext-diff", "--no-textconv", `--unified=${contextLines}`, "--", gitNullDevice(), filePath], { maxBuffer: outputLimit });
      if (/\bBinary files\b/u.test(diff)) { diff = ""; diffTruncated = true; }
    } catch { /* 文件并发删除、二进制或编码错误时由文件读取操作给出准确状态。 */ }
    if (!diff) diffTruncated = true;
  } else {
    const args = ["diff", "--no-ext-diff", "--no-textconv", `--unified=${contextLines}`];
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

function validateProjectRelativePath(value, allowEmpty = false) {
  if (allowEmpty && value === "") return "";
  if (typeof value !== "string" || !value || value.startsWith("/") || value.includes("\\") || /[\u0000-\u001f\u007f]/u.test(value)
    || value.split("/").some(segment => !segment || segment === "." || segment === "..")) {
    throw new Error("Git 项目相对路径无效。");
  }
  return value;
}

async function resolveGitTarget(input) {
  if (typeof input.worktreeId === "string") {
    const root = await assertManagedWorktree(input.worktreeId);
    const top = await realpath(await runGit(root, ["rev-parse", "--show-toplevel"]));
    if (resolve(top) !== resolve(root)) throw new Error("受管 Git 工作树根目录与登记信息不匹配。");
    const projectRelativePath = validateProjectRelativePath(typeof input.projectRelativePath === "string" ? input.projectRelativePath : "", true);
    const head = await runGit(root, ["rev-parse", "--verify", "--quiet", "HEAD"]).catch(error => {
      if (error?.code === 1 || /Needed a single revision/iu.test(String(error.stderr ?? error.message))) return "";
      throw error;
    });
    return { root, projectRelativePath, worktreeId: input.worktreeId, baseline: input.baseline ?? null, head: head || null };
  }
  const project = await inspectRepository(input.projectDirectory);
  if (!project) throw new Error("当前项目目录尚未初始化 Git 仓库。");
  return { root: project.root, projectRelativePath: project.projectRelativePath, worktreeId: null, baseline: null, head: project.head };
}

function operationPathspecs(projectRelativePath, requestedPaths) {
  if (requestedPaths === undefined || requestedPaths.length === 0) return [pathspec(projectRelativePath)];
  if (!Array.isArray(requestedPaths) || requestedPaths.length > 200) throw new Error("Git 文件列表无效或超出 200 个文件。");
  const selected = [...new Set(requestedPaths.map(value => validateProjectRelativePath(value)))];
  return selected.map(value => pathspec(projectRelativePath ? `${projectRelativePath}/${value}` : value));
}

async function stagedPaths(root, scope) {
  return (await runGit(root, ["diff", "--cached", "--name-only", "-z", "--no-renames", ...scope])).split("\0").filter(Boolean);
}

async function mutateLocalRepository(input) {
  const target = await resolveGitTarget(input);
  // Git 管理器按完整仓库根操作；Agent 文件 Tools 仍由项目路径合同限制。
  const scope = ["--"];
  if (input.operation === "stage") {
    await runGit(target.root, ["add", "-A", "--", ...operationPathspecs("", input.paths)], { timeout: 30_000 });
  } else if (input.operation === "unstage") {
    const paths = await stagedPaths(target.root, input.paths === undefined || input.paths.length === 0
      ? scope
      : ["--", ...operationPathspecs("", input.paths)]);
    if (paths.length) {
      if (target.head) {
        await runGit(target.root, ["restore", "--staged", "--", ...paths.map(pathspec)]);
      } else {
        await runGit(target.root, ["rm", "--cached", "-r", "--", ...paths.map(pathspec)]);
      }
    }
  } else if (input.operation === "commit") {
    const paths = await stagedPaths(target.root, ["--"]);
    if (!paths.length) throw new Error("没有已暂存的变更，请先选择文件并暂存。");
    const message = typeof input.message === "string" ? input.message.trim() : "";
    if (!message || message.length > 5000 || message.includes("\0")) throw new Error("提交信息不能为空，且最多 5000 个字符。");
    try { await runGit(target.root, ["var", "GIT_AUTHOR_IDENT"]); }
    catch { throw new Error("Git 提交身份尚未配置；请先在此仓库或当前系统 Git 配置 user.name 和 user.email。"); }
    await runGit(target.root, ["commit", "--message", message], { timeout: 60_000 });
  } else {
    throw new Error("本地 Git 写操作不支持此操作。");
  }
  return { ...await snapshotStatus(target.root, "", target.baseline, target.worktreeId), projectRelativePath: target.projectRelativePath };
}

async function readGitMetadata(input) {
  const target = await resolveGitTarget(input);
  if (input.operation === "history") {
    if (!target.head) return { commits: [] };
    const count = Math.max(1, Math.min(50, Number.isInteger(input.limit) ? input.limit : 20));
    const raw = await runGit(target.root, ["log", `--max-count=${count}`, "--format=%x1e%H%x00%h%x00%s%x00%an%x00%aI%x00%P"]);
    const commits = [];
    for (const record of raw.split("\x1e").filter(Boolean)) {
      const [hash, shortHash, subject, author, authoredAt, parents] = record.split("\0");
      if (!hash || !shaPattern.test(hash)) continue;
      commits.push({ hash, shortHash, subject: safeDisplayPath(subject ?? ""), author: safeDisplayPath(author ?? ""), authoredAt, parents: parents ? parents.split(" ").filter(value => shaPattern.test(value)) : [] });
    }
    return { commits };
  }
  if (input.operation === "branches") {
    const raw = await runGit(target.root, ["for-each-ref", "--format=%(refname:short)%00%(objectname)", "refs/heads"]);
    const current = await runGit(target.root, ["branch", "--show-current"]);
    const branches = [];
    for (const row of raw.split(/\r?\n/u).filter(Boolean)) {
      const [name, head] = row.split("\0");
      if (!name || !shaPattern.test(head ?? "")) continue;
      branches.push({ name, head: head ?? "", current: name === current });
    }
    return { branches, head: target.head };
  }
  throw new Error("Git 元数据读取不支持此操作。");
}

async function mutateBranch(input) {
  const target = await resolveGitTarget(input);
  if (target.worktreeId) throw new Error("AI Worktree 的分支由 Workspace Owner 管理，不能在其中切换或删除分支。");
  const branch = typeof input.branch === "string" ? input.branch.trim() : "";
  if (!branch || branch.length > 250 || branch.includes("\0")) throw new Error("Git 分支名称无效。");
  if (input.operation === "branch-create") {
    await runGit(target.root, ["check-ref-format", "--branch", branch]);
    await runGit(target.root, ["switch", "--create", branch], { timeout: 30_000 });
  } else if (input.operation === "branch-switch") {
    await runGit(target.root, ["check-ref-format", "--branch", branch]);
    await runGit(target.root, ["switch", branch], { timeout: 30_000 });
  } else if (input.operation === "branch-delete") {
    const current = await runGit(target.root, ["branch", "--show-current"]);
    if (branch === current) throw new Error("不能删除当前分支。");
    await runGit(target.root, ["check-ref-format", "--branch", branch]);
    await runGit(target.root, ["branch", "--delete", "--", branch]);
  } else throw new Error("Git 分支操作不支持此操作。");
  return { ...await snapshotStatus(target.root, "", null), projectRelativePath: target.projectRelativePath };
}

function remoteFailure(error, operation) {
  const detail = String(error?.stderr ?? error?.message ?? "");
  if (error instanceof Error && /^此 SSH remote 尚未接入账户隔离的 SSH 凭据/u.test(error.message)) return error;
  if (/authentication failed|could not read Username|permission denied \(publickey\)|access denied/iu.test(detail)) {
    return new Error("远端认证失败。请检查此账户保存的 HTTPS 凭据或本机 bare remote 权限。", { cause: error });
  }
  if (/non-fast-forward|not possible to fast-forward|fetch first|rejected/iu.test(detail)) {
    return new Error(operation === "push" ? "远端拒绝了推送；先获取并整合远端提交，再重试。" : "远端分支不能快进到当前分支；本次拉取已停止，未创建合并提交。", { cause: error });
  }
  if (/conflict|would be overwritten|local changes to the following files/iu.test(detail)) {
    return new Error("拉取遇到本地改动或冲突，Git 已停止；请先检查并处理当前工作区。", { cause: error });
  }
  if (/no upstream configured|no tracking information|has no upstream branch/iu.test(detail)) {
    return new Error("当前分支尚未关联远端分支。请先选择远端并发布此分支。", { cause: error });
  }
  return new Error(`Git ${operation} 失败（退出码 ${Number.isInteger(error?.code) ? error.code : "未知"}）。请检查远端配置和当前账户的 HTTPS 凭据。`, { cause: error });
}

function validateRemoteUrl(value) {
  if (typeof value !== "string" || !value || value.length > 2048 || /[\s\u0000-\u001f\u007f]/u.test(value)) throw new Error("Git remote 地址无效。");
  if (/^https:\/\//iu.test(value) || /^ssh:\/\//iu.test(value) || /^file:\/\//iu.test(value)) {
    let parsed;
    try { parsed = new URL(value); } catch { throw new Error("Git remote 地址格式无效。"); }
    if (parsed.protocol === "file:") {
      if (parsed.hostname || parsed.username || parsed.password || parsed.search || parsed.hash || !parsed.pathname) throw new Error("本机 Git remote 地址无效。");
      return value;
    }
    if (!parsed.hostname || parsed.password || parsed.search || parsed.hash || parsed.protocol === "https:" && parsed.username
      || parsed.protocol === "ssh:" && parsed.username && !/^[A-Za-z0-9._-]{1,64}$/u.test(decodeURIComponent(parsed.username))) {
      throw new Error("Git remote 不允许嵌入凭据、查询令牌或片段；HTTPS 请在 LFAA 内为当前账户保存凭据，SSH 同步暂未接入。");
    }
    return value;
  }
  if (/^(?:git@)?[A-Za-z0-9.-]+:[A-Za-z0-9._/-]+$/u.test(value) && !value.includes("..")) return value;
  throw new Error("Git remote 仅支持 HTTPS、SSH 或 file:// 地址；不接受普通本地路径、Git 协议和外部 remote helper。");
}

async function remoteNames(root) {
  return (await runGit(root, ["remote"])).split(/\r?\n/u).filter(value => remoteNamePattern.test(value));
}

async function assertSafeConfiguredRemote(root, remote) {
  if (!remoteNamePattern.test(remote) || !(await remoteNames(root)).includes(remote)) throw new Error("所选 Git remote 不属于当前仓库。");
  const configuredUrl = await runGit(root, ["config", "--get", `remote.${remote}.url`]).catch(() => "");
  if (!configuredUrl) throw new Error("Git remote 缺少地址。");
  validateRemoteUrl(configuredUrl);
  if (/^file:\/\//iu.test(configuredUrl)) {
    const remotePath = await realpath(fileURLToPath(configuredUrl));
    if (!(await stat(remotePath)).isDirectory()) throw new Error("本机 Git remote 必须是现存仓库目录。");
    assertOutside(gitDataRoot(), remotePath, "本机 Git remote 不能位于 LFAA 数据目录内。");
    assertOutside(root, remotePath, "本机 Git remote 不能位于当前仓库内。");
    if ((await runGit(remotePath, ["rev-parse", "--is-bare-repository"])) !== "true") throw new Error("本机 Git remote 必须是 bare 仓库，以免推送改写其工作文件。");
  }
  return configuredUrl;
}

async function upstreamRemote(root, upstream) {
  if (typeof upstream !== "string") throw new Error("当前分支尚未关联远端分支。");
  const slash = upstream.indexOf("/");
  if (slash <= 0) throw new Error("当前分支的远端跟踪信息无效。");
  const remote = upstream.slice(0, slash);
  await assertSafeConfiguredRemote(root, remote);
  return remote;
}

/** 按账户隔离凭据只在发起 Git 子进程时注入 HTTPS Basic Header，不读取 OS credential helper。 */
function remoteAuthEnvironment(remoteUrl, credential) {
  const env = {
    GIT_ASKPASS: "",
    GIT_CONFIG_COUNT: "2",
    GIT_CONFIG_KEY_0: "credential.helper",
    GIT_CONFIG_VALUE_0: "",
    GIT_CONFIG_KEY_1: "credential.interactive",
    GIT_CONFIG_VALUE_1: "false"
  };
  if (/^ssh:/iu.test(remoteUrl) || !remoteUrl.includes("://") && /^(?:git@)?[A-Za-z0-9.-]+:.+$/iu.test(remoteUrl)) {
    throw new Error("此 SSH remote 尚未接入账户隔离的 SSH 凭据；请改用 HTTPS remote。");
  }
  if (!/^https:/iu.test(remoteUrl)) {
    if (credential) throw new Error("本机 bare Git remote 不接受网络凭据。");
    return env;
  }
  if (!credential) return { ...env, GIT_CONFIG_COUNT: "3", GIT_CONFIG_KEY_2: "http.followRedirects", GIT_CONFIG_VALUE_2: "false" };
  const username = typeof credential.username === "string" ? credential.username : "";
  const token = typeof credential.token === "string" ? credential.token : "";
  if (!username || username.length > 256 || /[:\s\u0000-\u001f\u007f]/u.test(username)
    || !token || token.length > 16_384 || /[\u0000-\u001f\u007f]/u.test(token)) {
    throw new Error("Git HTTPS 账户凭据格式无效。");
  }
  const origin = new URL(remoteUrl).origin;
  return {
    ...env,
    GIT_CONFIG_COUNT: "4",
    GIT_CONFIG_KEY_2: `http.${origin}/.extraHeader`,
    GIT_CONFIG_VALUE_2: `Authorization: Basic ${Buffer.from(`${username}:${token}`, "utf8").toString("base64")}`,
    GIT_CONFIG_KEY_3: "http.followRedirects",
    GIT_CONFIG_VALUE_3: "false"
  };
}

async function synchronizeRemote(input) {
  const target = await resolveGitTarget(input);
  if (target.worktreeId) throw new Error("远端同步暂不支持受管 AI Worktree。");
  const remotes = await remoteNames(target.root);
  const operation = input.operation;
  const remote = typeof input.remote === "string" ? input.remote : "";
  if (remote && operation !== "remote-add" && !remotes.includes(remote)) throw new Error("所选 Git remote 不属于当前仓库。");
  if (operation === "remote-add") {
    if (!remoteNamePattern.test(remote) || remotes.includes(remote)) throw new Error("Git remote 名称无效或已经存在。");
    const url = validateRemoteUrl(input.url);
    await runGit(target.root, ["remote", "add", remote, url]);
    try { await assertSafeConfiguredRemote(target.root, remote); }
    catch (error) { await runGit(target.root, ["remote", "remove", remote]).catch(() => undefined); throw error; }
    return await snapshotStatus(target.root, "", null);
  }
  if (operation === "remote-remove") {
    if (!remote || !remotes.includes(remote)) throw new Error("所选 Git remote 不属于当前仓库。");
    await runGit(target.root, ["remote", "remove", remote]);
    return await snapshotStatus(target.root, "", null);
  }
  if (!remotes.length) throw new Error("此仓库尚未配置 Git remote；先添加 HTTPS 或本机 bare remote。");
  if (operation === "pull" && !target.head) throw new Error("当前仓库尚无提交，不能拉取；请先创建首个本地提交。");
  if (operation === "pull") {
    const currentStatus = await snapshotStatus(target.root, "", null);
    if (!currentStatus.clean) throw new Error("拉取前请先提交或暂存处理当前改动；为避免覆盖，本次拉取未执行。");
  }
  try {
    if (operation === "fetch") {
      const selectedRemote = remote || (remotes.length === 1 ? remotes[0] : "");
      if (!selectedRemote) throw new Error("请选择要获取的 Git remote。");
      const remoteUrl = await assertSafeConfiguredRemote(target.root, selectedRemote);
      await runGit(target.root, ["fetch", "--no-tags", selectedRemote], { timeout: 120_000, env: remoteAuthEnvironment(remoteUrl, input.remoteCredential) });
    } else if (operation === "pull") {
      const current = await snapshotStatus(target.root, "", null);
      const trackingRemote = await upstreamRemote(target.root, current.upstream);
      const remoteUrl = await assertSafeConfiguredRemote(target.root, trackingRemote);
      await runGit(target.root, ["pull", "--ff-only", "--no-rebase"], { timeout: 120_000, env: remoteAuthEnvironment(remoteUrl, input.remoteCredential) });
    } else if (operation === "push") {
      if (target.head) {
        const current = await snapshotStatus(target.root, "", null);
        const trackingRemote = await upstreamRemote(target.root, current.upstream);
        const remoteUrl = await assertSafeConfiguredRemote(target.root, trackingRemote);
        await runGit(target.root, ["push", trackingRemote, "HEAD"], { timeout: 120_000, env: remoteAuthEnvironment(remoteUrl, input.remoteCredential) });
      }
      else throw new Error("当前仓库尚无提交，不能推送。");
    } else if (operation === "push-upstream") {
      const currentBranch = await runGit(target.root, ["branch", "--show-current"]);
      if (!currentBranch || currentBranch.startsWith("(")) throw new Error("请先切换到本地分支，再发布分支。");
      if (!target.head) throw new Error("当前仓库尚无提交，不能发布分支。");
      if (!remote) throw new Error("请选择要发布到的 Git remote。");
      const remoteUrl = await assertSafeConfiguredRemote(target.root, remote);
      await runGit(target.root, ["push", "--set-upstream", remote, `${currentBranch}:${currentBranch}`], { timeout: 120_000, env: remoteAuthEnvironment(remoteUrl, input.remoteCredential) });
    } else throw new Error("Git 远端操作不支持此操作。");
  } catch (error) {
    throw remoteFailure(error, operation);
  }
  return await snapshotStatus(target.root, "", null);
}

/** Controller-only helper used to bind encrypted account credentials to the current remote URL. */
export async function readGitRemoteUrl(projectDirectory, remote) {
  const target = await resolveGitTarget({ projectDirectory });
  if (target.worktreeId) throw new Error("AI Worktree 不支持远端凭据。");
  return await assertSafeConfiguredRemote(target.root, remote);
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
  const dataRoot = gitDataRoot();
  await mkdir(rootForTrees, { recursive: true });
  if ((await lstat(rootForTrees)).isSymbolicLink()) throw new Error("Git 工作树管理目录不能是符号链接。");
  const canonicalTreesRoot = await realpath(rootForTrees);
  const target = resolve(canonicalTreesRoot, input.worktreeId.toLocaleLowerCase("en-US"));
  assertInside(canonicalTreesRoot, target);
  assertOutside(root, target, "受管 Git 工作树必须位于源仓库之外。");
  if (isInside(root, canonicalTreesRoot)) throw new Error("LFAA 工作树存储目录不能位于源仓库内。");
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
  if (input.operation === "initialize") return initializeRepository(input.projectDirectory);
  if (input.operation === "create-worktree") return createWorktree(input);
  if (input.operation === "reset-worktree") return resetWorktree(input);
  if (input.operation === "remove-worktree") return removeWorktree(input);
  if (["stage", "unstage", "commit"].includes(input.operation)) return mutateLocalRepository(input);
  if (input.operation === "history" || input.operation === "branches") return readGitMetadata(input);
  if (["branch-create", "branch-switch", "branch-delete"].includes(input.operation)) return mutateBranch(input);
  if (["fetch", "pull", "push", "push-upstream", "remote-add", "remote-remove"].includes(input.operation)) return synchronizeRemote(input);
  if (input.operation === "status") {
    if (typeof input.worktreeId === "string") {
      const root = await assertManagedWorktree(input.worktreeId);
      const top = await realpath(await runGit(root, ["rev-parse", "--show-toplevel"]));
      if (resolve(top) !== resolve(root)) throw new Error("受管 Git 工作树根目录与登记信息不匹配。");
      const relativeProject = typeof input.projectRelativePath === "string" ? input.projectRelativePath : "";
      if (relativeProject.startsWith("/") || relativeProject.split(/[\\/]/u).includes("..")) throw new Error("Git 项目相对路径无效。");
      return { ...await snapshotStatus(root, "", input.baseline, input.worktreeId), projectRelativePath: relativeProject };
    }
    const project = await inspectRepository(input.projectDirectory);
    if (!project) {
      return { repositoryState: "not-repository", repository: null, projectRelativePath: "", worktreeId: null, branch: "", head: null, baseline: null,
        upstream: null, ahead: 0, behind: 0, remotes: [],
        clean: true, changedFileCount: 0, shownFileCount: 0, files: [], insertions: 0, deletions: 0, unknownLineCounts: 0, diff: "", diffTruncated: false, statusTruncated: false };
    }
    const status = await snapshotStatus(project.root, "", null);
    return { ...status, files: status.files.map(file => ({ ...file,
      projectPath: project.projectRelativePath && file.path.startsWith(`${project.projectRelativePath}/`)
        ? file.path.slice(project.projectRelativePath.length + 1) : file.path
    })), repositoryState: project.head ? "ready" : "unborn", projectRelativePath: project.projectRelativePath };
  }
  if (input.operation === "file-diff") {
    const options = { ignoreWhitespace: input.ignoreWhitespace === true, wordDiff: input.wordDiff === true,
      contextLines: Number.isInteger(input.contextLines) ? Math.max(0, Math.min(1000, input.contextLines)) : 3 };
    if (typeof input.worktreeId === "string") {
      const root = await assertManagedWorktree(input.worktreeId);
      const top = await realpath(await runGit(root, ["rev-parse", "--show-toplevel"]));
      if (resolve(top) !== resolve(root)) throw new Error("受管 Git 工作树根目录与登记信息不匹配。");
      const relativeProject = typeof input.projectRelativePath === "string" ? input.projectRelativePath : "";
      if (relativeProject.startsWith("/") || relativeProject.split(/[\\/]/u).includes("..")) throw new Error("Git 项目相对路径无效。");
      if (typeof input.baseline !== "string" || !shaPattern.test(input.baseline)) throw new Error("Git 工作树恢复基线无效。");
      return { ...await snapshotFileDiff(root, "", input.baseline, input.path, options), projectRelativePath: relativeProject };
    }
    const project = await inspectRepository(input.projectDirectory);
    if (!project) throw new Error("当前项目目录尚未初始化 Git 仓库。");
    return { ...await snapshotFileDiff(project.root, project.projectRelativePath, project.head, input.path, options), projectRelativePath: project.projectRelativePath };
  }
  throw new Error("Git 工作区不支持此操作。");
}
