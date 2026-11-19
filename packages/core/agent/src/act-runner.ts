// 执行一轮模型给出的工具调用：连续只读调用并行、写文件与命令串行，并按模型给出的顺序回填步骤与工具消息。
import { randomUUID } from "node:crypto";
import type { LlmMessage, LlmToolCall } from "@lfaa/llm";
import type { AgentStepTrace } from "@lfaa/memory";
import { tailCommandOutput } from "./command-trace";
import { evaluateToolApproval } from "./permission-policy";
import type { RunExecutionParams, RunLoopDeps } from "./run-types";
import { safeParseArgs } from "./tool-call-args";
import { limitToolResult } from "./tool-result";

/** 同一轮中连续只读工具的最大并行数；写文件与命令仍保持串行。 */
export const PARALLEL_READ_LIMIT = 4;

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

  const runToolCall = async (call: LlmToolCall): Promise<ActOutcome> => {
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
    let executed = false;
    let durationMs = 0;
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
        executed = true;
        executedToolCount += 1;
        pushOrUpdateStep({ ...action, timestamp: Date.now() });
        const execStartedAt = Date.now();
        const execRes = await deps.tools.executeTool(call.name, parsedArgs.value, {
          workspaceRoots: params.workspaceRoots,
          sessionId: params.sessionId,
          runId: params.runId,
          signal: params.signal,
          allowOutsideWorkspace: params.getPermissionMode() === "full",
          ...(command ? { onCommandOutput: (output: string) => pushOrUpdateStep({
            // 运行中的命令只保留尾部快照，长构建日志不再整段写进会话文件。
            ...action, commandTrace: { command, output: tailCommandOutput(output) }, timestamp: Date.now(),
          }) } : {}),
        });
        durationMs = Date.now() - execStartedAt;
        stepOk = execRes.ok;
        toolOutputText = execRes.output;
        summaryText = autoApprovalDetail ? `${execRes.summary} · ${autoApprovalDetail}` : execRes.summary;
        if (typeof execRes.metadata?.added === "number") addedLines = execRes.metadata.added;
        if (typeof execRes.metadata?.removed === "number") removedLines = execRes.metadata.removed;
        if (typeof execRes.metadata?.exitCode === "number") exitCode = execRes.metadata.exitCode;
        if (execRes.ok) fileChange = execRes.fileChange;
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
    };
  };

  // 结果按模型给出的顺序回填步骤与工具消息，保证工具调用与结果成对且顺序稳定。
  const finalizeToolCall = (outcome: ActOutcome) => {
    const { call, action, command } = outcome;
    if (!outcome.ok) failureCount += 1;
    if (outcome.executed) toolMs += outcome.durationMs;
    summaries.push(`${call.name}: ${outcome.summary}`);
    ctx.onExecuted?.(outcome);

    pushOrUpdateStep({
      ...action,
      status: outcome.ok ? "done" : "error",
      title: `行动：${call.name} (${outcome.summary})`,
      resultPreview: outcome.output.slice(0, 240),
      ...(command ? { commandTrace: {
        command,
        output: tailCommandOutput(outcome.output),
        ...(outcome.exitCode === undefined ? {} : { exitCode: outcome.exitCode }),
      } } : {}),
      ...(outcome.addedLines !== undefined ? { addedLines: outcome.addedLines } : {}),
      ...(outcome.removedLines !== undefined ? { removedLines: outcome.removedLines } : {}),
      ...(outcome.fileChange ? { fileChange: outcome.fileChange } : {}),
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

  return { failureCount, executedToolCount, summaries, toolMs };
}
