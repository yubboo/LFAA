// 时间线阶段构建器：按 iteration 还原轮次，并以“出现新正文”为自然分界合并连续无正文间隔的工具调用与思考记录。
import type { AgentStepItem } from "../store/chat-types";
import { formatDuration } from "./StepTraceList";

export interface TimelineRound {
  key: string;
  iteration: number;
  think?: AgentStepItem;
  tools: AgentStepItem[];
  offset: number;
  live: boolean;
}

export interface TimelineStage {
  key: string;
  thinkSteps: AgentStepItem[];
  tools: AgentStepItem[];
  startOffset: number;
  endOffset: number;
  live: boolean;
}

/** 先按 iteration 还原原始轮次，保留每轮思考与工具调用及单调递增的正文偏移。 */
export function buildTimelineRounds(
  steps: readonly AgentStepItem[],
  textLength: number,
  isStreaming: boolean,
): TimelineRound[] {
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

/** 以“出现新正文”为阶段分界，把两段正文之间连续发起的多次工具往返合并为同一阶段，消除碎包裹点。 */
export function buildTimelineStages(
  rawRounds: readonly TimelineRound[],
  text: string,
): TimelineStage[] {
  const stages: TimelineStage[] = [];

  for (const round of rawRounds) {
    const last = stages.at(-1);
    const prevEnd = last?.endOffset ?? 0;
    const spoken = text.slice(prevEnd, round.offset);
    const hasSpoken = spoken.trim().length > 0;

    // 中间没有新正文隔开且本轮带有工具时，连续的新工具调用合并进同一个工具总菜单；
    // 若下一轮正处于纯思考流式态（尚无工具），保留在底部作为实时思考行，避免倒流到上一阶段上方。
    const isLivePureThink = round.live && round.tools.length === 0;
    if (last && !hasSpoken && !isLivePureThink && round.tools.length > 0) {
      if (round.think) last.thinkSteps.push(round.think);
      last.tools.push(...round.tools);
      last.endOffset = Math.max(last.endOffset, round.offset);
      last.live = last.live || round.live;
      continue;
    }

    stages.push({
      key: round.key,
      thinkSteps: round.think ? [round.think] : [],
      tools: [...round.tools],
      startOffset: prevEnd,
      endOffset: round.offset,
      live: round.live,
    });
  }

  return stages;
}

/** 合并同阶段连续思考正文与起止耗时，便于在单个思维链折叠块内连续回看。 */
export function resolveStageThinking(
  thinkSteps: readonly AgentStepItem[],
  fallbackReasoning: string | undefined,
  live: boolean,
  now: number,
  createdAt: number,
  isZh: boolean,
) {
  const details = thinkSteps
    .map((step) => step.detail?.trim())
    .filter((detail): detail is string => Boolean(detail));
  const mergedDetail = details.length > 0 ? details.join("\n\n") : fallbackReasoning;
  const latestThink = thinkSteps.at(-1);
  const firstStartedAt = thinkSteps.reduce<number | undefined>(
    (earliest, step) => {
      if (step.startedAt === undefined) return earliest;
      return earliest === undefined ? step.startedAt : Math.min(earliest, step.startedAt);
    },
    undefined,
  );
  const latestTimestamp = thinkSteps.reduce<number>(
    (latest, step) => Math.max(latest, step.timestamp),
    0,
  );

  let durationMs: number | undefined;
  let durationText: string | undefined;
  if (live) {
    durationMs = Math.max(0, now - (firstStartedAt ?? latestThink?.startedAt ?? createdAt));
    durationText = formatDuration(durationMs, isZh);
  } else if (firstStartedAt !== undefined && latestTimestamp > firstStartedAt + 999) {
    durationMs = latestTimestamp - firstStartedAt;
    durationText = formatDuration(durationMs, isZh);
  }

  return { latestThink, detail: mergedDetail, durationText, durationMs };
}

export function latestThinkIsDone(thinkSteps: readonly AgentStepItem[]): boolean {
  const latest = thinkSteps.at(-1);
  return Boolean(latest && latest.status !== "running");
}
