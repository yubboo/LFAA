/**
 * 功能：维护账户及 App 级项目登记。
 * 作用：AI Work 使用本机逻辑项目和零到多个源目录；Minecraft 保留节点目录登记。此 Owner 只保存注册信息，不创建或删除项目文件。
 * 不负责：目录浏览、Daemon 调度、会话运行、权限审批或 Minecraft 实例管理。
 * 关联文件：packages/bundle/base/cordis.patch.yml、packages/api/workspace-controller/src/index.ts、packages/core/session/src/sessions.ts。
 */
import type { Context } from "@deepseek-ai/cordis";
import { randomUUID } from "node:crypto";
import { basename, isAbsolute, resolve } from "node:path";
import { database } from "lfaa-storage-sqlite/src/database.js";

import { WORKSPACE_PROJECT_CONTEXT_APPLICATION_IDS, type WorkspaceProjectApplicationId, type WorkspaceProjectContextApplicationId } from "lfaa-util-values/src/application-id.js";
export type { WorkspaceProjectApplicationId, WorkspaceProjectContextApplicationId } from "lfaa-util-values/src/application-id.js";

export interface WorkspaceProject {
  id: string;
  userId: string;
  appId: WorkspaceProjectApplicationId | null;
  /** 用户选定的领域上下文；仅引用已登记 App，不改变工具授权或项目 Host。 */
  applicationIds: WorkspaceProjectContextApplicationId[];
  /** null 表示项目由 LFAA 本机 Host 管理；只有显式节点目录才保存 Daemon 身份。 */
  nodeId: string | null;
  path: string;
  title: string;
  instructions: string;
  memoryMode: WorkspaceProjectMemoryMode;
  sources: WorkspaceProjectSource[];
  createdAt: string;
  updatedAt: string;
  gitWorktree: WorkspaceGitWorktree | null;
}

