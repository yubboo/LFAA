// 会话动作：新建草稿、打开/删除/分叉/导出会话、改绑项目、会话元信息与默认模式。
import type { ChatGoalItem, ChatHandoffItem, ChatSearchResult, ChatSessionDetail, ChatSessionItem, ChatSessionWorktree } from "./chat-types";
import { fetchJson } from "./chat-http";
import {
  writeStoredDraftProjectId,
  writeStoredDraftSectionId,
  writeStoredSessionId,
} from "./chat-preferences";
import type { ChatSessionMetaPatch, ChatStorePort } from "./chat-store-port";

/** 清除会话摘要上的待回答字段；没有时原样返回，避免无谓的状态变更。 */
function clearPendingQuestion<T extends ChatSessionItem>(session: T): T {
  if (!session.pendingQuestion) return session;
  const next = { ...session };
  delete next.pendingQuestion;
  return next;
}

export class ChatSessionActions {
  private openSessionSeq = 0;

  constructor(private readonly port: ChatStorePort) {}

  startNewChatDraft(options: {
    projectId?: string | null;
    sectionId?: string | null;
    worktree?: ChatSessionWorktree;
  } = {}): void {
    this.openSessionSeq += 1;
    const nextProjectId = options.projectId ?? null;
    const nextSectionId = options.sectionId ?? null;
    this.port.trackLeavingActiveRun(null);
    this.port.detachActiveStream?.();
    writeStoredSessionId(null);
    writeStoredDraftProjectId(nextProjectId);
    writeStoredDraftSectionId(nextSectionId);
    this.port.patchState({
      activeSessionId: null,
      activeSession: null,
      activeGoal: null,
      draftProjectId: nextProjectId,
      draftSectionId: nextSectionId,
      draftWorktree: options.worktree,
      draftSessionPreset: undefined,
      runningRunId: null,
      pendingApproval: null,
      streamStatusNotice: "",
      degradedStream: null,
      errorMessage: "",
      workspaceConflict: false,
      handoffs: [],
    });
  }

  clearDraftWorktree(): void {
    this.port.patchState({ draftWorktree: undefined });
  }

