// 以正文偏移、多轮思维链与工具链渲染流式回复及完成后的全程可展开回看。
import { memo, useEffect, useId, useMemo, useState } from "react";
import type { AgentStepItem, PendingApprovalBanner } from "../store/chat-types";
import { timelineMessages, type ChatLocaleMessages } from "../locales";
import { MarkdownContent } from "./MarkdownContent";
import { formatDuration, getLiveStage, StepTraceList, TimelineApproval } from "./StepTraceList";
import { ThinkingBlock } from "./Thinking-Block";
import { ToolStepRow, type FileActivityActions } from "./Tool-Step-Row";
import styles from "./StepTraceList.module.css";

interface TimelineRound {
  key: string;
  iteration: number;
  think?: AgentStepItem;
  tools: AgentStepItem[];
  offset: number;
  live: boolean;
}

/** 按轮次还原完整思维链与工具链，保留每一轮的思考步骤及工具调用，不再丢弃历史思考。 */
function buildTimelineRounds(steps: readonly AgentStepItem[], textLength: number, isStreaming: boolean): TimelineRound[] {
  const rounds = new Map<string, TimelineRound>();
  const latestThink = [...steps].reverse().find((step) => step.phase === "think");

  for (const step of steps) {
    const initialSkill = step.id === "skills-loaded";
    if (step.phase !== "think" && step.phase !== "act" && !initialSkill) continue;
    const key = initialSkill ? step.id : `round-${step.iteration}`;
    const round = rounds.get(key) ?? {
      key,
      iteration: step.iteration,
      tools: [],
      offset: 0,
      live: false,
    };
    const rawOffset = step.status === "preparing" ? textLength : Math.min(textLength, step.textOffset ?? 0);
    round.offset = Math.max(round.offset, rawOffset);
    if (step.phase === "think") round.think = step;
    else round.tools.push(step);
    rounds.set(key, round);
  }

  // 模型首个事件到来前先预留第 1 轮，让初始化与后续真实步骤原位衔接。
  if (isStreaming && !latestThink && ![...rounds.keys()].some((key) => key.startsWith("round-"))) {
    rounds.set("round-1", { key: "round-1", iteration: 1, tools: [], offset: 0, live: true });
  }

  const result = [...rounds.values()];
  let runningOffset = 0;
  for (const round of result) {
    round.offset = runningOffset = Math.max(runningOffset, round.offset);
    if (round.think && round.think === latestThink) {
      round.live = isStreaming;
    }
  }
  return result;
}

/** 单轮工具链：用左侧细竖线直接串联本轮工具调用；若已存在对应子智能体实时卡则隐藏冗余 invoke_subagent 包装行。 */
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
  const childParentIds = new Set(
    steps
      .filter((s) => s.subagent && s.id.startsWith("child-"))
      .map((s) => s.id.slice("child-".length).replace(/-sub-[^-]+$/u, "")),
  );
  const visibleSteps = steps.filter(
    (s) => !((s.toolName === "invoke_subagent" || s.toolName === "message_subagent") && childParentIds.has(s.id)),
  );
  return (
    <div className={styles.toolChain}>
      <div className={styles.activityList}>
        {visibleSteps.map((step) => (
          <ToolStepRow key={step.id} step={step} locale={locale} live={live} now={now} {...fileActions} />
        ))}
      </div>
    </div>
  );
});

