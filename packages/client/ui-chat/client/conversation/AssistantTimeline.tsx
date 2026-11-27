// 以正文为自然阶段分界，按「思维链 → 本轮正文 → 工具总菜单」三段顺序渲染流式与完成后的助手回复。
import { memo, useEffect, useId, useMemo, useState } from "react";
import type { AgentStepItem, PendingApprovalBanner } from "../store/chat-types";
import { timelineMessages, type ChatLocaleMessages } from "../locales";
import { MarkdownContent } from "./MarkdownContent";
import { resolveThinkingHeader, summarizeToolGroupMenu } from "./round-title";
import { formatDuration, getLiveStage, StepTraceList, TimelineApproval } from "./StepTraceList";
import { ThinkingBlock } from "./Thinking-Block";
import {
  buildTimelineRounds,
  buildTimelineStages,
  latestThinkIsDone,
  resolveStageThinking,
} from "./timeline-stages";
import { ToolGroupFold } from "./Tool-Group-Fold";
import { ToolStepRow, type FileActivityActions } from "./Tool-Step-Row";
import styles from "./StepTraceList.module.css";

/** 过滤已有对应子智能体实时卡的冗余 invoke_subagent / message_subagent 包装行，并拆分普通工具与独立子智能体卡片。 */
function partitionStageTools(steps: readonly AgentStepItem[]): {
  regularTools: AgentStepItem[];
  subagentSteps: AgentStepItem[];
} {
  const childParentIds = new Set(
    steps
      .filter((s) => s.subagent && s.id.startsWith("child-"))
      .map((s) => s.id.slice("child-".length).replace(/-sub-[^-]+$/u, "")),
  );
  const regularTools: AgentStepItem[] = [];
  const subagentSteps: AgentStepItem[] = [];
  for (const step of steps) {
    if ((step.toolName === "invoke_subagent" || step.toolName === "message_subagent") && childParentIds.has(step.id)) {
      continue;
    }
    if (step.subagent) subagentSteps.push(step);
    else regularTools.push(step);
  }
  return { regularTools, subagentSteps };
}

/** 单阶段工具明细链：复用外层 ToolGroupFold 的左侧竖线，保留所有文件彩标、行号、耗时与跳转交互。 */
const RoundToolChain = memo(function RoundToolChain({
  steps,
  locale,
  live,
  now,
  fileActions,
}: {
  steps: AgentStepItem[];
  locale: ChatLocaleMessages;
  live: boolean;
  now?: number | undefined;
  fileActions: FileActivityActions;
}) {
  return (
    <div className={styles.toolChain}>
      <div className={styles.activityListNested}>
        {steps.map((step) => (
          <ToolStepRow key={step.id} step={step} locale={locale} live={live} now={now} {...fileActions} />
        ))}
      </div>
    </div>
  );
});

