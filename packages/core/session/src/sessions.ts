/**
 * 文件：sessions.ts
 * 功能：管理按用户隔离的 AI Work 会话、消息和实际 Provider 用量。
 * 作用：持久化会话生命周期，并在所有读取、归档和消息操作中校验所有者。
 * 不负责：HTTP 输入验证、Provider 请求或工具授权。
 * 关联文件：packages/session/session-persistence-jsonl/src/repository.ts、packages/api/gateway/src/index.ts、packages/core/agent-loop/src/runtime.ts。
 * 修改注意事项：查询必须绑定当前 user_id；用量只记录 Provider 返回的 token 数，不估算费用。
 */
import { randomUUID } from "node:crypto";
import { sessionRecords } from "lfaa-session-persistence-jsonl/src/repository.js";
import type { SessionChange } from "lfaa-session-persistence-jsonl/src/persistence.js";
import type { ApplicationId } from "lfaa-settings/src/preferences/service.js";

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
  status: "complete" | "queued" | "streaming" | "interrupted" | "error";
  createdAt: string;
  activity: AiActivityItem[];
}

export interface AiActivityItem {
  id: string;
  kind: "status" | "skill" | "tool" | "command" | "agent";
  title: string;
  status: "running" | "approval_required" | "complete" | "error" | "unavailable";
  detail: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  approvalId?: string;
}

export interface AiUsageSummary {
  requestCount: number;
  promptTokens: number | null;
  completionTokens: number | null;
  providers: Array<{ providerId: string; modelId: string; requestCount: number; promptTokens: number | null; completionTokens: number | null }>;
}

type SessionRow = { user_id: string; id: string; app_id: ApplicationId; title: string; archived: number; created_at: string; updated_at: string };
type MessageRow = { session_id: string; _order: number; id: string; role: "user" | "assistant"; content: string; status: AiMessageView["status"]; created_at: string; activity_json: string; model_history?: AiModelMessage[]; run_id?: string };

/** 模型工具协议属于受保护的会话日志，不在消息展示 API 中公开原始参数和输出。 */
export interface AiModelMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
}

export interface AiRunView { id: string; sessionId: string; appId: ApplicationId; status: AiMessageView["status"]; message: AiMessageView; userMessage: AiMessageView; session: AiSessionView }

export function getAiRun(userId: string, runId: string): AiRunView | null {
  const row = sessionRecords.get("ai_messages", runId) as MessageRow | undefined;
  if (!row || row.role !== "assistant") return null;
  const session = sessionRow(userId, row.session_id);
  if (!session) return null;
  const userMessage = messageRows(session.id).find(item => item._order === row._order - 1 && item.role === "user");
  return userMessage ? { id: row.id, sessionId: session.id, appId: session.app_id, status: row.status, message: mapMessage(row), userMessage: mapMessage(userMessage), session: mapSession(session) } : null;
}

export function saveAiModelHistory(userId: string, sessionId: string, messageId: string, messages: AiModelMessage[]): void {
  const row = sessionRecords.get("ai_messages", messageId) as MessageRow | undefined;
  if (!sessionRow(userId, sessionId) || !row || row.session_id !== sessionId || row.role !== "assistant") throw new Error("找不到当前账户的模型执行记录。");
  sessionRecords.commit(sessionId, [change("ai_messages", { ...row, model_history: messages })]);
}

/** 宿主重启不能自动重放中断时的工具调用；保留证据并要求后续模型先查询真实状态。 */
export function interruptOrphanedAiRuns(): void {
  const rows = sessionRecords.all("ai_messages", row => row.role === "assistant" && (row.status === "streaming" || row.status === "queued")) as MessageRow[];
  for (const row of rows) sessionRecords.commit(row.session_id, [change("ai_messages", { ...row, status: "interrupted" })]);
}

function mapSession(row: SessionRow): AiSessionView {
  return { id: row.id, appId: row.app_id, title: row.title, archived: row.archived === 1, createdAt: row.created_at, updatedAt: row.updated_at };
}

function mapMessage(row: MessageRow): AiMessageView {
  let activity: AiActivityItem[] = [];
  try {
    const value: unknown = JSON.parse(row.activity_json);
    if (Array.isArray(value)) activity = value.filter(isAiActivityItem);
  } catch {
    // 单条消息的旧版或损坏活动 JSON 回退为空，不影响会话文本读取。
  }
  return { id: row.id, role: row.role, content: row.content, status: row.status, createdAt: row.created_at, activity };
}

