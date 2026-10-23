import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, "../../..");

test("Git status distinguishes a normal directory and exposes only an explicit initialization action", async t => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "lfaa-git-init-status-"));
  const dataRoot = join(fixtureRoot, "lfaa-data");
  const sourceRoot = join(fixtureRoot, "source");
  await mkdir(dataRoot, { recursive: true });
  await mkdir(sourceRoot, { recursive: true });
  const previousDataRoot = process.env.LFAA_GIT_DATA_ROOT;
  const previousHome = process.env.LFAA_HOME;
  const previousLfaaData = process.env.LFAA_DATA_DIR;
  process.env.LFAA_GIT_DATA_ROOT = dataRoot;
  process.env.LFAA_HOME = join(fixtureRoot, "home");
  process.env.LFAA_DATA_DIR = dataRoot;
  t.after(async () => {
    if (previousDataRoot === undefined) delete process.env.LFAA_GIT_DATA_ROOT;
    else process.env.LFAA_GIT_DATA_ROOT = previousDataRoot;
    if (previousHome === undefined) delete process.env.LFAA_HOME;
    else process.env.LFAA_HOME = previousHome;
    if (previousLfaaData === undefined) delete process.env.LFAA_DATA_DIR;
    else process.env.LFAA_DATA_DIR = previousLfaaData;
    await rm(fixtureRoot, { recursive: true, force: true });
  });

  const sourceFile = join(sourceRoot, "first.txt");
  await writeFile(sourceFile, "first line\nsecond line\n", "utf8");
  const { executeGitWorkspace } = await import("../../../packages/host/git/src/git-workspace.mjs");
  const before = await executeGitWorkspace({ operation: "status", projectDirectory: sourceRoot });
  assert.equal(before.repositoryState, "not-repository");
  assert.equal(before.changedFileCount, 0);
  assert.equal(before.repository, null);
  await assert.rejects(executeGitWorkspace({ operation: "file-diff", projectDirectory: sourceRoot, path: "first.txt" }), /尚未初始化 Git 仓库/u);

  const initialized = await executeGitWorkspace({ operation: "initialize", projectDirectory: sourceRoot });
  assert.equal(initialized.repositoryState, "unborn");
  assert.equal(initialized.head, null);
  assert.equal(initialized.clean, false);
  assert.equal(initialized.changedFileCount, 1);
  assert.equal(initialized.insertions, 2);
  assert.match(initialized.diff, /first line/u);
  assert.equal(await readFile(sourceFile, "utf8"), "first line\nsecond line\n");
  await assert.rejects(executeGitWorkspace({ operation: "initialize", projectDirectory: sourceRoot }), /已经位于 Git 仓库中/u);
  const unbornFileDiff = await executeGitWorkspace({ operation: "file-diff", projectDirectory: sourceRoot, path: "first.txt" });
  assert.match(unbornFileDiff.diff, /second line/u);
  assert.equal((await executeGitWorkspace({ operation: "status", projectDirectory: sourceRoot })).repositoryState, "unborn");
});

