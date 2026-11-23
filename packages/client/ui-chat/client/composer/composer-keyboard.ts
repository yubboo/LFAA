// 输入框键盘导航：@ / 斜杠 / 技能三种候选的方向键、Tab/Enter 选中、Esc 关闭，以及回车发送与 Ctrl+Enter 清空排队。
// 从 ChatComposer 的 onKeyDown 里抽出成纯函数：只读候选与下标、只调用传进来的回调，便于单独推演与验收。
import type { Dispatch, KeyboardEvent, SetStateAction } from "react";
import type { MentionEntry, SlashCommandEntry } from "./composer-context";

/** 通用候选按键上下文：数量、当前高亮下标、关闭与选中回调。 */
interface TriggerKeys<TEntry> {
  entries: readonly TEntry[];
  index: number;
  setIndex: Dispatch<SetStateAction<number>>;
  close: () => void;
  /** Tab / Enter 选中（斜杠命令的 Tab 走 complete，Enter 走 pick）。 */
  pick: (entry: TEntry) => void;
}

/** 斜杠命令区分 Tab 补全与 Enter 执行。 */
interface SlashKeys extends TriggerKeys<SlashCommandEntry> {
  complete: (entry: SlashCommandEntry) => void;
}

/** 键盘处理所需的全部状态；为 null 表示该触发未激活。 */
export interface ComposerKeydownContext {
  mention: TriggerKeys<MentionEntry> | null;
  slash: SlashKeys | null;
  skill: TriggerKeys<MentionEntry> | null;
  /** 排队消息数；大于 0 时 Ctrl/Cmd+Enter 直接清空队列。 */
  queuedCount: number;
  flushQueue: () => void;
  sendShortcut: "enter" | "ctrl_enter";
  /** 发送当前草稿；invertFollowUp 对应 Ctrl/Cmd+Enter 的「插话」语义。 */
  submit: (invertFollowUp: boolean) => void;
}

/** 在候选列表内循环移动高亮下标。 */
function cycle(count: number, index: number, delta: number): number {
  if (count === 0) return 0;
  return (index + delta + count) % count;
}

/**
 * 处理输入框 keydown：候选导航优先，其次排队清空与回车发送。
 * 与拆分前逐分支等价；所有事件都只在命中语义时 preventDefault。
 */
export function handleComposerKeydown(
  event: KeyboardEvent<HTMLTextAreaElement>,
  { mention, slash, skill, queuedCount, flushQueue, sendShortcut, submit }: ComposerKeydownContext,
): void {
  const composing = event.nativeEvent.isComposing;
  const pickFrom = <TEntry>(state: TriggerKeys<TEntry>): TEntry | undefined =>
    state.entries[state.index] ?? state.entries[0];

  if (mention) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      mention.setIndex((idx) => cycle(mention.entries.length, idx, 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      mention.setIndex((idx) => cycle(mention.entries.length, idx, -1));
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      mention.close();
      return;
    }
    if ((event.key === "Tab" || (event.key === "Enter" && !event.shiftKey)) && !composing && mention.entries.length > 0) {
      event.preventDefault();
      const picked = pickFrom(mention);
      if (picked) mention.pick(picked);
      return;
    }
  }

  if (slash) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      slash.setIndex((idx) => cycle(slash.entries.length, idx, 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      slash.setIndex((idx) => cycle(slash.entries.length, idx, -1));
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      slash.close();
      return;
    }
    if (event.key === "Tab" && !composing && slash.entries.length > 0) {
      event.preventDefault();
      const picked = pickFrom(slash);
      if (picked) slash.complete(picked);
      return;
    }
    if (event.key === "Enter" && !event.shiftKey && !composing && slash.entries.length > 0) {
      event.preventDefault();
      const picked = pickFrom(slash);
      if (picked) slash.pick(picked);
      return;
    }
  }

  if (skill) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      skill.setIndex((idx) => cycle(skill.entries.length, idx, 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      skill.setIndex((idx) => cycle(skill.entries.length, idx, -1));
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      skill.close();
      return;
    }
    if ((event.key === "Tab" || (event.key === "Enter" && !event.shiftKey)) && !composing && skill.entries.length > 0) {
      event.preventDefault();
      const picked = pickFrom(skill);
      if (picked) skill.pick(picked);
      return;
    }
  }

  // 有排队消息时，Ctrl/Cmd+Enter 直接把全部排队消息作为插话发出。
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && queuedCount > 0 && !composing) {
    event.preventDefault();
    flushQueue();
    return;
  }

  if (event.key === "Enter" && !composing) {
    const needCtrl = sendShortcut === "ctrl_enter";
    if (needCtrl && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      submit(false);
    } else if (!needCtrl && !event.shiftKey) {
      event.preventDefault();
      submit(event.ctrlKey || event.metaKey);
    }
  }
}