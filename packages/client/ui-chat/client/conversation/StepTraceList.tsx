// 显示 Agent 运行用时和现有的工具审批操作。
import { useEffect, useState } from "react";
import { IconChevronRight } from "@tabler/icons-react";
import { describeStep, getLiveStage } from "./activity-label";
import type { PendingApprovalBanner } from "../store/chat-types";
import { timelineMessages, type ChatLocaleMessages } from "../locales";
import styles from "./StepTraceList.module.css";
import approvalStyles from "./StepTraceList.approval.module.css";

export { describeStep, getLiveStage };

/** 以整秒显示实际经过的时间，兼容短于一秒和长时间运行。 */
export function formatDuration(ms: number, isZh: boolean, showAllUnits = false): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [
    showAllUnits || hours > 0 ? `${hours}${isZh ? " 时" : "h"}` : "",
    showAllUnits || hours > 0 || minutes > 0 ? `${minutes}${isZh ? " 分" : "m"}` : "",
    `${seconds}${isZh ? " 秒" : "s"}`,
  ];
  return parts.filter(Boolean).join(" ");
}

export function formatTokenUsage(
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number },
): string | undefined {
  if (!usage) return undefined;
  const total = usage.totalTokens
    ?? (usage.promptTokens !== undefined || usage.completionTokens !== undefined
      ? (usage.promptTokens ?? 0) + (usage.completionTokens ?? 0)
      : undefined);
  if (!total || total <= 0) return undefined;
  const text = total >= 1_000 ? `${(total / 1_000).toFixed(1)}k` : String(total);
  return `${text} tokens`;
}

export function StepTraceList({
  isZh,
  createdAt,
  now: externalNow,
  durationMs,
  tokenUsage,
  isStreaming,
  expanded,
  processId,
  onToggle,
}: {
  isZh: boolean;
  createdAt: number;
  /** 可选外部统一时钟，由 AssistantTimeline 共享以减少重复定时器。 */
  now?: number | undefined;
  durationMs: number | undefined;
  /** 本轮累计工具步数，用于总览条展示执行密度。 */
  toolCount?: number | undefined;
  /** 整轮做了什么（命令 / 读取 / 编辑）的摘要，收起过程后仍能一眼看清。 */
  activitySummary?: string | undefined;
  tokenUsage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined;
  isStreaming: boolean;
  expanded: boolean;
  processId: string;
  onToggle?: (() => void) | undefined;
}) {
  const [internalNow, setInternalNow] = useState(Date.now);
  useEffect(() => {
    if (!isStreaming || externalNow !== undefined) return;
    const timer = setInterval(() => setInternalNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [externalNow, isStreaming]);
  const now = externalNow ?? internalNow;

  const labels = timelineMessages[isZh ? "zh" : "en"];
  if (isStreaming) {
    const elapsed = formatDuration(now - createdAt, isZh);
    const status = (
      <>
        <span className={styles.activityTitle}>{labels.elapsed}</span>
        <span className={styles.summaryElapsed}>{elapsed}</span>
      </>
    );
    return onToggle ? (
      <button type="button" className={`${styles.disclosure} ${styles.liveStatus}`} data-live="true"
        aria-label={`${labels.elapsed} ${elapsed}`} aria-expanded={expanded} aria-controls={processId} onClick={onToggle}>
        {status}
        <IconChevronRight size={14} className={styles.chevron} aria-hidden="true" />
      </button>
    ) : (
      <div className={styles.liveStatus} data-live="true">{status}</div>
    );
  }

  const usageLabel = formatTokenUsage(tokenUsage);
  const elapsedLabel = durationMs === undefined
    ? labels.process
    : `${labels.elapsed} ${formatDuration(durationMs, isZh)}`;
  return onToggle ? (
    <button type="button" className={`${styles.disclosure} ${styles.summaryBar}`} aria-expanded={expanded} aria-controls={processId} onClick={onToggle}>
      <span className={styles.summaryElapsed}>{elapsedLabel}</span>
      {usageLabel && <span className={styles.summaryTokens}>{usageLabel}</span>}
      <IconChevronRight size={14} className={styles.chevron} aria-hidden="true" />
    </button>
  ) : durationMs !== undefined || usageLabel ? (
    <div className={`${styles.liveStatus} ${styles.summaryBar}`}>
      <span className={styles.summaryElapsed}>{elapsedLabel}</span>
      {usageLabel && <span className={styles.summaryTokens}>{usageLabel}</span>}
    </div>
  ) : null;
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
      className={`${approvalStyles.approvalCard} ${pendingApproval.highRisk ? approvalStyles.approvalCardRisk : ""}`}
      role="alertdialog"
      aria-label={locale.approvalRequiredTitle}
    >
      <div className={approvalStyles.approvalHeader}>
        <span>{`${locale.approvalRequiredTitle}: ${pendingApproval.toolName}`}</span>
        <span>{pendingApproval.permissionLevel.toUpperCase()}</span>
      </div>
      {pendingApproval.highRisk ? (
        <p className={approvalStyles.approvalHintRisk}>
          {pendingApproval.riskReason || locale.highRiskApprovalHint}
        </p>
      ) : pendingApproval.permissionMode === "smart" && pendingApproval.approvalThreshold ? (
        <p className={approvalStyles.approvalHint}>
          {`${locale.smartProgressPrefix}${pendingApproval.approvalPattern ? `${pendingApproval.approvalPattern} ` : ""}${pendingApproval.approvalCount ?? 0}/${pendingApproval.approvalThreshold} ${locale.smartProgressSuffix}`}
        </p>
      ) : null}
      <pre className={approvalStyles.approvalArgs}>{pendingApproval.argsPreview}</pre>
      <div className={approvalStyles.approvalActions}>
        <button type="button" className={approvalStyles.approveBtn} onClick={() => onResolveApproval(true)}>
          {locale.approveAction}
        </button>
        <button type="button" className={approvalStyles.rejectBtn} onClick={() => onResolveApproval(false)}>
          {locale.rejectAction}
        </button>
      </div>
    </div>
  );
}
