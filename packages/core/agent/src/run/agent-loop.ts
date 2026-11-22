// 实现 Agent 核心任务循环：思考（Think）-> 行动（Act）-> 检查（Check）。
import { DEFAULT_CONTEXT_BUDGET_CHARS } from "@lfaa/context";
import { type LlmMessage, type LlmUsage } from "@lfaa/llm";
import type { AgentRunCost, AgentRunMetrics, AgentStepTrace, UserClarification } from "@lfaa/memory";
import {
  buildProgressHint,
  buildProjectScopeHint,
  buildRecentConversation,
  buildSkillsCatalogHint,
  buildSkillsSection,
  buildWorkspaceHint,
  FORMAT_HINT,
  MODE_HINTS,
  recallAgentContext,
  resolveModelContext,
} from "../context/agent-context";
import { finishWithClarification } from "./agent-completion";
import { appendMediaPreviews, buildMediaHint, collectMediaPreviews } from "../context/agent-media";
import { runFallbackConclusion } from "./agent-fallback";
import { RunUsageTracker } from "./agent-usage";
import { runActPhase } from "./act-runner";
import { renderSystemContent } from "./run-system";
import { clarificationTool } from "../context/clarification";
import { runThinkRound } from "./think-round";
import type { RunExecutionParams, RunLoopDeps } from "./run-types";
import { createLoopState, extendBudget, recordStep } from "./loop-state";
import { isCodePath, isVerificationCommand } from "./verification";
export type { RunExecutionParams, RunLoopDeps };

/** 顺序执行模型推理、工具审批和执行，最终把运行结果写回会话。 */
export async function executeAgentTaskLoop(
  deps: RunLoopDeps,
  params: RunExecutionParams,
): Promise<{ content: string; progressText: string; reasoning: string; steps: AgentStepTrace[]; model?: string; usage?: LlmUsage; metrics: AgentRunMetrics; cost?: AgentRunCost; clarification?: UserClarification }> {
  const state = createLoopState(params);
  const pushOrUpdateStep = (update: AgentStepTrace) => recordStep(state, params, update);

  // 1. 装配上下文：规则优先级 + 长期记忆召回 + 资料库/资产库摘要 + 短期裁剪历史
  const { systemPrompt, projectRuleNames, contextWindow, historyDigest, libraryHint } = await recallAgentContext(deps, params);
  const workspaceHint = [
    buildWorkspaceHint(params.projectId, params.workspaceRoots, projectRuleNames, params.worktree),
    params.projectScope ? buildProjectScopeHint(params.projectScope) : "",
  ].filter(Boolean).join("\n\n");
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

  const contextBudgetChars = Math.max(8_000, Math.floor(params.contextBudgetChars ?? DEFAULT_CONTEXT_BUDGET_CHARS));
  // 2. Think -> Act -> Check 任务循环；预算、轮次与自检标记统一收在 state 里（见 loop-state.ts）。
  const steps = state.steps;
  const mediaPreviews = state.mediaPreviews;
  const repeatTracker = state.repeat;
  const pendingRepeatReminders = state.pendingReminders;
  const verification = state.verification;
  while (true) {
    state.iteration += 1;
    if (state.iteration > state.budget.limit) {
      const added = extendBudget(state);
      if (added === null) break;
      pushOrUpdateStep({
        id: `budget-${state.iteration}`,
        iteration: state.iteration,
        phase: "check",
        status: "done",
        title: `步数预算已用尽：自动延长 ${added} 步继续推进`,
        detail: "上一轮仍产生了有效工具结果，任务保持运行；需要停止请手动中止。",
        timestamp: Date.now(),
      });
    }

    const iteration = state.iteration;
    if (params.signal.aborted) throw new Error("用户已中止本次任务。");

    const think = await runThinkRound({
      deps,
      params,
      state,
      tracker,
      iteration,
      systemMessage,
      conversation,
      contextBudgetChars,
      roundLimits,
      updateSystemMessage,
      pushStep: pushOrUpdateStep,
    });
    truncationHint = think.truncationHint;
    const { output, preparing, roundContent } = think;
    let iterText = think.iterText;

    const clarificationCall = params.enableClarification && output.toolCalls.find((call) => call.name === clarificationTool.name);
    if (clarificationCall) {
      return finishWithClarification({
        clarificationCall,
        preparing,
        progressText: state.progressText,
        iterText,
        accumulatedReasoning: state.reasoning,
        steps,
        outputModel: output.model,
        tracker,
        pushStep: pushOrUpdateStep,
      });
    }

    // 无工具调用：先做完成前自检，再执行终结检查。
    if (output.toolCalls.length === 0) {
      const finalContent = roundContent.trim();
      const needsVerification = verification.lastCodeEditIteration > verification.lastVerificationIteration;
      // 改过代码却没有运行验证时，给模型一次补验证的机会（每次运行最多提示一次）。
      if (needsVerification && !verification.nudged && state.budget.limit - iteration >= 2) {
        verification.nudged = true;
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
      if (needsVerification && verification.nudged) {
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
        progressText: state.progressText,
        reasoning: state.reasoning,
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
    state.progressText += iterText;
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
      pushOrUpdateStep,
      onExecuted: (outcome) => {
        // 完成前自检：记录最后一次代码修改与最后一次验证命令所在的轮次。
        const modifiedPath = outcome.fileChange?.path ?? outcome.action.toolTarget;
        const modified = Boolean(outcome.fileChange) || outcome.call.name === "write_file" || outcome.call.name === "edit_file";
        if (outcome.executed && outcome.ok && modified && isCodePath(modifiedPath)) {
          verification.lastCodeEditIteration = iteration;
        }
        if (outcome.executed && outcome.command && isVerificationCommand(outcome.command)) {
          verification.lastVerificationIteration = iteration;
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
    pendingRepeatReminders.length = 0;

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
    state.lastRoundExecutedTools = act.executedToolCount > 0;
  }

  // 达到步数预算且无自动延长空间时执行收口总结。
  const fallback = await runFallbackConclusion({
    deps,
    params,
    conversation,
    systemMessage,
    updateSystemMessage: () => updateSystemMessage(),
    contextBudgetChars,
    iteration: state.iteration,
    progressTextLength: state.progressText.length,
    pushStep: pushOrUpdateStep,
    roundLimits,
    tracker,
    emitReasoning: (text) => {
      state.reasoning += text;
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
    progressText: state.progressText,
    reasoning: state.reasoning,
    steps,
    ...(lastModel ? { model: lastModel } : {}),
    ...(usage ? { usage } : {}),
    ...(cost ? { cost } : {}),
    metrics: tracker.buildMetrics(),
  };
}