test("local Git operations stage safely, commit staged changes, show history, and manage branches", async t => {
  await mkdir(join(repositoryRoot, "dist", ".tmp"), { recursive: true });
  const fixtureRoot = await mkdtemp(join(repositoryRoot, "dist", ".tmp", "git-local-operations-"));
  const priorDataRoot = process.env.LFAA_GIT_DATA_ROOT;
  const dataRoot = join(fixtureRoot, "daemon-data");
  const sourceRoot = join(fixtureRoot, "source");
  await mkdir(dataRoot, { recursive: true });
  await mkdir(sourceRoot, { recursive: true });
  process.env.LFAA_GIT_DATA_ROOT = dataRoot;
  t.after(async () => {
    if (priorDataRoot === undefined) delete process.env.LFAA_GIT_DATA_ROOT;
    else process.env.LFAA_GIT_DATA_ROOT = priorDataRoot;
    await rm(fixtureRoot, { recursive: true, force: true });
  });

  const git = async (...args) => (await execFileAsync("git", ["--no-pager", "-C", sourceRoot, ...args], { encoding: "utf8", windowsHide: true })).stdout.trim();
  await git("init", "--initial-branch=main");
  await git("config", "user.name", "LFAA Test");
  await git("config", "user.email", "lfaa-test@example.invalid");
  await writeFile(join(sourceRoot, "first.txt"), "first line\n", "utf8");
  const { executeGitWorkspace } = await import("../../../packages/host/git/src/git-workspace.mjs");

  const initial = await executeGitWorkspace({ operation: "status", projectDirectory: sourceRoot });
  assert.equal(initial.repositoryState, "unborn");
  assert.equal(initial.files[0]?.status.trim(), "??");
  const staged = await executeGitWorkspace({ operation: "stage", projectDirectory: sourceRoot, paths: ["first.txt"] });
  assert.equal(staged.files[0]?.status.trim(), "A");
  const unstaged = await executeGitWorkspace({ operation: "unstage", projectDirectory: sourceRoot, paths: ["first.txt"] });
  assert.equal(unstaged.files[0]?.status.trim(), "??");
  await executeGitWorkspace({ operation: "stage", projectDirectory: sourceRoot });
  const committed = await executeGitWorkspace({ operation: "commit", projectDirectory: sourceRoot, message: "Add first file" });
  assert.equal(committed.clean, true);
  assert.equal(committed.head, await git("rev-parse", "HEAD"));

  const history = await executeGitWorkspace({ operation: "history", projectDirectory: sourceRoot, limit: 10 });
  assert.equal(history.commits.length, 1);
  assert.equal(history.commits[0].subject, "Add first file");
  assert.equal(history.commits[0].author, "LFAA Test");

  const created = await executeGitWorkspace({ operation: "branch-create", projectDirectory: sourceRoot, branch: "codex/local-test" });
  assert.equal(created.branch, "codex/local-test");
  const branches = await executeGitWorkspace({ operation: "branches", projectDirectory: sourceRoot });
  assert.equal(branches.branches.find(branch => branch.name === "codex/local-test")?.current, true);
  await executeGitWorkspace({ operation: "branch-switch", projectDirectory: sourceRoot, branch: "main" });
  await executeGitWorkspace({ operation: "branch-delete", projectDirectory: sourceRoot, branch: "codex/local-test" });
  const finalBranches = await executeGitWorkspace({ operation: "branches", projectDirectory: sourceRoot });
  assert.deepEqual(finalBranches.branches.map(branch => branch.name), ["main"]);

  const registeredSubdirectory = join(sourceRoot, "subproject");
  await mkdir(registeredSubdirectory);
  await writeFile(join(registeredSubdirectory, "inside.txt"), "inside project\n", "utf8");
  await writeFile(join(sourceRoot, "outside.txt"), "other project\n", "utf8");
  await git("add", "--", "outside.txt");
  const repositoryStatus = await executeGitWorkspace({ operation: "status", projectDirectory: registeredSubdirectory });
  assert.equal(repositoryStatus.projectRelativePath, "subproject");
  assert.deepEqual(repositoryStatus.files.map(file => file.path), ["outside.txt", "subproject/inside.txt"]);
  assert.deepEqual(repositoryStatus.files.map(file => file.projectPath), ["outside.txt", "inside.txt"]);
  const fullRepositoryStage = await executeGitWorkspace({ operation: "stage", projectDirectory: registeredSubdirectory, paths: ["subproject/inside.txt"] });
  assert.deepEqual(fullRepositoryStage.files.map(file => file.path), ["outside.txt", "subproject/inside.txt"]);
  const repositoryRootCommit = await executeGitWorkspace({ operation: "commit", projectDirectory: registeredSubdirectory, message: "Commit complete repository changes" });
  assert.equal(repositoryRootCommit.clean, true);
  const committedPaths = await git("show", "--format=", "--name-only", "HEAD");
  assert.ok(committedPaths.includes("outside.txt"));
  assert.ok(committedPaths.includes("subproject/inside.txt"));
  assert.equal((await readFile(join(sourceRoot, "outside.txt"), "utf8")), "other project\n");
});

