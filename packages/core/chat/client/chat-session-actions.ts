// 会话动作：新建草稿、打开/删除/分叉/导出会话、改绑项目、会话元信息与默认模式。
import type { ChatSessionDetail } from "./chat-types";
import { fetchJson } from "./chat-http";
import { writeStoredSessionId } from "./chat-preferences";
import type { ChatSessionMetaPatch, ChatStorePort } from "./chat-store-port";

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