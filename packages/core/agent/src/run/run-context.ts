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
  /** 记录模型输出截断提示；下一轮作为尾部动态提示注入，不改写首条 system 前缀。 */
  setTruncationHint(hint: string): void;
  /** 仅返回本轮新增的动态尾部提示（权限变化、浏览器接管状态、预算告警或截断提示），确保首条 system 前缀全程冻结以保住 KV Cache。 */
  consumeTailHint(remainingSteps?: number): string;
  /** 兼容保留：首条 system 消息已在初始化时冻结，本方法不再改写前缀。 */
  updateSystemMessage(remainingSteps?: number): void;
}

/** 聊天入口开启时追加：让模型在最终答复末尾给出可点击的追问建议隐藏块。
    放在 extraSystemHint（系统消息末尾）而不是基础提示词开头，模型更容易在收尾时遵守。 */
const SUGGESTIONS_HINT = [
  "【追问建议（隐藏块）】",
  "在最终答复的最后另起一段，严格输出：<!--suggestions:[\"短句1\",\"短句2\",\"短句3\"]-->",
  "规则：",
  "1. 2–3 条，每条不超过 30 字，必须紧扣本轮回答的具体内容与下一步，不要泛泛问「你能做什么」；",
  "2. 第一人称、可直接作为下一条消息发送；优先指向回答里提到的文件、命令、数字、结论或尚未完成的事；",
  "3. 块内只放 JSON 数组，不要解释这个块，也不要在正文其它位置出现；工具调用的中间消息不要附加；",
  "4. 正文不要重复列出与隐藏块相同的建议，建议只出现在块内；",
  "5. 使用与用户相同的语言。",
  "示例：<!--suggestions:[\"把刚才的改动补一个回归测试\",\"继续修剩下的两个失败用例\"]-->",
].join("\n");

/** 装配一次运行的上下文：规则优先级 + 记忆召回 + 资料库摘要 + 短期裁剪历史 + 模型能力。 */
export async function createRunContext(input: {
  deps: RunLoopDeps;
  params: RunExecutionParams;
  state: LoopState;
}): Promise<RunContext> {
  const { deps, params, state } = input;
  const { systemPrompt, projectRuleNames, contextWindow, historyDigest, libraryHint, backgroundHint } = await recallAgentContext(deps, params);
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
  const baseExtraHint = [deps.extraSystemPrompt ? (await deps.extraSystemPrompt()).trim() : "", buildMediaHint(deps.tools), params.withSuggestions ? SUGGESTIONS_HINT : ""]
    .filter(Boolean).join("\n\n");
  const initialMode = params.getPermissionMode();
  const initialLiveHint = deps.dynamicSystemHint?.().trim() ?? "";
  const initialExtraHint = [baseExtraHint, initialLiveHint].filter(Boolean).join("\n\n");
  // 首条 system 消息在运行开始时一次性冻结渲染，运行中绝不原地改写，最大限度保住大模型 KV Prompt Cache 前缀命中率。
  const systemMessage: LlmMessage = {
    role: "system",
    content: renderSystemContent({
      systemPrompt,
      permissionHint: MODE_HINTS[initialMode],
      workspaceHint,
      modelHint,
      shellHint,
      libraryHint,
      backgroundHint,
      progressHint: `${FORMAT_HINT}\n${buildProgressHint(deps, params)}`,
      skillsCatalogHint: buildSkillsCatalogHint(params.availableSkillCatalog),
      skillsSection,
      // 动态 historyDigest 不再拼进首条 system 消息，保证跨轮 KV Prompt Cache 前缀稳定命中。
      historyDigest: "",
      truncationHint: "",
      extraSystemHint: initialExtraHint,
    }),
  };
  let truncationHint = "";
  let lastMode = initialMode;
  let lastLiveHint = initialLiveHint;
  let budgetStage = 0; // 0: 充足, 1: <=8 提醒过, 2: <=3 提醒过
  const consumeTailHint = (remainingSteps?: number): string => {
    const parts: string[] = [];
    const currentMode = params.getPermissionMode();
    if (currentMode !== lastMode) {
      lastMode = currentMode;
      parts.push(MODE_HINTS[currentMode]);
    }
    const currentLiveHint = deps.dynamicSystemHint?.().trim() ?? "";
    if (currentLiveHint !== lastLiveHint) {
      lastLiveHint = currentLiveHint;
      if (currentLiveHint) parts.push(currentLiveHint);
    }
    if (remainingSteps !== undefined) {
      if (remainingSteps <= 3 && budgetStage < 2) {
        budgetStage = 2;
        parts.push(`步数预算：本轮仅剩 ${remainingSteps} 次工具步数，请立即收口并交付当前已完成结果。`);
      } else if (remainingSteps <= 8 && budgetStage < 1) {
        budgetStage = 1;
        parts.push(`步数预算：本轮仅剩 ${remainingSteps} 次工具步数，已接近上限。请合并剩余检查并尽快收口。`);
      }
    }
    if (truncationHint) {
      parts.push(truncationHint.trim());
      truncationHint = "";
    }
    return parts.join("\n");
  };
  const updateSystemMessage = () => {};

  const conversation = buildRecentConversation(systemMessage, contextWindow, params.userMessage);
  if (historyDigest) {
    conversation.splice(1, 0, {
      role: "user",
      content: `【前序工具轨迹摘要（仅供参考，可直接复用避免重复探查）】\n${historyDigest}`,
    });
  }

  return {
    systemMessage,
    conversation,
    contextBudgetChars: Math.max(8_000, Math.floor(params.contextBudgetChars ?? DEFAULT_CONTEXT_BUDGET_CHARS)),
    tracker,
    roundLimits,
    setTruncationHint: (hint: string) => { truncationHint = hint; },
    consumeTailHint,
    updateSystemMessage,
  };
}