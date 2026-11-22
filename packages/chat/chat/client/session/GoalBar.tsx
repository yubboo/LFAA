// 输入框上方的目标条：只读展示 Agent 维护的当前目标，允许用户编辑目标文字，完成状态不由界面改。
import { useEffect, useState } from "react";
import { IconCheck, IconPencil, IconPlayerPause, IconPlayerPlay, IconTargetArrow, IconX } from "@tabler/icons-react";
import type { ChatGoalItem } from "../store/chat-types";
import styles from "./GoalBar.module.css";

/** 目标条：进行中/受阻目标常驻一行；complete 由父组件过滤，这里再兜底返回 null。 */
export function GoalBar({ goal, isZh, onEdit, onToggleAutoContinue }: {
  goal: ChatGoalItem;
  isZh: boolean;
  /** 保存目标文字；返回 false 时保留编辑态，错误由 store 写到全局提示。 */
  onEdit: (objective: string) => Promise<boolean>;
  /** 暂停/恢复自动续跑；返回 false 时按钮保持原状，错误由 store 提示。 */
  onToggleAutoContinue: (next: boolean) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(goal.objective);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  useEffect(() => {
    setEditing(false);
    setDraft(goal.objective);
  }, [goal.id, goal.objective]);

  if (goal.status === "complete") return null;
  const label = goal.status === "blocked"
    ? (isZh ? "已受阻的目标" : "Blocked goal")
    : (isZh ? "进行中的目标" : "Active goal");
  const progress = goal.progress.total > 0 ? `${goal.progress.done}/${goal.progress.total}` : "";
  const showAuto = goal.status === "active";
  const autoLabel = goal.autoContinue
    ? (isZh ? `自动继续 ${goal.rounds}/${goal.maxRounds}` : `Auto ${goal.rounds}/${goal.maxRounds}`)
    : (isZh ? "自动继续已暂停" : "Auto paused");

  const toggleAuto = async () => {
    if (toggling) return;
    setToggling(true);
    await onToggleAutoContinue(!goal.autoContinue);
    setToggling(false);
  };

  const save = async () => {
    const trimmed = draft.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    const ok = await onEdit(trimmed);
    setSaving(false);
    if (ok) setEditing(false);
  };

  return (
    <section className={styles.root} data-testid="goal-bar" data-status={goal.status} aria-label={label} title={goal.objective}>
      <IconTargetArrow size={15} className={styles.lead} aria-hidden="true" />
      <span className={styles.label}>{label}</span>
      {editing ? (
        <div className={styles.editRow}>
          <input
            className={styles.input}
            value={draft}
            maxLength={2000}
            autoFocus
            aria-label={isZh ? "编辑目标文字" : "Edit goal"}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void save();
              if (event.key === "Escape") setEditing(false);
            }}
          />
          <button type="button" className={styles.iconBtn} aria-label={isZh ? "保存目标" : "Save goal"} disabled={saving || !draft.trim()} onClick={() => void save()}>
            <IconCheck size={14} aria-hidden="true" />
          </button>
          <button type="button" className={styles.iconBtn} aria-label={isZh ? "取消编辑" : "Cancel"} disabled={saving} onClick={() => setEditing(false)}>
            <IconX size={14} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <>
          <span className={styles.objective}>{goal.objective}</span>
          {progress && <span className={styles.progress}>{progress}</span>}
          {showAuto && <span className={styles.progress} data-testid="goal-auto">{autoLabel}</span>}
          {showAuto && (
            <button
              type="button"
              className={styles.iconBtn}
              data-testid="goal-auto-toggle"
              aria-label={goal.autoContinue ? (isZh ? "暂停自动继续" : "Pause auto-continue") : (isZh ? "恢复自动继续" : "Resume auto-continue")}
              title={goal.autoContinue ? (isZh ? "暂停自动继续" : "Pause auto-continue") : (isZh ? "恢复自动继续" : "Resume auto-continue")}
              disabled={toggling}
              onClick={() => void toggleAuto()}
            >
              {goal.autoContinue
                ? <IconPlayerPause size={14} aria-hidden="true" />
                : <IconPlayerPlay size={14} aria-hidden="true" />}
            </button>
          )}
          <button type="button" className={styles.iconBtn} aria-label={isZh ? "编辑目标文字" : "Edit goal"} onClick={() => setEditing(true)}>
            <IconPencil size={14} aria-hidden="true" />
          </button>
        </>
      )}
    </section>
  );
}