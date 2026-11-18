// 渲染单条助手回复上的流式状态（正在思考/深度思考/正在探索/正在回复）、思考时长、探索次数与 Think -> Act -> Check 循环轨迹。
import { useEffect, useRef, useState } from "react";
import { IconBrain, IconChevronDown, IconChevronRight, IconGitFork } from "@tabler/icons-react";
import type { AgentStepItem, PendingApprovalBanner } from "../chat-store";
import type { ChatLocaleMessages } from "../locales";
import styles from "./StepTraceList.module.css";

/** 将毫秒耗时格式化为“多少时多少分多少秒”（英文为 Xh Ym Zs） */
function formatThinkingDuration(ms: number, isZh: boolean, minOneSecond = true): string {
  const rawSeconds = Math.round(ms / 1000);
  const totalSeconds = minOneSecond ? Math.max(1, rawSeconds) : Math.max(0, rawSeconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (isZh) {
    if (hours > 0) return `${hours} 时 ${minutes} 分 ${seconds} 秒`;
    if (minutes > 0) return `${minutes} 分 ${seconds} 秒`;
    return `${seconds} 秒`;
  }
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

const READ_EXPLORE_TOOLS = new Set([
  "read_file",
  "list_dir",
  "list_directory",
  "search_files",
  "grep_search",
  "find_files",
  "get_file_info",
]);

function deriveStreamingStatus(
  isZh: boolean,
  steps: AgentStepItem[],
  reasoning: string | undefined,
  hasContent: boolean,
  pendingApproval: PendingApprovalBanner | null,
): { label: string; kind: "think" | "explore" | "act" | "reply" | "approval" } {
  if (pendingApproval || steps.some((s) => s.status === "waiting_approval")) {
    return { label: isZh ? "等待确认操作" : "Waiting for approval", kind: "approval" };
  }
  const runningStep = [...steps].reverse().find((s) => s.status === "running");
  if (runningStep) {
    if (runningStep.phase === "act") {
      const isExplore =
        runningStep.permissionLevel === "read"
        || (runningStep.toolName ? READ_EXPLORE_TOOLS.has(runningStep.toolName) : false);
      if (isExplore) {
        return { label: isZh ? "正在探索" : "Exploring", kind: "explore" };
      }
      return { label: runningStep.title || (isZh ? "正在执行" : "Running tool"), kind: "act" };
    }
    if (runningStep.phase === "check") {
      return { label: isZh ? "正在校验结果" : "Checking", kind: "act" };
    }
    return { label: reasoning ? (isZh ? "深度思考" : "Deep thinking") : (isZh ? "正在思考" : "Thinking"), kind: "think" };
  }
  if (reasoning && !hasContent) {
    return { label: isZh ? "深度思考" : "Deep thinking", kind: "think" };
  }
  if (hasContent) {
    return { label: isZh ? "正在回复" : "Replying", kind: "reply" };
  }
  return { label: isZh ? "正在思考" : "Thinking", kind: "think" };
}

/** 根据运行阶段更新思考与工具轨迹，完成后保留可展开的历史步骤。 */
export function StepTraceList({
  locale,
  steps,
  reasoning,
  createdAt,
  reasoningDurationMs,
  isStreaming = false,
  hasContent = false,
  pendingApproval,
  onResolveApproval,
}: {
  locale: ChatLocaleMessages;
  steps: AgentStepItem[];
  reasoning?: string | undefined;
  createdAt?: number | undefined;
  reasoningDurationMs?: number | undefined;
  isStreaming?: boolean;
  hasContent?: boolean;
  pendingApproval: PendingApprovalBanner | null;
  onResolveApproval: (approved: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(Boolean(pendingApproval));
  const mountTimeRef = useRef<number>(createdAt ?? Date.now());
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!isStreaming) return;
    setNowMs(Date.now());
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isStreaming]);

  const exploreCount = steps.filter(
    (s) => s.phase === "act" && (s.permissionLevel === "read" || (s.toolName ? READ_EXPLORE_TOOLS.has(s.toolName) : false)),
  ).length;
  const hasReasoning = Boolean(reasoning?.trim());
  const startMs = createdAt ?? mountTimeRef.current;
  const elapsedMs = Math.max(0, nowMs - startMs);
  const lastStepTimestamp = steps.length > 0 ? steps[steps.length - 1]!.timestamp : undefined;
  const completedDurationMs =
    reasoningDurationMs !== undefined
      ? reasoningDurationMs
      : lastStepTimestamp && createdAt
        ? Math.max(1000, lastStepTimestamp - createdAt)
        : 1000;

  if (!isStreaming && steps.length === 0 && !reasoning && !pendingApproval) {
    return null;
  }

  const liveStatus = isStreaming
    ? deriveStreamingStatus(locale.isZh, steps, reasoning, hasContent, pendingApproval)
    : null;

  const phaseLabel = (phase: AgentStepItem["phase"]) =>
    phase === "think" ? locale.phaseThink : phase === "act" ? locale.phaseAct : locale.phaseCheck;

  const phaseClass = (phase: AgentStepItem["phase"]) =>
    phase === "think" ? styles.phaseThink : phase === "act" ? styles.phaseAct : styles.phaseCheck;

  const statusLabel = (status: AgentStepItem["status"]) =>
    status === "running"
      ? locale.statusRunning
      : status === "waiting_approval"
        ? locale.statusWaitingApproval
        : status === "error"
          ? locale.statusError
          : locale.statusDone;

  return (
    <div className={styles.traceWrap}>
      {liveStatus && (
        <button
          type="button"
          className={styles.liveStatusPill}
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          <span className={`${styles.livePulseDot} ${styles[`liveDot_${liveStatus.kind}`]}`} aria-hidden="true" />
          <span className={styles.liveStatusText}>{liveStatus.label}</span>
          {(hasReasoning || liveStatus.kind === "think") && (
            <span className={styles.liveCountBadge}>
              {locale.isZh
                ? `已思考 ${formatThinkingDuration(elapsedMs, true, false)}`
                : formatThinkingDuration(elapsedMs, false, false)}
            </span>
          )}
          <IconChevronRight size={13} className={expanded ? styles.chevronOpen : undefined} />
        </button>
      )}

      {(steps.length > 0 || reasoning) && !liveStatus && (
        <div className={styles.summaryRow}>
          {hasReasoning && (
            <button
              type="button"
              className={styles.thoughtSummaryBtn}
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
            >
              <IconBrain size={14} stroke={1.8} />
              <span>
                {locale.isZh
                  ? `思考了 ${formatThinkingDuration(completedDurationMs, true)}`
                  : `Thought for ${formatThinkingDuration(completedDurationMs, false)}`}
              </span>
            </button>
          )}
          {exploreCount > 0 && (
            <span className={styles.exploreBadge}>
              <IconGitFork size={13} stroke={1.8} />
              <span>{locale.isZh ? `${exploreCount} 次探索` : `${exploreCount} explorations`}</span>
            </span>
          )}
          <button
            type="button"
            className={styles.traceToggle}
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
            <span>{`${locale.stepTimelineTitle} (${steps.length})`}</span>
          </button>
        </div>
      )}

      {(expanded || pendingApproval) && (
        <div className={styles.traceList}>
          {reasoning && (
            <pre className={styles.stepMeta}>{reasoning}</pre>
          )}
          {steps.map((step) => (
            <div key={step.id} className={styles.stepRow}>
              <span className={`${styles.phaseBadge} ${phaseClass(step.phase)}`}>
                {phaseLabel(step.phase)}
              </span>
              <div className={styles.stepMain}>
                <span className={styles.stepTitle}>{step.title}</span>
                {step.argsPreview && <pre className={styles.stepMeta}>{step.argsPreview}</pre>}
                {(step.resultPreview || step.detail) && (
                  <pre className={styles.stepMeta}>{step.resultPreview || step.detail}</pre>
                )}
              </div>
              <span className={`${styles.statusBadge} ${step.status === "error" ? styles.statusError : ""}`}>
                {statusLabel(step.status)}
              </span>
            </div>
          ))}
        </div>
      )}

      {pendingApproval && (
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
      )}
    </div>
  );
}
