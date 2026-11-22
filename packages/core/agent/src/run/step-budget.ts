// 计算单轮 Agent 任务的工具步数预算：默认软预算可自动延长，显式上限保持硬约束。

/** 默认软预算：一次完整工程任务通常需要 40–80 次工具调用，28 步远不足以闭环。 */
export const DEFAULT_STEP_BUDGET = 100;
/** 软预算用尽但仍有实际工具进展时自动追加的步数，避免把"继续"再次交还给用户。 */
export const AUTO_EXTEND_STEPS = 100;
/** 单轮任务步数硬上限，防止自动延长无限扩张。 */
export const MAX_STEP_BUDGET = 300;

function clampBudget(value: number): number {
  return Math.min(MAX_STEP_BUDGET, Math.max(1, Math.floor(value)));
}

/** 归一化调用方请求的步数预算：显式值视为硬上限，缺省值使用可自动延长的软预算。 */
export function resolveStepBudget(requested?: number): { budget: number; autoExtendSteps: number } {
  if (typeof requested === "number" && Number.isFinite(requested)) {
    return { budget: clampBudget(requested), autoExtendSteps: 0 };
  }
  return { budget: DEFAULT_STEP_BUDGET, autoExtendSteps: AUTO_EXTEND_STEPS };
}
