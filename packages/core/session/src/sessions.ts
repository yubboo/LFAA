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
import type { SessionChange, SessionCommit } from "lfaa-session-persistence-jsonl/src/persistence.js";
import type { ApplicationId } from "lfaa-settings/src/preferences/service.js";
import { SessionKernel, SessionStore, sessionRequestHeadersEqual, type SessionEvent, type SessionEventDataMap, type SessionEventType, type SessionModelMessage, type SessionSurfaceOperation } from "./kernel.js";
export { SessionKernel, SessionStore };

export interface AiSessionView {
  id: string;
  appId: ApplicationId;
  title: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  projectId: string | null;
  projectTitle: string | null;
  planMode: boolean;
}

export interface AiMessageView {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "complete" | "queued" | "streaming" | "interrupted" | "error";
  createdAt: string;
  activity: AiActivityItem[];
  feedback?: AiMessageFeedbackView;
}

export interface AiMessageFeedbackView {
  rating: "positive" | "negative";
  reasons: string[];
  detail: string;
  submittedAt: string;
}

export interface AiMessageFeedbackInput {
  rating: "positive" | "negative";
  reasons: string[];
  detail: string;
}

export interface AiActivityItem {
  id: string;
  kind: "status" | "skill" | "tool" | "command" | "agent" | "question";
  title: string;
  status: "running" | "approval_required" | "waiting_input" | "complete" | "error" | "unavailable";
  detail: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  approvalId?: string;
  questionId?: string;
  question?: string;
  options?: string[];
  writingProposalId?: string;
}

export interface AiUsageSummary {
  requestCount: number;
  promptTokens: number | null;
  completionTokens: number | null;
  providers: Array<{ providerId: string; modelId: string; requestCount: number; promptTokens: number | null; completionTokens: number | null }>;
}

type SessionRow = { user_id: string; id: string; app_id: ApplicationId; title: string; archived: number; created_at: string; updated_at: string; workspace_project_id?: string | null; workspace_node_id?: string | null; workspace_directory?: string | null; workspace_title?: string | null };
type MessageRow = { session_id: string; _order: number; id: string; role: "user" | "assistant"; content: string; status: AiMessageView["status"]; created_at: string; activity_json: string; model_history?: AiModelMessage[]; run_id?: string; kernel_run_id?: string };

/** 模型工具协议属于受保护的会话日志，不在消息展示 API 中公开原始参数和输出。 */
export interface AiModelMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
}

export interface AiRunView { id: string; sessionId: string; appId: ApplicationId; status: AiMessageView["status"]; message: AiMessageView; userMessage: AiMessageView; session: AiSessionView }

type SessionEventSpec = { [K in SessionEventType]: { type: K; data: SessionEventDataMap[K]; time?: string; surface?: { surfaceOp?: SessionSurfaceOperation; sourceEventSeqs?: number[] } } }[SessionEventType];
const activeSessionRuns = new Set<string>();
const sessionPlanModeCache = new WeakMap<SessionKernel, { length: number; active: boolean }>();
const sessionKernelStore = new SessionStore(() => sessionRecords.assertReady());
sessionRecords.onSessionsRemoved(sessionIds => {
  for (const id of sessionIds) { sessionKernelStore.drop(id); activeSessionRuns.delete(id); }
});

function sessionKernelFor(sessionId: string): SessionKernel {
  sessionRecords.assertReady();
  return sessionKernelStore.get(sessionId)
    ?? sessionKernelStore.restore(sessionId, sessionRecords.allForSession("session_events", sessionId) as SessionEvent[]);
}

function planModeForSession(session: SessionRow): boolean {
  const kernel = ensureSessionEventLog(session);
  const cached = sessionPlanModeCache.get(kernel);
  if (cached) {
    if (cached.length < kernel.length) {
      for (const event of kernel.eventsAfter(cached.length)) {
        if (event.type === "session/plan-mode") cached.active = event.data.active;
      }
      cached.length = kernel.length;
    }
    return cached.active;
  }
  const event = [...kernel.events].reverse().find((item): item is Extract<SessionEvent, { type: "session/plan-mode" }> => item.type === "session/plan-mode");
  const active = event?.data.active ?? false;
  sessionPlanModeCache.set(kernel, { length: kernel.length, active });
  return active;
}

/** 只返回当前账户拥有的会话计划状态；Session 事件日志是唯一权威来源。 */
export function getAiSessionPlanMode(userId: string, sessionId: string): boolean {
  const session = sessionRow(userId, sessionId);
  return session ? planModeForSession(session) : false;
}

/** 修改当前账户会话的计划状态；HTTP 用户操作默认要求会话空闲，Agent Loop 内部转换可显式允许活动轮次。 */
export function setAiSessionPlanMode(userId: string, sessionId: string, active: boolean, options: { allowActiveRun?: boolean } = {}): AiSessionView | null {
  const session = sessionRow(userId, sessionId);
  if (!session || session.archived === 1 || getAiSideChatParentSessionId(userId, sessionId)) return null;
  if (!options.allowActiveRun && activeSessionRuns.has(sessionId)) throw new Error("当前会话仍有活动任务，请先等待任务结束后再切换计划模式。");
  const kernel = ensureSessionEventLog(session);
  if (planModeForSession(session) !== active) {
    appendAiSessionEvents(userId, sessionId, [eventSpec("session/plan-mode", { active })]);
    sessionPlanModeCache.set(kernel, { length: kernel.length, active });
  }
  return mapSession(session);
}

function sessionEventChanges(sessionId: string, specs: readonly SessionEventSpec[], owner?: { userId: string; appId: ApplicationId }): SessionChange[] {
  const kernel = sessionKernelFor(sessionId);
  const before = kernel.length;
  for (const spec of specs) kernel.append(spec.type, spec.data as never, spec.time, spec.surface);
  return kernel.eventsAfter(before).map(event => ({
    table: "session_events",
    key: event.id,
    value: { ...event, session_id: event.sessionId, ...(owner ? { user_id: owner.userId, app_id: owner.appId } : {}) }
  }));
}

