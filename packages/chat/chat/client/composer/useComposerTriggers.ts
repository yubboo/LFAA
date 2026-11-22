// 输入栏触发层：@ 提及 / 斜杠命令 / 技能三种触发状态、候选列表与选中动作；草稿与发送仍在 useChatComposer。
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { ChatClientStore } from "../store/chat-store";
import type { ChatLocaleMessages } from "../locales";
import {
  buildMentionEntries,
  buildSlashCommands,
  extractTrailingMentionQuery,
  extractTrailingSkillQuery,
  extractTrailingSlashQuery,
  filterMentionEntries,
  filterSlashCommands,
  mergeHostCommands,
  type ComposerAttachment,
  type HostCommandItem,
  type MentionEntry,
  type SlashCommandEntry,
} from "./composer-context";

/** 技能候选；来自 `/api/skills`，失败时保持空列表。 */
interface SkillItem { id: string; name: string; description: string; source: string }

/** 触发层依赖：草稿与附件由主 Hook 持有，这里只读写文本与追加附件。 */
export interface ComposerTriggerDeps {
  store: ChatClientStore;
  locale: ChatLocaleMessages;
  sessions: Parameters<typeof buildMentionEntries>[0]["sessions"];
  activeSessionId: string | null | undefined;
  activeSectionId: string | null | undefined;
  projectId: string | null;
  draft: string;
  setDraft: Dispatch<SetStateAction<string>>;
  appendAttachments: (items: ComposerAttachment[]) => void;
  clearAttachments: () => void;
  focusTextareaAt: (pos: number) => void;
  fileInputRef: { current: HTMLInputElement | null };
  setContextNotice: (notice: string) => void;
  onOpenSettings: () => void;
}

/** 触发层：三种触发状态、候选列表与四个选中处理器；返回值与拆分前保持一致。 */
export function useComposerTriggers({
  store,
  locale,
  sessions,
  activeSessionId,
  activeSectionId,
  projectId,
  draft,
  setDraft,
  appendAttachments,
  clearAttachments,
  focusTextareaAt,
  fileInputRef,
  setContextNotice,
  onOpenSettings,
}: ComposerTriggerDeps) {
  const [mentionTrigger, setMentionTrigger] = useState<{ query: string; startIndex: number } | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [slashTrigger, setSlashTrigger] = useState<{ query: string; startIndex: number } | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const [skillTrigger, setSkillTrigger] = useState<{ query: string; startIndex: number } | null>(null);
  const [skillIndex, setSkillIndex] = useState(0);
  const [availableSkills, setAvailableSkills] = useState<SkillItem[]>([]);
  const [openProjectSignal, setOpenProjectSignal] = useState(0);

  // 每次输入或移动光标后按优先级判定触发：@ 提及 > 斜杠命令 > 技能。
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
    () => buildMentionEntries({ locale, sessions, activeSessionId: activeSessionId ?? null }),
    [locale, activeSessionId, sessions],
  );
  const visibleMentionEntries = useMemo(
    () => (mentionTrigger ? filterMentionEntries(allMentionEntries, mentionTrigger.query) : []),
    [allMentionEntries, mentionTrigger],
  );

  const [hostCommands, setHostCommands] = useState<HostCommandItem[]>([]);
  // Host 注册的斜杠命令只拉一次；失败时保留内置命令，不阻塞输入。
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/commands")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { commands?: HostCommandItem[] } | null) => {
        if (!cancelled && Array.isArray(data?.commands)) setHostCommands(data.commands);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const allSlashCommands = useMemo(
    () => mergeHostCommands(buildSlashCommands(locale.isZh), hostCommands, locale.isZh),
    [hostCommands, locale.isZh],
  );
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

  /** 选中技能：移除 `$query` 片段并把技能挂成附件。 */
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

  /** Tab 补全斜杠命令：只插入命令名，不执行。 */
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

  /** 选中斜杠命令：本地动作直接执行，宿主命令走 `/api/commands/run`。 */
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
      store.startNewChatDraft({ projectId, sectionId: activeSectionId ?? null });
      setDraft("");
      clearAttachments();
      setContextNotice("");
      focusTextareaAt(0);
      return;
    } else if (entry.actionKind === "clear_draft") {
      setDraft("");
      nextPos = 0;
    } else if (entry.actionKind === "open_settings") {
      onOpenSettings();
      return;
    } else if (entry.actionKind === "host" && entry.hostName) {
      void fetch("/api/commands/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: entry.hostName }),
      })
        .then((res) => (res.ok ? res.json() : res.json().then((data: { error?: string }) => { throw new Error(data.error || `命令执行失败 (${res.status})`); })))
        .then((data: { prompt?: string; message?: string }) => {
          if (data.prompt) {
            setDraft(data.prompt);
            focusTextareaAt(data.prompt.length);
          } else if (data.message) {
            setContextNotice(data.message);
          }
        })
        .catch((error: unknown) => setContextNotice(error instanceof Error ? error.message : String(error)));
      return;
    }
    focusTextareaAt(nextPos);
  };

  /** 选中 @ 提及：文件选择、聚焦项目、挂会话 / 模式附件或提示服务不可用。 */
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

  return {
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
    syncMentionFromText,
    handleSelectSkillEntry,
    handleTabCompleteSlashCommand,
    handleSelectSlashCommand,
    handleSelectMentionEntry,
  };
}