// 工具轮编排：补齐正文边界 → 记录 assistant 轮次 → 执行工具 → 回填重复提醒 → 写检查步骤 → 记录是否执行过工具。
// 从 executeAgentTaskLoop 拆出：工具执行本身在 act-runner，这里只负责一轮内的前后衔接。
import type { LlmGenerateOutput, LlmMessage } from "@lfaa/llm";
import type { AgentStepTrace } from "@lfaa/memory";
import { collectMediaPreviews } from "../context/agent-media";
import { runActPhase } from "./act-runner";
import type { RunUsageTracker } from "./agent-usage";
import { isCodePath, isVerificationCommand } from "./verification";
import type { LoopState } from "./loop-state";
import type { RunExecutionParams, RunLoopDeps } from "./run-types";

/** 工具轮所需上下文；conversation 会被追加 assistant 轮次与重复提醒。 */
export interface ActRoundInput {
  deps: RunLoopDeps;
  params: RunExecutionParams;
  state: LoopState;
  tracker: RunUsageTracker;
  iteration: number;
  output: LlmGenerateOutput;
  /** 本轮正文（`output.content || iterText`）。 */
  roundContent: string;
  iterText: string;
  conversation: LlmMessage[];
  pushStep: (step: AgentStepTrace) => void;
}

/** 执行一轮工具：返回后调用方只依据 `state.lastRoundExecutedTools` 决定是否继续。 */
export async function runToolRound({
  deps,
  params,
  state,
  tracker,
  iteration,
  output,
  roundContent,
  iterText,
  conversation,
  pushStep,
}: ActRoundInput): Promise<void> {
  // 正文与工具调用之间留空行，保证下一次拼接的偏移与显示一致。
  let roundText = iterText;
  if (roundText && !roundText.endsWith("\n\n")) {
    roundText += "\n\n";
    params.emit({ type: "delta", runId: params.runId, seq: 0, kind: "text", text: "\n\n" });
  }
  state.progressText += roundText;
  const roundTextOffset = state.progressText.length;

  // 记录模型发出的 assistant + toolCalls 轮次（保留 reasoningContent 以适配 DeepSeek 思考模式工具调用回传要求）
  conversation.push({
    role: "assistant",
    content: roundContent,
    ...(output.reasoningContent !== undefined ? { reasoningContent: output.reasoningContent } : {}),
    toolCalls: output.toolCalls,
  });

  // Act 阶段：交给工具执行器；连续只读调用并行，写文件与命令串行，结果按模型顺序回填。
  const act = await runActPhase(deps, params, output.toolCalls, {
    iteration,
    roundTextOffset,
    conversation,
    pushOrUpdateStep: pushStep,
    onExecuted: (outcome) => {
      // 完成前自检：记录最后一次代码修改与最后一次验证命令所在的轮次。
      const modifiedPath = outcome.fileChange?.path ?? outcome.action.toolTarget;
      const modified = Boolean(outcome.fileChange) || outcome.call.name === "write_file" || outcome.call.name === "edit_file";
      if (outcome.executed && outcome.ok && modified && isCodePath(modifiedPath)) {
        state.verification.lastCodeEditIteration = iteration;
      }
      if (outcome.executed && outcome.command && isVerificationCommand(outcome.command)) {
        state.verification.lastVerificationIteration = iteration;
      }
      // 连续相同调用只给建议性提醒，不阻断执行；提醒在工具结果回填后再进入上下文。
      if (outcome.executed && outcome.ok) {
        collectMediaPreviews(state.mediaPreviews, outcome.call.name, outcome.output);
        const repeat = state.repeat?.observe(outcome.call.name, outcome.call.argumentsJson);
        if (repeat?.reminder) {
          state.pendingReminders.push(repeat.reminder);
          pushStep({
            id: `repeat-call-${iteration}-${repeat.count}`,
            iteration,
            phase: "check",
            status: "done",
            title: `检测到重复工具调用：${outcome.call.name}（连续 ${repeat.count} 次）`,
            detail: "已向模型追加建议性提醒，要求换方法或结束任务；不阻断本次执行。",
            timestamp: Date.now(),
          });
        }
      }
    },
  });
  tracker.addToolMs(act.toolMs);
  tracker.emitUsage();
  // 工具结果已回填，再把重复调用提醒追加为独立的用户消息，保持 tool_call/tool_result 配对。
  for (const reminder of state.pendingReminders) {
    conversation.push({ role: "user", content: reminder });
  }
  state.pendingReminders.length = 0;

  // Check 阶段：评估行动结果并驱动下一轮思考
  pushStep({
    id: `check-${iteration}`,
    iteration,
    phase: "check",
    status: act.failureCount > 0 ? "error" : "done",
    title: act.failureCount > 0
      ? `第 ${iteration} 轮检查：${act.failureCount}/${output.toolCalls.length} 项执行异常，反馈模型调整`
      : `第 ${iteration} 轮检查：工具观察已回收，继续推进判断`,
    detail: act.summaries.join("；"),
    timestamp: Date.now(),
  });
  // 只有真正执行过工具的一轮才值得继续消耗预算；全部被拒绝或解析失败时按收口处理。
  state.lastRoundExecutedTools = act.executedToolCount > 0;
}