function eventSpec<K extends SessionEventType>(type: K, data: SessionEventDataMap[K], time?: string, surface?: SessionEventSpec["surface"]): SessionEventSpec {
  return { type, data, ...(time ? { time } : {}), ...(surface ? { surface } : {}) } as SessionEventSpec;
}

function redactConversationMemoryBlock(value: string): string {
  return value.replace(/<conversation-memory>[\s\S]*?<\/conversation-memory>/giu, "");
}

function redactMemoryFromModelMessages(value: unknown): unknown[] | null {
  if (!Array.isArray(value)) return null;
  return value.map(message => {
    if (!message || typeof message !== "object" || Array.isArray(message)) return message;
    const row = message as Record<string, unknown>;
    return typeof row.content === "string" ? { ...row, content: redactConversationMemoryBlock(row.content) } : row;
  });
}

function redactConversationMemoryCommit(commit: SessionCommit): SessionCommit {
  let changed = false;
  const changes = commit.changes.map(change => {
    const value = change.value;
    if (!value) return change;
    if (change.table === "ai_messages" && Array.isArray(value.model_history)) {
      const history = redactMemoryFromModelMessages(value.model_history)!;
      if (JSON.stringify(history) === JSON.stringify(value.model_history)) return change;
      changed = true;
      return { ...change, value: { ...value, model_history: history } };
    }
    if (change.table === "session_events" && (value.type === "request/context" || value.type === "assistant/attempt")) {
      const data = value.data;
      if (!data || typeof data !== "object" || Array.isArray(data)) return change;
      const eventData = data as Record<string, unknown>;
      const messages = redactMemoryFromModelMessages(eventData.messages);
      if (!messages || JSON.stringify(messages) === JSON.stringify(eventData.messages)) return change;
      changed = true;
      return { ...change, value: { ...value, data: { ...eventData, messages } } };
    }
    return change;
  });
  return changed ? { ...commit, changes } : commit;
}

/** 删除个人记忆前，清除该账户 Session 模型快照中的历史注入正文；原始聊天消息保留。 */
export function redactConversationMemoryContexts(userId: string): number {
  const sessions = sessionRecords.all("ai_sessions", row => row.user_id === userId) as SessionRow[];
  let rewrittenTransactions = 0;
  for (const session of sessions) {
    if (!sessionRow(userId, session.id)) continue;
    const rewritten = sessionRecords.rewriteSession(session.id, redactConversationMemoryCommit);
    if (rewritten) {
      sessionKernelStore.drop(session.id);
      rewrittenTransactions += rewritten;
    }
  }
  return rewrittenTransactions;
}

function parseStoredActivity(value: string): AiActivityItem[] {
  try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter(isAiActivityItem) : []; }
  catch { return []; }
}

function compactSessionStream(stream: readonly string[]): string[] | undefined {
  if (!stream.length) return undefined;
  return stream.length > 4096 ? [stream.join("")] : [...stream];
}

function isStoredModelMessage(value: unknown): value is AiModelMessage {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const message = value as Record<string, unknown>;
  if (!["system", "user", "assistant", "tool"].includes(String(message.role)) || message.content !== null && typeof message.content !== "string") return false;
  if (message.tool_call_id !== undefined && typeof message.tool_call_id !== "string") return false;
  return message.tool_calls === undefined || Array.isArray(message.tool_calls) && message.tool_calls.every(call => {
    if (typeof call !== "object" || call === null || Array.isArray(call)) return false;
    const item = call as Record<string, unknown>;
    if (item.type !== "function" || typeof item.id !== "string" || typeof item.function !== "object" || item.function === null || Array.isArray(item.function)) return false;
    const fn = item.function as Record<string, unknown>;
    return typeof fn.name === "string" && typeof fn.arguments === "string";
  });
}

function storedToolOutcome(content: string): SessionEventDataMap["tool/result"]["executionState"] {
  try {
    const parsed: unknown = JSON.parse(content);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "complete";
    const result = parsed as Record<string, unknown>;
    if (["complete", "failed", "unconfirmed", "not_started"].includes(String(result.executionState))) return result.executionState as SessionEventDataMap["tool/result"]["executionState"];
    if (result.executed === false) return "not_started";
    if (result.isError === true || result.error !== undefined) return "failed";
  } catch { /* 工具内容可以是普通文本；它仍是已记录的返回内容。 */ }
  return "complete";
}

function authoritativeModelHistory(row: MessageRow): AiModelMessage[] {
  const runId = row.kernel_run_id ?? row.id;
  return sessionKernelFor(row.session_id).latestAttempt(runId) as AiModelMessage[] | undefined ?? row.model_history ?? [];
}

