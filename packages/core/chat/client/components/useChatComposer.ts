// 聊天输入栏状态机：草稿、附件、@ 提及 / 斜杠命令 / 技能触发、输入框交互与发送（含 /plan、/goal、/review 快捷指令）。
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { ChatClientStore } from "../chat-store";
import type { ChatLocaleMessages } from "../locales";
import type { ChatSessionDetail, ChatStoreSnapshot } from "../chat-types";
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
import { fetchCodingSettings, postRunCodeReview } from "../coding-settings-client";

interface SkillItem { id: string; name: string; description: string; source: string }

export function useChatComposer({
  store,
  locale,
  state,
  activeSession,
  activeProjectId,
  isRunning,
  needsApiKey,
  onOpenSettings,
  projectBindingPending,
}: {
  store: ChatClientStore;
  locale: ChatLocaleMessages;
  state: ChatStoreSnapshot;
  activeSession: ChatSessionDetail | null | undefined;
  activeProjectId: string | null | undefined;
  isRunning: boolean;
  needsApiKey: boolean;
  onOpenSettings: () => void;
  projectBindingPending: RefObject<boolean>;
}) {
  const projectId = activeProjectId ?? null;
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [mentionTrigger, setMentionTrigger] = useState<{ query: string; startIndex: number } | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [slashTrigger, setSlashTrigger] = useState<{ query: string; startIndex: number } | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const [skillTrigger, setSkillTrigger] = useState<{ query: string; startIndex: number } | null>(null);
  const [skillIndex, setSkillIndex] = useState(0);
  const [availableSkills, setAvailableSkills] = useState<SkillItem[]>([]);
  const [openProjectSignal, setOpenProjectSignal] = useState(0);
  const [contextNotice, setContextNotice] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        .then((data: { skills?: SkillItem[] }) => {
          if (Array.isArray(data.skills)) setAvailableSkills(data.skills);
        })
        .catch(() => {});
    }
  };

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
      store.startNewChatDraft({ projectId, sectionId: activeSession?.sectionId ?? null });
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

  const handleSubmit = async (customText?: string, invertFollowUp = false) => {
    if (projectBindingPending.current || state.submittingMessage) return;
    const raw = (customText ?? draft).trim();
    if (!raw && attachments.length === 0) return;

    if (!customText) {
      if (raw === "/new") {
        store.startNewChatDraft({ projectId, sectionId: activeSession?.sectionId ?? null });
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
          postRunCodeReview({ projectId, scope: "working_tree" }),
        ]);
        if (codingCfg?.git.reviewDisplayMode === "separate" && activeSession) {
          store.startNewChatDraft({ projectId });
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

  return {
    draft,
    setDraft,
    attachments,
    setAttachments,
    appendAttachments,
    contextNotice,
    setContextNotice,
    mentionTrigger,
    setMentionTrigger,
    mentionIndex,
    setMentionIndex,
    slashTrigger,
    setSlashTrigger,
    slashIndex,
    setSlashIndex,
    skillTrigger,
    setSkillTrigger,
    skillIndex,
    setSkillIndex,
    openProjectSignal,
    visibleMentionEntries,
    visibleSlashCommands,
    visibleSkillEntries,
    textareaRef,
    fileInputRef,
    syncMentionFromText,
    focusTextareaAt,
    handleSelectSkillEntry,
    handleTabCompleteSlashCommand,
    handleSelectSlashCommand,
    handleSelectMentionEntry,
    handleSubmit,
  };
}