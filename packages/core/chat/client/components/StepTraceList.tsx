// 显示 Agent 当前运行阶段、尾部实时执行行、完成用时和现有的工具审批操作。
import { useEffect, useState } from "react";
import { IconChevronRight } from "@tabler/icons-react";
import { getActivityLabel } from "../activity-label";
import type { AgentStepItem, PendingApprovalBanner } from "../chat-types";
import { timelineMessages, type ChatLocaleMessages } from "../locales";
import styles from "./StepTraceList.module.css";
import { LiveFish } from "./Live-Fish";
import { groupTrace } from "./trace-groups";
import { StepDetail } from "./Step-Detail";

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

/** 把步骤渲染成一句有信息量的话：思考给出具体计划/判断，动作给出目标或命令。 */
export function describeStep(step: AgentStepItem, isZh: boolean): string {
  if (step.phase === "think") {
    const raw = (step.detail || step.title || "").replace(/^第\s*\d+\s*轮\s*/u, "").trim();
    if (raw) return raw;
    return step.status === "running" ? (isZh ? "正在思考" : "Thinking") : (isZh ? "已思考" : "Thought");
  }
  const label = getActivityLabel(step, isZh, true);
  const command = step.commandTrace?.command?.trim();
  if (command && !label.includes(command)) {
    const short = command.length > 60 ? `${command.slice(0, 60)}…` : command;
    return `${label} · ${short}`;
  }
  const target = step.toolTarget?.trim();
  if (target && !label.includes(target)) return `${label} · ${target}`;
  return label;
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
          {/* 轮次与步数统一在底部状态条展示，这里只留阶段与更新时间，避免重复 */}
          {labels[getLiveStage(steps, now)]} · {labels.lastUpdate(formatDuration(now - (current.startedAt ?? current.timestamp), isZh))}
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

  // 明细直接并进这一行：当前动作 + 已接收参数 + 用时，随执行过程原地变化。
  const labels = timelineMessages[isZh ? "zh" : "en"];
  const stage = getLiveStage(steps, now);
  const current = getLiveStep(steps);
  const activity = current && stage !== "waiting" ? getActivityLabel(current, isZh, true) : "";
  const label = includeToolName && activity ? activity : labels[stage];
  const argsHint = current?.argumentChars !== undefined ? labels.receivedArgs(current.argumentChars) : "";
  const stageElapsed = formatDuration(now - (current?.startedAt ?? createdAt), isZh);
  const [openStepId, setOpenStepId] = useState<string | null>(null);

  return (
    // 收起时只有一行；点开列出本轮已执行的每一步（读文件、跑命令与失败状态）。
    <details className={styles.liveTail} data-status={stage === "waiting" ? undefined : "running"}>
      <summary className={styles.disclosure}>
        {stage !== "waiting" && <LiveFish />}
        <span className={styles.activityTitle} role="status">{label}</span>
        {argsHint && <span className={styles.elapsed}>{argsHint}</span>}
        <span className={styles.elapsed}>{stageElapsed}</span>
        {/* 箭头提示可展开，点开看 Agent 本轮具体在做什么 */}
        <IconChevronRight size={14} className={styles.chevron} aria-hidden="true" />
      </summary>
      {/* 展开区限制高度并可滚动，避免长任务把整页撑开 */}
      <div className={`${styles.liveFacts} ${styles.traceScroll}`}>
        {/* 工作留痕：按动作类型分组，组默认收起，点开看该类型的每一条动作 */}
        {groupTrace(steps, isZh).map((group) => (
          <details key={group.key} className={styles.traceGroup} open={group.key === "think" ? undefined : undefined}>
            <summary className={styles.activityRow} data-status={group.failed ? "error" : undefined}>
              <IconChevronRight size={12} className={styles.chevron} aria-hidden="true" />
              <span>{group.title}</span>
              <span className={styles.elapsed}>{group.steps.length}</span>
              {group.failed && <span className={styles.elapsed}>{isZh ? "含失败" : "has failure"}</span>}
            </summary>
            <div className={styles.traceGroupBody}>
              {group.steps.map((step, index) => (
                <div key={step.id}>
                  {index > 0 && group.steps[index - 1]?.iteration !== step.iteration && (
                    <div className={styles.elapsed}>{isZh ? `第 ${step.iteration} 轮` : `Round ${step.iteration}`}</div>
                  )}
                  <button
                    type="button"
                    className={`${styles.activityRow} ${styles.stepRowButton}`}
                    data-status={step.status}
                    aria-expanded={openStepId === step.id}
                    onClick={() => setOpenStepId((current) => (current === step.id ? null : step.id))}
                  >
                    <span>{describeStep(step, isZh)}</span>
                    {step.status === "error" && <span className={styles.elapsed}>{isZh ? "异常" : "error"}</span>}
                    {step.commandTrace?.exitCode !== undefined && (
                      <span className={styles.elapsed}>{labels.exitCode} {step.commandTrace.exitCode}</span>
                    )}
                    {step.status === "done" && <span className={styles.elapsed}>✓</span>}
                  </button>
                  {openStepId === step.id && <StepDetail step={step} isZh={isZh} />}
                </div>
              ))}
            </div>
          </details>
        ))}
        {steps.length === 0 && (
          <div className={styles.activityRow}>{isZh ? "正在思考，暂无可展开的执行步骤" : "Thinking — no executable steps yet"}</div>
        )}
      </div>
    </details>
  );
}

/** 把 token 总量格式化为紧凑标签：1200 → 1.2k tokens。 */
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
  steps,
  createdAt,
  durationMs,
  tokenUsage,
  isStreaming,
  expanded,
  processId,
  onToggle,
}: {
  isZh: boolean;
  steps: AgentStepItem[];
  createdAt: number;
  durationMs: number | undefined;
  tokenUsage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined;
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
        {state !== "waiting" && <LiveFish />}
        <span className={styles.activityTitle}>{labels.thinkingElapsed}</span>
        <span className={styles.srOnly} role="status">{phase}</span>
        <span className={styles.elapsed}>{elapsed}</span>
      </>
    );
    return onToggle ? (
      <button type="button" className={`${styles.disclosure} ${styles.liveStatus}`} data-status={state === "waiting" ? undefined : "running"}
        aria-label={`${labels.thinkingElapsed} ${elapsed}`} aria-expanded={expanded} aria-controls={processId} onClick={onToggle}>
        {status}
        <IconChevronRight size={14} className={styles.chevron} aria-hidden="true" />
      </button>
    ) : (
      <div className={styles.liveStatus}>{status}</div>
    );
  }

  const usageLabel = formatTokenUsage(tokenUsage);
  const label = durationMs === undefined ? labels.process : `${labels.elapsed} ${formatDuration(durationMs, isZh)}`;
  return onToggle ? (
    <button type="button" className={styles.disclosure} aria-expanded={expanded} aria-controls={processId} onClick={onToggle}>
      <span>{label}</span>
      {usageLabel && <span className={styles.elapsed}>{usageLabel}</span>}
      <IconChevronRight size={14} className={styles.chevron} aria-hidden="true" />
    </button>
  ) : durationMs !== undefined || usageLabel ? (
    <span className={styles.elapsed}>
      {durationMs !== undefined ? label : ""}
      {durationMs !== undefined && usageLabel ? " · " : ""}
      {usageLabel ?? ""}
    </span>
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
