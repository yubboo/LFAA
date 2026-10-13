/**
 * 功能：把 LFAA 既有的进程内 Agent Run 系统注册为一个子代理驱动。
 * 作用：模型通过 lfaaSubagents 派发时，在同进程新建一个独立会话的子 Run 并等待其终态；
 *       子 Agent 沿用设置中心的模型、数量与深度限制，写操作仍走 LFAA 自身权限/审批。
 * 边界：不绕过父运行的取消；父信号取消会转发到 cancelAiRun。子 Agent 不向用户提问。
 * 关联文件：core/agent-loop/src/runs.ts、core/agent-loop/src/execute-turn.ts、subagent/manager.ts。
 */
import type { Context } from "@deepseek-ai/cordis";
import type { SubagentDriver, SubagentDriverContext, SubagentRunResult, SubagentStopReason, SubagentTask } from "lfaa-subagent";


/** 把既有 Run 终态映射为统一子代理结果原因。 */
function mapStopReason(status: string | undefined, aborted: boolean): SubagentStopReason {
  if (aborted) return "aborted";
  if (status === "complete") return "completed";
  if (status === "interrupted") return "aborted";
  return "error";
}

export const name = "lfaaSubagentInProcessDriver";
export const inject = ["lfaaSubagents"];

export function apply(ctx: Context): void {
  const driver: SubagentDriver = {
    name: "in-process",
    displayName: "LFAA 进程内子 Agent",
    async run(_task: SubagentTask, driverCtx: SubagentDriverContext): Promise<SubagentRunResult> {
      if (!driverCtx.startChild) throw new Error("父 Run 未提供经过范围与预算校验的委派入口。");
      driverCtx.signal.throwIfAborted();
      driverCtx.onProgress("正在创建独立会话的子 Agent 运行。");
      const final = await driverCtx.startChild(driverCtx.signal);
      const answer = typeof final.answer === "string" ? final.answer : "";
      return {
        runId: String(final.childRunId ?? ""),
        stopReason: mapStopReason(final?.status, driverCtx.signal.aborted),
        answer,
        ...(final.status !== "complete" ? { diagnostic: `子 Agent 终态：${final.status}。` } : {})
      };
    }
  };
  const dispose = ctx.lfaaSubagents.registerDriver(driver);
  ctx.effect(() => dispose);
}
