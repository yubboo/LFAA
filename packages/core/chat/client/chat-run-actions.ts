// 运行动作：发送消息、SSE 事件归并与断线恢复、审批决策、中止、权限模式与排队消息。
import { AgentStreamClient, splitCleanSentenceBoundary } from "./stream-client";
import { fetchJson } from "./chat-http";
import { writeStoredPermissionMode } from "./chat-preferences";
import { playNotificationSound } from "./notification-sounds";
import type { AgentPermissionMode, ChatMessageItem, ChatSessionDetail } from "./chat-types";
import { enqueueMessage, moveQueuedAt, removeQueuedAt, takeQueuedHead, updateQueuedAt } from "./chat-queue";
import type { ChatStorePort } from "./chat-store-port";
import type { MediaGenerationInput, MediaSource } from "./chat-media";
import { uploadAttachment } from "./composer-attachments";

export class ChatRunActions {
  private streamClient: AgentStreamClient | null = null;
  private permissionUpdate = Promise.resolve();

  constructor(private readonly port: ChatStorePort) {}

  removeQueuedMessage(index: number): void {
    this.port.patchState({ queuedMessages: removeQueuedAt(this.port.getState().queuedMessages, index) });
  }

  /** 编辑某条排队消息；编辑成空文本等价于删除。 */
  updateQueuedMessage(index: number, text: string): void {
    this.port.patchState({ queuedMessages: updateQueuedAt(this.port.getState().queuedMessages, index, text) });
  }

  /** 上移/下移排队消息，调整发送顺序。 */
  moveQueuedMessage(index: number, delta: number): void {
    this.port.patchState({ queuedMessages: moveQueuedAt(this.port.getState().queuedMessages, index, delta) });
  }

  /** 清空全部排队消息。 */
  clearQueuedMessages(): void {
    this.port.patchState({ queuedMessages: [] });
  }

  /** 立即把某条排队消息作为插话发送（必要时中止当前运行）。 */
  async sendQueuedNow(index: number): Promise<void> {
    const queue = this.port.getState().queuedMessages;
    const target = queue[index];
    if (!target) return;
    this.port.patchState({ queuedMessages: removeQueuedAt(queue, index) });
    await this.submitFollowUp(target.text, true);
  }