/** 首次读取旧会话时，以校验过的现有 JSONL 投影做幂等事件导入，不重写或删除旧消息。 */
function ensureSessionEventLog(session: SessionRow): SessionKernel {
  const id = session.id;
  let kernel = sessionKernelStore.get(id) ?? sessionKernelStore.restore(id, sessionRecords.allForSession("session_events", id) as SessionEvent[]);
  if (!kernel.length) {
    const before = kernel.length;
    const specs: SessionEventSpec[] = [
      eventSpec("session/created", { ownerId: session.user_id, appId: session.app_id, createdAt: session.created_at }, session.created_at),
      eventSpec("session/title", { title: session.title }, session.created_at),
      eventSpec("session/project", { projectId: session.workspace_project_id ?? null, nodeId: session.workspace_node_id ?? null, directory: session.workspace_directory ?? null, title: session.workspace_title ?? null }, session.created_at),
      eventSpec("session/archived", { archived: session.archived === 1 }, session.updated_at)
    ];
    const rows = messageRows(id);
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index]!;
      if (row.role === "user") {
        const next = rows[index + 1];
        const turnId = row.run_id ?? (next?.role === "assistant" ? next.id : row.id);
        if (!row.run_id && !(next?.role === "assistant" && next.status === "queued")) specs.push(eventSpec("turn/start", { turnId, userMessageId: row.id, assistantMessageId: next?.role === "assistant" ? next.id : row.id }, row.created_at));
        specs.push(eventSpec("user/message", { messageId: row.id, content: row.content, ...(row.run_id ? { runId: row.run_id } : {}) }, row.created_at));
      } else {
        const runId = row.id;
        const modelHistory = Array.isArray(row.model_history) && row.model_history.every(isStoredModelMessage) ? row.model_history : [];
        if (modelHistory.length) {
          specs.push(eventSpec("assistant/attempt", { runId, messages: modelHistory as SessionModelMessage[] }, row.created_at));
          const recordedResults = new Map(modelHistory.filter(message => message.role === "tool" && message.tool_call_id).map(message => [message.tool_call_id!, message]));
          for (const message of modelHistory) {
            if (message.role === "assistant") {
              specs.push(eventSpec("assistant/response", { runId, message }, row.created_at));
              for (const call of message.tool_calls ?? []) {
              const result = recordedResults.get(call.id);
              const state = result && typeof result.content === "string" ? storedToolOutcome(result.content) : "unconfirmed";
              specs.push(eventSpec("tool/call", { runId, callId: call.id, name: call.function.name, arguments: call.function.arguments, dispatched: !result || state !== "not_started" }));
              }
            }
            else if (message.role === "tool" && message.tool_call_id && typeof message.content === "string") {
              const state = storedToolOutcome(message.content);
              specs.push(eventSpec("tool/result", { runId, callId: message.tool_call_id, content: message.content, isError: state === "failed" || state === "not_started", executionState: state }));
            }
          }
        }
        specs.push(eventSpec("assistant/message", { messageId: row.id, content: row.content, status: row.status, runId }, row.created_at));
        const activity = parseStoredActivity(row.activity_json);
        if (activity.length) specs.push(eventSpec("activity/change", { runId, messageId: row.id, activity }, row.created_at));
        if (row.status === "complete") {
          specs.push(eventSpec("turn/end", { turnId: row.id, status: "complete" }, row.created_at));
        }
      }
    }
    for (const usage of sessionRecords.allForSession("ai_usage", id) as UsageRow[]) {
      specs.push(eventSpec("usage/record", { runId: usage.message_id, providerId: usage.provider_id, modelId: usage.model_id, promptTokens: usage.prompt_tokens, completionTokens: usage.completion_tokens }, usage.created_at));
    }
    for (const spec of specs) kernel.append(spec.type, spec.data as never, spec.time);
    const eventChanges = kernel.eventsAfter(before).map(event => ({ table: "session_events" as const, key: event.id, value: { ...event, session_id: event.sessionId, user_id: session.user_id, app_id: session.app_id } }));
    if (eventChanges.length) sessionRecords.commit(id, eventChanges);
  }
  const latestAssistant = [...messageRows(id, true)].reverse().find(row => row.role === "assistant");
  const needsRecovery = latestAssistant !== undefined && latestAssistant.status !== "complete";
  if (needsRecovery && !activeSessionRuns.has(id) && kernel.hasOpenTurn(latestAssistant.id)) {
    const lastAssistant = [...kernel.events].reverse().find((event): event is Extract<SessionEvent, { type: "assistant/message" }> => event.type === "assistant/message");
    const before = kernel.length;
    if (lastAssistant && lastAssistant.data.status !== latestAssistant.status) kernel.append("assistant/message", { ...lastAssistant.data, status: latestAssistant.status }, lastAssistant.time);
    kernel.repairOpenTail("interrupted");
    const repaired = kernel.eventsAfter(before).map(event => ({ table: "session_events" as const, key: event.id, value: { ...event, session_id: event.sessionId, user_id: session.user_id, app_id: session.app_id } }));
    if (repaired.length) sessionRecords.commit(id, repaired);
  }
  return kernel;
}

/** JSONL 每次事务在返回前均 fsync；flush 是显式等待并核验当前会话的持久化屏障。 */
export async function flushAiSession(userId: string, sessionId: string): Promise<void> {
  const session = sessionRow(userId, sessionId);
  if (!session) throw new Error("找不到当前账户的 AI 会话。");
  await ensureSessionEventLog(session).flush();
}

/** 记录 Agent Loop 的真实请求与工具边界，原始协议只进入受保护的 Session JSONL。 */
export function appendAiSessionEvents(userId: string, sessionId: string, specs: readonly SessionEventSpec[]): void {
  const session = sessionRow(userId, sessionId);
  if (!session) throw new Error("找不到当前账户的 AI 会话。");
  ensureSessionEventLog(session);
  const changes = sessionEventChanges(sessionId, specs, { userId, appId: session.app_id });
  if (changes.length) sessionRecords.commit(sessionId, changes);
}

function commitSessionChanges(userId: string, sessionId: string, changes: SessionChange[], specs: readonly SessionEventSpec[]): void {
  const session = sessionRow(userId, sessionId);
  if (!session) throw new Error("找不到当前账户的 AI 会话。");
  ensureSessionEventLog(session);
  sessionRecords.commit(sessionId, [...changes, ...sessionEventChanges(sessionId, specs, { userId, appId: session.app_id })]);
}

export function recordAiSessionRequest(userId: string, sessionId: string, runId: string, header: Omit<SessionEventDataMap["request/header"], "appId" | "runId"> & { appId?: string }, messages: SessionModelMessage[]): void {
  const session = sessionRow(userId, sessionId);
  if (!session) throw new Error("找不到当前账户的 AI 会话。");
  const kernel = ensureSessionEventLog(session);
  const { tools, ...headerFields } = header;
  const nextHeader = { ...headerFields, ...(tools?.length ? { tools } : {}), runId, appId: session.app_id };
  const previous = kernel.requestHeader?.data;
  const same = previous ? sessionRequestHeadersEqual(previous, nextHeader) : false;
  const safeMessages = redactMemoryFromModelMessages(messages) as SessionModelMessage[];
  const reason: SessionEventDataMap["request/header"]["reason"] = !previous ? "initial"
    : !same ? "change" : previous.runId === runId ? "resume" : "series";
  appendAiSessionEvents(userId, sessionId, [
    eventSpec("request/header", { ...nextHeader, reason, ...(previous && previous.runId !== runId && same ? { startsSeries: true as const } : {}) }),
    eventSpec("request/context", { runId, messages: safeMessages })
  ]);
}

