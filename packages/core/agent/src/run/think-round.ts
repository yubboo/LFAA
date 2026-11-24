// Agent 单轮「思考」：渲染系统提示 → 预算内压缩 → 注入 steering → 记录 token 快照 → 调模型（含超限重试）。
// 从 executeAgentTaskLoop 拆出：一轮思考所需的上下文与回调以显式参数传入，循环体只负责编排。
import { isContextOverflowError } from "@lfaa/context";
import type { LlmGenerateOutput, LlmMessage } from "@lfaa/llm";
import type { AgentStepTrace } from "@lfaa/memory";
import { estimateMessageTokens, estimateSystemPromptTokens, estimateToolsTokens } from "@lfaa/metrics";
import { completeAgentRound, type resolveModelRoundLimits } from "./model-round";
import { compactForRun } from "./run-compaction";
import { injectSteeringMessages } from "./steering";
import { preferTodoFirst } from "./todo-plan";
import { clarificationTool } from "../context/clarification";
import { readStreamingPath } from "../tools/tool-call-args";
import type { RunUsageTracker } from "./agent-usage";
import type { LoopState } from "./loop-state";
import type { RunExecutionParams, RunLoopDeps } from "./run-types";

type RoundLimits = ReturnType<typeof resolveModelRoundLimits>;

/** 单轮思考所需的上下文；conversation 会被压缩与 steering 原地修改。 */
export interface ThinkRoundInput {
  deps: RunLoopDeps;
  params: RunExecutionParams;
  state: LoopState;
  tracker: RunUsageTracker;
  /** 当前轮次编号（与本轮 think 步骤、delta 偏移一致）。 */
  iteration: number;
  systemMessage: LlmMessage;
  conversation: LlmMessage[];
  contextBudgetChars: number;
  roundLimits: RoundLimits;
  /** 消费本轮尾部动态提示（不改写首条 system 前缀，保住 KV Cache）。 */
  consumeTailHint: (remainingSteps?: number) => string;
  pushStep: (step: AgentStepTrace) => void;
}

/** 单轮思考产物：模型输出 + 已累积正文 + 准备中的工具步骤 + 截断提示。 */
export interface ThinkRoundResult {
  output: LlmGenerateOutput;
  iterText: string;
  preparing: Map<string, AgentStepTrace>;
  roundContent: string;
  truncationHint: string;
}

/**
 * 执行一轮思考：上下文压缩与 steering 会改动 conversation；
 * 上下文超限时强制压缩一半预算并重试一次（每次运行只重试一次）。
 */
