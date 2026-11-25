// 执行一轮模型给出的工具调用：连续只读调用并行、写文件与命令串行，并按模型给出的顺序回填步骤与工具消息。
import { randomUUID } from "node:crypto";
import type { SubagentActivityUpdate } from "@lfaa/tools";
import type { LlmMessage, LlmToolCall } from "@lfaa/llm";
import type { AgentStepTrace, TodoItem } from "@lfaa/memory";
import { normalizeTodoList } from "@lfaa/memory";
import { tailCommandOutput } from "./command-trace";
import { evaluateToolApproval } from "../tools/permission-policy";
import type { RunExecutionParams, RunLoopDeps } from "./run-types";
import { safeParseArgs } from "../tools/tool-call-args";
import { limitToolResult } from "../tools/tool-result";
import { captureBeforeMutation } from "./turn-snapshot";
import { TODO_NUDGE_MARK, TODO_NUDGE_TEXT, shouldNudgeTodos } from "./todo-plan";

/** 同一轮中连续只读工具的最大并行数；写文件与命令仍保持串行。 */
export const PARALLEL_READ_LIMIT = 4;

/** 常见工具目标参数键的优先级；未命中时回退到首个短字符串参数，以动态适配任意内置或扩展工具。 */
const TARGET_ARG_KEYS = [
  "path",
  "filePath",
  "file",
  "directory",
  "dir",
  "pattern",
  "query",
  "glob",
  "url",
  "command",
  "role",
  "title",
  "name",
  "skillId",
  "target",
] as const;

/** 从已解析的工具参数中动态提取最具可读性的目标摘要，不针对工具名写死分支。 */
function extractDynamicToolTarget(args: Record<string, unknown>, toolName: string): string | undefined {
  // 页面输入内容与脚本留在工具详情，实时轨迹只显示显式目标或控件定位信息。
  if (toolName === "browser_type" || toolName === "browser_evaluate") {
    const target = args.target ?? args.ref ?? args.selector;
    return typeof target === "string" ? target.trim().slice(0, 140) : undefined;
  }
  for (const key of TARGET_ARG_KEYS) {
    const val = args[key];
    if (typeof val === "string" && val.trim()) {
      return val.trim().slice(0, 500);
    }
  }
  for (const val of Object.values(args)) {
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (trimmed && trimmed.length <= 240 && !trimmed.includes("\n")) {
        return trimmed;
      }
    }
  }
  return undefined;
}

/** 单个工具调用的执行结果，步骤回填与自检判定都基于这份数据。 */
export interface ActOutcome {
  call: LlmToolCall;
  action: AgentStepTrace;
  command: string;
  output: string;
  summary: string;
  ok: boolean;
  executed: boolean;
  /** 工具实际执行耗时（不含审批等待），用于会话统计。 */
  durationMs: number;
  addedLines?: number;
  removedLines?: number;
  exitCode?: number;
  fileChange?: AgentStepTrace["fileChange"];
  readRange?: AgentStepTrace["readRange"];
  /** 工具（如 todo_write）回传的最新任务清单，供运行事件与快照使用。 */
  todos?: TodoItem[];
}

/** 运行循环提供给工具执行器的上下文，避免执行器直接依赖循环内部状态。 */
export interface ActContext {
  iteration: number;
  roundTextOffset: number;
  conversation: LlmMessage[];
  pushOrUpdateStep: (step: AgentStepTrace) => void;
  /** 每次工具执行完成时回调，用于完成前自检等策略判断。 */
  onExecuted?: (outcome: ActOutcome) => void;
}

export interface ActResult {
  failureCount: number;
  executedToolCount: number;
  summaries: string[];
  /** 本阶段工具实际执行耗时总和。 */
  toolMs: number;
  /** 本阶段是否出现任务清单（todo_write 回传 metadata.todos）。 */
  sawTodos: boolean;
}

