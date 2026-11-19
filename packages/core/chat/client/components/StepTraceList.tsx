// 显示 Agent 当前运行阶段、尾部实时执行行、完成用时和现有的工具审批操作。
import { useEffect, useState } from "react";
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

function getLiveStep(steps: AgentStepItem[]): AgentStepItem | undefined {
  const recent = [...steps].reverse();
  return recent.find((step) => step.status === "waiting_approval")
    ?? recent.find((step) => step.phase === "act" && step.status === "running")
    ?? recent.find((step) => step.status === "preparing")
    ?? recent.find((step) => step.phase === "think" && step.status === "running");
}

/** 使用 Host 步骤更新时间区分活跃阶段和等待阶段。 */
export function getLiveStage(steps: AgentStepItem[], now: number) {
  const current = getLiveStep(steps);
  if (current?.status === "waiting_approval") return "waiting";
  if (current?.status === "preparing") return now - current.timestamp >= 15_000 ? "waitingTool" : "preparing";
  if (current?.phase === "act") return current.permissionLevel === "read" ? "exploring" : "executing";
  if (!current) return "starting";
  if (now - current.timestamp >= 15_000) return "waitingModel";
  return current.modelStage ?? "thinking";
}

/** 将运行步骤与最近结果显示为可检查的时间线信息。 */
export function LiveStageDetails({ isZh, steps, now: clock }: { isZh: boolean; steps: AgentStepItem[]; now?: number }) {
  const [fallbackClock, setFallbackClock] = useState(Date.now);
  useEffect(() => {
    if (clock !== undefined) return;
    const timer = setInterval(() => setFallbackClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [clock]);
  const now = clock ?? fallbackClock;
  const labels = timelineMessages[isZh ? "zh" : "en"];
  const current = getLiveStep(steps);
  const latest = [...steps].reverse().find((step) => step.phase === "act" && (step.status === "done" || step.status === "error"));
  return (
    <div className={styles.liveFacts}>
      {current && (
        <div>
          {labels.round(current.iteration)} · {labels[getLiveStage(steps, now)]} · {labels.lastUpdate(formatDuration(now - current.timestamp, isZh))}
        </div>
      )}
      {current?.phase === "act" && <div>{current.toolTarget ?? getActivityLabel(current, isZh, true)}</div>}
      {current?.argumentChars !== undefined && <div>{labels.receivedArgs(current.argumentChars)}</div>}
      {latest && <div>{labels.latestAction} · {latest.commandTrace?.command ?? getActivityLabel(latest, isZh, true)}
        {latest.commandTrace?.exitCode !== undefined && ` · ${labels.exitCode} ${latest.commandTrace.exitCode}`}
      </div>}
      {!current && !latest && <div>{labels.starting}</div>}
    </div>
  );
}

/** 尾部状态可直接展开，起点来自 Host，旧记录使用不会随流更新的消息时间。 */
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
  const stage = getLiveStage(steps, now);
  const current = getLiveStep(steps);
  const label = includeToolName && current?.phase === "act" && stage !== "waitingTool"
    ? getActivityLabel(current, isZh, true)
    : labels[stage];
  const stageElapsed = formatDuration(now - (current?.startedAt ?? createdAt), isZh);

  return (
    <details className={styles.liveTail}>
      <summary className={styles.disclosure} data-status={stage === "waiting" ? undefined : "running"}>
        {stage !== "waiting" && <span className={styles.liveDot} aria-hidden="true" />}
        <span className={styles.activityTitle} role="status">{label}</span>
        <span className={styles.elapsed}>{stageElapsed}</span>
        <IconChevronRight size={14} className={styles.chevron} aria-hidden="true" />
      </summary>
      <LiveStageDetails isZh={isZh} steps={steps} now={now} />
    </details>
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
    const state = getLiveStage(steps, now);
    const phase = labels[state];
    const elapsed = formatDuration(now - createdAt, isZh);
    const status = (
      <>
        {state !== "waiting" && <span className={styles.liveDot} aria-hidden="true" />}
        <span className={styles.activityTitle} role="status">{phase}</span>
        <span className={styles.elapsed}>{elapsed}</span>
      </>
    );
    return onToggle ? (
      <button type="button" className={`${styles.disclosure} ${styles.liveStatus}`} data-status={state === "waiting" ? undefined : "running"}
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