export function recordAiSessionStep(userId: string, sessionId: string, turnId: string, step: number, phase: "start" | "end"): void {
  appendAiSessionEvents(userId, sessionId, [phase === "start"
    ? eventSpec("step/start", { turnId, step })
    : eventSpec("step/end", { turnId, step })]);
}

export function recordAiModelResponse(
  userId: string,
  sessionId: string,
  runId: string,
  content: string,
  toolCalls: Array<{ id: string; name: string; arguments: string }>,
  stream?: string[],
  usage?: { promptTokens: number | null; completionTokens: number | null }
): void {
  const message: AiModelMessage = toolCalls.length
    ? { role: "assistant", content: content || null, tool_calls: toolCalls.map(call => ({ id: call.id, type: "function", function: { name: call.name, arguments: call.arguments } })) }
    : { role: "assistant", content };
  const compactedStream = stream ? compactSessionStream(stream) : undefined;
  appendAiSessionEvents(userId, sessionId, [eventSpec("assistant/response", { runId, message, ...(compactedStream ? { stream: compactedStream } : {}), ...(usage ? { usage } : {}) })]);
}

export function recordAiSessionAttempt(userId: string, sessionId: string, runId: string, stream: string[], error: unknown): void {
  const session = sessionRow(userId, sessionId);
  if (!session) throw new Error("找不到当前账户的 AI 会话。");
  const kernel = ensureSessionEventLog(session);
  const header = kernel.requestHeader;
  const messages = header?.data.runId === runId ? kernel.requestContext ?? [] : [];
  const failure = error instanceof Error ? { name: error.name.slice(0, 120), message: error.message.slice(0, 2000) }
    : { name: "Error", message: "Provider 请求在返回 Error 对象之外失败。" };
  const compactedStream = compactSessionStream(stream);
  appendAiSessionEvents(userId, sessionId, [eventSpec("assistant/attempt", {
    runId,
    messages: [...messages],
    error: failure,
    ...(compactedStream ? { stream: compactedStream } : {})
  })]);
}

export function recordAiToolCall(userId: string, sessionId: string, runId: string, callId: string, name: string, args: string, dispatched: boolean): void {
  const session = sessionRow(userId, sessionId);
  if (!session) throw new Error("找不到当前账户的 AI 会话。");
  ensureSessionEventLog(session);
  const headerSeq = sessionKernelFor(sessionId).requestHeader?.seq;
  appendAiSessionEvents(userId, sessionId, [eventSpec("tool/call", { runId, callId, name, arguments: args, dispatched, ...(headerSeq === undefined ? {} : { headerSeq }) })]);
}

export function recordAiToolResult(userId: string, sessionId: string, runId: string, callId: string, content: string, isError: boolean, executionState: SessionEventDataMap["tool/result"]["executionState"]): void {
  appendAiSessionEvents(userId, sessionId, [eventSpec("tool/result", { runId, callId, content, isError, executionState })]);
}

/** 队列任务仅在前一轮结束后开启 turn，避免持久化轨迹中出现交错的开放轮次。 */
export function startQueuedAiTurn(userId: string, sessionId: string, userMessageId: string, assistantMessageId: string): void {
  const session = sessionRow(userId, sessionId);
  if (!session) throw new Error("找不到当前账户的 AI 会话。");
  const kernel = ensureSessionEventLog(session);
  if (kernel.hasTurn(assistantMessageId)) return;
  appendAiSessionEvents(userId, sessionId, [eventSpec("turn/start", { turnId: assistantMessageId, userMessageId, assistantMessageId })]);
  activeSessionRuns.add(sessionId);
}

/** 在现有会话 Owner 中建立精确前缀分支；账户、App 和项目范围继承自源会话。 */
export function forkAiSession(userId: string, sessionId: string, sourceSeq: number, projectContext?: AiSessionProjectContext, sideChat?: { parentSessionId: string; snapshotSeq: number }): AiSessionView | null {
  const source = sessionRow(userId, sessionId);
  if (!source) return null;
  if (sideChat && (sideChat.parentSessionId !== sessionId || sideChat.snapshotSeq !== sourceSeq)) throw new Error("侧聊 Session 来源必须绑定当前账户拥有的实际快照边界。");
  const sourceEvents = ensureSessionEventLog(source).events;
  const forkId = randomUUID();
  const branch = new SessionKernel(sessionId, sourceEvents).fork(sourceSeq, forkId);
  const now = new Date().toISOString();
  const header: SessionRow = {
    ...source, id: forkId, title: (sideChat ? `侧边聊天 · ${source.title}` : `${source.title}（分支）`).slice(0, 72), archived: 0, created_at: now, updated_at: now,
    ...(projectContext ? { workspace_project_id: projectContext.id, workspace_node_id: projectContext.nodeId, workspace_directory: projectContext.path, workspace_title: projectContext.title } : {})
  };
  const projected: SessionChange[] = [change("ai_sessions", header)];
  if (!branch.events.some(event => event.type === "session/created")) branch.append("session/created", { ownerId: userId, appId: source.app_id, createdAt: now }, now);
  branch.append("session/title", { title: header.title }, now);
  branch.append("session/project", { projectId: header.workspace_project_id ?? null, nodeId: header.workspace_node_id ?? null, directory: header.workspace_directory ?? null, title: header.workspace_title ?? null }, now);
  if (sideChat) branch.append("session/side-chat", sideChat, now);
  branch.append("session/archived", { archived: false }, now);
  const surface = branch.surface;
  let order = 0;
  const sourceRows = new Map(messageRows(sessionId).map(row => [row.id, row]));
  const activities = new Map<string, AiActivityItem[]>();
  for (const event of branch.events) if (event.type === "activity/change") activities.set(event.data.messageId, event.data.activity.filter(isAiActivityItem));
  const orderedSurface = [...surface].sort((left, right) => (sourceRows.get(left.id)?._order ?? left.seq) - (sourceRows.get(right.id)?._order ?? right.seq));
  for (const item of orderedSurface) {
    if (item.kind === "user") {
      const data = item.data as unknown as { messageId: string; content: string; runId?: string };
      projected.push(change("ai_messages", { id: randomUUID(), session_id: forkId, _order: ++order, role: "user", content: data.content, status: "complete", created_at: now, activity_json: "[]", ...(data.runId ? { run_id: data.runId } : {}) }));
    } else if (item.kind === "assistant") {
      const data = item.data as unknown as { content: string; status: string; runId?: string };
      if (data.status === "complete") {
        const runId = data.runId ?? item.id;
        const modelHistory = branch.latestAttempt(runId) as AiModelMessage[] | undefined;
        projected.push(change("ai_messages", {
          id: randomUUID(), session_id: forkId, _order: ++order, role: "assistant", content: data.content, status: "complete", created_at: now,
          activity_json: JSON.stringify(activities.get(runId) ?? []), ...(modelHistory ? { model_history: modelHistory, kernel_run_id: runId } : {})
        }));
      }
    }
  }
  const eventChanges = branch.events.map(event => ({ table: "session_events" as const, key: event.id, value: { ...event, session_id: event.sessionId, user_id: userId, app_id: source.app_id } }));
  sessionRecords.commit(forkId, [...projected, ...eventChanges]);
  return mapSession(header);
}

