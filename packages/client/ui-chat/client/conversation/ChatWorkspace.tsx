// 渲染中央聊天工作区：空会话引导、流式回复、Agent 思考/行动/检查轨迹卡片与底部输入栏。
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { IconArrowDown } from "@tabler/icons-react";
import type { WorkspaceMode } from "@lfaa/ui-layout/client";
import type { WorkbenchProjectItem, WorkbenchProjectProvider } from "@lfaa/ui-layout";
import type { ChatClientStore } from "../store/chat-store";
import type { ChatLocaleMessages } from "../locales";
import { summarizeTurnChanges } from "../shared/file-activity";
import { useStarterSuggestions } from "./useStarterSuggestions";
import { useChatComposerHeight, useChatGutterReclaim } from "./useChatLayoutInsets";
import { useChatScroll } from "./useChatScroll";
import { ChatAnchorBar, buildTurnAnchors } from "./ChatAnchorBar";
import { ChatComposer } from "../composer/ChatComposer";
import { ChatMessageList } from "./ChatMessageList";
import { ConversationTrace } from "./Conversation-Trace";
import { SessionBars } from "../session/SessionBars";
import { HandoffBar } from "../session/HandoffBar";
import { latestSessionTodos } from "../session/session-todos";
import { useChatComposer } from "../composer/useChatComposer";
import { useMessageActions } from "./useMessageActions";
import { WorkspaceDialogs } from "./WorkspaceDialogs";
import { ChatErrorBanner } from "./ChatErrorBanner";
import styles from "./ChatWorkspace.module.css";
import composerStyles from "./ChatWorkspace.composer.module.css";

