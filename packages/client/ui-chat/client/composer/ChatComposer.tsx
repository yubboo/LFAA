// 聊天输入区：范围/项目栏、@ 提及 / 斜杠命令 / 技能弹层、附件与排队提示、输入框及其工具条、统计栏。
import { IconTrash } from "@tabler/icons-react";
import { HoverTip } from "@lfaa/ui-primitives/client";
import type { ChatClientStore } from "../store/chat-store";
import { mediaChatMessages } from "@lfaa/client-ui-tool-media/client";
import type { ChatLocaleMessages } from "../locales";
import type { ChatMessageItem, ChatSessionDetail, ChatStoreSnapshot } from "../store/chat-types";
import { useComposerAttachInput, useComposerAutoGrow } from "./useComposerInput";
import { handleComposerKeydown } from "./composer-keyboard";
import type { useChatComposer } from "./useChatComposer";
import { ClarificationCard } from "../conversation/Clarification-Card";
import { ComposerAddMenu } from "./ComposerAddMenu";
import { ComposerAttachmentChip } from "./ComposerAttachmentChip";
import { ComposerMediaLibrary } from "./ComposerMediaLibrary";
import { ComposerNotice } from "./ComposerNotice";
import { ComposerFollowUpHint } from "./ComposerQueuePanel";
import { ComposerQueueSection } from "./ComposerQueueSection";
import { ComposerRightActions } from "./ComposerRightActions";
import { MediaRatioPicker } from "@lfaa/client-ui-tool-media/client";
import { MediaStylePicker } from "@lfaa/client-ui-tool-media/client";
import { ComposerScopeBar } from "./ComposerScopeBar";
import { ComposerTriggers } from "./ComposerTriggers";
import { ModelReasoningPicker } from "../models/ModelReasoningPicker";
import { PermissionModePicker } from "./PermissionModePicker";
import { ComposerStats } from "./ComposerStats";
import styles from "../conversation/ChatWorkspace.module.css";
import composerStyles from "../conversation/ChatWorkspace.composer.module.css";
import type { WorkbenchProjectItem } from "@lfaa/ui-layout";

