/**
 * 文件：runtime.ts
 * 功能：定时任务的扫描/派发/重排驱动。
 * 作用：持有单一 setTimeout，按最近的触发时刻休眠；到点后把任务交给 onFire 回调，
 *       周期任务无论派发成败都推进到下一次触发（错过的实例不补跑），一次性任务派发成功才置 done。
 * 边界：onFire 只是“把任务交给上层”的扩展点（默认记录失败，直至 Agent Run 交付器接入），
 *       不会写死任何业务流程；真正的会话激活/模型投递由 session/agent 分片接线。
 * 关联文件：packages/schedule/schedule/src/store.ts、index.ts。
 */
import type { Context } from "@deepseek-ai/cordis";
import { database } from "lfaa-storage-sqlite/src/database.js";
import {
  deleteTask as storeDeleteTask,
  listDueTasks,
  markFired,
  nextActiveFireAt,
  type ScheduleTask
} from "./store.js";

/** 单次派发的扩展点：回执为真实 Run ID；失败由驱动退避重试。 */
export type ScheduleFireHandler = (task: ScheduleTask) => Promise<void | { messageId: string }> | void | { messageId: string };

/** Node setTimeout 的最大可靠毫秒数，超过就拆成分段等待。 */
const MAX_TIMER_DELAY_MS = 2_147_483_647;
/** 派发失败时，一次性任务的退避重试间隔（毫秒），避免热循环打满。 */
const FAILURE_RETRY_DELAY_MS = 30_000;

export class ScheduleRuntime {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running = false;
  private activeDrive: Promise<void> | undefined;
  private stopping = false;

  constructor(
    private readonly ctx: Context,
    private readonly onFire: ScheduleFireHandler
  ) {}

  /** 启动驱动；重复调用安全（已在运行则忽略）。 */
  start(): void {
    this.stopping = false;
    this.requestDrive();
  }

  /** 在任务发生增删改后请求重排。 */
  requestDrive(): void {
    if (this.stopping) return;
    this.clearTimer();
    if (this.running) return;
    this.activeDrive = this.drive().catch((error: unknown) => {
      this.ctx.logger("schedule").warn(`schedule 驱动异常：${error instanceof Error ? error.message : String(error)}`);
    }).finally(() => {
      this.running = false;
      this.activeDrive = undefined;
      // drive 结束时若又被请求（在 finally 前 requestDrive），继续一轮。
      if (!this.stopping) this.scheduleNext();
    });
  }

  /** 停止定时器并等待当前派发完成。 */
  async dispose(): Promise<void> {
    this.stopping = true;
    this.clearTimer();
    await this.activeDrive;
  }

  private clearTimer(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  private scheduleNext(): void {
    this.clearTimer();
    const now = Date.now();
    const nextAt = nextActiveFireAt(now);
    if (nextAt === null) return;
    const delay = Math.max(0, Math.min(nextAt - now, MAX_TIMER_DELAY_MS));
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.requestDrive();
    }, delay);
    this.timer.unref?.();
  }

  private async drive(): Promise<void> {
    this.running = true;
    const due = listDueTasks(Date.now());
    for (const task of due) {
      if (this.stopping) return;
      let error: string | null = null;
      try {
        await this.onFire(task);
      } catch (caught: unknown) {
        error = caught instanceof Error ? caught.message : String(caught);
        this.ctx.logger("schedule").warn(`schedule 任务 ${task.id} 派发失败：${error}`);
      }
      const firedMs = Date.now();
      if (task.rule.kind === "at" && error !== null) {
        // 一次性任务失败：延迟退避重试，而不是立刻置失败丢弃。
        markFiredWithRetryBackoff(task.id, firedMs, error);
      } else {
        markFired(task.id, firedMs, error);
      }
    }
  }
}

/** 一次性任务派发失败时写入退避后的下一次触发，保持 active 以便稍后重试。 */
function markFiredWithRetryBackoff(id: string, failedAtMs: number, error: string): void {
  // 先记录 fire 与错误，再把状态拉回 active 并设置退避时刻，避免一次性任务直接丢弃。
  markFired(id, failedAtMs, error);
  database.prepare("UPDATE lfaa_schedule_tasks SET next_fire_at = ?, status = 'active', last_error = ? WHERE id = ? AND status = 'failed'")
    .run(failedAtMs + FAILURE_RETRY_DELAY_MS, error, id);
}

/** 供装配层删除任务的便捷转发。 */
export { storeDeleteTask };
