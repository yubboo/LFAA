/**
 * 功能：子代理运行的生命周期状态机。
 * 作用：定义合法的状态迁移，禁止把已终态的运行再标记为运行中。
 * 关联文件：manager.ts、run-settlement.ts、types.ts。
 * 移植自 DeepSeek Harness subagent/lifecycle（MIT License，commit 639ed01），按 LFAA 运行状态适配。
 */

/** 运行状态。 */
export type SubagentLifecycle = "running" | "completed" | "aborted" | "error";

/** 触发迁移的事件。 */
export type SubagentLifecycleEvent = "complete" | "abort" | "fail";

const TRANSITIONS: Record<SubagentLifecycle, Partial<Record<SubagentLifecycleEvent, SubagentLifecycle>>> = {
  running: { complete: "completed", abort: "aborted", fail: "error" },
  completed: {},
  aborted: {},
  error: {}
};

/** 根据事件计算下一状态；非法迁移（终态后再迁移）返回原状态。 */
export function nextLifecycle(current: SubagentLifecycle, event: SubagentLifecycleEvent): SubagentLifecycle {
  return TRANSITIONS[current][event] ?? current;
}

/** 是否已经终态。 */
export function isTerminal(status: SubagentLifecycle): boolean {
  return status !== "running";
}
