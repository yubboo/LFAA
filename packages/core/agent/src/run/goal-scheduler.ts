// 目标续跑调度：运行正常收尾后延迟判断并自动开下一轮；停止条件由 goal-continuation 纯函数决定。
import type { MemoryService } from "@lfaa/memory";
import type { StartAgentRunInput } from "../types";
import { decideGoalContinuation, type GoalContinuationSnapshot } from "./goal-continuation";
import type { RunOptionCache } from "./run-options";

/** 目标服务的最小结构，避免 Agent 包反向依赖 @lfaa/goal。 */
export interface GoalServicePort {
  list(filter: { sessionId?: string }): Promise<GoalContinuationSnapshot[]>;
  advanceRound(id: string, note?: string): Promise<unknown>;
}

/** 调度器依赖：由 AgentService 注入，便于单测与避免循环依赖。 */
export interface GoalSchedulerDeps {
  memory: MemoryService;
  resolveGoalService(): GoalServicePort | undefined;
  isSessionRunning(sessionId: string): boolean;
  startRun(input: StartAgentRunInput): Promise<unknown>;
  getRoots(sessionId: string): string[] | undefined;
  getRunOptions(sessionId: string): RunOptionCache;
  warn(message: string): void;
}

/** 调度延迟：给客户端留出收尾与用户抢跑的时间。 */
const GOAL_CONTINUATION_DELAY_MS = 200;

export class GoalContinuationScheduler {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private readonly deps: GoalSchedulerDeps) {}

  /** 运行收尾后调度；只有正常完成才排下一轮，同一会话只保留一个定时器。 */
  schedule(sessionId: string, shouldContinue: boolean): void {
    const previous = this.timers.get(sessionId);
    if (previous) clearTimeout(previous);
    this.timers.delete(sessionId);
    if (!shouldContinue) return;
    const timer = setTimeout(() => {
      this.timers.delete(sessionId);
      void this.continueGoal(sessionId);
    }, GOAL_CONTINUATION_DELAY_MS);
    this.timers.set(sessionId, timer);
  }

  dispose(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  /** 目标仍 active 且未暂停、未到上限时开下一轮；失败只记日志，不打断收口。 */
  private async continueGoal(sessionId: string): Promise<void> {
    const goalService = this.deps.resolveGoalService();
    if (!goalService) return;
    const session = await this.deps.memory.getSession(sessionId).catch(() => null);
    if (!session || session.archived) return;
    const goals = await goalService.list({ sessionId }).catch(() => []);
    const decision = decideGoalContinuation({
      runStatus: "done",
      pendingQuestion: Boolean(session.pendingQuestion),
      sessionRunning: this.deps.isSessionRunning(sessionId),
      goals,
    });
    if (!decision.continue) return;
    const roots = this.deps.getRoots(sessionId) ?? [];
    try {
      await this.deps.startRun({
        sessionId,
        goalContinuation: {
          goalId: decision.goal.id,
          title: decision.goal.title,
          objective: decision.goal.objective,
        },
        ...(roots.length > 0 ? { workspaceRoots: roots } : {}),
        ...this.deps.getRunOptions(sessionId),
      });
    } catch (error) {
      this.deps.warn(`[agent] 目标续跑未启动：${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    try {
      await goalService.advanceRound(decision.goal.id);
    } catch (error) {
      this.deps.warn(`[agent] 目标续跑轮次记录失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }
}