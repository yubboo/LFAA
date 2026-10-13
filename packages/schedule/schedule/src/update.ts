/**
 * 文件：update.ts
 * 功能：任务的就地更新、暂停与恢复。
 * 作用：在不改变任务 id 的前提下改标题/提示/计时规则；规则变化时按当前时间重算下次触发。
 *       暂停只是把状态置 paused（驱动跳过），恢复时若已过点则立即到期。
 * 边界：不做会话变动；乐观更新（基于当前读到的记录），无外部并发锁。
 * 关联文件：packages/schedule/schedule/src/store.ts、domain.ts、runtime.ts。
 * 移植参考：DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84）
 *          packages/schedule/schedule/src/update.ts 的就地更新语义。
 */
import {
  getTask,
  updateTaskFields,
  updateTaskStatus,
  type ScheduleTask
} from "./store.js";
import { normalizePrompt, normalizeTitle, ruleFromSelector } from "./domain.js";
import type { ScheduleView } from "./types.js";
import { viewFromTask } from "./domain.js";

export interface UpdateTaskInput {
  readonly id: string;
  readonly title?: string;
  readonly prompt?: string;
  /** 模型计时选择器（至多一个）。 */
  readonly selector?: {
    readonly everySeconds?: number;
    readonly daily?: { readonly time: string; readonly timeZone: string };
    readonly weekly?: { readonly time: string; readonly weekdays: readonly number[]; readonly timeZone: string };
    readonly cron?: { readonly expression: string; readonly timeZone: string };
  };
}

/** 就地更新一个任务；不存在或已结束返回 null。 */
export function applyUpdateTask(input: UpdateTaskInput, nowMs: number): ScheduleTask | null {
  const current = getTask(input.id);
  if (current === null || (current.status !== "active" && current.status !== "paused")) return null;
  const rule = input.selector === undefined ? undefined : ruleFromSelector(
    {
      ...(input.selector.everySeconds === undefined ? {} : { everySeconds: input.selector.everySeconds }),
      ...(input.selector.daily === undefined ? {} : { daily: input.selector.daily }),
      ...(input.selector.weekly === undefined ? {} : { weekly: input.selector.weekly }),
      ...(input.selector.cron === undefined ? {} : { cron: input.selector.cron })
    },
    nowMs
  );
  return updateTaskFields(input.id, {
    ...(input.title === undefined ? {} : { title: normalizeTitle(input.title) }),
    ...(input.prompt === undefined ? {} : { prompt: normalizePrompt(input.prompt) }),
    ...(rule === undefined ? {} : { rule })
  });
}

/** 暂停任务（驱动不再触发）。 */
export function pauseTask(id: string): boolean {
  return updateTaskStatus(id, "paused");
}

/** 恢复任务；若恢复时已过点，下次扫描立即触发。 */
export function resumeTask(id: string): boolean {
  return updateTaskStatus(id, "active");
}

/** 渲染更新后的视图。 */
export function viewTask(task: ScheduleTask, nowMs: number): ScheduleView {
  return viewFromTask(task, nowMs);
}
