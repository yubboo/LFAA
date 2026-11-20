// 实现 Agent 核心任务循环：思考（Think）-> 行动（Act）-> 检查（Check）。
import { compactConversation, DEFAULT_CONTEXT_BUDGET_CHARS, isContextOverflowError } from "@lfaa/context";
import { REPEAT_THRESHOLDS, RepeatCallTracker } from "@lfaa/guard";
import { type LlmGenerateOutput, type LlmMessage, type LlmUsage, resolveModelCapabilities, resolveReportedContextWindow } from "@lfaa/llm";
import { collectHistoryDigest, formatHistoryDigest, type AgentRunCost, type AgentRunMetrics, type AgentStepTrace, type UserClarification } from "@lfaa/memory";
import {
  computeTokenCost,
  estimateMessageTokens,
  estimateSystemPromptTokens,
  estimateToolsTokens,
  type TokenPricing,
} from "@lfaa/metrics";
import { runActPhase } from "./act-runner";
import { clarificationTool, readClarification } from "./clarification";
import { completeAgentRound, resolveModelRoundLimits } from "./model-round";
import type { RunExecutionParams, RunLoopDeps } from "./run-types";
import { MAX_STEP_BUDGET } from "./step-budget";
import { readStreamingPath } from "./tool-call-args";
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
  let lastModel: string | undefined;

  const pushOrUpdateStep = (update: AgentStepTrace) => {
    const idx = steps.findIndex((s) => s.id === update.id);
    const step = { ...update, startedAt: steps[idx]?.startedAt ?? update.startedAt ?? update.timestamp };
    if (idx >= 0) steps[idx] = step;
    else steps.push(step);
    params.emit({ type: "step_update", runId: params.runId, step });
  };

  // 1. 装配上下文：规则优先级 + 长期记忆召回 + 资料库/资产库摘要 + 短期裁剪历史
  const [memories, storageState, recentAssets] = params.enableMemoryContext === false ? [[], null, []] as const : await Promise.all([
    deps.memory.recallRelevantMemories({
      query: params.userMessage,
      ...(params.projectId !== undefined ? { projectId: params.projectId } : {}),
      limit: 6,
    }),
    deps.memory.getStorageState(),
    deps.memory.listLibraryAssets({
      ...(params.projectId !== undefined ? { projectId: params.projectId } : {}),
    }),
  ]);
  const memoryHints = memories.map((m) => `[${m.scope === "project" ? "项目记忆" : "全局记忆"}] ${m.content}`);
  const { systemPrompt, documents } = await deps.rules.composeSystemPrompt({
    projectPaths: params.workspaceRoots,
    memoryHints,
  });
  const contextWindow = await deps.memory.buildContextMessages(params.sessionId, {
    maxRecentMessages: 16,
    maxChars: 16000,
  });
  // 历史工具轨迹只保留一行式要点，避免模型为确认既有改动而重复读取文件。
  const historyDigest = formatHistoryDigest(collectHistoryDigest(contextWindow.recentMessages));

  const modeHints = {
    full: "当前权限模式：完全访问权限（内置文件工具不受工作区目录限制，但应用私有文件始终受保护；命令沿用系统用户权限）。",
    smart: "当前权限模式：帮我审批（内置文件工具仅可访问工作区；同类常规操作累计批准 3 次后自动放行，高危操作仍需确认）。",
    ask: "当前权限模式：请求批准（内置文件工具仅可访问工作区；每次修改文件或执行命令均需用户确认）。",
  };
  const projectRuleNames = documents.filter((doc) => doc.layer === "project").map((doc) => doc.source);
  const workspaceHint = [
    `会话工作位置：${params.projectId ? "已绑定项目" : "项目外聊天"}。`,
    `已授权目录：${params.workspaceRoots.join("、") || "无"}。`,
    `本轮加载的项目规则：${projectRuleNames.join("、") || "无"}。`,
    "以本轮生效上下文和工具清单为准；会话记录与其他应用配置不能证明当前权限。需要另一个项目时，请用户在新聊天选择该项目，或在既有聊天输入框使用 @项目。",
    "终端命令从工作目录启动，子进程当前没有 OS 路径隔离，必须遵守授权目录与操作审批；禁止读取 ~/.lfaa 下的配置、凭据与会话文件（会被拦截并记录审计）。",
  ].join("\n");

  const assetPreview = recentAssets.slice(0, 6).map((a) => `${a.title}(${a.fileName})`).join("、");
  const libraryHint = storageState ? `LFAA 资料库/资产库本地目录：${storageState.dataRoot}（当前已有 ${recentAssets.length} 项资产/产物${assetPreview ? `：${assetPreview}` : ""}）。你可通过 list_library_assets / read_library_asset 查看资料库内容，产出的报告、文档或成品请优先调用 save_library_artifact 存入资产库以便用户在「资料库」界面统一查看。` : "";
  const formatHint = "排版规范：列举 3 个及以上的目录、文件、配置项或路径时，严禁挤在一段长句括号里用顿号堆叠；请使用结构化列表（如 `- \`name/\`：说明`）、Markdown 表格或树形代码块展示，并将文件名与目录名用反引号 `` ` `` 包裹。";

  const skillsSection = params.resolvedSkills && params.resolvedSkills.length > 0
    ? `\n\n本轮显式选用的技能（仅本轮生效）：\n${params.resolvedSkills
        .map((s) => `### 技能：${s.name} (v${s.revision})\n${s.content}`)
        .join("\n\n")}`
    : "";

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

  const activeProfile = typeof deps.llm.resolveProfile === "function"
    ? await deps.llm.resolveProfile(params.profileId).catch(() => null)
    : null;
  const lastRoutedModel = [...contextWindow.recentMessages]
    .reverse()
    .find((m) => m.role === "assistant" && typeof m.model === "string" && m.model.trim())?.model;
  const modelHint = activeProfile
    ? `当前调用的模型配置：${activeProfile.name}（配置模型 ID：${activeProfile.model}${activeProfile.model === "ark-code-latest" ? "，方舟控制台动态路由" : ""}${lastRoutedModel && lastRoutedModel !== activeProfile.model ? `，前序响应实际路由模型：${lastRoutedModel}` : ""}）。当用户询问当前使用的模型时，请如实告知以上信息；若使用 ark-code-latest 且尚未收到本轮响应，可说明具体模型由方舟控制台路由决定。`
    : "";
  // 思考型模型允许更长的连续推理时限，普通模型沿用较短阈值。
  const modelCapability = activeProfile
    ? activeProfile.availableModels?.find((item) => item.id === activeProfile.model)
      ?? resolveModelCapabilities(activeProfile.model, activeProfile.kind)
    : undefined;
  const roundLimits = resolveModelRoundLimits({ supportsReasoning: modelCapability?.supportsReasoning === true });
  const buildMetrics = (): AgentRunMetrics => {
    const window = activeProfile && lastModel ? resolveReportedContextWindow(activeProfile, lastModel) : undefined;
    return {
      ...perf,
      context: contextSnapshot,
      ...(lastModel ? { contextModel: lastModel } : {}),
      ...(latestPromptTokens !== undefined ? { contextPromptTokens: latestPromptTokens } : {}),
      ...(window ? { contextWindowTokens: window.tokens, contextWindowSource: window.source } : {}),
      ...(cacheMeasurement.promptTokens > 0 ? { cacheMeasurement: { ...cacheMeasurement } } : {}),
    };
  };
  // 模型配置里填写了输入/输出单价时，按真实 token 用量换算人民币成本。
  const tokenPricing: TokenPricing | undefined = activeProfile
    && typeof activeProfile.inputPricePerMillion === "number"
    && typeof activeProfile.outputPricePerMillion === "number"
    ? {
        inputPricePerMillion: activeProfile.inputPricePerMillion,
        outputPricePerMillion: activeProfile.outputPricePerMillion,
        ...(typeof activeProfile.cachedInputPricePerMillion === "number"
          ? { cachedInputPricePerMillion: activeProfile.cachedInputPricePerMillion }
          : {}),
      }
    : undefined;
  // 每轮模型/工具结束后推送累计用量，浏览器统计栏随之实时变化。
  const emitUsage = () => {
    if (!hasUsage) return;
    const cost = computeTokenCost(usage, tokenPricing);
    params.emit({
      type: "run_usage",
      runId: params.runId,
      tokenUsage: { ...usage },
      metrics: buildMetrics(),
      ...(cost ? { cost } : {}),
    });
  };

  const skillsCatalogHint = params.availableSkillCatalog && params.availableSkillCatalog.length > 0
    ? `\n\n可用技能目录（当任务命中某个技能的适用场景时，请先调用 load_skill 读取完整正文再按规范执行；若用户要求从 Git 安装技能请调用 install_skill_from_git；若用户要求创建个人技能请调用 save_user_skill 存入 ~/.lfaa/skills/）：\n${params.availableSkillCatalog
        .slice(0, 30)
        .map((s) => `- ${s.name} (id: ${s.id}, 来源: ${s.source})${s.description ? `：${s.description}` : ""}`)
        .join("\n")}`
    : "";

  const progressHint = [
    params.enableClarification
      ? "需求澄清：若目标、操作对象或交付范围有多种合理解释，且会改变实施方向，先用 ask_user 提一个关键问题，必要时给出 2–4 个选项，并等待下一条用户消息；本轮不要同时修改文件、执行命令或委派。简短问候、明确请求和可安全从上下文确认的细节无需提问。"
      : "",
    "较大的代码变更分成有明确文件落点的小批次。已有工具结果足以行动时，直接发出下一项必要调用。可见进度只说实际完成、正在处理的目标或当前阻塞。",
    "多步任务的进度写入用户可见的正文。首次调用工具前，简短交代准备核查或执行的事项；得到实际结果、发现异常或进入下一阶段时，再说明进展和接下来的动作。连续的小操作可共用一段，直接问答无需播报。命令和工具详情由运行时展示。",
    deps.tools.getTool("invoke_subagent")
      ? "多智能体协作：用户明确要求委派，或任务存在可独立并行的调研、实现或验证时，用 invoke_subagent 设 wait=false 派发，并用 list_subagents 的 waitForIds 收集结果再汇总。无独立分工的简单任务直接完成。子任务失败时如实说明。"
      : "",
    "自主排查与编辑准则：定位问题时先用 grep（正则内容）/ glob（文件名模式）/ list_dir / read_file 检索并精读关键源码上下文再动手；修改代码或修复报错时，直接调用 edit_file / write_file 落实修改并立即通过 run_command 验证，遇到新报错继续读取对应行并修正闭环，不得停在只给建议或让用户手动改代码。edit_file 的 target 必须在文件中唯一命中，命中多处时请补充上下文行或显式传 replaceAll；新建文件用 write_file。",
    "工具效率与核验规范：创建或读取多个互相独立的文件时，请在同轮并行发起多个 read_file / write_file / edit_file 调用，避免逐个文件串行消耗步数；执行构建/测试请直接用 run_command 验证，不可将“静态自审”等价于编译或运行通过；前台命令默认 10 分钟超时，构建、安装等长命令可传 timeoutMs，服务器或监听类命令请用 start_background_task 启动并用 get_background_task 轮询；向用户提供复现命令时，必须严格匹配当前终端语法（CMD 用 `set \"VAR=...\"`，PowerShell 用 `$env:VAR=\"...\"`），严禁混写。",
    "长期记忆：当用户明确陈述跨会话仍需记住的偏好、约定或项目约束（如“以后统一用 pnpm”“这个项目不要改 X”），调用 save_memory 保存，一次只记一条可独立复述的事实；临时进度与本次任务的中间结果不要写入长期记忆。",
  ].join("\n");
  const shellHint = deps.tools.getTool("run_command") ? await deps.tools.describeCommandShell() : "";
  const systemMessage: LlmMessage = { role: "system", content: "" };
  const updateSystemMessage = (remainingSteps?: number) => {
    // 步数只在接近上限时才写进 system，避免每轮改动前缀、让提示缓存整段失效。
    const budgetHint = remainingSteps !== undefined && remainingSteps <= 8
      ? `\n步数预算：本轮仅剩 ${remainingSteps} 次工具步数，已接近上限。请先完成关键动作并收口；任务仍大时先交付可运行的一小步。`
      : "";
    const digestHint = historyDigest ? `\n前序工具轨迹（来自历史步骤，可直接复用，无需重复探查）：${historyDigest}` : "";
    systemMessage.content = `${systemPrompt}\n\n${modeHints[params.getPermissionMode()]}\n${workspaceHint}\n${modelHint ? `${modelHint}\n` : ""}${shellHint ? `${shellHint}\n` : ""}${libraryHint}\n${formatHint}\n${progressHint}${skillsCatalogHint}${skillsSection}${digestHint}${budgetHint}${truncationHint}`;
  };
  const conversation: LlmMessage[] = [systemMessage];
  if (contextWindow.summaryNote) {
    conversation.push({ role: "system", content: `前序会话摘要：${contextWindow.summaryNote}` });
  }
  for (const msg of contextWindow.recentMessages) {
    if (msg.status === "streaming" || (msg.role === "assistant" && !msg.content.trim())) continue;
    conversation.push({ role: msg.role, content: msg.content });
  }
  if (!contextWindow.recentMessages.some((m) => m.role === "user" && m.content === params.userMessage)) {
    conversation.push({ role: "user", content: params.userMessage });
  }

  let llmTools = deps.tools.getLlmToolSchemas();
  const contextBudgetChars = Math.max(8_000, Math.floor(params.contextBudgetChars ?? DEFAULT_CONTEXT_BUDGET_CHARS));
  let overflowRetried = false;
  let truncationHint = "";
  // 汇总每轮供应商返回的用量，运行结束后随消息持久化，供界面与成本核算使用。
  const usage: LlmUsage = {};
  let hasUsage = false;
  let latestPromptTokens: number | undefined;
  const cacheMeasurement = { promptTokens: 0, cachedTokens: 0 };
  // 会话统计：模型/工具耗时、首 token 延迟、解码耗时与上下文构成。
  const perf = { llmMs: 0, toolMs: 0, ttftMs: 0, ttftSteps: 0, decodeMs: 0, decodeTokens: 0 };
  let contextSnapshot: { systemTokens: number; toolsTokens: number; messageTokens: number } = {
    systemTokens: 0,
    toolsTokens: 0,
    messageTokens: 0,
  };
  const addUsage = ({ usage: roundUsage, model }: LlmGenerateOutput) => {
    lastModel = model;
    latestPromptTokens = roundUsage?.promptTokens;
    if (!roundUsage) return;
    hasUsage = true;
    const total = roundUsage.totalTokens ?? (roundUsage.promptTokens !== undefined && roundUsage.completionTokens !== undefined
      ? roundUsage.promptTokens + roundUsage.completionTokens : undefined);
    for (const key of ["promptTokens", "completionTokens", "totalTokens", "cachedPromptTokens"] as const) {
      const value = key === "totalTokens" ? total : roundUsage[key];
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) usage[key] = (usage[key] ?? 0) + value;
    }
    if (roundUsage.promptTokens !== undefined && roundUsage.cachedPromptTokens !== undefined
      && Number.isSafeInteger(roundUsage.promptTokens) && Number.isSafeInteger(roundUsage.cachedPromptTokens)
      && roundUsage.cachedPromptTokens >= 0 && roundUsage.cachedPromptTokens <= roundUsage.promptTokens) {
      cacheMeasurement.promptTokens += roundUsage.promptTokens;
      cacheMeasurement.cachedTokens += roundUsage.cachedPromptTokens;
    }
  };

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
    llmTools = deps.tools.getLlmToolSchemas();
    if (params.enableClarification) llmTools = [...llmTools, clarificationTool];
    const roundStartedAt = Date.now();
    let firstTokenAt: number | undefined;
    updateSystemMessage(Math.max(0, budget - iteration + 1));
    // 发送前按预算压缩：保留结构与最近轮次，早期工具结果压成尾部片段。
    const compaction = compactConversation(conversation, { budgetChars: contextBudgetChars });
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
    // 记录本轮实际发送的上下文构成，估算口径与 DSH token-meter 对齐。
    contextSnapshot = {
      systemTokens: estimateSystemPromptTokens(systemMessage.content),
      toolsTokens: estimateToolsTokens(llmTools),
      messageTokens: conversation.reduce(
        (sum, message) => (message.role === "system" ? sum : sum + estimateMessageTokens(message)),
        0,
      ),
    };
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
      const forced = compactConversation(conversation, {
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
    addUsage(output);
    // 模型轮次耗时与首 token 延迟：解码吞吐只按首 token 之后的时间计算。
    const roundEndedAt = Date.now();
    perf.llmMs += roundEndedAt - roundStartedAt;
    if (firstTokenAt !== undefined) {
      perf.ttftMs += firstTokenAt - roundStartedAt;
      perf.ttftSteps += 1;
      perf.decodeMs += roundEndedAt - firstTokenAt;
      perf.decodeTokens += output.usage?.completionTokens ?? 0;
    }
    emitUsage();
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
      const clarification = readClarification(clarificationCall.argumentsJson);
      const content = clarification
        ? [clarification.question, ...clarification.options.map((option) => `- ${option}`)].join("\n")
        : "请补充你想实现的目标和希望我处理的范围。";
      // 同批的修改类工具都不执行，用户回答后以新一轮运行继续。
      for (const preparation of preparing.values()) {
        pushOrUpdateStep({ ...preparation, status: preparation.toolName === clarificationTool.name ? "done" : "error",
          detail: preparation.toolName === clarificationTool.name ? content : "等待用户澄清，本次调用未执行。", timestamp: Date.now() });
      }
      const cost = computeTokenCost(usage, tokenPricing);
      return { content, progressText: progressText + iterText, reasoning: accumulatedReasoning, steps, model: output.model,
        ...(hasUsage ? { usage } : {}), ...(cost ? { cost } : {}), metrics: buildMetrics(),
        clarification: clarification ?? { question: content, options: [] } };
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
      const cost = computeTokenCost(usage, tokenPricing);
      return {
        content: finalContent || "模型返回了空内容，未能生成有效答复。",
        progressText,
        reasoning: accumulatedReasoning,
        steps,
        model: output.model,
        ...(hasUsage ? { usage } : {}),
        ...(cost ? { cost } : {}),
        metrics: buildMetrics(),
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
    perf.toolMs += act.toolMs;
    emitUsage();
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

  // 达到步数预算且无自动延长空间时执行收口总结
  const fallbackStep: AgentStepTrace = {
    textOffset: progressText.length,
    id: "think-final",
    iteration,
    phase: "think",
    status: "running",
    title: "生成运行总结",
    timestamp: Date.now(),
  };
  pushOrUpdateStep(fallbackStep);
  let fallbackText = "";
  let fallbackStage: AgentStepTrace["modelStage"];
  let lastFallbackActivity = fallbackStep.timestamp;
  const noteFallbackStage = (stage = fallbackStage) => {
    const now = Date.now();
    if (fallbackStage === stage && now - lastFallbackActivity < 4_000) return;
    lastFallbackActivity = now;
    fallbackStage = stage;
    pushOrUpdateStep({ ...fallbackStep, ...(fallbackStage ? { modelStage: fallbackStage } : {}), timestamp: now });
  };
  // 收口总结前再压缩一次，避免追加提示后刚好越过上下文上限。
  const fallbackCompaction = compactConversation(conversation, { budgetChars: contextBudgetChars });
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
        accumulatedReasoning += delta.text;
        params.emit({ type: "delta", runId: params.runId, seq: 0, kind: "reasoning", text: delta.text });
      } else if (delta.type === "text" && delta.text) {
        fallbackFirstTokenAt ??= Date.now();
        noteFallbackStage("replying");
        fallbackText += delta.text;
        params.emit({ type: "delta", runId: params.runId, seq: 0, kind: "text", text: delta.text });
      }
    },
  }, roundLimits);
  const fallbackEndedAt = Date.now();
  perf.llmMs += fallbackEndedAt - fallbackStartedAt;
  if (fallbackFirstTokenAt !== undefined) {
    perf.ttftMs += fallbackFirstTokenAt - fallbackStartedAt;
    perf.ttftSteps += 1;
    perf.decodeMs += fallbackEndedAt - fallbackFirstTokenAt;
    perf.decodeTokens += fallback.usage?.completionTokens ?? 0;
  }
  const finalContent = (fallback.content || fallbackText).trim() || "已达到单轮最大步数上限，请根据步骤轨迹继续指令。";
  addUsage(fallback);
  emitUsage();
  if (!fallbackText) {
    pushOrUpdateStep({ ...fallbackStep, modelStage: "replying", timestamp: Date.now() });
    params.emit({ type: "delta", runId: params.runId, seq: 0, kind: "text", text: finalContent });
  }
  pushOrUpdateStep({ ...fallbackStep, status: "done", timestamp: Date.now() });
  const cost = computeTokenCost(usage, tokenPricing);
  return {
    content: finalContent,
    progressText,
    reasoning: accumulatedReasoning,
    steps,
    model: fallback.model ?? lastModel,
    ...(hasUsage ? { usage } : {}),
    ...(cost ? { cost } : {}),
    metrics: buildMetrics(),
  };
}
