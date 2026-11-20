// 聊天输入区：范围/项目栏、@ 提及 / 斜杠命令 / 技能弹层、附件与排队提示、输入框及其工具条、统计栏。
import { IconTrash, IconX } from "@tabler/icons-react";
import { HoverTip } from "@lfaa/ui-primitives/client";
import type { ChatClientStore } from "../chat-store";
import type { ChatLocaleMessages } from "../locales";
import type { ChatMessageItem, ChatSessionDetail, ChatStoreSnapshot } from "../chat-types";
import type { ComposerAttachment } from "../composer-context";
import type { useChatComposer } from "./useChatComposer";
import { ClarificationCard } from "./Clarification-Card";
import { ComposerAddMenu } from "./ComposerAddMenu";
import { ComposerRightActions } from "./ComposerRightActions";
import { ComposerScopeBar } from "./ComposerScopeBar";
import { MentionPopover, SlashCommandPopover } from "./MentionPopover";
import { ModelReasoningPicker } from "./ModelReasoningPicker";
import { PermissionModePicker } from "./PermissionModePicker";
import { SessionMode } from "./Session-Mode";
import { SessionStatsBar } from "./SessionStatsBar";
import styles from "./ChatWorkspace.module.css";
import composerStyles from "./ChatWorkspace.composer.module.css";
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
  onSelectProject,
  onCreateProject,
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
  onSelectProject: (projectId: string | null) => void;
  onCreateProject: () => void;
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
    handleSelectMentionEntry, handleSubmit, appendAttachments,
  } = composer;

  const removeAttachment = (id: string) => setAttachments((prev) => prev.filter((x) => x.id !== id));

  return (
    <div className={composerStyles.composerStack}>
      {clarification && (
        <ClarificationCard key={lastMessageId} isZh={locale.isZh} prompt={clarification}
          busy={state.submittingMessage || isRunning}
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
        onSelectProject={onSelectProject}
        onCreateProject={onCreateProject}
      />
      {mentionTrigger && (
        <MentionPopover
          locale={locale}
          entries={visibleMentionEntries}
          highlightedIndex={mentionIndex}
          onSelect={handleSelectMentionEntry}
        />
      )}
      {slashTrigger && (
        <SlashCommandPopover
          isZh={locale.isZh}
          entries={visibleSlashCommands}
          highlightedIndex={slashIndex}
          onSelect={handleSelectSlashCommand}
        />
      )}
      {skillTrigger && (
        <MentionPopover
          locale={locale}
          entries={visibleSkillEntries}
          highlightedIndex={skillIndex}
          onSelect={handleSelectSkillEntry}
        />
      )}
      <div className={composerStyles.composerCard}>
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
            {attachments.map((item: ComposerAttachment) => (
              <span key={item.id} className={composerStyles.attachmentChip}>
                <span className={composerStyles.attachmentChipLabel}>{item.label}</span>
                {item.detail && <span className={composerStyles.attachmentChipDetail}>{item.detail}</span>}
                <button
                  type="button"
                  className={composerStyles.attachmentChipRemove}
                  aria-label={item.label}
                  onClick={() => removeAttachment(item.id)}
                >
                  <IconX size={11} aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        )}

        {state.queuedMessages.length > 0 && (
          <div className={composerStyles.attachmentRow} aria-label={locale.isZh ? "排队消息" : "Queued messages"}>
            {state.queuedMessages.map((queued, idx) => (
              <span key={`${idx}-${queued.slice(0, 12)}`} className={composerStyles.attachmentChip}>
                <span className={composerStyles.attachmentChipLabel}>{locale.isZh ? "排队" : "Queued"}</span>
                <span className={composerStyles.attachmentChipDetail}>{queued.slice(0, 28)}</span>
                <button
                  type="button"
                  className={composerStyles.attachmentChipRemove}
                  aria-label={locale.isZh ? "移除排队消息" : "Remove queued"}
                  onClick={() => store.removeQueuedMessage(idx)}
                >
                  <IconX size={11} aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        )}

        {contextNotice && (
          <div className={composerStyles.contextNotice} role="status">
            <span>{contextNotice}</span>
            <button
              type="button"
              className={composerStyles.contextNoticeClose}
              aria-label={locale.dismissNoticeLabel}
              onClick={() => setContextNotice("")}
            >
              <IconX size={12} aria-hidden="true" />
            </button>
          </div>
        )}

        <textarea
          ref={textareaRef}
          className={composerStyles.textarea}
          placeholder={locale.composerPlaceholder}
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
          onKeyDown={(event) => {
            if (mentionTrigger) {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setMentionIndex((idx) => (visibleMentionEntries.length > 0 ? (idx + 1) % visibleMentionEntries.length : 0));
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setMentionIndex((idx) => (visibleMentionEntries.length > 0 ? (idx - 1 + visibleMentionEntries.length) % visibleMentionEntries.length : 0));
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setMentionTrigger(null);
                return;
              }
              if ((event.key === "Tab" || (event.key === "Enter" && !event.shiftKey)) && !event.nativeEvent.isComposing && visibleMentionEntries.length > 0) {
                event.preventDefault();
                const picked = visibleMentionEntries[mentionIndex] ?? visibleMentionEntries[0];
                if (picked) handleSelectMentionEntry(picked);
                return;
              }
            }
            if (slashTrigger) {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setSlashIndex((idx) => (visibleSlashCommands.length > 0 ? (idx + 1) % visibleSlashCommands.length : 0));
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setSlashIndex((idx) => (visibleSlashCommands.length > 0 ? (idx - 1 + visibleSlashCommands.length) % visibleSlashCommands.length : 0));
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setSlashTrigger(null);
                return;
              }
              if (event.key === "Tab" && !event.nativeEvent.isComposing && visibleSlashCommands.length > 0) {
                event.preventDefault();
                const picked = visibleSlashCommands[slashIndex] ?? visibleSlashCommands[0];
                if (picked) handleTabCompleteSlashCommand(picked);
                return;
              }
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && visibleSlashCommands.length > 0) {
                event.preventDefault();
                const picked = visibleSlashCommands[slashIndex] ?? visibleSlashCommands[0];
                if (picked) handleSelectSlashCommand(picked);
                return;
              }
            }
            if (skillTrigger) {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setSkillIndex((idx) => (visibleSkillEntries.length > 0 ? (idx + 1) % visibleSkillEntries.length : 0));
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setSkillIndex((idx) => (visibleSkillEntries.length > 0 ? (idx - 1 + visibleSkillEntries.length) % visibleSkillEntries.length : 0));
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setSkillTrigger(null);
                return;
              }
              if ((event.key === "Tab" || (event.key === "Enter" && !event.shiftKey)) && !event.nativeEvent.isComposing && visibleSkillEntries.length > 0) {
                event.preventDefault();
                const picked = visibleSkillEntries[skillIndex] ?? visibleSkillEntries[0];
                if (picked) handleSelectSkillEntry(picked);
                return;
              }
            }
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              const needCtrl = state.generalSettings.sendShortcut === "ctrl_enter";
              if (needCtrl && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                void handleSubmit();
              } else if (!needCtrl && !event.shiftKey) {
                event.preventDefault();
                void handleSubmit(undefined, event.ctrlKey || event.metaKey);
              }
            }
          }}
        />

        {/* 同一组入口随输入卡片宽度切换文字或图标，避免窄栏出现两排工具。 */}
        <div className={composerStyles.composerBar}>
          <div className={composerStyles.controls}>
            <ComposerAddMenu
              locale={locale}
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

            <SessionMode
              isZh={locale.isZh}
              selected={activeSession ? activeSession.sessionPreset : state.draftSessionPreset}
              locked={messagesCount > 0 || isRunning}
              busy={Boolean(state.submittingMessage)}
              onSelect={(id) => void store.selectSessionPreset(id).catch((error: unknown) => {
                setContextNotice(error instanceof Error ? error.message : String(error));
              })}
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
              onChangeDraft={setDraft}
              onSend={() => void handleSubmit()}
              onStop={() => void store.abortActiveRun()}
              onNotice={setContextNotice}
            />
          </div>
        </div>
      </div>
      <SessionStatsBar
        messages={messages}
        locale={locale}
        showContext={state.generalSettings.showContextUsage}
        leading={lastMessageId && stats.filesCount > 0 && onOpenTurnChanges ? (
          <button type="button" className={styles.turnChangesTrigger}
            title={locale.isZh ? "查看本轮变更。增删为已记录操作的行数" : "Review changes this turn. Line counts are per recorded edit."}
            onClick={() => { if (lastMessageId) onOpenTurnChanges(lastMessageId); }}>
            {locale.isZh ? `${stats.filesCount} 个文件已变更` : `${stats.filesCount} files changed`}
            {stats.countedChanges && <><span data-change="add">+{stats.added}</span><span data-change="remove">−{stats.removed}</span></>}
          </button>
        ) : undefined}
      />
    </div>
  );
}