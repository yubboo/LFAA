// 管理 @lfaa/chat 浏览器端会话列表、流式运行 SSE 订阅、工具审批、权限模式、模型配置、规则与长期记忆状态。
import {
  DEFAULT_GENERAL_SETTINGS,
  playGentleNotificationSound,
  writeLocaleOverride,
  type GeneralSettingsConfig,
  type OpenSourcePackageInfo,
  type ReasoningLevelOption,
} from "./general-settings-client";
import { AgentStreamClient, splitCleanSentenceBoundary } from "./stream-client";
import { getActivityFilePath } from "./file-activity";
import { patchWorkbenchSessionState, readWorkbenchSessionState } from "./workbench-persist";
import type {
  AgentPermissionMode,
  ChatMessageItem,
  ChatSessionDetail,
  ChatSessionItem,
  ChatStoreSnapshot,
  FilePreviewTab,
  LibraryAssetItem,
  LibraryItemCategory,
  LlmApiProtocolOption,
  LongTermMemoryItem,
  ModelCapabilityItem,
  PublicLlmProfileItem,
  RuleDocumentItem,
  StorageConfigState,
  StorageLocationMode,
  StorageMigrationResult,
  StorageStats,
} from "./chat-types";

export * from "./chat-types";

const ACTIVE_SESSION_KEY = "lfaa:active-chat-session-id";
const PERMISSION_MODE_KEY = "lfaa:permission-mode";
const REASONING_LEVEL_KEY = "lfaa:reasoning-level";

function readStoredReasoningLevel(): ReasoningLevelOption {
  if (typeof window === "undefined") return "high";
  try {
    const val = window.localStorage.getItem(REASONING_LEVEL_KEY);
    if (val === "minimal" || val === "low" || val === "medium" || val === "high" || val === "max") return val;
  } catch {
    // 忽略存储读取限制。
  }
  return "high";
}

function writeStoredReasoningLevel(level: ReasoningLevelOption): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REASONING_LEVEL_KEY, level);
  } catch {
    // 忽略存储配额限制。
  }
}

function readStoredPermissionMode(): AgentPermissionMode {
  if (typeof window === "undefined") return "ask";
  try {
    const val = window.localStorage.getItem(PERMISSION_MODE_KEY);
    if (val === "ask" || val === "smart" || val === "full") return val;
  } catch {
    // 忽略存储读取限制。
  }
  return "ask";
}

function writeStoredPermissionMode(mode: AgentPermissionMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PERMISSION_MODE_KEY, mode);
  } catch {
    // 忽略存储配额限制。
  }
}

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
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      ...init,
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("无法连接本地 LFAA 后台服务（请确认 `pnpm lfaa web` 正在运行后刷新页面重试）。");
    }
    throw error;
  }
  const payload = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) {
    throw new Error(payload.error || `请求失败 (${res.status})`);
  }
  return payload;
}

/** 集中维护会话、运行和模型配置的可订阅状态，并通过 Host 接口完成持久化操作。 */
export class ChatClientStore {
  private readonly listeners = new Set<() => void>();
  private readonly backgroundRunSessionIds = new Set<string>();
  private backgroundPollTimer: ReturnType<typeof setTimeout> | null = null;
  private streamClient: AgentStreamClient | null = null;
  private permissionUpdate = Promise.resolve();
  private readonly initialSessionId = readStoredSessionId();
  private readonly initialWorkbench = readWorkbenchSessionState(this.initialSessionId ?? "default");
  private state: ChatStoreSnapshot = {
    loaded: false,
    sessions: [],
    activeSessionId: this.initialSessionId,
    activeSession: null,
    draftProjectId: null,
    draftSectionId: null,
    runningRunId: null,
    queuedMessages: [],
    pendingApproval: null,
    filePreviewTabs: this.initialWorkbench.filePreviewTabs,
    activeFilePreviewId: this.initialWorkbench.activeFilePreviewId,
    rightStageKind: this.initialWorkbench.rightStageKind,
    rightPanelRequest: null,
    pendingComposerInsert: null,
    permissionMode: readStoredPermissionMode(),
    smartTrustCounts: {},
    activeProfileId: "",
    profiles: [],
    rules: [],
    memories: [],
    libraryAssets: [],
    storageState: null,
    storageStats: null,
    generalSettings: DEFAULT_GENERAL_SETTINGS,
    reasoningLevel: readStoredReasoningLevel(),
    streamStatusNotice: "",
    degradedStream: null,
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
    if (patch.activeSessionId !== undefined && patch.activeSessionId !== this.state.activeSessionId) {
      const persisted = readWorkbenchSessionState(patch.activeSessionId ?? "default");
      patch = {
        ...patch,
        filePreviewTabs: persisted.filePreviewTabs,
        activeFilePreviewId: persisted.activeFilePreviewId,
        rightStageKind: persisted.rightStageKind,
        rightPanelRequest: null,
      };
    }
    this.state = { ...this.state, ...patch };
    if (
      patch.activeSessionId === undefined
      && (patch.filePreviewTabs !== undefined || patch.activeFilePreviewId !== undefined || patch.rightStageKind !== undefined)
    ) {
      patchWorkbenchSessionState(this.state.activeSessionId ?? "default", {
        filePreviewTabs: this.state.filePreviewTabs,
        activeFilePreviewId: this.state.activeFilePreviewId,
        rightStageKind: this.state.rightStageKind ?? null,
      });
    }
    for (const listener of this.listeners) listener();
  }

