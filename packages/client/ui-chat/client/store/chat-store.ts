// 管理 @lfaa/chat 浏览器端会话列表、流式运行 SSE 订阅、工具审批、权限模式、模型配置、规则与长期记忆状态。
import { DEFAULT_GENERAL_SETTINGS } from "../shared/general-settings";
import { patchWorkbenchSessionState, readWorkbenchSessionState } from "./workbench-persist";
import {
  readStoredDraftProjectId,
  readStoredDraftSectionId,
  readStoredFollowAgentWorkbench,
  readStoredPermissionMode,
  readStoredReasoningLevel,
  readStoredSessionId,
  writeStoredFollowAgentWorkbench,
} from "./chat-preferences";
import { resolveAgentWorkbenchAction } from "../shared/agent-workbench-sync";
import { ChatBackgroundRuns } from "./chat-background-runs";
import { ChatSessionNotifier } from "./chat-session-notifier";
import { ChatDataActions } from "./chat-data-actions";
import { ChatDataFacade } from "./chat-store-data-facade";
import { ChatFileActions } from "./chat-file-actions";
import { hydrateChatStore, refreshChatMeta } from "./chat-store-bootstrap";
import { ChatRunActions } from "./chat-run-actions";
import { ChatSessionActions } from "./chat-session-actions";
import type { ChatSessionMetaPatch, ChatStorePort } from "./chat-store-port";
import type {
  AgentPermissionMode,
  AgentStepItem,
  ChatSearchResult,
  ChatSessionDetail,
  ChatSessionWorktree,
  ChatStoreSnapshot,
} from "./chat-types";

export * from "./chat-types";

/** 集中维护会话、运行和模型配置的可订阅状态，并通过 Host 接口完成持久化操作。 */
export class ChatClientStore extends ChatDataFacade {
  private readonly listeners = new Set<() => void>();
  private readonly initialSessionId = readStoredSessionId();
  private readonly initialWorkbench = readWorkbenchSessionState(this.initialSessionId ?? "default");
  private state: ChatStoreSnapshot = {
    loaded: false,
    sessions: [],
    activeSessionId: this.initialSessionId,
    activeSession: null,
    activeGoal: undefined,
    draftProjectId: readStoredDraftProjectId(),
    draftSectionId: readStoredDraftSectionId(),
    draftWorktree: undefined,
    runningRunId: null,
    runningSessionIds: [],
    attention: [],
    pendingMessageJump: null,
    queuedMessages: [],
    handoffs: [],
    pendingApproval: null,
    filePreviewTabs: this.initialWorkbench.filePreviewTabs,
    activeFilePreviewId: this.initialWorkbench.activeFilePreviewId,
    rightStageKind: this.initialWorkbench.rightStageKind,
    followAgentWorkbench: readStoredFollowAgentWorkbench(),
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
    detachActiveStream: () => this.runActions.detachActiveStream(),
    scheduleBackgroundRunPoll: () => this.background.schedule(),
    markSessionRunning: (sessionId, running) => this.markSessionRunning(sessionId, running),
    markAttentionResolved: (sessionId) => this.markAttentionResolved(sessionId),
    notifyRunFinished: (sessionId) => this.notifier.notifyTurnFinished(sessionId),
    resumeRun: (sessionId) => this.runActions.resumeRun(sessionId),
    openSession: (sessionId) => this.sessionActions.openSession(sessionId),
    updateSessionMeta: (sessionId, patch) => this.sessionActions.updateSessionMeta(sessionId, patch),
    refreshGoal: (sessionId) => this.sessionActions.loadGoal(sessionId),
    startNewChatDraft: (options) => this.sessionActions.startNewChatDraft(options),
    sendMessage: (text, skillIds) => this.runActions.sendMessage(text, skillIds),
    applyAgentStepWorkbenchAction: (sessionId, messageId, step, previousStep) => this.applyAgentStepWorkbenchAction(sessionId, messageId, step, previousStep),
  };
  /** 本轮用户手动收起右栏时暂停自动展开，直到下一轮开始或切会话恢复。 */
  private autopilotPausedForRun = false;
  /** 本轮 Agent 是否已进入浏览器验收，防止顺手改文件把台前浏览器顶掉。 */
  private browserActiveInRun = false;

