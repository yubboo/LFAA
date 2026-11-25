// 主聊天区子智能体突出派发提示卡：以机器人图标 +「<Role> 开始工作 / 正在工作中」状态条呈现，点击即自动展开右侧对应子智能体工作过程标签。
import { memo, useState } from "react";
import {
  IconAlertCircle,
  IconCheck,
  IconChevronRight,
  IconLoader2,
  IconMessageCircle,
  IconRobot,
} from "@tabler/icons-react";
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
  const [expanded, setExpanded] = useState(true);
  if (!sub) return null;

  const isRunning = live && (sub.status === "running" || step.status === "running");
  const isDone = sub.status === "done" || (!isRunning && step.status === "done");
  const isError = sub.status === "error" || step.status === "error";
  const resultText = step.resultPreview?.trim() || step.detail?.trim() || "";
  const recentSteps = (sub.steps ?? []).slice(-4);

  const headerTitle = isRunning
    ? (isZh ? `${sub.role} 正在工作中` : `${sub.role} is working`)
    : isDone
      ? (isZh ? `${sub.role} 已完成工作` : `${sub.role} finished`)
      : isError
        ? (isZh ? `${sub.role} 执行异常` : `${sub.role} encountered an error`)
        : (isZh ? `${sub.role} 已停止` : `${sub.role} stopped`);

  return (
    <div className={styles.wrapper}>
      <div className={styles.headerLine}>
        <button
          type="button"
          className={styles.toggleBtn}
          aria-expanded={expanded}
          onClick={() => setExpanded((prev) => !prev)}
        >
          <span
            className={`${styles.emblem} ${isDone ? styles.emblemDone : isError ? styles.emblemError : ""}`}
            aria-hidden="true"
          >
            <IconRobot size={16} stroke={1.8} />
          </span>
          <span className={styles.titleText}>{headerTitle}</span>
          <IconChevronRight size={13} className={styles.chevron} data-open={expanded ? "true" : undefined} aria-hidden="true" />
        </button>

        <button
          type="button"
          className={`${styles.openTabBtn} ${isRunning ? styles.openTabBtnLive : ""}`}
          onClick={() => onOpenSubagent?.(sub.id, sub.role)}
          title={isZh ? `展开右侧「${sub.role}」工作过程标签` : `Open "${sub.role}" live tab in right workbench`}
        >
          {isRunning ? (
            <IconLoader2 size={12} aria-hidden="true" />
          ) : isDone ? (
            <IconCheck size={12} aria-hidden="true" />
          ) : isError ? (
            <IconAlertCircle size={12} aria-hidden="true" />
          ) : null}
          <span>{isRunning ? (isZh ? "工作中 · 查看右侧过程 ↗" : "Working · View tab ↗") : (isZh ? "查看右侧过程 ↗" : "View tab ↗")}</span>
        </button>
      </div>

      {expanded && (
        <div className={styles.subThread}>
          <div className={styles.eventRow}>
            <IconRobot size={13} className={styles.emblem} aria-hidden="true" />
            <span className={styles.eventText}>
              {isZh ? `${sub.role} 开始工作` : `${sub.role} started working`}
            </span>
          </div>

          <div className={styles.eventRow}>
            <IconMessageCircle size={13} aria-hidden="true" />
            <span className={styles.eventText}>
              {isZh ? `已向 ${sub.role} 发送任务指令` : `Sent instructions to ${sub.role}`}
            </span>
          </div>

          {recentSteps.map((child) => (
            <div key={child.id} className={styles.eventRow}>
              <IconCheck size={13} aria-hidden="true" />
              <span className={styles.eventText}>
                {[child.label ?? child.name, child.target].filter(Boolean).join(" · ")}
              </span>
            </div>
          ))}

          {isRunning && (
            <div className={`${styles.eventRow} ${styles.eventRowActive}`}>
              <IconLoader2 size={13} aria-hidden="true" />
              <span className={styles.eventText}>
                {sub.liveAction
                  ? (isZh ? `等待 ${sub.role}：${sub.liveAction}` : `Waiting for ${sub.role}: ${sub.liveAction}`)
                  : (isZh ? `正在等待 ${sub.role} 完成并回传结果…` : `Waiting for ${sub.role} to finish…`)}
              </span>
            </div>
          )}

          {isDone && (
            <div className={styles.eventRow}>
              <IconCheck size={13} className={styles.emblemDone} aria-hidden="true" />
              <span className={styles.eventText}>
                {isZh ? `已收到 ${sub.role} 回传的结果` : `Received report from ${sub.role}`}
              </span>
            </div>
          )}

          {isDone && resultText && (
            <details className={styles.receipt}>
              <summary className={styles.receiptSummary}>
                {isZh ? `展开查看来自 ${sub.role} 的完整汇报` : `View report from ${sub.role}`}
              </summary>
              <div className={styles.receiptBody}>{resultText}</div>
            </details>
          )}
        </div>
      )}
    </div>
  );
});