  /** 右栏打开会话中已有成功记录的文件步骤，并精确记录定位行号。 */
  openFilePreview(messageId: string, stepId: string): boolean {
    const step = this.state.activeSession?.messages.find((message) => message.id === messageId)
      ?.steps?.find((item) => item.id === stepId);
    const path = step && getActivityFilePath(step);
    if (!step || step.status !== "done" || !path) return false;
    const normalized = (step.fileChange?.resolvedPath ?? path).replace(/\\/gu, "/");
    const id = /^(?:[a-z]:\/|\/\/)/iu.test(normalized) ? normalized.toLowerCase() : normalized;
    const targetLine = step.fileChange?.firstLine;
    const endLine = targetLine !== undefined
      ? targetLine + Math.max(0, (step.fileChange?.after.split("\n").length ?? 1) - 1)
      : undefined;
    const next: FilePreviewTab = {
      id,
      path: step.fileChange?.resolvedPath ?? path,
      relativePath: path.replace(/\\/gu, "/"),
      projectId: this.state.activeSession?.projectId ?? null,
      messageId,
      stepId,
      ...(targetLine !== undefined ? { targetLine } : {}),
      ...(endLine !== undefined ? { endLine } : {}),
    };
    const tabs = this.state.filePreviewTabs;
    this.updateState({
      activeFilePreviewId: id,
      rightStageKind: "file",
      filePreviewTabs: tabs.some((tab) => tab.id === id)
        ? tabs.map((tab) => tab.id === id ? next : tab)
        : [...tabs, next],
    });
    return true;
  }

  /** 从右侧文件树或路径引用直接打开项目内只读源码文件。 */
  openWorkspaceFile(projectId: string, filePath: string, relativePath?: string, targetLine?: number, endLine?: number): void {
    const normalized = filePath.replace(/\\/gu, "/");
    const id = /^(?:[a-z]:\/|\/\/)/iu.test(normalized) ? normalized.toLowerCase() : normalized;
    const existing = this.state.filePreviewTabs.find((tab) => tab.id === id);
    const next = {
      ...(existing ?? {}),
      id,
      path: filePath,
      relativePath: (relativePath ?? existing?.relativePath ?? filePath).replace(/\\/gu, "/"),
      projectId,
      ...(targetLine !== undefined ? { targetLine, endLine: endLine ?? targetLine } : {}),
    };
    const tabs = this.state.filePreviewTabs;
    this.updateState({
      activeFilePreviewId: id,
      rightStageKind: "file",
      filePreviewTabs: tabs.some((tab) => tab.id === id)
        ? tabs.map((tab) => tab.id === id ? next : tab)
        : [...tabs, next],
    });
  }

  selectFilePreview(id: string): void {
    if (this.state.filePreviewTabs.some((tab) => tab.id === id)) {
      this.updateState({ activeFilePreviewId: id, rightStageKind: "file" });
    }
  }

  setRightStageKind(kind: "file" | "browser" | "review" | null): void {
    if (this.state.rightStageKind === kind) return;
    this.updateState({ rightStageKind: kind });
  }

  enqueueComposerInsert(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    this.updateState({
      pendingComposerInsert: { text: trimmed, nonce: Date.now() },
    });
  }

