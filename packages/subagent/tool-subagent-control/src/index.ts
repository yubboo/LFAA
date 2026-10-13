/**
 * 功能：提供查看与控制子 Agent 运行的模型工具。
 * 作用：列出本账户活动子任务、按运行标识取消仍在执行的子任务；不替代 LFAA 自身的权限审批。
 * 关联文件：subagent/manager.ts、tool-subagent、subagent-in-process-driver。
 */
import type { Context } from "@deepseek-ai/cordis";
import type { AiBusinessTool } from "lfaa-tools/src/business-tools.js";
import { APPLICATION_IDS } from "lfaa-util-values/src/application-id.js";

function parseRunId(value: unknown): { runId: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("取消参数必须是对象。");
  const record = value as Record<string, unknown>;
  if (typeof record.runId !== "string" || !/^[0-9a-f-]{36}$/u.test(record.runId)) throw new Error("runId 必须是 lfaa_delegate_subagent 返回的有效运行标识。");
  return { runId: record.runId };
}

export const name = "lfaaToolSubagentControl";
export const inject = ["lfaaTools", "lfaaSubagents"];

export function apply(ctx: Context): void {
  const listTool: AiBusinessTool = {
    id: "subagent.list",
    name: "lfaa_list_subagents",
    description: "列出本账户当前活动及近期的子 Agent 任务（标识、驱动、标签、状态、开始时间）。用于在派发多个后台/前台子任务后核对进度；只读。",
    applicationIds: [...APPLICATION_IDS],
    schema: { type: "object", properties: {}, additionalProperties: false },
    risk: () => "read",
    approval: () => ({ scopeKey: "read-only", scopeSummary: "子任务查询", summary: "列出行子 Agent 运行" }),
    parse: value => { if (value && typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).length === 0) return {}; throw new Error("此工具不接受参数。"); },
    async execute(_parameters, context) {
      return { runs: ctx.lfaaSubagents.listRuns(context.userId), drivers: ctx.lfaaSubagents.listDrivers() };
    }
  };

  const cancelTool: AiBusinessTool = {
    id: "subagent.cancel",
    name: "lfaa_cancel_subagent",
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
}
