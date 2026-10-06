/**
 * 功能：维护账户及 App 级项目目录登记。
 * 作用：将真实 Daemon 目录登记为当前 App 可供会话选择的项目；只保存注册信息，不创建或删除项目文件。
 * 不负责：目录浏览、Daemon 调度、会话运行、权限审批或 Minecraft 实例管理。
 * 关联文件：packages/bundle/base/cordis.patch.yml、packages/api/workspace-controller/src/index.ts、packages/core/session/src/sessions.ts。
 */
import type { Context } from "@deepseek-ai/cordis";
import { randomUUID } from "node:crypto";
import { basename, isAbsolute } from "node:path";
import { database } from "lfaa-storage-sqlite/src/database.js";

export type WorkspaceProjectApplicationId = "workspace" | "minecraft";

export interface WorkspaceProject {
  id: string;
  userId: string;
  appId: WorkspaceProjectApplicationId | null;
  nodeId: string;
  path: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  gitWorktree: WorkspaceGitWorktree | null;
}

export interface WorkspaceGitWorktree {
  projectId: string;
  sourceProjectId: string;
  nodeId: string;
  worktreeId: string;
  worktreeRoot: string;
  projectRelativePath: string;
  branch: string;
  baseCommit: string;
  sourceHead: string;
  createdAt: string;
}

interface WorkspaceProjectRow {
  id: string;
  user_id: string;
  app_id: WorkspaceProjectApplicationId | null;
  node_id: string;
  path: string;
  path_key: string;
  title: string;
  created_at: string;
  updated_at: string;
  git_project_id?: string | null;
  git_source_project_id?: string | null;
  git_node_id?: string | null;
  git_worktree_id?: string | null;
  git_worktree_root?: string | null;
  git_project_relative_path?: string | null;
  git_branch?: string | null;
  git_base_commit?: string | null;
  git_source_head?: string | null;
  git_created_at?: string | null;
}

const selectProject = `
  SELECT p.id, p.user_id, p.app_id, p.node_id, p.path, p.path_key, p.title, p.created_at, p.updated_at,
    w.project_id AS git_project_id, w.source_project_id AS git_source_project_id, w.node_id AS git_node_id,
    w.worktree_id AS git_worktree_id, w.worktree_root AS git_worktree_root,
    w.project_relative_path AS git_project_relative_path, w.branch AS git_branch,
    w.base_commit AS git_base_commit, w.source_head AS git_source_head, w.created_at AS git_created_at
  FROM workspace_projects p LEFT JOIN workspace_git_worktrees w ON w.project_id = p.id`;
const workspaceProjectResultLimit = 200;

function mapProject(row: WorkspaceProjectRow): WorkspaceProject {
  const gitWorktree = row.git_project_id && row.git_source_project_id && row.git_node_id && row.git_worktree_id && row.git_worktree_root
    && row.git_branch && row.git_base_commit && row.git_source_head && row.git_created_at
    ? { projectId: row.git_project_id, sourceProjectId: row.git_source_project_id, nodeId: row.git_node_id, worktreeId: row.git_worktree_id,
      worktreeRoot: row.git_worktree_root, projectRelativePath: row.git_project_relative_path ?? "", branch: row.git_branch,
      baseCommit: row.git_base_commit, sourceHead: row.git_source_head, createdAt: row.git_created_at }
    : null;
  return { id: row.id, userId: row.user_id, appId: row.app_id ?? null, nodeId: row.node_id, path: row.path, title: row.title, createdAt: row.created_at, updatedAt: row.updated_at, gitWorktree };
}

function pathKey(path: string, platform: string): string {
  return platform === "win32" ? path.toLocaleLowerCase("en-US") : path;
}

export function listWorkspaceProjects(userId: string, appId?: WorkspaceProjectApplicationId): WorkspaceProject[] {
  const rows = database.prepare(`
    ${selectProject} WHERE p.user_id = ? AND (? IS NULL OR p.app_id = ? OR p.app_id IS NULL)
    ORDER BY p.updated_at DESC, p.title COLLATE NOCASE, p.id
  `).all(userId, appId ?? null, appId ?? null) as unknown as WorkspaceProjectRow[];
  return rows.map(mapProject);
}