/** 顺序推进一轮工具调用；连续的只读调用按批并行，写操作与命令保持串行。 */
export async function runActPhase(
  deps: RunLoopDeps,
  params: RunExecutionParams,
  toolCalls: LlmToolCall[],
  ctx: ActContext,
): Promise<ActResult> {
  const { iteration, roundTextOffset, conversation, pushOrUpdateStep } = ctx;
  let failureCount = 0;
  let executedToolCount = 0;
  let toolMs = 0;
  const summaries: string[] = [];
  let sawTodos = false;

  const runToolCall = async (call: LlmToolCall): Promise<ActOutcome> => {
    if (params.signal.aborted) throw new Error("用户已中止本次任务。");
    const actStepId = `act-${iteration}-${call.id}`;
    const argsPreview = (call.argumentsJson || "{}").slice(0, 2_000);
    const toolDef = deps.tools.getTool(call.name);
    const perm = toolDef?.permissionLevel ?? "read";

    const parsedArgs = safeParseArgs(call.argumentsJson);
    if (parsedArgs.ok && call.name === "generate_image" && params.referenceImages?.length) {
      // 参考图是用户当轮选择或宿主从会话解析的产物，模型遗漏也会随生成请求传入。
      parsedArgs.value.referenceImages = params.referenceImages;
    }
    const command = call.name === "run_command" && parsedArgs.ok && typeof parsedArgs.value.command === "string"
      ? parsedArgs.value.command.trim().slice(0, 16000)
      : "";
    const dynamicTarget = parsedArgs.ok ? extractDynamicToolTarget(parsedArgs.value, call.name) : undefined;
    const stepStartedAt = Date.now();
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
      ...(dynamicTarget ? { toolTarget: dynamicTarget } : {}),
      textOffset: roundTextOffset,
      ...(command ? { commandTrace: { command } } : {}),
      startedAt: stepStartedAt,
      timestamp: stepStartedAt,
    };

    let toolOutputText = "";
    let stepOk = false;
    let executed = false;
    let durationMs = 0;
    let summaryText = "";
    let addedLines: number | undefined;
    let removedLines: number | undefined;
    let exitCode: number | undefined;
    let fileChange: AgentStepTrace["fileChange"];
    let readRange: AgentStepTrace["readRange"];
    let todos: TodoItem[] | undefined;

    if (!parsedArgs.ok) {
      toolOutputText = parsedArgs.error;
      summaryText = "参数格式错误";
    } else {
      let permitted = true;
      let autoApprovalDetail = "";
      while (toolDef && perm !== "read" && toolDef.approval !== "trusted") {
        params.signal.throwIfAborted();
        const mode = params.getPermissionMode();
        const approvalMode = toolDef.approval === "always" ? "ask" : mode;
        const currentCount = approvalMode === "smart"
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
          mode: approvalMode,
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
            highRisk: toolDef.approval === "always" || decision.highRisk,
            ...(decision.reason ? { riskReason: decision.reason } : {}),
          }, params.signal);
          if (answer === "mode_changed") continue;
          permitted = answer;
          if (mode === "smart" && toolDef.approval !== "always") {
            await deps.trustStore.recordDecision(decision.pattern, permitted, decision.highRisk);
          }
        } else if (decision.autoApproved && decision.reason) {
          autoApprovalDetail = decision.reason;
        }
        break;
      }

      if (permitted && toolDef && perm !== "read" && deps.tools.getTool(call.name) === toolDef) {
        params.signal.throwIfAborted();
        await params.beforeWorkspaceMutation?.();
        if ((call.name === "write_file" || call.name === "edit_file") && typeof parsedArgs.value.path === "string") {
          await captureBeforeMutation(params.sessionId, params.assistantMessageId, parsedArgs.value.path, params.workspaceRoots).catch(() => {});
        }
      }
      if (!permitted) {
        toolOutputText = "用户拒绝执行此修改/命令工具，请改用只读核查或向用户说明替代方案。";
        summaryText = "用户已拒绝";
      } else if (deps.tools.getTool(call.name) !== toolDef) {
        toolOutputText = "工具在等待期间已更新，请重新发起调用。";
        summaryText = "工具已更新";
      } else {
        params.signal.throwIfAborted();
        executed = true;
        executedToolCount += 1;
        pushOrUpdateStep({ ...action, timestamp: Date.now() });
        const execStartedAt = Date.now();
        const childSteps = new Map<string, Map<string, NonNullable<SubagentActivityUpdate["activity"]>>>();
        const childStartedAt = new Map<string, number>();
        const execRes = await deps.tools.executeTool(call.name, parsedArgs.value, {
          workspaceRoots: params.workspaceRoots,
          sessionId: params.sessionId,
          runId: params.runId,
          signal: params.signal,
          parentApproval: { getPermissionMode: params.getPermissionMode, requestApproval: params.requestApproval },
          ...(params.profileId ? { parentProfileId: params.profileId } : {}),
          allowOutsideWorkspace: params.getPermissionMode() === "full",
          ...((call.name === "invoke_subagent" || call.name === "message_subagent") ? {
            onSubagentActivity: ({ id, role, status, kind, browserLabel, liveAction, activity, result }) => {
              const work = childSteps.get(id) ?? new Map();
              if (activity) work.set(activity.id, activity);
              childSteps.set(id, work);
              const started = childStartedAt.get(id) ?? Date.now();
              childStartedAt.set(id, started);
              const stepItems = [...work.values()];
              pushOrUpdateStep({
                id: `child-${action.id}-${id}`,
                iteration,
                phase: "act",
                status: status === "stopped" ? "error" : status,
                title: role,
                subagent: {
                  id,
                  role,
                  status,
                  ...(kind ? { kind } : {}),
                  ...(browserLabel ? { browserLabel } : {}),
                  ...(liveAction ? { liveAction } : {}),
                  ...(stepItems.length ? { steps: stepItems } : {}),
                },
                startedAt: started,
                textOffset: roundTextOffset,
                ...(stepItems.length ? {
                  detail: stepItems
                    .map((item) => `${item.label ?? item.name}${item.target ? ` · ${item.target}` : ""} (${item.status})`)
                    .join("\n")
                    .slice(-4000),
                } : {}),
                ...(result ? { resultPreview: result.slice(0, 2000) } : {}),
                timestamp: Date.now(),
              });
            },
          } : {}),
          ...(command ? { onCommandOutput: (output: string) => pushOrUpdateStep({
            // 运行中的命令只保留尾部快照，长构建日志不再整段写进会话文件。
            ...action, commandTrace: { command, output: tailCommandOutput(output) }, timestamp: Date.now(),
          }) } : {}),
        });
        durationMs = Date.now() - execStartedAt;
        stepOk = execRes.ok;
        toolOutputText = execRes.output;
        summaryText = autoApprovalDetail ? `${execRes.summary} · ${autoApprovalDetail}` : execRes.summary;
        if (call.name === "browser_screenshot" || call.name === "browser_visual_check") {
          const evidenceId = execRes.metadata?.browserEvidenceId;
          if (typeof evidenceId === "string") action.browserEvidence = { id: evidenceId, sessionId: params.sessionId };
          const verdict = execRes.metadata?.browserVerdict;
          if (verdict === "pass" || verdict === "needs_fix" || verdict === "unverified") action.browserVerdict = verdict;
        }
        if (typeof execRes.metadata?.added === "number") addedLines = execRes.metadata.added;
        if (typeof execRes.metadata?.removed === "number") removedLines = execRes.metadata.removed;
        if (typeof execRes.metadata?.exitCode === "number") exitCode = execRes.metadata.exitCode;
        // 任务清单是会话状态：工具回传后既进步骤流也广播给前端，刷新/重连都能恢复。
        todos = normalizeTodoList(execRes.metadata?.todos);
        if (execRes.ok) {
          fileChange = execRes.fileChange;
          if (
            call.name === "read_file"
            && typeof execRes.metadata?.startLine === "number"
            && typeof execRes.metadata?.endLine === "number"
          ) {
            readRange = {
              startLine: execRes.metadata.startLine,
              endLine: execRes.metadata.endLine,
              ...(typeof execRes.metadata.totalLines === "number" ? { totalLines: execRes.metadata.totalLines } : {}),
              ...(typeof execRes.metadata.resolvedPath === "string" ? { resolvedPath: execRes.metadata.resolvedPath } : {}),
            };
          }
        }
      }
    }

    return {
      call,
      action,
      command,
      output: toolOutputText,
      summary: summaryText,
      ok: stepOk,
      executed,
      durationMs,
      ...(addedLines !== undefined ? { addedLines } : {}),
      ...(removedLines !== undefined ? { removedLines } : {}),
      ...(exitCode !== undefined ? { exitCode } : {}),
      ...(fileChange ? { fileChange } : {}),
      ...(readRange ? { readRange } : {}),
      ...(todos ? { todos } : {}),
    };
  };

  // 结果按模型给出的顺序回填步骤与工具消息，保证工具调用与结果成对且顺序稳定。
  const finalizeToolCall = (outcome: ActOutcome) => {
    const { call, action, command } = outcome;
    if (!outcome.ok) failureCount += 1;
    if (outcome.executed) toolMs += outcome.durationMs;
    summaries.push(`${call.name}: ${outcome.summary}`);
    ctx.onExecuted?.(outcome);
    if (outcome.todos) {
      sawTodos = true;
      params.emit({ type: "todos", runId: params.runId, todos: outcome.todos });
    }

    // 保留最多 8,000 字符的工具输出供原地滚动查阅，超出时明确标出截断与总长度。
    const resultPreview = outcome.output.length > 8_000
      ? `${outcome.output.slice(0, 8_000)}\n…（已截断，完整输出共 ${outcome.output.length.toLocaleString("zh-CN")} 字符）`
      : outcome.output;
    pushOrUpdateStep({
      ...action,
      status: outcome.ok ? "done" : "error",
      title: `行动：${call.name} (${outcome.summary})`,
      resultPreview,
      ...(call.name.startsWith("browser_") ? { resultSummary: outcome.summary } : {}),
      ...(command ? { commandTrace: {
        command,
        output: tailCommandOutput(outcome.output),
        ...(outcome.exitCode === undefined ? {} : { exitCode: outcome.exitCode }),
      } } : {}),
      ...(outcome.addedLines !== undefined ? { addedLines: outcome.addedLines } : {}),
      ...(outcome.removedLines !== undefined ? { removedLines: outcome.removedLines } : {}),
      ...(outcome.todos ? { todos: outcome.todos } : {}),
      ...(outcome.fileChange ? { fileChange: outcome.fileChange } : {}),
      ...(outcome.readRange ? { readRange: outcome.readRange } : {}),
      timestamp: Date.now(),
    });

    conversation.push({
      role: "tool",
      toolCallId: call.id,
      name: call.name,
      // 单个工具结果进入上下文前统一限长，避免一次读取或检索撑爆上下文。
      content: limitToolResult(call.name, outcome.output),
    });
  };

  const isReadOnlyTool = (call: LlmToolCall) =>
    (deps.tools.getTool(call.name)?.permissionLevel ?? "read") === "read";

  let callIndex = 0;
  while (callIndex < toolCalls.length) {
    if (params.signal.aborted) throw new Error("用户已中止本次任务。");
    const current = toolCalls[callIndex]!;
    if (!isReadOnlyTool(current)) {
      finalizeToolCall(await runToolCall(current));
      callIndex += 1;
      continue;
    }
    // 连续只读调用成批并行执行，避免把多个 read_file / grep 串行成一串模型往返。
    const batch: LlmToolCall[] = [];
    while (callIndex < toolCalls.length && isReadOnlyTool(toolCalls[callIndex]!)) {
      batch.push(toolCalls[callIndex]!);
      callIndex += 1;
    }
    for (let offset = 0; offset < batch.length; offset += PARALLEL_READ_LIMIT) {
      const slice = batch.slice(offset, offset + PARALLEL_READ_LIMIT);
      const outcomes = await Promise.all(slice.map((call) => runToolCall(call)));
      for (const outcome of outcomes) finalizeToolCall(outcome);
    }
  }

  // 多步任务迟迟不建清单时补一条提醒：只在会话还没有清单、本轮已执行多次工具时触发一次。
  if (!sawTodos && executedToolCount >= 3) {
    const alreadyNudged = conversation.some((message) =>
      message.role === "user" && typeof message.content === "string" && message.content.includes(TODO_NUDGE_MARK));
    const existing = params.signal.aborted ? 0 : ((await deps.memory.getSession(params.sessionId).catch(() => null))?.todos?.length ?? 0);
    if (shouldNudgeTodos({ existingTodos: existing, executedToolCount, alreadyNudged })) {
      conversation.push({ role: "user", content: TODO_NUDGE_TEXT });
      pushOrUpdateStep({
        id: `todo-nudge-${iteration}`,
        iteration,
        phase: "check",
        status: "done",
        title: "已提醒模型建立任务清单",
        detail: "本轮已执行多次工具调用但会话没有清单；追加一次建议性提醒，不阻断执行。",
        timestamp: Date.now(),
      });
    }
  }

  return { failureCount, executedToolCount, summaries, toolMs, sawTodos };
}
