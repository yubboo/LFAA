// 澄清请求收口：模型调用 ask_user 时终止本轮其余工具，把问题与选项作为本轮结论返回。
import type { AgentRunCost, AgentRunMetrics, AgentStepTrace, UserClarification } from "@lfaa/memory";
import { clarificationTool, readClarification } from "./clarification";
import type { LlmUsage } from "@lfaa/llm";
import type { RunUsageTracker } from "./agent-usage";

export function finishWithClarification(args: {
  clarificationCall: { argumentsJson: string };
  preparing: Map<string, AgentStepTrace>;
  progressText: string;
  iterText: string;
  accumulatedReasoning: string;
  steps: AgentStepTrace[];
  outputModel: string | undefined;
  tracker: RunUsageTracker;
  pushStep: (step: AgentStepTrace) => void;
}): {
  content: string;
  progressText: string;
  reasoning: string;
  steps: AgentStepTrace[];
  model?: string;
  usage?: LlmUsage;
  metrics: AgentRunMetrics;
  cost?: AgentRunCost;
  clarification: UserClarification;
} {
  const clarification = readClarification(args.clarificationCall.argumentsJson);
  const content = clarification
    ? [clarification.question, ...clarification.options.map((option) => `- ${option}`)].join("\n")
    : "请补充你想实现的目标和希望我处理的范围。";
  // 同批的修改类工具都不执行，用户回答后以新一轮运行继续。
  for (const preparation of args.preparing.values()) {
    args.pushStep({
      ...preparation,
      status: preparation.toolName === clarificationTool.name ? "done" : "error",
      detail: preparation.toolName === clarificationTool.name ? content : "等待用户澄清，本次调用未执行。",
      timestamp: Date.now(),
    });
  }
  const usage = args.tracker.usageSnapshot;
  const cost = args.tracker.cost();
  return {
    content,
    progressText: args.progressText + args.iterText,
    reasoning: args.accumulatedReasoning,
    steps: args.steps,
    ...(args.outputModel ? { model: args.outputModel } : {}),
    ...(usage ? { usage } : {}),
    ...(cost ? { cost } : {}),
    metrics: args.tracker.buildMetrics(),
    clarification: clarification ?? { question: content, options: [] },
  };
}