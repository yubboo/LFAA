/**
 * 功能：调用 Agent Run 交付器并持久化真实回执；提交后广播观察事件。
 * 作用：无交付器或无 Run ID 时记录失败，交给驱动退避重试。
 * 关联：agent-loop/index.ts、runtime.ts、delivery-history.ts。
 * 参考 DeepSeek Harness (MIT, commit 639ed015397290b3745d163aafe02ffee4aa3f84) 的会话投递语义。
 */
import type { Context } from "@deepseek-ai/cordis";
import { recordDelivery } from "./delivery-history.js";
import type { ScheduleTask } from "./store.js";
import type { ScheduleFireHandler } from "./runtime.js";

/** 到点交付客户端：成功以交付器创建 Run 的回执为准。 */
export function createDefaultFireHandler(ctx: Context, deliver?: ScheduleFireHandler): (task: ScheduleTask) => Promise<void> {
  return async (task) => {
    const firedAtMs = Date.now();
    try {
      if (!deliver) throw new Error("调度尚未接入 Agent 会话交付器；本次没有交付。");
      const receipt = await deliver(task);
      if (!receipt?.messageId) throw new Error("交付器没有返回真实 Run 回执。");
      recordDelivery({ taskId: task.id, firedAtMs, status: "success", messageId: receipt.messageId });
      // 通知失败不能回滚已提交的 Run，也不能导致重复派发。
      try { ctx.emit("schedule/fire", task); } catch { /* 交付回执已持久化。 */ }
    } catch (error) {
      recordDelivery({
        taskId: task.id,
        firedAtMs,
        status: "failed",
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  };
}
