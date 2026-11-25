// 单条消息隔离渲染单元：用 React.memo 保护历史消息，在末尾流式输出期间避免整条消息线程重复重绘。
import { memo, useCallback, useMemo } from "react";
import type { AgentStepItem, ChatMessageItem, PendingApprovalBanner } from "../store/chat-types";
import type { ChatLocaleMessages } from "../locales";
import { AssistantTimeline } from "./AssistantTimeline";
import { MediaGeneratingCard, MediaResultContext, type MediaResultContextValue } from "@lfaa/client-ui-tool-media/client";
import { UserMessageAttachments } from "./UserMessageAttachments";
import {
  AssistantMessageActions,
  EditedFilesCard,
  UserMessageActions,
} from "./MessageActionBars";
import { SuggestionChips } from "./SuggestionChips";
import { dedupeSuggestions, splitSuggestionBlock } from "./suggestion-block";
import styles from "./ChatWorkspace.module.css";

const EMPTY_STEPS: AgentStepItem[] = [];
const EMPTY_PRIOR_SUGGESTIONS: readonly string[] = [];

/** 渲染单条用户或助手消息，并通过 memo 阻止历史消息在流式增量帧陪跑重渲染。 */
export const ChatMessageRow = memo(function ChatMessageRow({
  msg,
  isLastMessage,
  hideContentForClarification,
  locale,
  activeSessionId,
  selectedFileStepId,
  pendingApproval,
  memoriesCount,
  isRunning,
  brandWatermark,
  assistantBodyClass,
  noticeLinkClass,
  previousSuggestions = EMPTY_PRIOR_SUGGESTIONS,
  mediaActions,
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
}: {
  msg: ChatMessageItem;
  isLastMessage: boolean;
  hideContentForClarification: boolean;
  locale: ChatLocaleMessages;
  activeSessionId: string | null | undefined;
  selectedFileStepId: string | undefined;
  pendingApproval: PendingApprovalBanner | null;
  memoriesCount: number;
  isRunning: boolean;
  brandWatermark: boolean;
  assistantBodyClass: string | undefined;
  noticeLinkClass: string | undefined;
  /** 前面所有助手回复已给过的建议，用于去重；本轮重复的建议不再显示。 */
  previousSuggestions: ReadonlyArray<string>;
  mediaActions: Pick<MediaResultContextValue, "busy" | "onQuote" | "onRegenerate">;
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
}) {
  const handleOpenFile = useCallback((stepId: string) => onOpenFilePreview(msg.id, stepId), [msg.id, onOpenFilePreview]);
  const handleOpenTrace = useCallback((stepId: string) => onOpenTrace(msg.id, stepId), [msg.id, onOpenTrace]);
  const handleViewChanges = useMemo(
    () => (onOpenTurnChanges ? () => onOpenTurnChanges(msg.id) : undefined),
    [msg.id, onOpenTurnChanges],
  );
  const mediaContextValue = useMemo<MediaResultContextValue | null>(
    () => (activeSessionId && msg.status !== "streaming"
      ? { ...mediaActions, sessionId: activeSessionId, messageId: msg.id, isZh: locale.isZh, brandWatermark }
      : null),
    [activeSessionId, brandWatermark, locale.isZh, mediaActions, msg.id, msg.status],
  );
  // 建议块由模型随回复一起给出：这里剥掉隐藏标记，正文照常渲染，建议转成可点击胶囊。
  const { content: visibleContent, suggestions } = useMemo(
    () => (msg.role === "assistant" ? splitSuggestionBlock(msg.content) : { content: msg.content, suggestions: [] }),
    [msg.content, msg.role],
  );
  const freshSuggestions = useMemo(
    () => dedupeSuggestions(suggestions, previousSuggestions),
    [previousSuggestions, suggestions],
  );

  if (msg.role === "user") {
    const hasMedia = Boolean(msg.attachments?.length || msg.references?.length);
    return (
      <div id={`chat-message-${msg.id}`} className={styles.userRow} data-turn-anchor={msg.id}>
        {/* 带图时不再套背景气泡：图片本身即卡片，文字收成一枚胶囊标签跟在图下。 */}
        <div className={styles.userBubble} data-media={hasMedia ? "true" : undefined}>
          {hasMedia ? (
            <>
              <UserMessageAttachments
                attachments={msg.attachments}
                references={msg.references}
                sessionId={activeSessionId ?? null}
                isZh={locale.isZh}
              />
              {msg.content.trim() ? <p className={styles.userMediaCaption}>{msg.content}</p> : null}
            </>
          ) : (
            <div>{msg.content}</div>
          )}
        </div>
        <UserMessageActions
          isZh={locale.isZh}
          content={msg.content}
          createdAt={msg.createdAt}
          persistent={hasMedia}
          onEdit={() => onEditContent(msg.content)}
        />
      </div>
    );
  }

  return (
    <article id={`chat-message-${msg.id}`} className={styles.assistantRow}>
      {msg.mediaGenerating ? (
        <>
          {msg.content.trim() ? <p className={styles.mediaPlan}>{msg.content}</p> : null}
          <MediaGeneratingCard
            kind={msg.mediaGenerating.kind}
            ratio={msg.mediaGenerating.ratio}
            isZh={locale.isZh}
          />
        </>
      ) : (
        <MediaResultContext.Provider value={mediaContextValue}>
          <AssistantTimeline
            locale={locale}
            content={hideContentForClarification ? "" : visibleContent}
            reasoning={msg.reasoning}
            progressText={msg.progressText}
            steps={msg.steps ?? EMPTY_STEPS}
            createdAt={msg.createdAt}
            runDurationMs={msg.runDurationMs}
            reasoningDurationMs={msg.reasoningDurationMs}
            tokenUsage={msg.tokenUsage}
            isStreaming={msg.status === "streaming"}
            pendingApproval={msg.status === "streaming" ? pendingApproval : null}
            onResolveApproval={onResolveApproval}
            onOpenFile={handleOpenFile}
            onOpenTrace={handleOpenTrace}
            onOpenBrowser={onOpenBrowser}
            onOpenSubagent={onOpenSubagent}
            selectedFileStepId={selectedFileStepId}
            bodyClassName={assistantBodyClass ?? ""}
          />
        </MediaResultContext.Provider>
      )}
      <EditedFilesCard
        isZh={locale.isZh}
        steps={msg.steps ?? []}
        onViewChanges={handleViewChanges}
        onOpenFile={handleOpenFile}
        selectedFileStepId={selectedFileStepId}
      />
      {msg.status !== "streaming" && visibleContent.trim() && (
        <AssistantMessageActions
          isZh={locale.isZh}
          sessionId={activeSessionId ?? ""}
          messageId={msg.id}
          content={visibleContent}
          createdAt={msg.createdAt}
          model={msg.model}
          memoryRefCount={memoriesCount}
          onBranchToNewChat={() => onBranchToNewChat(msg)}
        />
      )}
      {msg.status === "aborted" && !isRunning && visibleContent.trim() && isLastMessage && (
        <div className={styles.continueRow}>
          <button
            type="button"
            className={noticeLinkClass}
            onClick={() => onContinueInterrupted(msg.id)}
          >
            {locale.isZh ? "继续生成（从完整句边界续写）" : "Continue from clean boundary"}
          </button>
        </div>
      )}
      {freshSuggestions.length > 0 && (
        <SuggestionChips suggestions={freshSuggestions} onSelect={onSubmitQuestion} />
      )}
    </article>
  );
});
