// 聊天输入区：范围/项目栏、@ 提及 / 斜杠命令 / 技能弹层、附件与排队提示、输入框及其工具条、统计栏。
import { useEffect, useRef, useState } from "react";
import type { ChatClientStore } from "../store/chat-store";
import { MediaLibraryDialog, mediaChatMessages } from "@lfaa/client-ui-tool-media/client";
import type { ChatLocaleMessages } from "../locales";
import type { ChatMessageItem, ChatSessionDetail } from "../store/chat-types";
import { useComposerAttachInput, useComposerAutoGrow } from "./useComposerInput";
import type { ComposerStoreSlice, useChatComposer } from "./useChatComposer";
import { ClarificationCard } from "../conversation/Clarification-Card";
import { ComposerAddMenu } from "./ComposerAddMenu";
import { ComposerAttachmentChip } from "./ComposerAttachmentChip";
import { ComposerBottomBar } from "./ComposerBottomBar";
import { ComposerCapabilityPanel } from "./ComposerCapabilityPanel";
import { ComposerInputRow } from "./ComposerInputRow";
import { useCapabilitySearch } from "./useCapabilitySearch";
import { ComposerNotice } from "./ComposerNotice";
import { ComposerFollowUpHint } from "./ComposerQueuePanel";
import { ComposerQueueSection } from "./ComposerQueueSection";
import { ComposerScopeBar } from "./ComposerScopeBar";
import { ComposerTriggers } from "./ComposerTriggers";
import { SessionModeBar } from "./SessionModeBar";
import { ComposerStats } from "./ComposerStats";
import styles from "../conversation/ChatWorkspace.module.css";
import composerStyles from "../conversation/ChatWorkspace.composer.module.css";
import attachmentStyles from "../conversation/ChatWorkspace.attachments.module.css";
import type { WorkbenchProjectItem } from "@lfaa/ui-layout";
import type { WorkspaceMode } from "@lfaa/ui-layout/client";

