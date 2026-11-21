// 以正文偏移和真实操作记录渲染流式回复及完成后的过程回看。
import { useEffect, useId, useState } from "react";
import {
  IconAlertCircle, IconArrowUpRight, IconCheck, IconChevronRight, IconClock,
  IconFileMinus, IconFilePlus, IconFileSearch, IconPencil, IconRobot, IconSparkles, IconTerminal2, IconTool,
} from "@tabler/icons-react";
import { getActivityKind, getActivityLabel, getActivitySubject } from "../activity-label";
import type { AgentStepItem, PendingApprovalBanner } from "../chat-types";
import { getActivityFilePath, getFileActivityKind } from "../file-activity";
import { timelineMessages, type ChatLocaleMessages } from "../locales";
import { MarkdownContent } from "./MarkdownContent";
import { formatDuration, getLiveStage, StepTraceList, TimelineApproval } from "./StepTraceList";
import styles from "./StepTraceList.module.css";

interface ActivityGroup {
  key: string;
  model?: AgentStepItem;
  live?: boolean;
  offset: number;
  steps: AgentStepItem[];
}

const activityIcons = { command: IconTerminal2, file: IconPencil, read: IconFileSearch, skill: IconSparkles, subagent: IconRobot, tool: IconTool };

interface FileActivityActions {
  onOpenFile: (stepId: string) => void;
  onOpenTrace?: ((stepId: string) => void) | undefined;
  selectedFileStepId?: string | undefined;
}

/** 轮次是活动行的身份，思考、工具事件和后续的子任务更新共用它。 */
function groupActivities(steps: AgentStepItem[], textLength: number, isStreaming: boolean): ActivityGroup[] {
  const groups = new Map<string, ActivityGroup>();
  const currentModel = [...steps].reverse().find((step) => step.phase === "think");
  for (const step of steps) {
    const initialSkill = step.id === "skills-loaded";
    if (step.phase !== "act" && step !== currentModel && !initialSkill) continue;
    const key = initialSkill ? step.id : `round-${step.iteration}`;
    const group = groups.get(key) ?? { key, offset: 0, steps: [] };
    const offset = step.status === "preparing" ? textLength : Math.min(textLength, step.textOffset ?? 0);
    group.offset = Math.max(group.offset, offset);
    if (step.phase === "think") group.model = step;
    else group.steps.push(step);
    groups.set(key, group);
  }
  // 模型事件到来前即预留首轮行，使初始化及首个实际步骤复用同一个节点。
  if (isStreaming && !currentModel && ![...groups.keys()].some((key) => key.startsWith("round-"))) {
    groups.set("round-1", { key: "round-1", offset: 0, steps: [], live: true });
  }
  const result = [...groups.values()];
  let offset = 0;
  for (const group of result) {
    group.offset = offset = Math.max(offset, group.offset);
    if (group.model === currentModel && currentModel) group.live = isStreaming;
  }
  return result;
}

