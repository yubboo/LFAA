// 验证工作树服务的创建、查询、删除与安全边界：同级目录、分支校验、钩子禁用与脏目录保护。
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { Context } from "@deepseek-ai/cordis";
import { workspacePlugin } from "@lfaa/workspace";
import worktreePlugin, { buildWorktreePath } from "../src/index";
import { hardenedGitArgs, listFilterConfigKeys } from "../src/git-command";

const exec = promisify(execFile);

async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await exec("git", args, { cwd, windowsHide: true });
  return String(stdout);
}

async function createRepo(root: string): Promise<void> {
  await fs.mkdir(root, { recursive: true });
  await git(root, "init", "-q");
  await git(root, "config", "user.email", "test@example.com");
  await git(root, "config", "user.name", "Test");
  await fs.writeFile(path.join(root, "README.md"), "# demo\n", "utf8");
  await git(root, "add", ".");
  await git(root, "commit", "-q", "-m", "init");
}

async function setup(): Promise<{
  tempRoot: string;
  repo: string;
  ctx: Context;
  projectId: string;
}> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-worktree-"));
  const repo = path.join(tempRoot, "project");
  await createRepo(repo);
  const ctx = new Context();
  await ctx.plugin(workspacePlugin, {
    storeFilePath: path.join(tempRoot, "projects.json"),
    documentsDir: path.join(tempRoot, "Documents"),
    folderPicker: async () => ({ cancelled: false, path: repo }),
  });
  const project = await ctx.workspace.createProject({ name: "demo", rootPath: repo, trusted: true });
  await ctx.plugin(worktreePlugin, { storeFilePath: path.join(tempRoot, "worktrees.json") });
  return { tempRoot, repo, ctx, projectId: project.id };
}