/** 从源会话当前已记录事件创建独立侧聊快照；开放中的助手输出不会进入分支。 */
export function forkAiSessionForSideChat(userId: string, sessionId: string): AiSessionView | null {
  const source = sessionRow(userId, sessionId);
  if (!source || source.archived === 1 || getAiSideChatParentSessionId(userId, sessionId)) return null;
  const snapshotSeq = ensureSessionEventLog(source).events.length;
  return forkAiSession(userId, sessionId, snapshotSeq, undefined, { parentSessionId: sessionId, snapshotSeq });
}

/** 侧聊标记只从账户自己的 Session JSONL 读取，并用于收紧所有运行入口的工具权限。 */
export function getAiSideChatParentSessionId(userId: string, sessionId: string): string | null {
  const session = sessionRow(userId, sessionId);
  if (!session) return null;
  const marker = [...ensureSessionEventLog(session).events].reverse().find((event): event is Extract<SessionEvent, { type: "session/side-chat" }> => event.type === "session/side-chat");
  return marker?.data.parentSessionId ?? null;
}

/** 按独立用户轮次创建编辑分支；必须先结束源会话的所有活动运行。 */
export function forkAiSessionBeforeUserMessage(userId: string, sessionId: string, userMessageId: string): AiSessionView | null {
  const source = sessionRow(userId, sessionId);
  if (!source) return null;
  if (activeSessionRuns.has(sessionId)) throw new Error("当前会话仍有活动任务，请先停止并等待任务结束后再编辑问题。");

  const rows = messageRows(sessionId);
  const userIndex = rows.findIndex(row => row.id === userMessageId && row.role === "user" && !row.run_id);
  const userRow = rows[userIndex];
  const assistantRow = rows[userIndex + 1];
  if (!userRow || !assistantRow || assistantRow.role !== "assistant") return null;

  const events = ensureSessionEventLog(source).events;
  const userEvent = events.find((event): event is Extract<SessionEvent, { type: "user/message" }> => event.type === "user/message" && event.data.messageId === userMessageId);
  if (!userEvent || userEvent.data.runId) return null;
  const turnStart = [...events].reverse().find((event): event is Extract<SessionEvent, { type: "turn/start" }> => event.type === "turn/start" && event.data.userMessageId === userMessageId);
  if (turnStart && turnStart.data.assistantMessageId !== assistantRow.id) return null;
  if (!turnStart && assistantRow.status !== "queued") return null;

  // 普通轮次的 turn/start 在用户消息之前；queued 轮次则在它之后，因此边界取两者最早事件之前。
  const boundary = Math.min(userEvent.seq, turnStart?.seq ?? userEvent.seq) - 1;
  return forkAiSession(userId, sessionId, boundary);
}

/** 只允许从当前账户拥有的完整助手回答创建分支，边界由服务端日志推导。 */
export function forkAiSessionFromMessage(userId: string, sessionId: string, assistantMessageId: string, projectContext?: AiSessionProjectContext): AiSessionView | null {
  const source = sessionRow(userId, sessionId);
  if (!source) return null;
  const events = ensureSessionEventLog(source).events;
  const assistantEvent = [...events].reverse().find((event): event is Extract<SessionEvent, { type: "assistant/message" }> => event.type === "assistant/message" && event.data.messageId === assistantMessageId);
  if (!assistantEvent || assistantEvent.data.status !== "complete" || !assistantEvent.data.content) return null;
  const turnStart = [...events].reverse().find((event): event is Extract<SessionEvent, { type: "turn/start" }> => event.type === "turn/start" && event.data.assistantMessageId === assistantMessageId && event.seq <= assistantEvent.seq);
  const turnEnd = turnStart && events.find((event): event is Extract<SessionEvent, { type: "turn/end" }> => event.type === "turn/end" && event.data.turnId === turnStart.data.turnId && event.data.status === "complete" && event.seq >= assistantEvent.seq);
  if (projectContext && projectContext.appId !== source.app_id) return null;
  return forkAiSession(userId, sessionId, turnEnd?.seq ?? assistantEvent.seq, projectContext);
}

