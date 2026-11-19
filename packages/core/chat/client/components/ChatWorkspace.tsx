// 渲染中央聊天工作区：空会话引导、流式回复、Agent 思考/行动/检查轨迹卡片与底部输入栏。
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { IconArrowDown, IconGauge, IconTrash, IconX } from "@tabler/icons-react";
import type { WorkbenchProjectItem, WorkbenchProjectProvider } from "@lfaa/ui-layout";
import { HoverTip, ModalDialog } from "@lfaa/ui-primitives/client";
import type { ChatClientStore } from "../chat-store";
import { fetchCodingSettings, postRunCodeReview } from "../coding-settings-client";
import {
  buildContextualMessage,
  buildMentionEntries,
  buildSlashCommands,
  extractTrailingMentionQuery,
  extractTrailingSkillQuery,
  extractTrailingSlashQuery,
  filterMentionEntries,
  filterSlashCommands,
  type ComposerAttachment,
  type MentionEntry,
  type SlashCommandEntry,
} from "../composer-context";
import type { ChatLocaleMessages } from "../locales";
import { useChatScroll } from "../useChatScroll";
import { AssistantTimeline } from "./AssistantTimeline";
import { ChatAnchorBar, buildTurnAnchors } from "./ChatAnchorBar";
import { ComposerAddMenu } from "./ComposerAddMenu";
import { ComposerRightActions } from "./ComposerRightActions";
import { ComposerScopeBar } from "./ComposerScopeBar";
import { buildFollowUpSuggestions } from "../follow-up-suggestions";
import { MarkdownContent } from "./MarkdownContent";
import {
  AssistantMessageActions,
  EditedFilesCard,
  FollowUpSuggestions,
  UserMessageActions,
  formatDayDivider,
} from "./MessageActionBars";
import { MentionPopover, SlashCommandPopover } from "./MentionPopover";
import { ModelReasoningPicker } from "./ModelReasoningPicker";
import { PermissionModePicker } from "./PermissionModePicker";
import modalStyles from "./ModelProviderGrid.module.css";
import styles from "./ChatWorkspace.module.css";

