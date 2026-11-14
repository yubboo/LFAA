/**
 * Session/消息/用量的 Connection DTO 与认证端点。持久化和 Run 执行仍由 Session/Agent Loop Owner 持有。
 */
import { request } from "./http-client.js";
import type { AgentAssociations } from "lfaa-util-values/src/agent-associations.js";
import type { ApplicationId, WorkspaceProjectContextApplicationId } from "lfaa-util-values/src/application-id.js";
import type { BrowserProviderId } from "lfaa-util-values/src/browser-provider.js";
import type { WorkspaceProjectApplicationId } from "./workspace-types.js";



export function readAiContextUsage(value: unknown): AiContextUsage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.providerId !== "string" || typeof row.modelId !== "string"
    || !(row.contextWindow === null || isNonnegativeSafeInteger(row.contextWindow) && row.contextWindow > 0)
    || !(row.contextWindowSource === "model-catalog" || row.contextWindowSource === "settings-fallback" || row.contextWindowSource === "unknown")
    || !(row.promptTokens === null || isNonnegativeSafeInteger(row.promptTokens))
    || !isNonnegativeSafeInteger(row.estimatedPromptTokens) || !isNonnegativeSafeInteger(row.systemTokens)
    || !isNonnegativeSafeInteger(row.toolsTokens) || !isNonnegativeSafeInteger(row.messageTokens) || typeof row.includesImages !== "boolean") return null;
  return { providerId: row.providerId, modelId: row.modelId, contextWindow: row.contextWindow, contextWindowSource: row.contextWindowSource, promptTokens: row.promptTokens, estimatedPromptTokens: row.estimatedPromptTokens, systemTokens: row.systemTokens, toolsTokens: row.toolsTokens, messageTokens: row.messageTokens, includesImages: row.includesImages };
}


export function readAiSessionUsageSummary(value: unknown): AiSessionUsageSummary | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (!isNonnegativeSafeInteger(row.requestCount) || !(row.requestCountExact === undefined || typeof row.requestCountExact === "boolean") || !(row.promptTokens === null || isNonnegativeSafeInteger(row.promptTokens))
    || !(row.completionTokens === null || isNonnegativeSafeInteger(row.completionTokens))
    || !(row.cacheReadTokens === null || isNonnegativeSafeInteger(row.cacheReadTokens)) || !Array.isArray(row.models)) return null;
  const models: AiSessionUsageModelSummary[] = [];
  for (const candidate of row.models) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
    const model = candidate as Record<string, unknown>;
    if (typeof model.providerId !== "string" || typeof model.modelId !== "string" || !isNonnegativeSafeInteger(model.requestCount)
      || !(model.requestCountExact === undefined || typeof model.requestCountExact === "boolean")
      || !(model.promptTokens === null || isNonnegativeSafeInteger(model.promptTokens))
      || !(model.completionTokens === null || isNonnegativeSafeInteger(model.completionTokens))
      || !(model.cacheReadTokens === null || isNonnegativeSafeInteger(model.cacheReadTokens))
      || !(model.cacheReadReportedTokens === undefined || model.cacheReadReportedTokens === null || isNonnegativeSafeInteger(model.cacheReadReportedTokens))
      || !(model.cacheReadReportedRequestCount === undefined || model.cacheReadReportedRequestCount === null || isNonnegativeSafeInteger(model.cacheReadReportedRequestCount))) return null;
    models.push({ providerId: model.providerId, modelId: model.modelId, requestCount: model.requestCount, requestCountExact: model.requestCountExact === true, promptTokens: model.promptTokens, completionTokens: model.completionTokens, cacheReadTokens: model.cacheReadTokens, cacheReadReportedTokens: model.cacheReadReportedTokens === undefined ? null : model.cacheReadReportedTokens, cacheReadReportedRequestCount: model.cacheReadReportedRequestCount === undefined ? null : model.cacheReadReportedRequestCount });
  }
  return { requestCount: row.requestCount, requestCountExact: row.requestCountExact === true, promptTokens: row.promptTokens, completionTokens: row.completionTokens, cacheReadTokens: row.cacheReadTokens, models };
}


export function isNonnegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}


export function loadAiUsage(): Promise<{ usage: AiUsageSummary }> {
  return request<{ usage: AiUsageSummary }>("/ai/usage");
}


export function setAiSessionPlanMode(sessionId: string, active: boolean): Promise<{ session: AiSession }> {
  return request<{ session: AiSession }>(`/ai/sessions/${encodeURIComponent(sessionId)}/plan-mode`, { method: "PATCH", body: JSON.stringify({ active }) });
}