export function getAiRun(userId: string, runId: string): AiRunView | null {
  const row = sessionRecords.get("ai_messages", runId) as MessageRow | undefined;
  if (!row || row.role !== "assistant") return null;
  const session = sessionRow(userId, row.session_id);
  if (!session) return null;
  ensureSessionEventLog(session);
  const userMessage = messageRows(session.id).find(item => item._order === row._order - 1 && item.role === "user");
  return userMessage ? { id: row.id, sessionId: session.id, appId: session.app_id, status: row.status, message: mapMessage(row), userMessage: mapMessage(userMessage), session: mapSession(session) } : null;
}

export function saveAiModelHistory(userId: string, sessionId: string, messageId: string, messages: AiModelMessage[]): void {
  const row = sessionRecords.get("ai_messages", messageId) as MessageRow | undefined;
  if (!sessionRow(userId, sessionId) || !row || row.session_id !== sessionId || row.role !== "assistant") throw new Error("找不到当前账户的模型执行记录。");
  const safeMessages = redactMemoryFromModelMessages(messages) as AiModelMessage[];
  const committed = { ...row, model_history: safeMessages };
  commitSessionChanges(userId, sessionId, [change("ai_messages", committed)], [eventSpec("assistant/attempt", { runId: messageId, messages: safeMessages })]);
}

/** 宿主重启不能自动重放中断时的工具调用；保留证据并要求后续模型先查询真实状态。 */
export function interruptOrphanedAiRuns(): void {
  const rows = sessionRecords.all("ai_messages", row => row.role === "assistant" && (row.status === "streaming" || row.status === "queued")) as MessageRow[];
  for (const row of rows) {
    const header = sessionRecords.get("ai_sessions", row.session_id) as SessionRow | undefined;
    if (!header) continue;
    finishAiAssistantMessage(header.user_id, row.session_id, row.id, row.content, "interrupted");
  }
}

function mapSession(row: SessionRow): AiSessionView {
  return { id: row.id, appId: row.app_id, title: row.title, archived: row.archived === 1, createdAt: row.created_at, updatedAt: row.updated_at, projectId: row.workspace_project_id ?? null, projectTitle: row.workspace_title ?? null, planMode: planModeForSession(row) };
}

export interface AiSessionProjectContext { id: string; appId: Extract<ApplicationId, "workspace" | "minecraft">; nodeId: string; path: string; title: string }

/** 私有执行上下文不通过会话展示 API 返回，工具调用必须始终绑定该会话记录。 */
export function getAiSessionWorkspaceContext(userId: string, sessionId: string): AiSessionProjectContext | null {
  const row = sessionRow(userId, sessionId);
  if (!row || row.app_id !== "workspace" && row.app_id !== "minecraft" || !row.workspace_project_id || !row.workspace_node_id || !row.workspace_directory || !row.workspace_title) return null;
  return { id: row.workspace_project_id, appId: row.app_id, nodeId: row.workspace_node_id, path: row.workspace_directory, title: row.workspace_title };
}

/** 只有空闲的通用 AI 会话可改绑；目录注册与会话历史是独立记录。 */
export function setAiSessionProject(userId: string, sessionId: string, project: AiSessionProjectContext | null): AiSessionView | null {
  const row = sessionRow(userId, sessionId);
  if (!row || row.app_id !== "workspace" && row.app_id !== "minecraft" || project && project.appId !== row.app_id || messageRows(sessionId).some(message => message.role === "assistant" && (message.status === "queued" || message.status === "streaming"))) return null;
  const updated: SessionRow = {
    ...row,
    workspace_project_id: project?.id ?? null,
    workspace_node_id: project?.nodeId ?? null,
    workspace_directory: project?.path ?? null,
    workspace_title: project?.title ?? null,
    updated_at: new Date().toISOString()
  };
  commitSessionChanges(userId, sessionId, [change("ai_sessions", updated)], [eventSpec("session/project", {
    projectId: updated.workspace_project_id ?? null,
    nodeId: updated.workspace_node_id ?? null,
    directory: updated.workspace_directory ?? null,
    title: updated.workspace_title ?? null
  })]);
  return mapSession(updated);
}

function mapMessage(row: MessageRow, feedback?: AiMessageFeedbackView): AiMessageView {
  let activity: AiActivityItem[] = [];
  try {
    const value: unknown = JSON.parse(row.activity_json);
    if (Array.isArray(value)) activity = value.filter(isAiActivityItem);
  } catch {
    // 单条消息的旧版或损坏活动 JSON 回退为空，不影响会话文本读取。
  }
  return { id: row.id, role: row.role, content: row.content, status: row.status, createdAt: row.created_at, activity, ...(feedback ? { feedback } : {}) };
}

function mapMessageFeedback(event: Extract<SessionEvent, { type: "message/feedback" }>): AiMessageFeedbackView {
  return { rating: event.data.rating, reasons: [...event.data.reasons], detail: event.data.detail, submittedAt: event.time };
}

function isAiActivityItem(value: unknown): value is AiActivityItem {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string"
    && ["status", "skill", "tool", "command", "agent", "question"].includes(String(item.kind))
    && typeof item.title === "string"
    && ["running", "approval_required", "waiting_input", "complete", "error", "unavailable"].includes(String(item.status))
    && typeof item.detail === "string"
    && typeof item.startedAt === "string"
    && (item.completedAt === null || typeof item.completedAt === "string")
    && (item.durationMs === null || (typeof item.durationMs === "number" && Number.isFinite(item.durationMs) && item.durationMs >= 0))
    && (item.approvalId === undefined || typeof item.approvalId === "string")
    && (item.questionId === undefined || typeof item.questionId === "string")
    && (item.question === undefined || typeof item.question === "string" && item.question.length <= 1200)
    && (item.options === undefined || Array.isArray(item.options) && item.options.length >= 2 && item.options.length <= 4 && item.options.every(option => typeof option === "string" && option.length > 0 && option.length <= 200))
    && (item.writingProposalId === undefined || typeof item.writingProposalId === "string" && /^[0-9a-f-]{36}$/iu.test(item.writingProposalId));
}

function sessionRow(userId: string, sessionId: string): SessionRow | undefined {
  const row = sessionRecords.get("ai_sessions", sessionId) as SessionRow | undefined;
  return row?.user_id === userId ? row : undefined;
}