/** 项目浏览只返回有界结果；搜索从账户全部登记项中筛选，避免把长列表完整送到界面。 */
export function searchWorkspaceProjects(userId: string, appId?: WorkspaceProjectApplicationId, search = ""): { projects: WorkspaceProject[]; truncated: boolean } {
  const normalizedSearch = search.trim();
  const rows = database.prepare(`
    ${selectProject}
    LEFT JOIN daemon_nodes dn ON dn.id = p.node_id
    WHERE p.user_id = ? AND (? IS NULL OR p.app_id = ? OR p.app_id IS NULL)
      AND (? = '' OR instr(lower(p.title || ' ' || p.path || ' ' || coalesce(dn.display_name, '')), lower(?)) > 0)
    ORDER BY p.updated_at DESC, p.title COLLATE NOCASE, p.id
    LIMIT ?
  `).all(userId, appId ?? null, appId ?? null, normalizedSearch, normalizedSearch, workspaceProjectResultLimit + 1) as unknown as WorkspaceProjectRow[];
  return { projects: rows.slice(0, workspaceProjectResultLimit).map(mapProject), truncated: rows.length > workspaceProjectResultLimit };
}

export function getWorkspaceProject(userId: string, projectId: string, appId?: WorkspaceProjectApplicationId): WorkspaceProject | null {
  const row = database.prepare(`
    ${selectProject} WHERE p.user_id = ? AND p.id = ? AND (? IS NULL OR p.app_id = ? OR p.app_id IS NULL)
  `).get(userId, projectId, appId ?? null, appId ?? null) as WorkspaceProjectRow | undefined;
  return row ? mapProject(row) : null;
}

export function createWorkspaceProject(input: { userId: string; appId: WorkspaceProjectApplicationId; nodeId: string; path: string; platform: string; title?: string }): WorkspaceProject {
  const path = input.path.trim();
  if (!isAbsolute(path) || path.length > 32760) throw new Error("项目目录必须是 Daemon 返回的绝对路径。");
  const title = (input.title?.trim() || basename(path) || path).replace(/\s+/gu, " ");
  if (!title || title.length > 120) throw new Error("项目名称必须为 1 至 120 个字符。");
  const now = new Date().toISOString();
  const project: WorkspaceProject = { id: randomUUID(), userId: input.userId, appId: input.appId, nodeId: input.nodeId, path, title, createdAt: now, updatedAt: now, gitWorktree: null };
  const result = database.prepare(`
      INSERT INTO workspace_projects (id, user_id, app_id, node_id, path, path_key, title, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT DO NOTHING
    `).run(project.id, input.userId, input.appId, input.nodeId, path, pathKey(path, input.platform), title, now, now);
  if (Number(result.changes) === 0) {
    const existing = database.prepare("SELECT id, user_id, app_id, node_id, path, path_key, title, created_at, updated_at FROM workspace_projects WHERE user_id = ? AND app_id = ? AND node_id = ? AND path_key = ?")
      .get(input.userId, input.appId, input.nodeId, pathKey(path, input.platform)) as WorkspaceProjectRow | undefined;
    if (existing) return mapProject(existing);
    throw new Error("项目目录登记未能完成。");
  }
  return project;
}

