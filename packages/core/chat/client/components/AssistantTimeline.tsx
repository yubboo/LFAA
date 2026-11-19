// 以正文偏移和真实操作记录渲染流式回复及完成后的过程回看。
import { useId, useState } from "react";
import {
  IconAlertCircle, IconArrowUpRight, IconCheck, IconChevronRight, IconClock,
  IconFileMinus, IconFilePlus, IconFileSearch, IconPencil, IconSparkles, IconTerminal2, IconTool,
} from "@tabler/icons-react";
import { getActivityKind, getActivityLabel } from "../activity-label";
import type { AgentStepItem, PendingApprovalBanner } from "../chat-types";
import { getActivityFilePath, getFileActivityKind } from "../file-activity";
import { timelineMessages, type ChatLocaleMessages } from "../locales";
import { MarkdownContent } from "./MarkdownContent";
import { LiveExecutionTail, StepTraceList, TimelineApproval } from "./StepTraceList";
import styles from "./StepTraceList.module.css";

interface ActivityGroup {
  lastIteration: number;
  offset: number;
  steps: AgentStepItem[];
}

const activityIcons = { command: IconTerminal2, file: IconPencil, read: IconFileSearch, skill: IconSparkles, tool: IconTool };

interface FileActivityActions {
  onOpenFile: (stepId: string) => void;
  selectedFileStepId?: string | undefined;
}

/** 正文之间的连续操作原位追加，包括模型未输出新正文的后续工具轮。 */
function groupActivities(steps: AgentStepItem[], textLength: number): ActivityGroup[] {
  const groups: ActivityGroup[] = [];
  for (const step of steps) {
    if (step.phase !== "act" && step.id !== "skills-loaded") continue;
    const last = groups.at(-1);
    // 同轮迟到的正文继续显示在准备中的工具之前。
    const offset = step.status === "preparing" ? textLength : Math.min(textLength, step.textOffset ?? 0);
    const sameBoundary = last?.offset === offset && step.textOffset !== undefined
      && last.steps[0]?.textOffset !== undefined && last.steps[0]?.id !== "skills-loaded";
    if (last && (last.lastIteration === step.iteration || sameBoundary)) {
      last.lastIteration = step.iteration;
      last.offset = Math.max(last.offset, offset);
      last.steps.push(step);
    } else {
      groups.push({ lastIteration: step.iteration, offset: Math.max(last?.offset ?? 0, offset), steps: [step] });
    }
  }
  return groups;
}