export function ChatComposer({
  locale,
  store,
  state,
  composer,
  projects,
  workspaceMode,
  docked,
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
  onOpenBrowser, onOpenCanvas, onOpenSkills, onOpenConnectors,
  onDeleteRequest,
  onOpenTurnChanges,
}: {
  locale: ChatLocaleMessages;
  store: ChatClientStore;
  state: ComposerStoreSlice;
  composer: ReturnType<typeof useChatComposer>;
  projects: WorkbenchProjectItem[];
  /** 「聊天」只留对话入口；「工作」才展开项目、文件、权限与会话模式。 */
  workspaceMode: WorkspaceMode;
  /** 输入栏停在工作区底部时为 true：此时统一用「占位行 + 工具行」的宽卡片。 */
  docked: boolean;
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
  onOpenCanvas?: (() => void) | undefined; onOpenSkills?: (() => void) | undefined; onOpenConnectors?: (() => void) | undefined;
  onDeleteRequest: () => void;
  onOpenTurnChanges?: ((messageId: string) => void) | undefined;
}) {
  const {
    draft, setDraft, attachments, contextNotice, setContextNotice,
    mentionTrigger, setMentionTrigger, mentionIndex, setMentionIndex,
    slashTrigger, setSlashTrigger, slashIndex, setSlashIndex,
    skillTrigger, setSkillTrigger, skillIndex,
    openProjectSignal, visibleMentionEntries, visibleSlashCommands, visibleSkillEntries,
    fileInputRef, focusTextareaAt,
    handleSelectSkillEntry, handleSelectSlashCommand,
    handleSelectMentionEntry, handleSubmit, appendAttachments, selectedMediaKind,
    removeAttachment, undoAttachmentInsert,
    mediaRatio, setMediaRatio, mediaStyle, setMediaStyle,
  } = composer;

  const mediaLabels = mediaChatMessages[locale.isZh ? "zh" : "en"];
  // 项目内已经是工作形态：输入栏按工作密度渲染，和中心标题保持一致。
  const isWorkMode = workspaceMode === "codex" || Boolean(activeProjectId);
  const showScopeShelf = isWorkMode && messagesCount === 0 && !isRunning;
  // 已绑定项目的空会话按项目名提示，让「这条新会话属于哪个项目」在输入框里就能读到。
  const activeProject = activeProjectId ? projects.find((project) => project.id === activeProjectId) ?? null : null;
  // 仅在空会话（尚未开始对话）时展示项目胶囊；会话已进入项目后不再重复占用输入栏空间。
  const showInlineProjectChip = Boolean(activeProject && !showScopeShelf && messagesCount === 0 && !docked);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  // 素材库入口已并入「添加上下文」菜单，弹窗开关由输入栏持有。
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const triggerMention = () => {
    const nextDraft = draft.endsWith("@") ? draft : `${draft}${draft && !draft.endsWith(" ") ? " " : ""}@`;
    setDraft(nextDraft);
    setSlashTrigger(null);
    setMentionTrigger({ query: "", startIndex: nextDraft.length - 1 });
    setMentionIndex(0);
    focusTextareaAt(nextDraft.length);
  };
  const triggerSlash = () => {
    const nextDraft = draft.endsWith("/") ? draft : `${draft}${draft && !draft.endsWith(" ") ? " " : ""}/`;
    setDraft(nextDraft);
    setMentionTrigger(null);
    setSlashTrigger({ query: "", startIndex: nextDraft.length - 1 });
    setSlashIndex(0);
    focusTextareaAt(nextDraft.length);
  };
  const capability = useCapabilitySearch({
    isZh: locale.isZh, attachments, appendAttachments,
    focusTextarea: () => focusTextareaAt(0), onOpenCanvas, onOpenSkills, onOpenConnectors,
    onPickProject: !showScopeShelf && !activeProject ? () => setProjectMenuOpen(true) : undefined,
    onPickFile: () => fileInputRef.current?.click(),
    onPickFolder: () => folderInputRef.current?.click(),
    onOpenMedia: isWorkMode ? () => setMediaLibraryOpen(true) : undefined,
    onTriggerMention: triggerMention,
    onTriggerSlash: triggerSlash,
    onOpenBrowser,
  });
  useEffect(() => {
    if (openProjectSignal > 0 && !isRunning && !bindingProject) setProjectMenuOpen(true);
  }, [openProjectSignal, isRunning, bindingProject]);
  useEffect(() => {
    if (isRunning || bindingProject) setProjectMenuOpen(false);
  }, [isRunning, bindingProject]);
  const placeholder = selectedMediaKind
    ? mediaLabels[`${selectedMediaKind}Prompt`]
    : (messagesCount === 0 && activeProject
      ? locale.composerPlaceholderInProject.replace("{name}", activeProject.name)
      : (isWorkMode ? locale.composerPlaceholderWork : locale.composerPlaceholderChat));
  // 运行被中断后最后一条助手回复可续写：输入框为空时，发送位改成「继续生成」。
  const lastMessage = messages.at(-1);
  const pausedMessage = !isRunning
    && lastMessage?.role === "assistant"
    && lastMessage.status === "aborted"
    && Boolean(lastMessage.content.trim())
    ? lastMessage
    : null;
  const showContinue = Boolean(pausedMessage) && !draft.trim() && attachments.length === 0;

  // 单行形态只留给「聊天」模式的中心引导区（极简起步）；一旦进入会话停靠到底部，
// 或者切到「工作」模式，都用「占位行 + 工具行」的宽卡片，工具与输入各占一行不互相挤。
  const singleRow = !docked
    && !isWorkMode
    && !capability.mode
    && !worktree
    && attachments.length === 0
    && state.queuedMessages.length === 0
    && !needsApiKey
    && !contextNotice
    && !clarification;

  useComposerAutoGrow(composer.textareaRef, composer.draft);
  const { draggingFiles, setDraggingFiles, handlePaste, handleDrop } = useComposerAttachInput({
    sessionId: activeSession?.id ?? "",
    appendAttachments,
  });

  const scopeBar = (
    <ComposerScopeBar
      locale={locale}
      projects={projects}
      selectedProjectId={activeProjectId ?? null}
      /* 工作模式空会话在卡片头行提供唯一项目入口；聊天模式与停靠态由独立胶囊触发同一浮层。 */
      showShelf={showScopeShelf}
      trailing={showScopeShelf && messagesCount === 0 ? <SessionModeBar store={store} isZh={locale.isZh} /> : undefined}
      projectMenuOpen={projectMenuOpen}
      onProjectMenuOpenChange={setProjectMenuOpen}
      canCreateProject={canCreateProject}
      openProjectSignal={openProjectSignal}
      projectDisabled={isRunning || bindingProject}
      worktree={worktree}
      onSelectProject={onSelectProject}
      onCreateProject={onCreateProject}
      {...(onClearWorktree ? { onClearWorktree } : {})}
    />
  );
  // 位置/项目（或工作树）并到输入卡片头行，避免挂载条压在圆角上；只有浮层时仍留在卡片外，保持弹层向上展开。
  const scopeInCard = showScopeShelf || Boolean(worktree);

  const addMenu = (
    <ComposerAddMenu
      locale={locale}
      sessionId={activeSession?.id ?? ""}
      active={capability.mode === "add"}
      fileInputRef={fileInputRef}
      folderInputRef={folderInputRef}
      onAttachItems={appendAttachments}
      onToggleOpen={() => capability.toggleMode("add")}
    />
  );

  return (
    <div className={styles.composerStack} data-mode={isWorkMode ? "codex" : "chatgpt"} data-chat-row={singleRow ? "single" : undefined}>
      {clarification && lastMessageId && (
        <ClarificationCard key={lastMessageId} messageId={lastMessageId} isZh={locale.isZh} prompt={clarification}
          busy={state.submittingMessage || isRunning}
          chatRequired={Boolean(selectedMediaKind)}
          onSkip={() => { setContextNotice(""); focusTextareaAt(draft.length); onSkipClarification(); }}
          onAnswer={(answer) => onAnswerClarification(answer)} />
      )}
      {!scopeInCard && scopeBar}
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
        ref={capability.cardRef}
        className={composerStyles.composerCard}
        data-dragging={draggingFiles ? "true" : undefined}
        data-searching={capability.mode ? "true" : undefined}
        onKeyDown={(event) => {
          // 焦点可能在缩略图或移除按钮上：整个卡片都接受 Ctrl+Z 撤回刚插入的图片；文本撤销仍由输入框原生处理。
          if (event.defaultPrevented || event.shiftKey || event.altKey) return;
          if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") return;
          if (undoAttachmentInsert()) event.preventDefault();
        }}
        onDragOver={(event) => { event.preventDefault(); setDraggingFiles(true); }}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDraggingFiles(false); }}
        onDrop={handleDrop}
      >
        {scopeInCard && <div className={composerStyles.scopeHeader}>{scopeBar}</div>}
        {needsApiKey && (
          <div className={composerStyles.noticeBar}>
            <span>{locale.modelKeyMissingHint}</span>
            <button type="button" className={composerStyles.noticeLink} onClick={onOpenSettings}>
              {locale.configureModel}
            </button>
          </div>
        )}

        {attachments.length > 0 && (
          <div className={attachmentStyles.attachmentRow}>
            {attachments.map((item) => (
              <ComposerAttachmentChip
                key={item.id}
                item={item}
                locale={locale}
                onRemove={() => removeAttachment(item.id)}
                onNotify={setContextNotice}
              />
            ))}
          </div>
        )}

        <ComposerQueueSection isZh={locale.isZh} queue={state.queuedMessages} store={store} />

        <ComposerNotice
          message={contextNotice}
          dismissLabel={locale.dismissNoticeLabel}
          onDismiss={() => setContextNotice("")}
        />

        {capability.mode && (
          <ComposerCapabilityPanel
            mode={capability.mode}
            isZh={locale.isZh}
            query={capability.query}
            sections={capability.sections}
            flatEntries={capability.flatEntries}
            activeIndex={capability.activeIndex}
            onHoverIndex={capability.setActiveIndex}
            onSelect={capability.selectEntry}
          />
        )}

        <ComposerInputRow
          composer={composer}
          store={store}
          state={state}
          placeholder={placeholder}
          rows={isWorkMode && !singleRow ? 2 : 1}
          onPaste={handlePaste}
          searchOverride={capability.mode ? {
            value: capability.query,
            placeholder: locale.isZh ? "搜索…" : "Search…",
            onChange: capability.setQuery,
            onKeyDown: capability.handleSearchKeyDown,
          } : null}
        />

        <ComposerFollowUpHint
          isZh={locale.isZh}
          followUpMode={state.generalSettings.followUpMode}
          running={isRunning}
          queuedCount={state.queuedMessages.length}
        />

        <ComposerBottomBar
          locale={locale}
          store={store}
          state={state}
          isWorkMode={isWorkMode}
          messagesCount={messagesCount}
          showScopeShelf={showScopeShelf}
          addMenu={addMenu}
          showInlineProjectChip={showInlineProjectChip}
          activeProject={activeProject}
          projectMenuOpen={projectMenuOpen}
          isRunning={isRunning}
          bindingProject={bindingProject}
          capabilityMode={capability.mode}
          hasActiveSession={Boolean(activeSession)}
          selectedMediaKind={selectedMediaKind}
          mediaStyle={mediaStyle}
          mediaRatio={mediaRatio}
          draft={draft}
          canSend={!bindingProject && Boolean(draft.trim() || attachments.length > 0)}
          showContinue={showContinue}
          onToggleProjectMenu={() => setProjectMenuOpen((open) => !open)}
          onToggleCapabilityMode={capability.toggleMode}
          onDeleteRequest={onDeleteRequest}
          onMediaStyleChange={setMediaStyle}
          onMediaRatioChange={setMediaRatio}
          onOpenSettings={onOpenSettings}
          onChangeDraft={setDraft}
          onSend={() => void handleSubmit()}
          onStop={() => void store.abortActiveRun()}
          onContinue={() => { if (pausedMessage) void store.continueInterruptedMessage(pausedMessage.id); }}
          onNotice={setContextNotice}
        />
      </div>
      <MediaLibraryDialog
        isZh={locale.isZh}
        open={mediaLibraryOpen}
        onClose={() => setMediaLibraryOpen(false)}
        onUsePrompt={(prompt) => {
          setDraft(prompt);
          focusTextareaAt(prompt.length);
        }}
      />
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
