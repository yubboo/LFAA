// 群聊输入区组件：支持 @ 成员补全浮层、成员点选标签、发送与中途停止本轮。
// 关联：packages/client/ui-agent-group/client/view/Group-View.tsx；运行环境：浏览器。
import { IconPlayerStop, IconSend, IconX } from "@tabler/icons-react";
import type { GroupMessageItem, GroupTurnStreamEvent, MemberOption } from "../group/group-api";
import composerStyles from "./Group-Composer.module.css";
import styles from "./Group-View.module.css";

/** 纯函数：将单条 SSE 群聊流式事件归并到消息列表。 */
export function applyGroupStreamEvent(prev: GroupMessageItem[], ev: GroupTurnStreamEvent): GroupMessageItem[] {
  if (ev.type === "speaker_started") {
    if (prev.some((m) => m.id === ev.assistantMessageId)) return prev;
    return [
      ...prev,
      {
        id: ev.assistantMessageId,
        role: "assistant",
        content: "",
        status: "streaming",
        authorAgentId: ev.agentId,
        turnId: ev.turnId,
        ...(ev.task ? { speakerTask: ev.task } : {}),
        steps: [],
        createdAt: Date.now(),
      },
    ];
  }
  if (ev.type === "delta" && ev.kind === "text") {
    const idx = [...prev].reverse().findIndex((m) => m.role === "assistant" && m.authorAgentId === ev.agentId && m.status === "streaming");
    if (idx < 0) return prev;
    const realIdx = prev.length - 1 - idx;
    const next = [...prev];
    const target = next[realIdx]!;
    next[realIdx] = { ...target, content: target.content + ev.text };
    return next;
  }
  if (ev.type === "step_update") {
    const idx = [...prev].reverse().findIndex((m) => m.role === "assistant" && m.authorAgentId === ev.agentId && m.status === "streaming");
    if (idx < 0) return prev;
    const realIdx = prev.length - 1 - idx;
    const next = [...prev];
    const target = next[realIdx]!;
    const steps = [...(target.steps ?? [])];
    const stepIdx = ev.step.id ? steps.findIndex((s) => s.id === ev.step.id) : -1;
    if (stepIdx >= 0) steps[stepIdx] = ev.step;
    else steps.push(ev.step);
    next[realIdx] = { ...target, steps };
    return next;
  }
  if (ev.type === "speaker_finished") {
    return prev.map((m) =>
      m.role === "assistant" && m.authorAgentId === ev.agentId && m.status === "streaming"
        ? { ...m, status: ev.status }
        : m,
    );
  }
  return prev;
}

export function GroupComposer({
  isZh,
  sendLabel,
  draft,
  mentions,
  mentionQuery,
  activeMembers,
  activeTurnId,
  busy,
  onDraftChange,
  onPickMention,
  onToggleMention,
  onSend,
  onStop,
}: {
  isZh: boolean;
  sendLabel: string;
  draft: string;
  mentions: string[];
  mentionQuery: string | null;
  activeMembers: MemberOption[];
  activeTurnId: string | null;
  busy: boolean;
  onDraftChange: (value: string) => void;
  onPickMention: (member: MemberOption) => void;
  onToggleMention: (id: string) => void;
  onSend: () => void;
  onStop: () => void;
}) {
  const popupCandidates = mentionQuery === null
    ? []
    : activeMembers.filter((m) => m.name.toLowerCase().includes(mentionQuery.toLowerCase()));

  return (
    <div className={composerStyles.composer}>
      {popupCandidates.length > 0 && (
        <div className={styles.chips} role="listbox" aria-label={isZh ? "选择 @ 成员" : "Mention member"}>
          {popupCandidates.map((m) => (
            <button key={m.id} type="button" className={styles.chip} onClick={() => onPickMention(m)}>
              @{m.name}
            </button>
          ))}
        </div>
      )}

      <div className={composerStyles.mentionBar}>
        {activeMembers.map((m) => {
          const chosen = mentions.includes(m.id);
          return (
            <button
              key={m.id}
              type="button"
              className={`${styles.chip} ${chosen ? styles.chipOn : ""}`}
              onClick={() => onToggleMention(m.id)}
            >
              <span>@{m.name}</span>
              {chosen && <IconX size={11} aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <div className={composerStyles.inputRow}>
        <textarea
          className={styles.textarea}
          rows={2}
          value={draft}
          placeholder={isZh ? "输入群消息，输入 @ 可指定发言成员…" : "Message the group, type @ to mention…"}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
        />
        {activeTurnId ? (
          <button type="button" className={composerStyles.send} onClick={onStop}>
            <IconPlayerStop size={14} aria-hidden="true" />
            <span>{isZh ? "停止" : "Stop"}</span>
          </button>
        ) : (
          <button type="button" className={composerStyles.send} disabled={!draft.trim() || busy} onClick={onSend}>
            <IconSend size={14} aria-hidden="true" />
            <span>{sendLabel}</span>
          </button>
        )}
      </div>
    </div>
  );
}
