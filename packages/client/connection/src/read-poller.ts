/**
 * 功能：串行调度界面的只读对账请求。
 * 作用：合并请求期间的刷新触发，暂停隐藏页面的对账，并在恢复可见时刷新；不管理后台业务任务。
 * 关联文件：App、MinecraftWorkspace、TaskTerminal、FileManagerPage、SettingsPage；调用方负责错误显示与已发请求的过期响应校验。
 */
export function createReadPoller(read: () => Promise<unknown>, intervalMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<void> | null = null;
  let queued = false;
  let stopped = false;
  const visible = () => typeof document === "undefined" || document.visibilityState !== "hidden";
  const clearTimer = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };

  // 一个在途请求最多保留一次尾随对账，避免 Socket 推送和定时器同时制造请求风暴。
  function refresh(): Promise<void> {
    if (stopped || !visible()) return Promise.resolve();
    clearTimer();
    if (running) { queued = true; return running; }
    running = Promise.resolve().then(async () => {
      do {
        queued = false;
        if (stopped || !visible()) break;
        await read();
      } while (queued && !stopped && visible());
    }).finally(() => {
      running = null;
      if (!stopped && visible()) timer = setTimeout(trigger, intervalMs);
    });
    return running;
  }
  // 调用方的 read 处理界面错误；调度器吸收失败以继续下一轮，而手动 refresh 仍可观察失败。
  function trigger() { void refresh().catch(() => undefined); }
  function onVisibility() { clearTimer(); queued = false; if (visible()) trigger(); }
  function onFocus() { if (visible() && !running) trigger(); }
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibility);
  if (typeof window !== "undefined") window.addEventListener("focus", onFocus);
  trigger();
  return {
    refresh,
    stop() {
      stopped = true;
      queued = false;
      clearTimer();
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility);
      if (typeof window !== "undefined") window.removeEventListener("focus", onFocus);
    }
  };
}
