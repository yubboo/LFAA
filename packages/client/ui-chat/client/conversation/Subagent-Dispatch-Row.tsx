// 主聊天区非浏览器子智能体派发行：紧凑展示 Started :: <Role>，点击直达右侧子智能体标签页，完成后可展开查看汇报回执。
import { memo } from "react";
import { IconAlertCircle, IconCheck, IconLoader2, IconRobot } from "@tabler/icons-react";
import type { AgentStepItem } from "../store/chat-types";
import styles from "./Subagent-Dispatch-Row.module.css";

export const SubagentDispatchRow = memo(function SubagentDispatchRow({
  step,
  isZh,
  live,
  onOpenSubagent,
}: {
  step: AgentStepItem;
  isZh: boolean;
  live: boolean;
  onOpenSubagent?: ((subagentId: string, role?: string) => void) | undefined;
}) {
  const sub = step.subagent;
  if (!sub) return null;
  const isRunning = live && (sub.status === "running" || step.status === "running");
  const isDone = sub.status === "done" || (!isRunning && step.status === "done");
  const isError = sub.status === "error" || step.status === "error";
  const resultText = step.resultPreview?.trim() || step.detail?.trim() || "";

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.row}
        onClick={() => onOpenSubagent?.(sub.id, sub.role)}
        title={isZh ? `在右侧打开「${sub.role}」工作标签` : `Open "${sub.role}" tab in right workbench`}
      >
        <span className={styles.prefix}>{isRunning ? (isZh ? "已派发" : "Started") : (isZh ? "已完成" : "Finished")}</span>
        {isRunning ? (
          <IconLoader2 size={13} className={styles.glyph} aria-hidden="true" />
        ) : isDone ? (
          <IconCheck size={13} className={styles.glyphDone} aria-hidden="true" />
        ) : isError ? (
          <IconAlertCircle size={13} className={styles.glyphError} aria-hidden="true" />
        ) : (
          <IconRobot size={13} className={styles.glyph} aria-hidden="true" />
        )}
        <span className={styles.role}>{sub.role}</span>
        {isRunning && sub.liveAction && (
          <span className={styles.liveAction}>· {sub.liveAction}</span>
        )}
        <span className={styles.openHint}>{isZh ? "查看标签 ↗" : "Open tab ↗"}</span>
      </button>

      {isDone && resultText && (
        <details className={styles.receipt}>
          <summary className={styles.receiptSummary}>
            {isZh ? `来自 ${sub.role} 的汇报` : `Report from ${sub.role}`}
          </summary>
          <div className={styles.receiptBody}>{resultText}</div>
        </details>
      )}
    </div>
  );
});
