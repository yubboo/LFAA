// 显示 Agent 当前运行阶段、尾部实时执行行、完成用时和现有的工具审批操作。
import { useEffect, useRef, useState } from "react";
import { IconChevronRight } from "@tabler/icons-react";
import { getActivityLabel } from "../activity-label";
import type { AgentStepItem, PendingApprovalBanner } from "../chat-types";
import { timelineMessages, type ChatLocaleMessages } from "../locales";
import styles from "./StepTraceList.module.css";

/** 以整秒显示实际经过的时间，兼容短于一秒和长时间运行。 */
export function formatDuration(ms: number, isZh: boolean): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [
    hours > 0 ? `${hours}${isZh ? " 时" : "h"}` : "",
    hours > 0 || minutes > 0 ? `${minutes}${isZh ? " 分" : "m"}` : "",
    `${seconds}${isZh ? " 秒" : "s"}`,
  ];
  return parts.filter(Boolean).join(" ");
}

/** 使用当前运行中的一步推导状态，上一轮的正文或推理不参与判断。 */
export function getLiveStage(steps: AgentStepItem[], now: number, startedAt: number) {
  if (steps.some((step) => step.status === "waiting_approval")) return "waiting";
  const current = [...steps].reverse().find((step) => step.status === "running");
  if (current?.phase === "act") return current.permissionLevel === "read" ? "exploring" : "executing";
  if (steps.some((step) => step.status === "preparing")) return "preparing";
  if (now - (current?.timestamp ?? startedAt) >= 15_000) return "waitingModel";
  return current?.modelStage ?? "thinking";
}

/** 在流式末尾持续展示当前轮次的思考、等待或工具执行状态，避免轮次切换出现静默空窗。 */
export function LiveExecutionTail({
  isZh,
  steps,
  createdAt,
  includeToolName = false,
}: {
  isZh: boolean;
  steps: AgentStepItem[];
  createdAt: number;
  includeToolName?: boolean;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const labels = timelineMessages[isZh ? "zh" : "en"];
  const stage = getLiveStage(steps, now, createdAt);
  const activeAct = [...steps].reverse().find(
    (step) => step.phase === "act" && (step.status === "running" || step.status === "preparing"),
  );
  const activeThink = [...steps].reverse().find(
    (step) => step.phase === "think" && step.status === "running",
  );
  const roundKey = activeAct?.id ?? activeThink?.id ?? "idle";
  const roundAnchor = activeAct?.timestamp ?? activeThink?.timestamp ?? createdAt;
  const stageRef = useRef<{ key: string; startedAt: number }>({
    key: roundKey,
    startedAt: Math.min(now, roundAnchor),
  });
  if (stageRef.current.key !== roundKey) {
    stageRef.current = { key: roundKey, startedAt: Math.min(now, roundAnchor) };
  }

  const label = includeToolName && activeAct
    ? getActivityLabel(activeAct, isZh, true)
    : labels[stage];
  const stageElapsed = formatDuration(now - stageRef.current.startedAt, isZh);

  return (
    <div className={styles.liveTail} data-status="running" role="status" aria-live="polite">
      <span className={styles.liveDot} aria-hidden="true" />
      <span className={styles.activityTitle}>{label}</span>
      <span className={styles.elapsed}>{stageElapsed}</span>
    </div>
  );
}

export function StepTraceList({
  isZh,
  steps,
  createdAt,
  durationMs,
  isStreaming,
  expanded,
  processId,
  onToggle,
}: {
  isZh: boolean;
  steps: AgentStepItem[];
  createdAt: number;
  durationMs: number | undefined;
  isStreaming: boolean;
  expanded: boolean;
  processId: string;
  onToggle?: (() => void) | undefined;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!isStreaming) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isStreaming]);

  const labels = timelineMessages[isZh ? "zh" : "en"];
  if (isStreaming) {
    const phase = labels[getLiveStage(steps, now, createdAt)];
    const elapsed = formatDuration(now - createdAt, isZh);
    const status = (
      <>
        <span className={styles.liveDot} aria-hidden="true" />
        <span role="status">{phase}</span>
        <span className={styles.elapsed}>{elapsed}</span>
      </>
    );
    return onToggle ? (
      <button type="button" className={`${styles.disclosure} ${styles.liveStatus}`}
        aria-label={`${phase} ${elapsed}`} aria-expanded={expanded} aria-controls={processId} onClick={onToggle}>
        {status}
        <IconChevronRight size={14} className={styles.chevron} aria-hidden="true" />
      </button>
    ) : (
      <div className={styles.liveStatus}>{status}</div>
    );
  }

  const label = durationMs === undefined ? labels.process : `${labels.elapsed} ${formatDuration(durationMs, isZh)}`;
  return onToggle ? (
    <button type="button" className={styles.disclosure} aria-expanded={expanded} aria-controls={processId} onClick={onToggle}>
      <span>{label}</span>
      <IconChevronRight size={14} className={styles.chevron} aria-hidden="true" />
    </button>
  ) : durationMs !== undefined ? <span className={styles.elapsed}>{label}</span> : null;
}

/** 审批提示独立于折叠状态，用户可以直接批准或拒绝当前请求。 */
export function TimelineApproval({
  locale,
  pendingApproval,
  onResolveApproval,
}: {
  locale: ChatLocaleMessages;
  pendingApproval: PendingApprovalBanner;
  onResolveApproval: (approved: boolean) => void;
}) {
  return (
    <div
      className={`${styles.approvalCard} ${pendingApproval.highRisk ? styles.approvalCardRisk : ""}`}
      role="alertdialog"
      aria-label={locale.approvalRequiredTitle}
    >
      <div className={styles.approvalHeader}>
        <span>{`${locale.approvalRequiredTitle}: ${pendingApproval.toolName}`}</span>
        <span>{pendingApproval.permissionLevel.toUpperCase()}</span>
      </div>
      {pendingApproval.highRisk ? (
        <p className={styles.approvalHintRisk}>
          {pendingApproval.riskReason || locale.highRiskApprovalHint}
        </p>
      ) : pendingApproval.permissionMode === "smart" && pendingApproval.approvalThreshold ? (
        <p className={styles.approvalHint}>
          {`${locale.smartProgressPrefix}${pendingApproval.approvalPattern ? `${pendingApproval.approvalPattern} ` : ""}${pendingApproval.approvalCount ?? 0}/${pendingApproval.approvalThreshold} ${locale.smartProgressSuffix}`}
        </p>
      ) : null}
      <pre className={styles.approvalArgs}>{pendingApproval.argsPreview}</pre>
      <div className={styles.approvalActions}>
        <button type="button" className={styles.approveBtn} onClick={() => onResolveApproval(true)}>
          {locale.approveAction}
        </button>
        <button type="button" className={styles.rejectBtn} onClick={() => onResolveApproval(false)}>
          {locale.rejectAction}
        </button>
      </div>
    </div>
  );
}
