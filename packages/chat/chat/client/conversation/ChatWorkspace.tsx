// 渲染中央聊天工作区：空会话引导、流式回复、Agent 思考/行动/检查轨迹卡片与底部输入栏。
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { IconArrowDown } from "@tabler/icons-react";
import type { WorkbenchProjectItem, WorkbenchProjectProvider } from "@lfaa/ui-layout";
import type { ChatClientStore } from "../store/chat-store";
import type { ChatLocaleMessages } from "../locales";
import { collectEditedFiles } from "../shared/file-activity";
import { extractAdviceOptions } from "./advice-options";
import { useChatScroll } from "./useChatScroll";
import { ChatAnchorBar, buildTurnAnchors } from "./ChatAnchorBar";
import { ChatComposer } from "../composer/ChatComposer";
import { ChatMessageList } from "./ChatMessageList";
import { ConversationTrace } from "./Conversation-Trace";
import { SessionBars } from "../session/SessionBars";
import { latestSessionTodos } from "../session/session-todos";
import { useChatComposer } from "../composer/useChatComposer";
import { useMessageActions } from "./useMessageActions";
import { WorkspaceDialogs } from "./WorkspaceDialogs";
import styles from "./ChatWorkspace.module.css";
import composerStyles from "./ChatWorkspace.composer.module.css";

