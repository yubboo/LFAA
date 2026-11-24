// 聊天消息区：空会话引导（鱼形图标 / 标题 / 聊天·工作分段 / 工作模式的项目范围提示条 / 内嵌输入栏 / 统一轻量起步建议）与隔离记忆化的消息线程。
import type { ReactNode, RefObject } from "react";
import { IconCircleCheck, IconFish } from "@tabler/icons-react";
import type { WorkspaceMode } from "@lfaa/ui-layout/client";
import type { ChatMessageItem, FilePreviewTab, PendingApprovalBanner } from "../store/chat-types";
import type { ChatLocaleMessages } from "../locales";
import type { MediaResultContextValue } from "@lfaa/client-ui-tool-media/client";
import { formatDayDivider } from "./MessageActionBars";
import { ChatMessageRow } from "./ChatMessageRow";
import styles from "./ChatWorkspace.module.css";
import heroStyles from "./ChatWorkspace.hero.module.css";

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
  suggestionsByMessage,
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
  /** 项目内空会话展示的范围摘要；未绑定项目时为 null。 */
  projectScope: { name: string; description: string } | null;
  /** 中心区的「聊天 / 工作」形态：标题、提示与输入栏密度都按它切换。 */
  workspaceMode: WorkspaceMode;
  /** 刷新后正在恢复已记住的会话：先渲染消息骨架，不能先把空态引导闪出来。 */
  restoring?: boolean;
  /** 空会话时内嵌到中心区的输入栏；有消息时输入栏留在底部，这里为 null。 */
  heroComposer?: ReactNode;
  onWorkspaceModeChange: (mode: WorkspaceMode) => void;
  suggestionsByMessage: Record<string, string[]>;
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
          <div className={heroStyles.heroSuggestions} role="list">
            {activeSuggestions.map((prompt) => (
              <button
                key={prompt}
                type="button"
                role="listitem"
                className={heroStyles.heroSuggestionBtn}
                onClick={() => onSubmitQuestion(prompt)}
              >
                <IconCircleCheck className={heroStyles.heroSuggestionIcon} size={15} stroke={1.6} aria-hidden="true" />
                <span className={heroStyles.heroSuggestionText}>{prompt}</span>
              </button>
            ))}
          </div>
        )}
        <p className={heroStyles.heroHint}>{isWorkMode ? locale.heroHintWork : locale.heroHintChat}</p>
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
      {messages.map((msg, msgIdx) => (
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
          followUpSuggestions={suggestionsByMessage[msg.id]}
          mediaActions={mediaActions}
          onOpenFilePreview={onOpenFilePreview}
          onOpenTurnChanges={onOpenTurnChanges}
          onOpenBrowser={onOpenBrowser}
          onEditContent={onEditContent}
          onOpenTrace={onOpenTrace}
          onBranchToNewChat={onBranchToNewChat}
          onContinueInterrupted={onContinueInterrupted}
          onSubmitQuestion={onSubmitQuestion}
          onResolveApproval={onResolveApproval}
        />
      ))}
    </div>
  );
}
