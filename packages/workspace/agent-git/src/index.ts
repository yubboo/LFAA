/**
 * 功能：持久化本机 Agent Git 仓库登记和 Agent Session 仓库绑定。
 * 作用：使 Git 仓库上下文独立于业务 App、WorkspaceProject 和 Daemon 节点。
 * 不负责：验证/执行 Git 命令、Session 账户鉴权或操作权限审批。
 */
import { randomUUID } from "node:crypto";
import { basename } from "node:path";
import { database } from "lfaa-storage-sqlite/src/database.js";

export interface AgentGitRepository {
  id: string;
  userId: string;
  path: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface AgentGitRepositoryRow {
  id: string;
  user_id: string;
  path: string;
  path_key: string;
  title: string;
  created_at: string;
  updated_at: string;
}

const repositoryColumns = "id, user_id, path, path_key, title, created_at, updated_at";

function mapRepository(row: AgentGitRepositoryRow): AgentGitRepository {
  return { id: row.id, userId: row.user_id, path: row.path, title: row.title, createdAt: row.created_at, updatedAt: row.updated_at };
}

function pathKey(path: string, platform: NodeJS.Platform): string {
  return platform === "win32" ? path.toLocaleLowerCase("en-US") : path;
}

/** 仅接受调用方已由本机 Host 校验、规范化的现存目录。 */
export function registerAgentGitRepository(input: { userId: string; path: string; title?: string; platform?: NodeJS.Platform }): AgentGitRepository {
  const canonicalPath = input.path.trim();
  if (!canonicalPath || canonicalPath.includes("\0")) throw new Error("Git 仓库目录无效。");
  const key = pathKey(canonicalPath, input.platform ?? process.platform);
  const existing = database.prepare(`SELECT ${repositoryColumns} FROM agent_git_repositories WHERE user_id = ? AND path_key = ?`).get(input.userId, key) as unknown as AgentGitRepositoryRow | undefined;
  if (existing) return mapRepository(existing);
  const now = new Date().toISOString();
  const title = input.title?.trim().slice(0, 120) || basename(canonicalPath.replace(/[\\/]+$/u, "")) || canonicalPath;
  const id = randomUUID();
  database.prepare("INSERT INTO agent_git_repositories(id,user_id,path,path_key,title,created_at,updated_at) VALUES(?,?,?,?,?,?,?)")
    .run(id, input.userId, canonicalPath, key, title, now, now);
  return mapRepository(database.prepare(`SELECT ${repositoryColumns} FROM agent_git_repositories WHERE id = ? AND user_id = ?`).get(id, input.userId) as unknown as AgentGitRepositoryRow);
}

export function listAgentGitRepositories(userId: string): AgentGitRepository[] {
  const rows = database.prepare(`SELECT ${repositoryColumns} FROM agent_git_repositories WHERE user_id = ? ORDER BY updated_at DESC, title COLLATE NOCASE, id`).all(userId) as unknown as AgentGitRepositoryRow[];
  return rows.map(mapRepository);
}

export function getAgentGitRepository(userId: string, repositoryId: string): AgentGitRepository | null {
  const row = database.prepare(`SELECT ${repositoryColumns} FROM agent_git_repositories WHERE user_id = ? AND id = ?`).get(userId, repositoryId) as unknown as AgentGitRepositoryRow | undefined;
  return row ? mapRepository(row) : null;
}

export interface AgentGitSessionContext extends AgentGitRepository { sessionId: string }

export function getAgentGitSessionRepository(userId: string, sessionId: string): AgentGitSessionContext | null {
  const row = database.prepare(`
    SELECT r.id, r.user_id, r.path, r.path_key, r.title, r.created_at, r.updated_at, b.session_id
    FROM agent_git_session_bindings b JOIN agent_git_repositories r ON r.id = b.repository_id AND r.user_id = b.user_id
    WHERE b.user_id = ? AND b.session_id = ?
  `).get(userId, sessionId) as unknown as (AgentGitRepositoryRow & { session_id: string }) | undefined;
  return row ? { ...mapRepository(row), sessionId: row.session_id } : null;
}

/** API/Run Owner 负责先验证 Session 属于当前账户；本函数再次核对仓库账户归属。 */
export function bindAgentGitSessionRepository(userId: string, sessionId: string, repositoryId: string | null): boolean {
  if (repositoryId === null) {
    database.prepare("DELETE FROM agent_git_session_bindings WHERE user_id = ? AND session_id = ?").run(userId, sessionId);
    return true;
  }
  const session = database.prepare("SELECT id FROM ai_sessions WHERE id = ? AND user_id = ?").get(sessionId, userId);
  if (!session) return false;
  if (!getAgentGitRepository(userId, repositoryId)) return false;
  const now = new Date().toISOString();
  database.prepare(`
    INSERT INTO agent_git_session_bindings(user_id,session_id,repository_id,updated_at) VALUES(?,?,?,?)
    ON CONFLICT(session_id) DO UPDATE SET user_id=excluded.user_id,repository_id=excluded.repository_id,updated_at=excluded.updated_at
  `).run(userId, sessionId, repositoryId, now);
  return true;
}

export function removeAgentGitRepository(userId: string, repositoryId: string): boolean {
  return database.prepare("DELETE FROM agent_git_repositories WHERE user_id = ? AND id = ?").run(userId, repositoryId).changes > 0;
}
