// 运行动作：发送消息、SSE 事件归并与断线恢复、审批决策、中止、权限模式与排队消息。
import { AgentStreamClient } from "./stream-client";
import { createRunStreamHandlers } from "./run-stream-handler";
import { fetchJson } from "./chat-http";
import { beginDraftExit } from "./draft-session-exit";
import {
  writeStoredDraftActive,
  writeStoredDraftProjectId,
  writeStoredDraftSectionId,
  writeStoredPermissionMode,
  writeStoredSessionId,
} from "./chat-preferences";
import type { AgentPermissionMode, ChatSessionDetail } from "./chat-types";
import { enqueueMessage, moveQueuedAt, removeQueuedAt, updateQueuedAt } from "./chat-queue";
import type { ChatStorePort } from "./chat-store-port";
import type { MediaGenerationInput, MediaSource } from "@lfaa/client-ui-tool-media/client";
import { generateMedia, type MediaGenerationResult } from "./run-media-actions";
import { extractGroupMentions, startGroupTurnStream, type GroupTurnStreamHandle } from "./group-turn-stream";

export class ChatRunActions {
  private streamClient: AgentStreamClient | null = null;
  private groupStream: GroupTurnStreamHandle | null = null;
  private readonly settledTimers = new Set<ReturnType<typeof setTimeout>>();
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
    await this.submitFollowUp(target.text, false, true);
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

