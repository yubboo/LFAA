// 运行动作：发送消息、SSE 事件归并与断线恢复、审批决策、中止、权限模式与排队消息。
import { AgentStreamClient, splitCleanSentenceBoundary } from "./stream-client";
import { fetchJson } from "./chat-http";
import { writeStoredPermissionMode } from "./chat-preferences";
import { playGentleNotificationSound } from "./general-settings-client";
import type { AgentPermissionMode, ChatMessageItem, ChatSessionDetail } from "./chat-types";
import type { ChatStorePort } from "./chat-store-port";

export class ChatRunActions {
  private streamClient: AgentStreamClient | null = null;
  private permissionUpdate = Promise.resolve();

  constructor(private readonly port: ChatStorePort) {}

  removeQueuedMessage(index: number): void {
    const state = this.port.getState();
    this.port.patchState({
      queuedMessages: state.queuedMessages.filter((_, idx) => idx !== index),
    });
  }

  async submitFollowUp(text: string, invertMode = false): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!this.port.getState().runningRunId) {
      await this.sendMessage(trimmed);
      return;
    }
    const baseMode = this.port.getState().generalSettings.followUpMode;
    const effectiveMode = invertMode ? (baseMode === "queue" ? "steer" : "queue") : baseMode;
    if (effectiveMode === "queue") {
      this.port.patchState({ queuedMessages: [...this.port.getState().queuedMessages, trimmed] });
      return;
    }
    await this.abortActiveRun();
    this.port.patchState({ runningRunId: null });
    await this.sendMessage(trimmed);
  }

  setPermissionMode(mode: AgentPermissionMode): Promise<void> {
    const runId = this.port.getState().runningRunId;
    this.permissionUpdate = this.permissionUpdate.then(async () => {
      if (runId && this.port.getState().runningRunId === runId) await this.updateRunPermission(runId, mode);
      writeStoredPermissionMode(mode);
      this.port.patchState({ permissionMode: mode });
    }).catch((error: unknown) => {
      this.port.patchState({ errorMessage: error instanceof Error ? error.message : String(error) });
    });
    return this.permissionUpdate;
  }

  async updateRunPermission(runId: string, mode: AgentPermissionMode): Promise<void> {
    await fetchJson(`/api/agent/runs/${encodeURIComponent(runId)}/permission`, {
      method: "PATCH",
      body: JSON.stringify({ mode }),
    });
  }

  async resetSmartTrust(): Promise<void> {
    const res = await fetchJson<{ counts: Record<string, number> }>("/api/agent/trust", { method: "DELETE" });
    this.port.patchState({ smartTrustCounts: res.counts });
  }

  // 将消息提交到当前或新建会话，随后订阅 Host 为这次运行返回的事件流。
  async sendMessage(text: string, skillIds?: string[]): Promise<void> {
    const trimmed = text.trim();
    const state = this.port.getState();
    if (!trimmed || state.runningRunId || state.submittingMessage) return;
    this.port.patchState({ submittingMessage: true });
    try {
      await this.startMessage(trimmed, skillIds);
    } finally {
      this.port.patchState({ submittingMessage: false });
    }
  }

  private async startMessage(trimmed: string, skillIds?: string[]): Promise<void> {
    this.port.patchState({ errorMessage: "", pendingApproval: null });

    let session = this.port.getState().activeSession;
    if (!session) {
      const created = await fetchJson<{ session: ChatSessionDetail }>("/api/chat/sessions", {
        method: "POST",
        body: JSON.stringify({
          projectId: this.port.getState().draftProjectId,
          sectionId: this.port.getState().draftSectionId,
          sessionPreset: this.port.getState().draftSessionPreset,
        }),
      });
      session = created.session;
      const createdSession = session;
      this.port.patchState({
        activeSessionId: createdSession.id,
        activeSession: createdSession,
        draftSessionPreset: undefined,
        sessions: [createdSession, ...this.port.getState().sessions],
      });
    }

    const startingMode = this.port.getState().permissionMode;
    const started = await fetchJson<{ runId: string; sessionId: string; assistantMessageId: string }>(
      "/api/agent/runs",
      {
        method: "POST",
        body: JSON.stringify({
          sessionId: session.id,
          userMessage: trimmed,
          ...(this.port.getState().activeProfileId ? { profileId: this.port.getState().activeProfileId } : {}),
          reasoningEffort: this.port.getState().reasoningLevel,
          permissionMode: startingMode,
          repeatToolThresholds: this.port.getState().generalSettings.repeatToolThresholds,
          ...(skillIds && skillIds.length > 0 ? { skillIds } : {}),
        }),
      },
    );

    this.port.patchState({ runningRunId: started.runId });
    if (this.port.getState().permissionMode !== startingMode) {
      try {
        await this.updateRunPermission(started.runId, this.port.getState().permissionMode);
      } catch (error) {
        this.port.patchState({ errorMessage: error instanceof Error ? error.message : String(error) });
      }
    }
    const detail = await fetchJson<{ session: ChatSessionDetail }>(`/api/chat/sessions/${encodeURIComponent(session.id)}`);
    this.port.patchState({
      activeSession: detail.session,
      sessions: this.port.getState().sessions.map((s) => (s.id === detail.session.id ? detail.session : s)),
      runningRunId: started.runId,
    });

    this.subscribeRunEvents(started.runId, session.id, started.assistantMessageId);
  }

  // 将 Host 的增量、工具和审批事件归并到当前会话，终止后回收运行状态。
  private subscribeRunEvents(
    runId: string,
    sessionId: string,
    assistantMessageId: string,
  ): void {
    this.streamClient?.dispose();
    const patchAssistant = (updater: (msg: ChatMessageItem) => ChatMessageItem) => {
      const curr = this.port.getState().activeSession;
      if (!curr || curr.id !== sessionId) return;
      this.port.patchState({
        activeSession: {
          ...curr,
          messages: curr.messages.map((m) => (m.id === assistantMessageId ? updater(m) : m)),
        },
      });
    };

    const client = new AgentStreamClient(
      runId,
      {
        onSnapshot: (run, reconnect) => {
          patchAssistant((m) => ({
            ...m,
            ...(!reconnect ? { content: run.content, reasoning: run.reasoning } : {}),
            steps: run.steps,
            ...(run.tokenUsage ? { tokenUsage: run.tokenUsage } : {}),
            ...(run.metrics ? { metrics: run.metrics } : {}),
            ...(run.cost ? { cost: run.cost } : {}),
          }));
          const firstPending = run.pendingApprovals?.[0];
          this.port.patchState({ pendingApproval: firstPending ? { ...firstPending, runId } : null });
        },
        onDeltaBatch: (batch) => {
          patchAssistant((m) => ({
            ...m,
            ...(batch.reasoning ? { reasoning: `${m.reasoning ?? ""}${batch.reasoning}` } : {}),
            ...(batch.text ? { content: `${m.content}${batch.text}` } : {}),
          }));
        },
        onStepUpdate: (step) => {
          patchAssistant((m) => {
            const existing = m.steps ?? [];
            const idx = existing.findIndex((s) => s.id === step.id);
            const nextSteps = idx >= 0
              ? existing.map((s, i) => (i === idx ? step : s))
              : [...existing, step];
            return { ...m, steps: nextSteps };
          });
        },
        // 实时用量随每轮模型/工具结束推送，保证统计栏在运行中也持续变化。
        onUsage: ({ tokenUsage, metrics, cost }) => {
          patchAssistant((m) => ({
            ...m,
            tokenUsage,
            ...(metrics ? { metrics } : {}),
            ...(cost ? { cost } : {}),
          }));
        },
        onApprovalRequired: (approval) => {
          const settings = this.port.getState().generalSettings;
          if (settings.enableApprovalNotification) {
            playGentleNotificationSound(settings.notificationSound);
          }
          this.port.patchState({ pendingApproval: { ...approval, runId } });
        },
        onApprovalResolved: (approvalId) => {
          const pending = this.port.getState().pendingApproval;
          if (pending?.runId === runId && pending.approvalId === approvalId) this.port.patchState({ pendingApproval: null });
        },
        onStatusNotice: (notice) => {
          if (this.port.getState().streamStatusNotice !== notice) {
            this.port.patchState({ streamStatusNotice: notice, degradedStream: null });
          }
        },
        onFinished: ({ fps, message, status, error }) => {
          if (this.streamClient === client) this.streamClient = null;
          if (message?.id === assistantMessageId) patchAssistant(() => message);
          if (fps !== undefined) {
            void fetchJson("/api/agent/metrics/render", {
              method: "POST",
              body: JSON.stringify({ fps }),
            }).catch(() => {});
          }
          const settings = this.port.getState().generalSettings;
          const turnNotify = settings.turnCompleteNotification;
          if (turnNotify === "always" || (turnNotify === "unfocused" && typeof document !== "undefined" && document.hidden)) {
            playGentleNotificationSound(settings.notificationSound);
          }
          const [nextQueued, ...restQueued] = this.port.getState().queuedMessages;
          this.port.patchState({
            runningRunId: null,
            pendingApproval: null,
            streamStatusNotice: "",
            degradedStream: null,
            ...(status === "error" && error ? { errorMessage: error } : {}),
            queuedMessages: message?.clarification ? this.port.getState().queuedMessages : restQueued,
          });
          if (this.port.getState().activeSessionId === sessionId) {
            void this.port.updateSessionMeta(sessionId, { unread: false });
            const ready = message ? Promise.resolve() : this.port.openSession(sessionId);
            void ready.then(() => {
              void this.port.refreshMeta();
              if (nextQueued && !message?.clarification) {
                void this.port.sendMessage(nextQueued);
              }
            });
          } else {
            void this.port.refreshMeta();
          }
        },
        onDegraded: (lastSeq, reason) => {
          if (this.streamClient === client) this.streamClient = null;
          this.port.patchState({
            runningRunId: null,
            streamStatusNotice: `流式连接中断（${reason}），已加载服务端已保存内容，可手动重试恢复。`,
            degradedStream: { runId, sessionId, assistantMessageId, lastSeq },
          });
          void fetchJson<{ session: ChatSessionDetail }>(`/api/chat/sessions/${encodeURIComponent(sessionId)}`)
            .then((res) => {
              if (this.port.getState().activeSessionId === sessionId) {
                this.port.patchState({ activeSession: res.session });
              }
            })
            .catch(() => {});
        },
      },
    );

    this.streamClient = client;
    client.start();
  }

  retryDegradedStream(): void {
    const info = this.port.getState().degradedStream;
    if (!info) return;
    this.port.patchState({
      runningRunId: info.runId,
      streamStatusNotice: "正在尝试恢复流式连接…",
      degradedStream: null,
    });
    this.subscribeRunEvents(info.runId, info.sessionId, info.assistantMessageId);
  }

  async continueInterruptedMessage(assistantMessageId: string): Promise<void> {
    const session = this.port.getState().activeSession;
    const msg = session?.messages.find((m) => m.id === assistantMessageId);
    if (!session || !msg || this.port.getState().runningRunId) return;
    const { cleanPrefix, incompleteTail } = splitCleanSentenceBoundary(msg.content);
    const resumePrompt = incompleteTail
      ? `上一次回答在半句话处中断。请紧接以下完整上下文并从断点“${incompleteTail}”自然补全续写，不要重复已输出内容：\n\n${cleanPrefix ? `${cleanPrefix}\n` : ""}${incompleteTail}`
      : `请紧接以上已输出内容的完整句边界继续往下回答，不要重复前文：\n\n${cleanPrefix || msg.content}`;
    await this.sendMessage(resumePrompt);
  }

  // 把确认提交给当前运行的待审批请求，再按 Host 结果更新提示。
  async resolveApproval(approved: boolean): Promise<void> {
    const pending = this.port.getState().pendingApproval;
    if (!pending) return;
    this.port.patchState({ pendingApproval: null });
    await fetchJson(`/api/agent/runs/${encodeURIComponent(pending.runId)}/approve`, {
      method: "POST",
      body: JSON.stringify({ approvalId: pending.approvalId, approved }),
    });
    const trustRes = await fetchJson<{ counts: Record<string, number> }>("/api/agent/trust").catch(() => null);
    if (trustRes) {
      this.port.patchState({ smartTrustCounts: trustRes.counts });
    }
  }

  async abortActiveRun(): Promise<void> {
    const runId = this.port.getState().runningRunId;
    if (!runId) return;
    await fetchJson(`/api/agent/runs/${encodeURIComponent(runId)}/abort`, { method: "POST" });
  }

  /** 恢复会话中仍在运行的 Host 任务：登记运行并重新订阅事件流。 */
  async resumeRun(sessionId: string): Promise<void> {
    const active = await fetchJson<{
      run: { runId: string; assistantMessageId: string; status: string } | null;
    }>(`/api/agent/sessions/${encodeURIComponent(sessionId)}/active-run`).catch(() => null);
    if (this.port.getState().activeSessionId !== sessionId) return;
    if (!active?.run || active.run.status !== "running") {
      // 会话读取与查询运行之间可能刚好收尾，补读已落盘的最终消息。
      if (active && this.port.getState().activeSession?.messages.at(-1)?.status === "streaming") {
        const latest = await fetchJson<{ session: ChatSessionDetail }>(`/api/chat/sessions/${encodeURIComponent(sessionId)}`).catch(() => null);
        if (latest && this.port.getState().activeSessionId === sessionId && !this.port.getState().runningRunId) {
          this.port.patchState({ activeSession: latest.session });
        }
      }
      return;
    }
    this.port.patchState({ runningRunId: active.run.runId });
    this.subscribeRunEvents(active.run.runId, sessionId, active.run.assistantMessageId);
  }

  dispose(): void {
    this.streamClient?.dispose();
    this.streamClient = null;
  }
}