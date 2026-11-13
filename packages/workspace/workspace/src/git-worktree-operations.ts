/**
 * 功能：创建并登记当前账户项目的 LFAA 管理型 Git Worktree。
 * 作用：由 API 与 Agent 工具共用，维持唯一的本机 Host/Daemon 校验、Git 创建和登记回滚流程。
 * 关联文件：index.ts、packages/api/workspace-controller、packages/core/tools/project-tools.ts。
 */
import { randomUUID } from "node:crypto";
import { executeGitWorkspace } from "lfaa-host-git";
import { listDaemonNodes } from "lfaa-host-daemon/src/local-daemon.js";
import { isLocalDaemonIdentity } from "lfaa-host-daemon/src/node-credentials.js";
import { createWorkspaceGitWorktree, getWorkspaceProject, type WorkspaceProject, type WorkspaceProjectApplicationId } from "./index.js";

export class WorkspaceGitWorktreeError extends Error {
  constructor(readonly status: 404 | 409 | 502, readonly code: string, message: string) {
    super(message);
    this.name = "WorkspaceGitWorktreeError";
  }
}

function cleanupMessage(error: unknown): string {
  return error instanceof Error ? error.message : "未知清理错误";
}

async function removeUnregisteredWorktree(sourceDirectory: string, worktreeId: string, branch: unknown): Promise<void> {
  if (typeof branch !== "string" || !branch) throw new Error("Host 返回的分支名不可用，无法确认清理目标。");
  await executeGitWorkspace({ operation: "remove-worktree", worktreeId, sourceDirectory, branch });
}

/**
 * 从已登记的当前项目创建 Worktree，支持通用工作区的 LFAA 本机 Host 与 App 的本机 Daemon 项目；拒绝远程及嵌套 Worktree。
 * Git 操作使用 LFAA Host Git Owner；只有项目登记成功后才返回项目。
 */
export async function createWorkspaceGitWorktreeFromProject(input: {
  userId: string;
  appId: WorkspaceProjectApplicationId;
  sourceProjectId: string;
  branchPrefix: string;
  signal?: AbortSignal;
}): Promise<WorkspaceProject> {
  const source = getWorkspaceProject(input.userId, input.sourceProjectId, input.appId);
  if (!source) throw new WorkspaceGitWorktreeError(404, "workspace_project_not_found", "当前账户与应用下找不到此项目。 ");
  if (source.gitWorktree) throw new WorkspaceGitWorktreeError(409, "workspace_git_nested_worktree_unsupported", "请从原始项目创建 AI Worktree，不支持从已有 Worktree 再创建。 ");
  if (!source.path) throw new WorkspaceGitWorktreeError(409, "workspace_git_project_source_required", "当前项目没有可用的源文件夹，无法创建 Git Worktree。 ");

  const nodeId = source.nodeId;
  let platform = process.platform;
  if (input.appId === "workspace") {
    if (nodeId !== null) throw new WorkspaceGitWorktreeError(409, "workspace_git_host_required", "通用 AI Work Git Worktree 只能操作 LFAA 本机 Host 管理的项目。 ");
  } else {
    const node = nodeId ? listDaemonNodes().find(item => item.id === nodeId) : undefined;
    if (!nodeId || !isLocalDaemonIdentity(nodeId) || !node || node.platform !== process.platform) {
      throw new WorkspaceGitWorktreeError(409, "workspace_git_worktree_node_required", "App Git Worktree 需要绑定到当前 LFAA 本机 Daemon 项目；远程或未绑定的项目暂不可用。 ");
    }
    platform = node.platform;
  }

  input.signal?.throwIfAborted();
  const worktreeId = randomUUID();
  let result: Record<string, unknown>;
  try {
    const value: unknown = await executeGitWorkspace({ operation: "create-worktree", worktreeId,
      projectDirectory: source.path, projectTitle: source.title, branchPrefix: input.branchPrefix, signal: input.signal });
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Git Host 返回了无效结果。");
    result = value as Record<string, unknown>;
  } catch (error) {
    if (input.signal?.aborted) throw error;
    throw new WorkspaceGitWorktreeError(409, "workspace_git_operation_failed", cleanupMessage(error));
  }

  const validResult = typeof result.projectDirectory === "string" && typeof result.worktreeRoot === "string"
    && typeof result.projectRelativePath === "string" && typeof result.branch === "string"
    && typeof result.baseline === "string" && typeof result.sourceHead === "string";
  if (!validResult) {
    let cleanup = "";
    try { await removeUnregisteredWorktree(source.path, worktreeId, result.branch); }
    catch (error) { cleanup = ` 清理未确认成功；请检查 ${typeof result.worktreeRoot === "string" ? result.worktreeRoot : `<LFAA_DATA_DIR>/git-worktrees/${worktreeId}`}（工作树 ${worktreeId}）：${cleanupMessage(error)}`; }
    throw new WorkspaceGitWorktreeError(502, "workspace_git_worktree_result_invalid", `Git Host 返回的 Git 工作树身份信息无效。${cleanup}`);
  }

  if (input.signal?.aborted) {
    try { await removeUnregisteredWorktree(source.path, worktreeId, result.branch); }
    catch (error) {
      throw new WorkspaceGitWorktreeError(502, "workspace_git_worktree_cleanup_unconfirmed", `操作已取消，但 Git Host 未确认清理新建工作树 ${String(result.worktreeRoot)}：${cleanupMessage(error)}`);
    }
    input.signal.throwIfAborted();
  }

  try {
    return createWorkspaceGitWorktree({ userId: input.userId, appId: input.appId, sourceProjectId: source.id, nodeId,
      path: result.projectDirectory as string, worktreeRoot: result.worktreeRoot as string, worktreeId,
      projectRelativePath: result.projectRelativePath as string, branch: result.branch as string,
      baseCommit: result.baseline as string, sourceHead: result.sourceHead as string, platform });
  } catch (error) {
    try { await removeUnregisteredWorktree(source.path, worktreeId, result.branch); }
    catch (cleanupError) {
      throw new WorkspaceGitWorktreeError(502, "workspace_git_worktree_cleanup_unconfirmed", `项目登记失败，且 Git Host 未确认清理工作树：${cleanupMessage(error)}。请检查 ${String(result.worktreeRoot)}（工作树 ${worktreeId}）。`);
    }
    throw new WorkspaceGitWorktreeError(409, "workspace_git_worktree_registration_failed", cleanupMessage(error));
  }
}