function isAiActivityItem(value: unknown): value is AiActivityItem {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string"
    && ["status", "skill", "tool", "command", "agent"].includes(String(item.kind))
    && typeof item.title === "string"
    && ["running", "approval_required", "complete", "error", "unavailable"].includes(String(item.status))
    && typeof item.detail === "string"
    && typeof item.startedAt === "string"
    && (item.completedAt === null || typeof item.completedAt === "string")
    && (item.durationMs === null || (typeof item.durationMs === "number" && Number.isFinite(item.durationMs) && item.durationMs >= 0))
    && (item.approvalId === undefined || typeof item.approvalId === "string");
}

function sessionRow(userId: string, sessionId: string): SessionRow | undefined {
  const row = sessionRecords.get("ai_sessions", sessionId) as SessionRow | undefined;
  return row?.user_id === userId ? row : undefined;
}

function messageRows(sessionId: string): MessageRow[] {
  return (sessionRecords.all("ai_messages", row => row.session_id === sessionId) as MessageRow[])
    .sort((left, right) => left.created_at.localeCompare(right.created_at) || left._order - right._order);
}

function change<T extends { id: string }>(table: SessionChange["table"], record: T): SessionChange {
  return { table, key: record.id, value: { ...record } };
}

export function listAiSessions(userId: string, archived: boolean, appId?: ApplicationId): AiSessionView[] {
  const rows = sessionRecords.all("ai_sessions", row => row.user_id === userId && row.archived === Number(archived) && (!appId || row.app_id === appId)) as SessionRow[];
  return rows.sort((left, right) => right.updated_at.localeCompare(left.updated_at)).slice(0, 200).map(mapSession);
}

export function getAiSessionMessages(userId: string, sessionId: string): AiMessageView[] | null {
  return sessionRow(userId, sessionId) ? messageRows(sessionId).slice(0, 500).map(mapMessage) : null;
}

export function saveAiAssistantActivity(userId: string, sessionId: string, messageId: string, activity: AiActivityItem[]): void {
  if (!sessionRow(userId, sessionId)) return;
  const message = sessionRecords.get("ai_messages", messageId) as MessageRow | undefined;
  if (message?.session_id !== sessionId || message.role !== "assistant") return;
  sessionRecords.commit(sessionId, [change("ai_messages", { ...message, activity_json: JSON.stringify(activity) })]);
}

export function setAiSessionArchived(userId: string, sessionId: string, archived: boolean): AiSessionView | null {
  const row = sessionRow(userId, sessionId);
  if (!row) return null;
  const updated = { ...row, archived: Number(archived), updated_at: new Date().toISOString() };
  sessionRecords.commit(sessionId, [change("ai_sessions", updated)]);
  return mapSession(updated);
}

export interface AiTurnRows {
  session: AiSessionView;
  userMessage: AiMessageView;
  assistantMessage: AiMessageView;
  history: AiModelMessage[];
}

export function createAiTurn(userId: string, appId: ApplicationId, sessionId: string | null, content: string, queued = false): AiTurnRows {
  const now = new Date().toISOString();
  const id = sessionId ?? randomUUID();
  const existing = sessionId ? sessionRow(userId, sessionId) : undefined;
  if (sessionId && (!existing || existing.app_id !== appId)) throw new Error("找不到此应用下的 AI 会话。");
  if (existing?.archived === 1) throw new Error("已归档会话不能继续对话，请先恢复会话。");
  if (!queued && messageRows(id).some(row => row.role === "assistant" && (row.status === "streaming" || row.status === "queued"))) throw new Error("此会话仍有活动任务，请先跟随或停止当前任务。");
  const session: SessionRow = existing ? { ...existing, updated_at: now } : {
    id, user_id: userId, app_id: appId, title: content.trim().replace(/\s+/gu, " ").slice(0, 72) || "新对话",
    archived: 0, created_at: now, updated_at: now
  };
  const previous = messageRows(id);
  const ordinal = previous.reduce((max, row) => Math.max(max, row._order), 0);
  const userMessage: MessageRow = { id: randomUUID(), session_id: id, role: "user", content, status: "complete", created_at: now, activity_json: "[]", _order: ordinal + 1 };
  const assistantMessage: MessageRow = { id: randomUUID(), session_id: id, role: "assistant", content: "", status: queued ? "queued" : "streaming", created_at: now, activity_json: "[]", _order: ordinal + 2 };
  // 一轮输入和预留回复在同一个刷盘事件中提交，不能只留下半轮消息。
  sessionRecords.commit(id, [change("ai_sessions", session), change("ai_messages", userMessage), change("ai_messages", assistantMessage)]);
  const history = historyForTurn(id, assistantMessage.id, userMessage._order);
  return { session: mapSession(session), userMessage: mapMessage(userMessage), assistantMessage: mapMessage(assistantMessage), history };
}

