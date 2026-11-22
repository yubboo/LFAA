// 运行上下文装配：召回规则/记忆/资料库，拼装工作区与技能提示，创建用量跟踪、系统消息与初始对话。
// 从 executeAgentTaskLoop 拆出：循环体只保留编排，系统消息重渲染与截断提示也统一收在这里。
import { DEFAULT_CONTEXT_BUDGET_CHARS } from "@lfaa/context";
import type { LlmMessage } from "@lfaa/llm";
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
import { buildMediaHint } from "../context/agent-media";
import { RunUsageTracker } from "./agent-usage";
import { recordStep, type LoopState } from "./loop-state";
import { renderSystemContent } from "./run-system";
import type { RunExecutionParams, RunLoopDeps } from "./run-types";

/** 一次运行共享的上下文：系统消息可重渲染，对话数组会被压缩与插话原地修改。 */
export interface RunContext {
  readonly systemMessage: LlmMessage;
  readonly conversation: LlmMessage[];
  readonly contextBudgetChars: number;
  readonly tracker: RunUsageTracker;
  readonly roundLimits: Awaited<ReturnType<typeof resolveModelContext>>["roundLimits"];
  /** 记录模型输出截断提示；下一轮渲染系统消息时生效。 */
  setTruncationHint(hint: string): void;
  /** 按最新状态重渲染系统消息；remainingSteps 用于写入剩余步数提示。 */
  updateSystemMessage(remainingSteps?: number): void;
}

/** 装配一次运行的上下文：规则优先级 + 记忆召回 + 资料库摘要 + 短期裁剪历史 + 模型能力。 */
export async function createRunContext(input: {
  deps: RunLoopDeps;
  params: RunExecutionParams;
  state: LoopState;
}): Promise<RunContext> {
  const { deps, params, state } = input;
  const { systemPrompt, projectRuleNames, contextWindow, historyDigest, libraryHint } = await recallAgentContext(deps, params);
  const workspaceHint = [
    buildWorkspaceHint(params.projectId, params.workspaceRoots, projectRuleNames, params.worktree),
    params.projectScope ? buildProjectScopeHint(params.projectScope) : "",
  ].filter(Boolean).join("\n\n");
  const skillsSection = buildSkillsSection(params.resolvedSkills);
  if (params.resolvedSkills && params.resolvedSkills.length > 0) {
    recordStep(state, params, {
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
      libraryHint, progressHint: `${FORMAT_HINT}\n${buildProgressHint(deps, params)}`,
      skillsCatalogHint: buildSkillsCatalogHint(params.availableSkillCatalog), skillsSection,
      historyDigest, ...(remainingSteps !== undefined ? { remainingSteps } : {}), truncationHint, extraSystemHint,
    });
  };

  return {
    systemMessage,
    conversation: buildRecentConversation(systemMessage, contextWindow, params.userMessage),
    contextBudgetChars: Math.max(8_000, Math.floor(params.contextBudgetChars ?? DEFAULT_CONTEXT_BUDGET_CHARS)),
    tracker,
    roundLimits,
    setTruncationHint: (hint: string) => { truncationHint = hint; },
    updateSystemMessage,
  };
}