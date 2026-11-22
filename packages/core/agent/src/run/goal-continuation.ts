// 目标自动续跑判定：一轮结束后根据目标状态、轮次上限、暂停开关与会话忙闲决定是否继续。
// 纯函数、不依赖 @lfaa/goal 类型；由 AgentService 传入结构化快照，便于单测停止条件矩阵。

/** 续跑判定需要的目标快照（与 @lfaa/goal 的 GoalItem 结构兼容）。 */
export interface GoalContinuationSnapshot {
  id: string;
  title: string;
  objective: string;
  status: "active" | "complete" | "blocked";
  autoContinue: boolean;
  rounds: number;
  maxRounds: number;
}

/** 判定输入：本轮终态、会话状态与目标列表。 */
export interface GoalContinuationInput {
  /** 本轮运行的最终状态；只有正常完成才续跑。 */
  runStatus: "done" | "error" | "aborted";
  /** 会话是否仍有待回答的澄清问题。 */
  pendingQuestion: boolean;
  /** 会话是否已有新的运行（用户抢先发了消息）。 */
  sessionRunning: boolean;
  /** 当前会话的目标，按更新时间倒序。 */
  goals: ReadonlyArray<GoalContinuationSnapshot>;
}

/** 判定结果：继续时带上目标快照，停止时给出原因便于日志与排查。 */
export type GoalContinuationDecision =
  | { continue: true; goal: GoalContinuationSnapshot; reason: "active" }
  | {
    continue: false;
    reason: "run_not_done" | "pending_question" | "session_running" | "no_goal" | "paused" | "max_rounds";
  };

/** 选择要续跑的目标：取最近的 active 目标，并依次检查停止条件。 */
export function decideGoalContinuation(input: GoalContinuationInput): GoalContinuationDecision {
  if (input.runStatus !== "done") return { continue: false, reason: "run_not_done" };
  if (input.pendingQuestion) return { continue: false, reason: "pending_question" };
  if (input.sessionRunning) return { continue: false, reason: "session_running" };
  const goal = input.goals.find((item) => item.status === "active");
  if (!goal) return { continue: false, reason: "no_goal" };
  if (!goal.autoContinue) return { continue: false, reason: "paused" };
  if (goal.rounds >= goal.maxRounds) return { continue: false, reason: "max_rounds" };
  return { continue: true, goal, reason: "active" };
}

/** 续跑轮的隐藏指令：沿用会话上下文，不产生用户气泡。 */
export function buildGoalContinuationMessage(goal: Pick<GoalContinuationSnapshot, "title" | "objective">): string {
  return [
    `继续执行目标「${goal.title}」：${goal.objective}`,
    "",
    "请基于当前进展直接推进下一步；完成后调用 goal_update 把该目标标记为 complete；若确定受阻，标记 blocked 并在 note 里写清卡点。",
    "不要重复已经完成的工作，也不要询问是否继续。",
  ].join("\n");
}