// 渲染中央聊天工作区：空会话引导、流式回复、Agent 思考/行动/检查轨迹卡片与底部输入栏。
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { IconArrowDown } from "@tabler/icons-react";
import type { WorkbenchProjectItem, WorkbenchProjectProvider } from "@lfaa/ui-layout";
import type { ChatClientStore } from "../chat-store";
import type { ChatMessageItem } from "../chat-types";
import type { ChatLocaleMessages } from "../locales";
import { collectEditedFiles } from "../file-activity";
import { useChatScroll } from "../useChatScroll";
import { ChatAnchorBar, buildTurnAnchors } from "./ChatAnchorBar";
import { ChatComposer } from "./ChatComposer";
import { ChatDeleteDialog } from "./ChatDeleteDialog";
import { ChatMessageList } from "./ChatMessageList";
import { ConversationTrace } from "./Conversation-Trace";
import { useChatComposer } from "./useChatComposer";
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

  // 最后一条助手消息完成后，向 Host 请求模型生成的追问建议（按消息缓存）。
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant" || last.status === "streaming" || last.clarification || !last.content.trim()) return;
    if (suggestionsByMessage[last.id]) return;
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
        if (cancelled || !Array.isArray(data.suggestions) || data.suggestions.length === 0) return;
        setSuggestionsByMessage((prev) => ({ ...prev, [last.id]: data.suggestions ?? [] }));
      } catch {
        // 生成失败时不展示建议，不回退到模板。
      }
    })();
    return () => { cancelled = true; };
  }, [messages, suggestionsByMessage]);

  const activeProjectId = activeSession ? activeSession.projectId : state.draftProjectId;
  const activeProfile = state.profiles.find((p) => p.id === state.activeProfileId) ?? state.profiles[0];
  const needsApiKey = Boolean(activeProfile && activeProfile.kind !== "ollama" && !activeProfile.hasApiKey);
  const isRunning = Boolean(state.runningRunId);
  const selectedFile = state.filePreviewTabs?.find((tab) => tab.id === state.activeFilePreviewId);

  const turnAnchors = useMemo(() => buildTurnAnchors(messages), [messages]);
  const { scrollAreaRef, threadRef, showScrollBottom, scrollToLatest, pauseFollowing, trackScroll } =
    useChatScroll(activeSession?.id ?? null, turnAnchors.at(-1)?.anchorMsgId, isRunning);

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

  const handleEditContent = (content: string) => {
    composer.setDraft(content);
    composer.textareaRef.current?.focus();
  };

  const handleBranchToNewChat = (message: ChatMessageItem) => {
    store.startNewChatDraft({
      projectId: activeProjectId,
      sectionId: activeSession?.sectionId ?? null,
    });
    composer.setDraft(
      locale.isZh
        ? `基于以下前文继续探讨：\n> ${message.content.slice(0, 180).replace(/\n+/g, " ")}\n\n`
        : `Continue from:\n> ${message.content.slice(0, 180).replace(/\n+/g, " ")}\n\n`,
    );
    composer.textareaRef.current?.focus();
  };

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
          suggestionsByMessage={suggestionsByMessage}
          selectedFile={selectedFile}
          pendingApproval={state.pendingApproval}
          memoriesCount={state.memories.length}
          isRunning={isRunning}
          showHomeSuggestions={state.generalSettings.homeSuggestions}
          assistantBodyClass={styles.assistantBody}
          noticeLinkClass={composerStyles.noticeLink}
          threadRef={threadRef}
          onOpenFilePreview={onOpenFilePreview}
          onOpenTurnChanges={onOpenTurnChanges}
          onEditContent={handleEditContent}
          onOpenTrace={(messageId, stepId) => { setTraceTarget({ messageId, stepId }); setView("trace"); }}
          onBranchToNewChat={handleBranchToNewChat}
          onContinueInterrupted={(messageId) => void store.continueInterruptedMessage(messageId)}
          onSubmitQuestion={(question) => void composer.handleSubmit(question)}
          onResolveApproval={(approved) => void store.resolveApproval(approved)}
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
          onSelectProject={(projectId) => void changeProjectBinding(projectId)}
          onCreateProject={() => setCreateDialogOpen(true)}
          onAnswerClarification={(answer) => void store.sendMessage(answer).catch((error: unknown) => composer.setContextNotice(String(error)))}
          onOpenSettings={onOpenSettings}
          onOpenBrowser={onOpenBrowser}
          onDeleteRequest={() => setDeleteConfirmOpen(true)}
          onOpenTurnChanges={onOpenTurnChanges}
        />
      </div>

      {createDialogOpen && projectProvider?.renderCreateDialog({
        onCreated: (project) => {
          setCreateDialogOpen(false);
          void changeProjectBinding(project.id);
        },
        onClose: () => setCreateDialogOpen(false),
      })}

      <ChatDeleteDialog
        locale={locale}
        open={Boolean(deleteConfirmOpen && activeSession)}
        subtitle={activeSession?.title ?? ""}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={() => {
          if (activeSession) void store.deleteSession(activeSession.id);
          setDeleteConfirmOpen(false);
        }}
      />
    </section>
  );
}