function historyForTurn(sessionId: string, messageId: string, userOrder: number): AiModelMessage[] {
  const ordered = messageRows(sessionId).filter(row => row._order <= userOrder).slice(-40);
  const history: AiModelMessage[] = ordered.filter(row => row.id !== messageId).flatMap(row => {
    if (row.run_id && ordered.some(parent => parent.id === row.run_id && parent.status === "complete")) return [];
    if (row.role === "user") return [{ role: "user" as const, content: row.content }];
    if (row.status === "queued") return [];
    if (row.status === "complete") return row.model_history?.length ? row.model_history : [{ role: "assistant" as const, content: row.content }];
    // 中断记录可能包含无结果的副作用，禁止将其当成完整协议或成功操作恢复。
    return [{ role: "assistant" as const, content: `${row.content}\n本轮执行已中断或失败；工具状态未确认时必须先查询，不得重放副作用。` }];
  });
  return history;
}

/** 排队任务开始时重新投影历史，确保包含前一任务的真实工具结果。 */
export function refreshAiTurnHistory(userId: string, turn: AiTurnRows): void {
  const user = sessionRecords.get("ai_messages", turn.userMessage.id) as MessageRow | undefined;
  if (!sessionRow(userId, turn.session.id) || !user) throw new Error("找不到任务输入。");
  turn.history = historyForTurn(turn.session.id, turn.assistantMessage.id, user._order);
}

export function appendAiSteeringInput(userId: string, runId: string, content: string): AiMessageView {
  const run = getAiRun(userId, runId);
  if (!run || run.status !== "streaming") throw new Error("任务已结束，不能继续引导当前运行。");
  const rows = messageRows(run.sessionId);
  const input: MessageRow = { id: randomUUID(), session_id: run.sessionId, _order: rows.reduce((max, row) => Math.max(max, row._order), 0) + 1, role: "user", content, status: "complete", activity_json: "[]", run_id: runId, created_at: new Date().toISOString() };
  sessionRecords.commit(run.sessionId, [change("ai_messages", input)]);
  return mapMessage(input);
}

export function finishAiAssistantMessage(userId: string, sessionId: string, messageId: string, content: string, status: AiMessageView["status"]): void {
  const session = sessionRow(userId, sessionId);
  const message = sessionRecords.get("ai_messages", messageId) as MessageRow | undefined;
  if (!session || message?.session_id !== sessionId || message.role !== "assistant") return;
  sessionRecords.commit(sessionId, [change("ai_messages", { ...message, content, status }), change("ai_sessions", { ...session, updated_at: new Date().toISOString() })]);
}

interface UsageRow {
  id: string; user_id: string; session_id: string; message_id: string; provider_id: string; model_id: string;
  prompt_tokens: number | null; completion_tokens: number | null; created_at: string;
}

export function recordAiUsage(userId: string, sessionId: string, messageId: string, providerId: string, modelId: string, promptTokens: number | null, completionTokens: number | null): void {
  if (!sessionRow(userId, sessionId)) return;
  const message = sessionRecords.get("ai_messages", messageId) as MessageRow | undefined;
  if (message?.session_id !== sessionId) return;
  const row: UsageRow = { id: randomUUID(), user_id: userId, session_id: sessionId, message_id: messageId, provider_id: providerId, model_id: modelId, prompt_tokens: promptTokens, completion_tokens: completionTokens, created_at: new Date().toISOString() };
  sessionRecords.commit(sessionId, [change("ai_usage", row)]);
}

function tokenSum(rows: UsageRow[], key: "prompt_tokens" | "completion_tokens"): number | null {
  const values = rows.map(row => row[key]).filter((value): value is number => value !== null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}

export function getAiUsageSummary(userId: string): AiUsageSummary {
  const rows = sessionRecords.all("ai_usage", row => row.user_id === userId) as UsageRow[];
  const groups = new Map<string, UsageRow[]>();
  for (const row of rows.sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    const key = JSON.stringify([row.provider_id, row.model_id]);
    const group = groups.get(key) ?? []; group.push(row); groups.set(key, group);
  }
  return {
    requestCount: rows.length, promptTokens: tokenSum(rows, "prompt_tokens"), completionTokens: tokenSum(rows, "completion_tokens"),
    providers: [...groups.values()].map(group => ({ providerId: group[0]!.provider_id, modelId: group[0]!.model_id, requestCount: group.length, promptTokens: tokenSum(group, "prompt_tokens"), completionTokens: tokenSum(group, "completion_tokens") }))
  };
}
