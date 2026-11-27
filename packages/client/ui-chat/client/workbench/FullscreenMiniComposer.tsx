// 全屏视图左下角悬浮迷你对话栏：点击输入框平滑向上展开，完整复用 AssistantTimeline 流式输出（含思维链、工具活动行、审批与 Markdown），点击外部自动缩小。
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { IconArrowUp, IconChevronDown, IconFolder, IconMinus, IconPlus, IconSquare } from "@tabler/icons-react";
import { AssistantTimeline } from "../conversation/AssistantTimeline";
import type { ChatLocaleMessages } from "../locales";
import type { SessionMenuStore } from "../session/session-menu-store";
import type { ChatClientStore } from "../store/chat-store";
import styles from "./FullscreenMiniComposer.module.css";

type DockState = "compact" | "expanded" | "minimized";

export function FullscreenMiniComposer({
  locale,
  store,
  sessionMenuStore,
  sessionTitle,
  onOpenChatTab,
}: {
  locale: ChatLocaleMessages;
  store: ChatClientStore;
  sessionMenuStore?: SessionMenuStore | undefined;
  sessionTitle: string;
  onOpenChatTab: () => void;
}) {
  const isZh = locale.isZh;
  const snap = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [dockState, setDockState] = useState<DockState>("compact");
  const [draft, setDraft] = useState("");
  const dockRef = useRef<HTMLElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const sending = Boolean(snap.runningRunId);
  const activeSessionId = snap.activeSession?.id ?? snap.activeSessionId;
  const messages = snap.activeSession?.messages ?? [];
  const lastMsg = messages.at(-1);

  // 点击悬浮对话卡片外部任意位置时，自动缩小回紧凑两行输入态（点击会话操作菜单本身时不收起）。
  useEffect(() => {
    if (dockState !== "expanded") return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (dockRef.current && target instanceof Node && dockRef.current.contains(target)) return;
      if (target instanceof Element && target.closest("[data-session-action-menu]")) return;
      setDockState("compact");
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [dockState]);

  // 展开或收到流式增量（正文/思考/工具步骤）时自动滚到底部。
  useEffect(() => {
    if (dockState !== "expanded" || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [dockState, messages.length, lastMsg?.content, lastMsg?.reasoning, lastMsg?.steps?.length, sending]);

  async function submit() {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    setDockState("expanded");
    await store.sendMessage(text);
  }

  if (dockState === "minimized") {
    return (
      <button
        type="button"
        className={styles.collapsedPill}
        aria-label={isZh ? "展开快捷对话栏" : "Expand quick chat"}
        onClick={() => setDockState("compact")}
      >
        <IconFolder size={14} stroke={1.8} aria-hidden="true" />
        <span className={styles.sessionTitle}>{sessionTitle}</span>
      </button>
    );
  }

  return (
    <section
      ref={dockRef}
      className={styles.dock}
      data-expanded={dockState === "expanded" ? "true" : undefined}
      aria-label={isZh ? "全屏快捷对话" : "Fullscreen quick chat"}
    >
      <div className={styles.header}>
        <button
          type="button"
          className={styles.sessionBtn}
          data-session-more={activeSessionId || undefined}
          title={activeSessionId && sessionMenuStore ? (isZh ? "会话操作" : "Chat actions") : (isZh ? "切换到完整对话标签" : "Switch to full chat tab")}
          onClick={(event) => {
            if (activeSessionId && sessionMenuStore) {
              sessionMenuStore.toggleActionMenu(activeSessionId, event.currentTarget);
              return;
            }
            onOpenChatTab();
          }}
        >
          <IconFolder size={14} stroke={1.8} aria-hidden="true" />
          <span className={styles.sessionTitle}>{sessionTitle}</span>
          <IconChevronDown size={13} stroke={1.8} aria-hidden="true" />
        </button>

        <button
          type="button"
          className={styles.collapseBtn}
          aria-label={dockState === "expanded" ? (isZh ? "收起对话预览" : "Collapse preview") : (isZh ? "最小化对话栏" : "Minimize quick chat")}
          title={isZh ? "收起" : "Collapse"}
          onClick={() => setDockState((current) => (current === "expanded" ? "compact" : "minimized"))}
        >
          <IconMinus size={14} stroke={1.9} />
        </button>
      </div>

      <div className={styles.messagesWrap} aria-hidden={dockState !== "expanded"}>
        <div className={styles.messagesInner}>
          <div ref={listRef} className={styles.messages}>
            {messages.length === 0 ? (
              <p className={styles.emptyMsg}>{isZh ? "输入内容即可在当前会话中开始对话" : "Type below to start chatting"}</p>
            ) : (
              messages.slice(-12).map((msg, idx, list) => {
                const cleanContent = msg.content.replace(/<!--\s*suggestions:[\s\S]*?-->/gu, "").trim();
                const isStreamingThis = sending && msg.role === "assistant" && idx === list.length - 1;
                if (msg.role === "user") {
                  return <div key={msg.id} className={styles.userBubble}>{cleanContent}</div>;
                }
                return (
                  <div key={msg.id} className={styles.assistantMsg}>
                    <AssistantTimeline
                      locale={locale}
                      content={cleanContent}
                      reasoning={msg.reasoning}
                      progressText={msg.progressText}
                      steps={msg.steps ?? []}
                      createdAt={msg.createdAt}
                      runDurationMs={msg.runDurationMs}
                      reasoningDurationMs={msg.reasoningDurationMs}
                      tokenUsage={msg.tokenUsage}
                      isStreaming={isStreamingThis}
                      pendingApproval={isStreamingThis ? snap.pendingApproval : null}
                      onResolveApproval={(approved) => {
                        void store.resolveApproval(approved);
                      }}
                      onOpenFile={(filePath) => {
                        if (filePath && snap.activeSession?.projectId) store.openFilePreview(filePath, snap.activeSession.projectId);
                      }}
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className={styles.inputRow} onClick={() => setDockState("expanded")}>
        <button
          type="button"
          className={styles.plusBtn}
          aria-label={isZh ? "切换到对话添加附件" : "Open chat tab for attachments"}
          title={isZh ? "切换到对话添加附件" : "Open chat tab for attachments"}
          onClick={(e) => { e.stopPropagation(); onOpenChatTab(); }}
        >
          <IconPlus size={15} stroke={1.9} />
        </button>

        <input
          type="text"
          className={styles.input}
          value={draft}
          placeholder={isZh ? "使用 小鱼 工作" : "Work with Xiaoyu"}
          onFocus={() => setDockState("expanded")}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void submit();
            }
          }}
        />

        {sending ? (
          <button
            type="button"
            className={styles.sendBtn}
            aria-label={isZh ? "停止生成" : "Stop"}
            onClick={(e) => { e.stopPropagation(); void store.abortActiveRun(); }}
          >
            <IconSquare size={12} fill="currentColor" />
          </button>
        ) : (
          <button
            type="button"
            className={styles.sendBtn}
            aria-label={isZh ? "发送" : "Send"}
            disabled={!draft.trim()}
            onClick={(e) => { e.stopPropagation(); void submit(); }}
          >
            <IconArrowUp size={15} stroke={2.2} />
          </button>
        )}
      </div>
    </section>
  );
}