/** 装配会话时间线、流式反馈和输入栏，将发送、停止与历史操作交给聊天 Store。 */
export function ChatWorkspace({
  locale,
  store,
  projects,
  projectProvider,
  workspaceMode,
  onWorkspaceModeChange,
  onProjectContextChange,
  onOpenSettings,
  onOpenTurnChanges,
  onOpenFilePreview,
  onOpenBrowser,
}: {
  locale: ChatLocaleMessages;
  store: ChatClientStore;
  projects: WorkbenchProjectItem[];
  projectProvider?: WorkbenchProjectProvider<ReactNode> | null | undefined;
  /** 中心区「聊天 / 工作」：空会话时由中心区分段切换，决定输入栏信息密度。 */
  workspaceMode: WorkspaceMode;
  onWorkspaceModeChange: (mode: WorkspaceMode) => void;
  /** 在输入框切换或解绑项目时回写工作台项目上下文，供左二高亮与顶部「新聊天」沿用。 */
  onProjectContextChange?: ((projectId: string | null) => void) | undefined;
  onOpenSettings: () => void;
  onOpenTurnChanges?: ((messageId: string) => void) | undefined;
  onOpenFilePreview: (messageId: string, stepId: string) => void;
  onOpenBrowser?: (() => void) | undefined;
}) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [view, setView] = useState<"chat" | "trace">("chat");
  const [traceTarget, setTraceTarget] = useState<{ messageId: string; stepId: string } | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [bindingProject, setBindingProject] = useState(false);
  const projectBindingPending = useRef(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [activeTurnIndex, setActiveTurnIndex] = useState(0);

  const activeSession = state.activeSession;
  const messages = activeSession?.messages ?? [];
  const lastMessage = messages.at(-1);
  const clarification = lastMessage?.status === "done" ? lastMessage.clarification : undefined;
  const turnChanges = useMemo(() => summarizeTurnChanges(lastMessage), [lastMessage]);

  const activeProjectId = activeSession ? activeSession.projectId : state.draftProjectId;
  // 项目内空会话展示项目范围，提醒用户与模型都围绕该项目工作。
  const activeProject = activeProjectId ? projects.find((item) => item.id === activeProjectId) ?? null : null;
  // 已绑定或草稿绑定的工作树；发送前由草稿状态展示，发送后以服务端会话为准。
  const activeWorktree = activeSession?.worktree ?? state.draftWorktree ?? null;
  const clearWorktree = () => {
    if (activeSession) void store.updateSessionMeta(activeSession.id, { worktreeId: null });
    else store.clearDraftWorktree();
  };
  const activeProfile = state.profiles.find((p) => p.id === state.activeProfileId) ?? state.profiles[0];
  const activeKind = activeProfile?.availableModels?.find((model) => model.id === activeProfile.model)?.modelKind;
  const starterSuggestions = useStarterSuggestions({
    messages,
    activeProjectId,
    activeKind,
    homeSuggestions: state.generalSettings.homeSuggestions,
  });

  const needsApiKey = Boolean(activeProfile && activeProfile.kind !== "ollama" && !activeProfile.hasApiKey);
  const isRunning = Boolean(state.runningRunId);
  const paused = !isRunning
    && lastMessage?.role === "assistant"
    && lastMessage.status === "aborted"
    && Boolean(lastMessage.content.trim());
  const selectedFile = state.filePreviewTabs?.find((tab) => tab.id === state.activeFilePreviewId);

  const turnAnchors = useMemo(() => buildTurnAnchors(messages), [messages]);
  // 任务清单由 Agent 写入会话记录；旧会话没有该字段时回落到步骤里的最近一次。
  const sessionTodos = useMemo(
    () => (activeSession?.todos && activeSession.todos.length > 0 ? activeSession.todos : latestSessionTodos(messages)),
    [activeSession?.todos, messages],
  );
  const { scrollAreaRef, threadRef, showScrollBottom, scrollToLatest, pauseFollowing, trackScroll, isProgrammaticScroll } =
    useChatScroll(activeSession?.id ?? null, turnAnchors.at(-1)?.anchorMsgId, isRunning);
  const anchorScanRafRef = useRef<number | null>(null);
  const rootRef = useRef<HTMLElement>(null);
  const composerDockRef = useRef<HTMLDivElement>(null);
  useEffect(() => () => {
    if (anchorScanRafRef.current !== null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(anchorScanRafRef.current);
    }
  }, []);

  // 外层工作区视口给「长页面」常驻预留的滚动条槽与输入区高度都由下面两个 hook 实测，
// 会话页自己收回槽位、正文末端让出输入区高度。
  useChatGutterReclaim(rootRef);
  useChatComposerHeight(rootRef, composerDockRef);
  const handleOpenTrace = useCallback((messageId: string, stepId: string) => {
    setTraceTarget({ messageId, stepId });
    setView("trace");
  }, []);

  // 搜索结果打开会话后暂停触底跟随，滚动到命中的消息并短暂高亮；定位完成即消费请求。
  const pendingJump = state.pendingMessageJump;
  useEffect(() => {
    if (!pendingJump || state.activeSessionId !== pendingJump.sessionId) return;
    if (!activeSession?.messages.some((message) => message.id === pendingJump.messageId)) return;
    pauseFollowing();
    const highlight = (attempt: number) => {
      const element = document.getElementById(`chat-message-${pendingJump.messageId}`);
      if (!element) {
        if (attempt < 3) window.setTimeout(() => highlight(attempt + 1), 180);
        return;
      }
      element.scrollIntoView({ block: "center", behavior: "smooth" });
      element.setAttribute("data-search-hit", "true");
      window.setTimeout(() => element.removeAttribute("data-search-hit"), 3200);
      store.consumeMessageJump(pendingJump.nonce);
    };
    const timer = window.setTimeout(() => highlight(0), 260);
    return () => window.clearTimeout(timer);
  }, [activeSession, pendingJump, state.activeSessionId, store]);

  const composer = useChatComposer({
    store,
    locale,
    state,
    activeSession,
    activeProjectId,
    isRunning,
    needsApiKey,
    onOpenSettings,
    projectBindingPending,
  });

  // 项目列表加载完后若记忆的草稿项目已不存在，自动清理，避免残留失效绑定。
  useEffect(() => {
    if (activeSession || !state.draftProjectId || !projectProvider?.hasLoaded?.()) return;
    if (!activeProject) {
      void store.setActiveProjectBinding(null);
      onProjectContextChange?.(null);
    }
  }, [activeProject, activeSession, onProjectContextChange, projectProvider, state.draftProjectId, store]);

  // 等待项目绑定写回，避免用户立即发送时沿用旧目录，并同步左二项目上下文。
  const changeProjectBinding = async (projectId: string | null) => {
    if (isRunning || projectBindingPending.current) return;
    projectBindingPending.current = true;
    setBindingProject(true);
    composer.setContextNotice("");
    try {
      await store.setActiveProjectBinding(projectId);
      onProjectContextChange?.(projectId);
    } catch (error) {
      composer.setContextNotice(error instanceof Error ? error.message : String(error));
    } finally {
      projectBindingPending.current = false;
      setBindingProject(false);
    }
  };

  // 消息区动作（编辑、分叉、继续中断、提问、审批、媒体再生成）统一由 useMessageActions 提供。
  const messageActions = useMessageActions({
    store,
    composer,
    locale,
    activeSession,
    activeProjectId,
    busy: isRunning || state.submittingMessage === true || bindingProject,
  });

  // 刷新后已记住会话但详情尚未回来：先按会话骨架渲染，避免闪一下「我们要做什么？」再跳到历史对话。
  // 只有确定没有活动会话（全是新会话）时才展示中心引导区，输入栏位置不会来回跳。
  const restoringSession = !state.loaded && Boolean(state.activeSessionId);
  // 空会话时输入栏并入中心引导区，有消息后回到底部停靠位；停靠时统一用「占位行 + 工具行」的宽卡片。
  const composerInHero = messages.length === 0 && !restoringSession && view === "chat";
  const composerNode = (
    <ChatComposer
      locale={locale}
      store={store}
      state={state}
      composer={composer}
      projects={projects}
      workspaceMode={workspaceMode}
      docked={composerInHero === false}
      canCreateProject={Boolean(projectProvider)}
      activeProjectId={activeProjectId}
      activeSession={activeSession}
      messages={messages}
      messagesCount={messages.length}
      isRunning={isRunning}
      needsApiKey={needsApiKey}
      clarification={clarification}
      lastMessageId={lastMessage?.id}
      bindingProject={bindingProject}
      stats={turnChanges}
      worktree={activeWorktree ? { branch: activeWorktree.branch, path: activeWorktree.path } : null}
      {...(activeWorktree ? { onClearWorktree: clearWorktree } : {})}
      onSelectProject={(projectId) => void changeProjectBinding(projectId)}
      onCreateProject={() => setCreateDialogOpen(true)}
      onAnswerClarification={(answer) => void store.sendMessage(answer).catch((error: unknown) => composer.setContextNotice(String(error)))}
      onSkipClarification={() => {
        const sessionId = activeSession?.id;
        if (!sessionId) return;
        void store.dismissClarification(sessionId).catch((error: unknown) => composer.setContextNotice(String(error)));
      }}
      onOpenSettings={onOpenSettings}
      onOpenBrowser={onOpenBrowser}
      onDeleteRequest={() => setDeleteConfirmOpen(true)}
      onOpenTurnChanges={onOpenTurnChanges}
    />
  );

  return (
    <section ref={rootRef} className={styles.root} aria-label={locale.workspaceTitle}>
      <nav className={styles.viewTabs} aria-label={locale.isZh ? "会话视图" : "Conversation views"}>
        <button type="button" aria-current={view === "chat" ? "page" : undefined} onClick={() => setView("chat")}>{locale.isZh ? "对话" : "Chat"}</button>
        <button type="button" aria-current={view === "trace" ? "page" : undefined} onClick={() => setView("trace")}>{locale.isZh ? "轨迹" : "Trace"}</button>
      </nav>
      {view === "trace" && <ConversationTrace key={activeSession?.id ?? "draft"} messages={messages} locale={locale} target={traceTarget} pendingApproval={state.pendingApproval} onResolveApproval={(approved) => void store.resolveApproval(approved)} />}
      <div ref={scrollAreaRef} className={styles.scrollArea} hidden={view !== "chat"} onScroll={(event) => {
          const el = event.currentTarget;
          trackScroll(el);
          // 流式自动贴底期间跳过锚点几何扫描，避免每帧同步 getBoundingClientRect 引起强制回流。
          if (turnAnchors.length === 0 || isProgrammaticScroll() || anchorScanRafRef.current !== null) return;
          anchorScanRafRef.current = requestAnimationFrame(() => {
            anchorScanRafRef.current = null;
            const containerTop = el.getBoundingClientRect().top + 96;
            let bestIdx = 0;
            const nodes = el.querySelectorAll<HTMLElement>("[data-turn-anchor]");
            nodes.forEach((node, idx) => {
              if (node.getBoundingClientRect().top <= containerTop) bestIdx = idx;
            });
            setActiveTurnIndex((prev) => (prev === bestIdx ? prev : bestIdx));
          });
        }}
      >
        <ChatMessageList
          locale={locale}
          messages={messages}
          lastMessage={lastMessage}
          clarification={clarification}
          starterSuggestions={starterSuggestions}
          projectScope={activeProject
            ? { name: activeProject.name, description: activeProject.description?.trim() ?? "" }
            : null}
          workspaceMode={workspaceMode}
          onWorkspaceModeChange={onWorkspaceModeChange}
          restoring={restoringSession}
          heroComposer={composerInHero ? composerNode : null}
          selectedFile={selectedFile}
          pendingApproval={state.pendingApproval}
          memoriesCount={state.memories.length}
          isRunning={isRunning}
          showHomeSuggestions={state.generalSettings.homeSuggestions}
          brandWatermark={state.generalSettings.imageWatermark}
          activeSessionId={activeSession?.id ?? ""}
          assistantBodyClass={styles.assistantBody}
          noticeLinkClass={composerStyles.noticeLink}
          threadRef={threadRef}
          onOpenFilePreview={onOpenFilePreview}
          onOpenTurnChanges={onOpenTurnChanges}
          onOpenBrowser={onOpenBrowser}
          onOpenSubagent={(subagentId, role) => {
            store.requestRightPanel("subagent", subagentId, { autoExpand: true, ...(role ? { subagentRole: role } : {}) });
          }}
          onEditContent={messageActions.onEditContent}
          onOpenTrace={handleOpenTrace}
          onBranchToNewChat={messageActions.onBranchToNewChat}
          onContinueInterrupted={messageActions.onContinueInterrupted}
          onSubmitQuestion={messageActions.onSubmitQuestion}
          onResolveApproval={messageActions.onResolveApproval}
          mediaActions={messageActions.mediaActions}
        />
      </div>

      {view === "chat" && <ChatAnchorBar
        turns={turnAnchors}
        activeTurnIndex={activeTurnIndex}
        onJumpToTurn={(anchorMsgId, idx) => {
          setActiveTurnIndex(idx);
          const viewport = scrollAreaRef.current;
          const target = viewport?.querySelector<HTMLElement>(`[data-turn-anchor="${anchorMsgId}"]`);
          if (!viewport || !target) return;
          pauseFollowing();
          viewport.scrollTo({
            top: viewport.scrollTop + target.getBoundingClientRect().top - viewport.getBoundingClientRect().top,
            behavior: isRunning ? "instant" : "smooth",
          });
        }}
      />}

      <div ref={composerDockRef} className={styles.composerDock}>
        {showScrollBottom && messages.length > 0 && (
          <button
            type="button"
            className={styles.scrollBottomBtn}
            aria-label={locale.isZh ? "回到底部" : "Scroll to bottom"}
            onClick={scrollToLatest}
          >
            <IconArrowDown size={15} stroke={2} />
          </button>
        )}
        {state.errorMessage && (
          <ChatErrorBanner
            message={state.errorMessage}
            isZh={locale.isZh}
            showIsolate={state.workspaceConflict === true}
            onIsolate={() => void store.isolateWorkspace()}
          />
        )}
        {state.streamStatusNotice && (
          <div className={composerStyles.noticeBar} role="status">
            <span>{state.streamStatusNotice}</span>
            {state.degradedStream && (
              <button type="button" className={composerStyles.noticeLink} onClick={() => store.retryDegradedStream()}>
                {locale.isZh ? "立即重试恢复" : "Retry now"}
              </button>
            )}
          </div>
        )}
        {state.handoffs.length > 0 && (
          <div className={styles.composerStack}>
            <HandoffBar
              handoff={state.handoffs[0]!}
              isZh={locale.isZh}
              onAccept={() => void store.acceptHandoff(state.handoffs[0]!.id)}
              onDismiss={() => store.dismissHandoff(state.handoffs[0]!.id)}
            />
          </div>
        )}
        <SessionBars
          view={view}
          todos={sessionTodos}
          paused={paused}
          settled={!isRunning && lastMessage?.role === "assistant" && lastMessage.status === "done"}
          goal={state.activeGoal}
          isZh={locale.isZh}
          className={styles.composerStack}
          onEditGoal={(objective) => store.editGoal(objective)}
          onToggleGoalAuto={(next) => store.setGoalAutoContinue(next)}
        />
        {!composerInHero && composerNode}
      </div>

      <WorkspaceDialogs
        locale={locale}
        store={store}
        activeSession={activeSession}
        projectProvider={projectProvider}
        projectDialogOpen={createDialogOpen}
        deleteDialogOpen={deleteConfirmOpen}
        onCreatedProject={(project) => {
          setCreateDialogOpen(false);
          void changeProjectBinding(project.id);
        }}
        onCloseProjectDialog={() => setCreateDialogOpen(false)}
        onCloseDeleteDialog={() => setDeleteConfirmOpen(false)}
      />
    </section>
  );
}
