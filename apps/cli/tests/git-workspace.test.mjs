import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { join, resolve } from "node:path";
import test from "node:test";
import { randomUUID } from "node:crypto";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, "../../..");

test("managed AI Worktree snapshots source edits, reports real diffs, and restores without touching source", async t => {
  await mkdir(join(repositoryRoot, "dist", ".tmp"), { recursive: true });
  const fixtureRoot = await mkdtemp(join(repositoryRoot, "dist", ".tmp", "git-workspace-"));
  const dataRoot = join(fixtureRoot, "daemon-data");
  const sourceRoot = join(fixtureRoot, "source");
  await mkdir(dataRoot, { recursive: true });
  await mkdir(sourceRoot, { recursive: true });
  process.env.LFAA_DAEMON_DATA_ROOT = dataRoot;
  t.after(async () => {
    delete process.env.LFAA_DAEMON_DATA_ROOT;
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
  const { executeGitWorkspace } = await import("../../../packages/host/daemon/src/git-workspace.mjs");
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
  const priorDataRoot = process.env.LFAA_DAEMON_DATA_ROOT;
  const dataRoot = join(fixtureRoot, "daemon-data");
  const sourceRoot = join(fixtureRoot, "source");
  const projectRoot = join(sourceRoot, "project");
  await mkdir(dataRoot, { recursive: true });
  await mkdir(projectRoot, { recursive: true });
  process.env.LFAA_DAEMON_DATA_ROOT = dataRoot;
  t.after(async () => {
    if (priorDataRoot === undefined) delete process.env.LFAA_DAEMON_DATA_ROOT;
    else process.env.LFAA_DAEMON_DATA_ROOT = priorDataRoot;
    await rm(fixtureRoot, { recursive: true, force: true });
  });

  const git = async (...args) => (await execFileAsync("git", ["--no-pager", "-C", sourceRoot, ...args], { encoding: "utf8", windowsHide: true })).stdout.trim();
  await git("init", "--initial-branch=main");
  await git("config", "user.name", "LFAA Test");
  await git("config", "user.email", "lfaa-test@example.invalid");
  await writeFile(join(projectRoot, "tracked.txt"), "value changed\n", "utf8");
  await writeFile(join(sourceRoot, "outside.txt"), "outside\n", "utf8");
  await git("add", "--", "project/tracked.txt", "outside.txt");
  await git("commit", "-m", "initial");
  await writeFile(join(projectRoot, "tracked.txt"), "value  changed\n", "utf8");
  await writeFile(join(projectRoot, "new.txt"), "new content\n", "utf8");

  const { executeGitWorkspace } = await import("../../../packages/host/daemon/src/git-workspace.mjs");
  const normal = await executeGitWorkspace({ operation: "file-diff", projectDirectory: projectRoot, path: "project/tracked.txt" });
  assert.equal(normal.path, "project/tracked.txt");
  assert.match(normal.diff, /value  changed/u);
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
