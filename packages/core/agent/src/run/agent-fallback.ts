// 步数预算用尽时的收口总结：再压一次上下文、请求模型给出结论，并补齐最终步骤与统计。
import { compactConversation } from "@lfaa/context";
import type { LlmMessage } from "@lfaa/llm";
import type { AgentStepTrace } from "@lfaa/memory";
import { completeAgentRound, type resolveModelRoundLimits } from "./model-round";
import type { RunExecutionParams, RunLoopDeps } from "./run-types";

type RoundLimits = ReturnType<typeof resolveModelRoundLimits>;

export async function runFallbackConclusion(args: {
  deps: RunLoopDeps;
  params: RunExecutionParams;
  conversation: LlmMessage[];
  systemMessage: LlmMessage;
  updateSystemMessage: () => void;
  contextBudgetChars: number;
  iteration: number;
  progressTextLength: number;
  pushStep: (step: AgentStepTrace) => void;
  roundLimits: RoundLimits;
  tracker: {
    addUsage: (output: Awaited<ReturnType<typeof completeAgentRound>>) => void;
    addModelRound: (input: { startedAt: number; firstTokenAt: number | undefined; endedAt: number; completionTokens: number }) => void;
    emitUsage: () => void;
    lastModel: string | undefined;
  };
  emitReasoning: (text: string) => void;
  emitText: (text: string) => void;
}): Promise<{ content: string; model: string | undefined }> {
  const { deps, params, conversation, systemMessage, updateSystemMessage, pushStep, tracker } = args;
  const fallbackStep: AgentStepTrace = {
    textOffset: args.progressTextLength,
    id: "think-final",
    iteration: args.iteration,
    phase: "think",
    status: "running",
    title: "生成运行总结",
    timestamp: Date.now(),
  };
  pushStep(fallbackStep);
  let fallbackText = "";
  let fallbackStage: AgentStepTrace["modelStage"];
  let lastFallbackActivity = fallbackStep.timestamp;
  const noteFallbackStage = (stage = fallbackStage) => {
    const now = Date.now();
    if (fallbackStage === stage && now - lastFallbackActivity < 4_000) return;
    lastFallbackActivity = now;
    fallbackStage = stage;
    pushStep({ ...fallbackStep, ...(fallbackStage ? { modelStage: fallbackStage } : {}), timestamp: now });
  };
  // 收口总结前再压缩一次，避免追加提示后刚好越过上下文上限。
  const fallbackCompaction = compactConversation(conversation, { budgetChars: args.contextBudgetChars });
  if (fallbackCompaction.compacted) {
    conversation.splice(0, conversation.length, ...fallbackCompaction.messages);
    conversation[0] = systemMessage;
  }
  updateSystemMessage();
  const fallbackStartedAt = Date.now();
  let fallbackFirstTokenAt: number | undefined;
  const fallback = await completeAgentRound(deps.llm, {
    ...(params.profileId !== undefined ? { profileId: params.profileId } : {}),
    messages: [
      ...conversation,
      { role: "user", content: "已达到本轮最大工具步数限制，请基于现有观察直接给出清晰结论与未完成项说明。" },
    ],
    tools: [],
    signal: params.signal,
    onRetry: () => noteFallbackStage("retrying"),
    onActivity: () => noteFallbackStage(),
    onDelta: (delta) => {
      if (delta.type === "reasoning" && delta.text) {
        fallbackFirstTokenAt ??= Date.now();
        noteFallbackStage("reasoning");
        args.emitReasoning(delta.text);
      } else if (delta.type === "text" && delta.text) {
        fallbackFirstTokenAt ??= Date.now();
        noteFallbackStage("replying");
        fallbackText += delta.text;
        args.emitText(delta.text);
      }
    },
  }, args.roundLimits);
  const fallbackEndedAt = Date.now();
  tracker.addModelRound({
    startedAt: fallbackStartedAt,
    firstTokenAt: fallbackFirstTokenAt,
    endedAt: fallbackEndedAt,
    completionTokens: fallback.usage?.completionTokens ?? 0,
  });
  const finalContent = (fallback.content || fallbackText).trim() || "已达到单轮最大步数上限，请根据步骤轨迹继续指令。";
  tracker.addUsage(fallback);
  tracker.emitUsage();
  if (!fallbackText) {
    pushStep({ ...fallbackStep, modelStage: "replying", timestamp: Date.now() });
    args.emitText(finalContent);
  }
  pushStep({ ...fallbackStep, status: "done", timestamp: Date.now() });
  return { content: finalContent, model: fallback.model ?? tracker.lastModel };
}