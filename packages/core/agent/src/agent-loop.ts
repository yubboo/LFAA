// 实现 Agent 核心任务循环：思考（Think）-> 行动（Act）-> 检查（Check）。
import { DEFAULT_CONTEXT_BUDGET_CHARS, isContextOverflowError } from "@lfaa/context";
import { REPEAT_THRESHOLDS, RepeatCallTracker } from "@lfaa/guard";
import { type LlmGenerateOutput, type LlmMessage, type LlmUsage } from "@lfaa/llm";
import type { AgentRunCost, AgentRunMetrics, AgentStepTrace, UserClarification } from "@lfaa/memory";
import { estimateMessageTokens, estimateSystemPromptTokens, estimateToolsTokens } from "@lfaa/metrics";
import {
  buildProgressHint,
  buildRecentConversation,
  buildSkillsCatalogHint,
  buildSkillsSection,
  buildWorkspaceHint,
  FORMAT_HINT,
  MODE_HINTS,
  recallAgentContext,
  resolveModelContext,
} from "./agent-context";
import { finishWithClarification } from "./agent-completion";
import { appendMediaPreviews, buildMediaHint, collectMediaPreviews } from "./agent-media";
import { runFallbackConclusion } from "./agent-fallback";
import { RunUsageTracker } from "./agent-usage";
import { runActPhase } from "./act-runner";
import { compactForRun } from "./run-compaction";
import { renderSystemContent } from "./run-system";
import { clarificationTool } from "./clarification";
import { completeAgentRound } from "./model-round";
import type { RunExecutionParams, RunLoopDeps } from "./run-types";
import { MAX_STEP_BUDGET } from "./step-budget";
import { injectSteeringMessages } from "./steering";
import { readStreamingPath } from "./tool-call-args";
import { preferTodoFirst } from "./todo-plan";
import { isCodePath, isVerificationCommand } from "./verification";
export type { RunExecutionParams, RunLoopDeps };