  private readonly sessionActions = new ChatSessionActions(this.port);
  private readonly runActions = new ChatRunActions(this.port);
  protected readonly dataActions = new ChatDataActions(this.port);
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
    const session = this.state.sessions.find((entry) => entry.id === sessionId);
    if (session?.muted) return null;
    const item = this.state.attention.find((entry) => entry.sessionId === sessionId);
    if (item) return item.kind;
    return session?.pendingQuestion ? "question" : null;
  }

  /** 用户已回应/已处理会话后先撤掉徽标，Host 轮询随后校正。 */
  markAttentionResolved(sessionId: string): void {
    this.background.markAttentionResolved(sessionId);
  }

  /** 跳过澄清：清除 Host 的待回答状态与本地徽标。 */
  dismissClarification(sessionId: string): Promise<void> {
    return this.sessionActions.dismissClarification(sessionId);
  }

  /** 全文搜索与结果消息定位，状态动作由 ChatSessionActions 承担。 */
  searchChat(query: string): Promise<ChatSearchResult[]> { return this.sessionActions.searchChat(query); }
  requestMessageJump(sessionId: string, messageId: string): void { this.sessionActions.requestMessageJump(sessionId, messageId); }
  consumeMessageJump(nonce: number): void { this.sessionActions.consumeMessageJump(nonce); }

  /** 开始/结束运行：开始新一轮时清掉上一轮的完成提醒记录与右栏自动跟随临时暂停态。 */
  markSessionRunning(sessionId: string, running: boolean): void {
    if (running) {
      this.notifier.markRunStarted(sessionId);
      if (sessionId === this.state.activeSessionId) {
        this.autopilotPausedForRun = false;
        this.browserActiveInRun = false;
      }
    }
    this.background.markRunning(sessionId, running);
  }

  /** 切换右侧工作台「跟随 Agent」开关并持久化。 */
  setFollowAgentWorkbench(follow: boolean): void {
    writeStoredFollowAgentWorkbench(follow);
    if (follow) this.autopilotPausedForRun = false;
    this.updateState({ followAgentWorkbench: follow });
  }

  /** 用户在运行中手动折叠右栏时，本轮不再自动拉起右栏；下一轮自动恢复。 */
  pauseAutopilotForCurrentRun(): void {
    if (this.state.runningRunId) this.autopilotPausedForRun = true;
  }

  private applyAgentStepWorkbenchAction(sessionId: string, messageId: string, step: AgentStepItem, previousStep?: AgentStepItem): void {
    if (sessionId !== this.state.activeSessionId) return;
    if (typeof window !== "undefined" && (window as unknown as { __LFAA_EMBEDDED_BROWSER__?: boolean }).__LFAA_EMBEDDED_BROWSER__ === true) {
      return;
    }
    const action = resolveAgentWorkbenchAction(step, {
      messageId,
      browserActiveInRun: this.browserActiveInRun,
      previousStep,
    });
    if (!action) return;
    if (!(action.kind === "browser" && action.explicit)
      && (!this.state.followAgentWorkbench || this.autopilotPausedForRun)) return;
    if (action.kind === "browser") {
      this.browserActiveInRun = true;
      this.fileActions.requestRightPanel("browser", undefined, {
        autoExpand: true,
        refreshBrowser: action.refreshTabs,
        ...(action.devtoolsTab ? { devtoolsTab: action.devtoolsTab } : {}),
      });
      return;
    }
    if (action.kind === "file") {
      const opened = this.fileActions.openFilePreview(action.messageId, action.stepId, action.activateStage);
      if (opened && action.activateStage) {
        this.fileActions.requestRightPanel("file-preview", undefined, { autoExpand: true });
      }
      return;
    }
    this.fileActions.requestRightPanel(action.kind, undefined, { autoExpand: true });
  }

  private updateState(patch: Partial<ChatStoreSnapshot>): void {
    if (patch.activeSessionId !== undefined && patch.activeSessionId !== this.state.activeSessionId) {
      this.autopilotPausedForRun = false;
      this.browserActiveInRun = false;
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

  openWorkspaceFile(
    projectId: string,
    filePath: string,
    relativePath?: string,
    targetLine?: number,
    endLine?: number,
    worktreeId?: string,
  ): void {
    this.fileActions.openWorkspaceFile(projectId, filePath, relativePath, targetLine, endLine, worktreeId);
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

  requestRightPanel(tab: string, url?: string, options?: Parameters<ChatFileActions["requestRightPanel"]>[2]): void {
    this.fileActions.requestRightPanel(tab, url, options);
  }

  closeFilePreview(id: string): void {
    this.fileActions.closeFilePreview(id);
  }

  readProjectFile(projectId: string, filePath: string, signal: AbortSignal, worktreeId?: string) {
    return this.fileActions.readProjectFile(projectId, filePath, signal, worktreeId);
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
    await hydrateChatStore({
      getState: () => this.state,
      patchState: (patch) => this.updateState(patch),
      resumeRun: (sessionId) => this.runActions.resumeRun(sessionId),
      syncBackground: (sessionIds, attention) => this.background.sync({ sessionIds, attention }),
    });
    // 详情恢复后补拉目标与待接手交接：刷新页面时两者不应等到用户切换会话才出现。
    const sessionId = this.state.activeSessionId;
    if (!sessionId) return;
    void this.sessionActions.loadGoal(sessionId);
    void this.sessionActions.loadHandoffs(sessionId);
  }

  async refreshMeta(projectPath?: string): Promise<void> {
    await refreshChatMeta({ patchState: (patch) => this.updateState(patch) }, projectPath);
  }

  // ---- 会话动作（实现见 chat-session-actions） ----
  startNewChatDraft(options: {
    projectId?: string | null;
    sectionId?: string | null;
    worktree?: ChatSessionWorktree;
  } = {}): void {
    return this.sessionActions.startNewChatDraft(options);
  }

  /** 清除新会话草稿上预绑定的工作树（切换到已绑定工作树的会话时使用）。 */
  clearDraftWorktree(): void {
    return this.sessionActions.clearDraftWorktree();
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

  /** 保存用户编辑的目标文字；完成状态仍由 Agent 的目标工具维护。 */
  editGoal(objective: string): Promise<boolean> {
    return this.sessionActions.editGoal(objective);
  }

  /** 暂停/恢复目标自动续跑；是否继续仍由 Host 在每轮结束时判定。 */
  setGoalAutoContinue(autoContinue: boolean): Promise<boolean> {
    return this.sessionActions.setGoalAutoContinue(autoContinue);
  }

  /** 工作区被占用时给当前会话创建工作树并绑定，随后可并行重试。 */
  isolateWorkspace(): Promise<boolean> {
    return this.sessionActions.isolateWorkspace();
  }

  /** 读取当前会话的待接手交接；没有接口或失败时保持为空，不影响聊天。 */
  loadHandoffs(sessionId: string): Promise<void> {
    return this.sessionActions.loadHandoffs(sessionId);
  }

  /** 接手一条交接：创建同目标 goal 并刷新目标条。 */
  acceptHandoff(id: string): Promise<boolean> {
    return this.sessionActions.acceptHandoff(id);
  }

  /** 本地忽略一条交接（服务端仍保留，刷新后可能再次出现）。 */
  dismissHandoff(id: string): void {
    this.sessionActions.dismissHandoff(id);
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
  sendMessage(text: string, skillIds?: string[], referenceSources?: import("@lfaa/client-ui-tool-media/client").MediaSource[], attachmentIds?: string[]): Promise<void> {
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

  generateMediaFromPrompt(input: import("@lfaa/client-ui-tool-media/client").MediaGenerationInput) {
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
}
