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

/** 左右栏展开/收起过渡期间在 Shell 上打 data-pane-animating 标记，过渡结束自动撤除，供 CSS 关模糊与子区跳过回流。 */
export function usePaneAnimatingFlag(
  shellRef: RefObject<HTMLDivElement | null>,
  leftOpen: boolean,
  rightOpen: boolean,
  isCompact: boolean,
): void {
  const prevRef = useRef<{ left: boolean; right: boolean } | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = { left: leftOpen, right: rightOpen };
    if (!prev || isCompact) return;
    if (prev.left === leftOpen && prev.right === rightOpen) return;
    const shellEl = shellRef.current;
    if (!shellEl) return;
    shellEl.dataset.paneAnimating = "true";
    const clear = () => { delete shellEl.dataset.paneAnimating; };
    const onEnd = (event: TransitionEvent) => {
      if (event.target === shellEl && event.propertyName === "grid-template-columns") clear();
    };
    shellEl.addEventListener("transitionend", onEnd);
    const timer = window.setTimeout(clear, 320);
    return () => {
      shellEl.removeEventListener("transitionend", onEnd);
      window.clearTimeout(timer);
      clear();
    };
  }, [isCompact, leftOpen, rightOpen, shellRef]);
}
