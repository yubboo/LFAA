// 管理 @lfaa/chat 浏览器端会话列表、流式运行 SSE 订阅、工具审批、权限模式、模型配置、规则与长期记忆状态。
import {
  DEFAULT_GENERAL_SETTINGS,
  type GeneralSettingsConfig,
  type OpenSourcePackageInfo,
  type ReasoningLevelOption,
} from "./general-settings-client";
import { patchWorkbenchSessionState, readWorkbenchSessionState } from "./workbench-persist";
import { fetchJson } from "./chat-http";
import { readStoredPermissionMode, readStoredReasoningLevel, readStoredSessionId, writeStoredSessionId } from "./chat-preferences";
import { ChatBackgroundRuns } from "./chat-background-runs";
import { ChatSessionNotifier } from "./chat-session-notifier";
import { ChatDataActions } from "./chat-data-actions";
import { ChatFileActions } from "./chat-file-actions";
import { ChatRunActions } from "./chat-run-actions";
import { ChatSessionActions } from "./chat-session-actions";
import type { ChatSessionMetaPatch, ChatStorePort } from "./chat-store-port";
import type {
  AgentPermissionMode,
  ChatSessionAttention,
  ChatSessionDetail,
  ChatSessionItem,
  ChatStoreSnapshot,
  LibraryAssetItem,
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

/** 集中维护会话、运行和模型配置的可订阅状态，并通过 Host 接口完成持久化操作。 */
export class ChatClientStore {
  private readonly listeners = new Set<() => void>();
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
    runningSessionIds: [],
    attention: [],
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

  /** 动作模块使用的内部端口：只暴露状态与跨模块操作，避免相互直接依赖实现。 */
  private readonly port: ChatStorePort = {
    getState: () => this.state,
    patchState: (patch) => this.updateState(patch),
    refreshMeta: (projectPath) => this.refreshMeta(projectPath),
    trackLeavingActiveRun: (nextSessionId) => this.background.trackLeavingActiveRun(nextSessionId),
    scheduleBackgroundRunPoll: () => this.background.schedule(),
    markSessionRunning: (sessionId, running) => this.markSessionRunning(sessionId, running),
    markAttentionResolved: (sessionId) => this.markAttentionResolved(sessionId),
    notifyRunFinished: (sessionId) => this.notifier.notifyTurnFinished(sessionId),
    resumeRun: (sessionId) => this.runActions.resumeRun(sessionId),
    openSession: (sessionId) => this.sessionActions.openSession(sessionId),
    updateSessionMeta: (sessionId, patch) => this.sessionActions.updateSessionMeta(sessionId, patch),
    startNewChatDraft: (options) => this.sessionActions.startNewChatDraft(options),
    sendMessage: (text, skillIds) => this.runActions.sendMessage(text, skillIds),
  };

  private readonly sessionActions = new ChatSessionActions(this.port);
  private readonly runActions = new ChatRunActions(this.port);
  private readonly dataActions = new ChatDataActions(this.port);
  private readonly fileActions = new ChatFileActions(this.port);
  /** 近期已发过“轮次完成”通知的会话由通知器维护，避免 SSE 收尾与轮询兜底重复提醒。 */
  private readonly notifier = new ChatSessionNotifier(() => this.state);
  private readonly background = new ChatBackgroundRuns(
    () => this.state,
    (sessionIds) => this.updateState({ runningSessionIds: sessionIds }),
    (attention) => this.updateState({ attention }),
    (item) => this.notifier.notifyAttention(item),
    (sessionId) => this.notifier.notifyTurnFinished(sessionId),
    (projectPath) => this.refreshMeta(projectPath),
  );

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): ChatStoreSnapshot => this.state;

  /** 该会话是否有 Agent 正在运行；与当前打开的是哪条会话无关，供侧栏工作转圈使用。 */
  isSessionRunning(sessionId: string): boolean {
    return this.state.runningSessionIds.includes(sessionId);
  }

  /** 会话当前的待处理状态；关闭「会话状态提醒」时不在侧栏显示徽标。 */
  getSessionAttention(sessionId: string): "approval" | "question" | null {
    if (!this.state.generalSettings.enableDotNotification) return null;
    const item = this.state.attention.find((entry) => entry.sessionId === sessionId);
    if (item) return item.kind;
    return this.state.sessions.find((session) => session.id === sessionId)?.pendingQuestion ? "question" : null;
  }

  /** 用户已回应/已处理会话后先撤掉徽标，Host 轮询随后校正。 */
  markAttentionResolved(sessionId: string): void {
    this.background.markAttentionResolved(sessionId);
  }

  /** 开始/结束运行：开始新一轮时清掉上一轮的完成提醒记录。 */
  markSessionRunning(sessionId: string, running: boolean): void {
    if (running) this.notifier.markRunStarted(sessionId);
    this.background.markRunning(sessionId, running);
  }

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

  // ---- 文件预览与右栏舞台动作（实现见 chat-file-actions） ----
  openFilePreview(messageId: string, stepId: string): boolean {
    return this.fileActions.openFilePreview(messageId, stepId);
  }

  openWorkspaceFile(projectId: string, filePath: string, relativePath?: string, targetLine?: number, endLine?: number): void {
    this.fileActions.openWorkspaceFile(projectId, filePath, relativePath, targetLine, endLine);
  }

  selectFilePreview(id: string): void {
    this.fileActions.selectFilePreview(id);
  }

  setRightStageKind(kind: "file" | "browser" | "review" | null): void {
    this.fileActions.setRightStageKind(kind);
  }

  enqueueComposerInsert(text: string): void {
    this.fileActions.enqueueComposerInsert(text);
  }

  consumeComposerInsert(): void {
    this.fileActions.consumeComposerInsert();
  }

  requestRightPanel(tab: string, url?: string): void {
    this.fileActions.requestRightPanel(tab, url);
  }

  closeFilePreview(id: string): void {
    this.fileActions.closeFilePreview(id);
  }

  readProjectFile(projectId: string, filePath: string, signal: AbortSignal) {
    return this.fileActions.readProjectFile(projectId, filePath, signal);
  }

  readFileActivity(sessionId: string, messageId: string, stepId: string, signal: AbortSignal) {
    return this.fileActions.readFileActivity(sessionId, messageId, stepId, signal);
  }

  // 卸载聊天插件时停止活动流和后台轮询，并释放订阅。
  dispose(): void {
    this.runActions.dispose();
    this.background.dispose();
    this.listeners.clear();
  }

  // 初始化会话列表和界面元数据，供各视图共享同一份初始快照。
  async hydrate(): Promise<void> {
    if (typeof window === "undefined") return;
    try {
      const [sessRes, activeRes, attentionRes, llmRes, rulesRes, memRes, trustRes, libRes, storageRes, generalRes] = await Promise.all([
        fetchJson<{ sessions: ChatSessionItem[] }>("/api/chat/sessions"),
        fetchJson<{ sessionIds: string[] }>("/api/agent/active-sessions").catch(() => ({ sessionIds: [] })),
        fetchJson<{ items: ChatSessionAttention[] }>("/api/agent/attention").catch(() => ({ items: [] })),
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
        void this.runActions.resumeRun(targetId);
      }
      // 刷新后仍有 Agent 在后台运行的会话继续显示转圈；待确认/待回答也会恢复成侧栏徽标。
      this.background.sync({ sessionIds: activeRes.sessionIds, attention: attentionRes.items });
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

  // ---- 会话动作（实现见 chat-session-actions） ----
  startNewChatDraft(options: { projectId?: string | null; sectionId?: string | null } = {}): void {
    return this.sessionActions.startNewChatDraft(options);
  }

  openSession(sessionId: string): Promise<void> {
    return this.sessionActions.openSession(sessionId);
  }

  setActiveProjectBinding(projectId: string | null): Promise<void> {
    return this.sessionActions.setActiveProjectBinding(projectId);
  }

  deleteSession(sessionId: string): Promise<void> {
    return this.sessionActions.deleteSession(sessionId);
  }

  updateSessionMeta(sessionId: string, patch: ChatSessionMetaPatch): Promise<ChatSessionDetail | null> {
    return this.sessionActions.updateSessionMeta(sessionId, patch);
  }

  forkSession(sessionId: string): Promise<ChatSessionDetail | null> {
    return this.sessionActions.forkSession(sessionId);
  }

  exportSessionMarkdown(sessionId: string): Promise<{ title: string; markdown: string } | null> {
    return this.sessionActions.exportSessionMarkdown(sessionId);
  }

  selectSessionPreset(id: string): Promise<void> {
    return this.sessionActions.selectSessionPreset(id);
  }

  // ---- 运行动作（实现见 chat-run-actions） ----
  sendMessage(text: string, skillIds?: string[], referenceSources?: import("./chat-media").MediaSource[], attachmentIds?: string[]): Promise<void> {
    return this.runActions.sendMessage(text, skillIds, referenceSources, attachmentIds);
  }

  submitFollowUp(text: string, invertMode = false): Promise<void> {
    return this.runActions.submitFollowUp(text, invertMode);
  }

  setPermissionMode(mode: AgentPermissionMode): Promise<void> {
    return this.runActions.setPermissionMode(mode);
  }

  resetSmartTrust(): Promise<void> {
    return this.runActions.resetSmartTrust();
  }

  removeQueuedMessage(index: number): void {
    this.runActions.removeQueuedMessage(index);
  }

  updateQueuedMessage(index: number, text: string): void {
    this.runActions.updateQueuedMessage(index, text);
  }

  moveQueuedMessage(index: number, delta: number): void {
    this.runActions.moveQueuedMessage(index, delta);
  }

  clearQueuedMessages(): void {
    this.runActions.clearQueuedMessages();
  }

  sendQueuedNow(index: number): Promise<void> {
    return this.runActions.sendQueuedNow(index);
  }

  generateMediaFromPrompt(input: import("./chat-media").MediaGenerationInput) {
    return this.runActions.generateMediaFromPrompt(input);
  }

  flushQueuedMessages(): Promise<void> {
    return this.runActions.flushQueuedMessages();
  }

  retryDegradedStream(): void {
    this.runActions.retryDegradedStream();
  }

  continueInterruptedMessage(assistantMessageId: string): Promise<void> {
    return this.runActions.continueInterruptedMessage(assistantMessageId);
  }

  resolveApproval(approved: boolean): Promise<void> {
    return this.runActions.resolveApproval(approved);
  }

  abortActiveRun(): Promise<void> {
    return this.runActions.abortActiveRun();
  }

  // ---- 数据动作（实现见 chat-data-actions） ----
  refreshLibraryAndStorage(projectId?: string | null): Promise<void> {
    return this.dataActions.refreshLibraryAndStorage(projectId);
  }

  saveLibraryAsset(input: Parameters<ChatDataActions["saveLibraryAsset"]>[0]): Promise<LibraryAssetItem> {
    return this.dataActions.saveLibraryAsset(input);
  }

  readLibraryAsset(id: string): Promise<{ item: LibraryAssetItem; isText: boolean; content: string }> {
    return this.dataActions.readLibraryAsset(id);
  }

  removeLibraryAsset(id: string): Promise<void> {
    return this.dataActions.removeLibraryAsset(id);
  }

  migrateStorage(input: {
    mode: StorageLocationMode;
    targetPath?: string;
    projectId?: string | null;
  }): Promise<StorageMigrationResult> {
    return this.dataActions.migrateStorage(input);
  }

  pickStorageFolder(): Promise<{ cancelled: boolean; path?: string; error?: string }> {
    return this.dataActions.pickStorageFolder();
  }

  openStorageFolderInExplorer(): Promise<{ opened: boolean; path: string; error?: string }> {
    return this.dataActions.openStorageFolderInExplorer();
  }

  refreshGeneralSettings(): Promise<void> {
    return this.dataActions.refreshGeneralSettings();
  }

  updateGeneralSettings(patch: Partial<GeneralSettingsConfig>): Promise<GeneralSettingsConfig> {
    return this.dataActions.updateGeneralSettings(patch);
  }

  getOpenSourceLicenses(): Promise<OpenSourcePackageInfo[]> {
    return this.dataActions.getOpenSourceLicenses();
  }

  setActiveProfile(profileId: string): Promise<void> {
    return this.dataActions.setActiveProfile(profileId);
  }

  setReasoningLevel(level: ReasoningLevelOption): void {
    this.dataActions.setReasoningLevel(level);
  }

  saveLlmProfile(input: Parameters<ChatDataActions["saveLlmProfile"]>[0]): Promise<PublicLlmProfileItem | null> {
    return this.dataActions.saveLlmProfile(input);
  }

  deleteLlmProfile(profileId: string): Promise<void> {
    return this.dataActions.deleteLlmProfile(profileId);
  }

  testLlmProfile(profileId: string): Promise<{ ok: boolean; model: string; replyPreview: string }> {
    return this.dataActions.testLlmProfile(profileId);
  }

  fetchRemoteModels(input: Parameters<ChatDataActions["fetchRemoteModels"]>[0]): Promise<ModelCapabilityItem[]> {
    return this.dataActions.fetchRemoteModels(input);
  }

  selectBrandModel(profileId: string, model: string): Promise<void> {
    return this.dataActions.selectBrandModel(profileId, model);
  }

  saveUserRules(content: string): Promise<void> {
    return this.dataActions.saveUserRules(content);
  }

  addLongTermMemory(input: { content: string; scope: "global" | "project"; projectId?: string | null }): Promise<void> {
    return this.dataActions.addLongTermMemory(input);
  }

  removeLongTermMemory(memoryId: string): Promise<void> {
    return this.dataActions.removeLongTermMemory(memoryId);
  }
}