  consumeComposerInsert(): void {
    if (!this.state.pendingComposerInsert) return;
    this.updateState({ pendingComposerInsert: null });
  }

  requestRightPanel(tab: string, url?: string): void {
    const stageKind = tab === "browser" ? "browser" : tab === "file-preview" ? "file"
      : tab === "review" ? "review" : this.state.rightStageKind ?? null;
    this.updateState({
      rightStageKind: stageKind,
      rightPanelRequest: { tab, ...(url ? { url } : {}), nonce: Date.now() },
    });
  }

  closeFilePreview(id: string): void {
    const index = this.state.filePreviewTabs.findIndex((tab) => tab.id === id);
    if (index < 0) return;
    const remaining = this.state.filePreviewTabs.filter((tab) => tab.id !== id);
    const nextActiveId = this.state.activeFilePreviewId === id
      ? (remaining[Math.min(index, remaining.length - 1)]?.id ?? null)
      : this.state.activeFilePreviewId;
    this.updateState({
      filePreviewTabs: remaining,
      activeFilePreviewId: nextActiveId,
      ...(this.state.rightStageKind === "file" && !nextActiveId ? { rightStageKind: null } : {}),
    });
  }

  readProjectFile(projectId: string, filePath: string, signal: AbortSignal) {
    const query = new URLSearchParams({ path: filePath });
    return fetchJson<{ path: string; relativePath: string; content: string; truncated: boolean; size: number }>(
      `/api/workspace/projects/${encodeURIComponent(projectId)}/file?${query}`,
      { signal },
    );
  }

  readFileActivity(sessionId: string, messageId: string, stepId: string, signal: AbortSignal) {
    const query = new URLSearchParams({ messageId, stepId });
    return fetchJson<{ content: string; truncated: boolean }>(
      `/api/agent/sessions/${encodeURIComponent(sessionId)}/file-activity?${query}`, { signal },
    );
  }

  // 卸载聊天插件时停止活动流和后台轮询，并释放订阅。
  dispose(): void {
    this.streamClient?.dispose();
    this.streamClient = null;
    if (this.backgroundPollTimer !== null) {
      clearTimeout(this.backgroundPollTimer);
      this.backgroundPollTimer = null;
    }
    this.backgroundRunSessionIds.clear();
    this.listeners.clear();
  }

  /** 切走正在生成中的会话时登记后台轮询，以便完成后即时刷新未读小点 */
  private trackLeavingActiveRun(nextSessionId: string | null): void {
    const prevId = this.state.activeSessionId;
    if (this.state.runningRunId && prevId && prevId !== nextSessionId) {
      this.backgroundRunSessionIds.add(prevId);
      this.scheduleBackgroundRunPoll();
    }
    if (nextSessionId) {
      this.backgroundRunSessionIds.delete(nextSessionId);
    }
  }

  private scheduleBackgroundRunPoll(): void {
    if (typeof window === "undefined") return;
    if (this.backgroundPollTimer !== null || this.backgroundRunSessionIds.size === 0) return;
    this.backgroundPollTimer = setTimeout(() => {
      this.backgroundPollTimer = null;
      void this.pollBackgroundRuns();
    }, 1500);
  }

  private async pollBackgroundRuns(): Promise<void> {
    const ids = Array.from(this.backgroundRunSessionIds);
    if (ids.length === 0) return;
    let finishedAny = false;
    await Promise.all(
      ids.map(async (id) => {
        const res = await fetchJson<{ run: { status: string } | null }>(
          `/api/agent/sessions/${encodeURIComponent(id)}/active-run`,
        ).catch(() => null);
        if (res && (!res.run || res.run.status !== "running")) {
          this.backgroundRunSessionIds.delete(id);
          finishedAny = true;
        }
      }),
    );
    if (finishedAny) {
      await this.refreshMeta();
    }
    if (this.backgroundRunSessionIds.size > 0) {
      this.scheduleBackgroundRunPoll();
    }
  }

