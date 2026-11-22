// 无工具调用时的收口：完成前自检（改了代码没验证先给一次补验证机会）→ 空响应判定 → 最终检查步骤 → 结果组装。
// 从 executeAgentTaskLoop 拆出：这段分支与工具轮互斥，单独成模块后循环体只剩「分支选择」。
import type { LlmGenerateOutput, LlmMessage } from "@lfaa/llm";
import type { AgentStepTrace } from "@lfaa/memory";
import { appendMediaPreviews } from "../context/agent-media";
import type { RunUsageTracker } from "./agent-usage";
import type { LoopState } from "./loop-state";
import type { AgentRunResult } from "./run-types";

/** 收口分支的两种结局：要求模型补验证后重来一轮，或直接给出最终结果。 */
export type FinishRoundOutcome = { kind: "retry" } | { kind: "done"; result: AgentRunResult };

/** 无工具收口所需上下文；conversation 在要求补验证时会追加一条用户消息。 */
export interface FinishRoundInput {
  state: LoopState;
  tracker: RunUsageTracker;
  iteration: number;
  output: LlmGenerateOutput;
  /** 本轮正文（`output.content || iterText`）。 */
  roundContent: string;
  conversation: LlmMessage[];
  steps: AgentStepTrace[];
  mediaPreviews: Map<string, string>;
  pushStep: (step: AgentStepTrace) => void;
}

/**
 * 模型本轮没有发起工具调用时的处理：
 * 1. 改过代码但从未验证过 → 提示一次补验证，返回 retry；
 * 2. 已提示过仍直接结束 → 记一条 error 级自检结果；
 * 3. 写最终检查步骤并组装运行结果（空响应显式标记为 error）。
 */
export function finishWithoutTools({
  state,
  tracker,
  iteration,
  output,
  roundContent,
  conversation,
  steps,
  mediaPreviews,
  pushStep,
}: FinishRoundInput): FinishRoundOutcome {
  const finalContent = roundContent.trim();
  const { verification } = state;
  const needsVerification = verification.lastCodeEditIteration > verification.lastVerificationIteration;
  // 改过代码却没有运行验证时，给模型一次补验证的机会（每次运行最多提示一次）。
  if (needsVerification && !verification.nudged && state.budget.limit - iteration >= 2) {
    verification.nudged = true;
    pushStep({
      id: "verification-gate",
      iteration,
      phase: "check",
      status: "error",
      title: "完成前自检：本轮修改了代码但尚未运行验证",
      detail: "已要求模型先执行构建/测试/类型检查，或说明本次修改无需验证的原因。",
      timestamp: Date.now(),
    });
    conversation.push({
      role: "user",
      content: "完成前请先验证本次修改：运行构建、测试或类型检查（如 pnpm build、pnpm test、mvn package、tsc --noEmit）。如果本次修改确实不需要验证（例如只改了文档或当前环境没有可用构建），请明确说明原因后再结束。",
    });
    return { kind: "retry" };
  }
  if (needsVerification && verification.nudged) {
    pushStep({
      id: "verification-result",
      iteration,
      phase: "check",
      status: "error",
      title: "完成前自检：模型未执行验证即结束",
      detail: finalContent.slice(0, 160) || "未说明原因",
      timestamp: Date.now(),
    });
  }
  const isEmpty = !finalContent;
  pushStep({
    id: `check-${iteration}`,
    iteration,
    phase: "check",
    status: isEmpty ? "error" : "done",
    title: isEmpty ? "最终检查：响应为空" : "最终检查：已收到答复",
    ...(isEmpty ? { detail: "请检查模型接口与提示词配置。" } : {}),
    timestamp: Date.now(),
  });
  const usage = tracker.usageSnapshot;
  const cost = tracker.cost();
  return {
    kind: "done",
    result: {
      content: appendMediaPreviews(finalContent, mediaPreviews) || "模型返回了空内容，未能生成有效答复。",
      progressText: state.progressText,
      reasoning: state.reasoning,
      steps,
      model: output.model,
      ...(usage ? { usage } : {}),
      ...(cost ? { cost } : {}),
      metrics: tracker.buildMetrics(),
    },
  };
}