test("Git remote operations fetch, fast-forward pull, publish the current branch, and protect local edits", async t => {
  await mkdir(join(repositoryRoot, "dist", ".tmp"), { recursive: true });
  const fixtureRoot = await mkdtemp(join(repositoryRoot, "dist", ".tmp", "git-remote-operations-"));
  const dataRoot = join(fixtureRoot, "lfaa-data");
  const sourceRoot = join(fixtureRoot, "source");
  const remoteRoot = join(fixtureRoot, "remote.git");
  const collaboratorRoot = join(fixtureRoot, "collaborator");
  await mkdir(dataRoot, { recursive: true });
  await mkdir(sourceRoot, { recursive: true });
  const previousDataRoot = process.env.LFAA_GIT_DATA_ROOT;
  const previousHome = process.env.LFAA_HOME;
  const previousLfaaData = process.env.LFAA_DATA_DIR;
  process.env.LFAA_GIT_DATA_ROOT = dataRoot;
  process.env.LFAA_HOME = join(fixtureRoot, "home");
  process.env.LFAA_DATA_DIR = dataRoot;
  t.after(async () => {
    if (previousDataRoot === undefined) delete process.env.LFAA_GIT_DATA_ROOT;
    else process.env.LFAA_GIT_DATA_ROOT = previousDataRoot;
    if (previousHome === undefined) delete process.env.LFAA_HOME;
    else process.env.LFAA_HOME = previousHome;
    if (previousLfaaData === undefined) delete process.env.LFAA_DATA_DIR;
    else process.env.LFAA_DATA_DIR = previousLfaaData;
    await rm(fixtureRoot, { recursive: true, force: true });
  });

  const gitAt = async (directory, ...args) => (await execFileAsync("git", ["--no-pager", "-C", directory, ...args], { encoding: "utf8", windowsHide: true })).stdout.trim();
  await execFileAsync("git", ["init", "--bare", "--initial-branch=main", remoteRoot], { encoding: "utf8", windowsHide: true });
  await gitAt(sourceRoot, "init", "--initial-branch=main");
  await gitAt(sourceRoot, "config", "user.name", "LFAA Test");
  await gitAt(sourceRoot, "config", "user.email", "lfaa-test@example.invalid");
  await writeFile(join(sourceRoot, "tracked.txt"), "local one\n", "utf8");
  await gitAt(sourceRoot, "add", "--", "tracked.txt");
  await gitAt(sourceRoot, "commit", "-m", "initial");

  const { executeGitWorkspace } = await import("../../../packages/host/git/src/git-workspace.mjs");
  const remoteUrl = pathToFileURL(remoteRoot).href;
  const addedRemote = await executeGitWorkspace({ operation: "remote-add", projectDirectory: sourceRoot, remote: "origin", url: remoteUrl });
  assert.deepEqual(addedRemote.remotes, ["origin"]);
  const published = await executeGitWorkspace({ operation: "push-upstream", projectDirectory: sourceRoot, remote: "origin" });
  assert.equal(published.upstream, "origin/main");
  assert.equal(published.ahead, 0);
  assert.equal(published.behind, 0);

  await writeFile(join(sourceRoot, "tracked.txt"), "local two\n", "utf8");
  await gitAt(sourceRoot, "add", "--", "tracked.txt");
  await gitAt(sourceRoot, "commit", "-m", "local update");
  assert.equal((await executeGitWorkspace({ operation: "status", projectDirectory: sourceRoot })).ahead, 1);
  const pushed = await executeGitWorkspace({ operation: "push", projectDirectory: sourceRoot });
  assert.equal(pushed.ahead, 0);
  assert.equal(await gitAt(remoteRoot, "rev-parse", "refs/heads/main"), await gitAt(sourceRoot, "rev-parse", "HEAD"));

  await execFileAsync("git", ["clone", remoteRoot, collaboratorRoot], { encoding: "utf8", windowsHide: true });
  await gitAt(collaboratorRoot, "config", "user.name", "LFAA Collaborator");
  await gitAt(collaboratorRoot, "config", "user.email", "collaborator@example.invalid");
  await writeFile(join(collaboratorRoot, "tracked.txt"), "remote two\n", "utf8");
  await gitAt(collaboratorRoot, "add", "--", "tracked.txt");
  await gitAt(collaboratorRoot, "commit", "-m", "remote update");
  await gitAt(collaboratorRoot, "push");
  const fetched = await executeGitWorkspace({ operation: "fetch", projectDirectory: sourceRoot, remote: "origin" });
  assert.equal(fetched.behind, 1);
  const pulled = await executeGitWorkspace({ operation: "pull", projectDirectory: sourceRoot });
  assert.equal(pulled.behind, 0);
  assert.equal((await readFile(join(sourceRoot, "tracked.txt"), "utf8")).replace(/\r\n/gu, "\n"), "remote two\n");

  await writeFile(join(sourceRoot, "tracked.txt"), "local uncommitted\n", "utf8");
  await writeFile(join(collaboratorRoot, "tracked.txt"), "remote three\n", "utf8");
  await gitAt(collaboratorRoot, "add", "--", "tracked.txt");
  await gitAt(collaboratorRoot, "commit", "-m", "second remote update");
  await gitAt(collaboratorRoot, "push");
  await executeGitWorkspace({ operation: "fetch", projectDirectory: sourceRoot, remote: "origin" });
  await assert.rejects(executeGitWorkspace({ operation: "pull", projectDirectory: sourceRoot }), /拉取前请先提交或暂存/u);
  assert.equal(await readFile(join(sourceRoot, "tracked.txt"), "utf8"), "local uncommitted\n");
  const removedRemote = await executeGitWorkspace({ operation: "remote-remove", projectDirectory: sourceRoot, remote: "origin" });
  assert.deepEqual(removedRemote.remotes, []);
  const sshRemote = await executeGitWorkspace({ operation: "remote-add", projectDirectory: sourceRoot, remote: "ssh-origin", url: "ssh://git@example.invalid/team/repo.git" });
  assert.deepEqual(sshRemote.remotes, ["ssh-origin"]);
  await assert.rejects(executeGitWorkspace({ operation: "fetch", projectDirectory: sourceRoot, remote: "ssh-origin" }), /尚未接入账户隔离的 SSH 凭据/u);
  await assert.rejects(executeGitWorkspace({ operation: "remote-add", projectDirectory: sourceRoot, remote: "unsafe", url: "https://token@example.invalid/repo.git" }), /不允许嵌入凭据/u);
});

