/**
 * 功能：跟踪 AI Work 页面最近一次用户活动，并在空闲期触发一次虚化状态变化。
 * 作用：高频活动只更新时间戳，保留单个待处理计时器，并支持隐藏、恢复与卸载清理。
 */
export interface OutputIdleBlurControllerOptions {
  idleDelayMs: number;
  onIdleChange: (idle: boolean) => void;
  now?: () => number;
  setTimeout?: (callback: () => void, delayMs: number) => unknown;
  clearTimeout?: (handle: unknown) => void;
}

export interface OutputIdleBlurController {
  notifyActivity(): void;
  suspend(): void;
  resume(): void;
  dispose(): void;
}

export function createOutputIdleBlurController(options: OutputIdleBlurControllerOptions): OutputIdleBlurController {
  const idleDelayMs = Math.max(1, options.idleDelayMs);
  const now = options.now ?? (() => globalThis.performance?.now?.() ?? Date.now());
  const scheduleTimeout = options.setTimeout ?? ((callback, delayMs) => globalThis.setTimeout(callback, delayMs));
  const cancelTimeout = options.clearTimeout ?? (handle => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>));
  let lastActivityAt = now();
  let timeoutHandle: unknown = null;
  let idle = false;
  let suspended = true;
  let disposed = false;

  const clearTimer = (): void => {
    if (timeoutHandle === null) return;
    cancelTimeout(timeoutHandle);
    timeoutHandle = null;
  };

  const schedule = (): void => {
    if (disposed || suspended || timeoutHandle !== null) return;
    const remainingMs = Math.max(0, idleDelayMs - (now() - lastActivityAt));
    timeoutHandle = scheduleTimeout(() => {
      timeoutHandle = null;
      if (disposed || suspended) return;
      const remainingAfterActivity = idleDelayMs - (now() - lastActivityAt);
      if (remainingAfterActivity > 0) {
        schedule();
        return;
      }
      if (idle) return;
      idle = true;
      options.onIdleChange(true);
    }, Math.max(1, Math.ceil(remainingMs)));
  };

  return {
    notifyActivity() {
      if (disposed || suspended) return;
      lastActivityAt = now();
      if (idle) {
        idle = false;
        options.onIdleChange(false);
      }
      schedule();
    },
    suspend() {
      if (disposed || suspended) return;
      suspended = true;
      clearTimer();
      if (idle) {
        idle = false;
        options.onIdleChange(false);
      }
    },
    resume() {
      if (disposed || !suspended) return;
      suspended = false;
      lastActivityAt = now();
      schedule();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      clearTimer();
    }
  };
}