export function setAiSessionProject(sessionId: string, projectId: string | null, appId: WorkspaceProjectApplicationId): Promise<{ session: AiSession }> {
  return request<{ session: AiSession }>(`/workspace/sessions/${encodeURIComponent(sessionId)}/project`, { method: "PATCH", body: JSON.stringify({ appId, projectId }) });
}


export function generateAiSessionTitle(sessionId: string): Promise<{ session: AiSession; generated: boolean }> {
  return request<{ session: AiSession; generated: boolean }>(`/ai/sessions/${encodeURIComponent(sessionId)}/title/generate`, { method: "POST" });
}


export function renameAiSession(sessionId: string, title: string): Promise<{ session: AiSession }> {
  return request<{ session: AiSession }>(`/ai/sessions/${encodeURIComponent(sessionId)}/title`, { method: "PATCH", body: JSON.stringify({ title }) });
}


export function archiveAiSession(sessionId: string, archived: boolean): Promise<{ session: AiSession }> {
  return request<{ session: AiSession }>(`/ai/sessions/${encodeURIComponent(sessionId)}/archive`, { method: "PATCH", body: JSON.stringify({ archived }) });
}


export function openAiSideChatSession(sourceSessionId: string): Promise<{ session: AiSession }> {
  return request<{ session: AiSession }>(`/ai/sessions/${encodeURIComponent(sourceSessionId)}/side-chat`, { method: "POST" });
}


export function createAiSessionBranchFromMessageInWorktree(sessionId: string, messageId: string, targetProjectId: string, appId: WorkspaceProjectApplicationId): Promise<{ session: AiSession }> {
  return request<{ session: AiSession }>(`/workspace/sessions/${encodeURIComponent(sessionId)}/fork`, { method: "POST", body: JSON.stringify({ appId, messageId, targetProjectId }) });
}


export function forkAiSessionBeforeUserMessage(sessionId: string, messageId: string): Promise<{ session: AiSession }> {
  return request<{ session: AiSession }>(`/ai/sessions/${encodeURIComponent(sessionId)}/fork-before-message`, { method: "POST", body: JSON.stringify({ messageId }) });
}


export function createAiSessionBranchFromMessage(sessionId: string, messageId: string): Promise<{ session: AiSession }> {
  return request<{ session: AiSession }>(`/ai/sessions/${encodeURIComponent(sessionId)}/fork`, { method: "POST", body: JSON.stringify({ messageId }) });
}


export function submitAiMessageFeedback(sessionId: string, messageId: string, feedback: AiMessageFeedbackInput): Promise<{ feedback: AiMessageFeedback }> {
  return request<{ feedback: AiMessageFeedback }>(`/ai/sessions/${encodeURIComponent(sessionId)}/messages/${encodeURIComponent(messageId)}/feedback`, { method: "POST", body: JSON.stringify(feedback) });
}


export function loadAiMessages(sessionId: string, cursor?: string, signal?: AbortSignal): Promise<AiMessagePage> {
  const query = new URLSearchParams({ limit: "50" });
  if (cursor) query.set("cursor", cursor);
  return request<AiMessagePage>(`/ai/sessions/${encodeURIComponent(sessionId)}/messages?${query}`, signal ? { signal } : {});
}


export function loadAiSessions(options: { archived?: boolean; appId?: ApplicationId; signal?: AbortSignal } = {}): Promise<{ sessions: AiSession[] }> {
  const query = new URLSearchParams();
  if (options.archived !== undefined) query.set("archived", String(options.archived));
  if (options.appId) query.set("appId", options.appId);
  return request<{ sessions: AiSession[] }>(`/ai/sessions${query.size ? `?${query}` : ""}`, options.signal ? { signal: options.signal } : {});
}

export function setAiSessionContextApplication(sessionId: string, contextApplicationId: WorkspaceProjectContextApplicationId | null): Promise<{ session: AiSession }> {
  return request(`/ai/sessions/${encodeURIComponent(sessionId)}/application-context`, { method: "PATCH", body: JSON.stringify({ contextApplicationId }) });
}

export function setAiSessionAssociations(sessionId: string, associations: AgentAssociations): Promise<{ session: AiSession }> {
  return request(`/ai/sessions/${encodeURIComponent(sessionId)}/associations`, { method: "PATCH", body: JSON.stringify(associations) });
}


export interface AiUsageSummary {
  requestCount: number;
  promptTokens: number | null;
  completionTokens: number | null;
  providers: Array<{ providerId: string; modelId: string; requestCount: number; promptTokens: number | null; completionTokens: number | null }>;
}