function messageRows(sessionId: string, displayOnly = false): MessageRow[] {
  // 展示投影不复制 model_history 的内部工具参数/输出；模型恢复继续读取完整权威记录。
  const fields = displayOnly ? ["id", "session_id", "_order", "role", "content", "status", "created_at", "activity_json"] : undefined;
  return (sessionRecords.allForSession("ai_messages", sessionId, fields) as MessageRow[])
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
  const session = sessionRow(userId, sessionId);
  if (!session) return null;
  const kernel = ensureSessionEventLog(session);
  const feedbackByMessage = new Map<string, AiMessageFeedbackView>();
  for (const event of kernel.events) {
    if (event.type === "message/feedback") feedbackByMessage.set(event.data.messageId, mapMessageFeedback(event));
  }
  return messageRows(sessionId, true).slice(-500).map(row => mapMessage(row, feedbackByMessage.get(row.id)));
}

/** 每条已完成助手消息接受一次有界反馈，并从唯一 Session 事件日志投影给会话 Owner。 */
export function submitAiMessageFeedback(userId: string, sessionId: string, messageId: string, input: AiMessageFeedbackInput): AiMessageFeedbackView | null {
  const session = sessionRow(userId, sessionId);
  if (!session) return null;
  const message = messageRows(sessionId, true).find(row => row.id === messageId);
  if (!message || message.role !== "assistant" || message.status !== "complete") return null;
  const reasons = input?.reasons;
  const detail = typeof input?.detail === "string" ? input.detail.trim() : "";
  if (!input || !["positive", "negative"].includes(input.rating) || !Array.isArray(reasons) || reasons.length > 6
    || reasons.some(reason => typeof reason !== "string" || !reason.trim() || reason.length > 80)
    || new Set(reasons).size !== reasons.length || detail.length > 2000 || !reasons.length && !detail) {
    throw new Error("回答反馈内容无效或超出长度限制。");
  }
  const kernel = ensureSessionEventLog(session);
  const previous = [...kernel.events].reverse().find((event): event is Extract<SessionEvent, { type: "message/feedback" }> => event.type === "message/feedback" && event.data.messageId === messageId);
  if (previous) return mapMessageFeedback(previous);
  appendAiSessionEvents(userId, sessionId, [eventSpec("message/feedback", {
    messageId,
    rating: input.rating,
    reasons: reasons.map(reason => reason.trim()),
    detail
  })]);
  const saved = [...kernel.events].reverse().find((event): event is Extract<SessionEvent, { type: "message/feedback" }> => event.type === "message/feedback" && event.data.messageId === messageId);
  return saved ? mapMessageFeedback(saved) : null;
}

export function getAiSession(userId: string, sessionId: string): AiSessionView | null {
  const row = sessionRow(userId, sessionId);
  if (row) ensureSessionEventLog(row);
  return row ? mapSession(row) : null;
}

export function saveAiAssistantActivity(userId: string, sessionId: string, messageId: string, activity: AiActivityItem[]): void {
  if (!sessionRow(userId, sessionId)) return;
  const message = sessionRecords.get("ai_messages", messageId) as MessageRow | undefined;
  if (message?.session_id !== sessionId || message.role !== "assistant") return;
  commitSessionChanges(userId, sessionId, [change("ai_messages", { ...message, activity_json: JSON.stringify(activity) })], [
    eventSpec("activity/change", { runId: messageId, messageId, activity })
  ]);
}

export function setAiSessionArchived(userId: string, sessionId: string, archived: boolean): AiSessionView | null {
  const row = sessionRow(userId, sessionId);
  if (!row) return null;
  const updated = { ...row, archived: Number(archived), updated_at: new Date().toISOString() };
  commitSessionChanges(userId, sessionId, [change("ai_sessions", updated)], [eventSpec("session/archived", { archived })]);
  return mapSession(updated);
}

export interface AiTurnRows {
  session: AiSessionView;
  userMessage: AiMessageView;
  assistantMessage: AiMessageView;
  history: AiModelMessage[];
}

export function createAiTurn(userId: string, appId: ApplicationId, sessionId: string | null, content: string, queued = false, project: AiSessionProjectContext | null = null): AiTurnRows {
  const now = new Date().toISOString();
  const id = sessionId ?? randomUUID();
  const existing = sessionId ? sessionRow(userId, sessionId) : undefined;
  if (sessionId && (!existing || existing.app_id !== appId)) throw new Error("找不到此应用下的 AI 会话。");
  if (existing?.archived === 1) throw new Error("已归档会话不能继续对话，请先恢复会话。");
  if (!queued && messageRows(id).some(row => row.role === "assistant" && (row.status === "streaming" || row.status === "queued"))) throw new Error("此会话仍有活动任务，请先跟随或停止当前任务。");
  if (existing) ensureSessionEventLog(existing);
  const session: SessionRow = existing ? { ...existing, updated_at: now } : {
    id, user_id: userId, app_id: appId, title: content.trim().replace(/\s+/gu, " ").slice(0, 72) || "新对话",
    archived: 0, created_at: now, updated_at: now,
    workspace_project_id: project?.id ?? null,
    workspace_node_id: project?.nodeId ?? null,
    workspace_directory: project?.path ?? null,
    workspace_title: project?.title ?? null
  };
  const previous = messageRows(id);
  const ordinal = previous.reduce((max, row) => Math.max(max, row._order), 0);
  const userMessage: MessageRow = { id: randomUUID(), session_id: id, role: "user", content, status: "complete", created_at: now, activity_json: "[]", _order: ordinal + 1 };
  const assistantMessage: MessageRow = { id: randomUUID(), session_id: id, role: "assistant", content: "", status: queued ? "queued" : "streaming", created_at: now, activity_json: "[]", _order: ordinal + 2 };
  // 一轮输入和预留回复在同一个刷盘事件中提交，不能只留下半轮消息。
  const specs: SessionEventSpec[] = [];
  if (!existing) {
    specs.push(eventSpec("session/created", { ownerId: userId, appId, createdAt: now }, now));
    specs.push(eventSpec("session/title", { title: session.title }, now));
    specs.push(eventSpec("session/project", { projectId: session.workspace_project_id ?? null, nodeId: session.workspace_node_id ?? null, directory: session.workspace_directory ?? null, title: session.workspace_title ?? null }, now));
  }
  if (!queued) specs.push(eventSpec("turn/start", { turnId: assistantMessage.id, userMessageId: userMessage.id, assistantMessageId: assistantMessage.id }, now));
  specs.push(eventSpec("user/message", { messageId: userMessage.id, content }, now));
  specs.push(eventSpec("assistant/message", { messageId: assistantMessage.id, content: "", status: assistantMessage.status, runId: assistantMessage.id }, now));
  const initialEvents = sessionEventChanges(id, specs, { userId, appId });
  sessionRecords.commit(id, [change("ai_sessions", session), change("ai_messages", userMessage), change("ai_messages", assistantMessage), ...initialEvents]);
  if (!queued) activeSessionRuns.add(id);
  const history = historyForTurn(id, assistantMessage.id, userMessage._order);
  return { session: mapSession(session), userMessage: mapMessage(userMessage), assistantMessage: mapMessage(assistantMessage), history };
}

