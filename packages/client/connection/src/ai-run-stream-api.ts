/**
 * AI Run SSE 请求、事件解析与断线重连适配。
 * Session 与 Agent Loop 仍拥有事件状态和执行语义；本模块只管理浏览器连接与客户端事件转发。
 */
import { ApiError, authenticationGeneration, handleSessionAuthenticationFailure, isSessionAuthenticationError } from "./http-client.js";
import { isNonnegativeSafeInteger, readAiSessionUsageSummary, readAiContextUsage } from "./ai-session-api.js";
import type { AiTextDelta, AiReplyPart, AiSessionUsageSummary, AiContextUsage, AiActivityItem, AiMessage, AiSession } from "./ai-session-api.js";
import type { AiRunPauseState } from "./ai-run-control-api.js";
import { createStreamDeltas } from "./stream-deltas.js";
import type { AgentAssociations } from "lfaa-util-values/src/agent-associations.js";
import type { ApplicationId, WorkspaceProjectContextApplicationId } from "lfaa-util-values/src/application-id.js";
type AiChatStreamInput = {
  runId?: string;
  associations?: AgentAssociations;
  appId: ApplicationId;
  contextApplicationId?: WorkspaceProjectContextApplicationId | null;
  sessionId: string | null;
  projectId?: string | null;
  gitRepositoryId?: string | null;
  /** 附件只传 ID；连接层必须显式转发，否则会被丢弃。 */
  attachmentIds?: string[];
  attachments?: Array<{ id: string; name?: string }>;
  /** 当前工作台视图提示；只随新 Run 请求发送，不进入 Session 消息或工具权限范围。 */
  workspaceView?: AiWorkbenchView;
  content: string;
  planMode?: boolean;
  signal: AbortSignal;
  onSession: (value: { session: AiSession; userMessage: AiMessage; assistantMessage: AiMessage }) => void;
  onPauseState?: (value: { runId: string; state: AiRunPauseState }) => void;
  onPlanMode?: (active: boolean) => void;
  /** 能力 Owner 修改设置后只发失效信号，客户端从认证 Settings API 对账。 */
  onSettingsInvalidated?: () => void;
  onInput?: (message: AiMessage) => void;
  onActivity: (value: { messageId: string; activity: AiActivityItem }) => void;
  onPromptSuggestions?: (value: { messageId: string; suggestions: string[] }) => void;
  onDelta: (value: AiTextDelta) => void;
  /** 外部子 Agent 顶层助手文本的瞬时流；重新订阅时不重放，也不写入会话。 */
  onSubagentDelta?: (value: { messageId: string; activityId: string; delta: string }) => void;
  onPresentation?: (value: { messageId: string; parts: AiReplyPart[] }) => void;
  onUsage: (value: { messageId: string; promptTokens: number | null; completionTokens: number | null; cacheReadTokens: number | null; providerId: string; modelId: string; models?: Array<{ providerId: string; modelId: string; requestCount: number }>; sessionUsage?: AiSessionUsageSummary }) => void;
  onUsageProgress?: (value: { messageId: string; sessionUsage: AiSessionUsageSummary }) => void;
  onContextUsage?: (value: { messageId: string; contextUsage: AiContextUsage }) => void;
  onError: (message: string) => void;
  onDone: (status: "complete" | "interrupted" | "error") => void;
};

export type AiWorkbenchView = {
  rightPane: "browser" | "new-tab" | "git" | "assets" | "applications" | "side-chat" | "extension" | "project-file" | "application-tools";
  rightPaneOpen: boolean;
  bottomTerminalOpen: boolean;
  /** 仅当前选中且可见的 LFAA Browser Dock 标签；服务端还会按 browserUse 设置裁剪。 */
  browserUrl?: string;
  /** 当前 App 画布路由中的短期定位信息；仅供 Agent 识别画布，不代替 Owner 读取版本或授权。 */
  canvas?: { applicationId: ApplicationId; projectId: string; title: string; updatedAt: string };
  /** 当前 App 工作流路由中的短期定位信息；仅供 Agent 识别工作流，不代替 Owner 读取版本或授权。 */
  workflow?: { applicationId: ApplicationId; workflowId: string; title: string; updatedAt: string };
  /** 当前领域 App 正在编辑的项目；只供 Agent 选择领域 Owner 工具的项目 ID，不包含正文或授权。 */
  applicationProject?: { applicationId: ApplicationId; projectId: string; title: string; updatedAt: string };
};

