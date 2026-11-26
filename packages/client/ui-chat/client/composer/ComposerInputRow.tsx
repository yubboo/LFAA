// 输入卡片正文行：承载输入框与触发词/快捷键处理；行内按钮由底部工具条统一排版。
import type { ChangeEvent, ClipboardEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import type { ChatClientStore } from "../store/chat-store";
import { handleComposerKeydown } from "./composer-keyboard";
import { type ComposerStoreSlice, useChatComposer } from "./useChatComposer";
import styles from "../conversation/ChatWorkspace.composer.module.css";

/** 输入框及其快捷键/触发词处理；行内不放其它控件，保持输入区与工具条分层。 */
export function ComposerInputRow({
  composer,
  store,
  state,
  placeholder,
  rows,
  onPaste,
}: {
  composer: ReturnType<typeof useChatComposer>;
  store: ChatClientStore;
  state: ComposerStoreSlice;
  placeholder: string;
  rows: number;
  onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
}) {
  const {
    draft, setDraft, textareaRef, syncMentionFromText,
    mentionTrigger, mentionIndex, setMentionTrigger, setMentionIndex, visibleMentionEntries, handleSelectMentionEntry,
    slashTrigger, slashIndex, setSlashTrigger, setSlashIndex, visibleSlashCommands, handleSelectSlashCommand,
    skillTrigger, skillIndex, setSkillTrigger, setSkillIndex, visibleSkillEntries, handleSelectSkillEntry,
    handleTabCompleteSlashCommand, handleSubmit, undoAttachmentInsert,
  } = composer;

  const field = (
    <textarea
      ref={textareaRef}
      className={styles.textarea}
      placeholder={placeholder}
      value={draft}
      rows={rows}
      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
        const nextVal = event.target.value;
        setDraft(nextVal);
        syncMentionFromText(nextVal, event.target.selectionStart);
      }}
      onClick={(event) => {
        syncMentionFromText(draft, event.currentTarget.selectionStart);
      }}
      onPaste={onPaste}
      onKeyDown={(event: ReactKeyboardEvent<HTMLTextAreaElement>) => handleComposerKeydown(event, {
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
        undoAttachment: undoAttachmentInsert,
      })}
    />
  );

  return field;
}