export type WorkspaceProjectMemoryMode = "default" | "project_only";
export interface WorkspaceProjectSource { id: string; path: string; position: number }

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
  node_id: string | null;
  path: string;
  path_key: string;
  title: string;
  instructions?: string | null;
  memory_mode?: WorkspaceProjectMemoryMode | null;
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
  SELECT p.id, p.user_id, p.app_id, p.node_id, p.path, p.path_key, p.title, p.instructions, p.memory_mode, p.created_at, p.updated_at,
    w.project_id AS git_project_id, w.source_project_id AS git_source_project_id, w.node_id AS git_node_id,
    w.worktree_id AS git_worktree_id, w.worktree_root AS git_worktree_root,
    w.project_relative_path AS git_project_relative_path, w.branch AS git_branch,
    w.base_commit AS git_base_commit, w.source_head AS git_source_head, w.created_at AS git_created_at
  FROM workspace_projects p LEFT JOIN workspace_git_worktrees w ON w.project_id = p.id`;
const workspaceProjectResultLimit = 200;

function mapProject(row: WorkspaceProjectRow, sources: WorkspaceProjectSource[] = [], applicationIds: WorkspaceProjectContextApplicationId[] = []): WorkspaceProject {
  const gitWorktree = row.git_project_id && row.git_source_project_id && row.git_node_id && row.git_worktree_id && row.git_worktree_root
    && row.git_branch && row.git_base_commit && row.git_source_head && row.git_created_at
    ? { projectId: row.git_project_id, sourceProjectId: row.git_source_project_id, nodeId: row.git_node_id, worktreeId: row.git_worktree_id,
      worktreeRoot: row.git_worktree_root, projectRelativePath: row.git_project_relative_path ?? "", branch: row.git_branch,
      baseCommit: row.git_base_commit, sourceHead: row.git_source_head, createdAt: row.git_created_at }
    : null;
  const effectiveSources = sources;
  return { id: row.id, userId: row.user_id, appId: row.app_id ?? null, applicationIds, nodeId: row.node_id, path: row.path, title: row.title,
    instructions: typeof row.instructions === "string" ? row.instructions : "",
    memoryMode: row.memory_mode === "project_only" ? "project_only" : "default", sources: effectiveSources,
    createdAt: row.created_at, updatedAt: row.updated_at, gitWorktree };
}

function mapProjects(rows: WorkspaceProjectRow[]): WorkspaceProject[] {
  if (!rows.length) return [];
  const ids = rows.map(row => row.id);
  const placeholders = ids.map(() => "?").join(",");
  const sourceRows = database.prepare(`
    SELECT id, project_id, path, position FROM workspace_project_sources
    WHERE user_id = ? AND project_id IN (${placeholders}) ORDER BY project_id, position, path_key
  `).all(rows[0]!.user_id, ...ids) as Array<{ id: string; project_id: string; path: string; position: number }>;
  const sourcesByProject = new Map<string, WorkspaceProjectSource[]>();
  for (const source of sourceRows) {
    const sources = sourcesByProject.get(source.project_id) ?? [];
    sources.push({ id: source.id, path: source.path, position: source.position });
    sourcesByProject.set(source.project_id, sources);
  }
  const applicationRows = database.prepare(`
    SELECT project_id, application_id FROM workspace_project_applications
    WHERE user_id = ? AND project_id IN (${placeholders}) ORDER BY project_id, position
  `).all(rows[0]!.user_id, ...ids) as Array<{ project_id: string; application_id: WorkspaceProjectContextApplicationId }>;
  const applicationsByProject = new Map<string, WorkspaceProjectContextApplicationId[]>();
  for (const application of applicationRows) {
    if (!WORKSPACE_PROJECT_CONTEXT_APPLICATION_IDS.includes(application.application_id)) continue;
    const applications = applicationsByProject.get(application.project_id) ?? [];
    applications.push(application.application_id);
    applicationsByProject.set(application.project_id, applications);
  }
  return rows.map(row => mapProject(row, sourcesByProject.get(row.id) ?? [], applicationsByProject.get(row.id) ?? []));
}

function normalizeProjectApplicationIds(values: readonly string[] = []): WorkspaceProjectContextApplicationId[] {
  if (values.length > WORKSPACE_PROJECT_CONTEXT_APPLICATION_IDS.length) throw new Error("项目关联的应用数量超过当前已登记应用数量。");
  const result: WorkspaceProjectContextApplicationId[] = [];
  for (const value of values) {
    if (!WORKSPACE_PROJECT_CONTEXT_APPLICATION_IDS.some(applicationId => applicationId === value)) throw new Error("项目只能关联 LFAA 当前已登记的业务 App。");
    const applicationId = value as WorkspaceProjectContextApplicationId;
    if (!result.includes(applicationId)) result.push(applicationId);
  }
  return result;
}

function replaceProjectApplicationIds(userId: string, projectId: string, applicationIds: readonly WorkspaceProjectContextApplicationId[]): void {
  database.prepare("DELETE FROM workspace_project_applications WHERE user_id = ? AND project_id = ?").run(userId, projectId);
  applicationIds.forEach((applicationId, position) => database.prepare(`
    INSERT INTO workspace_project_applications (user_id, project_id, application_id, position) VALUES (?, ?, ?, ?)
  `).run(userId, projectId, applicationId, position));
}

function pathKey(path: string, platform: string): string {
  return platform === "win32" ? path.toLocaleLowerCase("en-US") : path;
}

export function listWorkspaceProjects(userId: string, appId?: WorkspaceProjectApplicationId): WorkspaceProject[] {
  const rows = database.prepare(`
    ${selectProject} WHERE p.user_id = ? AND (? IS NULL OR p.app_id = ? OR p.app_id IS NULL)
    ORDER BY p.updated_at DESC, p.title COLLATE NOCASE, p.id
  `).all(userId, appId ?? null, appId ?? null) as unknown as WorkspaceProjectRow[];
  return mapProjects(rows);
}

/** 项目浏览只返回有界结果；搜索从账户全部登记项中筛选，避免把长列表完整送到界面。 */
export function searchWorkspaceProjects(userId: string, appId?: WorkspaceProjectApplicationId, search = ""): { projects: WorkspaceProject[]; truncated: boolean } {
  const normalizedSearch = search.trim();
  const localWorkspaceOnly = appId === "workspace" ? "AND p.node_id IS NULL" : "";
  const daemonProjectJoin = appId === "workspace" ? "" : "LEFT JOIN daemon_nodes dn ON dn.id = p.node_id";
  const nodeDisplaySearch = appId === "workspace" ? "''" : "coalesce(dn.display_name, '')";
  const rows = database.prepare(`
    ${selectProject}
    ${daemonProjectJoin}
    WHERE p.user_id = ? AND (? IS NULL OR p.app_id = ? OR p.app_id IS NULL) ${localWorkspaceOnly}
      AND (? = '' OR instr(lower(p.title || ' ' || p.path || ' ' || ${nodeDisplaySearch}), lower(?)) > 0)
    ORDER BY p.updated_at DESC, p.title COLLATE NOCASE, p.id
    LIMIT ?
  `).all(userId, appId ?? null, appId ?? null, normalizedSearch, normalizedSearch, workspaceProjectResultLimit + 1) as unknown as WorkspaceProjectRow[];
  return { projects: mapProjects(rows.slice(0, workspaceProjectResultLimit)), truncated: rows.length > workspaceProjectResultLimit };
}

export function getWorkspaceProject(userId: string, projectId: string, appId?: WorkspaceProjectApplicationId): WorkspaceProject | null {
  const row = database.prepare(`
    ${selectProject} WHERE p.user_id = ? AND p.id = ? AND (? IS NULL OR p.app_id = ? OR p.app_id IS NULL)
  `).get(userId, projectId, appId ?? null, appId ?? null) as WorkspaceProjectRow | undefined;
  return row ? mapProjects([row])[0] ?? null : null;
}

/** 默认项目身份用于在本机 Host 接管后识别并规范化旧会话的历史 Daemon 快照。 */
export function isDefaultWorkspaceProject(userId: string, projectId: string): boolean {
  return getDefaultWorkspaceProjectId(userId) === projectId;
}

/** 默认项目标记不外键引用目录登记：移除登记后仍记住曾初始化，避免下次访问自动重建。 */
export function getDefaultWorkspaceProjectId(userId: string): string | null {
  const row = database.prepare("SELECT project_id FROM workspace_default_projects WHERE user_id = ? AND app_id = 'workspace'").get(userId) as { project_id?: unknown } | undefined;
  return typeof row?.project_id === "string" ? row.project_id : null;
}

/** 只登记当前账户真实存在的 AI Work 项目；并发首次初始化只保留第一个持久身份。 */
export function setDefaultWorkspaceProject(userId: string, projectId: string): string {
  const project = getWorkspaceProject(userId, projectId, "workspace");
  if (!project || project.appId !== "workspace") throw new Error("默认工作区必须属于当前账户的小鱼智能体项目。 ");
  database.prepare(`
    INSERT INTO workspace_default_projects (user_id, app_id, project_id, created_at)
    VALUES (?, 'workspace', ?, ?)
    ON CONFLICT (user_id, app_id) DO NOTHING
  `).run(userId, project.id, new Date().toISOString());
  const registered = getDefaultWorkspaceProjectId(userId);
  if (!registered) throw new Error("默认工作区身份未能保存。 ");
  return registered;
}

/**
 * 仅恢复 v58 默认项目身份引入前遗留的本机默认目录。
 * 调用方必须先以受保护凭据确认 nodeId 是当前 LFAA 本机 Daemon；这里再限定唯一目录后缀，避免认领普通或远程项目。
 */
export function claimLegacyLocalDefaultWorkspace(userId: string, localNodeId: string): WorkspaceProject | null {
  const defaultProjectId = getDefaultWorkspaceProjectId(userId);
  if (defaultProjectId) return null;
  const candidates = database.prepare(`
    ${selectProject}
    WHERE p.user_id = ? AND p.app_id = 'workspace' AND p.node_id = ?
      AND lower(replace(p.path, char(92), '/')) LIKE '%/lfaa/default-workspace'
      AND NOT EXISTS (SELECT 1 FROM workspace_git_worktrees w WHERE w.project_id = p.id)
    ORDER BY p.id LIMIT 2
  `).all(userId, localNodeId) as unknown as WorkspaceProjectRow[];
  if (candidates.length !== 1) return null;
  const candidate = candidates[0];
  const normalizedPath = candidate.path.replace(/[\\/]+/gu, "/").toLocaleLowerCase("en-US").replace(/\/+$/u, "");
  if (!normalizedPath.endsWith("/lfaa/default-workspace")) return null;

  database.exec("BEGIN IMMEDIATE;");
  try {
    if (getDefaultWorkspaceProjectId(userId)) {
      database.exec("ROLLBACK;");
      return null;
    }
    const currentCandidates = database.prepare(`
      SELECT id, path, path_key FROM workspace_projects p
      WHERE p.user_id = ? AND p.app_id = 'workspace' AND p.node_id = ?
        AND lower(replace(p.path, char(92), '/')) LIKE '%/lfaa/default-workspace'
        AND NOT EXISTS (SELECT 1 FROM workspace_git_worktrees w WHERE w.project_id = p.id)
      ORDER BY p.id LIMIT 2
    `).all(userId, localNodeId) as Array<{ id: string; path: string; path_key: string }>;
    if (currentCandidates.length !== 1 || currentCandidates[0].id !== candidate.id) {
      database.exec("ROLLBACK;");
      return null;
    }
    const collision = database.prepare(`
      SELECT 1 FROM workspace_projects
      WHERE user_id = ? AND app_id = 'workspace' AND node_id IS NULL AND path_key = ? AND id <> ? LIMIT 1
    `).get(userId, candidate.path_key, candidate.id);
    if (collision) {
      database.exec("ROLLBACK;");
      return null;
    }
    const result = database.prepare(`
      UPDATE workspace_projects SET node_id = NULL
      WHERE user_id = ? AND id = ? AND app_id = 'workspace' AND node_id = ?
    `).run(userId, candidate.id, localNodeId);
    if (!Number(result.changes)) throw new Error("旧默认工作区登记在恢复期间发生变化。 ");
    database.prepare(`
      INSERT OR IGNORE INTO workspace_project_sources (id, user_id, project_id, path, path_key, position, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `).run(randomUUID(), userId, candidate.id, candidate.path, candidate.path_key, new Date().toISOString());
    database.prepare(`
      INSERT INTO workspace_default_projects (user_id, app_id, project_id, created_at)
      VALUES (?, 'workspace', ?, ?)
      ON CONFLICT (user_id, app_id) DO NOTHING
    `).run(userId, candidate.id, new Date().toISOString());
    if (getDefaultWorkspaceProjectId(userId) !== candidate.id) throw new Error("旧默认工作区身份无法安全恢复。 ");
    database.exec("COMMIT;");
    return getWorkspaceProject(userId, candidate.id, "workspace");
  } catch (error) {
    if (database.isTransaction) database.exec("ROLLBACK;");
    throw error;
  }
}

/** 原子更新既有默认项目路径；只接受默认项目 ID 和 Host 已校验的路径，并以旧路径做并发保护。 */
export function updateDefaultWorkspaceProjectPath(userId: string, projectId: string, expectedPath: string, nextPathInput: string, platform: string): WorkspaceProject | null {
  if (getDefaultWorkspaceProjectId(userId) !== projectId) return null;
  const current = getWorkspaceProject(userId, projectId, "workspace");
  if (!current || current.gitWorktree || !isAbsolute(expectedPath) || !isAbsolute(nextPathInput) || nextPathInput.length > 32760) return null;
  const nextPath = resolve(nextPathInput);
  if (current.path === nextPath) return current;
  const collision = current.nodeId === null
    ? database.prepare(`
      SELECT 1 FROM workspace_projects
      WHERE user_id = ? AND app_id = 'workspace' AND node_id IS NULL AND path_key = ? AND id <> ? LIMIT 1
    `).get(userId, pathKey(nextPath, platform), projectId)
    : database.prepare(`
      SELECT 1 FROM workspace_projects
      WHERE user_id = ? AND app_id = 'workspace' AND node_id = ? AND path_key = ? AND id <> ? LIMIT 1
    `).get(userId, current.nodeId, pathKey(nextPath, platform), projectId);
  if (collision) throw new Error("规范默认工作区路径已登记为另一个项目；未改动原登记。 ");
  const result = current.nodeId === null
    ? database.prepare(`
      UPDATE workspace_projects SET path = ?, path_key = ?, updated_at = ?
      WHERE user_id = ? AND id = ? AND app_id = 'workspace' AND node_id IS NULL AND path = ?
    `).run(nextPath, pathKey(nextPath, platform), new Date().toISOString(), userId, projectId, expectedPath)
    : database.prepare(`
      UPDATE workspace_projects SET path = ?, path_key = ?, updated_at = ?
      WHERE user_id = ? AND id = ? AND app_id = 'workspace' AND node_id = ? AND path = ?
    `).run(nextPath, pathKey(nextPath, platform), new Date().toISOString(), userId, projectId, current.nodeId, expectedPath);
  if (!Number(result.changes)) return null;
  if (current.nodeId === null) {
    const source = database.prepare("SELECT path_key FROM workspace_project_sources WHERE user_id = ? AND project_id = ? AND path = ? LIMIT 1").get(userId, projectId, expectedPath) as { path_key?: string } | undefined;
    if (source?.path_key) database.prepare("UPDATE workspace_project_sources SET path = ?, path_key = ? WHERE user_id = ? AND project_id = ? AND path_key = ?")
      .run(nextPath, pathKey(nextPath, platform), userId, projectId, source.path_key);
    else database.prepare("INSERT OR IGNORE INTO workspace_project_sources (id, user_id, project_id, path, path_key, position, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)")
      .run(randomUUID(), userId, projectId, nextPath, pathKey(nextPath, platform), new Date().toISOString());
  }
  return getWorkspaceProject(userId, projectId, "workspace");
}

export function createWorkspaceProject(input: { userId: string; appId: WorkspaceProjectApplicationId; nodeId?: string | null; path: string; platform: string; title?: string }): WorkspaceProject {
  const path = input.path.trim();
  if (!isAbsolute(path) || path.length > 32760) throw new Error("项目目录必须是对应 Host 校验的绝对路径。 ");
  const nodeId = input.nodeId ?? null;
  if (input.appId === "workspace" && nodeId !== null) throw new Error("AI Work 项目使用 LFAA 本机 Host，不得绑定 Daemon 节点。 ");
  if (nodeId === null && input.appId !== "workspace") throw new Error("只有本机工作区项目可以不绑定 Daemon 节点。 ");
  const title = (input.title?.trim() || basename(path) || path).replace(/\s+/gu, " ");
  if (!title || title.length > 120) throw new Error("项目名称必须为 1 至 120 个字符。");
  const now = new Date().toISOString();
  const project: WorkspaceProject = { id: randomUUID(), userId: input.userId, appId: input.appId, applicationIds: [], nodeId, path, title, instructions: "", memoryMode: "default", sources: [], createdAt: now, updatedAt: now, gitWorktree: null };
  const result = database.prepare(`
      INSERT INTO workspace_projects (id, user_id, app_id, node_id, path, path_key, title, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT DO NOTHING
    `).run(project.id, input.userId, input.appId, nodeId, path, pathKey(path, input.platform), title, now, now);
  if (Number(result.changes) === 0) {
    const existing = nodeId === null
      ? database.prepare("SELECT id, user_id, app_id, node_id, path, path_key, title, created_at, updated_at FROM workspace_projects WHERE user_id = ? AND app_id = ? AND node_id IS NULL AND path_key = ?")
        .get(input.userId, input.appId, pathKey(path, input.platform)) as WorkspaceProjectRow | undefined
      : database.prepare("SELECT id, user_id, app_id, node_id, path, path_key, title, created_at, updated_at FROM workspace_projects WHERE user_id = ? AND app_id = ? AND node_id = ? AND path_key = ?")
        .get(input.userId, input.appId, nodeId, pathKey(path, input.platform)) as WorkspaceProjectRow | undefined;
    if (existing) return getWorkspaceProject(input.userId, existing.id, input.appId) ?? mapProject(existing);
    throw new Error("项目目录登记未能完成。");
  }
  if (nodeId === null) database.prepare(`
    INSERT OR IGNORE INTO workspace_project_sources (id, user_id, project_id, path, path_key, position, created_at)
    VALUES (?, ?, ?, ?, ?, 0, ?)
  `).run(randomUUID(), input.userId, project.id, path, pathKey(path, input.platform), now);
  return getWorkspaceProject(input.userId, project.id, input.appId) ?? project;
}

const workspaceProjectMaximumSources = 20;
const workspaceProjectMaximumSourcePathCharacters = 16384;

function normalizeProjectSources(paths: readonly string[], platform: string): string[] {
  if (paths.length > workspaceProjectMaximumSources) throw new Error(`每个项目最多关联 ${workspaceProjectMaximumSources} 个本机文件夹。`);
  const normalized: string[] = [];
  const seen = new Set<string>();
  let totalCharacters = 0;
  for (const value of paths) {
    const path = value.trim();
    if (!isAbsolute(path) || path.length > 32760) throw new Error("项目源文件夹必须是经 LFAA 本机 Host 核验的绝对路径。");
    const canonical = resolve(path);
    const key = pathKey(canonical, platform);
    if (seen.has(key)) continue;
    seen.add(key);
    totalCharacters += canonical.length;
    if (totalCharacters > workspaceProjectMaximumSourcePathCharacters) throw new Error("项目源文件夹路径总长度超过允许范围。");
    normalized.push(canonical);
  }
  return normalized;
}

/** 创建 AI Work 项目；项目目录由本机 Host 在选定父目录下创建，其他来源目录单独关联。 */
export function createLocalWorkspaceProject(input: { userId: string; title: string; projectDirectoryPath: string; instructions?: string; memoryMode?: WorkspaceProjectMemoryMode; applicationIds?: readonly string[]; sources?: string[]; platform: string }): WorkspaceProject {
  const title = input.title.trim().replace(/\s+/gu, " ");
  const instructions = (input.instructions ?? "").replace(/\u0000/gu, "").trim();
  const memoryMode = input.memoryMode ?? "default";
  if (!title || title.length > 120) throw new Error("项目名称必须为 1 至 120 个字符。");
  if (instructions.length > 4000) throw new Error("项目指令不能超过 4000 个字符。");
  if (memoryMode !== "default" && memoryMode !== "project_only") throw new Error("项目记忆范围无效。");
  const applicationIds = normalizeProjectApplicationIds(input.applicationIds);
  const projectDirectoryPath = normalizeProjectSources([input.projectDirectoryPath], input.platform)[0];
  const sources = normalizeProjectSources([projectDirectoryPath, ...(input.sources ?? [])], input.platform);
  const now = new Date().toISOString();
  const id = randomUUID();
  const primaryPath = projectDirectoryPath;
  database.exec("BEGIN IMMEDIATE;");
  try {
    database.prepare(`
      INSERT INTO workspace_projects (id, user_id, app_id, node_id, path, path_key, title, instructions, memory_mode, created_at, updated_at)
      VALUES (?, ?, 'workspace', NULL, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, input.userId, primaryPath, primaryPath ? pathKey(primaryPath, input.platform) : "", title, instructions, memoryMode, now, now);
    sources.forEach((path, position) => database.prepare(`
      INSERT INTO workspace_project_sources (id, user_id, project_id, path, path_key, position, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), input.userId, id, path, pathKey(path, input.platform), position, now));
    replaceProjectApplicationIds(input.userId, id, applicationIds);
    database.exec("COMMIT;");
  } catch (error) {
    if (database.isTransaction) database.exec("ROLLBACK;");
    throw error;
  }
  const project = getWorkspaceProject(input.userId, id, "workspace");
  if (!project) throw new Error("本机项目创建后无法读取。");
  return project;
}

/** 原子更新本机项目元数据。 */
export function updateLocalWorkspaceProject(userId: string, projectId: string, input: { title: string; instructions: string; memoryMode: WorkspaceProjectMemoryMode; applicationIds?: readonly string[]; sources?: string[]; platform?: string }): WorkspaceProject | null {
  const title = input.title.trim().replace(/\s+/gu, " ");
  const instructions = input.instructions.replace(/\u0000/gu, "").trim();
  if (!title || title.length > 120) throw new Error("项目名称必须为 1 至 120 个字符。");
  if (instructions.length > 4000) throw new Error("项目指令不能超过 4000 个字符。");
  if (input.memoryMode !== "default" && input.memoryMode !== "project_only") throw new Error("项目记忆范围无效。");
  const applicationIds = input.applicationIds === undefined ? undefined : normalizeProjectApplicationIds(input.applicationIds);
  const now = new Date().toISOString();
  const platform = input.platform ?? process.platform;
  database.exec("BEGIN IMMEDIATE;");
  try {
    const current = database.prepare("SELECT id, path FROM workspace_projects WHERE user_id = ? AND id = ? AND app_id = 'workspace' AND node_id IS NULL")
      .get(userId, projectId) as { id: string; path: string } | undefined;
    if (!current) { database.exec("ROLLBACK;"); return null; }
    let primaryPath = current.path;
    if (input.sources !== undefined) {
      const existingSources = database.prepare("SELECT id, path_key, created_at FROM workspace_project_sources WHERE user_id = ? AND project_id = ?")
        .all(userId, projectId) as Array<{ id: string; path_key: string; created_at: string }>;
      const sourceIds = new Map(existingSources.map(source => [source.path_key, source]));
      database.prepare("DELETE FROM workspace_project_sources WHERE user_id = ? AND project_id = ?").run(userId, projectId);
      const sources = normalizeProjectSources([...(current.path ? [current.path] : []), ...input.sources], platform);
      primaryPath = current.path || sources[0] || "";
      sources.forEach((path, position) => database.prepare(`
        INSERT INTO workspace_project_sources (id, user_id, project_id, path, path_key, position, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(sourceIds.get(pathKey(path, platform))?.id ?? randomUUID(), userId, projectId, path, pathKey(path, platform), position,
        sourceIds.get(pathKey(path, platform))?.created_at ?? now));
    }
    database.prepare(`
      UPDATE workspace_projects SET path = ?, path_key = ?, title = ?, instructions = ?, memory_mode = ?, updated_at = ?
      WHERE user_id = ? AND id = ? AND app_id = 'workspace' AND node_id IS NULL
    `).run(primaryPath, primaryPath ? pathKey(primaryPath, platform) : "", title, instructions, input.memoryMode, now, userId, projectId);
    if (applicationIds !== undefined) replaceProjectApplicationIds(userId, projectId, applicationIds);
    database.exec("COMMIT;");
  } catch (error) {
    if (database.isTransaction) database.exec("ROLLBACK;");
    throw error;
  }
  return getWorkspaceProject(userId, projectId, "workspace");
}

/** 替换本机项目关联的目录集合；路径必须已由调用方通过同一 LFAA Host 核验。 */
export function replaceLocalWorkspaceProjectSources(userId: string, projectId: string, pathsInput: string[], platform: string): WorkspaceProject | null {
  const project = getWorkspaceProject(userId, projectId, "workspace");
  if (!project || project.nodeId !== null) return null;
  const now = new Date().toISOString();
  database.exec("BEGIN IMMEDIATE;");
  try {
    const current = database.prepare("SELECT id, path FROM workspace_projects WHERE user_id = ? AND id = ? AND app_id = 'workspace' AND node_id IS NULL")
      .get(userId, projectId) as { id: string; path: string } | undefined;
    if (!current) { database.exec("ROLLBACK;"); return null; }
    const sources = normalizeProjectSources([...(current.path ? [current.path] : []), ...pathsInput], platform);
    const primaryPath = current.path || sources[0] || "";
    const existingSources = database.prepare("SELECT id, path_key, created_at FROM workspace_project_sources WHERE user_id = ? AND project_id = ?")
      .all(userId, projectId) as Array<{ id: string; path_key: string; created_at: string }>;
    const sourceIds = new Map(existingSources.map(source => [source.path_key, source]));
    database.prepare("DELETE FROM workspace_project_sources WHERE user_id = ? AND project_id = ?").run(userId, projectId);
    sources.forEach((path, position) => database.prepare(`
      INSERT INTO workspace_project_sources (id, user_id, project_id, path, path_key, position, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(sourceIds.get(pathKey(path, platform))?.id ?? randomUUID(), userId, projectId, path, pathKey(path, platform), position,
      sourceIds.get(pathKey(path, platform))?.created_at ?? now));
    database.prepare("UPDATE workspace_projects SET path = ?, path_key = ?, updated_at = ? WHERE user_id = ? AND id = ? AND app_id = 'workspace' AND node_id IS NULL")
      .run(primaryPath, primaryPath ? pathKey(primaryPath, platform) : "", now, userId, projectId);
    database.exec("COMMIT;");
  } catch (error) {
    if (database.isTransaction) database.exec("ROLLBACK;");
    throw error;
  }
  return getWorkspaceProject(userId, projectId, "workspace");
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
    id: randomUUID(), userId: input.userId, appId: input.appId, applicationIds: [], nodeId: input.nodeId, path,
    title: `${source.title} · AI Worktree`.slice(0, 120), instructions: "", memoryMode: "default", sources: [], createdAt: now, updatedAt: now,
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

/** 带账户归属检查读取一个项目记忆容器所需的当前记忆范围。 */
export function getWorkspaceProjectMemoryScope(userId: string, projectId: string): WorkspaceProjectMemoryMode | null {
  const row = database.prepare("SELECT memory_mode FROM workspace_projects WHERE user_id = ? AND id = ? AND app_id = 'workspace'")
    .get(userId, projectId) as { memory_mode?: unknown } | undefined;
  return row?.memory_mode === "project_only" ? "project_only" : row ? "default" : null;
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
  createLocal: createLocalWorkspaceProject,
  createGitWorktree: createWorkspaceGitWorktree,
  updateDefaultPath: updateDefaultWorkspaceProjectPath,
  rename: renameWorkspaceProject,
  updateLocal: updateLocalWorkspaceProject,
  replaceLocalSources: replaceLocalWorkspaceProjectSources,
  claimApplication: claimWorkspaceProjectApplication,
  remove: removeWorkspaceProject
};

declare module "@deepseek-ai/cordis" {
  interface Context { lfaaWorkspaceWorkspace: typeof workspaceProjectService }
}

export const name = "lfaaWorkspaceWorkspace";
export const inject = ["lfaaStorage"];
export function apply(ctx: Context): void { ctx.provide(name, workspaceProjectService); }
