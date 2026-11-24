// 面板轨道过渡的暂停开关：窗口缩放与拖拽吸附由指针／视口直接驱动宽度，这期间暂停轨道过渡，
// 避免面板宽度始终慢半拍；暂停结束后自动恢复，调用方无需关心计时器。
import { useCallback, useEffect, useRef, type RefObject } from "react";

/** 返回「暂停轨道过渡」函数：在 Shell 节点上打 200ms 的暂停标记。 */
export function usePaneMotionSuspend(shellRef: RefObject<HTMLDivElement | null>, holdMs = 200): () => void {
  const timerRef = useRef<number | null>(null);

  const suspend = useCallback(() => {
    const shellEl = shellRef.current;
    if (!shellEl) return;
    shellEl.dataset.paneResizing = "true";
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      delete shellEl.dataset.paneResizing;
    }, holdMs);
  }, [holdMs, shellRef]);

  useEffect(() => {
    const onResize = () => suspend();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (shellRef.current) delete shellRef.current.dataset.paneResizing;
    };
  }, [shellRef, suspend]);

  return suspend;
}