test("创建同级工作树并检出到新分支，可列出与检查目录", async () => {
  const { tempRoot, repo, ctx, projectId } = await setup();
  try {
    const created = await ctx.worktree.create({ projectId, branch: "feature/ocean" });
    assert.equal(created.branch, "feature/ocean");
    assert.equal(created.baseRef, (await git(repo, "rev-parse", "--abbrev-ref", "HEAD")).trim());
    assert.equal(created.projectId, projectId);
    assert.ok(created.path.startsWith(path.join(tempRoot, "project-worktrees")));
    assert.equal(created.path, buildWorktreePath(repo, created.id, "feature/ocean"));
    assert.equal((await fs.readFile(path.join(created.path, "README.md"), "utf8")).trim(), "# demo");
    assert.equal((await git(created.path, "rev-parse", "--abbrev-ref", "HEAD")).trim(), "feature/ocean");
    assert.equal(created.exists, true);
    assert.equal(created.dirtyCount, 0);
    assert.equal(created.sessionCount, 0);

    const list = await ctx.worktree.list(projectId);
    assert.equal(list.length, 1);
    assert.equal(list[0]?.id, created.id);

    const inspection = await ctx.worktree.inspect(created.id);
    assert.ok(inspection);
    assert.equal(inspection.exists, true);
    assert.ok(inspection.entries.some((entry) => entry.name === "README.md" && entry.kind === "file"));

    const file = await ctx.worktree.readFile(created.id, "README.md");
    assert.equal(file?.content.trim(), "# demo");
    await assert.rejects(() => ctx.worktree.readFile(created.id, "../outside.txt"), /超出当前工作树目录边界/u);

    await fs.writeFile(path.join(created.path, "wt-commit.txt"), "x", "utf8");
    await git(created.path, "add", ".");
    await git(created.path, "commit", "-q", "-m", "wt commit");
    const afterCommit = (await ctx.worktree.list(projectId))[0];
    assert.equal(afterCommit?.ahead, 1);
    assert.equal(afterCommit?.behind, 0);

    const preview = await ctx.worktree.previewMerge(created.id);
    assert.ok(preview);
    assert.equal(preview?.upToDate, false);
    assert.equal(preview?.clean, true);
    assert.deepEqual(preview?.conflicts, []);
    assert.equal(preview?.baseRef, (await git(repo, "rev-parse", "--abbrev-ref", "HEAD")).trim());

    const repository = await ctx.worktree.repositoryInfo(projectId);
    assert.ok(repository);
    assert.equal(repository?.dirtyCount, 0);
    await fs.writeFile(path.join(repo, "dirty-main.txt"), "x", "utf8");
    assert.equal((await ctx.worktree.repositoryInfo(projectId))?.dirtyCount, 1);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("分支重复、分支名非法、项目非 Git 仓库都给出可读错误且不留残留", async () => {
  const { tempRoot, ctx, projectId } = await setup();
  try {
    await ctx.worktree.create({ projectId, branch: "feature/dup" });
    await assert.rejects(() => ctx.worktree.create({ projectId, branch: "feature/dup" }), /已存在/u);
    await assert.rejects(() => ctx.worktree.create({ projectId, branch: "feature/../bad" }), /不合法/u);
    await assert.rejects(() => ctx.worktree.create({ projectId, branch: "feature/missing", from: "no-such-ref" }), /不存在/u);

    const plainDir = path.join(tempRoot, "not-a-repo");
    await fs.mkdir(plainDir, { recursive: true });
    const plainProject = await ctx.workspace.createProject({ name: "plain", rootPath: plainDir, trusted: true });
    await assert.rejects(() => ctx.worktree.create({ projectId: plainProject.id, branch: "x" }), /不是 Git 仓库/u);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("删除默认拒绝脏目录与绑定会话，强制删除后目录消失", async () => {
  const { tempRoot, repo, ctx, projectId } = await setup();
  try {
    const created = await ctx.worktree.create({ projectId, branch: "feature/cleanup" });
    await fs.writeFile(path.join(created.path, "dirty.txt"), "change\n", "utf8");
    await assert.rejects(() => ctx.worktree.remove(created.id), /未提交改动/u);
    assert.equal(await ctx.worktree.remove(created.id, { force: true }), true);
    await assert.rejects(() => fs.stat(created.path), { code: "ENOENT" });
    assert.equal((await ctx.worktree.list(projectId)).length, 0);

    const bound = await ctx.worktree.create({ projectId, branch: "feature/bound" });
    ctx.worktree.setSessionCounter(async () => 1);
    await assert.rejects(() => ctx.worktree.remove(bound.id), /仍有 1 个会话/u);
    ctx.worktree.setSessionCounter(async () => 0);
    assert.equal(await ctx.worktree.remove(bound.id), true);

    const merged = await ctx.worktree.create({ projectId, branch: "feature/merged" });
    const mergedResult = await ctx.worktree.removeAndDeleteBranch(merged.id);
    assert.equal(mergedResult.removed, true);
    assert.equal(mergedResult.branchDeleted, true);
    await assert.rejects(() => git(repo, "show-ref", "--verify", "refs/heads/feature/merged"));

    const unmerged = await ctx.worktree.create({ projectId, branch: "feature/unmerged" });
    await fs.writeFile(path.join(unmerged.path, "unmerged.txt"), "x", "utf8");
    await git(unmerged.path, "add", ".");
    await git(unmerged.path, "commit", "-q", "-m", "unmerged");
    const unmergedResult = await ctx.worktree.removeAndDeleteBranch(unmerged.id);
    assert.equal(unmergedResult.removed, true);
    assert.equal(unmergedResult.branchDeleted, false);
    assert.match(unmergedResult.error ?? "", /未合并/u);
    assert.ok((await git(repo, "show-ref", "--verify", "refs/heads/feature/unmerged")).trim());

    const stale = await ctx.worktree.create({ projectId, branch: "feature/stale" });
    await fs.rm(stale.path, { recursive: true, force: true });
    ctx.worktree.setSessionCounter(async () => 1);
    assert.equal(await ctx.worktree.prune(), 0);
    assert.equal((await ctx.worktree.list(projectId)).some((item) => item.id === stale.id), true);
    ctx.worktree.setSessionCounter(async () => 0);
    assert.equal(await ctx.worktree.prune(), 1);
    assert.equal((await ctx.worktree.list(projectId)).length, 0);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("创建时禁用仓库钩子，避免检出执行仓库自带命令", async () => {
  const { tempRoot, repo, ctx, projectId } = await setup();
  try {
    const marker = path.join(tempRoot, "hook-ran.txt");
    const hookPath = path.join(repo, ".git", "hooks", "post-checkout");
    const posixMarker = marker.replace(/\\/gu, "/");
    await fs.writeFile(hookPath, `#!/bin/sh\necho hooked > "${posixMarker}"\n`, "utf8");
    const created = await ctx.worktree.create({ projectId, branch: "feature/hook-check" });
    await assert.rejects(() => fs.stat(marker), { code: "ENOENT" });
    assert.equal(created.exists, true);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("加固参数包含 hooksPath、fsmonitor 与仓库过滤器覆盖", async () => {
  const args = hardenedGitArgs(["worktree", "add", "x"], ["filter.evil.smudge", "filter.evil.clean"]);
  assert.ok(args.includes("core.hooksPath=/dev/null"));
  assert.ok(args.includes("core.fsmonitor=false"));
  assert.ok(args.includes("filter.evil.smudge="));
  assert.ok(args.includes("filter.evil.clean="));
  assert.equal(args.at(-3), "worktree");

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-filter-"));
  try {
    await createRepo(tempRoot);
    await git(tempRoot, "config", "filter.evil.smudge", "echo evil");
    const keys = await listFilterConfigKeys(tempRoot);
    assert.ok(keys.includes("filter.evil.smudge"));
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});