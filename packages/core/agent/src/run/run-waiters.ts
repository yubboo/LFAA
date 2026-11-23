// @lfaa/agent 运行等待器：记录「谁在等这次运行收口」，用于群聊串行编排与外部同步等待。
// 与运行表解耦：运行服务在收口时调 wake，等待方只关心 promise，不碰运行记录。

/** 按 runId 收集等待者的注册表。 */
export class RunWaiterRegistry {
  private readonly waiters = new Map<string, Set<() => void>>();

  /** 是否有人正在等这次运行；用于诊断与测试断言。 */
  has(runId: string): boolean {
    return (this.waiters.get(runId)?.size ?? 0) > 0;
  }

  /**
   * 等待运行收口。已经不在运行中的 id 由调用方先行过滤，这里只负责挂起与超时；
   * 超时返回而不抛错，由调用方根据运行状态决定如何收尾。
   */
  async wait(runId: string, timeoutMs: number): Promise<void> {
    const set = this.waiters.get(runId) ?? new Set<() => void>();
    this.waiters.set(runId, set);
    let wake!: () => void;
    const signal = new Promise<void>((resolve) => {
      wake = resolve;
    });
    set.add(wake);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, timeoutMs);
    });
    try {
      await Promise.race([signal, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
      set.delete(wake);
      if (set.size === 0 && this.waiters.get(runId) === set) this.waiters.delete(runId);
    }
  }

  /** 运行收口时唤醒全部等待者；没有等待者时是空操作。 */
  wake(runId: string): void {
    const set = this.waiters.get(runId);
    if (!set) return;
    this.waiters.delete(runId);
    for (const resolve of set) resolve();
  }

  /** 清空所有等待（进程收尾或测试重置用）。 */
  clear(): void {
    for (const set of this.waiters.values()) for (const resolve of set) resolve();
    this.waiters.clear();
  }
}