/** 装配会话时间线、流式反馈和输入栏，将发送、停止与历史操作交给聊天 Store。 */
export function ChatWorkspace({
  locale,
  store,
  projects,
  projectProvider,
  onOpenSettings,
  onOpenGitSettings,
  onOpenFilePreview,
  onOpenBrowser,
}: {
  locale: ChatLocaleMessages;
  store: ChatClientStore;
  projects: WorkbenchProjectItem[];
  projectProvider?: WorkbenchProjectProvider<ReactNode> | null | undefined;
  onOpenSettings: () => void;
  onOpenGitSettings?: (() => void) | undefined;
  onOpenFilePreview: (messageId: string, stepId: string) => void;
  onOpenBrowser?: (() => void) | undefined;
}) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [mentionTrigger, setMentionTrigger] = useState<{ query: string; startIndex: number } | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [slashTrigger, setSlashTrigger] = useState<{ query: string; startIndex: number } | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const [skillTrigger, setSkillTrigger] = useState<{ query: string; startIndex: number } | null>(null);
  const [skillIndex, setSkillIndex] = useState(0);
  const [availableSkills, setAvailableSkills] = useState<Array<{ id: string; name: string; description: string; source: string }>>([]);
  const [openProjectSignal, setOpenProjectSignal] = useState(0);
  const [contextNotice, setContextNotice] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [bindingProject, setBindingProject] = useState(false);
  const projectBindingPending = useRef(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [activeTurnIndex, setActiveTurnIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeSession = state.activeSession;
  const messages = activeSession?.messages ?? [];
  const activeProjectId = activeSession ? activeSession.projectId : state.draftProjectId;
  const activeProfile = state.profiles.find((p) => p.id === state.activeProfileId) ?? state.profiles[0];
  const needsApiKey = Boolean(activeProfile && activeProfile.kind !== "ollama" && !activeProfile.hasApiKey);
  const isRunning = Boolean(state.runningRunId);
  const selectedFile = state.filePreviewTabs?.find((tab) => tab.id === state.activeFilePreviewId);

  const allMentionEntries = useMemo(
    () => buildMentionEntries({ locale, sessions: state.sessions, activeSessionId: state.activeSessionId }),
    [locale, state.activeSessionId, state.sessions],
  );
  const visibleMentionEntries = useMemo(
    () => (mentionTrigger ? filterMentionEntries(allMentionEntries, mentionTrigger.query) : []),
    [allMentionEntries, mentionTrigger],
  );
  const allSlashCommands = useMemo(() => buildSlashCommands(locale.isZh), [locale.isZh]);
  const visibleSlashCommands = useMemo(
    () => (slashTrigger ? filterSlashCommands(allSlashCommands, slashTrigger.query) : []),
    [allSlashCommands, slashTrigger],
  );
  const turnAnchors = useMemo(() => buildTurnAnchors(messages), [messages]);
  const { scrollAreaRef, threadRef, showScrollBottom, scrollToLatest, pauseFollowing, trackScroll } =
    useChatScroll(activeSession?.id ?? null, turnAnchors.at(-1)?.anchorMsgId, isRunning);

  const appendAttachments = (items: ComposerAttachment[]) => {
    setContextNotice("");
    setAttachments((prev) => {
      const next = [...prev];
      for (const item of items) {
        if (item.kind === "mode" && next.some((existing) => existing.kind === "mode" && existing.modeId === item.modeId)) {
          continue;
        }
        next.push(item);
      }
      return next;
    });
  };

  const focusTextareaAt = (pos: number) => {
    window.requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  useEffect(() => {
    const req = state.pendingComposerInsert;
    if (!req) return;
    setDraft((prev) => {
      const next = prev.trim() ? `${prev.trimEnd()}\n\n${req.text}` : req.text;
      focusTextareaAt(next.length);
      return next;
    });
    store.consumeComposerInsert();
  }, [state.pendingComposerInsert, store]);

  const syncMentionFromText = (text: string, cursorPos: number | null) => {
    const pos = cursorPos ?? text.length;
    const detectedMention = extractTrailingMentionQuery(text, pos);
    setMentionTrigger(detectedMention);
    setMentionIndex(0);
    const detectedSlash = detectedMention ? null : extractTrailingSlashQuery(text, pos);
    setSlashTrigger(detectedSlash);
    setSlashIndex(0);
    const detectedSkill = detectedMention || detectedSlash ? null : extractTrailingSkillQuery(text, pos);
    setSkillTrigger(detectedSkill);
    setSkillIndex(0);
    if (detectedSkill) {
      void fetch("/api/skills?includeDisabled=false")
        .then((res) => (res.ok ? res.json() : { skills: [] }))
        .then((data: { skills?: Array<{ id: string; name: string; description: string; source: string }> }) => {
          if (Array.isArray(data.skills)) setAvailableSkills(data.skills);
        })
        .catch(() => {});
    }
  };

  const visibleSkillEntries = useMemo<MentionEntry[]>(() => {
    if (!skillTrigger) return [];
    const q = skillTrigger.query.trim().toLowerCase();
    return availableSkills
      .filter((s) => !q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
      .slice(0, 10)
      .map((s) => ({
        id: `skill-${s.id}`,
        group: "plugins",
        icon: "bulb",
        title: `$${s.name}`,
        description: s.description,
        rightTag: s.source === "personal" ? (locale.isZh ? "个人" : "Personal")
          : s.source === "builtin" ? (locale.isZh ? "内置" : "Built-in")
            : s.source === "project" ? (locale.isZh ? "项目" : "Project")
              : (locale.isZh ? "插件" : "Plugin"),
        actionKind: "attach_session" as const,
        session: {
          id: s.id,
          title: s.name,
          summary: s.description,
          projectId: null,
          sectionId: null,
          archived: false,
          pinned: false,
          unread: false,
          updatedAt: 0,
          createdAt: 0,
          messageCount: 0,
        },
      }));
  }, [availableSkills, locale.isZh, skillTrigger]);

  const handleSelectSkillEntry = (entry: MentionEntry) => {
    let nextPos = draft.length;
    if (skillTrigger) {
      const before = draft.slice(0, skillTrigger.startIndex);
      const after = draft.slice(skillTrigger.startIndex + 1 + skillTrigger.query.length);
      const next = `${before}${after}`.replace(/^\s+/u, "");
      setDraft(next);
      nextPos = next.length;
    }
    setSkillTrigger(null);
    setContextNotice("");
    if (entry.session) {
      appendAttachments([
        {
          id: `skill-${entry.session.id}`,
          kind: "skill",
          skillId: entry.session.id,
          label: `$${entry.session.title}`,
          ...(entry.rightTag ? { detail: entry.rightTag } : {}),
        },
      ]);
    }
    focusTextareaAt(nextPos);
  };

  const handleTabCompleteSlashCommand = (entry: SlashCommandEntry) => {
    if (!slashTrigger) return;
    const before = draft.slice(0, slashTrigger.startIndex);
    const after = draft.slice(slashTrigger.startIndex + 1 + slashTrigger.query.length);
    const inserted = `${entry.command} `;
    const next = `${before}${inserted}${after.replace(/^\s+/u, "")}`;
    setDraft(next);
    setSlashTrigger(null);
    focusTextareaAt(before.length + inserted.length);
  };

  const handleSelectSlashCommand = (entry: SlashCommandEntry) => {
    let nextPos = draft.length;
    if (slashTrigger) {
      const before = draft.slice(0, slashTrigger.startIndex);
      const after = draft.slice(slashTrigger.startIndex + 1 + slashTrigger.query.length);
      const next = `${before}${after}`.replace(/^\s+/u, "");
      setDraft(next);
      nextPos = next.length;
    }
    setSlashTrigger(null);
    setContextNotice("");

    if (entry.actionKind === "mode_plan") {
      appendAttachments([{ id: "mode-plan", kind: "mode", modeId: "plan", label: locale.mentionPlanTitle }]);
    } else if (entry.actionKind === "mode_goal") {
      appendAttachments([{ id: "mode-goal", kind: "mode", modeId: "goal", label: locale.mentionGoalTitle }]);
    } else if (entry.actionKind === "new_chat") {
      store.startNewChatDraft({ projectId: activeProjectId, sectionId: activeSession?.sectionId ?? null });
      setDraft("");
      setAttachments([]);
      nextPos = 0;
    } else if (entry.actionKind === "clear_draft") {
      setDraft("");
      nextPos = 0;
    } else if (entry.actionKind === "open_settings") {
      onOpenSettings();
      return;
    }
    focusTextareaAt(nextPos);
  };

  const handleSelectMentionEntry = (entry: MentionEntry) => {
    let nextPos = draft.length;
    if (mentionTrigger) {
      const before = draft.slice(0, mentionTrigger.startIndex);
      const after = draft.slice(mentionTrigger.startIndex + 1 + mentionTrigger.query.length);
      const next = `${before}${after}`.replace(/^\s+/u, "");
      setDraft(next);
      nextPos = next.length;
    }
    setMentionTrigger(null);
    setContextNotice("");

    if (entry.actionKind === "pick_files") {
      fileInputRef.current?.click();
    } else if (entry.actionKind === "focus_project") {
      setOpenProjectSignal((n) => n + 1);
    } else if (entry.actionKind === "mode_goal") {
      appendAttachments([{ id: "mode-goal", kind: "mode", modeId: "goal", label: locale.mentionGoalTitle }]);
    } else if (entry.actionKind === "mode_plan") {
      appendAttachments([{ id: "mode-plan", kind: "mode", modeId: "plan", label: locale.mentionPlanTitle }]);
    } else if (entry.actionKind === "attach_session" && entry.session) {
      appendAttachments([
        {
          id: `session-${entry.session.id}`,
          kind: "session",
          label: entry.session.title,
          detail: entry.session.summary || `${entry.session.messageCount} messages`,
        },
      ]);
    } else if (entry.actionKind === "unconnected") {
      setContextNotice(`${entry.title}：${locale.ctxServiceUnavailable}`);
    }
    focusTextareaAt(nextPos);
  };

  // 等待项目绑定写回，避免用户立即发送时沿用旧目录。
  const changeProjectBinding = async (projectId: string | null) => {
    if (isRunning || projectBindingPending.current) return;
    projectBindingPending.current = true;
    setBindingProject(true);
    setContextNotice("");
    try {
      await store.setActiveProjectBinding(projectId);
    } catch (error) {
      setContextNotice(error instanceof Error ? error.message : String(error));
    } finally {
      projectBindingPending.current = false;
      setBindingProject(false);
    }
  };

  const handleSubmit = async (customText?: string, invertFollowUp = false) => {
    if (projectBindingPending.current) return;
    const raw = (customText ?? draft).trim();
    if (!raw && attachments.length === 0) return;

    if (!customText) {
      if (raw === "/new") {
        store.startNewChatDraft({ projectId: activeProjectId, sectionId: activeSession?.sectionId ?? null });
        setDraft("");
        setAttachments([]);
        setSlashTrigger(null);
        return;
      }
      if (raw === "/clear") {
        setDraft("");
        setSlashTrigger(null);
        return;
      }
      if (raw === "/settings") {
        setDraft("");
        setSlashTrigger(null);
        onOpenSettings();
        return;
      }
    }

    let effectiveRaw = raw;
    let effectiveAttachments = attachments;
    if (!customText && /^\/plan(?:\s|$)/iu.test(raw)) {
      const rest = raw.replace(/^\/plan\s*/iu, "").trim();
      if (!rest) {
        appendAttachments([{ id: "mode-plan", kind: "mode", modeId: "plan", label: locale.mentionPlanTitle }]);
        setDraft("");
        setSlashTrigger(null);
        return;
      }
      effectiveRaw = rest;
      if (!effectiveAttachments.some((a) => a.kind === "mode" && a.modeId === "plan")) {
        effectiveAttachments = [
          ...effectiveAttachments,
          { id: "mode-plan", kind: "mode", modeId: "plan", label: locale.mentionPlanTitle },
        ];
      }
    } else if (!customText && /^\/goal(?:\s|$)/iu.test(raw)) {
      const rest = raw.replace(/^\/goal\s*/iu, "").trim();
      if (!rest) {
        appendAttachments([{ id: "mode-goal", kind: "mode", modeId: "goal", label: locale.mentionGoalTitle }]);
        setDraft("");
        setSlashTrigger(null);
        return;
      }
      effectiveRaw = rest;
      if (!effectiveAttachments.some((a) => a.kind === "mode" && a.modeId === "goal")) {
        effectiveAttachments = [
          ...effectiveAttachments,
          { id: "mode-goal", kind: "mode", modeId: "goal", label: locale.mentionGoalTitle },
        ];
      }
    }

    const selectedSkillIds = effectiveAttachments
      .filter((a) => a.kind === "skill" && a.skillId)
      .map((a) => a.skillId!);
    const nonSkillAttachments = effectiveAttachments.filter((a) => a.kind !== "skill");
    let finalMessage = customText ? raw : buildContextualMessage(effectiveRaw, nonSkillAttachments);
    if (!finalMessage) return;
    const prevDraft = draft;
    const prevAttachments = attachments;
    if (!customText) {
      setDraft("");
      setAttachments([]);
      setMentionTrigger(null);
      setSlashTrigger(null);
      setSkillTrigger(null);
      setContextNotice("");
    }
    try {
      const reviewCmdMatch = raw.match(/^\/review(?:\s+(.*))?$/iu);
      if (reviewCmdMatch) {
        const [codingCfg, report] = await Promise.all([
          fetchCodingSettings().catch(() => null),
          postRunCodeReview({ projectId: activeProjectId, scope: "working_tree" }),
        ]);
        if (codingCfg?.git.reviewDisplayMode === "separate" && activeSession) {
          store.startNewChatDraft({ projectId: activeProjectId });
        }
        const findingsText = report.findings
          .slice(0, 8)
          .map((f, i) => `${i + 1}. [${f.severity}] ${f.file}${f.line ? `:${f.line}` : ""} ${f.title} — ${f.suggestion}`)
          .join("\n");
        const extraFocus = reviewCmdMatch[1]?.trim() ? `\n补充审查要求：${reviewCmdMatch[1].trim()}` : "";
        finalMessage = `请审查当前内置 Git 代码变更（${report.repoSlug} / ${report.branch}）：\n${report.summary}${extraFocus}${findingsText ? `\n\n预检发现：\n${findingsText}` : ""}`;
        if (needsApiKey) {
          setContextNotice(report.summary);
          return;
        }
      }

      if (isRunning) {
        await store.submitFollowUp(finalMessage, invertFollowUp);
      } else {
        await store.sendMessage(finalMessage, selectedSkillIds);
      }
    } catch (err) {
      if (!customText) {
        setDraft(prevDraft);
        setAttachments(prevAttachments);
      }
      if (err instanceof Error && !state.errorMessage) {
        setContextNotice(err.message);
      }
    }
  };

  const estimatedContextChars =
    messages.reduce((sum, item) => sum + item.content.length + (item.reasoning?.length ?? 0), 0) + draft.length;
  const estimatedTokens = Math.round(estimatedContextChars / 3.5);
  const contextUsageLabel = `${locale.isZh ? "上下文估算 Token 用量" : "Estimated context tokens"} · ~${estimatedTokens}`;

  return (
    <section className={styles.root} aria-label={locale.workspaceTitle}>
      <div
        ref={scrollAreaRef}
        className={styles.scrollArea}
        onScroll={(event) => {
          const el = event.currentTarget;
          trackScroll(el);
          if (turnAnchors.length > 0) {
            const containerTop = el.getBoundingClientRect().top + 96;
            let bestIdx = 0;
            const nodes = el.querySelectorAll<HTMLElement>("[data-turn-anchor]");
            nodes.forEach((node, idx) => {
              if (node.getBoundingClientRect().top <= containerTop) {
                bestIdx = idx;
              }
            });
            setActiveTurnIndex(bestIdx);
          }
        }}
      >
        {messages.length === 0 ? (
          <div className={styles.hero}>
            <h1 className={styles.heroTitle}>{locale.welcomeHeadline}</h1>
            <p className={styles.heroSubtitle}>{locale.welcomeSubtitle}</p>
            {state.generalSettings.homeSuggestions && (
              <div className={styles.starters}>
                {[locale.starterInspect, locale.starterMemory, locale.starterRules].map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className={styles.starterChip}
                    onClick={() => void handleSubmit(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
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
                    onEdit={() => {
                      setDraft(msg.content);
                      textareaRef.current?.focus();
                    }}
                  />
                </div>
              ) : (
                <article key={msg.id} className={styles.assistantRow}>
                  <AssistantTimeline
                    locale={locale}
                    content={msg.content}
                    progressText={msg.progressText}
                    steps={msg.steps ?? []}
                    createdAt={msg.createdAt}
                    runDurationMs={msg.runDurationMs}
                    reasoningDurationMs={msg.reasoningDurationMs}
                    isStreaming={msg.status === "streaming"}
                    pendingApproval={msg.status === "streaming" ? state.pendingApproval : null}
                    onResolveApproval={(approved) => void store.resolveApproval(approved)}
                    onOpenFile={(stepId) => onOpenFilePreview(msg.id, stepId)}
                    selectedFileStepId={selectedFile?.messageId === msg.id ? selectedFile.stepId : undefined}
                    bodyClassName={styles.assistantBody}
                  />
                  <EditedFilesCard
                    isZh={locale.isZh}
                    steps={msg.steps ?? []}
                    projectId={activeProjectId}
                    onViewChanges={onOpenGitSettings}
                    onOpenFile={(stepId) => onOpenFilePreview(msg.id, stepId)}
                    selectedFileStepId={selectedFile?.messageId === msg.id ? selectedFile.stepId : undefined}
                  />
                  {msg.status !== "streaming" && msg.content.trim() && (
                    <AssistantMessageActions
                      isZh={locale.isZh}
                      content={msg.content}
                      createdAt={msg.createdAt}
                      model={msg.model}
                      memoryRefCount={state.memories.length}
                      onBranchToNewChat={() => {
                        store.startNewChatDraft({
                          projectId: activeProjectId,
                          sectionId: activeSession?.sectionId ?? null,
                        });
                        setDraft(
                          locale.isZh
                            ? `基于以下前文继续探讨：\n> ${msg.content.slice(0, 180).replace(/\n+/g, " ")}\n\n`
                            : `Continue from:\n> ${msg.content.slice(0, 180).replace(/\n+/g, " ")}\n\n`,
                        );
                        textareaRef.current?.focus();
                      }}
                    />
                  )}
                  {msg.status === "aborted" && !isRunning && msg.content.trim() && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      <button
                        type="button"
                        className={styles.noticeLink}
                        onClick={() => void store.continueInterruptedMessage(msg.id)}
                      >
                        {locale.isZh ? "继续生成（从完整句边界续写）" : "Continue from clean boundary"}
                      </button>
                    </div>
                  )}
                  {msgIdx === messages.length - 1 && !isRunning && msg.status !== "streaming" && msg.content.trim() && (
                    <FollowUpSuggestions
                      suggestions={buildFollowUpSuggestions(
                        messages[msgIdx - 1]?.role === "user" ? (messages[msgIdx - 1]?.content ?? "") : "",
                        msg.content,
                        locale.isZh,
                      )}
                      onSelect={(question) => void handleSubmit(question)}
                    />
                  )}
                </article>
              ),
            )}
          </div>
        )}
      </div>

      <ChatAnchorBar
        turns={turnAnchors}
        activeTurnIndex={activeTurnIndex}
        onJumpToTurn={(anchorMsgId, idx) => {
          setActiveTurnIndex(idx);
          const viewport = scrollAreaRef.current;
          const target = viewport?.querySelector<HTMLElement>(`[data-turn-anchor="${anchorMsgId}"]`);
          if (!viewport || !target) return;
          pauseFollowing();
          viewport.scrollTo({
            top: viewport.scrollTop + target.getBoundingClientRect().top - viewport.getBoundingClientRect().top,
            behavior: isRunning ? "instant" : "smooth",
          });
        }}
      />

      <div className={styles.composerDock}>
        {showScrollBottom && messages.length > 0 && (
          <button
            type="button"
            className={styles.scrollBottomBtn}
            aria-label={locale.isZh ? "回到底部" : "Scroll to bottom"}
            onClick={scrollToLatest}
          >
            <IconArrowDown size={15} stroke={2} />
          </button>
        )}
        {state.errorMessage && (
          <div className={styles.errorBanner} role="alert">{state.errorMessage}</div>
        )}
        {state.streamStatusNotice && (
          <div className={styles.noticeBar} role="status">
            <span>{state.streamStatusNotice}</span>
            {state.degradedStream && (
              <button type="button" className={styles.noticeLink} onClick={() => store.retryDegradedStream()}>
                {locale.isZh ? "立即重试恢复" : "Retry now"}
              </button>
            )}
          </div>
        )}
        <div className={styles.composerStack}>
          <ComposerScopeBar
            locale={locale}
            projects={projects}
            selectedProjectId={activeProjectId}
            showShelf={messages.length === 0 && !isRunning}
            canCreateProject={Boolean(projectProvider)}
            openProjectSignal={openProjectSignal}
            projectDisabled={isRunning || bindingProject}
            onSelectProject={(projectId) => void changeProjectBinding(projectId)}
            onCreateProject={() => setCreateDialogOpen(true)}
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
          <div className={styles.composerCard}>
            {needsApiKey && (
              <div className={styles.noticeBar}>
                <span>{locale.modelKeyMissingHint}</span>
                <button type="button" className={styles.noticeLink} onClick={onOpenSettings}>
                  {locale.configureModel}
                </button>
              </div>
            )}

            {attachments.length > 0 && (
              <div className={styles.attachmentRow}>
                {attachments.map((item) => (
                  <span key={item.id} className={styles.attachmentChip}>
                    <span className={styles.attachmentChipLabel}>{item.label}</span>
                    {item.detail && <span className={styles.attachmentChipDetail}>{item.detail}</span>}
                    <button
                      type="button"
                      className={styles.attachmentChipRemove}
                      aria-label={item.label}
                      onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== item.id))}
                    >
                      <IconX size={11} aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {state.queuedMessages.length > 0 && (
              <div className={styles.attachmentRow} aria-label={locale.isZh ? "排队消息" : "Queued messages"}>
                {state.queuedMessages.map((queued, idx) => (
                  <span key={`${idx}-${queued.slice(0, 12)}`} className={styles.attachmentChip}>
                    <span className={styles.attachmentChipLabel}>{locale.isZh ? "排队" : "Queued"}</span>
                    <span className={styles.attachmentChipDetail}>{queued.slice(0, 28)}</span>
                    <button
                      type="button"
                      className={styles.attachmentChipRemove}
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
              <div className={styles.contextNotice} role="status">
                <span>{contextNotice}</span>
                <button
                  type="button"
                  className={styles.contextNoticeClose}
                  aria-label={locale.dismissNoticeLabel}
                  onClick={() => setContextNotice("")}
                >
                  <IconX size={12} aria-hidden="true" />
                </button>
              </div>
            )}

            <textarea
              ref={textareaRef}
              className={styles.textarea}
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
            <div className={styles.composerBar}>
              <div className={styles.controls}>
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

                {state.generalSettings.showContextUsage && estimatedTokens > 0 && (
                  <HoverTip label={contextUsageLabel}>
                    <span className={styles.contextMeter} role="img" aria-label={contextUsageLabel} tabIndex={0}>
                      <IconGauge size={15} className={styles.contextMeterIcon} aria-hidden="true" />
                      <span className={styles.contextMeterText}>{`~${estimatedTokens} tok`}</span>
                    </span>
                  </HoverTip>
                )}

                {activeSession && (
                  <HoverTip label={locale.deleteChat}>
                    <button
                      type="button"
                      className={styles.toolBtn}
                      aria-label={locale.deleteChat}
                      onClick={() => setDeleteConfirmOpen(true)}
                    >
                      <IconTrash size={14} aria-hidden="true" />
                    </button>
                  </HoverTip>
                )}
              </div>

              <div className={styles.rightCluster}>
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
        </div>
      </div>

      {createDialogOpen && projectProvider?.renderCreateDialog({
        onCreated: (project) => {
          setCreateDialogOpen(false);
          void changeProjectBinding(project.id);
        },
        onClose: () => setCreateDialogOpen(false),
      })}

      <ModalDialog
        open={Boolean(deleteConfirmOpen && activeSession)}
        title={locale.isZh ? "删除当前对话" : "Delete Current Chat"}
        subtitle={activeSession?.title ?? ""}
        size="sm"
        closeLabel={locale.isZh ? "关闭" : "Close"}
        onClose={() => setDeleteConfirmOpen(false)}
        footer={(
          <div className={modalStyles.footerRight}>
            <button
              type="button"
              className={modalStyles.btn}
              onClick={() => setDeleteConfirmOpen(false)}
            >
              {locale.isZh ? "取消" : "Cancel"}
            </button>
            <button
              type="button"
              className={modalStyles.dangerBtn}
              onClick={() => {
                if (activeSession) void store.deleteSession(activeSession.id);
                setDeleteConfirmOpen(false);
              }}
            >
              {locale.isZh ? "确认删除" : "Delete"}
            </button>
          </div>
        )}
      >
        <p style={{ margin: 0, fontSize: "0.86em", color: "var(--color-muted)" }}>
          {locale.isZh
            ? "确定要删除当前对话吗？删除后该会话的所有聊天记录将永久移除，无法恢复。"
            : "Delete this chat session permanently? This cannot be undone."}
        </p>
      </ModalDialog>
    </section>
  );
}