/** 顺序执行模型推理、工具审批和执行，最终把运行结果写回会话。 */
export async function executeAgentTaskLoop(
  deps: RunLoopDeps,
  params: RunExecutionParams,
): Promise<{ content: string; progressText: string; reasoning: string; steps: AgentStepTrace[]; model?: string; usage?: LlmUsage; metrics: AgentRunMetrics; cost?: AgentRunCost; clarification?: UserClarification }> {
  const steps: AgentStepTrace[] = [];
  let accumulatedReasoning = "";
  let progressText = "";
  const mediaPreviews = new Map<string, string>();

  const pushOrUpdateStep = (update: AgentStepTrace) => {
    const idx = steps.findIndex((s) => s.id === update.id);
    const step = { ...update, startedAt: steps[idx]?.startedAt ?? update.startedAt ?? update.timestamp };
    if (idx >= 0) steps[idx] = step;
    else steps.push(step);
    params.emit({ type: "step_update", runId: params.runId, step });
  };

  // 1. 装配上下文：规则优先级 + 长期记忆召回 + 资料库/资产库摘要 + 短期裁剪历史
  const { systemPrompt, projectRuleNames, contextWindow, historyDigest, libraryHint } = await recallAgentContext(deps, params);
  const workspaceHint = buildWorkspaceHint(params.projectId, params.workspaceRoots, projectRuleNames);
  const skillsSection = buildSkillsSection(params.resolvedSkills);

  if (params.resolvedSkills && params.resolvedSkills.length > 0) {
    pushOrUpdateStep({
      id: "skills-loaded",
      iteration: 0,
      phase: "act",
      status: "done",
      title: `已载入技能：${params.resolvedSkills.map((s) => `${s.name} (v${s.revision})`).join("、")}`,
      toolName: "load_skill",
      textOffset: 0,
      timestamp: Date.now(),
    });
  }

  const { activeProfile, modelHint, roundLimits, tokenPricing } = await resolveModelContext(
    deps,
    params,
    contextWindow.recentMessages,
  );
  const tracker = new RunUsageTracker(params, activeProfile, tokenPricing);

  const shellHint = deps.tools.getTool("run_command") ? await deps.tools.describeCommandShell() : "";
  const extraSystemHint = [deps.extraSystemPrompt ? (await deps.extraSystemPrompt()).trim() : "", buildMediaHint(deps.tools)]
    .filter(Boolean).join("\n\n");
  const systemMessage: LlmMessage = { role: "system", content: "" };
  let truncationHint = "";
  const updateSystemMessage = (remainingSteps?: number) => {
    systemMessage.content = renderSystemContent({
      systemPrompt, permissionHint: MODE_HINTS[params.getPermissionMode()], workspaceHint, modelHint, shellHint,
      libraryHint, progressHint: `${FORMAT_HINT}\n${buildProgressHint(deps, params)}`, skillsCatalogHint: buildSkillsCatalogHint(params.availableSkillCatalog), skillsSection,
      historyDigest, ...(remainingSteps !== undefined ? { remainingSteps } : {}), truncationHint, extraSystemHint,
    });
  };
  const conversation = buildRecentConversation(systemMessage, contextWindow, params.userMessage);

  let llmTools = preferTodoFirst(deps.tools.getLlmToolSchemas());
  const contextBudgetChars = Math.max(8_000, Math.floor(params.contextBudgetChars ?? DEFAULT_CONTEXT_BUDGET_CHARS));
  let overflowRetried = false;
  // 2. Think -> Act -> Check 任务循环
  // 步数预算用尽时不再直接收口：只要上一轮确实执行了工具，就自动追加预算继续推进。
  let budget = Math.max(1, Math.floor(params.maxSteps));
  const extensionSteps = Math.max(0, Math.floor(params.autoExtendSteps ?? 0));
  const hardBudget = extensionSteps > 0 ? Math.max(budget, MAX_STEP_BUDGET) : budget;
  let iteration = 0;
  let lastRoundExecutedTools = false;
  // 空阈值数组表示用户关闭重复调用提醒。
  const repeatTracker = params.repeatToolThresholds !== undefined && params.repeatToolThresholds.length === 0
    ? undefined
    : new RepeatCallTracker(params.repeatToolThresholds ?? REPEAT_THRESHOLDS);
  let pendingRepeatReminders: string[] = [];
  // 完成前自检：记录最后一次代码修改与最后一次验证命令所在的轮次。
  let lastCodeEditIteration = 0;
  let lastVerificationIteration = 0;
  let verificationNudged = false;
  while (true) {
    iteration += 1;
    if (iteration > budget) {
      if (extensionSteps === 0 || budget >= hardBudget || !lastRoundExecutedTools) break;
      const previousBudget = budget;
      budget = Math.min(hardBudget, budget + extensionSteps);
      pushOrUpdateStep({
        id: `budget-${iteration}`,
        iteration,
        phase: "check",
        status: "done",
        title: `步数预算已用尽：自动延长 ${budget - previousBudget} 步继续推进`,
        detail: "上一轮仍产生了有效工具结果，任务保持运行；需要停止请手动中止。",
        timestamp: Date.now(),
      });
    }

    if (params.signal.aborted) throw new Error("用户已中止本次任务。");

    const thinkStepId = `think-${iteration}`;
    const thinkStep: AgentStepTrace = {
      id: thinkStepId,
      iteration,
      phase: "think",
      status: "running",
      title: `第 ${iteration} 轮思考：规划与决策`,
      textOffset: progressText.length,
      timestamp: Date.now(),
    };
    pushOrUpdateStep(thinkStep);

    let iterText = "";
    let modelStage: AgentStepTrace["modelStage"];
    const preparing = new Map<string, AgentStepTrace>();
    let lastActivity = thinkStep.timestamp;
    const noteModelActivity = (stage = modelStage) => {
      const now = Date.now();
      if (modelStage === stage && now - lastActivity < 4_000) return;
      lastActivity = now;
      modelStage = stage;
      pushOrUpdateStep({ ...thinkStep, ...(modelStage ? { modelStage } : {}), timestamp: now });
    };
    llmTools = preferTodoFirst(deps.tools.getLlmToolSchemas());
    if (params.enableClarification) llmTools = [...llmTools, clarificationTool];
    const roundStartedAt = Date.now();
    let firstTokenAt: number | undefined;
    updateSystemMessage(Math.max(0, budget - iteration + 1));
    // 发送前按预算压缩：保留结构与最近轮次，早期工具结果压成尾部片段。
    const compaction = compactForRun(deps.compaction, conversation, { budgetChars: contextBudgetChars });
    if (compaction.compacted) {
      conversation.splice(0, conversation.length, ...compaction.messages);
      conversation[0] = systemMessage;
      pushOrUpdateStep({
        id: "context-compaction",
        iteration,
        phase: "check",
        status: "done",
        title: `上下文已压缩：省略 ${compaction.droppedMessages} 条早期消息，压缩 ${compaction.truncatedResults} 条工具结果`,
        timestamp: Date.now(),
      });
    }
    injectSteeringMessages(deps, conversation, iteration, pushOrUpdateStep);
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
        pushOrUpdateStep(next);
      },
      onDelta: (delta) => {
        if ((delta.type === "reasoning" || delta.type === "text") && delta.text) {
          firstTokenAt ??= Date.now();
          noteModelActivity(delta.type === "reasoning" ? "reasoning" : "replying");
        }
        if (delta.type === "reasoning" && delta.text) {
          accumulatedReasoning += delta.text;
          params.emit({ type: "delta", runId: params.runId, seq: 0, kind: "reasoning", text: delta.text });
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
            textOffset: progressText.length + iterText.length,
            timestamp: Date.now(),
          };
          preparing.set(delta.toolCallId, preparation);
          pushOrUpdateStep(preparation);
        }
      },
    }, roundLimits);
    let output: LlmGenerateOutput;
    try {
      output = await callModel();
    } catch (error) {
      // 供应商报“上下文超限”时不再直接失败：强制压缩一半预算后重试一次。
      if (overflowRetried || !isContextOverflowError(error)) throw error;
      overflowRetried = true;
      const forced = compactForRun(deps.compaction, conversation, {
        budgetChars: Math.floor(contextBudgetChars / 2),
        toolCapChars: 600,
        keepRecentRounds: 2,
      });
      conversation.splice(0, conversation.length, ...forced.messages);
      conversation[0] = systemMessage;
      pushOrUpdateStep({
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
    truncationHint = truncatedOutput
      ? "\n注意：上一轮模型输出达到长度上限被截断。请把大文件拆成多次写入（write_file 先写骨架，再用 edit_file 分段补充），或缩短单次输出后继续。"
      : "";
    if (truncatedOutput) {
      pushOrUpdateStep({
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
      pushOrUpdateStep({ ...thinkStep, modelStage: "replying", timestamp: Date.now() });
      params.emit({ type: "delta", runId: params.runId, seq: 0, kind: "text", text: iterText });
    }

    const thinkDetail = output.reasoningContent?.slice(0, 240);
    pushOrUpdateStep({
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
      pushOrUpdateStep({
        ...preparation,
        status: "error",
        detail: "模型未返回完整工具请求。",
        textOffset: output.toolCalls.length > 0 ? progressText.length + iterText.length : progressText.length,
        timestamp: Date.now(),
      });
    }

    const clarificationCall = params.enableClarification && output.toolCalls.find((call) => call.name === clarificationTool.name);
    if (clarificationCall) {
      return finishWithClarification({
        clarificationCall,
        preparing,
        progressText,
        iterText,
        accumulatedReasoning,
        steps,
        outputModel: output.model,
        tracker,
        pushStep: pushOrUpdateStep,
      });
    }

    // 无工具调用：先做完成前自检，再执行终结检查。
    if (output.toolCalls.length === 0) {
      const finalContent = roundContent.trim();
      const needsVerification = lastCodeEditIteration > lastVerificationIteration;
      // 改过代码却没有运行验证时，给模型一次补验证的机会（每次运行最多提示一次）。
      if (needsVerification && !verificationNudged && budget - iteration >= 2) {
        verificationNudged = true;
        pushOrUpdateStep({
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
        continue;
      }
      if (needsVerification && verificationNudged) {
        pushOrUpdateStep({
          id: "verification-result",
          iteration,
          phase: "check",
          status: "error",
          title: "完成前自检：模型未执行验证即结束",
          detail: finalContent.slice(0, 160) || "未说明原因",
          timestamp: Date.now(),
        });
      }
      const checkStepId = `check-${iteration}`;
      const isEmpty = !finalContent;
      pushOrUpdateStep({
        id: checkStepId,
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
        content: appendMediaPreviews(finalContent, mediaPreviews) || "模型返回了空内容，未能生成有效答复。",
        progressText,
        reasoning: accumulatedReasoning,
        steps,
        model: output.model,
        ...(usage ? { usage } : {}),
        ...(cost ? { cost } : {}),
        metrics: tracker.buildMetrics(),
      };
    }

    if (iterText && !iterText.endsWith("\n\n")) {
      iterText += "\n\n";
      params.emit({ type: "delta", runId: params.runId, seq: 0, kind: "text", text: "\n\n" });
    }
    progressText += iterText;
    const roundTextOffset = progressText.length;

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
      pushOrUpdateStep,
      onExecuted: (outcome) => {
        // 完成前自检：记录最后一次代码修改与最后一次验证命令所在的轮次。
        const modifiedPath = outcome.fileChange?.path ?? outcome.action.toolTarget;
        const modified = Boolean(outcome.fileChange) || outcome.call.name === "write_file" || outcome.call.name === "edit_file";
        if (outcome.executed && outcome.ok && modified && isCodePath(modifiedPath)) {
          lastCodeEditIteration = iteration;
        }
        if (outcome.executed && outcome.command && isVerificationCommand(outcome.command)) {
          lastVerificationIteration = iteration;
        }
        // 连续相同调用只给建议性提醒，不阻断执行；提醒在工具结果回填后再进入上下文。
        if (outcome.executed && outcome.ok) {
          collectMediaPreviews(mediaPreviews, outcome.call.name, outcome.output);
          const repeat = repeatTracker?.observe(outcome.call.name, outcome.call.argumentsJson);
          if (repeat?.reminder) {
            pendingRepeatReminders.push(repeat.reminder);
            pushOrUpdateStep({
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
    for (const reminder of pendingRepeatReminders) {
      conversation.push({ role: "user", content: reminder });
    }
    pendingRepeatReminders = [];

    // Check 阶段：评估行动结果并驱动下一轮思考
    const checkStepId = `check-${iteration}`;
    pushOrUpdateStep({
      id: checkStepId,
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
    lastRoundExecutedTools = act.executedToolCount > 0;
  }

  // 达到步数预算且无自动延长空间时执行收口总结。
  const fallback = await runFallbackConclusion({
    deps,
    params,
    conversation,
    systemMessage,
    updateSystemMessage: () => updateSystemMessage(),
    contextBudgetChars,
    iteration,
    progressTextLength: progressText.length,
    pushStep: pushOrUpdateStep,
    roundLimits,
    tracker,
    emitReasoning: (text) => {
      accumulatedReasoning += text;
      params.emit({ type: "delta", runId: params.runId, seq: 0, kind: "reasoning", text });
    },
    emitText: (text) => {
      params.emit({ type: "delta", runId: params.runId, seq: 0, kind: "text", text });
    },
  });
  const lastModel = fallback.model ?? tracker.lastModel;
  const usage = tracker.usageSnapshot;
  const cost = tracker.cost();
  return {
    content: appendMediaPreviews(fallback.content, mediaPreviews),
    progressText,
    reasoning: accumulatedReasoning,
    steps,
    ...(lastModel ? { model: lastModel } : {}),
    ...(usage ? { usage } : {}),
    ...(cost ? { cost } : {}),
    metrics: tracker.buildMetrics(),
  };
}