/** 运行中与完成后均默认全程展开思维链与工具链，顶部汇总条与各子块均可随时收起/展开。 */
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
  pendingApproval,
  onResolveApproval,
  onOpenFile,
  onOpenTrace,
  onOpenBrowser,
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
  pendingApproval: PendingApprovalBanner | null;
  onResolveApproval: (approved: boolean) => void;
  bodyClassName?: string | undefined;
  /** 保留可选签名兼容调用方；正文已统一还原标准排版。 */
  onSelectAdvice?: ((text: string) => void) | undefined;
} & FileActivityActions) {
  const [processOpen, setProcessOpen] = useState(true);
  const [now, setNow] = useState(Date.now);
  const processId = useId();

  // 合并为单一定时器，只在当前消息处于流式运行时每秒刷新一次实时耗时。
  useEffect(() => {
    if (!isStreaming) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isStreaming]);

  const text = isStreaming ? content : (progressText ?? "");
  const rounds = useMemo(() => buildTimelineRounds(steps, text.length, isStreaming), [steps, text.length, isStreaming]);
  const totalTools = useMemo(() => rounds.reduce((acc, r) => acc + r.tools.length, 0), [rounds]);
  const hasAnyStepReasoning = useMemo(
    () => rounds.some((r) => Boolean(r.think?.detail?.trim())),
    [rounds],
  );
  const fallbackReasoning = !hasAnyStepReasoning && reasoning?.trim() ? reasoning.trim() : undefined;
  const hasProcess = rounds.length > 0 || Boolean(fallbackReasoning) || (!isStreaming && Boolean(text.trim()));
  const lastEvent = steps.reduce((latest, step) => Math.max(latest, step.timestamp), 0);
  const durationMs = runDurationMs ?? reasoningDurationMs ?? (lastEvent >= createdAt ? lastEvent - createdAt : undefined);
  const hasStatus = isStreaming || durationMs !== undefined || hasProcess || tokenUsage !== undefined;
  const finalText = isStreaming ? text.slice(rounds.at(-1)?.offset ?? 0) : content;
  const hasDisclosure = isStreaming || hasProcess;
  const labels = timelineMessages[locale.isZh ? "zh" : "en"];
  const fileActions = useMemo<FileActivityActions>(
    () => ({ onOpenFile, onOpenTrace, onOpenBrowser, selectedFileStepId }),
    [onOpenBrowser, onOpenFile, onOpenTrace, selectedFileStepId],
  );

  return (
    <>
      {hasStatus && (
        <StepTraceList
          isZh={locale.isZh}
          createdAt={createdAt}
          now={now}
          durationMs={durationMs}
          toolCount={totalTools}
          tokenUsage={tokenUsage}
          isStreaming={isStreaming}
          expanded={processOpen}
          processId={processId}
          onToggle={hasDisclosure ? () => setProcessOpen((prev) => !prev) : undefined}
        />
      )}
      {hasStatus && (content.trim() || hasProcess) && <hr className={styles.timelineDivider} />}
      {hasDisclosure && (
        <div id={processId} hidden={!processOpen} className={`${styles.flow} ${styles.process}`}>
          {rounds.length === 0 && fallbackReasoning && (
            <ThinkingBlock
              label={isStreaming ? (locale.isZh ? "思考中…" : "Thinking…") : (locale.isZh ? "已思考" : "Thought")}
              durationText={reasoningDurationMs ? formatDuration(reasoningDurationMs, locale.isZh) : undefined}
              reasoningText={fallbackReasoning}
              live={isStreaming}
              isZh={locale.isZh}
            />
          )}
          {rounds.map((round, index) => {
            const precedingText = text.slice(rounds[index - 1]?.offset ?? 0, round.offset);
            const thinkStep = round.think;
            const isLastRound = index === rounds.length - 1;
            const thinkDetail = thinkStep?.detail?.trim() || (isLastRound ? fallbackReasoning : undefined);
            const thinkActive = Boolean(round.live && round.tools.length === 0 && (!thinkStep || thinkStep.status === "running"));
            const thinkStage = thinkStep?.status === "error"
              ? "modelFailed"
              : thinkActive
                ? (thinkStep ? getLiveStage([thinkStep], now) : "starting")
                : "thought";
            // 有真实思考正文时显示「思考中… / 已思考」，无思考正文时保留语义阶段文案（如「已分析」「正在回复」）。
            const thinkLabel = thinkDetail
              ? (thinkActive ? (thinkStage === "reasoning" ? labels.reasoning : (locale.isZh ? "思考中…" : "Thinking…")) : (locale.isZh ? "已思考" : "Thought"))
              : labels[thinkStage];
            const thinkDuration = thinkActive
              ? formatDuration(now - (thinkStep?.startedAt ?? createdAt), locale.isZh)
              : (thinkStep?.startedAt !== undefined && thinkStep.timestamp > thinkStep.startedAt + 999
                ? formatDuration(thinkStep.timestamp - thinkStep.startedAt, locale.isZh)
                : undefined);
            // 只要该轮有思考步骤/思考正文/活跃状态或无工具，即用 ThinkingBlock 统一包裹本轮思考与工具链，
            // 点击「已思考」可一次性收起本轮的思考正文、过程说明与全部工具行。
            const showThinkBlock = Boolean(thinkStep || thinkDetail || thinkActive || round.tools.length === 0);
            const roundFollowContent = (precedingText.trim() || round.tools.length > 0) ? (
              <>
                {precedingText.trim() && (
                  <div className={bodyClassName}>
                    <MarkdownContent content={precedingText} isZh={locale.isZh} />
                  </div>
                )}
                {round.tools.length > 0 && (
                  <RoundToolChain
                    steps={round.tools}
                    locale={locale}
                    live={isStreaming}
                    now={isStreaming ? now : undefined}
                    fileActions={fileActions}
                  />
                )}
              </>
            ) : null;

            return (
              <div key={round.key} className={styles.roundBlock} data-activity-segment={round.key}>
                {showThinkBlock ? (
                  <ThinkingBlock
                    label={thinkLabel}
                    durationText={thinkDuration}
                    reasoningText={thinkDetail}
                    toolCount={round.tools.length}
                    live={thinkActive}
                    isZh={locale.isZh}
                  >
                    {roundFollowContent}
                  </ThinkingBlock>
                ) : (
                  roundFollowContent
                )}
              </div>
            );
          })}
          {!isStreaming && text.slice(rounds.at(-1)?.offset ?? 0).trim() && (
            <div className={bodyClassName}>
              <MarkdownContent content={text.slice(rounds.at(-1)?.offset ?? 0)} isZh={locale.isZh} />
            </div>
          )}
        </div>
      )}
      {pendingApproval && (
        <TimelineApproval locale={locale} pendingApproval={pendingApproval} onResolveApproval={onResolveApproval} />
      )}
      {finalText.trim() && (
        <div className={bodyClassName}>
          <MarkdownContent content={finalText} isZh={locale.isZh} />
        </div>
      )}
    </>
  );
});