export interface AiActivityFileChange {
  operation: "read" | "created" | "modified" | "deleted";
  path: string;
  projectId: string | null;
  sourceId?: string;
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
  toolId?: `browser-use.${string}`;
  toolUsage?: AiActivityToolUsage;
  toolStages?: AiActivityToolStage[];
  browserProviderId?: BrowserProviderId;
  approvalId?: string;
  approvalQuestion?: string;
  approvalAnswer?: "approved" | "denied" | "expired";
  questionId?: string;
  question?: string;
  options?: string[];
  writingProposalId?: string;
  fileChanges?: AiActivityFileChange[];
  contentOffset?: number;
}


export interface AiActivityToolStage {
  stage: string;
  detail: string;
}


export interface AiActivityToolUsage {
  name: string;
  description: string;
  parameters: Array<{ name: string; type: string; required: boolean; description: string }>;
  parametersTruncated: boolean;
  guidance: string;
}


export interface AiMessageFeedbackInput {
  rating: "positive" | "negative";
  reasons: string[];
  detail: string;
}


export interface AiMessageFeedback {
  rating: "positive" | "negative";
  reasons: string[];
  detail: string;
  submittedAt: string;
}


/** SSE 帧合并后的更新仍按请求分段；老服务未提供边界时保留原显示。 */
export function appendAiTextDelta(message: AiMessage, value: AiTextDelta): AiMessage {
  const content = message.content + value.delta;
  if (!value.partId || !Number.isSafeInteger(value.partStart)) return { ...message, content };
  const parts = (message.parts ?? []).map(part => ({ ...part }));
  const part = parts.find(item => item.id === value.partId);
  if (part) part.end = content.length;
  else parts.push({ id: value.partId, start: value.partStart!, end: content.length, kind: "commentary" });
  return { ...message, content, parts };
}

export interface AiTextDelta { messageId: string; delta: string; partId?: string; partStart?: number }


/** 同一任务各次模型可见正文的范围，正文仍只有一份。 */
export interface AiReplyPart { id: string; start: number; end: number; kind: "commentary" | "final" }


export interface AiMessagePage {
  messages: AiMessage[];
  nextCursor: string | null;
  branchSource?: AiSessionBranchSource;
  usageSummary: AiSessionUsageSummary;
  contextUsage: AiContextUsage | null;
}


export interface AiContextUsage {
  providerId: string;
  modelId: string;
  contextWindow: number | null;
  contextWindowSource: "model-catalog" | "settings-fallback" | "unknown";
  promptTokens: number | null;
  estimatedPromptTokens: number;
  systemTokens: number;
  toolsTokens: number;
  messageTokens: number;
  includesImages: boolean;
}


export interface AiSessionUsageSummary {
  requestCount: number;
  requestCountExact: boolean;
  promptTokens: number | null;
  completionTokens: number | null;
  cacheReadTokens: number | null;
  models: AiSessionUsageModelSummary[];
}


export interface AiSessionUsageModelSummary {
  providerId: string;
  modelId: string;
  requestCount: number;
  requestCountExact: boolean;
  promptTokens: number | null;
  completionTokens: number | null;
  cacheReadTokens: number | null;
  cacheReadReportedTokens: number | null;
  /** Number of requests for which the Provider returned an exact cache-read count; null for older projections. */
  cacheReadReportedRequestCount: number | null;
}


export interface AiMessageUsage {
  providerId: string;
  modelId: string;
  promptTokens: number | null;
  completionTokens: number | null;
  cacheReadTokens: number | null;
  models?: Array<{ providerId: string; modelId: string; requestCount: number }>;
}



export interface AiMessage {
  /** 用户消息携带的附件引用（只有 ID/名称，字节从附件内容接口读取）。 */
  attachments?: Array<{ id: string; name: string; mediaType?: string }>;
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "complete" | "queued" | "streaming" | "interrupted" | "error";
  createdAt: string;
  activity: AiActivityItem[];
  /** Agent 结合本轮最终答复生成的可选后续提问建议。 */
  promptSuggestions?: string[];
  usage?: AiMessageUsage;
  parts?: AiReplyPart[];
  feedback?: AiMessageFeedback;
}


export interface AiSessionBranchSource {
  title: string;
  session: AiSession | null;
}


export interface AiSession {
  associations?: AgentAssociations;
  id: string;
  appId: ApplicationId;
  contextApplicationId: WorkspaceProjectContextApplicationId | null;
  title: string;
  titleStatus?: "pending" | "generated" | "manual" | "legacy";
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  projectId?: string | null;
  projectTitle?: string | null;
  planMode: boolean;
}
