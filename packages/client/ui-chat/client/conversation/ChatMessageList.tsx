// 聊天消息区：空会话引导（鱼形图标 / 标题 / 聊天·工作分段 / 工作模式的项目范围提示条 / 内嵌输入栏 / 统一轻量起步建议）与隔离记忆化的消息线程。
import type { ReactNode, RefObject } from "react";
import { useMemo, useRef, useState, useLayoutEffect } from "react";
import { IconFish } from "@tabler/icons-react";
import type { WorkspaceMode } from "@lfaa/ui-layout/client";
import type { ChatMessageItem, FilePreviewTab, PendingApprovalBanner } from "../store/chat-types";
import type { ChatLocaleMessages } from "../locales";
import type { MediaResultContextValue } from "@lfaa/client-ui-tool-media/client";
import { formatDayDivider } from "./MessageActionBars";
import { ChatMessageRow } from "./ChatMessageRow";
import { ChatSuggestions } from "./ChatSuggestions";
import { collectPriorSuggestions, EMPTY_PRIOR_SUGGESTIONS, stabilizePriorSuggestions } from "./prior-suggestions";
import { readStoredThreadVirtualization } from "../store/chat-preferences";
import { shouldVirtualizeThread } from "./thread-window";
import { useThreadWindow, type ThreadWindowHandle } from "./use-thread-window";
import styles from "./ChatWorkspace.module.css";
import heroStyles from "./ChatWorkspace.hero.module.css";

/**
 * 计算每条消息渲染时的「历史建议前缀」，并在内容没变时复用上一次的数组引用。
 * messages 数组在流式输出里每帧都会换引用：按内容而不是按引用缓存，ChatMessageRow 的 memo 才不会失效。
 */
function useStablePriorSuggestions(messages: ChatMessageItem[]): string[][] {
  const prefixesRef = useRef<string[][]>([]);
  const parsedRef = useRef(new Map<string, { content: string; suggestions: string[] }>());

  return useMemo(() => {
    const next = collectPriorSuggestions(messages, parsedRef.current);
    const stable = stabilizePriorSuggestions(prefixesRef.current, next);
    prefixesRef.current = stable;
    return stable;
  }, [messages]);
}

/** 恢复会话时的静态消息骨架：与真实消息共用同一条宽度轴，详情回来时只替换内容、不挪动输入栏。 */
function ConversationSkeleton({ isZh }: { isZh: boolean }) {
  return (
    <div className={heroStyles.restoreSkeleton} role="status" aria-busy="true" aria-live="polite">
      <span className={heroStyles.srOnly}>{isZh ? "正在恢复对话…" : "Restoring conversation…"}</span>
      <div className={`${heroStyles.restoreBubble}`} aria-hidden="true" />
      {[0, 1].map((group) => (
        <div key={group} className={heroStyles.restoreGroup} aria-hidden="true">
          <span className={heroStyles.restoreLine} />
          <span className={`${heroStyles.restoreLine} ${heroStyles.restoreLineShort}`} />
          <span className={`${heroStyles.restoreLine} ${heroStyles.restoreLineTiny}`} />
        </div>
      ))}
      <div className={`${heroStyles.restoreBubble} ${heroStyles.restoreBubbleSmall}`} aria-hidden="true" />
      <div className={heroStyles.restoreGroup} aria-hidden="true">
        <span className={heroStyles.restoreLine} />
        <span className={`${heroStyles.restoreLine} ${heroStyles.restoreLineTiny}`} />
      </div>
    </div>
  );
}