export async function runThinkRound({
  deps,
  params,
  state,
  tracker,
  iteration,
  systemMessage,
  conversation,
  contextBudgetChars,
  roundLimits,
  consumeTailHint,
  pushStep,
}: ThinkRoundInput): Promise<ThinkRoundResult> {
  const roundStartedAt = Date.now();
  const thinkStep: AgentStepTrace = {
    id: `think-${iteration}`,
    iteration,
    phase: "think",
    status: "running",
    title: `第 ${iteration} 轮思考：规划与决策`,
    textOffset: state.progressText.length,
    startedAt: roundStartedAt,
    timestamp: roundStartedAt,
  };
  pushStep(thinkStep);

  let iterText = "";
  let iterReasoning = "";
  let modelStage: AgentStepTrace["modelStage"];
  const preparing = new Map<string, AgentStepTrace>();
  let lastActivity = thinkStep.timestamp;
  const noteModelActivity = (stage = modelStage) => {
    const now = Date.now();
    if (modelStage === stage && now - lastActivity < 4_000) return;
    lastActivity = now;
    modelStage = stage;
    const partialDetail = iterReasoning ? iterReasoning.slice(0, 24_000) : undefined;
    pushStep({
      ...thinkStep,
      ...(modelStage ? { modelStage } : {}),
      ...(partialDetail ? { detail: partialDetail } : {}),
      timestamp: now,
    });
  };
  let llmTools = preferTodoFirst(deps.tools.getLlmToolSchemas());
  // 当主循环同时存在 invoke_subagent 与内置浏览器工具时，将 browser_* 专职收口给浏览器子智能体（mode="browser"），
  // 确保每次浏览与页面验收都经由独立浏览器子智能体并在思维链呈现实时状态卡，不污染主上下文。
  if (deps.tools.getTool("invoke_subagent") && deps.tools.getTool("browser_navigate")) {
    llmTools = llmTools.filter((tool) => tool.name === "browser_present" || !tool.name.startsWith("browser_"));
  }
  if (params.enableClarification) llmTools = [...llmTools, clarificationTool];
  let firstTokenAt: number | undefined;
  const tailHint = consumeTailHint(Math.max(0, state.budget.limit - iteration + 1));
  if (tailHint) {
    conversation.push({ role: "user", content: `[运行时提示]\n${tailHint}` });
  }
  // 发送前按预算压缩：保留结构与最近轮次，早期工具结果压成尾部片段。
  const compaction = compactForRun(deps.compaction, conversation, {
    budgetChars: contextBudgetChars,
    sessionId: params.sessionId,
  });
  if (compaction.compacted) {
    conversation.splice(0, conversation.length, ...compaction.messages);
    conversation[0] = systemMessage;
    pushStep({
      id: "context-compaction",
      iteration,
      phase: "check",
      status: "done",
      title: `上下文已压缩：省略 ${compaction.droppedMessages} 条早期消息，压缩 ${compaction.truncatedResults} 条工具结果`,
      timestamp: Date.now(),
    });
  }
  injectSteeringMessages(deps, conversation, iteration, pushStep);
  // 记录本轮实际发送的上下文构成，估算口径与 DSH token-meter 对齐。
  tracker.setContextSnapshot({
    systemTokens: estimateSystemPromptTokens(systemMessage.content),
    toolsTokens: estimateToolsTokens(llmTools),
    messageTokens: conversation.reduce(
      (sum, message) => (message.role === "system" ? sum : sum + estimateMessageTokens(message)),
      0,
    ),
  });
  const callModel = () => completeAgentRound(deps.llm, {
    ...(params.profileId !== undefined ? { profileId: params.profileId } : {}),
    ...(params.reasoningEffort !== undefined ? { reasoningEffort: params.reasoningEffort } : {}),
    messages: conversation,
    tools: llmTools,
    signal: params.signal,
    onRetry: () => noteModelActivity("retrying"),
    onActivity: (progress) => {
      noteModelActivity();
      if (!progress) return;
      const pending = preparing.get(progress.toolCallId);
      if (!pending) return;
      const target = pending.toolTarget ?? readStreamingPath(progress.argumentPrefix);
      const now = Date.now();
      // 路径首次到达时立即更新，后续参数按时间合并，避免每个 token 都落盘。
      if (target === pending.toolTarget && pending.argumentChars !== undefined && now - pending.timestamp < 500) return;
      const next = {
        ...pending, ...(target ? { toolTarget: target } : {}),
        argumentChars: progress.argumentChars, timestamp: now,
      };
      preparing.set(progress.toolCallId, next);
      pushStep(next);
    },
    onDelta: (delta) => {
      if ((delta.type === "reasoning" || delta.type === "text") && delta.text) {
        firstTokenAt ??= Date.now();
        noteModelActivity(delta.type === "reasoning" ? "reasoning" : "replying");
      }
      if (delta.type === "reasoning" && delta.text) {
        iterReasoning += delta.text;
        state.reasoning += delta.text;
        params.emit({ type: "delta", runId: params.runId, seq: 0, kind: "reasoning", text: delta.text, iteration });
      } else if (delta.type === "text" && delta.text) {
        iterText += delta.text;
        params.emit({ type: "delta", runId: params.runId, seq: 0, kind: "text", text: delta.text });
      } else if (delta.type === "tool_call" && delta.toolCallId && delta.toolName && !preparing.has(delta.toolCallId)) {
        // 工具名已到达，等模型返回完整调用后才解析参数、审批和执行。
        const preparation: AgentStepTrace = {
          id: `act-${iteration}-${delta.toolCallId}`,
          iteration,
          phase: "act",
          status: "preparing",
          title: `准备工具：${delta.toolName}`,
          toolCallId: delta.toolCallId,
          toolName: delta.toolName,
          textOffset: state.progressText.length + iterText.length,
          timestamp: Date.now(),
        };
        preparing.set(delta.toolCallId, preparation);
        pushStep(preparation);
      }
    },
  }, roundLimits);
  let output: LlmGenerateOutput;
  try {
    output = await callModel();
  } catch (error) {
    // 供应商报“上下文超限”时不再直接失败：强制压缩一半预算后重试一次。
    if (state.overflowRetried || !isContextOverflowError(error)) throw error;
    state.overflowRetried = true;
    const forced = compactForRun(deps.compaction, conversation, {
      budgetChars: Math.floor(contextBudgetChars / 2),
      toolCapChars: 600,
      keepRecentRounds: 2,
    });
    conversation.splice(0, conversation.length, ...forced.messages);
    conversation[0] = systemMessage;
    pushStep({
      id: "context-overflow",
      iteration,
      phase: "check",
      status: "done",
      title: "模型上下文超限：已强制压缩并重试",
      detail: error instanceof Error ? error.message.slice(0, 200) : String(error),
      timestamp: Date.now(),
    });
    output = await callModel();
  }
  const truncatedOutput = /^(?:length|max_tokens|MAX_TOKENS|incomplete)$/iu.test(output.finishReason);
  tracker.addUsage(output);
  // 模型轮次耗时与首 token 延迟：解码吞吐只按首 token 之后的时间计算。
  tracker.addModelRound({
    startedAt: roundStartedAt,
    firstTokenAt,
    endedAt: Date.now(),
    completionTokens: output.usage?.completionTokens ?? 0,
  });
  tracker.emitUsage();
  const truncationHint = truncatedOutput
    ? "\n注意：上一轮模型输出达到长度上限被截断。请把大文件拆成多次写入（write_file 先写骨架，再用 edit_file 分段补充），或缩短单次输出后继续。"
    : "";
  if (truncatedOutput) {
    pushStep({
      id: `truncated-${iteration}`,
      iteration,
      phase: "check",
      status: "done",
      title: "模型输出达到长度上限：已提示拆分写入",
      timestamp: Date.now(),
    });
  }
  const roundContent = output.content || iterText;
  // 非流式适配器也在工具之前交付正文，偏移始终使用实际发出的前缀。
  if (!iterText && roundContent) {
    iterText = roundContent;
    pushStep({ ...thinkStep, modelStage: "replying", timestamp: Date.now() });
    params.emit({ type: "delta", runId: params.runId, seq: 0, kind: "text", text: iterText });
  }

  // 保留本轮完整思考文本（设安全上限 24,000 字符），供对话流实时与历史完整回看思维链。
  const rawReasoning = (output.reasoningContent || iterReasoning).trim();
  const thinkDetail = rawReasoning ? rawReasoning.slice(0, 24_000) : undefined;
  pushStep({
    ...thinkStep,
    status: "done",
    title: output.toolCalls.length > 0
      ? `第 ${iteration} 轮思考：计划调用 ${output.toolCalls.length} 项工具`
      : `第 ${iteration} 轮思考：形成最终方案`,
    ...(thinkDetail ? { detail: thinkDetail } : {}),
    timestamp: Date.now(),
  });

  // 未完成的工具请求仍保留真实的失败状态，不能遗留为进行中。
  const completeCallIds = new Set(output.toolCalls.map((call) => call.id));
  for (const [id, preparation] of preparing) {
    if (completeCallIds.has(id)) continue;
    pushStep({
      ...preparation,
      status: "error",
      detail: "模型未返回完整工具请求。",
      textOffset: output.toolCalls.length > 0 ? state.progressText.length + iterText.length : state.progressText.length,
      timestamp: Date.now(),
    });
  }

  return { output, iterText, preparing, roundContent, truncationHint };
}