  // 初始化会话列表和界面元数据，供各视图共享同一份初始快照。
  async hydrate(): Promise<void> {
    if (typeof window === "undefined") return;
    try {
      const [sessRes, llmRes, rulesRes, memRes, trustRes, libRes, storageRes, generalRes] = await Promise.all([
        fetchJson<{ sessions: ChatSessionItem[] }>("/api/chat/sessions"),
        fetchJson<{ activeProfileId: string; profiles: PublicLlmProfileItem[] }>("/api/llm/profiles"),
        fetchJson<{ documents: RuleDocumentItem[] }>("/api/rules"),
        fetchJson<{ memories: LongTermMemoryItem[] }>("/api/memory"),
        fetchJson<{ counts: Record<string, number> }>("/api/agent/trust").catch(() => ({ counts: {} })),
        fetchJson<{ assets: LibraryAssetItem[] }>("/api/library").catch(() => ({ assets: [] })),
        fetchJson<{ state: StorageConfigState; stats: StorageStats }>("/api/storage").catch(() => null),
        fetchJson<{ settings: GeneralSettingsConfig }>("/api/chat/general-settings").catch(() => null),
      ]);
      const targetId = this.state.activeSessionId && sessRes.sessions.some((s) => s.id === this.state.activeSessionId)
        ? this.state.activeSessionId
        : null;
      let activeSession: ChatSessionDetail | null = null;
      if (targetId) {
        const detail = await fetchJson<{ session: ChatSessionDetail }>(`/api/chat/sessions/${encodeURIComponent(targetId)}`).catch(() => null);
        if (detail?.session) {
          activeSession = detail.session;
        } else {
          writeStoredSessionId(null);
        }
      }
      this.updateState({
        loaded: true,
        sessions: sessRes.sessions,
        activeSessionId: targetId,
        activeSession,
        smartTrustCounts: trustRes.counts,
        activeProfileId: llmRes.activeProfileId,
        profiles: llmRes.profiles,
        rules: rulesRes.documents,
        memories: memRes.memories,
        libraryAssets: libRes.assets,
        ...(storageRes ? { storageState: storageRes.state, storageStats: storageRes.stats } : {}),
        ...(generalRes ? { generalSettings: generalRes.settings } : {}),
      });
      if (targetId) {
        void this.resumeActiveRunIfAny(targetId);
      }
    } catch (error) {
      this.updateState({
        loaded: true,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async refreshMeta(projectPath?: string): Promise<void> {
    const query = projectPath ? `?projectPath=${encodeURIComponent(projectPath)}` : "";
    const [sessRes, llmRes, rulesRes, memRes, trustRes, libRes, storageRes] = await Promise.all([
      fetchJson<{ sessions: ChatSessionItem[] }>("/api/chat/sessions"),
      fetchJson<{ activeProfileId: string; profiles: PublicLlmProfileItem[] }>("/api/llm/profiles"),
      fetchJson<{ documents: RuleDocumentItem[] }>(`/api/rules${query}`),
      fetchJson<{ memories: LongTermMemoryItem[] }>("/api/memory"),
      fetchJson<{ counts: Record<string, number> }>("/api/agent/trust").catch(() => ({ counts: {} })),
      fetchJson<{ assets: LibraryAssetItem[] }>("/api/library").catch(() => ({ assets: [] })),
      fetchJson<{ state: StorageConfigState; stats: StorageStats }>("/api/storage").catch(() => null),
    ]);
    this.updateState({
      sessions: sessRes.sessions,
      smartTrustCounts: trustRes.counts,
      activeProfileId: llmRes.activeProfileId,
      profiles: llmRes.profiles,
      rules: rulesRes.documents,
      memories: memRes.memories,
      libraryAssets: libRes.assets,
      ...(storageRes ? { storageState: storageRes.state, storageStats: storageRes.stats } : {}),
    });
  }

  async refreshLibraryAndStorage(projectId?: string | null): Promise<void> {
    const storageQuery = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
    const [libRes, storageRes] = await Promise.all([
      fetchJson<{ assets: LibraryAssetItem[]; memories: LongTermMemoryItem[] }>("/api/library"),
      fetchJson<{ state: StorageConfigState; stats: StorageStats }>(`/api/storage${storageQuery}`),
    ]);
    this.updateState({
      libraryAssets: libRes.assets,
      memories: libRes.memories,
      storageState: storageRes.state,
      storageStats: storageRes.stats,
    });
  }

  async saveLibraryAsset(input: {
    category: LibraryItemCategory;
    title: string;
    fileName: string;
    content: string;
    encoding?: "utf8" | "base64";
    mimeType?: string;
    summary?: string;
    tags?: string[];
    projectId?: string | null;
  }): Promise<LibraryAssetItem> {
    const res = await fetchJson<{ item: LibraryAssetItem }>("/api/library", {
      method: "POST",
      body: JSON.stringify(input),
    });
    await this.refreshLibraryAndStorage(input.projectId);
    return res.item;
  }

  async readLibraryAsset(id: string): Promise<{ item: LibraryAssetItem; isText: boolean; content: string }> {
    return fetchJson(`/api/library/${encodeURIComponent(id)}`);
  }

  async removeLibraryAsset(id: string): Promise<void> {
    await fetchJson(`/api/library/${encodeURIComponent(id)}`, { method: "DELETE" });
    await this.refreshLibraryAndStorage();
  }

  async migrateStorage(input: {
    mode: StorageLocationMode;
    targetPath?: string;
    projectId?: string | null;
  }): Promise<StorageMigrationResult> {
    const res = await fetchJson<StorageMigrationResult>("/api/storage/migrate", {
      method: "POST",
      body: JSON.stringify(input),
    });
    this.updateState({
      storageState: res.state,
      storageStats: res.stats,
    });
    await this.refreshMeta();
    return res;
  }

  async pickStorageFolder(): Promise<{ cancelled: boolean; path?: string; error?: string }> {
    return fetchJson("/api/workspace/pick-folder", { method: "POST" });
  }

  async openStorageFolderInExplorer(): Promise<{ opened: boolean; path: string; error?: string }> {
    return fetchJson("/api/storage/open-explorer", { method: "POST" });
  }

  async refreshGeneralSettings(): Promise<void> {
    const res = await fetchJson<{ settings: GeneralSettingsConfig }>("/api/chat/general-settings");
    this.updateState({ generalSettings: res.settings });
  }

  async updateGeneralSettings(patch: Partial<GeneralSettingsConfig>): Promise<GeneralSettingsConfig> {
    const res = await fetchJson<{ settings: GeneralSettingsConfig }>("/api/chat/general-settings", {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    if (patch.language) {
      writeLocaleOverride(res.settings.language);
    }
    this.updateState({ generalSettings: res.settings });
    return res.settings;
  }

  async getOpenSourceLicenses(): Promise<OpenSourcePackageInfo[]> {
    const res = await fetchJson<{ packages: OpenSourcePackageInfo[] }>("/api/chat/licenses");
    return res.packages;
  }

  removeQueuedMessage(index: number): void {
    this.updateState({
      queuedMessages: this.state.queuedMessages.filter((_, idx) => idx !== index),
    });
  }

  async submitFollowUp(text: string, invertMode = false): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!this.state.runningRunId) {
      await this.sendMessage(trimmed);
      return;
    }
    const baseMode = this.state.generalSettings.followUpMode;
    const effectiveMode = invertMode ? (baseMode === "queue" ? "steer" : "queue") : baseMode;
    if (effectiveMode === "queue") {
      this.updateState({ queuedMessages: [...this.state.queuedMessages, trimmed] });
      return;
    }
    await this.abortActiveRun();
    this.updateState({ runningRunId: null });
    await this.sendMessage(trimmed);
  }

  setPermissionMode(mode: AgentPermissionMode): Promise<void> {
    const runId = this.state.runningRunId;
    this.permissionUpdate = this.permissionUpdate.then(async () => {
      if (runId && this.state.runningRunId === runId) await this.updateRunPermission(runId, mode);
      writeStoredPermissionMode(mode);
      this.updateState({ permissionMode: mode });
    }).catch((error: unknown) => {
      this.updateState({ errorMessage: error instanceof Error ? error.message : String(error) });
    });
    return this.permissionUpdate;
  }

  private async updateRunPermission(runId: string, mode: AgentPermissionMode): Promise<void> {
    await fetchJson(`/api/agent/runs/${encodeURIComponent(runId)}/permission`, {
      method: "PATCH",
      body: JSON.stringify({ mode }),
    });
  }

  async resetSmartTrust(): Promise<void> {
    const res = await fetchJson<{ counts: Record<string, number> }>("/api/agent/trust", { method: "DELETE" });
    this.updateState({ smartTrustCounts: res.counts });
  }

  startNewChatDraft(options: { projectId?: string | null; sectionId?: string | null } = {}): void {
    this.trackLeavingActiveRun(null);
    this.streamClient?.dispose();
    this.streamClient = null;
    writeStoredSessionId(null);
    this.updateState({
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
    this.trackLeavingActiveRun(sessionId);
    this.streamClient?.dispose();
    this.streamClient = null;
    try {
      const res = await fetchJson<{ session: ChatSessionDetail }>(`/api/chat/sessions/${encodeURIComponent(sessionId)}`);
      writeStoredSessionId(res.session.id);
      this.updateState({
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
      void this.resumeActiveRunIfAny(res.session.id);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("不存在")) {
        writeStoredSessionId(null);
        this.updateState({ activeSessionId: null, activeSession: null, runningRunId: null, errorMessage: "" });
        return;
      }
      this.updateState({ errorMessage: msg });
    }
  }

  private async resumeActiveRunIfAny(sessionId: string): Promise<void> {
    const active = await fetchJson<{
      run: { runId: string; assistantMessageId: string; status: string } | null;
    }>(`/api/agent/sessions/${encodeURIComponent(sessionId)}/active-run`).catch(() => null);
    if (this.state.activeSessionId !== sessionId) return;
    if (!active?.run || active.run.status !== "running") {
      // 会话读取与查询运行之间可能刚好收尾，补读已落盘的最终消息。
      if (active && this.state.activeSession?.messages.at(-1)?.status === "streaming") {
        const latest = await fetchJson<{ session: ChatSessionDetail }>(`/api/chat/sessions/${encodeURIComponent(sessionId)}`).catch(() => null);
        if (latest && this.state.activeSessionId === sessionId && !this.state.runningRunId) {
          this.updateState({ activeSession: latest.session });
        }
      }
      return;
    }
    this.updateState({ runningRunId: active.run.runId });
    this.subscribeRunEvents(active.run.runId, sessionId, active.run.assistantMessageId);
  }

  async setActiveProjectBinding(projectId: string | null): Promise<void> {
    const current = this.state.activeSession;
    if (!current) {
      this.updateState({ draftProjectId: projectId });
      return;
    }
    if (current.projectId === projectId) return;
    const res = await fetchJson<{ session: ChatSessionDetail }>(
      `/api/chat/sessions/${encodeURIComponent(current.id)}`,
      { method: "PATCH", body: JSON.stringify({ projectId }) },
    );
    this.updateState({
      ...(this.state.activeSessionId === current.id ? {
        activeSession: res.session,
        draftProjectId: res.session.projectId,
      } : {}),
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

  async updateSessionMeta(
    sessionId: string,
    patch: {
      title?: string;
      projectId?: string | null;
      sectionId?: string | null;
      pinned?: boolean;
      archived?: boolean;
      unread?: boolean;
    },
  ): Promise<ChatSessionDetail | null> {
    const res = await fetchJson<{ session: ChatSessionDetail }>(
      `/api/chat/sessions/${encodeURIComponent(sessionId)}`,
      { method: "PATCH", body: JSON.stringify(patch) },
    );
    const updated = res.session;
    if (updated && updated.archived && this.state.activeSessionId === sessionId) {
      this.startNewChatDraft();
    } else if (updated && this.state.activeSessionId === sessionId) {
      this.updateState({
        activeSession: updated,
        draftProjectId: updated.projectId,
        draftSectionId: updated.sectionId,
      });
    }
    await this.refreshMeta();
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
      this.updateState({
        activeSessionId: forked.id,
        activeSession: forked,
        draftProjectId: forked.projectId,
        draftSectionId: forked.sectionId,
      });
    }
    await this.refreshMeta();
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
    const current = this.state.activeSession;
    if (this.state.submittingMessage || this.state.runningRunId || current?.messages.length) return;
    if (!current) {
      this.updateState({ draftSessionPreset: id });
      return;
    }
    this.updateState({ submittingMessage: true });
    try {
      const { session } = await fetchJson<{ session: ChatSessionDetail }>(`/api/chat/sessions/${encodeURIComponent(current.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ sessionPreset: id }),
      });
      this.updateState({
        ...(this.state.activeSessionId === current.id ? { activeSession: session } : {}),
        sessions: this.state.sessions.map((item) => item.id === current.id ? session : item),
      });
    } finally {
      this.updateState({ submittingMessage: false });
    }
  }

  // 将消息提交到当前或新建会话，随后订阅 Host 为这次运行返回的事件流。
  async sendMessage(text: string, skillIds?: string[]): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || this.state.runningRunId || this.state.submittingMessage) return;
    this.updateState({ submittingMessage: true });
    try {
      await this.startMessage(trimmed, skillIds);
    } finally {
      this.updateState({ submittingMessage: false });
    }
  }

  private async startMessage(trimmed: string, skillIds?: string[]): Promise<void> {
    this.updateState({ errorMessage: "", pendingApproval: null });

    let session = this.state.activeSession;
    if (!session) {
      const created = await fetchJson<{ session: ChatSessionDetail }>("/api/chat/sessions", {
        method: "POST",
        body: JSON.stringify({
          projectId: this.state.draftProjectId,
          sectionId: this.state.draftSectionId,
          sessionPreset: this.state.draftSessionPreset,
        }),
      });
      session = created.session;
      writeStoredSessionId(session.id);
      this.updateState({
        activeSessionId: session.id,
        activeSession: session,
        draftSessionPreset: undefined,
        sessions: [session, ...this.state.sessions],
      });
    }

    const startingMode = this.state.permissionMode;
    const started = await fetchJson<{ runId: string; sessionId: string; assistantMessageId: string }>(
      "/api/agent/runs",
      {
        method: "POST",
        body: JSON.stringify({
          sessionId: session.id,
          userMessage: trimmed,
          ...(this.state.activeProfileId ? { profileId: this.state.activeProfileId } : {}),
          reasoningEffort: this.state.reasoningLevel,
          permissionMode: startingMode,
          repeatToolThresholds: this.state.generalSettings.repeatToolThresholds,
          ...(skillIds && skillIds.length > 0 ? { skillIds } : {}),
        }),
      },
    );

    this.updateState({ runningRunId: started.runId });
    if (this.state.permissionMode !== startingMode) {
      try {
        await this.updateRunPermission(started.runId, this.state.permissionMode);
      } catch (error) {
        this.updateState({ errorMessage: error instanceof Error ? error.message : String(error) });
      }
    }
    const detail = await fetchJson<{ session: ChatSessionDetail }>(`/api/chat/sessions/${encodeURIComponent(session.id)}`);
    this.updateState({
      activeSession: detail.session,
      sessions: this.state.sessions.map((s) => (s.id === detail.session.id ? detail.session : s)),
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
      const curr = this.state.activeSession;
      if (!curr || curr.id !== sessionId) return;
      this.updateState({
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
          this.updateState({ pendingApproval: firstPending ? { ...firstPending, runId } : null });
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
          if (this.state.generalSettings.enableApprovalNotification) {
            playGentleNotificationSound(this.state.generalSettings.notificationSound);
          }
          this.updateState({ pendingApproval: { ...approval, runId } });
        },
        onApprovalResolved: (approvalId) => {
          const pending = this.state.pendingApproval;
          if (pending?.runId === runId && pending.approvalId === approvalId) this.updateState({ pendingApproval: null });
        },
        onStatusNotice: (notice) => {
          if (this.state.streamStatusNotice !== notice) {
            this.updateState({ streamStatusNotice: notice, degradedStream: null });
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
          const turnNotify = this.state.generalSettings.turnCompleteNotification;
          if (turnNotify === "always" || (turnNotify === "unfocused" && typeof document !== "undefined" && document.hidden)) {
            playGentleNotificationSound(this.state.generalSettings.notificationSound);
          }
          const [nextQueued, ...restQueued] = this.state.queuedMessages;
          this.updateState({
            runningRunId: null,
            pendingApproval: null,
            streamStatusNotice: "",
            degradedStream: null,
            ...(status === "error" && error ? { errorMessage: error } : {}),
            queuedMessages: message?.clarification ? this.state.queuedMessages : restQueued,
          });
          if (this.state.activeSessionId === sessionId) {
            void this.updateSessionMeta(sessionId, { unread: false });
            const ready = message ? Promise.resolve() : this.openSession(sessionId);
            void ready.then(() => {
              void this.refreshMeta();
              if (nextQueued && !message?.clarification) {
                void this.sendMessage(nextQueued);
              }
            });
          } else {
            void this.refreshMeta();
          }
        },
        onDegraded: (lastSeq, reason) => {
          if (this.streamClient === client) this.streamClient = null;
          this.updateState({
            runningRunId: null,
            streamStatusNotice: `流式连接中断（${reason}），已加载服务端已保存内容，可手动重试恢复。`,
            degradedStream: { runId, sessionId, assistantMessageId, lastSeq },
          });
          void fetchJson<{ session: ChatSessionDetail }>(`/api/chat/sessions/${encodeURIComponent(sessionId)}`)
            .then((res) => {
              if (this.state.activeSessionId === sessionId) {
                this.updateState({ activeSession: res.session });
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
    const info = this.state.degradedStream;
    if (!info) return;
    this.updateState({
      runningRunId: info.runId,
      streamStatusNotice: "正在尝试恢复流式连接…",
      degradedStream: null,
    });
    this.subscribeRunEvents(info.runId, info.sessionId, info.assistantMessageId);
  }

  async continueInterruptedMessage(assistantMessageId: string): Promise<void> {
    const session = this.state.activeSession;
    const msg = session?.messages.find((m) => m.id === assistantMessageId);
    if (!session || !msg || this.state.runningRunId) return;
    const { cleanPrefix, incompleteTail } = splitCleanSentenceBoundary(msg.content);
    const resumePrompt = incompleteTail
      ? `上一次回答在半句话处中断。请紧接以下完整上下文并从断点“${incompleteTail}”自然补全续写，不要重复已输出内容：\n\n${cleanPrefix ? `${cleanPrefix}\n` : ""}${incompleteTail}`
      : `请紧接以上已输出内容的完整句边界继续往下回答，不要重复前文：\n\n${cleanPrefix || msg.content}`;
    await this.sendMessage(resumePrompt);
  }

  // 把确认提交给当前运行的待审批请求，再按 Host 结果更新提示。
  async resolveApproval(approved: boolean): Promise<void> {
    const pending = this.state.pendingApproval;
    if (!pending) return;
    this.updateState({ pendingApproval: null });
    await fetchJson(`/api/agent/runs/${encodeURIComponent(pending.runId)}/approve`, {
      method: "POST",
      body: JSON.stringify({ approvalId: pending.approvalId, approved }),
    });
    const trustRes = await fetchJson<{ counts: Record<string, number> }>("/api/agent/trust").catch(() => null);
    if (trustRes) {
      this.updateState({ smartTrustCounts: trustRes.counts });
    }
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

  setReasoningLevel(level: ReasoningLevelOption): void {
    writeStoredReasoningLevel(level);
    this.updateState({ reasoningLevel: level });
  }

  async saveLlmProfile(input: {
    id?: string;
    providerId?: string;
    name: string;
    kind: PublicLlmProfileItem["kind"];
    apiProtocol?: LlmApiProtocolOption;
    baseUrl: string;
    model: string;
    apiKey?: string;
    availableModels?: ModelCapabilityItem[];
    contextWindowTokens?: number;
    inputPricePerMillion?: number;
    outputPricePerMillion?: number;
    cachedInputPricePerMillion?: number;
    activate?: boolean;
  }): Promise<PublicLlmProfileItem | null> {
    const res = await fetchJson<{ profile?: PublicLlmProfileItem; activeProfileId: string; profiles: PublicLlmProfileItem[] }>("/api/llm/profiles", {
      method: "POST",
      body: JSON.stringify(input),
    });
    this.updateState({ activeProfileId: res.activeProfileId, profiles: res.profiles });
    if (input.activate && res.profile?.id) {
      await this.setActiveProfile(res.profile.id);
    }
    return res.profile ?? null;
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

  // 同步模型能力后用 Host 返回的公开档案刷新界面状态。
  async fetchRemoteModels(input: {
    profileId?: string;
    kind?: PublicLlmProfileItem["kind"];
    apiProtocol?: LlmApiProtocolOption;
    baseUrl?: string;
    apiKey?: string;
  }): Promise<ModelCapabilityItem[]> {
    const res = await fetchJson<{
      models: ModelCapabilityItem[];
      activeProfileId: string;
      profiles: PublicLlmProfileItem[];
    }>("/api/llm/models", {
      method: "POST",
      body: JSON.stringify(input),
    });
    this.updateState({ activeProfileId: res.activeProfileId, profiles: res.profiles });
    return res.models;
  }

  async selectBrandModel(profileId: string, model: string): Promise<void> {
    const res = await fetchJson<{ activeProfileId: string; profiles: PublicLlmProfileItem[] }>(
      "/api/llm/select-model",
      {
        method: "POST",
        body: JSON.stringify({ profileId, model }),
      },
    );
    this.updateState({ activeProfileId: res.activeProfileId, profiles: res.profiles });
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