export function ChatMessageList({
  locale,
  messages,
  lastMessage,
  clarification,
  starterSuggestions,
  projectScope,
  workspaceMode,
  restoring,
  heroComposer,
  onWorkspaceModeChange,
  selectedFile,
  pendingApproval,
  memoriesCount,
  isRunning,
  showHomeSuggestions,
  brandWatermark,
  activeSessionId,
  assistantBodyClass,
  noticeLinkClass,
  onOpenFilePreview,
  onOpenTurnChanges,
  onOpenBrowser,
  onOpenSubagent,
  onEditContent,
  onOpenTrace,
  onBranchToNewChat,
  onContinueInterrupted,
  onSubmitQuestion,
  onResolveApproval,
  mediaActions,
  threadRef,
  scrollElementRef,
  windowHandleRef,
}: {
  locale: ChatLocaleMessages;
  messages: ChatMessageItem[];
  lastMessage: ChatMessageItem | undefined;
  clarification: ChatMessageItem["clarification"];
  starterSuggestions: string[] | null;
  /** 项目内空会话展示的范围摘要；未绑定项目时为 null。 */
  projectScope: { name: string; description: string } | null;
  /** 中心区的「聊天 / 工作」形态：标题、提示与输入栏密度都按它切换。 */
  workspaceMode: WorkspaceMode;
  /** 刷新后正在恢复已记住的会话：先渲染消息骨架，不能先把空态引导闪出来。 */
  restoring?: boolean;
  /** 空会话时内嵌到中心区的输入栏；有消息时输入栏留在底部，这里为 null。 */
  heroComposer?: ReactNode;
  onWorkspaceModeChange: (mode: WorkspaceMode) => void;
  selectedFile: FilePreviewTab | undefined;
  pendingApproval: PendingApprovalBanner | null;
  memoriesCount: number;
  isRunning: boolean;
  showHomeSuggestions: boolean;
  /** 生成的图片是否叠加「小鱼 agent 生成」水印（设置中心可关闭）。 */
  brandWatermark: boolean;
  activeSessionId: string | null | undefined;
  assistantBodyClass: string | undefined;
  noticeLinkClass: string | undefined;
  onOpenFilePreview: (messageId: string, stepId: string) => void;
  onOpenTurnChanges?: ((messageId: string) => void) | undefined;
  onOpenBrowser?: (() => void) | undefined;
  onOpenSubagent?: ((subagentId: string, role?: string) => void) | undefined;
  onEditContent: (content: string) => void;
  onOpenTrace: (messageId: string, stepId: string) => void;
  onBranchToNewChat: (message: ChatMessageItem) => void;
  onContinueInterrupted: (messageId: string) => void;
  onSubmitQuestion: (question: string) => void;
  onResolveApproval: (approved: boolean) => void;
  mediaActions: Pick<MediaResultContextValue, "busy" | "onQuote" | "onRegenerate">;
  threadRef: RefObject<HTMLDivElement | null>;
  /** 消息滚动容器；窗口化要把它交给虚拟化器计算可视范围。 */
  scrollElementRef: RefObject<HTMLDivElement | null>;
  /** 窗口化句柄：锚点跳转与搜索定位经它把目标消息先滚进窗口。 */
  windowHandleRef?: RefObject<ThreadWindowHandle | null> | undefined;
}) {
  // 历史建议前缀必须在 Hooks 阶段算好：messages 在流式增量里每次都换引用，
  // 若在渲染里现造数组传给行组件，ChatMessageRow 的 memo 会被新引用全部打穿。
  const priorSuggestions = useStablePriorSuggestions(messages);
  // 窗口化开关只读一次 localStorage，避免每次渲染都访问存储。
  const [virtualizeEnabled] = useState(readStoredThreadVirtualization);
  const windowed = shouldVirtualizeThread(messages.length, virtualizeEnabled);
  // 日期分隔条在轨道之上：把轨道相对滚动内容顶部的偏移交给虚拟化器，行位置才与滚动坐标一致。
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  useLayoutEffect(() => {
    if (!windowed) return;
    const track = trackRef.current;
    const viewport = scrollElementRef.current;
    if (!track || !viewport) return;
    const offset = track.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop;
    const next = Math.max(0, Math.round(offset));
    setScrollMargin((prev) => (prev === next ? prev : next));
  }, [windowed, scrollElementRef, messages.length]);
  const { virtualizer, virtualItems, totalSize } = useThreadWindow({
    enabled: windowed,
    sessionId: activeSessionId || null,
    messages,
    scrollElementRef,
    handleRef: windowHandleRef,
    scrollMargin,
  });

  if (messages.length === 0) {
    // 刷新恢复会话时先给会话骨架：空态引导在详情回来前闪一下再跳走，是最刺眼的那一下。
    if (restoring) return <ConversationSkeleton isZh={locale.isZh} />;
    const isWorkMode = workspaceMode === "codex";
    const fallbackSuggestions = [locale.heroSuggestionPlan, locale.heroSuggestionCheck, locale.heroSuggestionWrite];
    // 项目起步建议与通用引导统一为同一种轻量无边框图标行，保持界面视觉语言一致。
    const activeSuggestions = starterSuggestions && starterSuggestions.length > 0
      ? starterSuggestions
      : fallbackSuggestions;
    return (
      <div className={heroStyles.hero}>
        <span className={heroStyles.heroIcon} aria-hidden="true">
          <IconFish size={30} stroke={1.3} />
        </span>
        <h1 className={heroStyles.heroTitle}>{isWorkMode ? locale.heroHeadlineWork : locale.heroHeadlineChat}</h1>
        {/* 聊天 / 工作分段：决定中心区形态与输入栏信息密度，和左二头部菜单共用同一份状态。 */}
        <div className={heroStyles.heroModes} role="group" aria-label={locale.isZh ? "模式" : "Mode"}>
          <button
            type="button"
            className={heroStyles.heroModeBtn}
            aria-pressed={!isWorkMode}
            onClick={() => onWorkspaceModeChange("chatgpt")}
          >
            {locale.heroModeChat}
          </button>
          <button
            type="button"
            className={heroStyles.heroModeBtn}
            aria-pressed={isWorkMode}
            onClick={() => onWorkspaceModeChange("codex")}
          >
            {locale.heroModeWork}
          </button>
        </div>
        {heroComposer && (
          <div className={heroStyles.heroComposer}>
            {/* 项目范围只在「工作」模式提示：聊天模式是普通对话，不弹这条约束；
                提示条贴在输入栏正上方，只占一行，完整规则收进悬停提示。 */}
            {isWorkMode && projectScope && (
              <p className={heroStyles.projectScopeNotice} role="note" title={locale.projectScopeCardHint}>
                {locale.projectScopeNotice
                  .replace("{name}", projectScope.name)
                  .replace("{brief}", projectScope.description || locale.projectScopeCardEmpty)}
              </p>
            )}
            {heroComposer}
          </div>
        )}
        {showHomeSuggestions && (
          <ChatSuggestions suggestions={activeSuggestions} onPick={onSubmitQuestion} />
        )}
        <p className={heroStyles.heroHint}>{isWorkMode ? locale.heroHintWork : locale.heroHintChat}</p>
      </div>
    );
  }

  // 逐条累积历史建议：本轮与历史重复的建议不再展示，避免连续两轮给同一句。
  // 行渲染抽成函数：全量路径与窗口化路径共用同一份 props，保证两条路径渲染结果一致。
  const renderRow = (msg: ChatMessageItem, msgIdx: number) => (
    <ChatMessageRow
      key={msg.id}
      msg={msg}
      isLastMessage={msgIdx === messages.length - 1}
      hideContentForClarification={Boolean(clarification && msg.id === lastMessage?.id)}
      locale={locale}
      activeSessionId={activeSessionId}
      selectedFileStepId={selectedFile?.messageId === msg.id ? selectedFile.stepId : undefined}
      pendingApproval={msg.status === "streaming" ? pendingApproval : null}
      memoriesCount={memoriesCount}
      isRunning={isRunning}
      brandWatermark={brandWatermark}
      assistantBodyClass={assistantBodyClass}
      noticeLinkClass={noticeLinkClass}
      previousSuggestions={priorSuggestions[msgIdx] ?? EMPTY_PRIOR_SUGGESTIONS}
      mediaActions={mediaActions}
      onOpenFilePreview={onOpenFilePreview}
      onOpenTurnChanges={onOpenTurnChanges}
      onOpenBrowser={onOpenBrowser}
      onOpenSubagent={onOpenSubagent}
      onEditContent={onEditContent}
      onOpenTrace={onOpenTrace}
      onBranchToNewChat={onBranchToNewChat}
      onContinueInterrupted={onContinueInterrupted}
      onSubmitQuestion={onSubmitQuestion}
      onResolveApproval={onResolveApproval}
    />
  );

  // 长会话只渲染可视窗口附近的行；短会话仍一次性渲染，避免窗口边缘的取整误差影响观感。
  if (windowed) {
    return (
      <div ref={threadRef} className={styles.thread} data-virtualized="true">
        {messages[0] && (
          <div className={styles.dayDivider}>
            {formatDayDivider(messages[0].createdAt, locale.isZh)}
          </div>
        )}
        {/* 虚拟化器的总高度含 scrollMargin（轨道上方还有日期分隔条），这里只保留行本身的高度。 */}
        <div ref={trackRef} className={styles.threadTrack} style={{ height: Math.max(0, totalSize - scrollMargin) }}>
          {virtualItems.map((item) => {
            const msg = messages[item.index];
            if (!msg) return null;
            return (
              <div
                key={msg.id}
                data-index={item.index}
                ref={(node) => virtualizer.measureElement(node)}
                className={styles.threadSlot}
                style={{ transform: `translateY(${item.start - scrollMargin}px)` }}
              >
                {renderRow(msg, item.index)}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div ref={threadRef} className={styles.thread}>
      {messages[0] && (
        <div className={styles.dayDivider}>
          {formatDayDivider(messages[0].createdAt, locale.isZh)}
        </div>
      )}
      {messages.map((msg, msgIdx) => renderRow(msg, msgIdx))}
    </div>
  );
}