test("managed AI Worktree snapshots source edits, reports real diffs, and restores without touching source", async t => {
  await mkdir(join(repositoryRoot, "dist", ".tmp"), { recursive: true });
  const fixtureRoot = await mkdtemp(join(repositoryRoot, "dist", ".tmp", "git-workspace-"));
  const dataRoot = join(fixtureRoot, "daemon-data");
  const sourceRoot = join(fixtureRoot, "source");
  await mkdir(dataRoot, { recursive: true });
  await mkdir(sourceRoot, { recursive: true });
  process.env.LFAA_GIT_DATA_ROOT = dataRoot;
  t.after(async () => {
    delete process.env.LFAA_GIT_DATA_ROOT;
    await rm(fixtureRoot, { recursive: true, force: true });
  });

  const git = async (...args) => (await execFileAsync("git", ["--no-pager", "-C", sourceRoot, ...args], { encoding: "utf8", windowsHide: true })).stdout.trim();
  await git("init", "--initial-branch=main");
  await git("config", "user.name", "LFAA Test");
  await git("config", "user.email", "lfaa-test@example.invalid");
  await git("config", "core.autocrlf", "false");
  await writeFile(join(sourceRoot, ".gitignore"), "ignored.txt\n", "utf8");
  await writeFile(join(sourceRoot, "tracked.txt"), "committed\n", "utf8");
  await git("add", "--", ".gitignore", "tracked.txt");
  await git("commit", "-m", "initial");

  await writeFile(join(sourceRoot, "tracked.txt"), "staged version\n", "utf8");
  await git("add", "--", "tracked.txt");
  await writeFile(join(sourceRoot, "tracked.txt"), "working version\n", "utf8");
  await writeFile(join(sourceRoot, "untracked.txt"), "untracked source content\n", "utf8");
  await writeFile(join(sourceRoot, "ignored.txt"), "source ignored data\n", "utf8");

  const sourceHead = await git("rev-parse", "HEAD");
  const sourceIndex = await readFile(join(sourceRoot, ".git", "index"));
  const sourceTracked = await readFile(join(sourceRoot, "tracked.txt"));
  const sourceUntracked = await readFile(join(sourceRoot, "untracked.txt"));
  const { executeGitWorkspace } = await import("../../../packages/host/git/src/git-workspace.mjs");
  const worktreeId = randomUUID();
  const created = await executeGitWorkspace({
    operation: "create-worktree",
    worktreeId,
    projectDirectory: sourceRoot,
    projectTitle: "Git workspace regression",
    branchPrefix: "codex/"
  });

  assert.equal(created.sourceHead, sourceHead);
  assert.match(created.branch, /^codex\/git-workspace-regression-/u);
  assert.equal(await git("rev-parse", "HEAD"), sourceHead);
  assert.deepEqual(await readFile(join(sourceRoot, ".git", "index")), sourceIndex);
  assert.deepEqual(await readFile(join(sourceRoot, "tracked.txt")), sourceTracked);
  assert.deepEqual(await readFile(join(sourceRoot, "untracked.txt")), sourceUntracked);
  assert.equal(await readFile(join(created.worktreeRoot, "tracked.txt"), "utf8"), "working version\n");
  assert.equal(await readFile(join(created.worktreeRoot, "untracked.txt"), "utf8"), "untracked source content\n");
  await assert.rejects(readFile(join(created.worktreeRoot, "ignored.txt")), { code: "ENOENT" });

  await writeFile(join(created.worktreeRoot, "tracked.txt"), "AI changed this\n", "utf8");
  await writeFile(join(created.worktreeRoot, "ai-added.txt"), "AI added this\n", "utf8");
  const changed = await executeGitWorkspace({ operation: "status", worktreeId, baseline: created.baseline });
  assert.equal(changed.clean, false);
  assert.equal(changed.changedFileCount, 2);
  assert.match(changed.diff, /AI changed this/u);
  assert.match(changed.diff, /AI added this/u);

  await writeFile(join(created.worktreeRoot, "ignored.txt"), "keep ignored worktree data\n", "utf8");
  const restored = await executeGitWorkspace({ operation: "reset-worktree", worktreeId, baseline: created.baseline });
  assert.equal(restored.clean, true);
  assert.equal(await readFile(join(created.worktreeRoot, "tracked.txt"), "utf8"), "working version\n");
  await assert.rejects(readFile(join(created.worktreeRoot, "ai-added.txt")), { code: "ENOENT" });
  assert.equal(await readFile(join(created.worktreeRoot, "ignored.txt"), "utf8"), "keep ignored worktree data\n");
  assert.equal(await git("rev-parse", "HEAD"), sourceHead);
  assert.deepEqual(await readFile(join(sourceRoot, ".git", "index")), sourceIndex);
  assert.deepEqual(await readFile(join(sourceRoot, "tracked.txt")), sourceTracked);

  await executeGitWorkspace({ operation: "remove-worktree", worktreeId, sourceDirectory: sourceRoot, branch: created.branch });
  await assert.rejects(readFile(join(created.worktreeRoot, "tracked.txt")), { code: "ENOENT" });
  assert.equal(await git("show-ref", "--verify", `refs/heads/${created.branch}`), `${await git("rev-parse", `refs/heads/${created.branch}`)} refs/heads/${created.branch}`);
  await assert.rejects(executeGitWorkspace({ operation: "reset-worktree", worktreeId: "../../source", baseline: created.baseline }));
});

