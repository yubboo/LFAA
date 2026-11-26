// 可见性感知的轮询 Hook：标签页在后台时停表、回到前台立即补一次再恢复，供工作台各面板共用。
// 面板即使被遮挡或停在起始页也常驻挂载，如果继续无条件 setInterval，就会在用户无事可做时持续打接口、改状态。
import { useEffect, useRef } from "react";

/** 在页面可见期间按固定间隔执行回调；delayMs 传 null 表示当前不需要轮询（自建计时器不启动）。 */
export function useVisibleInterval(callback: () => void, delayMs: number | null): void {
  const latest = useRef(callback);
  latest.current = callback;

  useEffect(() => {
    if (delayMs === null || delayMs <= 0 || typeof window === "undefined") return undefined;
    const isHidden = (): boolean => document.visibilityState === "hidden";
    let timer: number | null = null;

    // 计时器只在可见期间跑：隐藏时直接清掉，避免定时器把后台标签页反复叫醒。
    const start = (): void => {
      if (timer !== null) return;
      timer = window.setInterval(() => {
        if (!isHidden()) latest.current();
      }, delayMs);
    };
    const stop = (): void => {
      if (timer === null) return;
      window.clearInterval(timer);
      timer = null;
    };
    // 回到前台立刻补一次，不必空等一个完整周期才刷新。
    const onVisibilityChange = (): void => {
      if (isHidden()) {
        stop();
        return;
      }
      latest.current();
      start();
    };

    if (!isHidden()) start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [delayMs]);
}