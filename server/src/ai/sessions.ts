/**
 * 文件：sessions.ts
 * 功能：管理按用户隔离的 AI Work 会话、消息和实际 Provider 用量。
 * 作用：持久化会话生命周期，并在所有读取、归档和消息操作中校验所有者。
 * 不负责：HTTP 输入验证、Provider 请求或工具授权。
 * 关联文件：server/src/database.ts、server/src/api/routes.ts、server/src/ai/runtime.ts。
 * 修改注意事项：查询必须绑定当前 user_id；用量只记录 Provider 返回的 token 数，不估算费用。
 */
import { randomUUID } from "node:crypto";
import { database } from "../database.js";
import type { ApplicationId } from "../modules/preferences/service.js";

export interface AiSessionView {
  id: string;
  appId: ApplicationId;
  title: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AiMessageView {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "complete" | "streaming" | "interrupted" | "error";
  createdAt: string;
}

export interface AiUsageSummary {
  requestCount: number;
  promptTokens: number | null;
  completionTokens: number | null;
  providers: Array<{ providerId: string; modelId: string; requestCount: number; promptTokens: number | null; completionTokens: number | null }>;
}

type SessionRow = { id: string; app_id: ApplicationId; title: string; archived: number; created_at: string; updated_at: string };
type MessageRow = { id: string; role: "user" | "assistant"; content: string; status: AiMessageView["status"]; created_at: string };

function mapSession(row: SessionRow): AiSessionView {
  return { id: row.id, appId: row.app_id, title: row.title, archived: row.archived === 1, createdAt: row.created_at, updatedAt: row.updated_at };
}

function mapMessage(row: MessageRow): AiMessageView {
  return { id: row.id, role: row.role, content: row.content, status: row.status, createdAt: row.created_at };
}

function sessionRow(userId: string, sessionId: string): SessionRow | undefined {
  return database.prepare("SELECT id, app_id, title, archived, created_at, updated_at FROM ai_sessions WHERE user_id = ? AND id = ?").get(userId, sessionId) as SessionRow | undefined;
}

export function listAiSessions(userId: string, archived: boolean, appId?: ApplicationId): AiSessionView[] {
  const rows = appId
    ? database.prepare("SELECT id, app_id, title, archived, created_at, updated_at FROM ai_sessions WHERE user_id = ? AND archived = ? AND app_id = ? ORDER BY updated_at DESC LIMIT 200").all(userId, Number(archived), appId)
    : database.prepare("SELECT id, app_id, title, archived, created_at, updated_at FROM ai_sessions WHERE user_id = ? AND archived = ? ORDER BY updated_at DESC LIMIT 200").all(userId, Number(archived));
  return (rows as SessionRow[]).map(mapSession);
}

export function getAiSessionMessages(userId: string, sessionId: string): AiMessageView[] | null {
  if (!sessionRow(userId, sessionId)) return null;
  const rows = database.prepare("SELECT id, role, content, status, created_at FROM ai_messages WHERE session_id = ? ORDER BY created_at ASC, rowid ASC LIMIT 500").all(sessionId) as MessageRow[];
  return rows.map(mapMessage);
}

export function setAiSessionArchived(userId: string, sessionId: string, archived: boolean): AiSessionView | null {
  database.prepare("UPDATE ai_sessions SET archived = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE user_id = ? AND id = ?").run(Number(archived), userId, sessionId);
  const row = sessionRow(userId, sessionId);
  return row ? mapSession(row) : null;
}

export interface AiTurnRows {
  session: AiSessionView;
  userMessage: AiMessageView;
  assistantMessage: AiMessageView;
  history: Array<{ role: "user" | "assistant"; content: string }>;
}

export function createAiTurn(userId: string, appId: ApplicationId, sessionId: string | null, content: string): AiTurnRows {
  const now = new Date().toISOString();
  const userMessageId = randomUUID();
  const assistantMessageId = randomUUID();
  let resolvedSessionId = sessionId;

  database.exec("BEGIN IMMEDIATE;");
  try {
    if (resolvedSessionId) {
      const existing = sessionRow(userId, resolvedSessionId);
      if (!existing || existing.app_id !== appId) throw new Error("找不到此应用下的 AI 会话。");
      if (existing.archived === 1) throw new Error("已归档会话不能继续对话，请先恢复会话。");
    } else {
      resolvedSessionId = randomUUID();
      database.prepare("INSERT INTO ai_sessions (id, user_id, app_id, title) VALUES (?, ?, ?, ?)").run(resolvedSessionId, userId, appId, content.trim().replace(/\s+/gu, " ").slice(0, 72) || "新对话");
    }

    database.prepare("INSERT INTO ai_messages (id, session_id, role, content, status) VALUES (?, ?, 'user', ?, 'complete')").run(userMessageId, resolvedSessionId, content);
    database.prepare("INSERT INTO ai_messages (id, session_id, role, content, status) VALUES (?, ?, 'assistant', '', 'streaming')").run(assistantMessageId, resolvedSessionId);
    database.prepare("UPDATE ai_sessions SET updated_at = ? WHERE id = ? AND user_id = ?").run(now, resolvedSessionId, userId);
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }

  const session = sessionRow(userId, resolvedSessionId!);
  const messages = database.prepare("SELECT id, role, content, status, created_at FROM ai_messages WHERE session_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 40").all(resolvedSessionId) as MessageRow[];
  const ordered = messages.reverse();
  const userRow = ordered.find((row) => row.id === userMessageId)!;
  const assistantRow = ordered.find((row) => row.id === assistantMessageId)!;
  const history = ordered.filter((row) => row.status === "complete" && row.id !== assistantMessageId).map(({ role, content: messageContent }) => ({ role, content: messageContent }));
  if (!session) throw new Error("无法读取新建的 AI 会话。");
  return { session: mapSession(session), userMessage: mapMessage(userRow), assistantMessage: mapMessage(assistantRow), history };
}

export function finishAiAssistantMessage(userId: string, sessionId: string, messageId: string, content: string, status: "complete" | "interrupted" | "error"): void {
  database.prepare("UPDATE ai_messages SET content = ?, status = ? WHERE id = ? AND session_id = ? AND session_id IN (SELECT id FROM ai_sessions WHERE user_id = ?)").run(content, status, messageId, sessionId, userId);
  database.prepare("UPDATE ai_sessions SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND user_id = ?").run(sessionId, userId);
}

export function recordAiUsage(userId: string, sessionId: string, messageId: string, providerId: string, modelId: string, promptTokens: number | null, completionTokens: number | null): void {
  database.prepare(`
    INSERT INTO ai_usage (id, user_id, session_id, message_id, provider_id, model_id, prompt_tokens, completion_tokens)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?
    WHERE EXISTS (SELECT 1 FROM ai_sessions WHERE id = ? AND user_id = ?)
  `).run(randomUUID(), userId, sessionId, messageId, providerId, modelId, promptTokens, completionTokens, sessionId, userId);
}

export function getAiUsageSummary(userId: string): AiUsageSummary {
  const overall = database.prepare("SELECT COUNT(*) AS request_count, SUM(prompt_tokens) AS prompt_tokens, SUM(completion_tokens) AS completion_tokens FROM ai_usage WHERE user_id = ?").get(userId) as { request_count: number; prompt_tokens: number | null; completion_tokens: number | null };
  const providers = database.prepare(`
    SELECT provider_id, model_id, COUNT(*) AS request_count, SUM(prompt_tokens) AS prompt_tokens, SUM(completion_tokens) AS completion_tokens
    FROM ai_usage WHERE user_id = ? GROUP BY provider_id, model_id ORDER BY MAX(created_at) DESC
  `).all(userId) as Array<{ provider_id: string; model_id: string; request_count: number; prompt_tokens: number | null; completion_tokens: number | null }>;
  return {
    requestCount: overall.request_count,
    promptTokens: overall.prompt_tokens,
    completionTokens: overall.completion_tokens,
    providers: providers.map((item) => ({ providerId: item.provider_id, modelId: item.model_id, requestCount: item.request_count, promptTokens: item.prompt_tokens, completionTokens: item.completion_tokens }))
  };
}