function ActivityRow({ step, locale, onOpenFile, selectedFileStepId }: {
  step: AgentStepItem;
  locale: ChatLocaleMessages;
} & FileActivityActions) {
  const labels = timelineMessages[locale.isZh ? "zh" : "en"];
  const path = getActivityFilePath(step);
  if (path && step.status === "done") {
    const kind = getFileActivityKind(step);
    const Icon = kind === "created" ? IconFilePlus : kind === "deleted" ? IconFileMinus : IconPencil;
    return (
      <button
        type="button"
        className={`${styles.activityRow} ${styles.fileActivity}`}
        data-kind={kind}
        aria-pressed={selectedFileStepId === step.id}
        title={path}
        onClick={() => onOpenFile(step.id)}
      >
        <Icon size={15} className={styles.icon} aria-hidden="true" />
        <span>{labels.fileKinds[kind]}</span>
        <span className={styles.fileName}>{path.split(/[\\/]/u).at(-1) || path}</span>
        <span className={styles.lineCounts}>
          {!!step.addedLines && <span data-change="add">+{step.addedLines}</span>}
          {!!step.removedLines && <span data-change="remove">−{step.removedLines}</span>}
        </span>
        <IconArrowUpRight size={13} className={styles.icon} aria-hidden="true" />
      </button>
    );
  }

  const command = step.commandTrace;
  const kind = getActivityKind(step);
  const isCommand = kind === "command";
  const hasDetails = Boolean(command || step.argsPreview || step.resultPreview || step.detail);
  const Icon = activityIcons[kind];
  const title = command?.command ?? getActivityLabel(step, locale.isZh, true);
  const StatusIcon = step.status === "done" ? IconCheck : step.status === "error" ? IconAlertCircle : IconClock;
  const statusLabel = step.status === "done" ? locale.statusDone : step.status === "error" ? locale.statusError
    : step.status === "preparing" ? labels.preparing
    : step.status === "waiting_approval" ? locale.statusWaitingApproval : locale.statusRunning;
  const row = (
    <>
      <Icon size={14} className={styles.icon} aria-hidden="true" />
      <span className={styles.activityTitle} title={title}>{title}</span>
      <span key={step.status} className={styles.activityStatus} data-status={step.status} title={statusLabel}>
        <StatusIcon size={13} aria-hidden="true" />
        <span className={command && step.status !== "done" ? undefined : styles.srOnly}>{statusLabel}</span>
      </span>
      {hasDetails && <IconChevronRight size={13} className={styles.chevron} aria-hidden="true" />}
    </>
  );
  if (!hasDetails) return <div className={styles.activityRow} data-kind={kind} data-status={step.status}>{row}</div>;

  return (
    <details className={styles.activityDisclosure}>
      <summary className={styles.activityRow} data-kind={kind} data-status={step.status}>{row}</summary>
      <div className={styles.activityDetail} data-kind={isCommand ? "command" : undefined} data-status={step.status}>
        {command ? (
          <>
            <div className={styles.terminalHeader}>{step.status === "running" ? labels.runningCommand : labels.command}</div>
            <pre>{`$ ${command.command}`}</pre>
            {command.output && <pre className={styles.output}>{command.output}</pre>}
            {command.exitCode !== undefined && <div>{labels.exitCode} {command.exitCode}</div>}
          </>
        ) : (
          <>
            {step.argsPreview && <pre>{step.argsPreview}</pre>}
            {step.resultPreview && <pre>{step.resultPreview}</pre>}
          </>
        )}
        {step.detail && <pre>{step.detail}</pre>}
      </div>
    </details>
  );
}

function ActivityGroupRow({ group, locale, ...fileActions }: {
  group: ActivityGroup; locale: ChatLocaleMessages;
} & FileActivityActions) {
  const labels = timelineMessages[locale.isZh ? "zh" : "en"];
  const failed = group.steps.filter((step) => step.status === "error").length;
  const active = group.steps.find((step) => step.status === "running" || step.status === "waiting_approval")
    ?? group.steps.find((step) => step.status === "preparing");
  const current = active ?? group.steps[0]!;
  const kind = getActivityKind(current);
  const Icon = activityIcons[kind];
  const single = Boolean(active) || group.steps.length === 1;
  const summary = single
    ? [getActivityLabel(current, locale.isZh, true), current.commandTrace?.command].filter(Boolean).join(" ")
    : [...new Set(group.steps.map((step) => getActivityLabel(step, locale.isZh)))].join(locale.isZh ? "、" : ", ");

  return (
    <details className={styles.activityDisclosure}>
      <summary className={styles.disclosure} data-kind={kind} data-status={active?.status}>
        {active && active.status !== "waiting_approval" && <span className={styles.liveDot} aria-hidden="true" />}
        <Icon size={14} className={styles.icon} aria-hidden="true" />
        <span className={styles.activityTitle} title={summary}>{summary}</span>
        {failed > 0 && <span className={styles.failed}>{labels.failures(failed)}</span>}
        <IconChevronRight size={14} className={styles.chevron} aria-hidden="true" />
      </summary>
      <div className={styles.activityList}>
        {group.steps.map((step) => <ActivityRow key={step.id} step={step} locale={locale} {...fileActions} />)}
      </div>
    </details>
  );
}