/** 助手时间线主组件：顶部突出用时与 Token，主体按「思维链 → 正文 → 工具总菜单」逐阶段流畅输出。 */
export const AssistantTimeline = memo(function AssistantTimeline({
  locale,
  content,
  reasoning,
  progressText,
  steps,
  createdAt,
  runDurationMs,
  reasoningDurationMs,
  tokenUsage,
  isStreaming,
  defaultCollapsed,
  pendingApproval,
  onResolveApproval,
  onOpenFile,
  onOpenTrace,
  onOpenBrowser,
  onOpenSubagent,
  selectedFileStepId,
  bodyClassName,
}: {
  locale: ChatLocaleMessages;
  content: string;
  /** 兼容历史会话或单轮纯推理消息的总思考文本。 */
  reasoning?: string | undefined;
  progressText?: string | undefined;
  steps: AgentStepItem[];
  createdAt: number;
  runDurationMs?: number | undefined;
  reasoningDurationMs?: number | undefined;
  tokenUsage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined;
  isStreaming: boolean;
  /** 初始是否隐藏过程行（用于右侧子智能体工作舞台）。 */
  defaultCollapsed?: boolean | undefined;
  pendingApproval: PendingApprovalBanner | null;
  onResolveApproval: (approved: boolean) => void;
  bodyClassName?: string | undefined;
  /** 保留可选签名兼容调用方。 */
  onSelectAdvice?: ((text: string) => void) | undefined;
} & FileActivityActions) {
  // 默认展示过程行（完成后各阶段已自动收起为简洁单行），点顶部用时行可一键隐藏全部过程只留纯正文。
  const [processOpen, setProcessOpen] = useState(!defaultCollapsed);
  const [now, setNow] = useState(Date.now);
  const processId = useId();

  useEffect(() => {
    if (defaultCollapsed) setProcessOpen(false);
    else if (isStreaming) setProcessOpen(true);
  }, [defaultCollapsed, isStreaming]);

  // 合并为单一定时器，只在当前消息处于流式运行时每秒刷新一次实时耗时。
  useEffect(() => {
    if (!isStreaming) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isStreaming]);

  const text = isStreaming ? content : (progressText ?? "");
  const rawRounds = useMemo(
    () => buildTimelineRounds(steps, text.length, isStreaming),
    [steps, text.length, isStreaming],
  );
  const stages = useMemo(
    () => buildTimelineStages(rawRounds, text),
    [rawRounds, text],
  );
  const hasAnyStepReasoning = useMemo(
    () => stages.some((stage) => stage.thinkSteps.some((step) => Boolean(step.detail?.trim()))),
    [stages],
  );
  const fallbackReasoning = !hasAnyStepReasoning && reasoning?.trim() ? reasoning.trim() : undefined;
  const hasProcess = stages.length > 0 || Boolean(fallbackReasoning) || (!isStreaming && Boolean(text.trim()));
  const lastEvent = steps.reduce((latest, step) => Math.max(latest, step.timestamp), 0);
  const durationMs = runDurationMs ?? reasoningDurationMs ?? (lastEvent >= createdAt ? lastEvent - createdAt : undefined);
  const hasStatus = isStreaming || durationMs !== undefined || hasProcess || tokenUsage !== undefined;
  const lastOffset = stages.at(-1)?.endOffset ?? 0;
  const finalText = isStreaming ? text.slice(lastOffset) : content;
  const hasDisclosure = isStreaming || hasProcess;
  const labels = timelineMessages[locale.isZh ? "zh" : "en"];
  const fileActions = useMemo<FileActivityActions>(
    () => ({ onOpenFile, onOpenTrace, onOpenBrowser, onOpenSubagent, selectedFileStepId }),
    [onOpenBrowser, onOpenFile, onOpenSubagent, onOpenTrace, selectedFileStepId],
  );

  // 每阶段严格按「思维链 → 本轮正文 → 工具总菜单」三段组织：思考与工具各自独立折叠，正文始终留在主视流。
  const stageViews = stages.map((stage, index) => {
    const isLastStage = index === stages.length - 1;
    const stageText = text.slice(stage.startOffset, stage.endOffset);
    const hasLiveTool = isStreaming
      && stage.tools.some((s) => s.status === "running" || s.status === "preparing" || s.status === "waiting_approval");
    const { latestThink, detail: thinkDetail, durationText: thinkDuration, durationMs: thinkDurationMs } = resolveStageThinking(
      stage.thinkSteps,
      isLastStage ? fallbackReasoning : undefined,
      Boolean(isStreaming && isLastStage && !hasLiveTool && !latestThinkIsDone(stage.thinkSteps)),
      now,
      createdAt,
      locale.isZh,
    );

    const latestThinkRunning = Boolean(latestThink && latestThink.status === "running");
    const waitingFirstEvent = !latestThink && stage.tools.length === 0;
    const thinkRunning = Boolean(
      isStreaming
      && isLastStage
      && !hasLiveTool
      && (latestThinkRunning || waitingFirstEvent),
    );
    const thinkStageKey = latestThink?.status === "error"
      ? "modelFailed"
      : thinkRunning
        ? (latestThink ? getLiveStage([latestThink], now) : "starting")
        : "thought";
    const thinkLabel = resolveThinkingHeader({
      thinkStep: latestThink,
      thinkDetail,
      thinkRunning,
      durationMs: thinkDurationMs,
      liveStageLabel: labels[thinkStageKey],
      isZh: locale.isZh,
    });
    const hasThinkingBlock = Boolean(thinkDetail) || thinkRunning || latestThink?.status === "error";

    const { regularTools, subagentSteps } = partitionStageTools(stage.tools);
    const hasLiveRegularTool = isStreaming
      && regularTools.some((s) => s.status === "running" || s.status === "preparing" || s.status === "waiting_approval");
    const toolGroupLive = Boolean(isStreaming && (hasLiveRegularTool || (isLastStage && regularTools.length > 0 && !thinkRunning)));
    const toolSummary = regularTools.length > 0
      ? summarizeToolGroupMenu(regularTools, locale.isZh, toolGroupLive)
      : undefined;

    return {
      key: stage.key,
      thinking: hasThinkingBlock ? (
        <ThinkingBlock
          label={thinkLabel}
          iconKind="brain"
          durationText={thinkDuration}
          reasoningText={thinkDetail}
          live={thinkRunning}
          isZh={locale.isZh}
          defaultOpen
        />
      ) : null,
      narration: stageText.trim() ? (
        <div className={`${bodyClassName ?? ""} ${styles.stageNarration}`.trim()}>
          <MarkdownContent content={stageText} isZh={locale.isZh} />
        </div>
      ) : null,
      tools: toolSummary ? (
        <ToolGroupFold
          label={toolSummary.label}
          iconKind={toolSummary.iconKind}
          failedCount={toolSummary.failedCount}
          live={toolGroupLive}
          isZh={locale.isZh}
          defaultOpen={toolGroupLive}
        >
          <RoundToolChain
            steps={regularTools}
            locale={locale}
            live={isStreaming}
            now={isStreaming ? now : undefined}
            fileActions={fileActions}
          />
        </ToolGroupFold>
      ) : null,
      // 子智能体卡片自带折叠栏与边框，直接平级展示在外部，避免再套一层 ToolGroupFold 产生多余竖线。
      subagents: subagentSteps.length > 0 ? (
        <div className={styles.toolChain}>
          {subagentSteps.map((step) => (
            <ToolStepRow key={step.id} step={step} locale={locale} live={isStreaming} now={isStreaming ? now : undefined} {...fileActions} />
          ))}
        </div>
      ) : null,
    };
  });

  const trailingProgressText = !isStreaming ? text.slice(lastOffset) : "";
  const hasVisibleStages = stageViews.length > 0 || Boolean(fallbackReasoning) || Boolean(trailingProgressText.trim());

  return (
    <>
      {hasStatus && (
        <StepTraceList
          isZh={locale.isZh}
          createdAt={createdAt}
          now={now}
          durationMs={durationMs}
          tokenUsage={tokenUsage}
          isStreaming={isStreaming}
          expanded={processOpen}
          processId={processId}
          onToggle={hasDisclosure ? () => setProcessOpen((prev) => !prev) : undefined}
        />
      )}
      {hasStatus && (content.trim() || hasProcess) && <hr className={styles.timelineDivider} />}
      {hasDisclosure && (
        <div id={processId} className={`${styles.flow} ${styles.process}`} hidden={!processOpen}>
          {stages.length === 0 && fallbackReasoning && (
            <div className={styles.roundActivity}>
              <ThinkingBlock
                label={resolveThinkingHeader({
                  thinkDetail: fallbackReasoning,
                  thinkRunning: isStreaming,
                  durationMs: reasoningDurationMs,
                  liveStageLabel: isStreaming ? labels.reasoning : labels.thought,
                  isZh: locale.isZh,
                })}
                durationText={reasoningDurationMs ? formatDuration(reasoningDurationMs, locale.isZh) : undefined}
                reasoningText={fallbackReasoning}
                live={isStreaming}
                isZh={locale.isZh}
                defaultOpen
              />
            </div>
          )}
          {stageViews.map((view) => (
            <div key={view.key} className={styles.roundBlock} data-activity-segment={view.key}>
              {view.thinking && <div className={styles.roundActivity}>{view.thinking}</div>}
              {view.narration}
              {view.tools && <div className={styles.roundActivity}>{view.tools}</div>}
              {view.subagents && <div className={styles.roundActivity}>{view.subagents}</div>}
            </div>
          ))}
          {trailingProgressText.trim() && (
            <div className={bodyClassName}>
              <MarkdownContent content={trailingProgressText} isZh={locale.isZh} />
            </div>
          )}
        </div>
      )}
      {pendingApproval && (
        <TimelineApproval locale={locale} pendingApproval={pendingApproval} onResolveApproval={onResolveApproval} />
      )}
      {finalText.trim() && (
        <div className={`${bodyClassName ?? ""}${processOpen && hasVisibleStages ? ` ${styles.finalBody}` : ""}`.trim()}>
          <MarkdownContent content={finalText} isZh={locale.isZh} />
        </div>
      )}
    </>
  );
});
