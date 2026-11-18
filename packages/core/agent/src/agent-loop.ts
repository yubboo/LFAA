// 实现 Agent 核心任务循环：思考（Think）-> 行动（Act）-> 检查（Check）。
import { randomUUID } from "node:crypto";
import type { LlmMessage, LlmService, LlmToolCall } from "@lfaa/llm";
import type { AgentStepTrace, MemoryService } from "@lfaa/memory";
import type { RulesService } from "@lfaa/rules";
import type { ToolsService } from "@lfaa/tools";
import { evaluateToolApproval, type SmartTrustStore } from "./permission-policy";
import type { AgentPermissionMode, AgentRunEvent } from "./types";

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
  maxSteps: number;
  permissionMode: AgentPermissionMode;
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
  }) => Promise<boolean>;
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

/** 顺序执行模型推理、工具审批和执行，最终把运行结果写回会话。 */
export async function executeAgentTaskLoop(
  deps: RunLoopDeps,
  params: RunExecutionParams,
): Promise<{ content: string; reasoning: string; steps: AgentStepTrace[]; model?: string }> {
  const steps: AgentStepTrace[] = [];
  let accumulatedReasoning = "";
  let finalContent = "";
  let lastModel: string | undefined;

  const pushOrUpdateStep = (step: AgentStepTrace) => {
    const idx = steps.findIndex((s) => s.id === step.id);
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
  const { systemPrompt } = await deps.rules.composeSystemPrompt({
    projectPaths: params.workspaceRoots,
    memoryHints,
  });
  const contextWindow = await deps.memory.buildContextMessages(params.sessionId, {
    maxRecentMessages: 16,
    maxChars: 16000,
  });

  const modeHint = params.permissionMode === "full"
    ? "当前权限模式：完全访问权限（可不受工作区目录限制读写文件并自动执行命令）。"
    : params.permissionMode === "smart"
      ? "当前权限模式：帮我审批（受工作区沙箱限制；同类常规操作累计批准 3 次后自动放行，高危操作仍需确认）。"
      : "当前权限模式：请求批准（受工作区沙箱限制；每次修改文件或执行命令均需用户确认）。";

  const assetPreview = recentAssets.slice(0, 6).map((a) => `${a.title}(${a.fileName})`).join("、");
  const libraryHint = `LFAA 资料库/资产库本地目录：${storageState.dataRoot}（当前已有 ${recentAssets.length} 项资产/产物${assetPreview ? `：${assetPreview}` : ""}）。你可通过 list_library_assets / read_library_asset 查看资料库内容，产出的报告、文档或成品请优先调用 save_library_artifact 存入资产库以便用户在「资料库」界面统一查看。`;
  const formatHint = "排版规范：列举 3 个及以上的目录、文件、配置项或路径时，严禁挤在一段长句括号里用顿号堆叠；请使用结构化列表（如 `- \`name/\`：说明`）、Markdown 表格或树形代码块展示，并将文件名与目录名用反引号 `` ` `` 包裹。";

  const conversation: LlmMessage[] = [{ role: "system", content: `${systemPrompt}\n\n${modeHint}\n${libraryHint}\n${formatHint}` }];
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
    pushOrUpdateStep({
      id: thinkStepId,
      iteration,
      phase: "think",
      status: "running",
      title: `第 ${iteration} 轮思考：规划与决策`,
      timestamp: Date.now(),
    });

    let iterText = "";
    const output = await deps.llm.complete({
      ...(params.profileId !== undefined ? { profileId: params.profileId } : {}),
      ...(params.reasoningEffort !== undefined ? { reasoningEffort: params.reasoningEffort } : {}),
      messages: conversation,
      tools: llmTools,
      signal: params.signal,
      onDelta: (delta) => {
        if (delta.type === "reasoning" && delta.text) {
          accumulatedReasoning += delta.text;
          params.emit({ type: "delta", runId: params.runId, seq: 0, kind: "reasoning", text: delta.text });
        } else if (delta.type === "text" && delta.text) {
          iterText += delta.text;
          params.emit({ type: "delta", runId: params.runId, seq: 0, kind: "text", text: delta.text });
        }
      },
    });
    lastModel = output.model;
    const roundContent = output.content || iterText;

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

    // 无工具调用：执行终结检查后完成闭环
    if (output.toolCalls.length === 0) {
      finalContent = roundContent.trim();
      const checkStepId = `check-${iteration}`;
      const isEmpty = !finalContent;
      if (isEmpty) {
        finalContent = "模型返回了空内容，未能生成有效答复。";
      }
      pushOrUpdateStep({
        id: checkStepId,
        iteration,
        phase: "check",
        status: isEmpty ? "error" : "done",
        title: isEmpty ? "最终检查：响应为空" : "最终检查：任务目标已达成",
        detail: isEmpty ? "请检查模型接口与提示词配置。" : "已验证上下文与工具观察结果，输出最终结论。",
        timestamp: Date.now(),
      });
      return { content: finalContent, reasoning: accumulatedReasoning, steps, model: lastModel };
    }

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

      pushOrUpdateStep({
        id: actStepId,
        iteration,
        phase: "act",
        status: "running",
        title: `行动：调用 ${call.name}`,
        toolCallId: call.id,
        toolName: call.name,
        permissionLevel: perm,
        argsPreview,
        timestamp: Date.now(),
      });

      const parsedArgs = safeParseArgs(call.argumentsJson);
      let toolOutputText = "";
      let stepOk = false;
      let summaryText = "";
      let addedLines: number | undefined;
      let removedLines: number | undefined;

      if (!parsedArgs.ok) {
        toolOutputText = parsedArgs.error;
        summaryText = "参数格式错误";
      } else {
        let permitted = true;
        let autoApprovalDetail = "";
        if (toolDef && perm !== "read") {
          const currentCount = params.permissionMode === "smart"
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
          const decision = evaluateToolApproval({
            mode: params.permissionMode,
            permissionLevel: perm,
            toolName: call.name,
            args: parsedArgs.value,
            approvedCount: currentCount,
          });

          if (decision.requiresApproval) {
            const approvalId = randomUUID();
            pushOrUpdateStep({
              id: actStepId,
              iteration,
              phase: "act",
              status: "waiting_approval",
              title: `等待确认：${toolDef.title} (${call.name})`,
              toolCallId: call.id,
              toolName: call.name,
              permissionLevel: perm,
              argsPreview,
              ...(decision.reason ? { detail: decision.reason } : {}),
              timestamp: Date.now(),
            });
            permitted = await params.requestApproval({
              approvalId,
              toolName: call.name,
              permissionLevel: perm,
              argsPreview,
              permissionMode: params.permissionMode,
              approvalPattern: decision.pattern,
              ...(decision.approvalCount !== undefined ? { approvalCount: decision.approvalCount } : {}),
              ...(decision.approvalThreshold !== undefined ? { approvalThreshold: decision.approvalThreshold } : {}),
              highRisk: decision.highRisk,
              ...(decision.reason ? { riskReason: decision.reason } : {}),
            });
            if (params.permissionMode === "smart") {
              await deps.trustStore.recordDecision(decision.pattern, permitted, decision.highRisk);
            }
          } else if (decision.autoApproved && decision.reason) {
            autoApprovalDetail = decision.reason;
          }
        }

        if (!permitted) {
          toolOutputText = "用户拒绝执行此修改/命令工具，请改用只读核查或向用户说明替代方案。";
          summaryText = "用户已拒绝";
        } else {
          const execRes = await deps.tools.executeTool(call.name, parsedArgs.value, {
            workspaceRoots: params.workspaceRoots,
            sessionId: params.sessionId,
            runId: params.runId,
            signal: params.signal,
            allowOutsideWorkspace: params.permissionMode === "full",
          });
          stepOk = execRes.ok;
          toolOutputText = execRes.output;
          summaryText = autoApprovalDetail ? `${execRes.summary} · ${autoApprovalDetail}` : execRes.summary;
          if (typeof execRes.metadata?.added === "number") addedLines = execRes.metadata.added;
          if (typeof execRes.metadata?.removed === "number") removedLines = execRes.metadata.removed;
        }
      }

      if (!stepOk) failureCount += 1;
      actSummaries.push(`${call.name}: ${summaryText}`);

      pushOrUpdateStep({
        id: actStepId,
        iteration,
        phase: "act",
        status: stepOk ? "done" : "error",
        title: `行动：${call.name} (${summaryText})`,
        toolCallId: call.id,
        toolName: call.name,
        permissionLevel: perm,
        argsPreview,
        resultPreview: toolOutputText.slice(0, 240),
        ...(addedLines !== undefined ? { addedLines } : {}),
        ...(removedLines !== undefined ? { removedLines } : {}),
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
  const fallback = await deps.llm.complete({
    ...(params.profileId !== undefined ? { profileId: params.profileId } : {}),
    messages: [
      ...conversation,
      { role: "user", content: "已达到本轮最大工具步数限制，请基于现有观察直接给出清晰结论与未完成项说明。" },
    ],
    tools: [],
    signal: params.signal,
    onDelta: (delta) => {
      if (delta.type === "text" && delta.text) {
        params.emit({ type: "delta", runId: params.runId, seq: 0, kind: "text", text: delta.text });
      }
    },
  });
  finalContent = fallback.content.trim() || "已达到单轮最大步数上限，请根据步骤轨迹继续指令。";
  return { content: finalContent, reasoning: accumulatedReasoning, steps, model: fallback.model ?? lastModel };
}
