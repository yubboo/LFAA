/**
 * 文件：index.ts
 * 功能：定时/周期任务引擎的 Cordis 装配入口。
 * 作用：把任务 CRUD 能力以 lfaaSchedule 名称登记到 Context，并在插件加载时启动扫描驱动；
 *       到点任务经 Agent Run 交付器创建运行，真实回执持久化后再通知观察者。
 * 边界：不写死任何业务流程——任务的 prompt 是交给模型/用户调度的内容，引擎负责触发时刻、交付和失败退避。
 * 关联文件：packages/schedule/schedule/src/store.ts、runtime.ts、cron.ts；
 *          装配补丁 packages/bundle/base/cordis.patch.yml。
 */
import type { Context } from "@deepseek-ai/cordis";
import { ScheduleRuntime, type ScheduleFireHandler } from "./runtime.js";
import { createDefaultFireHandler } from "./client.js";
import { registerScheduleTools } from "./tools.js";
import {
  computeNextFireAt,
  createTask,
  deleteOwnerActiveTasks,
  deleteTask,
  getTask,
  listTasks,
  updateTaskStatus,
  type CreateTaskInput,
  type ScheduleTask
} from "./store.js";

export const name = "lfaaSchedule";

declare module "@deepseek-ai/cordis" {
  interface Context {
    /** 定时/周期任务引擎：注册给模型与用户调度的提醒能力。 */
    lfaaSchedule: LfaaScheduleService;
  }
  interface Events {
    /** 到点任务事件：会话/agent 分片监听后把 prompt 投递给对应会话。 */
    "schedule/fire"(task: ScheduleTask): void;
    /** 任务集合发生增删改，客户端可据此刷新列表。 */
    "schedule/changed"(): void;
  }
}

/** 对外暴露的定时任务能力。 */
export interface LfaaScheduleService {
  readonly create: typeof createTask;
  readonly get: typeof getTask;
  readonly list: typeof listTasks;
  readonly remove: typeof deleteTask;
  readonly removeOwnerActive: typeof deleteOwnerActiveTasks;
  readonly setStatus: typeof updateTaskStatus;
  readonly nextFireAt: typeof computeNextFireAt;
  /** 允许上层替换到点回调（例如接会话投递），驱动在下一次触发使用新回调。 */
  setFireHandler(handler: ScheduleFireHandler): void;
  /** 重新请求驱动（任务被外部直接改库后调用）。 */
  requestDrive(): void;
}

export function apply(ctx: Context): void {
  let fireHandler: ScheduleFireHandler = createDefaultFireHandler(ctx);
  const runtime = new ScheduleRuntime(ctx, task => fireHandler(task));
  const changed = () => {
    try { ctx.emit("schedule/changed"); } catch { /* 观察者异常不能回滚已提交的变更。 */ }
    runtime.requestDrive();
  };
  const service: LfaaScheduleService = {
    create(input: CreateTaskInput) { const task = createTask(input); changed(); return task; },
    get: getTask, list: listTasks,
    remove(id) { const removed = deleteTask(id); if (removed) changed(); return removed; },
    removeOwnerActive(ownerId) { const removed = deleteOwnerActiveTasks(ownerId); if (removed) changed(); return removed; },
    setStatus(id, status) { const result = updateTaskStatus(id, status); if (result) changed(); return result; },
    nextFireAt: computeNextFireAt,
    setFireHandler(handler) { fireHandler = createDefaultFireHandler(ctx, handler); runtime.requestDrive(); },
    requestDrive() { runtime.requestDrive(); }
  };
  ctx.provide(name, service);
  registerScheduleTools(ctx);
  runtime.start();
  ctx.effect(() => () => runtime.dispose());
}

// Cordis Loader 优先采用 default；默认导出必须是插件，而非运行时服务对象。
export default { name, inject: ["lfaaStorage", "lfaaTools"], apply };
