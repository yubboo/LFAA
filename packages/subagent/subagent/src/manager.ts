/**
 * 功能：子代理驱动注册表与活动运行追踪。
 * 作用：按名解析驱动、派发一次性子任务、追踪活动运行并提供列表/取消；不写死业务流程，只提供能力。
 * 安全：取消父运行会转发到驱动；失败永远 settle 为结果对象而非抛错，避免污染模型工具结果合同。
 * 关联文件：types.ts、tool-subagent、tool-subagent-control、各驱动包。
 */
import { randomUUID } from "node:crypto";
import { logger } from "lfaa-telemetry-logger/src/logger.js";
import type { SubagentDriver, SubagentDriverContext, SubagentRunHandle, SubagentRunResult, SubagentTask } from "./types.js";
import { assertProviderName } from "./invariant.js";
import { nextLifecycle } from "./lifecycle.js";
import type { KillTreeResult } from "lfaa-win32-process";

/** 活动运行最多同时追踪数量，防止失控委派撑爆内存。 */
const MAX_TRACKED_RUNS = 64;

export class SubagentManager {
  private readonly drivers = new Map<string, SubagentDriver>();
  private readonly runs = new Map<string, SubagentRunHandle>();

  constructor(private readonly terminateProcessTree?: (pid: number) => Promise<KillTreeResult>) {}

  /** 登记一个驱动；返回卸载函数。同名覆盖直接拒绝，避免静默替换。 */
  registerDriver(driver: SubagentDriver): () => void {
    assertProviderName(driver.name);
    if (this.drivers.has(driver.name)) throw new Error(`子代理驱动 "${driver.name}" 已登记。`);
    this.drivers.set(driver.name, driver);
    return () => { if (this.drivers.get(driver.name) === driver) this.drivers.delete(driver.name); };
  }

  /** 列出当前可用驱动名与显示名。 */
  listDrivers(): Array<{ name: string; displayName: string }> {
    return [...this.drivers.values()].map(driver => ({ name: driver.name, displayName: driver.displayName }));
  }

  /** 列出某账户的活动（及近期）子任务，最新在前。 */
  listRuns(userId: string): Array<{ runId: string; driver: string; description: string; appId: SubagentRunHandle["appId"]; parentRunId: string | null; status: SubagentRunHandle["status"]; startedAt: string }> {
    return [...this.runs.values()]
      .filter(run => run.userId === userId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, 32)
      .map(run => ({ runId: run.runId, driver: run.driver, description: run.description, appId: run.appId, parentRunId: run.parentRunId ?? null, status: run.status, startedAt: run.startedAt }));
  }

  /** 只返回本账户句柄；等待结果不创建任务，也不取消原任务。 */
  getRun(userId: string, runId: string): SubagentRunHandle | null {
    const run = this.runs.get(runId);
    return run?.userId === userId ? run : null;
  }

  /** 取消某账户的一个活动子任务；幂等。 */
  cancelRun(userId: string, runId: string): boolean {
    const run = this.runs.get(runId);
    if (!run || run.userId !== userId) return false;
    run.cancel();
    return true;
  }

  /**
   * 派发一个一次性子任务。创建内部 AbortController 并链到父信号；
   * 驱动抛错一律转换为 error 结果，绝不让模型工具执行因驱动异常而崩溃。
   */
  start(task: SubagentTask, ctx: SubagentDriverContext): SubagentRunHandle {
    const driver = this.drivers.get(task.driver);
    if (!driver) throw new Error(`子代理驱动 "${task.driver}" 未登记；可用：${[...this.drivers.keys()].join("、") || "无"}。`);
    // 淘汰终态记录，避免长期使用后永久耗尽 64 个槽；活动任务不淘汰。
    for (const [id, run] of this.runs) {
      if (this.runs.size < MAX_TRACKED_RUNS) break;
      if (run.status !== "running") this.runs.delete(id);
    }
    if (this.runs.size >= MAX_TRACKED_RUNS) throw new Error(`活动子任务已达 ${MAX_TRACKED_RUNS} 个上限；请等待或取消后再委派。`);
    const runId = randomUUID();
    const controller = new AbortController();
    const forwardAbort = (): void => { if (!controller.signal.aborted) controller.abort(ctx.signal.reason instanceof Error ? ctx.signal.reason : new DOMException("父运行已取消", "AbortError")); };
    if (ctx.signal.aborted) forwardAbort();
    else ctx.signal.addEventListener("abort", forwardAbort, { once: true });

    const placeholderResult: SubagentRunResult = { runId, stopReason: "error", answer: "", diagnostic: "子任务尚未开始。" };
    const handle: SubagentRunHandle = {
      runId,
      driver: task.driver,
      description: task.description,
      userId: ctx.userId,
      appId: task.appId,
      ...(task.parentRunId ? { parentRunId: task.parentRunId } : {}),
      startedAt: new Date().toISOString(),
      status: "running",
      cancel: () => forwardAbort(),
      done: Promise.resolve(placeholderResult)
    };

    const driverContext: SubagentDriverContext = {
      ...ctx,
      signal: controller.signal,
      ...(this.terminateProcessTree ? { terminateProcessTree: this.terminateProcessTree } : {})
    };
    const done = (async (): Promise<SubagentRunResult> => {
      let result: SubagentRunResult;
      try {
        ctx.onProgress(`子任务「${task.description}」已交由 ${driver.displayName} 启动。`);
        controller.signal.throwIfAborted();
        result = await driver.run(task, driverContext);
        if (controller.signal.aborted) result = { ...result, stopReason: "aborted" };
        result = { ...result, runId };
      } catch (error) {
        const aborted = controller.signal.aborted;
        result = {
          runId,
          stopReason: aborted ? "aborted" : "error",
          answer: "",
          diagnostic: error instanceof Error ? error.message.slice(0, 4096) : "子代理驱动执行失败。"
        };
        logger.warn("子代理任务失败", { driver: task.driver, runId, errorName: aborted ? "AbortError" : (error instanceof Error ? error.name : "UnknownError") });
      }
      // 用状态机收敛终态：completed→completed，aborted/error 各自映射，终态后不再迁移。
      const event = result.stopReason === "completed" ? "complete" as const
        : result.stopReason === "aborted" ? "abort" as const
        : "fail" as const;
      handle.status = nextLifecycle("running", event);
      try { ctx.onProgress(`子任务「${task.description}」已结束：${result.stopReason}。`); } catch { /* 观察者不能改变已完成的结果。 */ }
      return result;
    })();

    Object.defineProperty(handle, "done", { value: done, enumerable: true });
    void done.finally(() => {
      ctx.signal.removeEventListener("abort", forwardAbort);
      // 保留最近完成记录供控制工具查询；卸载时由 close 清空。
    });
    this.runs.set(runId, handle);
    return handle;
  }

  /** 宿主卸载：标记所有活动运行为异常结束，不等待外部进程自行退出。 */
  close(): void {
    for (const run of this.runs.values()) run.cancel();
    this.runs.clear();
    this.drivers.clear();
  }
}
