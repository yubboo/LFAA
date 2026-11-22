// 实现 Agent 核心任务循环：思考（Think）-> 行动（Act）-> 检查（Check）。
import { DEFAULT_CONTEXT_BUDGET_CHARS } from "@lfaa/context";
import { type LlmMessage } from "@lfaa/llm";
import type { AgentStepTrace } from "@lfaa/memory";
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
import { appendMediaPreviews, buildMediaHint } from "../context/agent-media";
import { runFallbackConclusion } from "./agent-fallback";
import { RunUsageTracker } from "./agent-usage";
import { renderSystemContent } from "./run-system";
import { clarificationTool } from "../context/clarification";
import { runThinkRound } from "./think-round";
import type { AgentRunResult, RunExecutionParams, RunLoopDeps } from "./run-types";
import { finishWithoutTools } from "./finish-round";
import { runToolRound } from "./act-round";
import { createLoopState, extendBudget, recordStep } from "./loop-state";
export type { RunExecutionParams, RunLoopDeps };

/** 顺序执行模型推理、工具审批和执行，最终把运行结果写回会话。 */
export async function executeAgentTaskLoop(
  deps: RunLoopDeps,
  params: RunExecutionParams,
): Promise<AgentRunResult> {
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

    // 无工具调用：交给收口模块；要求补验证时重来一轮。
    if (output.toolCalls.length === 0) {
      const outcome = finishWithoutTools({
        state, tracker, iteration, output, roundContent, conversation, steps, mediaPreviews, pushStep: pushOrUpdateStep,
      });
      if (outcome.kind === "retry") continue;
      return outcome.result;
    }

    await runToolRound({
      deps, params, state, tracker, iteration, output, roundContent, iterText, conversation,
      pushStep: pushOrUpdateStep,
    });
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