/** 装配会话时间线、流式反馈和输入栏，将发送、停止与历史操作交给聊天 Store。 */
export function ChatWorkspace({
  locale,
  store,
  projects,
  projectProvider,
  onOpenSettings,
  onOpenTurnChanges,
  onOpenFilePreview,
  onOpenBrowser,
}: {
  locale: ChatLocaleMessages;
  store: ChatClientStore;
  projects: WorkbenchProjectItem[];
  projectProvider?: WorkbenchProjectProvider<ReactNode> | null | undefined;
  onOpenSettings: () => void;
  onOpenTurnChanges?: ((messageId: string) => void) | undefined;
  onOpenFilePreview: (messageId: string, stepId: string) => void;
  onOpenBrowser?: (() => void) | undefined;
}) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [view, setView] = useState<"chat" | "trace">("chat");
  const [traceTarget, setTraceTarget] = useState<{ messageId: string; stepId: string } | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  // 项目起步建议：空会话且绑定项目时按项目缓存一次，围绕该项目给出起步请求。
  const [startersByProject, setStartersByProject] = useState<Record<string, string[]>>({});
  // 追问建议由模型生成：按消息 id 缓存，失败或为空则不展示（不回退模板）。
  const [suggestionsByMessage, setSuggestionsByMessage] = useState<Record<string, string[]>>({});
  const [bindingProject, setBindingProject] = useState(false);
  const projectBindingPending = useRef(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [activeTurnIndex, setActiveTurnIndex] = useState(0);

  const activeSession = state.activeSession;
  const messages = activeSession?.messages ?? [];
  const lastMessage = messages.at(-1);
  const clarification = lastMessage?.status === "done" ? lastMessage.clarification : undefined;
  const latestFiles = collectEditedFiles(lastMessage?.role === "assistant" ? lastMessage.steps ?? [] : []);
  const countedChanges = latestFiles.length > 0 && latestFiles.every((file) => file.hasCounts);
  const latestAdded = latestFiles.reduce((sum, file) => sum + file.added, 0);
  const latestRemoved = latestFiles.reduce((sum, file) => sum + file.removed, 0);

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

  // 空会话且绑定项目时，向 Host 请求围绕该项目的起步建议（按项目缓存，失败回退通用引导）。
  useEffect(() => {
    if (messages.length > 0 || !activeProjectId || !state.generalSettings.homeSuggestions || (activeKind && activeKind !== "chat")) return;
    if (startersByProject[activeProjectId]) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/chat/starter-suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: activeProjectId }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions?: string[] };
        if (cancelled || !Array.isArray(data.suggestions) || data.suggestions.length === 0) return;
        setStartersByProject((prev) => ({ ...prev, [activeProjectId]: data.suggestions ?? [] }));
      } catch {
        // 生成失败时回退到通用引导。
      }
    })();
    return () => { cancelled = true; };
  }, [messages.length, activeProjectId, activeKind, state.generalSettings.homeSuggestions, startersByProject]);

  // 智能建议：回答里的「建议/下一步」清单在正文内联为编号选项（不重复出现在底部）；
  // 底部生成式推荐只在新会话的第一轮触发，多轮后不再机械追问。
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (activeKind && activeKind !== "chat") return;
    if (!last || last.role !== "assistant" || last.status === "streaming" || last.clarification || !last.content.trim()) return;
    if (suggestionsByMessage[last.id]) return;
    // 媒体生成结果（图片/视频/语音）不生成后续对话推荐，避免用媒体模型发聊天请求。
    if (/!\[[^\]]*\]\(\/api\/media\/file\?/u.test(last.content)) return;
    if (extractAdviceOptions(last.content).length >= 2) return;
    const assistantTurns = messages.filter((message) => message.role === "assistant").length;
    if (assistantTurns !== 1) return;
    const prompt = messages[messages.length - 2]?.role === "user" ? (messages[messages.length - 2]?.content ?? "") : "";
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/chat/suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userPrompt: prompt, assistantReply: last.content }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions?: string[] };
        if (cancelled || !Array.isArray(data.suggestions)) return;
        const fresh = data.suggestions
          .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          .slice(0, 3);
        if (fresh.length === 0) return;
        setSuggestionsByMessage((prev) => ({ ...prev, [last.id]: fresh }));
      } catch {
        // 生成失败时不出选项，不回退到模板。
      }
    })();
    return () => { cancelled = true; };
  }, [activeKind, messages, suggestionsByMessage]);

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
  const { scrollAreaRef, threadRef, showScrollBottom, scrollToLatest, pauseFollowing, trackScroll } =
    useChatScroll(activeSession?.id ?? null, turnAnchors.at(-1)?.anchorMsgId, isRunning);

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

  // 等待项目绑定写回，避免用户立即发送时沿用旧目录。
  const changeProjectBinding = async (projectId: string | null) => {
    if (isRunning || projectBindingPending.current) return;
    projectBindingPending.current = true;
    setBindingProject(true);
    composer.setContextNotice("");
    try {
      await store.setActiveProjectBinding(projectId);
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

  return (
    <section className={styles.root} aria-label={locale.workspaceTitle}>
      <nav className={styles.viewTabs} aria-label={locale.isZh ? "会话视图" : "Conversation views"}>
        <button type="button" aria-current={view === "chat" ? "page" : undefined} onClick={() => setView("chat")}>{locale.isZh ? "对话" : "Chat"}</button>
        <button type="button" aria-current={view === "trace" ? "page" : undefined} onClick={() => setView("trace")}>{locale.isZh ? "轨迹" : "Trace"}</button>
      </nav>
      {view === "trace" && <ConversationTrace key={activeSession?.id ?? "draft"} messages={messages} locale={locale} target={traceTarget} pendingApproval={state.pendingApproval} onResolveApproval={(approved) => void store.resolveApproval(approved)} />}
      <div
        ref={scrollAreaRef}
        className={styles.scrollArea}
        hidden={view !== "chat"}
        onScroll={(event) => {
          const el = event.currentTarget;
          trackScroll(el);
          if (turnAnchors.length > 0) {
            const containerTop = el.getBoundingClientRect().top + 96;
            let bestIdx = 0;
            const nodes = el.querySelectorAll<HTMLElement>("[data-turn-anchor]");
            nodes.forEach((node, idx) => {
              if (node.getBoundingClientRect().top <= containerTop) {
                bestIdx = idx;
              }
            });
            setActiveTurnIndex(bestIdx);
          }
        }}
      >
        <ChatMessageList
          locale={locale}
          messages={messages}
          lastMessage={lastMessage}
          clarification={clarification}
          starterSuggestions={activeProjectId ? startersByProject[activeProjectId] ?? null : null}
          projectScope={activeProject
            ? { name: activeProject.name, description: activeProject.description?.trim() ?? "" }
            : null}
          suggestionsByMessage={suggestionsByMessage}
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
          onEditContent={messageActions.onEditContent}
          onOpenTrace={(messageId, stepId) => { setTraceTarget({ messageId, stepId }); setView("trace"); }}
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

      <div className={styles.composerDock}>
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
          <div className={styles.errorBanner} role="alert">{state.errorMessage}</div>
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
        <SessionBars
          view={view}
          todos={sessionTodos}
          paused={paused}
          goal={state.activeGoal}
          isZh={locale.isZh}
          className={styles.composerStack}
          onEditGoal={(objective) => store.editGoal(objective)}
        />
        <ChatComposer
          locale={locale}
          store={store}
          state={state}
          composer={composer}
          projects={projects}
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
          stats={{ filesCount: latestFiles.length, countedChanges, added: latestAdded, removed: latestRemoved }}
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