  async openSession(sessionId: string): Promise<void> {
    const seq = ++this.openSessionSeq;
    this.port.trackLeavingActiveRun(sessionId);
    this.port.detachActiveStream?.();
    try {
      const res = await fetchJson<{ session: ChatSessionDetail }>(`/api/chat/sessions/${encodeURIComponent(sessionId)}`);
      if (seq !== this.openSessionSeq) return;
      writeStoredSessionId(res.session.id);
      writeStoredDraftProjectId(res.session.projectId);
      writeStoredDraftSectionId(res.session.sectionId);
      this.port.patchState({
        activeSessionId: res.session.id,
        activeSession: res.session,
        activeGoal: undefined,
        draftProjectId: res.session.projectId,
        draftSectionId: res.session.sectionId,
        runningRunId: null,
        pendingApproval: null,
        streamStatusNotice: "",
        degradedStream: null,
        errorMessage: "",
        workspaceConflict: false,
        handoffs: [],
      });
      if (res.session.unread) {
        void this.updateSessionMeta(res.session.id, { unread: false });
      }
      void this.loadGoal(res.session.id);
      void this.loadHandoffs(res.session.id);
      void this.port.resumeRun(res.session.id);
    } catch (error) {
      if (seq !== this.openSessionSeq) return;
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("不存在")) {
        writeStoredSessionId(null);
        this.port.patchState({ activeSessionId: null, activeSession: null, activeGoal: null, runningRunId: null, errorMessage: "" });
        return;
      }
      this.port.patchState({ errorMessage: msg });
    }
  }

  /** 读取会话目标；目标接口不可用时保持隐藏，不影响聊天。 */
  async loadGoal(sessionId: string): Promise<void> {
    try {
      const res = await fetchJson<{ goals?: ChatGoalItem[] }>(`/api/goals?sessionId=${encodeURIComponent(sessionId)}`);
      if (this.port.getState().activeSessionId !== sessionId) return;
      const goal = (res.goals ?? []).find((item) => item.status !== "complete") ?? null;
      this.port.patchState({ activeGoal: goal });
    } catch {
      if (this.port.getState().activeSessionId === sessionId) this.port.patchState({ activeGoal: null });
    }
  }

  /** 保存用户编辑的目标文字；目标状态仍只由 Agent 的 goal_update 改变。 */
  async editGoal(objective: string): Promise<boolean> {
    const state = this.port.getState();
    const goal = state.activeGoal;
    const sessionId = state.activeSession?.id;
    if (!goal || !sessionId) return false;
    const trimmed = objective.trim();
    if (!trimmed) {
      this.port.patchState({ errorMessage: "目标文字不能为空。" });
      return false;
    }
    if (trimmed.length > 2000) {
      this.port.patchState({ errorMessage: "目标文字不能超过 2000 个字符。" });
      return false;
    }
    try {
      const res = await fetchJson<{ goal: ChatGoalItem }>(`/api/goals/${encodeURIComponent(goal.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ sessionId, objective: trimmed }),
      });
      if (this.port.getState().activeSessionId === sessionId) {
        this.port.patchState({ activeGoal: res.goal, errorMessage: "" });
      }
      return true;
    } catch (error) {
      this.port.patchState({ errorMessage: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  /** 暂停/恢复目标自动续跑；只改开关，不影响目标状态与轮次。 */
  async setGoalAutoContinue(autoContinue: boolean): Promise<boolean> {
    const state = this.port.getState();
    const goal = state.activeGoal;
    const sessionId = state.activeSession?.id;
    if (!goal || !sessionId) return false;
    try {
      const res = await fetchJson<{ goal: ChatGoalItem }>(`/api/goals/${encodeURIComponent(goal.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ sessionId, autoContinue }),
      });
      if (this.port.getState().activeSessionId === sessionId) {
        this.port.patchState({ activeGoal: res.goal, errorMessage: "" });
      }
      return true;
    } catch (error) {
      this.port.patchState({ errorMessage: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  /** 工作区被占用时，为当前会话创建并绑定独立工作树；成功后清掉冲突提示，由用户重发。 */
  async isolateWorkspace(): Promise<boolean> {
    const state = this.port.getState();
    const session = state.activeSession;
    if (!session?.projectId) {
      this.port.patchState({ errorMessage: "当前会话未绑定项目，无法创建工作树。" });
      return false;
    }
    try {
      const branch = `parallel-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const created = await fetchJson<{ worktree: { id: string; branch: string; path: string } }>("/api/worktrees", {
        method: "POST",
        body: JSON.stringify({ projectId: session.projectId, branch }),
      });
      const bound = await fetchJson<{ session: ChatSessionDetail }>(
        `/api/chat/sessions/${encodeURIComponent(session.id)}`,
        { method: "PATCH", body: JSON.stringify({ worktreeId: created.worktree.id }) },
      );
      this.port.patchState({
        activeSession: bound.session,
        sessions: this.port.getState().sessions.map((item) => (item.id === bound.session.id ? bound.session : item)),
        errorMessage: "",
        workspaceConflict: false,
      });
      return true;
    } catch (error) {
      this.port.patchState({ errorMessage: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  /** 读取当前会话的待接手交接；接口不可用或失败时保持为空，不影响聊天。 */
  async loadHandoffs(sessionId: string): Promise<void> {
    try {
      const projectId = this.port.getState().activeSession?.projectId ?? "";
      const res = await fetchJson<{ handoffs?: ChatHandoffItem[] }>(
        `/api/handoffs?sessionId=${encodeURIComponent(sessionId)}&direction=incoming&projectId=${encodeURIComponent(projectId)}`,
      );
      if (this.port.getState().activeSessionId !== sessionId) return;
      this.port.patchState({ handoffs: res.handoffs ?? [] });
    } catch {
      if (this.port.getState().activeSessionId === sessionId) this.port.patchState({ handoffs: [] });
    }
  }

  /** 接手交接：Host 创建同目标 goal，随后刷新目标条。 */
  async acceptHandoff(id: string): Promise<boolean> {
    const sessionId = this.port.getState().activeSession?.id;
    if (!sessionId) return false;
    try {
      await fetchJson(`/api/handoffs/${encodeURIComponent(id)}/accept`, {
        method: "POST",
        body: JSON.stringify({ sessionId }),
      });
      this.port.patchState({ handoffs: this.port.getState().handoffs.filter((item) => item.id !== id) });
      await this.loadGoal(sessionId);
      return true;
    } catch (error) {
      this.port.patchState({ errorMessage: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  /** 本地忽略一条交接：只从当前列表移除，不改变服务端状态。 */
  dismissHandoff(id: string): void {
    this.port.patchState({ handoffs: this.port.getState().handoffs.filter((item) => item.id !== id) });
  }

  /** 跳过澄清：清除 Host 的待回答状态与本地徽标，避免「待回答」永久残留。 */
  async dismissClarification(sessionId: string): Promise<void> {
    await fetchJson(`/api/agent/sessions/${encodeURIComponent(sessionId)}/clarification/dismiss`, { method: "POST" });
    this.port.markAttentionResolved(sessionId);
    const state = this.port.getState();
    const active = state.activeSession;
    this.port.patchState({
      sessions: state.sessions.map((session) => (session.id === sessionId ? clearPendingQuestion(session) : session)),
      activeSession: active && active.id === sessionId ? clearPendingQuestion(active) : active,
    });
  }

  /** 搜索会话标题与消息正文；搜索弹窗在输入变化时调用。 */
  async searchChat(query: string): Promise<ChatSearchResult[]> {
    const res = await fetchJson<{ results: ChatSearchResult[] }>(`/api/chat/search?q=${encodeURIComponent(query)}`);
    return Array.isArray(res.results) ? res.results : [];
  }

  /** 请求聊天视图滚动到搜索结果命中的消息并短暂高亮。 */
  requestMessageJump(sessionId: string, messageId: string): void {
    this.port.patchState({ pendingMessageJump: { sessionId, messageId, nonce: Date.now() } });
  }

  /** 聊天视图完成跳转后消费请求，避免重复滚动。 */
  consumeMessageJump(nonce: number): void {
    if (this.port.getState().pendingMessageJump?.nonce === nonce) {
      this.port.patchState({ pendingMessageJump: null });
    }
  }

  async setActiveProjectBinding(projectId: string | null): Promise<void> {
    const current = this.port.getState().activeSession;
    if (!current) {
      writeStoredDraftProjectId(projectId);
      this.port.patchState({ draftProjectId: projectId });
      return;
    }
    if (current.projectId === projectId) {
      writeStoredDraftProjectId(projectId);
      return;
    }
    const res = await fetchJson<{ session: ChatSessionDetail }>(
      `/api/chat/sessions/${encodeURIComponent(current.id)}`,
      { method: "PATCH", body: JSON.stringify({ projectId }) },
    );
    if (this.port.getState().activeSessionId === current.id) {
      writeStoredDraftProjectId(res.session.projectId);
    }
    this.port.patchState({
      ...(this.port.getState().activeSessionId === current.id ? {
        activeSession: res.session,
        draftProjectId: res.session.projectId,
      } : {}),
      sessions: this.port.getState().sessions.map((s) => (s.id === res.session.id ? res.session : s)),
    });
  }

  async deleteSession(sessionId: string): Promise<void> {
    await fetchJson(`/api/chat/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
    if (this.port.getState().activeSessionId === sessionId) {
      this.startNewChatDraft();
    }
    await this.port.refreshMeta();
  }

  async updateSessionMeta(sessionId: string, patch: ChatSessionMetaPatch): Promise<ChatSessionDetail | null> {
    const res = await fetchJson<{ session: ChatSessionDetail }>(
      `/api/chat/sessions/${encodeURIComponent(sessionId)}`,
      { method: "PATCH", body: JSON.stringify(patch) },
    );
    const updated = res.session;
    if (updated && updated.archived && this.port.getState().activeSessionId === sessionId) {
      this.startNewChatDraft();
    } else if (updated && this.port.getState().activeSessionId === sessionId) {
      writeStoredDraftProjectId(updated.projectId);
      writeStoredDraftSectionId(updated.sectionId);
      this.port.patchState({
        activeSession: updated,
        draftProjectId: updated.projectId,
        draftSectionId: updated.sectionId,
      });
    }
    await this.port.refreshMeta();
    return updated ?? null;
  }

  async forkSession(sessionId: string): Promise<ChatSessionDetail | null> {
    const res = await fetchJson<{ session: ChatSessionDetail }>(
      `/api/chat/sessions/${encodeURIComponent(sessionId)}/fork`,
      { method: "POST" },
    );
    const forked = res.session;
    if (forked) {
      writeStoredSessionId(forked.id);
      writeStoredDraftProjectId(forked.projectId);
      writeStoredDraftSectionId(forked.sectionId);
      this.port.patchState({
        activeSessionId: forked.id,
        activeSession: forked,
        activeGoal: undefined,
        draftProjectId: forked.projectId,
        draftSectionId: forked.sectionId,
      });
      void this.loadGoal(forked.id);
    }
    await this.port.refreshMeta();
    return forked ?? null;
  }

  async exportSessionMarkdown(sessionId: string): Promise<{ title: string; markdown: string } | null> {
    const res = await fetchJson<{ session: ChatSessionDetail }>(
      `/api/chat/sessions/${encodeURIComponent(sessionId)}`,
    );
    const s = res.session;
    if (!s) return null;
    const body = s.messages
      .map((m) => `### ${m.role === "user" ? "User" : "Assistant"}\n\n${m.content}`)
      .join("\n\n---\n\n");
    return {
      title: s.title,
      markdown: `# ${s.title}\n\n${body}`,
    };
  }

  /** 草稿选择随首条消息保存，已有空会话由 Host 验证后更新。 */
  async selectSessionPreset(id: string): Promise<void> {
    const state = this.port.getState();
    const current = state.activeSession;
    if (state.submittingMessage || state.runningRunId || current?.messages.length) return;
    if (!current) {
      this.port.patchState({ draftSessionPreset: id });
      return;
    }
    this.port.patchState({ submittingMessage: true });
    try {
      const { session } = await fetchJson<{ session: ChatSessionDetail }>(`/api/chat/sessions/${encodeURIComponent(current.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ sessionPreset: id }),
      });
      this.port.patchState({
        ...(this.port.getState().activeSessionId === current.id ? { activeSession: session } : {}),
        sessions: this.port.getState().sessions.map((item) => item.id === current.id ? session : item),
      });
    } finally {
      this.port.patchState({ submittingMessage: false });
    }
  }
}