function ActivityRow({ step, locale, live, onOpenFile, onOpenTrace, selectedFileStepId }: {
  step: AgentStepItem;
  locale: ChatLocaleMessages;
  /** 当前回复是否仍在流式运行：只有运行中的行才允许播放渐变动效。 */
  live: boolean;
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
  const active = step.status === "preparing" || step.status === "running";
  // 只有仍在运行中的步骤才标记为活动行，结束后即使事件残留运行状态也不再渐变。
  const liveRow = live && active;
  const hasDetails = Boolean(onOpenTrace || active || command || step.argsPreview || step.resultPreview || step.detail || step.toolTarget || step.argumentChars !== undefined);
  const Icon = activityIcons[kind];
  const title = command?.command ?? getActivityLabel(step, locale.isZh, true);
  const StatusIcon = step.status === "done" ? IconCheck : step.status === "error" ? IconAlertCircle : IconClock;
  const statusLabel = step.status === "done" ? locale.statusDone : step.status === "error" ? locale.statusError
    : step.status === "preparing" ? labels.preparing
    : step.status === "waiting_approval" ? locale.statusWaitingApproval : locale.statusRunning;
  const showLeadingStatus = isCommand && step.status === "running";
  // 命令开始时提示紧跟类型图标，结束后在展开箭头前显示结果。
  const status = (
    <span key={step.status} className={styles.activityStatus} data-status={step.status} title={statusLabel}>
      {active ? <span className={styles.liveDot} aria-hidden="true" /> : <StatusIcon size={13} aria-hidden="true" />}
      <span className={showLeadingStatus || (command && step.status !== "done") ? undefined : styles.srOnly}>{statusLabel}</span>
    </span>
  );
  const row = (
    <>
      <Icon size={isCommand ? 15 : 14} className={styles.icon} aria-hidden="true" />
      {showLeadingStatus && status}
      <span className={styles.activityTitle} title={title}>{title}</span>
      {!showLeadingStatus && status}
      {(hasDetails || onOpenTrace) && <IconChevronRight size={13} className={styles.chevron} aria-hidden="true" />}
    </>
  );
  if (!hasDetails) return <div className={styles.activityRow} data-kind={kind} data-status={step.status} data-live={liveRow ? "true" : undefined}>{row}</div>;

  return (
    <details className={styles.activityDisclosure}>
      <summary className={styles.activityRow} data-kind={kind} data-status={step.status} data-live={liveRow ? "true" : undefined}>{row}</summary>
      <div className={styles.activityDetail} data-kind={isCommand ? "command" : undefined} data-status={step.status} data-live={liveRow ? "true" : undefined}>
        {command ? (
          <>
            <div className={styles.terminalHeader}>
              {step.status === "running" && <span className={styles.liveDot} aria-hidden="true" />}
              <span className={styles.activityTitle}>{step.status === "running" ? labels.runningCommand : labels.command}</span>
            </div>
            <pre>{`$ ${command.command}`}</pre>
            {command.output && <pre className={styles.output}>{command.output}</pre>}
            {(step.status === "done" || step.status === "error") && (
              <div className={styles.commandResult} data-status={step.status}>
                <StatusIcon size={13} aria-hidden="true" />
                {step.status === "done" ? labels.commandSucceeded : labels.commandFailed}
                {command.exitCode !== undefined && <span>{labels.exitCode} {command.exitCode}</span>}
              </div>
            )}
          </>
        ) : (
          <>
            {step.toolTarget && <div>{step.toolTarget}</div>}
            {step.argumentChars !== undefined && <div>{labels.receivedArgs(step.argumentChars)}</div>}
            {step.status === "preparing" && step.argumentChars === undefined && <div>{labels.awaitingArgs}</div>}
            {step.argsPreview && <pre>{step.argsPreview}</pre>}
            {step.resultPreview && <pre>{step.resultPreview}</pre>}
          </>
        )}
        {step.detail && <pre>{step.detail}</pre>}
        {onOpenTrace && kind !== "read" && kind !== "file" && (
          <button type="button" className={styles.traceLink} onClick={() => onOpenTrace(step.id)}>{locale.isZh ? "查看" : "View"}</button>
        )}
      </div>
    </details>
  );
}

function ActivityGroupRow({ group, locale, createdAt, live, ...fileActions }: {
  group: ActivityGroup; locale: ChatLocaleMessages; createdAt: number;
  /** 当前回复是否仍在流式运行：结束后即使步骤残留运行状态也不再渐变。 */
  live: boolean;
} & FileActivityActions) {
  const labels = timelineMessages[locale.isZh ? "zh" : "en"];
  const failed = group.steps.filter((step) => step.status === "error").length;
  const newest = [...group.steps].reverse();
  const active = newest.find((step) => step.status === "waiting_approval")
    ?? newest.find((step) => step.status === "preparing" || step.status === "running");
  const current = active ?? group.steps.at(-1);
  const kind = current ? getActivityKind(current) : "model";
  const Icon = kind === "model" ? IconSparkles : activityIcons[kind];
  const [now, setNow] = useState(Date.now);
  const modelActive = Boolean(group.live && !current);
  useEffect(() => {
    if (!modelActive) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [modelActive]);
  const modelState = group.model?.status === "error" ? "modelFailed"
    : group.model?.status === "done" || !group.live ? "thought"
    : group.model ? getLiveStage([group.model], now) : "starting";
  // 有失败项时用中性动作名，避免「已完成：网页抓取 1 项执行失败」这类自相矛盾的摘要。
  // 多步轮次在摘要前标注操作数，避免只看最后一步就把整轮的动作（例如同时跑了命令和清单）藏掉。
  const stepCount = group.steps.length > 1
    ? locale.isZh ? `${group.steps.length} 项操作` : `${group.steps.length} steps`
    : "";
  const summary = current
    ? [stepCount, failed > 0 ? getActivitySubject(current, locale.isZh) : getActivityLabel(current, locale.isZh, true), current.commandTrace?.command]
      .filter(Boolean)
      .join(" ")
    : labels[modelState];
  const groupLive = live && (Boolean(active) || modelActive);
  return (
    <details className={styles.activityDisclosure} data-activity-segment={group.key}>
      <summary className={styles.disclosure} data-kind={kind} data-status={active?.status ?? (modelActive ? "running" : undefined)} data-live={groupLive ? "true" : undefined}>
        {((active && active.status !== "waiting_approval") || modelActive) && <span className={styles.liveDot} aria-hidden="true" />}
        <Icon size={14} className={styles.icon} aria-hidden="true" />
        <span className={styles.activityTitle} title={summary} aria-live={group.live || active ? "polite" : undefined}>{summary}</span>
        {modelActive && <span className={styles.elapsed}>{formatDuration(now - (group.model?.startedAt ?? createdAt), locale.isZh)}</span>}
        {active?.status === "preparing" && active.argumentChars !== undefined && (
          <span className={styles.elapsed}>{labels.receivedArgs(active.argumentChars)}</span>
        )}
        {failed > 0 && <span className={styles.failed}>{labels.failures(failed)}</span>}
        {current && <IconChevronRight size={14} className={styles.chevron} aria-hidden="true" />}
      </summary>
      {current && (
        <div className={styles.activityList}>
          {group.steps.map((step) => <ActivityRow key={step.id} step={step} locale={locale} live={live} {...fileActions} />)}
        </div>
      )}
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
  tokenUsage,
  isStreaming,
  pendingApproval,
  onResolveApproval,
  onOpenFile,
  onOpenTrace,
  selectedFileStepId,
  bodyClassName,
  onSelectAdvice,
}: {
  locale: ChatLocaleMessages;
  content: string;
  progressText?: string | undefined;
  steps: AgentStepItem[];
  createdAt: number;
  runDurationMs?: number | undefined;
  reasoningDurationMs?: number | undefined;
  tokenUsage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined;
  isStreaming: boolean;
  pendingApproval: PendingApprovalBanner | null;
  onResolveApproval: (approved: boolean) => void;
  bodyClassName?: string | undefined;
  onSelectAdvice?: ((text: string) => void) | undefined;
} & FileActivityActions) {
  const [historyOpen, setHistoryOpen] = useState(true);
  const [liveOpen, setLiveOpen] = useState<boolean>();
  const processId = useId();
  const text = isStreaming ? content : (progressText ?? "");
  const groups = groupActivities(steps, text.length, isStreaming);
  const hasProcess = groups.length > 0 || (!isStreaming && Boolean(text.trim()));
  const lastEvent = steps.reduce((latest, step) => Math.max(latest, step.timestamp), 0);
  const durationMs = runDurationMs ?? reasoningDurationMs ?? (lastEvent >= createdAt ? lastEvent - createdAt : undefined);
  const hasStatus = isStreaming || durationMs !== undefined || hasProcess || tokenUsage !== undefined;
  const finalText = isStreaming ? text.slice(groups.at(-1)?.offset ?? 0) : content;
  const processOpen = isStreaming ? (liveOpen ?? hasProcess) : (liveOpen ?? historyOpen);
  const hasDisclosure = isStreaming || hasProcess;

  return (
    <>
      {hasStatus && (
        <StepTraceList
          isZh={locale.isZh}
          createdAt={createdAt}
          durationMs={durationMs}
          tokenUsage={tokenUsage}
          isStreaming={isStreaming}
          expanded={processOpen}
          processId={processId}
          onToggle={hasDisclosure ? () => {
            if (isStreaming) setLiveOpen(!processOpen);
            else { setLiveOpen(undefined); setHistoryOpen(!processOpen); }
          } : undefined}
        />
      )}
      {hasStatus && (content.trim() || hasProcess) && <hr className={styles.timelineDivider} />}
      {hasDisclosure && (
        <div id={processId} hidden={!processOpen} className={`${styles.flow} ${styles.process}`}>
          {groups.map((group, index) => {
            const precedingText = text.slice(groups[index - 1]?.offset ?? 0, group.offset);
            return (
              <div key={group.key} className={styles.flow}>
                {precedingText.trim() && (
                  <div className={bodyClassName}><MarkdownContent content={precedingText} isZh={locale.isZh} onSelectAdvice={onSelectAdvice} /></div>
                )}
                <ActivityGroupRow group={group} locale={locale} createdAt={createdAt} live={isStreaming} onOpenFile={onOpenFile} onOpenTrace={onOpenTrace} selectedFileStepId={selectedFileStepId} />
              </div>
            );
          })}
          {!isStreaming && text.slice(groups.at(-1)?.offset ?? 0).trim() && (
            <div className={bodyClassName}>
              <MarkdownContent content={text.slice(groups.at(-1)?.offset ?? 0)} isZh={locale.isZh} onSelectAdvice={onSelectAdvice} />
            </div>
          )}
        </div>
      )}
      {pendingApproval && <TimelineApproval locale={locale} pendingApproval={pendingApproval} onResolveApproval={onResolveApproval} />}
      {finalText.trim() && <div className={bodyClassName}><MarkdownContent content={finalText} isZh={locale.isZh} onSelectAdvice={onSelectAdvice} /></div>}
    </>
  );
}