export function createWorkspaceGitWorktree(input: {
  userId: string; appId: WorkspaceProjectApplicationId; sourceProjectId: string; nodeId: string; path: string; worktreeRoot: string; worktreeId: string;
  projectRelativePath: string; branch: string; baseCommit: string; sourceHead: string; platform: string;
}): WorkspaceProject {
  const source = getWorkspaceProject(input.userId, input.sourceProjectId, input.appId);
  if (!source || source.appId !== input.appId || source.nodeId !== input.nodeId) throw new Error("Git 源项目不属于当前账户、应用或所选 Daemon。 ");
  if (source.gitWorktree) throw new Error("请从原始项目创建 AI Worktree，不支持从已有 Worktree 再创建。 ");
  const path = input.path.trim();
  const worktreeRoot = input.worktreeRoot.trim();
  if (!isAbsolute(path) || !isAbsolute(worktreeRoot) || path.length > 32760 || worktreeRoot.length > 32760) throw new Error("Daemon 返回的 Git 工作树路径无效。 ");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(input.worktreeId)
    || !/^[0-9a-f]{40,64}$/iu.test(input.baseCommit) || !/^[0-9a-f]{40,64}$/iu.test(input.sourceHead)) throw new Error("Daemon 返回的 Git 工作树身份或基线无效。 ");
  if (!input.branch.trim() || input.branch.length > 255 || input.projectRelativePath.length > 32760) throw new Error("Git 工作树分支或项目相对路径无效。 ");
  const now = new Date().toISOString();
  const project: WorkspaceProject = {
    id: randomUUID(), userId: input.userId, appId: input.appId, nodeId: input.nodeId, path,
    title: `${source.title} · AI Worktree`.slice(0, 120), createdAt: now, updatedAt: now,
    gitWorktree: { projectId: "", sourceProjectId: source.id, nodeId: input.nodeId, worktreeId: input.worktreeId,
      worktreeRoot, projectRelativePath: input.projectRelativePath, branch: input.branch, baseCommit: input.baseCommit, sourceHead: input.sourceHead, createdAt: now }
  };
  database.exec("BEGIN IMMEDIATE;");
  try {
    const result = database.prepare(`
      INSERT INTO workspace_projects (id, user_id, app_id, node_id, path, path_key, title, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT DO NOTHING
    `).run(project.id, input.userId, input.appId, input.nodeId, path, pathKey(path, input.platform), project.title, now, now);
    if (Number(result.changes) !== 1) throw new Error("此 Daemon 工作树路径已经登记为项目。 ");
    database.prepare(`
      INSERT INTO workspace_git_worktrees (project_id, user_id, source_project_id, node_id, worktree_id, worktree_root, project_relative_path, branch, base_commit, source_head, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(project.id, input.userId, source.id, input.nodeId, input.worktreeId, worktreeRoot, input.projectRelativePath, input.branch, input.baseCommit, input.sourceHead, now);
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
  if (project.gitWorktree) project.gitWorktree.projectId = project.id;
  return project;
}

export function listWorkspaceGitWorktrees(userId: string): WorkspaceProject[] {
  return listWorkspaceProjects(userId).filter(project => project.gitWorktree !== null);
}

export function hasWorkspaceGitWorktrees(userId: string, sourceProjectId: string): boolean {
  return Boolean(database.prepare("SELECT 1 FROM workspace_git_worktrees WHERE user_id = ? AND source_project_id = ? LIMIT 1").get(userId, sourceProjectId));
}

export function renameWorkspaceProject(userId: string, projectId: string, titleInput: string, appId?: WorkspaceProjectApplicationId): WorkspaceProject | null {
  const title = titleInput.trim().replace(/\s+/gu, " ");
  if (!title || title.length > 120) throw new Error("项目名称必须为 1 至 120 个字符。");
  const updatedAt = new Date().toISOString();
  const result = database.prepare("UPDATE workspace_projects SET title = ?, updated_at = ? WHERE user_id = ? AND id = ? AND (? IS NULL OR app_id = ? OR app_id IS NULL)").run(title, updatedAt, userId, projectId, appId ?? null, appId ?? null);
  return Number(result.changes) ? getWorkspaceProject(userId, projectId, appId) : null;
}

/** 未分配 App 的旧项目只能由一次明确的项目使用操作认领；不同 App 归属不能互相覆盖。 */
export function claimWorkspaceProjectApplication(userId: string, projectId: string, appId: WorkspaceProjectApplicationId): WorkspaceProject | null {
  const current = getWorkspaceProject(userId, projectId, appId);
  if (!current) return null;
  if (current.appId === appId) return current;
  const result = database.prepare("UPDATE workspace_projects SET app_id = ?, updated_at = ? WHERE user_id = ? AND id = ? AND app_id IS NULL")
    .run(appId, new Date().toISOString(), userId, projectId);
  return Number(result.changes) ? getWorkspaceProject(userId, projectId, appId) : null;
}

/** 仅移除账户的目录登记；节点目录、会话记录和历史消息保持原样。 */
export function removeWorkspaceProject(userId: string, projectId: string, appId: WorkspaceProjectApplicationId): boolean {
  return Number(database.prepare("DELETE FROM workspace_projects WHERE user_id = ? AND id = ? AND app_id = ?")
    .run(userId, projectId, appId).changes) === 1;
}

/** 将目录登记服务挂入当前 Profile，使基础装配合同与包入口保持一致。 */
export const workspaceProjectService = {
  list: listWorkspaceProjects,
  get: getWorkspaceProject,
  listGitWorktrees: listWorkspaceGitWorktrees,
  hasGitWorktrees: hasWorkspaceGitWorktrees,
  create: createWorkspaceProject,
  createGitWorktree: createWorkspaceGitWorktree,
  rename: renameWorkspaceProject,
  claimApplication: claimWorkspaceProjectApplication,
  remove: removeWorkspaceProject
};

declare module "@deepseek-ai/cordis" {
  interface Context { lfaaWorkspaceWorkspace: typeof workspaceProjectService }
}

export const name = "lfaaWorkspaceWorkspace";
export const inject = ["lfaaStorage"];
export function apply(ctx: Context): void { ctx.provide(name, workspaceProjectService); }
