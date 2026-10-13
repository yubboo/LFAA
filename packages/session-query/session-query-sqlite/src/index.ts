/**
 * 文件：index.ts
 * 功能：会话查询引擎的 node:sqlite 内置实现（内存索引）。
 * 作用：把投影后的会话头与消息正文装入内存 SQLite，支持参数化的标题/正文检索。
 * 边界：使用 :memory: 库，绝不打开运行中的主库文件；只索引公开可见文本，不索引模型请求或工具原始输出。
 *      禁止 better-sqlite3 等原生依赖；这里用 Node 24 内置 node:sqlite。
 * 关联文件：session-query（接口）、session-persistence-jsonl（数据来源）。
 */
import { DatabaseSync } from "node:sqlite";
import type { Context } from "@deepseek-ai/cordis";
import type { SessionMessageHit, SessionMessageSearchRequest, SessionQueryEngine, SessionQueryHit, SessionSearchRequest } from "lfaa-session-query";

const MAX_SNIPPET = 200;

/** 截断为检索片段，避免长正文撑爆响应。 */
function snippetOf(text: string): string {
  const normalized = text.replace(/\s+/gu, " ").trim();
  return normalized.length <= MAX_SNIPPET ? normalized : `${normalized.slice(0, MAX_SNIPPET)}…`;
}

/** 构造一个内存查询引擎实例。 */
export function createSqliteSessionQueryEngine(): SessionQueryEngine {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE idx_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      app_id TEXT,
      title TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;
    CREATE TABLE idx_messages (
      session_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      role TEXT NOT NULL,
      text TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (session_id, message_id)
    ) STRICT;
    CREATE INDEX idx_sessions_user ON idx_sessions(user_id, app_id, updated_at DESC);
    CREATE INDEX idx_messages_session ON idx_messages(session_id, updated_at DESC);
  `);

  const upsertSession = db.prepare(`INSERT INTO idx_sessions (id, user_id, app_id, title, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET user_id = excluded.user_id, app_id = excluded.app_id, title = excluded.title, updated_at = excluded.updated_at`);
  const upsertMessage = db.prepare(`INSERT INTO idx_messages (session_id, message_id, role, text, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(session_id, message_id) DO UPDATE SET role = excluded.role, text = excluded.text, updated_at = excluded.updated_at`);
  const deleteSessionMessages = db.prepare("DELETE FROM idx_messages WHERE session_id = ?");
  const deleteSession = db.prepare("DELETE FROM idx_sessions WHERE id = ?");

  return {
    indexHeader(header: Record<string, unknown>): void {
      upsertSession.run(
        String(header.id ?? ""),
        String(header.user_id ?? ""),
        header.app_id === undefined ? null : String(header.app_id),
        typeof header.title === "string" ? header.title : "",
        typeof header.updated_at === "string" ? header.updated_at : ""
      );
    },
    indexMessage(message: Record<string, unknown>): void {
      const text = typeof message.content === "string" ? message.content : "";
      if (!text.trim()) return;
      upsertMessage.run(
        String(message.session_id ?? ""),
        String(message.id ?? ""),
        message.role === "assistant" ? "assistant" : "user",
        text,
        typeof message.created_at === "string" ? message.created_at : ""
      );
    },
    removeSession(sessionId: string): void {
      deleteSessionMessages.run(sessionId);
      deleteSession.run(sessionId);
    },
    searchSessions(request: SessionSearchRequest): SessionQueryHit[] {
      const limit = Math.min(Number.isInteger(request.limit) ? request.limit! : 50, 200);
      const like = request.query ? `%${request.query}%` : null;
      const rows = db.prepare(`SELECT id, title, updated_at FROM idx_sessions
        WHERE user_id = ?
          AND (? IS NULL OR app_id = ?)
          AND (? IS NULL OR title LIKE ?)
        ORDER BY updated_at DESC LIMIT ?`).all(request.userId, request.appId ?? null, request.appId ?? null, like, like, limit) as Array<{ id: string; title: string; updated_at: string }>;
      return rows.map(row => ({ sessionId: row.id, title: row.title, updatedAt: row.updated_at }));
    },
    searchMessages(request: SessionMessageSearchRequest): SessionMessageHit[] {
      const limit = Math.min(Number.isInteger(request.limit) ? request.limit! : 50, 200);
      const rows = db.prepare(`SELECT session_id, message_id, role, text FROM idx_messages
        WHERE session_id = ? AND text LIKE ?
        ORDER BY updated_at DESC LIMIT ?`).all(request.sessionId, `%${request.query}%`, limit) as Array<{ session_id: string; message_id: string; role: string; text: string }>;
      return rows.map(row => ({ sessionId: row.session_id, messageId: row.message_id, role: row.role === "assistant" ? "assistant" : "user", snippet: snippetOf(row.text) }));
    },
    close(): void { db.close(); }
  };
}

export const name = "lfaaSessionQuerySqlite";
export function apply(ctx: Context): void {
  const engine = createSqliteSessionQueryEngine();
  ctx.provide(name, engine);
  ctx.effect(() => () => engine.close());
}
