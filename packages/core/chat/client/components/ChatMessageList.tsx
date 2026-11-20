// 聊天消息区：空会话引导（标题/副标题/起步提示）与消息线程（按日分隔、用户气泡、助手时间线与完成态操作）。
import type { RefObject } from "react";
import type { ChatMessageItem, FilePreviewTab, PendingApprovalBanner } from "../chat-types";
import type { ChatLocaleMessages } from "../locales";
import { AssistantTimeline } from "./AssistantTimeline";
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
  suggestionsByMessage,
  selectedFile,
  pendingApproval,
  memoriesCount,
  isRunning,
  showHomeSuggestions,
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
  threadRef,
}: {
  locale: ChatLocaleMessages;
  messages: ChatMessageItem[];
  lastMessage: ChatMessageItem | undefined;
  clarification: ChatMessageItem["clarification"];
  suggestionsByMessage: Record<string, string[]>;
  selectedFile: FilePreviewTab | undefined;
  pendingApproval: PendingApprovalBanner | null;
  memoriesCount: number;
  isRunning: boolean;
  showHomeSuggestions: boolean;
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
  threadRef: RefObject<HTMLDivElement | null>;
}) {
  if (messages.length === 0) {
    return (
      <div className={styles.hero}>
        <h1 className={styles.heroTitle}>{locale.welcomeHeadline}</h1>
        <p className={styles.heroSubtitle}>{locale.welcomeSubtitle}</p>
        {showHomeSuggestions && (
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
        )}
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
      {messages.map((msg, msgIdx) =>
        msg.role === "user" ? (
          <div key={msg.id} className={styles.userRow} data-turn-anchor={msg.id}>
            <div className={styles.userBubble}>{msg.content}</div>
            <UserMessageActions
              isZh={locale.isZh}
              content={msg.content}
              createdAt={msg.createdAt}
              onEdit={() => onEditContent(msg.content)}
            />
          </div>
        ) : (
          <article key={msg.id} className={styles.assistantRow}>
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
            />
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
                suggestions={suggestionsByMessage[msg.id] ?? []}
                onSelect={(question) => onSubmitQuestion(question)}
              />
            )}
          </article>
        ),
      )}
    </div>
  );
}