export function ChatComposer({
  locale,
  store,
  state,
  composer,
  projects,
  canCreateProject,
  activeProjectId,
  activeSession,
  messages,
  messagesCount,
  isRunning,
  needsApiKey,
  clarification,
  lastMessageId,
  bindingProject,
  stats,
  worktree,
  onSelectProject,
  onCreateProject,
  onClearWorktree,
  onSkipClarification,
  onAnswerClarification,
  onOpenSettings,
  onOpenBrowser,
  onDeleteRequest,
  onOpenTurnChanges,
}: {
  locale: ChatLocaleMessages;
  store: ChatClientStore;
  state: ChatStoreSnapshot;
  composer: ReturnType<typeof useChatComposer>;
  projects: WorkbenchProjectItem[];
  canCreateProject: boolean;
  activeProjectId: string | null | undefined;
  activeSession: ChatSessionDetail | null | undefined;
  messages: ChatMessageItem[];
  messagesCount: number;
  isRunning: boolean;
  needsApiKey: boolean;
  clarification: ChatMessageItem["clarification"];
  lastMessageId: string | undefined;
  bindingProject: boolean;
  stats: { filesCount: number; countedChanges: boolean; added: number; removed: number };
  /** 当前会话或草稿绑定的工作树；只做展示与解绑。 */
  worktree: { branch: string; path: string } | null;
  onSelectProject: (projectId: string | null) => void;
  onCreateProject: () => void;
  onClearWorktree?: () => void;
  onSkipClarification: () => void;
  onAnswerClarification: (answer: string) => void;
  onOpenSettings: () => void;
  onOpenBrowser?: (() => void) | undefined;
  onDeleteRequest: () => void;
  onOpenTurnChanges?: ((messageId: string) => void) | undefined;
}) {
  const {
    draft, setDraft, attachments, setAttachments, contextNotice, setContextNotice,
    mentionTrigger, setMentionTrigger, mentionIndex, setMentionIndex,
    slashTrigger, setSlashTrigger, slashIndex, setSlashIndex,
    skillTrigger, setSkillTrigger, skillIndex, setSkillIndex,
    openProjectSignal, visibleMentionEntries, visibleSlashCommands, visibleSkillEntries,
    textareaRef, fileInputRef, syncMentionFromText, focusTextareaAt,
    handleSelectSkillEntry, handleTabCompleteSlashCommand, handleSelectSlashCommand,
    handleSelectMentionEntry, handleSubmit, appendAttachments, selectedMediaKind,
    mediaRatio, setMediaRatio, mediaStyle, setMediaStyle,
  } = composer;

  const mediaLabels = mediaChatMessages[locale.isZh ? "zh" : "en"];
  const placeholder = selectedMediaKind ? mediaLabels[`${selectedMediaKind}Prompt`] : locale.composerPlaceholder;
  // 运行被中断后最后一条助手回复可续写：输入框为空时，发送位改成「继续生成」。
  const lastMessage = messages.at(-1);
  const pausedMessage = !isRunning
    && lastMessage?.role === "assistant"
    && lastMessage.status === "aborted"
    && Boolean(lastMessage.content.trim())
    ? lastMessage
    : null;
  const showContinue = Boolean(pausedMessage) && !draft.trim() && attachments.length === 0;

  const removeAttachment = (id: string) => setAttachments((prev) => prev.filter((x) => x.id !== id));

  useComposerAutoGrow(composer.textareaRef, composer.draft);
  const { draggingFiles, setDraggingFiles, handlePaste, handleDrop } = useComposerAttachInput({
    sessionId: activeSession?.id ?? "",
    appendAttachments,
  });

  return (
    <div className={styles.composerStack}>
      {clarification && lastMessageId && (
        <ClarificationCard key={lastMessageId} messageId={lastMessageId} isZh={locale.isZh} prompt={clarification}
          busy={state.submittingMessage || isRunning}
          chatRequired={Boolean(selectedMediaKind)}
          onSkip={() => { setContextNotice(""); focusTextareaAt(draft.length); onSkipClarification(); }}
          onAnswer={(answer) => onAnswerClarification(answer)} />
      )}
      <ComposerScopeBar
        locale={locale}
        projects={projects}
        selectedProjectId={activeProjectId ?? null}
        showShelf={messagesCount === 0 && !isRunning}
        canCreateProject={canCreateProject}
        openProjectSignal={openProjectSignal}
        projectDisabled={isRunning || bindingProject}
        worktree={worktree}
        onSelectProject={onSelectProject}
        onCreateProject={onCreateProject}
        {...(onClearWorktree ? { onClearWorktree } : {})}
      />
      <ComposerTriggers
        locale={locale}
        mentionTrigger={mentionTrigger}
        mentionEntries={visibleMentionEntries}
        mentionIndex={mentionIndex}
        onSelectMention={handleSelectMentionEntry}
        slashTrigger={slashTrigger}
        slashCommands={visibleSlashCommands}
        slashIndex={slashIndex}
        onSelectSlash={handleSelectSlashCommand}
        skillTrigger={skillTrigger}
        skillEntries={visibleSkillEntries}
        skillIndex={skillIndex}
        onSelectSkill={handleSelectSkillEntry}
      />
      <div
        className={composerStyles.composerCard}
        data-dragging={draggingFiles ? "true" : undefined}
        onDragOver={(event) => { event.preventDefault(); setDraggingFiles(true); }}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDraggingFiles(false); }}
        onDrop={handleDrop}
      >
        {needsApiKey && (
          <div className={composerStyles.noticeBar}>
            <span>{locale.modelKeyMissingHint}</span>
            <button type="button" className={composerStyles.noticeLink} onClick={onOpenSettings}>
              {locale.configureModel}
            </button>
          </div>
        )}

        {attachments.length > 0 && (
          <div className={composerStyles.attachmentRow}>
            {attachments.map((item) => (
              <ComposerAttachmentChip key={item.id} item={item} onRemove={() => removeAttachment(item.id)} />
            ))}
          </div>
        )}

        <ComposerQueueSection isZh={locale.isZh} queue={state.queuedMessages} store={store} />

        <ComposerNotice
          message={contextNotice}
          dismissLabel={locale.dismissNoticeLabel}
          onDismiss={() => setContextNotice("")}
        />

        <textarea
          ref={textareaRef}
          className={composerStyles.textarea}
          placeholder={placeholder}
          value={draft}
          rows={2}
          onChange={(event) => {
            const nextVal = event.target.value;
            setDraft(nextVal);
            syncMentionFromText(nextVal, event.target.selectionStart);
          }}
          onClick={(event) => {
            syncMentionFromText(draft, event.currentTarget.selectionStart);
          }}
          onPaste={handlePaste}
          onKeyDown={(event) => handleComposerKeydown(event, {
            mention: mentionTrigger ? {
              entries: visibleMentionEntries,
              index: mentionIndex,
              setIndex: setMentionIndex,
              close: () => setMentionTrigger(null),
              pick: handleSelectMentionEntry,
            } : null,
            slash: slashTrigger ? {
              entries: visibleSlashCommands,
              index: slashIndex,
              setIndex: setSlashIndex,
              close: () => setSlashTrigger(null),
              complete: handleTabCompleteSlashCommand,
              pick: handleSelectSlashCommand,
            } : null,
            skill: skillTrigger ? {
              entries: visibleSkillEntries,
              index: skillIndex,
              setIndex: setSkillIndex,
              close: () => setSkillTrigger(null),
              pick: handleSelectSkillEntry,
            } : null,
            queuedCount: state.queuedMessages.length,
            flushQueue: () => void store.flushQueuedMessages(),
            sendShortcut: state.generalSettings.sendShortcut,
            submit: (invertFollowUp) => void handleSubmit(undefined, invertFollowUp),
          })}
        />

        <ComposerFollowUpHint
          isZh={locale.isZh}
          followUpMode={state.generalSettings.followUpMode}
          running={isRunning}
          queuedCount={state.queuedMessages.length}
        />

        {/* 同一组入口随输入卡片宽度切换文字或图标，避免窄栏出现两排工具。 */}
        <div className={composerStyles.composerBar}>
          <div className={composerStyles.controls}>
            <ComposerMediaLibrary
              isZh={locale.isZh}
              onUsePrompt={(prompt) => {
                setDraft(prompt);
                focusTextareaAt(prompt.length);
              }}
            />
            <ComposerAddMenu
              locale={locale}
              sessionId={activeSession?.id ?? ""}
              fileInputRef={fileInputRef}
              onAttachItems={appendAttachments}
              onTriggerMention={() => {
                const nextDraft = draft.endsWith("@") ? draft : `${draft}${draft && !draft.endsWith(" ") ? " " : ""}@`;
                setDraft(nextDraft);
                setSlashTrigger(null);
                setMentionTrigger({ query: "", startIndex: nextDraft.length - 1 });
                setMentionIndex(0);
                focusTextareaAt(nextDraft.length);
              }}
              onTriggerSlash={() => {
                const nextDraft = draft.endsWith("/") ? draft : `${draft}${draft && !draft.endsWith(" ") ? " " : ""}/`;
                setDraft(nextDraft);
                setMentionTrigger(null);
                setSlashTrigger({ query: "", startIndex: nextDraft.length - 1 });
                setSlashIndex(0);
                focusTextareaAt(nextDraft.length);
              }}
              onOpenBrowser={onOpenBrowser}
            />

            <PermissionModePicker
              locale={locale}
              mode={state.permissionMode}
              onSelectMode={(nextMode) => void store.setPermissionMode(nextMode)}
            />

            {activeSession && (
              <HoverTip label={locale.deleteChat}>
                <button
                  type="button"
                  className={composerStyles.toolBtn}
                  aria-label={locale.deleteChat}
                  onClick={onDeleteRequest}
                >
                  <IconTrash size={14} aria-hidden="true" />
                </button>
              </HoverTip>
            )}
          </div>

          <div className={composerStyles.rightCluster}>
            {selectedMediaKind === "image" && <MediaStylePicker isZh={locale.isZh} value={mediaStyle} onChange={setMediaStyle} />}
            {selectedMediaKind === "image" && <MediaRatioPicker isZh={locale.isZh} value={mediaRatio} onChange={setMediaRatio} />}
            <ModelReasoningPicker
              isZh={locale.isZh}
              profiles={state.profiles}
              activeProfileId={state.activeProfileId}
              reasoningLevel={state.reasoningLevel}
              onSelectProfile={(profileId) => void store.setActiveProfile(profileId)}
              onSelectBrandModel={(profileId, modelId) => void store.selectBrandModel(profileId, modelId)}
              onRefreshBrandModels={(profileId) => store.fetchRemoteModels({ profileId }).then(() => {})}
              onSelectReasoning={(level) => store.setReasoningLevel(level)}
              onOpenSettings={onOpenSettings}
            />

            <ComposerRightActions
              locale={locale}
              draft={draft}
              canSend={!bindingProject && Boolean(draft.trim() || attachments.length > 0)}
              isRunning={isRunning}
              paused={showContinue}
              onChangeDraft={setDraft}
              onSend={() => void handleSubmit()}
              onStop={() => void store.abortActiveRun()}
              onContinue={() => {
                if (pausedMessage) void store.continueInterruptedMessage(pausedMessage.id);
              }}
              onNotice={setContextNotice}
            />
          </div>
        </div>
      </div>
      <ComposerStats
        locale={locale}
        messages={messages}
        lastMessageId={lastMessageId}
        stats={stats}
        showContext={state.generalSettings.showContextUsage}
        onOpenTurnChanges={onOpenTurnChanges}
      />
    </div>
  );
}
