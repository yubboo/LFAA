// 渲染单条助手回复上的 Think -> Act -> Check 步进过程、推理折叠面板及高风险工具确认交互。
import { useState } from "react";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import type { AgentStepItem, PendingApprovalBanner } from "../chat-store";
import type { ChatLocaleMessages } from "../locales";
import styles from "./StepTraceList.module.css";

export function StepTraceList({
  locale,
  steps,
  reasoning,
  pendingApproval,
  onResolveApproval,
}: {
  locale: ChatLocaleMessages;
  steps: AgentStepItem[];
  reasoning?: string | undefined;
  pendingApproval: PendingApprovalBanner | null;
  onResolveApproval: (approved: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(Boolean(pendingApproval));

  if (steps.length === 0 && !reasoning && !pendingApproval) {
    return null;
  }

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
      {(steps.length > 0 || reasoning) && (
        <button
          type="button"
          className={styles.traceToggle}
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
          <span>{`${locale.stepTimelineTitle} (${steps.length})`}</span>
        </button>
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
        <div className={styles.approvalCard} role="alertdialog" aria-label={locale.approvalRequiredTitle}>
          <div className={styles.approvalHeader}>
            <span>{`${locale.approvalRequiredTitle}: ${pendingApproval.toolName}`}</span>
            <span>{pendingApproval.permissionLevel.toUpperCase()}</span>
          </div>
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
