// 管理 @lfaa/chat 浏览器端会话列表、流式运行 SSE 订阅、工具审批、模型配置、规则与长期记忆状态。
import type {
  AgentStepItem,
  ChatMessageItem,
  ChatSessionDetail,
  ChatSessionItem,
  ChatStoreSnapshot,
  LongTermMemoryItem,
  PendingApprovalBanner,
  PublicLlmProfileItem,
  RuleDocumentItem,
} from "./chat-types";

export * from "./chat-types";

const ACTIVE_SESSION_KEY = "lfaa:active-chat-session-id";

function readStoredSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACTIVE_SESSION_KEY);
  } catch {
    return null;
  }
}

function writeStoredSessionId(sessionId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (sessionId) window.localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
    else window.localStorage.removeItem(ACTIVE_SESSION_KEY);
  } catch {
    // 忽略存储配额限制。
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  const payload = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) {
    throw new Error(payload.error || `请求失败 (${res.status})`);
  }
  return payload;
}

export class ChatClientStore {
  private readonly listeners = new Set<() => void>();
  private eventSource: EventSource | null = null;
  private state: ChatStoreSnapshot = {
    loaded: false,
    sessions: [],
    activeSessionId: readStoredSessionId(),
    activeSession: null,
    draftProjectId: null,
    draftSectionId: null,
    runningRunId: null,
    pendingApproval: null,
    activeProfileId: "",
    profiles: [],
    rules: [],
    memories: [],
    errorMessage: "",
  };

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): ChatStoreSnapshot => this.state;

  private updateState(patch: Partial<ChatStoreSnapshot>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  dispose(): void {
    this.eventSource?.close();
    this.eventSource = null;
    this.listeners.clear();
  }

  async hydrate(): Promise<void> {
    if (typeof window === "undefined") return;
    try {
      const [sessRes, llmRes, rulesRes, memRes] = await Promise.all([
        fetchJson<{ sessions: ChatSessionItem[] }>("/api/chat/sessions"),
        fetchJson<{ activeProfileId: string; profiles: PublicLlmProfileItem[] }>("/api/llm/profiles"),
        fetchJson<{ documents: RuleDocumentItem[] }>("/api/rules"),
        fetchJson<{ memories: LongTermMemoryItem[] }>("/api/memory"),
      ]);
      const targetId = this.state.activeSessionId && sessRes.sessions.some((s) => s.id === this.state.activeSessionId)
        ? this.state.activeSessionId
        : null;
      let activeSession: ChatSessionDetail | null = null;
      if (targetId) {
        const detail = await fetchJson<{ session: ChatSessionDetail }>(`/api/chat/sessions/${encodeURIComponent(targetId)}`);
        activeSession = detail.session;
      }
      this.updateState({
        loaded: true,
        sessions: sessRes.sessions,
        activeSessionId: targetId,
        activeSession,
        activeProfileId: llmRes.activeProfileId,
        profiles: llmRes.profiles,
        rules: rulesRes.documents,
        memories: memRes.memories,
      });
    } catch (error) {
      this.updateState({
        loaded: true,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async refreshMeta(projectPath?: string): Promise<void> {
    const query = projectPath ? `?projectPath=${encodeURIComponent(projectPath)}` : "";
    const [sessRes, llmRes, rulesRes, memRes] = await Promise.all([
      fetchJson<{ sessions: ChatSessionItem[] }>("/api/chat/sessions"),
      fetchJson<{ activeProfileId: string; profiles: PublicLlmProfileItem[] }>("/api/llm/profiles"),
      fetchJson<{ documents: RuleDocumentItem[] }>(`/api/rules${query}`),
      fetchJson<{ memories: LongTermMemoryItem[] }>("/api/memory"),
    ]);
    this.updateState({
      sessions: sessRes.sessions,
      activeProfileId: llmRes.activeProfileId,
      profiles: llmRes.profiles,
      rules: rulesRes.documents,
      memories: memRes.memories,
    });
  }

  startNewChatDraft(options: { projectId?: string | null; sectionId?: string | null } = {}): void {
    this.eventSource?.close();
    this.eventSource = null;
    writeStoredSessionId(null);
    this.updateState({
      activeSessionId: null,
      activeSession: null,
      draftProjectId: options.projectId ?? null,
      draftSectionId: options.sectionId ?? null,
      runningRunId: null,
      pendingApproval: null,
      errorMessage: "",
    });
  }

  async openSession(sessionId: string): Promise<void> {
    this.eventSource?.close();
    this.eventSource = null;
    const res = await fetchJson<{ session: ChatSessionDetail }>(`/api/chat/sessions/${encodeURIComponent(sessionId)}`);
    writeStoredSessionId(res.session.id);
    this.updateState({
      activeSessionId: res.session.id,
      activeSession: res.session,
      draftProjectId: res.session.projectId,
      draftSectionId: res.session.sectionId,
      runningRunId: null,
      pendingApproval: null,
      errorMessage: "",
    });
  }

  async setActiveProjectBinding(projectId: string | null): Promise<void> {
    if (!this.state.activeSession) {
      this.updateState({ draftProjectId: projectId });
      return;
    }
    const res = await fetchJson<{ session: ChatSessionDetail }>(
      `/api/chat/sessions/${encodeURIComponent(this.state.activeSession.id)}`,
      { method: "PATCH", body: JSON.stringify({ projectId }) },
    );
    this.updateState({
      activeSession: res.session,
      draftProjectId: res.session.projectId,
      sessions: this.state.sessions.map((s) => (s.id === res.session.id ? res.session : s)),
    });
  }

  async deleteSession(sessionId: string): Promise<void> {
    await fetchJson(`/api/chat/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
    if (this.state.activeSessionId === sessionId) {
      this.startNewChatDraft();
    }
    await this.refreshMeta();
  }

  async sendMessage(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || this.state.runningRunId) return;
    this.updateState({ errorMessage: "", pendingApproval: null });

    let session = this.state.activeSession;
    if (!session) {
      const created = await fetchJson<{ session: ChatSessionDetail }>("/api/chat/sessions", {
        method: "POST",
        body: JSON.stringify({
          projectId: this.state.draftProjectId,
          sectionId: this.state.draftSectionId,
        }),
      });
      session = created.session;
      writeStoredSessionId(session.id);
      this.updateState({
        activeSessionId: session.id,
        activeSession: session,
        sessions: [session, ...this.state.sessions],
      });
    }

    const started = await fetchJson<{ runId: string; sessionId: string; assistantMessageId: string }>(
      "/api/agent/runs",
      {
        method: "POST",
        body: JSON.stringify({
          sessionId: session.id,
          userMessage: trimmed,
          ...(this.state.activeProfileId ? { profileId: this.state.activeProfileId } : {}),
          projectId: session.projectId,
        }),
      },
    );

    const detail = await fetchJson<{ session: ChatSessionDetail }>(`/api/chat/sessions/${encodeURIComponent(session.id)}`);
    this.updateState({
      activeSession: detail.session,
      runningRunId: started.runId,
    });

    this.subscribeRunEvents(started.runId, session.id, started.assistantMessageId);
  }

  private subscribeRunEvents(runId: string, sessionId: string, assistantMessageId: string): void {
    this.eventSource?.close();
    const es = new EventSource(`/api/agent/runs/${encodeURIComponent(runId)}/events`);
    this.eventSource = es;

    const patchAssistant = (updater: (msg: ChatMessageItem) => ChatMessageItem) => {
      const curr = this.state.activeSession;
      if (!curr || curr.id !== sessionId) return;
      this.updateState({
        activeSession: {
          ...curr,
          messages: curr.messages.map((m) => (m.id === assistantMessageId ? updater(m) : m)),
        },
      });
    };

    es.onmessage = (event) => {
      const data = JSON.parse(event.data) as {
        type: string;
        kind?: "reasoning" | "text";
        text?: string;
        step?: AgentStepItem;
        approvalId?: string;
        toolName?: string;
        permissionLevel?: "write" | "exec";
        argsPreview?: string;
        status?: "done" | "error" | "aborted";
        error?: string;
        run?: {
          content: string;
          reasoning: string;
          steps: AgentStepItem[];
          pendingApprovals?: PendingApprovalBanner[];
        };
      };

      if (data.type === "snapshot" && data.run) {
        const nextReasoning = data.run.reasoning || undefined;
        patchAssistant((m) => ({
          ...m,
          content: data.run!.content || m.content,
          ...(nextReasoning !== undefined ? { reasoning: nextReasoning } : m.reasoning !== undefined ? { reasoning: m.reasoning } : {}),
          steps: data.run!.steps.length > 0 ? data.run!.steps : (m.steps ?? []),
        }));
        const firstPending = data.run.pendingApprovals?.[0];
        if (firstPending) {
          this.updateState({ pendingApproval: { ...firstPending, runId } });
        }
      } else if (data.type === "delta" && data.text) {
        patchAssistant((m) =>
          data.kind === "reasoning"
            ? { ...m, reasoning: `${m.reasoning ?? ""}${data.text}` }
            : { ...m, content: `${m.content}${data.text}` },
        );
      } else if (data.type === "step_update" && data.step) {
        patchAssistant((m) => {
          const existing = m.steps ?? [];
          const idx = existing.findIndex((s) => s.id === data.step!.id);
          const nextSteps = idx >= 0
            ? existing.map((s, i) => (i === idx ? data.step! : s))
            : [...existing, data.step!];
          return { ...m, steps: nextSteps };
        });
      } else if (data.type === "approval_required" && data.approvalId && data.toolName && data.permissionLevel) {
        this.updateState({
          pendingApproval: {
            runId,
            approvalId: data.approvalId,
            toolName: data.toolName,
            permissionLevel: data.permissionLevel,
            argsPreview: data.argsPreview ?? "{}",
          },
        });
      } else if (data.type === "run_finished") {
        es.close();
        if (this.eventSource === es) this.eventSource = null;
        this.updateState({ runningRunId: null, pendingApproval: null });
        void this.openSession(sessionId).then(() => this.refreshMeta());
      }
    };

    es.onerror = () => {
      es.close();
      if (this.eventSource === es) this.eventSource = null;
      if (this.state.runningRunId === runId) {
        this.updateState({ runningRunId: null });
      }
    };
  }

  async resolveApproval(approved: boolean): Promise<void> {
    const pending = this.state.pendingApproval;
    if (!pending) return;
    this.updateState({ pendingApproval: null });
    await fetchJson(`/api/agent/runs/${encodeURIComponent(pending.runId)}/approve`, {
      method: "POST",
      body: JSON.stringify({ approvalId: pending.approvalId, approved }),
    });
  }

  async abortActiveRun(): Promise<void> {
    const runId = this.state.runningRunId;
    if (!runId) return;
    await fetchJson(`/api/agent/runs/${encodeURIComponent(runId)}/abort`, { method: "POST" });
  }

  async setActiveProfile(profileId: string): Promise<void> {
    await fetchJson("/api/llm/active", { method: "POST", body: JSON.stringify({ profileId }) });
    this.updateState({ activeProfileId: profileId });
  }

  async saveLlmProfile(input: {
    id?: string;
    name: string;
    kind: PublicLlmProfileItem["kind"];
    baseUrl: string;
    model: string;
    apiKey?: string;
  }): Promise<void> {
    const res = await fetchJson<{ activeProfileId: string; profiles: PublicLlmProfileItem[] }>("/api/llm/profiles", {
      method: "POST",
      body: JSON.stringify(input),
    });
    this.updateState({ activeProfileId: res.activeProfileId, profiles: res.profiles });
  }

  async deleteLlmProfile(profileId: string): Promise<void> {
    const res = await fetchJson<{ activeProfileId: string; profiles: PublicLlmProfileItem[] }>(
      `/api/llm/profiles/${encodeURIComponent(profileId)}`,
      { method: "DELETE" },
    );
    this.updateState({ activeProfileId: res.activeProfileId, profiles: res.profiles });
  }

  async testLlmProfile(profileId: string): Promise<{ ok: boolean; model: string; replyPreview: string }> {
    return fetchJson("/api/llm/test", { method: "POST", body: JSON.stringify({ profileId }) });
  }

  async saveUserRules(content: string): Promise<void> {
    const res = await fetchJson<{ documents: RuleDocumentItem[] }>("/api/rules/user", {
      method: "PUT",
      body: JSON.stringify({ content }),
    });
    this.updateState({ rules: res.documents });
  }

  async addLongTermMemory(input: { content: string; scope: "global" | "project"; projectId?: string | null }): Promise<void> {
    await fetchJson("/api/memory", { method: "POST", body: JSON.stringify(input) });
    await this.refreshMeta();
  }

  async removeLongTermMemory(memoryId: string): Promise<void> {
    await fetchJson(`/api/memory/${encodeURIComponent(memoryId)}`, { method: "DELETE" });
    await this.refreshMeta();
  }
}
