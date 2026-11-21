// 会话动作：新建草稿、打开/删除/分叉/导出会话、改绑项目、会话元信息与默认模式。
import type { ChatSearchResult, ChatSessionDetail, ChatSessionItem } from "./chat-types";
import { fetchJson } from "./chat-http";
import { writeStoredSessionId } from "./chat-preferences";
import type { ChatSessionMetaPatch, ChatStorePort } from "./chat-store-port";

/** 清除会话摘要上的待回答字段；没有时原样返回，避免无谓的状态变更。 */
function clearPendingQuestion<T extends ChatSessionItem>(session: T): T {
  if (!session.pendingQuestion) return session;
  const next = { ...session };
  delete next.pendingQuestion;
  return next;
}

export class ChatSessionActions {
  constructor(private readonly port: ChatStorePort) {}

  startNewChatDraft(options: { projectId?: string | null; sectionId?: string | null } = {}): void {
    this.port.trackLeavingActiveRun(null);
    writeStoredSessionId(null);
    this.port.patchState({
      activeSessionId: null,
      activeSession: null,
      draftProjectId: options.projectId ?? null,
      draftSectionId: options.sectionId ?? null,
      draftSessionPreset: undefined,
      runningRunId: null,
      pendingApproval: null,
      errorMessage: "",
    });
  }

  async openSession(sessionId: string): Promise<void> {
    this.port.trackLeavingActiveRun(sessionId);
    try {
      const res = await fetchJson<{ session: ChatSessionDetail }>(`/api/chat/sessions/${encodeURIComponent(sessionId)}`);
      writeStoredSessionId(res.session.id);
      this.port.patchState({
        activeSessionId: res.session.id,
        activeSession: res.session,
        draftProjectId: res.session.projectId,
        draftSectionId: res.session.sectionId,
        runningRunId: null,
        pendingApproval: null,
        streamStatusNotice: "",
        degradedStream: null,
        errorMessage: "",
      });
      if (res.session.unread) {
        void this.updateSessionMeta(res.session.id, { unread: false });
      }
      void this.port.resumeRun(res.session.id);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("不存在")) {
        writeStoredSessionId(null);
        this.port.patchState({ activeSessionId: null, activeSession: null, runningRunId: null, errorMessage: "" });
        return;
      }
      this.port.patchState({ errorMessage: msg });
    }
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
      this.port.patchState({ draftProjectId: projectId });
      return;
    }
    if (current.projectId === projectId) return;
    const res = await fetchJson<{ session: ChatSessionDetail }>(
      `/api/chat/sessions/${encodeURIComponent(current.id)}`,
      { method: "PATCH", body: JSON.stringify({ projectId }) },
    );
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
      this.port.patchState({
        activeSession: updated,
        draftProjectId: updated.projectId,
        draftSectionId: updated.sectionId,
      });
    }
    await this.port.refreshMeta();
    return updated ?? null;
  }

  /** 手动更新会话任务清单；PATCH 成功后以服务端回读的会话为准。 */
  async updateSessionTodos(sessionId: string, todos: NonNullable<ChatSessionDetail["todos"]>): Promise<ChatSessionDetail | null> {
    const res = await fetchJson<{ session: ChatSessionDetail }>(
      `/api/chat/sessions/${encodeURIComponent(sessionId)}`,
      { method: "PATCH", body: JSON.stringify({ todos }) },
    );
    const updated = res.session ?? null;
    if (updated && this.port.getState().activeSessionId === sessionId) {
      this.port.patchState({ activeSession: updated });
    }
    return updated;
  }

  async forkSession(sessionId: string): Promise<ChatSessionDetail | null> {
    const res = await fetchJson<{ session: ChatSessionDetail }>(
      `/api/chat/sessions/${encodeURIComponent(sessionId)}/fork`,
      { method: "POST" },
    );
    const forked = res.session;
    if (forked) {
      writeStoredSessionId(forked.id);
      this.port.patchState({
        activeSessionId: forked.id,
        activeSession: forked,
        draftProjectId: forked.projectId,
        draftSectionId: forked.sectionId,
      });
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