  /** 插话发送全部排队消息：优先追加进当前运行，不打断生成。 */
  async flushQueuedMessages(): Promise<void> {
    const queue = this.port.getState().queuedMessages;
    if (queue.length === 0) return;
    const combined = queue.map((item) => item.text).join("\n\n");
    this.port.patchState({ queuedMessages: [] });
    if (!this.port.getState().runningRunId) {
      await this.sendMessage(combined);
      return;
    }
    if (await this.steerActiveRun(combined).catch(() => false)) return;
    await this.abortActiveRun();
    this.port.patchState({ runningRunId: null });
    await this.sendMessage(combined);
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
      this.port.patchState({ queuedMessages: enqueueMessage(this.port.getState().queuedMessages, trimmed) });
      return;
    }
    // 插话：优先追加到当前运行（不打断生成）；运行已结束时回退为普通发送。
    if (await this.steerActiveRun(trimmed).catch(() => false)) return;
    if (!this.port.getState().runningRunId) {
      await this.sendMessage(trimmed);
      return;
    }
    await this.abortActiveRun();
    this.port.patchState({ runningRunId: null });
    await this.sendMessage(trimmed);
  }

  /** 媒体生成与再次生图锁住发送入口，完成时只刷新仍打开的原会话。 */
  async generateMediaFromPrompt(input: MediaGenerationInput): Promise<{ ok: boolean; error?: string; ratio?: string }> {
    const state = this.port.getState();
    if (state.submittingMessage || state.runningRunId) return { ok: false, error: "请等待当前任务结束。" };
    this.port.patchState({ submittingMessage: true, errorMessage: "" });
    let session: ChatSessionDetail | null = null;
    try {
      session = await this.ensureActiveSession();
      const kind = "kind" in input ? input.kind : "image";
      const prompt = "prompt" in input ? input.prompt : "";
      const requestedRatio = "ratio" in input ? input.ratio : undefined;
      // 先取画幅计划：消息区按目标比例立刻出现生成占位（本地宿主毫秒级，失败不影响生成）。
      const plan = prompt.trim() && kind === "image"
        ? await fetchJson<{ ratio?: string }>("/api/media/plan", {
          method: "POST",
          body: JSON.stringify({ prompt, ...(requestedRatio ? { ratio: requestedRatio } : {}) }),
        }).catch(() => null)
        : null;
      this.showLocalMediaPlaceholder(session, kind, prompt, plan?.ratio ?? requestedRatio);
      let payload: object = input;
      if ("prompt" in input) {
        const { imageFiles, attachmentIds = [], ...fields } = input;
        const ids = [...attachmentIds];
        for (const file of (imageFiles ?? []).slice(0, Math.max(0, 3 - ids.length))) {
          const id = await uploadAttachment(session.id, file);
          if (!id) throw new Error("参考图上传失败，请检查图片大小并重试。");
          ids.push(id);
        }
        payload = { ...fields, ...(ids.length ? { attachmentIds: ids } : {}) };
      }
      const res = await fetchJson<{ ok?: boolean; error?: string }>("/api/media/generate", {
        method: "POST",
        body: JSON.stringify({ sessionId: session.id, ...payload }),
      });
      if (!res.ok) {
        this.dropLocalMediaPlaceholder(session.id);
        return { ok: false, ...(res.error ? { error: res.error } : {}) };
      }
      if (this.port.getState().activeSessionId === session.id) await this.port.openSession(session.id);
      return { ok: true, ...(plan?.ratio ? { ratio: plan.ratio } : {}) };
    } catch (error) {
      if (session) this.dropLocalMediaPlaceholder(session.id);
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    } finally {
      this.port.patchState({ submittingMessage: false });
    }
  }

  /** 在消息区插入本轮的临时用户消息与生成占位；真实消息在生成完成后由 openSession 覆盖。 */
  private showLocalMediaPlaceholder(session: ChatSessionDetail, kind: "image" | "video" | "audio", prompt: string, ratio?: string): void {
    const now = Date.now();
    const messages = [...session.messages];
    if (prompt.trim()) {
      messages.push({ id: `local-media-user-${now}`, role: "user", content: prompt, createdAt: now });
    }
    messages.push({
      id: `local-media-assistant-${now}`,
      role: "assistant",
      content: "",
      status: "streaming",
      mediaGenerating: { kind, ...(ratio ? { ratio } : {}) },
      createdAt: now,
    });
    this.port.patchState({ activeSession: { ...session, messages } });
  }

  /** 生成失败时只移除本轮临时消息，保留用户其余记录。 */
  private dropLocalMediaPlaceholder(sessionId: string): void {
    const session = this.port.getState().activeSession;
    if (!session || session.id !== sessionId) return;
    this.port.patchState({
      activeSession: { ...session, messages: session.messages.filter((message) => !message.id.startsWith("local-media-")) },
    });
  }

  /** 把一条消息插话进当前运行；运行已结束返回 false。成功后乐观追加用户消息气泡。 */
  async steerActiveRun(text: string): Promise<boolean> {
    const trimmed = text.trim();
    const runId = this.port.getState().runningRunId;
    if (!trimmed || !runId) return false;
    const res = await fetchJson<{ steered?: boolean }>(`/api/agent/runs/${encodeURIComponent(runId)}/steer`, {
      method: "POST",
      body: JSON.stringify({ text: trimmed }),
    });
    if (!res.steered) return false;
    const session = this.port.getState().activeSession;
    if (session) {
      this.port.patchState({
        activeSession: {
          ...session,
          messages: [
            ...session.messages,
            { id: `local-steer-${Date.now()}`, role: "user", content: trimmed, createdAt: Date.now() },
          ],
        },
      });
    }
    return true;
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
  async sendMessage(text: string, skillIds?: string[], referenceSources?: MediaSource[], attachmentIds?: string[]): Promise<void> {
    const trimmed = text.trim();
    const state = this.port.getState();
    if (!trimmed || state.runningRunId || state.submittingMessage) return;
    this.port.patchState({ submittingMessage: true });
    try {
      await this.startMessage(trimmed, skillIds, referenceSources, attachmentIds);
    } finally {
      this.port.patchState({ submittingMessage: false });
    }
  }

  /** 确保存在打开的会话：新会话草稿首次发送时自动创建，供普通消息与媒体直连共用。 */
  private async ensureActiveSession(): Promise<ChatSessionDetail> {
    const session = this.port.getState().activeSession;
    if (session) return session;
    const created = await fetchJson<{ session: ChatSessionDetail }>("/api/chat/sessions", {
      method: "POST",
      body: JSON.stringify({
        projectId: this.port.getState().draftProjectId,
        sectionId: this.port.getState().draftSectionId,
        sessionPreset: this.port.getState().draftSessionPreset,
      }),
    });
    this.port.patchState({
      activeSessionId: created.session.id,
      activeSession: created.session,
      draftSessionPreset: undefined,
      sessions: [created.session, ...this.port.getState().sessions],
    });
    return created.session;
  }

  private async startMessage(trimmed: string, skillIds?: string[], referenceSources?: MediaSource[], attachmentIds?: string[]): Promise<void> {
    this.port.patchState({ errorMessage: "", pendingApproval: null });

    const session = await this.ensureActiveSession();
    // 用户已经用新消息回应，之前那条会话的「待回答」徽标立即撤下。
    this.port.markAttentionResolved(session.id);

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
          ...(referenceSources?.length ? { referenceSources } : {}),
          ...(attachmentIds?.length ? { attachmentIds } : {}),
        }),
      },
    );

    this.port.patchState({ runningRunId: started.runId });
    this.port.markSessionRunning(session.id, true);
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
          // 只有当前打开的会话才占用审批横幅与提示音；后台会话交给侧栏徽标和轮询通知。
          if (this.port.getState().activeSessionId !== sessionId) return;
          const settings = this.port.getState().generalSettings;
          if (settings.enableApprovalNotification) {
            void playNotificationSound(settings.approvalSound ?? settings.notificationSound);
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
          // 结束即撤掉侧栏转圈；即使已切到别的会话，后台轮询也会兜底校正。
          this.port.markSessionRunning(sessionId, false);
          if (message?.id === assistantMessageId) patchAssistant(() => message);
          if (fps !== undefined) {
            void fetchJson("/api/agent/metrics/render", {
              method: "POST",
              body: JSON.stringify({ fps }),
            }).catch(() => {});
          }
          // 澄清问题在后台由轮询的「待回答」通知统一提示；普通结束才发轮次完成提醒。
          const hasQuestion = Boolean(message?.clarification);
          if (!hasQuestion || this.port.getState().activeSessionId === sessionId) {
            this.port.notifyRunFinished(sessionId);
          }
          const { head: nextQueued, rest: restQueued } = takeQueuedHead(this.port.getState().queuedMessages);
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
                void this.port.sendMessage(nextQueued.text);
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
    const activeSessionId = this.port.getState().activeSessionId;
    if (activeSessionId) this.port.markAttentionResolved(activeSessionId);
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
      this.port.markSessionRunning(sessionId, false);
      if (active && this.port.getState().activeSession?.messages.at(-1)?.status === "streaming") {
        const latest = await fetchJson<{ session: ChatSessionDetail }>(`/api/chat/sessions/${encodeURIComponent(sessionId)}`).catch(() => null);
        if (latest && this.port.getState().activeSessionId === sessionId && !this.port.getState().runningRunId) {
          this.port.patchState({ activeSession: latest.session });
        }
      }
      return;
    }
    this.port.patchState({ runningRunId: active.run.runId });
    this.port.markSessionRunning(sessionId, true);
    this.subscribeRunEvents(active.run.runId, sessionId, active.run.assistantMessageId);
  }

  dispose(): void {
    this.streamClient?.dispose();
    this.streamClient = null;
  }
}