/** 运行中自然展开过程，结束后用顶部用时控制回看，最终正文始终显示。 */
export function AssistantTimeline({
  locale,
  content,
  progressText,
  steps,
  createdAt,
  runDurationMs,
  reasoningDurationMs,
  isStreaming,
  pendingApproval,
  onResolveApproval,
  onOpenFile,
  selectedFileStepId,
  bodyClassName,
}: {
  locale: ChatLocaleMessages;
  content: string;
  progressText?: string | undefined;
  steps: AgentStepItem[];
  createdAt: number;
  runDurationMs?: number | undefined;
  reasoningDurationMs?: number | undefined;
  isStreaming: boolean;
  pendingApproval: PendingApprovalBanner | null;
  onResolveApproval: (approved: boolean) => void;
  bodyClassName?: string | undefined;
} & FileActivityActions) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [liveOpen, setLiveOpen] = useState<boolean>();
  const processId = useId();
  const text = isStreaming ? content : (progressText ?? "");
  const groups = groupActivities(steps, text.length);
  const hasProcess = groups.length > 0 || (!isStreaming && Boolean(text.trim()));
  const lastEvent = steps.reduce((latest, step) => Math.max(latest, step.timestamp), 0);
  const durationMs = runDurationMs ?? reasoningDurationMs ?? (lastEvent >= createdAt ? lastEvent - createdAt : undefined);
  const hasStatus = isStreaming || durationMs !== undefined || hasProcess;
  const finalText = isStreaming ? text.slice(groups.at(-1)?.offset ?? 0) : content;
  const processOpen = isStreaming ? (liveOpen ?? hasProcess) : historyOpen;
  const hasDisclosure = isStreaming || hasProcess;
  const lastGroup = groups.at(-1);
  const hasActiveTailGroup = Boolean(
    processOpen && lastGroup?.steps.some(
      (step) => step.status === "preparing" || step.status === "running" || step.status === "waiting_approval",
    ),
  );
  // 只要还在流式执行且末尾没有活跃的工具分组，就持续显示实时运行状态行，防止轮次切换出现完成错觉。
  const showLiveTail = isStreaming
    && !pendingApproval
    && !(hasActiveTailGroup && !finalText.trim())
    && (groups.length > 0 || Boolean(finalText.trim()) || processOpen);

  return (
    <>
      {hasStatus && (
        <StepTraceList
          isZh={locale.isZh}
          steps={steps}
          createdAt={createdAt}
          durationMs={durationMs}
          isStreaming={isStreaming}
          expanded={processOpen}
          processId={processId}
          onToggle={hasDisclosure ? () => {
            if (isStreaming) setLiveOpen(!processOpen);
            else setHistoryOpen((open) => !open);
          } : undefined}
        />
      )}
      {hasStatus && (content.trim() || hasProcess) && <hr className={styles.timelineDivider} />}
      {hasDisclosure && (
        <div id={processId} hidden={!processOpen} className={`${styles.flow} ${styles.process}`}>
          {isStreaming && groups.length === 0 && (
            <span className={styles.elapsed}>{timelineMessages[locale.isZh ? "zh" : "en"].modelProgressDetail}</span>
          )}
          {groups.map((group, index) => {
            const precedingText = text.slice(groups[index - 1]?.offset ?? 0, group.offset);
            return (
              <div key={group.steps[0]?.id} className={styles.flow}>
                {precedingText.trim() && (
                  <div className={bodyClassName}><MarkdownContent content={precedingText} isZh={locale.isZh} /></div>
                )}
                <ActivityGroupRow group={group} locale={locale} onOpenFile={onOpenFile} selectedFileStepId={selectedFileStepId} />
              </div>
            );
          })}
          {!isStreaming && text.slice(groups.at(-1)?.offset ?? 0).trim() && (
            <div className={bodyClassName}>
              <MarkdownContent content={text.slice(groups.at(-1)?.offset ?? 0)} isZh={locale.isZh} />
            </div>
          )}
        </div>
      )}
      {pendingApproval && <TimelineApproval locale={locale} pendingApproval={pendingApproval} onResolveApproval={onResolveApproval} />}
      {finalText.trim() && <div className={bodyClassName}><MarkdownContent content={finalText} isZh={locale.isZh} /></div>}
      {showLiveTail && (
        <LiveExecutionTail
          isZh={locale.isZh}
          steps={steps}
          createdAt={createdAt}
          includeToolName={!processOpen || Boolean(finalText.trim())}
        />
      )}
    </>
  );
}
