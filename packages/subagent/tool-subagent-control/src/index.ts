/**
 * 功能：提供查看与控制子 Agent 运行的模型工具。
 * 作用：列出本账户活动子任务、按运行标识取消仍在执行的子任务；不替代 LFAA 自身的权限审批。
 * 关联文件：subagent/manager.ts、tool-subagent、subagent-in-process-driver。
 */
import type { Context } from "@deepseek-ai/cordis";
import type { AiBusinessTool } from "lfaa-tools/src/business-tools.js";
import { APPLICATION_IDS } from "lfaa-util-values/src/application-id.js";
import { listAiSubagentTasks, saveAiSubagentTask } from "lfaa-session/src/sessions.js";

function parseRunId(value: unknown): { runId: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("取消参数必须是对象。");
  const record = value as Record<string, unknown>;
  if (typeof record.runId !== "string" || !/^[0-9a-f-]{36}$/u.test(record.runId)) throw new Error("runId 必须是 lfaa_delegate_subagent 返回的有效运行标识。");
  return { runId: record.runId };
}

export const name = "lfaaToolSubagentControl";
export const inject = ["lfaaTools", "lfaaSubagents", "lfaaSessions"];

export function apply(ctx: Context): void {
  const listTool: AiBusinessTool = {
    id: "subagent.list",
    name: "lfaa_list_subagents",
    coreManaged: true,
    description: "列出本账户当前活动及近期的子 Agent 任务（标识、驱动、标签、状态、开始时间）。用于在派发多个后台/前台子任务后核对进度；只读。",
    applicationIds: [...APPLICATION_IDS],
    schema: { type: "object", properties: {}, additionalProperties: false },
    risk: () => "read",
    approval: () => ({ scopeKey: "read-only", scopeSummary: "子任务查询", summary: "列出行子 Agent 运行" }),
    parse: value => { if (value && typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).length === 0) return {}; throw new Error("此工具不接受参数。"); },
    async execute(_parameters, context) {
      const tasks = context.sessionId ? listAiSubagentTasks(context.userId, context.sessionId) : [];
      return { runs: ctx.lfaaSubagents.listRuns(context.userId), tasks: tasks.map(({ answer: _answer, diagnostic: _diagnostic, ...task }) => task.status === "running" && !ctx.lfaaSubagents.getRun(context.userId, task.runId) ? { ...task, status: "interrupted" } : task), drivers: ctx.lfaaSubagents.listDrivers() };
    }
  };

  const cancelTool: AiBusinessTool = {
    id: "subagent.cancel",
    name: "lfaa_cancel_subagent",
    coreManaged: true,
    description: "取消一个仍在执行的子 Agent 任务（按 lfaa_list_subagents 或委派返回的 runId）。取消后子任务已产生的真实副作用不会回滚；已派发的外部进程会被请求终止。",
    applicationIds: [...APPLICATION_IDS],
    schema: {
      type: "object",
      properties: { runId: { type: "string", minLength: 36, maxLength: 36 } },
      required: ["runId"],
      additionalProperties: false
    },
    risk: () => "dangerous",
    approval: (parameters) => ({ scopeKey: `subagent:cancel:${String((parameters as { runId: string }).runId)}`, scopeSummary: "取消子任务", summary: `取消子 Agent 任务 ${String((parameters as { runId: string }).runId)}` }),
    parse: parseRunId,
    async execute(parameters, context) {
      const runId = (parameters as { runId: string }).runId;
      const cancelled = ctx.lfaaSubagents.cancelRun(context.userId, runId);
      if (!cancelled) throw new Error("找不到本账户的该活动子任务，可能已结束或标识有误。");
      return { runId, cancelled: true };
    }
  };

  ctx.lfaaTools.registerTool(ctx, listTool);
  ctx.lfaaTools.registerTool(ctx, cancelTool);
  ctx.lfaaTools.registerTool(ctx, {
    id: "subagent.result", name: "lfaa_get_subagent_result", coreManaged: true, applicationIds: [...APPLICATION_IDS],
    description: "读取一个已委派子任务的真实状态与最终答案。默认即时查询；wait=true 等待终态而不重复派发。sessionId 是委派返回的父会话标识，省略使用当前会话；只读取当前账户的任务。进程重启后未完成记录报告中断，不自动重放。完成后检查产物、冲突与验证，不能仅凭启动标识宣称成功。",
    schema: { type: "object", properties: { runId: { type: "string", minLength: 36, maxLength: 36 }, sessionId: { type: "string", minLength: 1, maxLength: 160 }, wait: { type: "boolean" } }, required: ["runId"], additionalProperties: false },
    parse(value) {
      const input = value as Record<string, unknown>;
      const { runId } = parseRunId(value);
      if (input.wait !== undefined && typeof input.wait !== "boolean") throw new Error("wait 必须是布尔值。");
      if (input.sessionId !== undefined && (typeof input.sessionId !== "string" || !input.sessionId.length || input.sessionId.length > 160)) throw new Error("sessionId 无效。");
      return { runId, ...(input.sessionId ? { sessionId: input.sessionId } : {}), wait: input.wait === true };
    },
    risk: () => "read", approval: () => ({ scopeKey: "subagent-result", scopeSummary: "子任务结果", summary: "读取已委派任务结果" }),
    async execute(parameters, context) {
      const sessionId = typeof parameters.sessionId === "string" ? parameters.sessionId : context.sessionId;
      const stored = sessionId ? listAiSubagentTasks(context.userId, sessionId).find(task => task.runId === parameters.runId) : undefined;
      if (!stored || !sessionId) throw new Error("找不到当前账户及来源会话的子任务。");
      const handle = ctx.lfaaSubagents.getRun(context.userId, stored.runId);
      if (handle && (parameters.wait || handle.status !== "running")) {
        await new Promise<void>((resolve, reject) => {
          const abort = () => { cleanup(); reject(context.signal.reason ?? new DOMException("等待已取消", "AbortError")); };
          const cleanup = () => context.signal.removeEventListener("abort", abort);
          if (context.signal.aborted) { abort(); return; }
          context.signal.addEventListener("abort", abort, { once: true });
          void handle.done.then(() => { cleanup(); resolve(); }, error => { cleanup(); reject(error); });
        });
      }
      let task = listAiSubagentTasks(context.userId, sessionId).find(item => item.runId === stored.runId)!;
      if (!handle && task.status === "running") {
        task = { ...task, status: "aborted", completedAt: new Date().toISOString(), diagnostic: "执行进程已中断或运行器已卸载；未确认副作用，不自动重放。" };
        saveAiSubagentTask(context.userId, sessionId, task);
      }
      return { ...task, status: task.status === "completed" ? "complete" : task.status, pending: task.status === "running" };
    }
  });
}
