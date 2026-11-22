// Agent 单次运行的循环状态：把预算、轮次、用量累积与完成前自检标记收进一个对象。
// 从 executeAgentTaskLoop 拆出：循环体只读写 state，避免十几个局部变量散落在 500 行里。
import { REPEAT_THRESHOLDS, RepeatCallTracker } from "@lfaa/guard";
import type { AgentStepTrace } from "@lfaa/memory";
import { MAX_STEP_BUDGET } from "./step-budget";
import type { RunExecutionParams } from "./run-types";

/** 步数预算：limit 为当前上限，hardLimit 是自动延长的天花板。 */
export interface LoopBudget {
  limit: number;
  hardLimit: number;
  /** 每次自动追加的步数；0 表示不自动延长。 */
  extension: number;
}

/** 完成前自检：记录最后一次代码修改与最后一次验证命令所在的轮次。 */
export interface LoopVerification {
  lastCodeEditIteration: number;
  lastVerificationIteration: number;
  /** 每次运行最多提示一次"改完没验证"。 */
  nudged: boolean;
}

/** 单次运行的循环状态；`steps` / `mediaPreviews` / `verification` 为稳定引用。 */
export interface LoopState {
  readonly steps: AgentStepTrace[];
  readonly mediaPreviews: Map<string, string>;
  readonly verification: LoopVerification;
  readonly budget: LoopBudget;
  /** 连续重复调用提醒；关闭提醒时为 null。 */
  readonly repeat: RepeatCallTracker | null;
  reasoning: string;
  progressText: string;
  iteration: number;
  /** 上一轮是否真的执行过工具（决定预算能不能继续延长）。 */
  lastRoundExecutedTools: boolean;
  overflowRetried: boolean;
  /** 待回填到上下文的重复调用提醒。 */
  pendingReminders: string[];
}

/** 按运行参数创建初始状态；预算取 maxSteps，硬上限只在允许自动延长时抬到 MAX_STEP_BUDGET。 */
export function createLoopState(params: RunExecutionParams): LoopState {
  const limit = Math.max(1, Math.floor(params.maxSteps));
  const extension = Math.max(0, Math.floor(params.autoExtendSteps ?? 0));
  // 空阈值数组表示用户关闭重复调用提醒。
  const repeat = params.repeatToolThresholds !== undefined && params.repeatToolThresholds.length === 0
    ? null
    : new RepeatCallTracker(params.repeatToolThresholds ?? REPEAT_THRESHOLDS);
  return {
    steps: [],
    mediaPreviews: new Map<string, string>(),
    verification: { lastCodeEditIteration: 0, lastVerificationIteration: 0, nudged: false },
    budget: { limit, hardLimit: extension > 0 ? Math.max(limit, MAX_STEP_BUDGET) : limit, extension },
    repeat,
    reasoning: "",
    progressText: "",
    iteration: 0,
    lastRoundExecutedTools: false,
    overflowRetried: false,
    pendingReminders: [],
  };
}

/** 记录或更新一条步骤轨迹，并通过 run 事件实时推送（与拆分前的闭包等价）。 */
export function recordStep(state: LoopState, params: RunExecutionParams, update: AgentStepTrace): void {
  const idx = state.steps.findIndex((s) => s.id === update.id);
  const step = { ...update, startedAt: state.steps[idx]?.startedAt ?? update.startedAt ?? update.timestamp };
  if (idx >= 0) state.steps[idx] = step;
  else state.steps.push(step);
  params.emit({ type: "step_update", runId: params.runId, step });
}

/** 预算用尽时按配置自动延长；不可延长（未配置 / 已到硬上限 / 上轮没执行工具）返回 null。 */
export function extendBudget(state: LoopState): number | null {
  const { extension, limit, hardLimit } = state.budget;
  if (extension === 0 || limit >= hardLimit || !state.lastRoundExecutedTools) return null;
  const next = Math.min(hardLimit, limit + extension);
  state.budget.limit = next;
  return next - limit;
}