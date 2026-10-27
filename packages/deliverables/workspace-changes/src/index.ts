/**
 * 功能：保存 Agent 明确发布的最终产物索引。
 * 作用：账户 + Agent Git 仓库 + 相对路径唯一；二进制仍留在项目目录。
 * 不负责：扫描输出、构建文件、下载授权或复制产物。
 */
import { randomUUID } from "node:crypto";
import { database } from "lfaa-storage-sqlite/src/database.js";

export interface AgentDeliverable {
  id: string;
  userId: string;
  repositoryId: string;
  sessionId: string;
  path: string;
  title: string;
  fileName: string;
  sha256: string;
  sizeBytes: number;
  modifiedAt: string;
  publishedAt: string;
}

interface AgentDeliverableRow {
  id: string;
  user_id: string;
  repository_id: string;
  session_id: string;
  path: string;
  title: string;
  file_name: string;
  sha256: string;
  size_bytes: number;
  modified_at: string;
  published_at: string;
}

const columns = "id, user_id, repository_id, session_id, path, title, file_name, sha256, size_bytes, modified_at, published_at";
const maxDeliverableBytes = 512 * 1024 * 1024;

function mapRow(row: AgentDeliverableRow): AgentDeliverable {
  return { id: row.id, userId: row.user_id, repositoryId: row.repository_id, sessionId: row.session_id, path: row.path,
    title: row.title, fileName: row.file_name, sha256: row.sha256, sizeBytes: row.size_bytes, modifiedAt: row.modified_at, publishedAt: row.published_at };
}

function normalizeRelativePath(path: string): string {
  if (typeof path !== "string" || !path || path.length > 32760 || path.includes("\\") || path.startsWith("/") || /[\u0000-\u001f\u007f]/u.test(path)) {
    throw new Error("产物必须使用有效的项目相对路径。 ");
  }
  const segments = path.split("/");
  if (segments.some(segment => !segment || segment === "." || segment === "..")) throw new Error("产物路径不能跳出项目目录。 ");
  return segments.join("/");
}

function pathKey(path: string, platform: NodeJS.Platform): string {
  const normalized = normalizeRelativePath(path);
  return platform === "win32" ? normalized.toLocaleLowerCase("en-US") : normalized;
}

/** 只写入 Host 已真实读取和摘要的文件记录；同一项目路径重新发布会更新原条目。 */
export function publishAgentDeliverable(input: {
  userId: string;
  repositoryId: string;
  sessionId: string;
  path: string;
  title: string;
  fileName: string;
  sha256: string;
  sizeBytes: number;
  modifiedAt: string;
  platform?: NodeJS.Platform;
}): AgentDeliverable {
  const path = normalizeRelativePath(input.path);
  const key = pathKey(path, input.platform ?? process.platform);
  const title = input.title.trim();
  if (!input.userId || !input.repositoryId || !/^[0-9a-f-]{36}$/iu.test(input.sessionId)
    || !title || title.length > 160 || !input.fileName || input.fileName.length > 255
    || !/^[a-f0-9]{64}$/u.test(input.sha256) || !Number.isSafeInteger(input.sizeBytes) || input.sizeBytes < 0 || input.sizeBytes > maxDeliverableBytes
    || !Number.isFinite(Date.parse(input.modifiedAt))) throw new Error("产物登记元数据无效。 ");

  const now = new Date().toISOString();
  const existing = database.prepare(`SELECT ${columns} FROM agent_deliverables WHERE user_id = ? AND repository_id = ? AND path_key = ?`)
    .get(input.userId, input.repositoryId, key) as unknown as AgentDeliverableRow | undefined;
  const id = existing?.id ?? randomUUID();
  database.prepare(`
    INSERT INTO agent_deliverables(id, user_id, repository_id, session_id, path, path_key, title, file_name, sha256, size_bytes, modified_at, published_at)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, repository_id, path_key) DO UPDATE SET
      session_id = excluded.session_id, path = excluded.path, title = excluded.title, file_name = excluded.file_name,
      sha256 = excluded.sha256, size_bytes = excluded.size_bytes, modified_at = excluded.modified_at, published_at = excluded.published_at
  `).run(id, input.userId, input.repositoryId, input.sessionId, path, key, title, input.fileName, input.sha256, input.sizeBytes, input.modifiedAt, now);
  const row = database.prepare(`SELECT ${columns} FROM agent_deliverables WHERE user_id = ? AND repository_id = ? AND path_key = ?`)
    .get(input.userId, input.repositoryId, key) as unknown as AgentDeliverableRow | undefined;
  if (!row) throw new Error("产物登记后未能回读。 ");
  return mapRow(row);
}

export function listAgentDeliverables(userId: string, repositoryId: string, limit = 100): AgentDeliverable[] {
  const safeLimit = Number.isInteger(limit) ? Math.max(1, Math.min(100, limit)) : 100;
  const rows = database.prepare(`SELECT ${columns} FROM agent_deliverables WHERE user_id = ? AND repository_id = ? ORDER BY published_at DESC, id LIMIT ?`)
    .all(userId, repositoryId, safeLimit) as unknown as AgentDeliverableRow[];
  return rows.map(mapRow);
}

export function getAgentDeliverable(userId: string, deliverableId: string): AgentDeliverable | null {
  const row = database.prepare(`SELECT ${columns} FROM agent_deliverables WHERE user_id = ? AND id = ?`)
    .get(userId, deliverableId) as unknown as AgentDeliverableRow | undefined;
  return row ? mapRow(row) : null;
}
