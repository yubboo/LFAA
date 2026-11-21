// 聊天消息区：空会话引导（标题/副标题/起步提示）与消息线程（按日分隔、用户气泡、助手时间线与完成态操作）。
import type { RefObject } from "react";
import { IconArrowRight } from "@tabler/icons-react";
import type { ChatMessageItem, FilePreviewTab, PendingApprovalBanner } from "../chat-types";
import type { ChatLocaleMessages } from "../locales";
import { AssistantTimeline } from "./AssistantTimeline";
import { MediaGeneratingCard } from "./Media-Generating-Card";
import { UserMessageAttachments } from "./UserMessageAttachments";
import { MediaResultContext, type MediaResultContextValue } from "./media-result-context";
import {
  AssistantMessageActions,
  EditedFilesCard,
  FollowUpSuggestions,
  UserMessageActions,
  formatDayDivider,
} from "./MessageActionBars";
import styles from "./ChatWorkspace.module.css";

export function ChatMessageList({
  locale,
  messages,
  lastMessage,
  clarification,
  starterSuggestions,
  suggestionsByMessage,
  selectedFile,
  pendingApproval,
  memoriesCount,
  isRunning,
  showHomeSuggestions,
  activeSessionId,
  assistantBodyClass,
  noticeLinkClass,
  onOpenFilePreview,
  onOpenTurnChanges,
  onEditContent,
  onOpenTrace,
  onBranchToNewChat,
  onContinueInterrupted,
  onSubmitQuestion,
  onResolveApproval,
  mediaActions,
  threadRef,
}: {
  locale: ChatLocaleMessages;
  messages: ChatMessageItem[];
  lastMessage: ChatMessageItem | undefined;
  clarification: ChatMessageItem["clarification"];
  starterSuggestions: string[] | null;
  suggestionsByMessage: Record<string, string[]>;
  selectedFile: FilePreviewTab | undefined;
  pendingApproval: PendingApprovalBanner | null;
  memoriesCount: number;
  isRunning: boolean;
  showHomeSuggestions: boolean;
  activeSessionId: string | null | undefined;
  assistantBodyClass: string | undefined;
  noticeLinkClass: string | undefined;
  onOpenFilePreview: (messageId: string, stepId: string) => void;
  onOpenTurnChanges?: ((messageId: string) => void) | undefined;
  onEditContent: (content: string) => void;
  onOpenTrace: (messageId: string, stepId: string) => void;
  onBranchToNewChat: (message: ChatMessageItem) => void;
  onContinueInterrupted: (messageId: string) => void;
  onSubmitQuestion: (question: string) => void;
  onResolveApproval: (approved: boolean) => void;
  mediaActions: Pick<MediaResultContextValue, "busy" | "onQuote" | "onRegenerate">;
  threadRef: RefObject<HTMLDivElement | null>;
}) {
  if (messages.length === 0) {
    return (
      <div className={styles.hero}>
        <h1 className={styles.heroTitle}>{locale.welcomeHeadline}</h1>
        <p className={styles.heroSubtitle}>{locale.welcomeSubtitle}</p>
        {showHomeSuggestions && (starterSuggestions && starterSuggestions.length > 0 ? (
          <div className={styles.projectStarters} role="list">
            {starterSuggestions.map((prompt, index) => (
              <button
                key={prompt}
                type="button"
                role="listitem"
                className={styles.projectStarterBtn}
                onClick={() => onSubmitQuestion(prompt)}
              >
                <span className={styles.projectStarterIndex}>{index + 1}</span>
                <span className={styles.projectStarterText}>{prompt}</span>
                {index === 0 && (
                  <span className={styles.projectStarterRecommended}>{locale.isZh ? "推荐" : "Recommended"}</span>
                )}
                <IconArrowRight size={14} stroke={1.8} className={styles.projectStarterArrow} aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : (
          <div className={styles.starters}>
            {[locale.starterInspect, locale.starterMemory, locale.starterRules].map((prompt) => (
              <button
                key={prompt}
                type="button"
                className={styles.starterChip}
                onClick={() => onSubmitQuestion(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>
        ))}
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
      {messages.map((msg, msgIdx) => {
        if (msg.role === "user") {
          const hasMedia = Boolean(msg.attachments?.length || msg.references?.length);
          return (
            <div key={msg.id} className={styles.userRow} data-turn-anchor={msg.id}>
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
          <article key={msg.id} className={styles.assistantRow}>
            {msg.mediaGenerating ? (
              <MediaGeneratingCard
                kind={msg.mediaGenerating.kind}
                ratio={msg.mediaGenerating.ratio}
                isZh={locale.isZh}
              />
            ) : (
              <MediaResultContext.Provider value={activeSessionId && msg.status !== "streaming"
                ? { ...mediaActions, sessionId: activeSessionId, messageId: msg.id, isZh: locale.isZh } : null}>
              <AssistantTimeline
                locale={locale}
                content={clarification && msg.id === lastMessage?.id ? "" : msg.content}
                progressText={msg.progressText}
                steps={msg.steps ?? []}
                createdAt={msg.createdAt}
                runDurationMs={msg.runDurationMs}
                reasoningDurationMs={msg.reasoningDurationMs}
                tokenUsage={msg.tokenUsage}
                isStreaming={msg.status === "streaming"}
                pendingApproval={msg.status === "streaming" ? pendingApproval : null}
                onResolveApproval={onResolveApproval}
                onOpenFile={(stepId) => onOpenFilePreview(msg.id, stepId)}
                onOpenTrace={(stepId) => onOpenTrace(msg.id, stepId)}
                selectedFileStepId={selectedFile?.messageId === msg.id ? selectedFile.stepId : undefined}
                bodyClassName={assistantBodyClass ?? ""}
                onSelectAdvice={(text) => onSubmitQuestion(text)}
              />
              </MediaResultContext.Provider>
            )}
            <EditedFilesCard
              isZh={locale.isZh}
              steps={msg.steps ?? []}
              onViewChanges={onOpenTurnChanges ? () => onOpenTurnChanges(msg.id) : undefined}
              onOpenFile={(stepId) => onOpenFilePreview(msg.id, stepId)}
              selectedFileStepId={selectedFile?.messageId === msg.id ? selectedFile.stepId : undefined}
            />
            {msg.status !== "streaming" && msg.content.trim() && (
              <AssistantMessageActions
                isZh={locale.isZh}
                sessionId={activeSessionId ?? ""}
                messageId={msg.id}
                content={msg.content}
                createdAt={msg.createdAt}
                model={msg.model}
                memoryRefCount={memoriesCount}
                onBranchToNewChat={() => onBranchToNewChat(msg)}
              />
            )}
            {msg.status === "aborted" && !isRunning && msg.content.trim() && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <button
                  type="button"
                  className={noticeLinkClass}
                  onClick={() => onContinueInterrupted(msg.id)}
                >
                  {locale.isZh ? "继续生成（从完整句边界续写）" : "Continue from clean boundary"}
                </button>
              </div>
            )}
            {msgIdx === messages.length - 1 && !isRunning && msg.status !== "streaming" && msg.content.trim() && (
              <FollowUpSuggestions
                isZh={locale.isZh}
                suggestions={suggestionsByMessage[msg.id] ?? []}
                onSelect={(question) => onSubmitQuestion(question)}
              />
            )}
          </article>
        );
      })}
    </div>
  );
}
