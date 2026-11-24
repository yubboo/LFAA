// Host 侧工作树服务：在项目仓库同级创建独立检出目录，提供状态查询与带安全校验的清理。
import { randomUUID } from "node:crypto";
import { mkdir, open, readdir, realpath, rm, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { type Context, Service } from "@deepseek-ai/cordis";
import "@lfaa/workspace";
import type {
  CreateWorktreeInput,
  RemoveWorktreeOptions,
  WorktreeInspection,
  WorktreeInspectionEntry,
  WorktreeMergePreview,
  WorktreeRecord,
  WorktreeStatus,
} from "../contract";
import { firstLine, hardenedGitArgs, listFilterConfigKeys, runGit } from "./git-command";
import { WorktreeStore } from "./store";

const DEFAULT_STORE_PATH = join(homedir(), ".lfaa", "worktrees.json");
const MAX_INSPECT_ENTRIES = 200;
const MAX_BRANCH_LENGTH = 120;
const MAX_PREVIEW_FILE_BYTES = 256 * 1024;

/** 允许应用或测试覆盖索引位置并注入会话计数器。 */
export interface WorktreePluginConfig {
  storeFilePath?: string;
  /** 装配层注入：统计绑定到某工作树的会话数；缺省视为 0。 */
  sessionCounter?: (worktreeId: string) => Promise<number>;
}

async function isDirectory(path: string): Promise<boolean> {
  const info = await stat(path).catch(() => null);
  return info?.isDirectory() ?? false;
}

async function countDirtyEntries(path: string): Promise<number> {
  try {
    const { stdout } = await runGit(path, ["status", "--porcelain"]);
    return stdout.split(/\r?\n/u).filter(Boolean).length;
  } catch {
    return 0;
  }
}

/** 相对起点分支统计领先/落后提交，供界面提示是否已经包含主线新提交。 */
async function countAheadBehind(record: WorktreeRecord): Promise<{ ahead: number; behind: number }> {
  if (!record.baseRef) return { ahead: 0, behind: 0 };
  try {
    const { stdout } = await runGit(record.path, ["rev-list", "--left-right", "--count", `${record.baseRef}...HEAD`]);
    const [behindRaw, aheadRaw] = stdout.trim().split(/\s+/u);
    return { behind: Number(behindRaw ?? 0) || 0, ahead: Number(aheadRaw ?? 0) || 0 };
  } catch {
    return { ahead: 0, behind: 0 };
  }
}

/** 目录名带短 id 保证唯一，slug 只保留可读提示；真实分支以记录为准。 */
export function buildWorktreePath(repoRoot: string, id: string, branch: string): string {
  const parent = dirname(repoRoot);
  const repoName = basename(repoRoot) || "repo";
  const slug = branch
    .replace(/[^\w.-]+/gu, "-")
    .replace(/^[-.]+|[-.]+$/gu, "")
    .slice(0, 40) || "worktree";
  return join(parent, `${repoName}-worktrees`, `${id.slice(0, 8)}-${slug}`);
}

async function inspectDirectory(worktreeId: string, path: string): Promise<WorktreeInspection> {
  const dirEntries = (await readdir(path, { withFileTypes: true }).catch(() => null))?.filter((entry) => entry.name !== ".git") ?? null;
  if (!dirEntries) {
    return { worktreeId, path, rootPath: path, exists: false, directoryCount: 0, fileCount: 0, entries: [] };
  }
  const entries = await Promise.all(dirEntries.slice(0, MAX_INSPECT_ENTRIES).map(async (entry): Promise<WorktreeInspectionEntry> => {
    const info = await stat(join(path, entry.name)).catch(() => null);
    return {
      name: entry.name,
      kind: entry.isDirectory() ? "directory" : "file",
      ...(info && !entry.isDirectory() ? { size: info.size } : {}),
      updatedAt: info?.mtimeMs ?? 0,
    };
  }));
  entries.sort((left, right) =>
    Number(right.kind === "directory") - Number(left.kind === "directory") || left.name.localeCompare(right.name));
  return {
    worktreeId,
    path,
    rootPath: path,
    exists: true,
    directoryCount: dirEntries.filter((entry) => entry.isDirectory()).length,
    fileCount: dirEntries.filter((entry) => !entry.isDirectory()).length,
    entries,
  };
}

// Host 侧工作树服务：创建、列出、检查与删除；不读取会话，绑定数量由装配层注入。
export class WorktreeService extends Service {
  static inject = ["workspace"];

  private readonly store: WorktreeStore;
  private sessionCounter: (worktreeId: string) => Promise<number>;

  constructor(ctx: Context, config: WorktreePluginConfig = {}) {
    super(ctx, "worktree");
    this.store = new WorktreeStore(config.storeFilePath ? resolve(config.storeFilePath) : DEFAULT_STORE_PATH);
    this.sessionCounter = config.sessionCounter ?? (async () => 0);
  }

  /** 注册会话计数器；传 null 恢复为 0，供插件卸载时清理。 */
  setSessionCounter(counter: ((worktreeId: string) => Promise<number>) | null): () => void {
    this.sessionCounter = counter ?? (async () => 0);
    return () => {
      this.sessionCounter = async () => 0;
    };
  }

  async create(input: CreateWorktreeInput): Promise<WorktreeStatus> {
    const projectId = input.projectId?.trim();
    if (!projectId) throw new Error("缺少项目标识，无法创建工作树。");
    const project = await this.ctx.workspace.getProject(projectId);
    if (!project) throw new Error("找不到项目，无法创建工作树。");
    const primaryRoot = (project.rootPaths[0] ?? project.rootPath).trim();
    if (!primaryRoot) throw new Error("项目没有可用工作目录。");

    const repositoryRoot = await this.resolveRepositoryRoot(primaryRoot);
    const branch = await this.assertBranchName(repositoryRoot, input.branch);
    if (await this.branchExists(repositoryRoot, branch)) {
      throw new Error(`分支“${branch}”已存在，请换一个分支名。`);
    }
    const baseRef = (input.from ?? "HEAD").trim();
    if (!baseRef || baseRef.startsWith("-")) throw new Error("起点无效，请填写本地分支或提交哈希。");
    const baseCommit = await this.resolveCommit(repositoryRoot, baseRef);
    const baseLabel = await this.resolveBaseLabel(repositoryRoot, baseRef, baseCommit);

    const records = await this.store.read();
    const id = randomUUID();
    const targetPath = buildWorktreePath(repositoryRoot, id, branch);
    if (await isDirectory(targetPath)) throw new Error(`工作树目录已存在：${targetPath}`);
    await mkdir(dirname(targetPath), { recursive: true });

    const filterKeys = await listFilterConfigKeys(repositoryRoot);
    try {
      await runGit(repositoryRoot, hardenedGitArgs(
        ["worktree", "add", "-b", branch, targetPath, baseCommit],
        filterKeys,
      ), { timeoutMs: 60_000 });
    } catch (error) {
      await this.cleanupFailedCreate(repositoryRoot, targetPath, branch);
      throw new Error(`创建工作树失败：${firstLine(error)}`);
    }

    const record: WorktreeRecord = {
      id,
      projectId,
      repositoryRoot,
      path: targetPath,
      branch,
      baseCommit,
      baseRef: baseLabel,
      createdAt: Date.now(),
    };
    try {
      await this.store.write([...records, record]);
    } catch (error) {
      // 索引写不进去时回收本次创建，避免留下看不见的孤儿工作树。
      await this.cleanupFailedCreate(repositoryRoot, targetPath, branch);
      throw new Error(`保存工作树记录失败：${firstLine(error)}`);
    }
    return this.toStatus(record);
  }

  async list(projectId?: string): Promise<WorktreeStatus[]> {
    const records = await this.store.read();
    const filtered = projectId ? records.filter((record) => record.projectId === projectId) : records;
    const statuses = await Promise.all(filtered.map((record) => this.toStatus(record)));
    return statuses.sort((left, right) => right.createdAt - left.createdAt);
  }

  async get(worktreeId: string): Promise<WorktreeStatus | null> {
    const record = (await this.store.read()).find((item) => item.id === worktreeId);
    return record ? this.toStatus(record) : null;
  }

  /** 创建前读取主工作区信息：起点分支与未提交改动数，供弹窗提示。 */
  async repositoryInfo(projectId: string): Promise<{ repositoryRoot: string; branch: string; dirtyCount: number } | null> {
    const project = await this.ctx.workspace.getProject(projectId).catch(() => null);
    if (!project) return null;
    const primaryRoot = (project.rootPaths[0] ?? project.rootPath).trim();
    if (!primaryRoot) return null;
    const repositoryRoot = await this.resolveRepositoryRoot(primaryRoot);
    const branch = await runGit(repositoryRoot, ["rev-parse", "--abbrev-ref", "HEAD"])
      .then((result) => result.stdout.trim())
      .catch(() => "HEAD");
    return { repositoryRoot, branch, dirtyCount: await countDirtyEntries(repositoryRoot) };
  }

  /** 只读合并预演：不写主工作区、不切分支，只用 merge-tree 判断能否干净合并。 */
  async previewMerge(worktreeId: string): Promise<WorktreeMergePreview | null> {
    const record = (await this.store.read()).find((item) => item.id === worktreeId);
    if (!record) return null;
    const baseRef = record.baseRef ?? record.baseCommit.slice(0, 8);
    const currentBranch = await runGit(record.repositoryRoot, ["rev-parse", "--abbrev-ref", "HEAD"])
      .then((result) => result.stdout.trim())
      .catch(() => "");
    const mainDirty = (await countDirtyEntries(record.repositoryRoot)) > 0;
    const aheadCount = await runGit(record.path, ["rev-list", "--count", `${baseRef}..HEAD`])
      .then((result) => Number(result.stdout.trim()) || 0)
      .catch(() => 0);
    const preview: WorktreeMergePreview = {
      worktreeId: record.id,
      baseRef,
      branch: record.branch,
      baseBranchCheckedOut: currentBranch === baseRef,
      mainDirty,
      upToDate: aheadCount === 0,
      clean: aheadCount === 0,
      conflicts: [],
    };
    if (aheadCount === 0) return preview;

    try {
      const { stdout } = await runGit(record.repositoryRoot, [
        "merge-tree",
        "--write-tree",
        "--name-only",
        baseRef,
        record.branch,
      ]);
      const conflicts = stdout.split(/\r?\n/u).slice(1).map((line) => line.trim()).filter(Boolean);
      return { ...preview, clean: conflicts.length === 0, conflicts };
    } catch (error) {
      const stdout = (error as { stdout?: string }).stdout ?? "";
      const conflicts = stdout.split(/\r?\n/u).slice(1).map((line) => line.trim()).filter(Boolean);
      return {
        ...preview,
        clean: false,
        conflicts,
        ...(conflicts.length === 0 ? { error: firstLine(error) } : {}),
      };
    }
  }

  async inspect(worktreeId: string): Promise<WorktreeInspection | null> {
    const record = (await this.store.read()).find((item) => item.id === worktreeId);
    return record ? inspectDirectory(record.id, record.path) : null;
  }

  /** 读取工作树内的文本文件，边界与大小限制和项目文件预览一致。 */
  async readFile(
    worktreeId: string,
    requestedPath: string,
  ): Promise<{ path: string; relativePath: string; content: string; truncated: boolean; size: number } | null> {
    const record = (await this.store.read()).find((item) => item.id === worktreeId);
    if (!record) return null;
    const root = resolve(record.path);
    const target = isAbsolute(requestedPath) ? resolve(requestedPath) : resolve(root, requestedPath);
    const rel = relative(root, target);
    if (rel.startsWith("..") || isAbsolute(rel)) throw new Error("文件路径超出当前工作树目录边界。");
    const info = await stat(target).catch(() => null);
    if (!info || !info.isFile()) throw new Error("目标路径不存在或不是可读文件。");
    const [realRoot, realTarget] = await Promise.all([
      realpath(root).catch(() => root),
      realpath(target).catch(() => null),
    ]);
    if (!realTarget) throw new Error("目标路径不存在或不是可读文件。");
    const realRel = relative(realRoot, realTarget);
    if (realRel.startsWith("..") || isAbsolute(realRel)) {
      throw new Error("文件路径经符号链接超出当前工作树目录边界。");
    }
    const readBytes = Math.min(info.size, MAX_PREVIEW_FILE_BYTES);
    const truncated = info.size > MAX_PREVIEW_FILE_BYTES;
    const handle = await open(target, "r");
    try {
      const buffer = Buffer.alloc(readBytes);
      let offset = 0;
      while (offset < readBytes) {
        const { bytesRead } = await handle.read(buffer, offset, readBytes - offset, offset);
        if (bytesRead <= 0) break;
        offset += bytesRead;
      }
      const slice = buffer.subarray(0, offset);
      for (let i = 0; i < Math.min(slice.length, 4096); i += 1) {
        if (slice[i] === 0) throw new Error("二进制文件暂不支持在代码查看器中直接预览。");
      }
      return {
        path: target.replace(/\\/gu, "/"),
        relativePath: rel.replace(/\\/gu, "/") || basename(target),
        content: slice.toString("utf8"),
        truncated,
        size: info.size,
      };
    } finally {
      await handle.close();
    }
  }

  /** 清理目录已不存在的索引记录，并让 Git 丢弃失效登记；返回清理数量。 */
  async prune(): Promise<number> {
    const records = await this.store.read();
    const keep: WorktreeRecord[] = [];
    const repositories = new Set<string>();
    let removed = 0;
    for (const record of records) {
      if (await isDirectory(record.path)) {
        keep.push(record);
        continue;
      }
      // 仍有会话引用时保留记录，让用户在界面上看到失效警告并主动解绑，不静默消失。
      const bound = await this.sessionCounter(record.id).catch(() => 0);
      if (bound > 0) {
        keep.push(record);
        continue;
      }
      removed += 1;
      repositories.add(record.repositoryRoot);
    }
    for (const repositoryRoot of repositories) {
      await runGit(repositoryRoot, ["worktree", "prune"]).catch(() => undefined);
    }
    if (removed > 0) await this.store.write(keep);
    return removed;
  }

  async remove(worktreeId: string, options: RemoveWorktreeOptions = {}): Promise<boolean> {
    const records = await this.store.read();
    const index = records.findIndex((item) => item.id === worktreeId);
    if (index < 0) return false;
    const record = records[index]!;

    const bound = await this.sessionCounter(record.id).catch(() => 0);
    if (bound > 0 && options.force !== true) {
      throw new Error(`仍有 ${bound} 个会话绑定该工作树，请先解绑再删除。`);
    }

    if (await isDirectory(record.path)) {
      const dirty = await countDirtyEntries(record.path);
      if (dirty > 0 && options.force !== true) {
        throw new Error(`工作树有 ${dirty} 个未提交改动，确认丢弃后再强制删除。`);
      }
      try {
        await runGit(record.repositoryRoot, ["worktree", "remove", ...(options.force === true ? ["--force"] : []), record.path], {
          timeoutMs: 60_000,
        });
      } catch (error) {
        if (options.force !== true) throw new Error(`删除工作树失败：${firstLine(error)}`);
      }
      if (await isDirectory(record.path)) {
        if (options.force !== true) throw new Error("工作树目录仍存在，未强制删除。");
        await rm(record.path, { recursive: true, force: true });
        await runGit(record.repositoryRoot, ["worktree", "prune"]).catch(() => undefined);
      }
    } else {
      await runGit(record.repositoryRoot, ["worktree", "prune"]).catch(() => undefined);
    }

    const next = [...records];
    next.splice(index, 1);
    await this.store.write(next);
    return true;
  }

  /** 删除工作树后再安全删除已合并的分支；未合并分支由 git branch -d 拒绝。 */
  async removeAndDeleteBranch(worktreeId: string): Promise<{ removed: boolean; branchDeleted: boolean; error?: string }> {
    const record = (await this.store.read()).find((item) => item.id === worktreeId);
    if (!record) return { removed: false, branchDeleted: false };
    const removed = await this.remove(worktreeId);
    if (!removed) return { removed: false, branchDeleted: false };
    try {
      await runGit(record.repositoryRoot, ["branch", "-d", record.branch]);
      return { removed: true, branchDeleted: true };
    } catch (error) {
      return {
        removed: true,
        branchDeleted: false,
        error: `分支未合并，已保留：${firstLine(error)}`,
      };
    }
  }

  private async toStatus(record: WorktreeRecord): Promise<WorktreeStatus> {
    const exists = await isDirectory(record.path);
    const aheadBehind = exists ? await countAheadBehind(record) : { ahead: 0, behind: 0 };
    return {
      ...record,
      exists,
      dirtyCount: exists ? await countDirtyEntries(record.path) : 0,
      ...aheadBehind,
      sessionCount: await this.sessionCounter(record.id).catch(() => 0),
    };
  }

  private async resolveRepositoryRoot(directory: string): Promise<string> {
    if (!await isDirectory(directory)) throw new Error(`项目目录不存在：${directory}`);
    try {
      const { stdout } = await runGit(directory, ["rev-parse", "--show-toplevel"]);
      const root = stdout.trim();
      if (!root) throw new Error("empty");
      return resolve(root);
    } catch {
      throw new Error("该项目不是 Git 仓库，无法创建工作树。");
    }
  }

  private async assertBranchName(repositoryRoot: string, rawBranch: string): Promise<string> {
    const branch = (rawBranch ?? "").trim();
    if (!branch) throw new Error("请输入分支名称。");
    if (branch.startsWith("-") || branch.length > MAX_BRANCH_LENGTH) {
      throw new Error(`分支名称不合法：${branch}`);
    }
    try {
      await runGit(repositoryRoot, ["check-ref-format", "--branch", branch]);
    } catch {
      throw new Error(`分支名称不合法：${branch}`);
    }
    return branch;
  }

  private async branchExists(repositoryRoot: string, branch: string): Promise<boolean> {
    try {
      await runGit(repositoryRoot, ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]);
      return true;
    } catch {
      return false;
    }
  }

  private async resolveCommit(repositoryRoot: string, ref: string): Promise<string> {
    try {
      const { stdout } = await runGit(repositoryRoot, ["rev-parse", "--verify", `${ref}^{commit}`]);
      const commit = stdout.trim();
      if (!commit) throw new Error("empty");
      return commit;
    } catch {
      throw new Error(`起点“${ref}”不存在，请填写本地分支或提交哈希。`);
    }
  }

  /** 把 HEAD 解析成当前分支名，供界面显示“基于 main”而不是只看到新分支。 */
  private async resolveBaseLabel(repositoryRoot: string, ref: string, commit: string): Promise<string> {
    try {
      const { stdout } = await runGit(repositoryRoot, ["rev-parse", "--abbrev-ref", ref]);
      const name = stdout.trim();
      return name && name !== "HEAD" ? name : commit.slice(0, 8);
    } catch {
      return commit.slice(0, 8);
    }
  }

  // 失败时只回收本次创建的内容：先移除工作树登记，再删目录与刚建的分支。
  private async cleanupFailedCreate(repositoryRoot: string, targetPath: string, branch: string): Promise<void> {
    await runGit(repositoryRoot, ["worktree", "remove", "--force", targetPath]).catch(() => undefined);
    await rm(targetPath, { recursive: true, force: true }).catch(() => undefined);
    await runGit(repositoryRoot, ["worktree", "prune"]).catch(() => undefined);
    if (await this.branchExists(repositoryRoot, branch)) {
      await runGit(repositoryRoot, ["branch", "-D", branch]).catch(() => undefined);
    }
  }
}