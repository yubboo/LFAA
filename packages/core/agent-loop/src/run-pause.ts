/**
 * 功能：在 Agent Loop 安全检查点挂起并恢复同一个 Run。
 * 作用：与取消信号分离；暂停不 abort 当前 Provider 请求或已派发工具。
 */
export type AiRunPauseState = "running" | "pausing" | "paused";

interface PauseWaiter {
  resolve: () => void;
  signal: AbortSignal;
  abort: () => void;
}

export class AiRunPauseGate {
  private currentState: AiRunPauseState = "running";
  private waiter: PauseWaiter | null = null;

  constructor(private readonly onStateChange: (state: AiRunPauseState) => void) {}

  get state(): AiRunPauseState {
    return this.currentState;
  }

  requestPause(): AiRunPauseState {
    if (this.currentState === "running") this.setState("pausing");
    return this.currentState;
  }

  confirmPausedAtSafeWait(): void {
    if (this.currentState === "pausing") this.setState("paused");
  }

  resume(): boolean {
    if (this.currentState === "running") return false;
    this.setState("running");
    const waiter = this.waiter;
    if (waiter) {
      this.waiter = null;
      waiter.signal.removeEventListener("abort", waiter.abort);
      waiter.resolve();
    }
    return true;
  }

  async checkpoint(signal: AbortSignal): Promise<void> {
    if (signal.aborted) throw signal.reason ?? new DOMException("Run 已取消。", "AbortError");
    if (this.currentState === "running") return;
    if (this.currentState === "pausing") this.setState("paused");
    if (this.currentState !== "paused") return;
    if (this.waiter) throw new Error("Agent Run 的暂停检查点发生重叠。 ");

    await new Promise<void>((resolve, reject) => {
      const abort = () => {
        if (this.waiter?.abort !== abort) return;
        this.waiter = null;
        signal.removeEventListener("abort", abort);
        reject(signal.reason ?? new DOMException("Run 已取消。", "AbortError"));
      };
      this.waiter = { resolve, signal, abort };
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
      else if (this.currentState !== "paused") {
        this.waiter = null;
        signal.removeEventListener("abort", abort);
        resolve();
      }
    });
  }

  private setState(state: AiRunPauseState): void {
    if (state === this.currentState) return;
    this.currentState = state;
    try { this.onStateChange(state); } catch { /* 状态观察者不能打断 Run 生命周期。 */ }
  }
}
