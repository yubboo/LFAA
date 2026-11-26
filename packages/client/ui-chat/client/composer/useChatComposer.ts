// 聊天输入栏状态机：草稿、附件、输入框交互与发送（含 /plan、/goal、/review 快捷指令）；@ / 斜杠 / 技能触发见 useComposerTriggers。
import { useEffect, useRef, useState, type RefObject } from "react";
import type { ChatClientStore } from "../store/chat-store";
import type { ChatLocaleMessages } from "../locales";
import type { ChatSessionDetail, ChatStoreSnapshot } from "../store/chat-types";
import { collectImageAttachmentIds } from "./composer-attachments";
import {
  dropAttachmentFromHistory,
  pushInsertBatch,
  takeUndoBatch,
  type AttachmentInsertBatch,
} from "./composer-attachment-undo";
import { composerDraftScope } from "./composer-draft-memory";
import { useComposerDraftMemory } from "./useComposerDraftMemory";
import { useMediaOptions } from "./useMediaOptions";
import { submitMediaGeneration } from "./media-submit";
import { buildContextualMessage, type ComposerAttachment } from "./composer-context";
import { useComposerTriggers } from "./useComposerTriggers";
import { fetchCodingSettings, postRunCodeReview } from "../settings/coding-settings-client";
import { filterConfiguredProfiles, resolveActiveProfile } from "../models/model-reasoning-options";

/** 输入栏（含其状态机）只读取这些字段：调用方按切片订阅透传，其余状态变化不再连带重建输入栏。 */
export type ComposerStoreSlice = Pick<
  ChatStoreSnapshot,
  | "profiles"
  | "activeProfileId"
  | "pendingComposerInsert"
  | "sessions"
  | "activeSessionId"
  | "submittingMessage"
  | "queuedMessages"
  | "generalSettings"
  | "permissionMode"
  | "reasoningLevel"
