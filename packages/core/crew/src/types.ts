// @lfaa/crew 契约：任务定义、运行结果与验收结论；只放类型，不依赖运行时。
/** 单个任务在执行过程中的状态。 */
export type CrewTaskStatus = "pending" | "running" | "done" | "failed" | "skipped";

/** 一个任务：怎么做（description）与交付什么（expectedOutput）分开描述，交接按后者验收。 */
export interface CrewTaskSpec {
  id: string;
  /** 展示名，缺省取 id；工作台标签用它区分任务。 */
  title?: string;
  /** 过程说明：允许引用 {{input}}（用户目标）与上游任务输出。 */
  description: string;
  /** 交付要求：格式、必含字段等；runner 据此做结构校验。 */
  expectedOutput: string;
  /** 依赖的上游任务 id；只有它们的 accepted 输出会进入本任务上下文。 */
  dependsOn?: string[];
  /** 单任务步数上限，缺省 20。 */
  maxSteps?: number;
}

/** 一次 crew 运行：目标 + 任务列表（v1 只支持串行）。 */
export interface CrewRunSpec {
  goal: string;
  tasks: CrewTaskSpec[];
}

/** 结构校验结论：失败时带可回传重试的原因。 */
export interface CrewValidation {
  ok: boolean;
  reason?: string;
  attempts: number;
}

/** 单个任务的执行结果，可直接序列化给父 Agent。 */
export interface CrewTaskResult {
  taskId: string;
  title: string;
  status: CrewTaskStatus;
  subagentId?: string;
  output: string;
  validation: CrewValidation;
  startedAt: number;
  endedAt?: number;
}

/** 整次运行的汇总：finalOutput 是最后一个完成任务的交付物。 */
export interface CrewRunResult {
  runId: string;
  goal: string;
  ok: boolean;
  tasks: CrewTaskResult[];
  finalOutput: string;
}

/** 任务图校验的结论：ok 为 false 时 runner 不执行任何任务。 */
export interface TaskGraphCheck {
  ok: boolean;
  issues: string[];
}