function historyForTurn(sessionId: string, messageId: string, userOrder: number): AiModelMessage[] {
  const ordered = messageRows(sessionId).filter(row => row._order <= userOrder).slice(-40);
  const history: AiModelMessage[] = ordered.filter(row => row.id !== messageId).flatMap(row => {
    if (row.run_id && ordered.some(parent => parent.id === row.run_id && parent.status === "complete")) return [];
    if (row.role === "user") return [{ role: "user" as const, content: row.content }];
    if (row.status === "queued") return [];
    if (row.status === "complete") {
      // 原始工具协议留在持久化记录中；新一轮只复用用户对话、轮内引导和最终答复，避免重复发送历史工具大结果。
      const modelHistory = authoritativeModelHistory(row);
      const clarificationQuestions = new Map<string, string>();
      for (const message of modelHistory) {
        if (message.role !== "assistant") continue;
        for (const call of message.tool_calls ?? []) {
          if (call.function.name !== "lfaa_ask_user") continue;
          try {
            const args: unknown = JSON.parse(call.function.arguments);
            if (typeof args === "object" && args !== null && !Array.isArray(args)) {
              const question = (args as Record<string, unknown>).question;
              if (typeof question === "string" && question.length <= 1200) clarificationQuestions.set(call.id, question);
            }
          } catch {
            // 历史澄清参数损坏时不阻断会话恢复；原始数据仍留在模型记录中。
          }
        }
      }
      const priorUserInputs: AiModelMessage[] = [];
      for (const message of modelHistory) {
        if (message.role === "user" && typeof message.content === "string") {
          priorUserInputs.push({ role: "user", content: message.content });
          continue;
        }
        const question = message.role === "tool" && message.tool_call_id ? clarificationQuestions.get(message.tool_call_id) : undefined;
        if (!question || typeof message.content !== "string") continue;
        try {
          const response: unknown = JSON.parse(message.content);
          if (typeof response !== "object" || response === null || Array.isArray(response)) continue;
          const answer = (response as Record<string, unknown>).answer;
          const skipped = (response as Record<string, unknown>).skipped === true;
          if (typeof answer === "string" && answer.length <= 12000 && answer.trim()) {
            priorUserInputs.push({ role: "user", content: `此前澄清问题“${question}”的回答：${answer}` });
          } else if (skipped) {
            priorUserInputs.push({ role: "user", content: `你此前跳过了澄清问题“${question}”。` });
          }
        } catch {
          // 无法验证的历史工具返回体不会伪装成用户回答。
        }
      }
      return [...priorUserInputs, { role: "assistant" as const, content: row.content }];
    }
    // 中断记录可能包含无结果的副作用，禁止将其当成完整协议或成功操作恢复。
    return [{ role: "assistant" as const, content: `${row.content}\n本轮执行已中断或失败；工具状态未确认时必须先查询，不得重放副作用。` }];
  });
  return history;
}

/** 排队任务开始时重新投影已完成对话；当前运行内的真实工具结果仍由 Agent Loop 保留。 */
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
  commitSessionChanges(userId, run.sessionId, [change("ai_messages", input)], [eventSpec("user/message", { messageId: input.id, content, runId })]);
  return mapMessage(input);
}

export function finishAiAssistantMessage(userId: string, sessionId: string, messageId: string, content: string, status: AiMessageView["status"]): void {
  const session = sessionRow(userId, sessionId);
  const message = sessionRecords.get("ai_messages", messageId) as MessageRow | undefined;
  if (!session || message?.session_id !== sessionId || message.role !== "assistant") return;
  const updatedAt = new Date().toISOString();
  const kernel = ensureSessionEventLog(session);
  const before = kernel.length;
  kernel.append("assistant/message", { messageId, content, status, runId: messageId });
  if (status === "complete" || status === "interrupted" || status === "error") {
    const open = kernel.hasOpenTurn(messageId);
    if (open && status === "complete") kernel.append("turn/end", { turnId: messageId, status: "complete" });
    else if (open) kernel.repairOpenTail("interrupted");
  }
  const eventChanges = kernel.eventsAfter(before).map(event => ({ table: "session_events" as const, key: event.id, value: { ...event, session_id: event.sessionId, user_id: userId, app_id: session.app_id } }));
  sessionRecords.commit(sessionId, [change("ai_messages", { ...message, content, status }), change("ai_sessions", { ...session, updated_at: updatedAt }), ...eventChanges]);
  if (status === "complete" || status === "interrupted" || status === "error") activeSessionRuns.delete(sessionId);
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
  commitSessionChanges(userId, sessionId, [change("ai_usage", row)], [eventSpec("usage/record", { runId: messageId, providerId, modelId, promptTokens, completionTokens }, row.created_at)]);
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
