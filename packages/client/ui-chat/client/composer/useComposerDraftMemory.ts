// 输入区草稿记忆接线：按会话/项目分区保存未发送输入，切换时恢复并防止文字串到别的会话。
import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { ComposerAttachment } from "./composer-context";
import {
  readComposerDraft,
  readComposerDraftSync,
  writeComposerDraft,
  type ComposerDraftSnapshot,
} from "./composer-draft-memory";

/** 连续输入时合并落盘，避免每敲一个字都开一次 IndexedDB 事务。 */
const SAVE_DELAY_MS = 260;

/**
 * 把输入区接到草稿记忆：切换会话/项目先保存上一分区，再恢复目标分区；
 * 输入与附件变化延迟写回，卸载或页面隐藏时补一次，防止最后几秒内容丢失。
 */
export function useComposerDraftMemory({
  scope,
  activeSessionId,
  draft,
  setDraft,
  allAttachments,
  setAttachments,
}: {
  scope: string;
  activeSessionId: string | null;
  draft: string;
  setDraft: Dispatch<SetStateAction<string>>;
  allAttachments: ComposerAttachment[];
  setAttachments: Dispatch<SetStateAction<ComposerAttachment[]>>;
}): void {
  // 与输入区展示口径一致：别的会话生成的媒体引用不写进当前分区。
  const visibleAttachments = allAttachments.filter((item) => !item.mediaSource || item.mediaSource.sessionId === activeSessionId);
  const snapshotRef = useRef<ComposerDraftSnapshot>({ text: draft, attachments: visibleAttachments });
  snapshotRef.current = { text: draft, attachments: visibleAttachments };
  // 记录「上一个渲染仍属于哪个分区」的快照：切走时按它保存，避免用新会话的过滤口径丢掉旧附件。
  const lastSnapshotRef = useRef<{ scope: string; snapshot: ComposerDraftSnapshot }>({
    scope,
    snapshot: snapshotRef.current,
  });
  if (lastSnapshotRef.current.scope === scope) {
    lastSnapshotRef.current.snapshot = snapshotRef.current;
  }
  const scopeRef = useRef(scope);
  const loadTokenRef = useRef(0);
  // 恢复完成前禁止延迟写回，避免把空内容或上一分区的文字覆盖到刚切到的分区。
  const readyScopeRef = useRef<string | null>(null);

  useEffect(() => {
    const previousScope = scopeRef.current;
    const previousSnapshot = lastSnapshotRef.current.scope === previousScope
      ? lastSnapshotRef.current.snapshot
      : snapshotRef.current;
    const scopeChanged = previousScope !== scope;
    readyScopeRef.current = null;
    if (scopeChanged) {
      scopeRef.current = scope;
      void writeComposerDraft(previousScope, previousSnapshot);
      // 让后续渲染重新累积当前分区的快照。
      lastSnapshotRef.current = { scope, snapshot: snapshotRef.current };
    }
    const token = ++loadTokenRef.current;
    const cached = readComposerDraftSync(scope);
    if (cached) {
      readyScopeRef.current = scope;
      setDraft(cached.text);
      setAttachments(cached.attachments);
      return;
    }
    if (scopeChanged) {
      setDraft("");
      setAttachments([]);
    }
    // 首次挂载或内存未命中时才读本地库；读到后若用户已开始输入，不覆盖用户内容。
    void readComposerDraft(scope).then((saved) => {
      if (token !== loadTokenRef.current) return;
      readyScopeRef.current = scope;
      if (snapshotRef.current.text.trim() || snapshotRef.current.attachments.length > 0) {
        void writeComposerDraft(scope, snapshotRef.current);
        return;
      }
      if (!saved) return;
      setDraft(saved.text);
      setAttachments(saved.attachments);
    });
  }, [scope, setAttachments, setDraft]);

  useEffect(() => {
    if (readyScopeRef.current !== scope) return;
    const snapshot: ComposerDraftSnapshot = { text: draft, attachments: visibleAttachments };
    const timer = window.setTimeout(() => {
      void writeComposerDraft(scope, snapshot);
    }, SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [activeSessionId, allAttachments, draft, scope]);

  useEffect(() => {
    const flush = () => {
      // 恢复尚未完成时不刷写：此时输入状态还可能是上一分区的内容。
      if (readyScopeRef.current !== scopeRef.current) return;
      void writeComposerDraft(scopeRef.current, snapshotRef.current);
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);
}