  async submitFollowUp(text: string, invertMode = false, forceSteer = false): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!this.port.getState().runningRunId) {
      await this.sendMessage(trimmed);
      return;
    }
    const baseMode = this.port.getState().generalSettings.followUpMode;
    const effectiveMode = forceSteer ? "steer" : invertMode ? (baseMode === "queue" ? "steer" : "queue") : baseMode;
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

  /** 媒体生成入口：状态锁、占位、上传与请求细节见 run-media-actions.ts。 */
  async generateMediaFromPrompt(input: MediaGenerationInput): Promise<MediaGenerationResult> {
    return generateMedia(this.port, input, () => this.ensureActiveSession());
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
    } catch (error) {
      // 工作区占用（409）等启动失败在这里落到全局提示，输入框负责恢复草稿。
      const code = (error as { code?: string }).code;
      this.port.patchState({
        errorMessage: error instanceof Error ? error.message : String(error),
        workspaceConflict: code === "workspace_busy",
      });
      throw error;
    } finally {
      this.port.patchState({ submittingMessage: false });
    }
  }

  /** 确保存在打开的会话：新会话草稿首次发送时自动创建，供普通消息与媒体直连共用。 */
  private async ensureActiveSession(): Promise<ChatSessionDetail> {
    const session = this.port.getState().activeSession;
    if (session) return session;
    const draftSession = this.port.getState().draftSession;
    const draftTeam = this.port.getState().draftTeam;
    const isDraftGroup = Boolean(draftTeam && draftTeam.agentIds.length >= 2);
    const created = await fetchJson<{ session: ChatSessionDetail }>("/api/chat/sessions", {
      method: "POST",
      body: JSON.stringify({
        projectId: this.port.getState().draftProjectId,
        sectionId: this.port.getState().draftSectionId,
        sessionPreset: this.port.getState().draftSessionPreset,
        ...(this.port.getState().draftWorktree ? { worktreeId: this.port.getState().draftWorktree?.id } : {}),
        ...(isDraftGroup && draftTeam
          ? {
              kind: "group",
              group: {
                agentIds: draftTeam.agentIds,
                hostAgentId: draftTeam.agentIds[0],
                ...(draftTeam.memberRoles ? { memberRoles: draftTeam.memberRoles } : {}),
              },
            }
          : draftTeam?.agentIds[0]
            ? { agentId: draftTeam.agentIds[0] }
            : {}),
      }),
    });
    // 新会话首次落库后立即持久化活动会话 ID，避免 Vite HMR 或 F5 刷新后被踢回空白「新聊天」。
    writeStoredSessionId(created.session.id);
    writeStoredDraftActive(false);
    writeStoredDraftProjectId(created.session.projectId);
    writeStoredDraftSectionId(created.session.sectionId);
    const exitingDraft = beginDraftExit(this.port, draftSession);
    this.port.patchState({
      activeSessionId: created.session.id,
      activeSession: created.session,
      // 草稿首次落库后由真实会话行接管；退场行先收起，输入区草稿记忆随发送清空。
      draftSession: null,
      ...(exitingDraft ? { exitingDraftSession: exitingDraft } : {}),
      draftSessionPreset: undefined,
      draftWorktree: undefined,
      draftTeam: undefined,
      sessions: [created.session, ...this.port.getState().sessions],
    });
    return created.session;
  }

  private async startMessage(trimmed: string, skillIds?: string[], referenceSources?: MediaSource[], attachmentIds?: string[], continuation?: { assistantMessageId: string }): Promise<void> {
    this.port.patchState({ errorMessage: "", pendingApproval: null, workspaceConflict: false });

    const session = await this.ensureActiveSession();
    // 用户已经用新消息回应，之前那条会话的「待回答」徽标立即撤下。
    this.port.markAttentionResolved(session.id);

    // 同一主聊天会话有 ≥2 位协作 Agent 时，自动走多 Agent 流式编排通道，界面与单聊完全统一。
    if (!continuation && session.kind === "group" && session.group && session.group.agentIds.length >= 2) {
      this.groupStream?.dispose();
      const mentions = extractGroupMentions(trimmed, session.group.agentIds);
      const handle = await startGroupTurnStream({
        port: this.port,
        sessionId: session.id,
        userMessage: trimmed,
        mentions,
        onClosed: () => {
          if (this.groupStream === handle) this.groupStream = null;
        },
      });
      this.groupStream = handle;
      return;
    }

    const startingMode = this.port.getState().permissionMode;
    const runOptions = {
      ...(this.port.getState().activeProfileId ? { profileId: this.port.getState().activeProfileId } : {}),
      reasoningEffort: this.port.getState().reasoningLevel,
      permissionMode: startingMode,
      // 追问建议跟本轮回复一起生成，避免回复后再发一次请求造成迟到挂载与滚动跳动。
      withSuggestions: true,
      repeatToolThresholds: this.port.getState().generalSettings.repeatToolThresholds,
      ...(skillIds && skillIds.length > 0 ? { skillIds } : {}),
      ...(referenceSources?.length ? { referenceSources } : {}),
      ...(attachmentIds?.length ? { attachmentIds } : {}),
    };
    const started = await fetchJson<{ runId: string; sessionId: string; assistantMessageId: string }>(
      "/api/agent/runs",
      {
        method: "POST",
        body: JSON.stringify(continuation
          ? { sessionId: session.id, continuation, ...runOptions }
          : { sessionId: session.id, userMessage: trimmed, ...runOptions }),
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

  // 将 Host 的增量、工具和审批事件归并到当前会话，终止后回收运行状态；回调实现在 run-stream-handler.ts。
  private subscribeRunEvents(
    runId: string,
    sessionId: string,
    assistantMessageId: string,
  ): void {
    this.streamClient?.dispose();
    let client: AgentStreamClient | null = null;
    const handlers = createRunStreamHandlers({
      port: this.port,
      runId,
      sessionId,
      assistantMessageId,
      onStreamClosed: () => {
        if (this.streamClient === client) this.streamClient = null;
      },
      onSettled: () => {
        // 目标自动续跑由 Host 异步启动：两次探测，避免启动稍晚时错过重新订阅。
        const scheduleProbe = (delayMs: number) => {
          const timer = setTimeout(() => {
            this.settledTimers.delete(timer);
            if (this.port.getState().activeSessionId === sessionId && !this.port.getState().runningRunId) {
              void this.resumeRun(sessionId);
            }
          }, delayMs);
          this.settledTimers.add(timer);
        };
        scheduleProbe(600);
        scheduleProbe(2200);
      },
    });
    client = new AgentStreamClient(runId, handlers);
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
    // 续写走 Host 的 continuation 参数：不写用户消息，只把续写指令放进模型上下文。
    await this.startMessage("", undefined, undefined, undefined, { assistantMessageId });
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
    if (this.groupStream && this.groupStream.turnId === runId) {
      await fetchJson(`/api/group/turns/${encodeURIComponent(runId)}/abort`, { method: "POST" });
      return;
    }
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

  /** 断开当前活动 SSE 流并清理待探测定时器（切换会话或销毁时调用）。 */
  detachActiveStream(): void {
    this.streamClient?.dispose();
    this.streamClient = null;
    this.groupStream?.dispose();
    this.groupStream = null;
    for (const timer of this.settledTimers) clearTimeout(timer);
    this.settledTimers.clear();
  }

  dispose(): void {
    this.detachActiveStream();
  }
}