export function streamAiChat(input: AiChatStreamInput): Promise<void> {
  return streamAiChatAt(input, "/api/ai/chat/stream");
}

export function streamAiSideChat(input: AiChatStreamInput): Promise<void> {
  return streamAiChatAt(input, "/api/ai/side-chat/stream");
}

const AI_RUN_STREAM_RECONNECT_BASE_MS = 250;
const AI_RUN_STREAM_RECONNECT_MAX_MS = 8_000;

function waitForAiRunStreamReconnect(signal: AbortSignal, attempt: number): Promise<boolean> {
  const delay = Math.min(AI_RUN_STREAM_RECONNECT_BASE_MS * 2 ** Math.min(attempt, 5), AI_RUN_STREAM_RECONNECT_MAX_MS);
  return new Promise(resolve => {
    let timer: ReturnType<typeof setTimeout>;
    const finish = (continueStreaming: boolean): void => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      resolve(continueStreaming);
    };
    const abort = (): void => finish(false);
    timer = setTimeout(() => finish(true), delay);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
}

function isRetryableAiRunStreamStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function streamAiChatAt(input: AiChatStreamInput, streamEndpoint: string): Promise<void> {
  let activeRunId = input.runId ?? null;
  let reconnectAttempt = 0;
  const deltas = createStreamDeltas(input.onDelta);
  const cancelDeltas = () => deltas.dispose();
  input.signal.addEventListener("abort", cancelDeltas, { once: true });
  try {
    while (!input.signal.aborted) {
      let response: Response;
      const requestPath = activeRunId
        ? `/ai/runs/${encodeURIComponent(activeRunId)}/events`
        : streamEndpoint.startsWith("/api/") ? streamEndpoint.slice(4) : streamEndpoint;
      const requestGeneration = authenticationGeneration;
      try {
        response = await fetch(activeRunId ? `/api/ai/runs/${encodeURIComponent(activeRunId)}/events` : streamEndpoint, {
          method: activeRunId ? "GET" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          ...(!activeRunId ? { body: JSON.stringify({ appId: input.appId, sessionId: input.sessionId, ...(input.contextApplicationId === undefined ? {} : { contextApplicationId: input.contextApplicationId }), ...(input.associations ? { associations: input.associations } : {}), ...(input.attachmentIds?.length ? { attachmentIds: input.attachmentIds } : {}), ...(input.attachments?.length ? { attachments: input.attachments } : {}), ...(input.projectId ? { projectId: input.projectId } : {}), ...(!input.sessionId && input.gitRepositoryId ? { gitRepositoryId: input.gitRepositoryId } : {}), ...(input.planMode === undefined ? {} : { planMode: input.planMode }), ...(input.workspaceView ? { workspaceView: input.workspaceView } : {}), content: input.content }) } : {}),
          signal: input.signal
        });
      } catch (error) {
        if (input.signal.aborted) return;
        if (!activeRunId) throw error;
        if (!await waitForAiRunStreamReconnect(input.signal, reconnectAttempt++)) return;
        continue;
      }

      if (!response.ok) {
        let result: { message?: string; error?: string } = {};
        try { result = await response.json() as typeof result; } catch { /* 非 JSON 错误由通用 API 错误承载。 */ }
        if (isSessionAuthenticationError(response.status, result.error)) handleSessionAuthenticationFailure(requestPath, requestGeneration);
        if (activeRunId && isRetryableAiRunStreamStatus(response.status)) {
          if (!await waitForAiRunStreamReconnect(input.signal, reconnectAttempt++)) return;
          continue;
        }
        throw new ApiError(response.status, result.message ?? "AI Work 请求失败，请重试。", result.error);
      }

      if (!response.body) {
        if (!activeRunId) throw new ApiError(response.status, "浏览器无法读取 AI Work 流式响应。");
        if (!await waitForAiRunStreamReconnect(input.signal, reconnectAttempt++)) return;
        continue;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let eventName = "message";
      let dataLines: string[] = [];
      let doneReceived = false;
      const dispatch = () => {
        if (dataLines.length === 0) { eventName = "message"; return; }
        let payload: Record<string, unknown>;
        try { payload = JSON.parse(dataLines.join("\n")) as Record<string, unknown>; }
        catch { eventName = "message"; dataLines = []; return; }
        if (input.signal.aborted) { eventName = "message"; dataLines = []; return; }
        if (eventName !== "delta") deltas.flush();
        if (eventName === "input" && payload.userMessage) input.onInput?.(payload.userMessage as AiMessage);
        if (eventName === "session") {
          const assistantMessage = payload.assistantMessage as AiMessage | undefined;
          const messageRunId = typeof assistantMessage?.id === "string" ? assistantMessage.id : null;
          const declaredRunId = typeof payload.runId === "string" ? payload.runId : null;
          if (activeRunId && ((messageRunId !== null && activeRunId !== messageRunId) || (declaredRunId !== null && activeRunId !== declaredRunId))) throw new ApiError(502, "AI Work 事件流返回了不同的任务，已停止跟随。");
          if (!activeRunId) activeRunId = messageRunId ?? declaredRunId;
          input.onSession(payload as unknown as Parameters<typeof input.onSession>[0]);
        }
        if (eventName === "pause-state" && typeof payload.runId === "string"
          && (payload.state === "running" || payload.state === "pausing" || payload.state === "paused")) {
          if (activeRunId && activeRunId !== payload.runId) throw new ApiError(502, "AI Work 暂停状态属于其他任务，已停止跟随。");
          input.onPauseState?.({ runId: payload.runId, state: payload.state });
        }
        if (eventName === "plan-mode" && typeof payload.active === "boolean") input.onPlanMode?.(payload.active);
        if (eventName === "capability-settings" && payload.changed === true) input.onSettingsInvalidated?.();
        if (eventName === "activity" && typeof payload.messageId === "string" && typeof payload.activity === "object" && payload.activity !== null) {
          input.onActivity({ messageId: payload.messageId, activity: payload.activity as AiActivityItem });
        }
        if (eventName === "prompt-suggestions" && typeof payload.messageId === "string" && Array.isArray(payload.suggestions)) {
          const suggestions = payload.suggestions.flatMap(value => typeof value === "string" && value.trim().length > 0 && [...value].length <= 180 ? [value] : []).slice(0, 3);
          if (suggestions.length) input.onPromptSuggestions?.({ messageId: payload.messageId, suggestions });
        }
        if (eventName === "delta" && typeof payload.messageId === "string" && typeof payload.delta === "string") deltas.push({ messageId: payload.messageId, delta: payload.delta, ...(typeof payload.partId === "string" && typeof payload.partStart === "number" ? { partId: payload.partId, partStart: payload.partStart } : {}) });
        if (eventName === "subagent-delta" && typeof payload.messageId === "string" && typeof payload.activityId === "string"
          && typeof payload.delta === "string" && payload.delta.length <= 2048 && activeRunId === payload.messageId) {
          input.onSubagentDelta?.({ messageId: payload.messageId, activityId: payload.activityId, delta: payload.delta });
        }
        if (eventName === "presentation" && typeof payload.messageId === "string" && Array.isArray(payload.parts)) input.onPresentation?.({ messageId: payload.messageId, parts: payload.parts as AiReplyPart[] });
        if (eventName === "usage" && typeof payload.providerId === "string" && typeof payload.modelId === "string") {
          const sessionUsage = readAiSessionUsageSummary(payload.sessionUsage);
          const models = Array.isArray(payload.models) ? payload.models.slice(0, 64).flatMap(value => {
            if (!value || typeof value !== "object" || Array.isArray(value)) return [];
            const model = value as Record<string, unknown>;
            return typeof model.providerId === "string" && model.providerId.length <= 160 && typeof model.modelId === "string" && model.modelId.length <= 160 && isNonnegativeSafeInteger(model.requestCount)
              ? [{ providerId: model.providerId, modelId: model.modelId, requestCount: model.requestCount }]
              : [];
          }) : [];
          input.onUsage({ messageId: typeof payload.messageId === "string" ? payload.messageId : "", promptTokens: typeof payload.promptTokens === "number" ? payload.promptTokens : null, completionTokens: typeof payload.completionTokens === "number" ? payload.completionTokens : null, cacheReadTokens: typeof payload.cacheReadTokens === "number" ? payload.cacheReadTokens : null, providerId: payload.providerId, modelId: payload.modelId, ...(models.length ? { models } : {}), ...(sessionUsage ? { sessionUsage } : {}) });
        }
        if (eventName === "usage-progress" && typeof payload.messageId === "string") {
          const sessionUsage = readAiSessionUsageSummary(payload.sessionUsage);
          if (sessionUsage) input.onUsageProgress?.({ messageId: payload.messageId, sessionUsage });
        }
        if (eventName === "context-usage" && typeof payload.messageId === "string") {
          const contextUsage = readAiContextUsage(payload.contextUsage);
          if (contextUsage) input.onContextUsage?.({ messageId: payload.messageId, contextUsage });
        }
        if (eventName === "error" && typeof payload.message === "string") input.onError(payload.message);
        if (eventName === "done" && (payload.status === "complete" || payload.status === "interrupted" || payload.status === "error")) {
          doneReceived = true;
          input.onDone(payload.status);
        }
        eventName = "message";
        dataLines = [];
      };
      const processLine = (line: string): void => {
        if (line === "") dispatch();
        else if (line.startsWith("event:")) eventName = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
      };
      let readError: unknown;
      const connectedAt = Date.now();
      try {
        while (!input.signal.aborted && !doneReceived) {
          let chunk: ReadableStreamReadResult<Uint8Array>;
          try { chunk = await reader.read(); }
          catch (error) { readError = error; break; }
          if (chunk.done) break;
          buffer += decoder.decode(chunk.value, { stream: true });
          let newline = buffer.indexOf("\n");
          while (newline >= 0 && !doneReceived) {
            processLine(buffer.slice(0, newline).replace(/\r$/u, ""));
            buffer = buffer.slice(newline + 1);
            newline = buffer.indexOf("\n");
          }
        }
        buffer += decoder.decode();
        if (buffer) processLine(buffer.replace(/\r$/u, ""));
        dispatch();
      } finally {
        if (doneReceived) void reader.cancel().catch(() => undefined);
        try { reader.releaseLock(); } catch { /* 断流时读取请求可能仍在撤销；下一轮使用新的响应流。 */ }
      }

      if (input.signal.aborted) return;
      deltas.flush();
      if (doneReceived) return;
      if (!activeRunId) {
        if (readError instanceof Error) throw readError;
        throw new ApiError(response.status, "AI Work 流在确认任务结束前断开，当前任务 ID 尚未收到；请重新载入会话恢复。", "ai_run_stream_ended");
      }
      if (Date.now() - connectedAt >= 30_000) reconnectAttempt = 0;
      if (!await waitForAiRunStreamReconnect(input.signal, reconnectAttempt++)) return;
    }
  } finally {
    if (!input.signal.aborted) deltas.flush();
    deltas.dispose();
    input.signal.removeEventListener("abort", cancelDeltas);
  }
}

