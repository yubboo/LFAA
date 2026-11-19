// 实现 Agent 核心任务循环：思考（Think）-> 行动（Act）-> 检查（Check）。
import { randomUUID } from "node:crypto";
import type { LlmMessage, LlmService, LlmToolCall } from "@lfaa/llm";
import type { AgentStepTrace, MemoryService } from "@lfaa/memory";
import type { RulesService } from "@lfaa/rules";
import type { ToolsService } from "@lfaa/tools";
import { evaluateToolApproval, type SmartTrustStore } from "./permission-policy";
import type { AgentPermissionMode, AgentRunEvent, ApprovalAnswer, ResolvedSkillContext } from "./types";
import { completeAgentRound } from "./model-round";

/** 集中提供模型调用、工具执行、事件与持久化依赖，使循环可在测试中独立验证。 */
export interface RunLoopDeps {
  llm: LlmService;
  tools: ToolsService;
  memory: MemoryService;
  rules: RulesService;
  trustStore: SmartTrustStore;
}

/** 描述启动一次运行所需的会话信息与工具权限上下文。 */
export interface RunExecutionParams {
  runId: string;
  sessionId: string;
  assistantMessageId: string;
  userMessage: string;
  profileId?: string;
  reasoningEffort?: "minimal" | "low" | "medium" | "high" | "max";
  projectId?: string | null;
  workspaceRoots: string[];
  resolvedSkills?: ResolvedSkillContext[];
  availableSkillCatalog?: Array<{ id: string; name: string; source: string; description: string }>;
  maxSteps: number;
  getPermissionMode: () => AgentPermissionMode;
  signal: AbortSignal;
  emit: (event: AgentRunEvent) => void;
  requestApproval: (params: {
    approvalId: string;
    toolName: string;
    permissionLevel: "write" | "exec";
    argsPreview: string;
    permissionMode: AgentPermissionMode;
    approvalPattern?: string;
    approvalCount?: number;
    approvalThreshold?: number;
    highRisk?: boolean;
    riskReason?: string;
  }) => Promise<ApprovalAnswer>;
}

function safeParseArgs(raw: string): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  try {
    const parsed: unknown = JSON.parse(raw || "{}");
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { ok: false, error: "工具参数必须为 JSON 对象。" };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch (err) {
    return { ok: false, error: `工具参数 JSON 解析失败：${err instanceof Error ? err.message : String(err)}` };
  }
}

// 参数流可能还没结束。只识别已闭合的首个 path 字段，不发布其余参数。
function readStreamingPath(prefix: string): string | undefined {
  const quoted = /^\s*\{\s*"path"\s*:\s*("(?:\\.|[^"\\])*")/u.exec(prefix)?.[1];
  if (!quoted) return undefined;
  const parsed = safeParseArgs('{"path":' + quoted + '}');
  return parsed.ok && typeof parsed.value.path === "string" ? parsed.value.path.slice(0, 500) : undefined;
}