test("Git file review returns bounded per-file diffs and enforces registered project boundaries", async t => {
  await mkdir(join(repositoryRoot, "dist", ".tmp"), { recursive: true });
  const fixtureRoot = await mkdtemp(join(repositoryRoot, "dist", ".tmp", "git-file-review-"));
  const priorDataRoot = process.env.LFAA_GIT_DATA_ROOT;
  const dataRoot = join(fixtureRoot, "daemon-data");
  const sourceRoot = join(fixtureRoot, "source");
  const projectRoot = join(sourceRoot, "project");
  await mkdir(dataRoot, { recursive: true });
  await mkdir(projectRoot, { recursive: true });
  process.env.LFAA_GIT_DATA_ROOT = dataRoot;
  t.after(async () => {
    if (priorDataRoot === undefined) delete process.env.LFAA_GIT_DATA_ROOT;
    else process.env.LFAA_GIT_DATA_ROOT = priorDataRoot;
    await rm(fixtureRoot, { recursive: true, force: true });
  });

  const git = async (...args) => (await execFileAsync("git", ["--no-pager", "-C", sourceRoot, ...args], { encoding: "utf8", windowsHide: true })).stdout.trim();
  await git("init", "--initial-branch=main");
  await git("config", "user.name", "LFAA Test");
  await git("config", "user.email", "lfaa-test@example.invalid");
  await writeFile(join(projectRoot, "tracked.txt"), "value changed\n", "utf8");
  const originalContextLines = Array.from({ length: 100 }, (_, index) => `line ${index + 1}`);
  await writeFile(join(projectRoot, "context.txt"), `${originalContextLines.join("\n")}\n`, "utf8");
  await writeFile(join(sourceRoot, "outside.txt"), "outside\n", "utf8");
  await git("add", "--", "project/tracked.txt", "project/context.txt", "outside.txt");
  await git("commit", "-m", "initial");
  await writeFile(join(projectRoot, "tracked.txt"), "value  changed\n", "utf8");
  const changedContextLines = [...originalContextLines];
  changedContextLines[1] = "line two edited";
  changedContextLines[77] = "line seventy-eight edited";
  await writeFile(join(projectRoot, "context.txt"), `${changedContextLines.join("\n")}\n`, "utf8");
  await writeFile(join(projectRoot, "new.txt"), "new content\n", "utf8");

  const { executeGitWorkspace } = await import("../../../packages/host/git/src/git-workspace.mjs");
  const normal = await executeGitWorkspace({ operation: "file-diff", projectDirectory: projectRoot, path: "project/tracked.txt" });
  assert.equal(normal.path, "project/tracked.txt");
  assert.match(normal.diff, /value  changed/u);
  const compactContextDiff = await executeGitWorkspace({ operation: "file-diff", projectDirectory: projectRoot, path: "project/context.txt" });
  assert.equal((compactContextDiff.diff.match(/^@@/gmu) ?? []).length, 2, "默认差异保留分隔开的代码段");
  const expandedContextDiff = await executeGitWorkspace({ operation: "file-diff", projectDirectory: projectRoot, path: "project/context.txt", contextLines: 40 });
  assert.equal((expandedContextDiff.diff.match(/^@@/gmu) ?? []).length, 1, "受限的大上下文请求会把间隔行纳入真实 Git 差异");
  const patchTargetRoot = join(fixtureRoot, "patch-target");
  await execFileAsync("git", ["clone", "--quiet", "--no-hardlinks", sourceRoot, patchTargetRoot], { encoding: "utf8", windowsHide: true });
  const trackedPatchPath = join(fixtureRoot, "tracked-file.patch");
  await writeFile(trackedPatchPath, normal.diff, "utf8");
  await execFileAsync("git", ["-C", patchTargetRoot, "apply", "--check", "--", trackedPatchPath], { encoding: "utf8", windowsHide: true });
  const whitespaceIgnored = await executeGitWorkspace({ operation: "file-diff", projectDirectory: projectRoot, path: "project/tracked.txt", ignoreWhitespace: true });
  assert.equal(whitespaceIgnored.diff, "");
  assert.equal(whitespaceIgnored.ignoreWhitespace, true);
  const added = await executeGitWorkspace({ operation: "file-diff", projectDirectory: projectRoot, path: "project/new.txt" });
  assert.match(added.diff, /new content/u);
  assert.equal(added.diffTruncated, false);
  const addedPatchPath = join(fixtureRoot, "new-file.patch");
  await writeFile(addedPatchPath, added.diff, "utf8");
  await execFileAsync("git", ["-C", patchTargetRoot, "apply", "--check", "--", addedPatchPath], { encoding: "utf8", windowsHide: true });
  await writeFile(join(projectRoot, "empty.txt"), "", "utf8");
  const emptyAdded = await executeGitWorkspace({ operation: "file-diff", projectDirectory: projectRoot, path: "project/empty.txt" });
  await writeFile(join(fixtureRoot, "empty-file.patch"), emptyAdded.diff, "utf8");
  await execFileAsync("git", ["-C", patchTargetRoot, "apply", "--check", "--", join(fixtureRoot, "empty-file.patch")], { encoding: "utf8", windowsHide: true });
  await writeFile(join(projectRoot, "large.txt"), "x".repeat(200 * 1024), "utf8");
  const large = await executeGitWorkspace({ operation: "file-diff", projectDirectory: projectRoot, path: "project/large.txt" });
  assert.equal(large.diffTruncated, true);
  assert.ok(Buffer.byteLength(large.diff, "utf8") <= 128 * 1024);
  await assert.rejects(executeGitWorkspace({ operation: "file-diff", projectDirectory: projectRoot, path: "outside.txt" }), /不属于当前登记项目目录/u);
  await assert.rejects(executeGitWorkspace({ operation: "file-diff", projectDirectory: projectRoot, path: "../outside.txt" }), /相对路径无效/u);
  const status = await executeGitWorkspace({ operation: "status", projectDirectory: projectRoot });
  assert.equal(status.files.find(file => file.path === "project/tracked.txt")?.projectPath, "tracked.txt");
});