>;

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
  state: ComposerStoreSlice;
  activeSession: ChatSessionDetail | null | undefined;
  activeProjectId: string | null | undefined;
  isRunning: boolean;
  needsApiKey: boolean;
  onOpenSettings: () => void;
  projectBindingPending: RefObject<boolean>;
}) {
  const projectId = activeProjectId ?? null;
  const [draft, setDraft] = useState("");
  const [allAttachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const attachments = allAttachments.filter((item) => !item.mediaSource || item.mediaSource.sessionId === activeSession?.id);
  // 附件插入历史只服务「Ctrl+Z 撤回刚插入的图片/文件」：批次基于全部附件，避免切换会话时丢撤销线索。
  const allAttachmentsRef = useRef<ComposerAttachment[]>(allAttachments);
  allAttachmentsRef.current = allAttachments;
  const insertHistoryRef = useRef<AttachmentInsertBatch[]>([]);
  const [contextNotice, setContextNotice] = useState("");
  // 未发送内容按「新会话（按项目）/ 已有会话」分区记忆；切走再回来时恢复文字与图片。
  useComposerDraftMemory({
    scope: composerDraftScope({ sessionId: state.activeSessionId, projectId }),
    activeSessionId: state.activeSessionId,
    draft,
    setDraft,
    allAttachments,
    setAttachments,
  });
  // 切换会话/项目后，图片与草稿来自另一个分区：撤销历史必须清空，否则 Ctrl+Z 会撤掉别的分区内容。
  useEffect(() => {
    insertHistoryRef.current = [];
  }, [state.activeSessionId, projectId]);
  // 生图选项：画幅与风格（auto 交给宿主识别 / 提示词导演），发送后按实际比例回写。
  const media = useMediaOptions();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const submitProfile = resolveActiveProfile(filterConfiguredProfiles(state.profiles), state.activeProfileId);
  const submitKind = submitProfile?.availableModels?.find((item) => item.id === submitProfile.model)?.modelKind;
  const selectedMediaKind = submitKind === "image" || submitKind === "video" || submitKind === "audio" ? submitKind : undefined;

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

  const applyAttachments = (next: ComposerAttachment[]) => {
    allAttachmentsRef.current = next;
    setAttachments(next);
  };

  const appendAttachments = (items: ComposerAttachment[]) => {
    const next = [...allAttachmentsRef.current];
    const addedIds: string[] = [];
    for (const item of items) {
      if (item.mediaSource && next.some((existing) => existing.id === item.id)) continue;
      if (item.kind === "mode" && next.some((existing) => existing.kind === "mode" && existing.modeId === item.modeId)) {
        continue;
      }
      next.push(item);
      addedIds.push(item.id);
    }
    if (addedIds.length === 0) return;
    // 记下插入前的草稿：文字随后被改动时不再接管 Ctrl+Z，保留浏览器原生文字撤销。
    pushInsertBatch(insertHistoryRef.current, addedIds, draft);
    setContextNotice("");
    applyAttachments(next);
  };

  /** 清空输入区附件（发送、切新会话时调用）：撤销历史一并丢弃，避免撤回已发出的图片。 */
  const resetAttachments = () => {
    insertHistoryRef.current = [];
    applyAttachments([]);
  };

  /** 手动移除某个附件：同步裁掉撤销历史里的同 id，再回到浏览器原生行为。 */
  const removeAttachment = (id: string) => {
    dropAttachmentFromHistory(insertHistoryRef.current, id);
    applyAttachments(allAttachmentsRef.current.filter((item) => item.id !== id));
  };

  /** Ctrl+Z 撤回最近一次附件插入；返回 false 时输入框走浏览器原生撤销。 */
  const undoAttachmentInsert = (): boolean => {
    const ids = takeUndoBatch(insertHistoryRef.current, draft);
    if (!ids) return false;
    const removed = new Set(ids);
    applyAttachments(allAttachmentsRef.current.filter((item) => !removed.has(item.id)));
    setContextNotice("");
    return true;
  };

  const focusTextareaAt = (pos: number) => {
    window.requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  // 触发层拆到 useComposerTriggers：@ / 斜杠 / 技能的状态与选中动作不再堆在这个 Hook 里。
  const triggers = useComposerTriggers({
    store,
    locale,
    sessions: state.sessions,
    activeSessionId: state.activeSessionId,
    activeSectionId: activeSession?.sectionId ?? null,
    projectId,
    draft,
    setDraft,
    appendAttachments,
    clearAttachments: resetAttachments,
    focusTextareaAt,
    fileInputRef,
    setContextNotice,
    onOpenSettings,
  });
  const { setMentionTrigger, setSlashTrigger, setSkillTrigger } = triggers;
  const handleSubmit = async (customText?: string, invertFollowUp = false) => {
    if (projectBindingPending.current || state.submittingMessage) return;
    const raw = (customText ?? draft).trim();
    if (!raw && attachments.length === 0) return;

    // 选中生图/生视频/语音模型时：把描述直接交给媒体生成链路，不再拦截。
    if (selectedMediaKind) {
      if (isRunning) return;
      const mediaKind = selectedMediaKind;
      if (!raw) { focusTextareaAt(0); return; }
      setDraft("");
      resetAttachments();
      setSlashTrigger(null);
      // 生成中的进度由消息区的生成占位呈现，不再占用输入框上方的状态行。
      const result: { ok: boolean; error?: string; ratio?: string } = await submitMediaGeneration({
        store,
        kind: mediaKind,
        prompt: raw,
        attachments,
        profile: submitProfile,
        ratio: media.ratio,
        style: media.style,
      }).catch((error: unknown) => ({ ok: false, error: error instanceof Error ? error.message : String(error) }));
      if (!result.ok) {
        setDraft((current) => current || raw);
        if (allAttachmentsRef.current.length === 0) applyAttachments(attachments);
      }
      setContextNotice(result.ok
        ? ""
        : (result.error ?? (locale.isZh ? "生成失败，请稍后重试。" : "Generation failed.")));
      if (result.ok) media.syncRatio(result.ratio);
      focusTextareaAt(0);
      return;
    }

    if (!customText) {
      if (raw === "/new") {
        store.startNewChatDraft({ projectId, sectionId: activeSession?.sectionId ?? null });
        setDraft("");
        resetAttachments();
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
    const referenceSources = effectiveAttachments.flatMap((item) => item.mediaSource
      ? [{ messageId: item.mediaSource.messageId, path: item.mediaSource.path }] : []);
    // 图片附件同样交给 Host 记录到用户消息，气泡才能像直连生图一样显示缩略图。
    const imageAttachmentIds = collectImageAttachmentIds(effectiveAttachments);
    if (isRunning && (referenceSources.length || imageAttachmentIds.length)) {
      setContextNotice(locale.isZh ? "请等待当前任务结束，再发带图片的消息。" : "Wait for the current run before sending images.");
      return;
    }
    const nonSkillAttachments = effectiveAttachments.filter((a) => a.kind !== "skill" && !a.mediaSource);
    let finalMessage = customText ? raw : buildContextualMessage(effectiveRaw, nonSkillAttachments);
    if (!finalMessage) return;
    const prevDraft = draft;
    const prevAttachments = attachments;
    if (!customText) {
      setDraft("");
      resetAttachments();
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
        await store.sendMessage(finalMessage, selectedSkillIds, referenceSources, imageAttachmentIds);
      }
    } catch (err) {
      if (!customText) {
        setDraft(prevDraft);
        applyAttachments(prevAttachments);
      }
      if (err instanceof Error && !store.getSnapshot().errorMessage) {
        setContextNotice(err.message);
      }
    }
  };

  return {
    draft,
    setDraft,
    attachments,
    selectedMediaKind,
    mediaRatio: media.ratio,
    setMediaRatio: media.setRatio,
    mediaStyle: media.style,
    setMediaStyle: media.setStyle,
    setAttachments,
    appendAttachments,
    removeAttachment,
    undoAttachmentInsert,
    contextNotice,
    setContextNotice,
    // 触发状态、候选列表与选中处理器由 useComposerTriggers 统一提供。
    ...triggers,
    textareaRef,
    fileInputRef,
    focusTextareaAt,
    handleSubmit,
  };
}