/** 顺序执行模型推理、工具审批和执行，最终把运行结果写回会话。 */
export async function executeAgentTaskLoop(
  deps: RunLoopDeps,
  params: RunExecutionParams,
): Promise<{ content: string; progressText: string; reasoning: string; steps: AgentStepTrace[]; model?: string }> {
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
  const [memories, storageState, recentAssets] = await Promise.all([
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
    "终端命令从工作目录启动，子进程当前没有 OS 路径隔离，必须遵守授权目录与操作审批。",
  ].join("\n");

  const assetPreview = recentAssets.slice(0, 6).map((a) => `${a.title}(${a.fileName})`).join("、");
  const libraryHint = `LFAA 资料库/资产库本地目录：${storageState.dataRoot}（当前已有 ${recentAssets.length} 项资产/产物${assetPreview ? `：${assetPreview}` : ""}）。你可通过 list_library_assets / read_library_asset 查看资料库内容，产出的报告、文档或成品请优先调用 save_library_artifact 存入资产库以便用户在「资料库」界面统一查看。`;
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

  const skillsCatalogHint = params.availableSkillCatalog && params.availableSkillCatalog.length > 0
    ? `\n\n可用技能目录（当任务命中某个技能的适用场景时，请先调用 load_skill 读取完整正文再按规范执行；若用户要求从 Git 安装技能请调用 install_skill_from_git；若用户要求创建个人技能请调用 save_user_skill 存入 ~/.lfaa/skills/）：\n${params.availableSkillCatalog
        .slice(0, 30)
        .map((s) => `- ${s.name} (id: ${s.id}, 来源: ${s.source})${s.description ? `：${s.description}` : ""}`)
        .join("\n")}`
    : "";

  const progressHint = [
    "较大的代码变更分成有明确文件落点的小批次。已有工具结果足以行动时，直接发出下一项必要调用。可见进度只说实际完成、正在处理的目标或当前阻塞。",
    "多步任务的进度写入用户可见的正文。首次调用工具前，简短交代准备核查或执行的事项；得到实际结果、发现异常或进入下一阶段时，再说明进展和接下来的动作。连续的小操作可共用一段，直接问答无需播报。命令和工具详情由运行时展示。",
    "自主排查与编辑准则：定位问题时先用 search_files / list_dir / read_file 检索并精读关键源码上下文再动手；需要修改代码或修复报错时，直接调用 edit_file / write_file 落实修改并立即通过 run_command 验证，遇到新报错继续读取对应行并修正闭环，不得停在只给建议或让用户手动改代码。",
    "工具效率与核验规范：创建或读取多个互相独立的文件时，请在同轮并行发起多个 read_file / write_file / edit_file 调用，避免逐个文件串行消耗步数；执行构建/测试请直接用 run_command 验证，不可将“静态自审”等价于编译或运行通过；向用户提供复现命令时，必须严格匹配当前终端语法（CMD 用 `set \"VAR=...\"`，PowerShell 用 `$env:VAR=\"...\"`），严禁混写。",
  ].join("\n");
  const shellHint = await deps.tools.describeCommandShell();
  const systemMessage: LlmMessage = { role: "system", content: "" };
  const updateSystemMessage = () => {
    systemMessage.content = `${systemPrompt}\n\n${modeHints[params.getPermissionMode()]}\n${workspaceHint}\n${modelHint ? `${modelHint}\n` : ""}${shellHint ? `${shellHint}\n` : ""}${libraryHint}\n${formatHint}\n${progressHint}${skillsCatalogHint}${skillsSection}`;
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

  const llmTools = deps.tools.getLlmToolSchemas();

  // 2. Think -> Act -> Check 任务循环
  for (let iteration = 1; iteration <= params.maxSteps; iteration += 1) {
    if (params.signal.aborted) throw new Error("用户已中止本次任务。");

    const thinkStepId = `think-${iteration}`;
    const thinkStep: AgentStepTrace = {
      id: thinkStepId,
      iteration,
      phase: "think",
      status: "running",
      title: `第 ${iteration} 轮思考：规划与决策`,
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
    updateSystemMessage();
    const output = await completeAgentRound(deps.llm, {
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
    });
    lastModel = output.model;
    const roundContent = output.content || iterText;
    // 非流式适配器也在工具之前交付正文，偏移始终使用实际发出的前缀。
    if (!iterText && roundContent) {
      iterText = roundContent;
      pushOrUpdateStep({ ...thinkStep, modelStage: "replying", timestamp: Date.now() });
      params.emit({ type: "delta", runId: params.runId, seq: 0, kind: "text", text: iterText });
    }

    const thinkDetail = output.reasoningContent?.slice(0, 240);
    pushOrUpdateStep({
      id: thinkStepId,
      iteration,
      phase: "think",
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

    // 无工具调用：执行终结检查后完成闭环
    if (output.toolCalls.length === 0) {
      const finalContent = roundContent.trim();
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
      return {
        content: finalContent || "模型返回了空内容，未能生成有效答复。",
        progressText,
        reasoning: accumulatedReasoning,
        steps,
        model: lastModel,
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

    // Act 阶段：逐项校验并执行工具调用
    let failureCount = 0;
    const actSummaries: string[] = [];

    for (const call of output.toolCalls) {
      if (params.signal.aborted) throw new Error("用户已中止本次任务。");
      const actStepId = `act-${iteration}-${call.id}`;
      const argsPreview = (call.argumentsJson || "{}").slice(0, 200);
      const toolDef = deps.tools.getTool(call.name);
      const perm = toolDef?.permissionLevel ?? "read";

      const parsedArgs = safeParseArgs(call.argumentsJson);
      const command = call.name === "run_command" && parsedArgs.ok && typeof parsedArgs.value.command === "string"
        ? parsedArgs.value.command.trim().slice(0, 16000)
        : "";
      const action: AgentStepTrace = {
        id: actStepId,
        iteration,
        phase: "act",
        status: "running",
        title: `行动：调用 ${call.name}`,
        toolCallId: call.id,
        toolName: call.name,
        permissionLevel: perm,
        argsPreview,
        ...(parsedArgs.ok && typeof parsedArgs.value.path === "string"
          ? { toolTarget: parsedArgs.value.path.slice(0, 500) } : {}),
        textOffset: roundTextOffset,
        ...(command ? { commandTrace: { command } } : {}),
        timestamp: Date.now(),
      };

      let toolOutputText = "";
      let stepOk = false;
      let summaryText = "";
      let addedLines: number | undefined;
      let removedLines: number | undefined;
      let exitCode: number | undefined;
      let fileChange: AgentStepTrace["fileChange"];

      if (!parsedArgs.ok) {
        toolOutputText = parsedArgs.error;
        summaryText = "参数格式错误";
      } else {
        let permitted = true;
        let autoApprovalDetail = "";
        while (toolDef && perm !== "read") {
          params.signal.throwIfAborted();
          const mode = params.getPermissionMode();
          const currentCount = mode === "smart"
            ? await deps.trustStore.getCount(
              evaluateToolApproval({
                mode: "smart",
                permissionLevel: perm,
                toolName: call.name,
                args: parsedArgs.value,
                approvedCount: 0,
              }).pattern,
            )
            : 0;
          if (params.getPermissionMode() !== mode) continue;
          const decision = evaluateToolApproval({
            mode,
            permissionLevel: perm,
            toolName: call.name,
            args: parsedArgs.value,
            approvedCount: currentCount,
          });

          if (decision.requiresApproval) {
            const approvalId = randomUUID();
            pushOrUpdateStep({
              ...action,
              status: "waiting_approval",
              title: `等待确认：${toolDef.title} (${call.name})`,
              ...(decision.reason ? { detail: decision.reason } : {}),
              timestamp: Date.now(),
            });
            const answer = await params.requestApproval({
              approvalId,
              toolName: call.name,
              permissionLevel: perm,
              argsPreview,
              permissionMode: mode,
              approvalPattern: decision.pattern,
              ...(decision.approvalCount !== undefined ? { approvalCount: decision.approvalCount } : {}),
              ...(decision.approvalThreshold !== undefined ? { approvalThreshold: decision.approvalThreshold } : {}),
              highRisk: decision.highRisk,
              ...(decision.reason ? { riskReason: decision.reason } : {}),
            });
            if (answer === "mode_changed") continue;
            permitted = answer;
            if (mode === "smart") {
              await deps.trustStore.recordDecision(decision.pattern, permitted, decision.highRisk);
            }
          } else if (decision.autoApproved && decision.reason) {
            autoApprovalDetail = decision.reason;
          }
          break;
        }

        if (!permitted) {
          toolOutputText = "用户拒绝执行此修改/命令工具，请改用只读核查或向用户说明替代方案。";
          summaryText = "用户已拒绝";
        } else {
          pushOrUpdateStep({ ...action, timestamp: Date.now() });
          const execRes = await deps.tools.executeTool(call.name, parsedArgs.value, {
            workspaceRoots: params.workspaceRoots,
            sessionId: params.sessionId,
            runId: params.runId,
            signal: params.signal,
            allowOutsideWorkspace: params.getPermissionMode() === "full",
            ...(command ? { onCommandOutput: (output: string) => pushOrUpdateStep({
              ...action, commandTrace: { command, output }, timestamp: Date.now(),
            }) } : {}),
          });
          stepOk = execRes.ok;
          toolOutputText = execRes.output;
          summaryText = autoApprovalDetail ? `${execRes.summary} · ${autoApprovalDetail}` : execRes.summary;
          if (typeof execRes.metadata?.added === "number") addedLines = execRes.metadata.added;
          if (typeof execRes.metadata?.removed === "number") removedLines = execRes.metadata.removed;
          if (typeof execRes.metadata?.exitCode === "number") exitCode = execRes.metadata.exitCode;
          if (execRes.ok) fileChange = execRes.fileChange;
        }
      }

      if (!stepOk) failureCount += 1;
      actSummaries.push(`${call.name}: ${summaryText}`);

      pushOrUpdateStep({
        ...action,
        status: stepOk ? "done" : "error",
        title: `行动：${call.name} (${summaryText})`,
        resultPreview: toolOutputText.slice(0, 240),
        ...(command ? { commandTrace: {
          command,
          output: toolOutputText.slice(0, 16000),
          ...(exitCode === undefined ? {} : { exitCode }),
        } } : {}),
        ...(addedLines !== undefined ? { addedLines } : {}),
        ...(removedLines !== undefined ? { removedLines } : {}),
        ...(fileChange ? { fileChange } : {}),
        timestamp: Date.now(),
      });

      conversation.push({
        role: "tool",
        toolCallId: call.id,
        name: call.name,
        content: toolOutputText,
      });
    }

    // Check 阶段：评估行动结果并驱动下一轮思考
    const checkStepId = `check-${iteration}`;
    pushOrUpdateStep({
      id: checkStepId,
      iteration,
      phase: "check",
      status: failureCount > 0 ? "error" : "done",
      title: failureCount > 0
        ? `第 ${iteration} 轮检查：${failureCount}/${output.toolCalls.length} 项执行异常，反馈模型调整`
        : `第 ${iteration} 轮检查：工具观察已回收，继续推进判断`,
      detail: actSummaries.join("；"),
      timestamp: Date.now(),
    });
  }

  // 达到最大步数保护时执行收口总结
  const fallbackStep: AgentStepTrace = {
    id: "think-final",
    iteration: params.maxSteps + 1,
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
  updateSystemMessage();
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
        noteFallbackStage("reasoning");
        accumulatedReasoning += delta.text;
        params.emit({ type: "delta", runId: params.runId, seq: 0, kind: "reasoning", text: delta.text });
      } else if (delta.type === "text" && delta.text) {
        noteFallbackStage("replying");
        fallbackText += delta.text;
        params.emit({ type: "delta", runId: params.runId, seq: 0, kind: "text", text: delta.text });
      }
    },
  });
  const finalContent = (fallback.content || fallbackText).trim() || "已达到单轮最大步数上限，请根据步骤轨迹继续指令。";
  if (!fallbackText) {
    pushOrUpdateStep({ ...fallbackStep, modelStage: "replying", timestamp: Date.now() });
    params.emit({ type: "delta", runId: params.runId, seq: 0, kind: "text", text: finalContent });
  }
  pushOrUpdateStep({ ...fallbackStep, status: "done", timestamp: Date.now() });
  return { content: finalContent, progressText, reasoning: accumulatedReasoning, steps, model: fallback.model ?? lastModel };
}
