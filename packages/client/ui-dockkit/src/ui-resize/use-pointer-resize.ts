/**
 * 文件：use-pointer-resize.ts
 * 作用：为 Client 表面提供可复用的横向/纵向 Pointer 拉伸生命周期。
 * 负责：主指针捕获、动画帧合并增量、拖动状态光标和取消/失焦/隐藏/卸载清理。
 * 不负责：尺寸约束、业务布局、尺寸持久化或窗格吸附。
 * 状态归属：调用组件提供尺寸回调；Hook 只持有本次短期 Pointer 会话。
 * 对外接口：usePointerResize(options) 返回 Pointer Down/Move/Up/Cancel 与捕获丢失处理器。
 * 关联文件：ui-resize/index.ts、ResizableWorkbench.tsx、调用方表面。
 */
import { useCallback, useEffect, useRef, type PointerEvent } from "react";

export type PointerResizeAxis = "horizontal" | "vertical";

export interface PointerResizeOptions<Context> {
  axis?: PointerResizeAxis;
  bodyClassName?: string;
  onResizeStart?: (context: Context, event: PointerEvent<HTMLElement>) => void;
  onResize: (context: Context, delta: number) => void;
  onResizeEnd?: (context: Context, cancelled: boolean) => void;
}

export interface PointerResizeHandlers<Context> {
  onPointerDown: (event: PointerEvent<HTMLElement>, context: Context) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
  onLostPointerCapture: (event: PointerEvent<HTMLElement>) => void;
}

interface ActivePointerResize<Context> {
  context: Context;
  element: HTMLElement;
  pointerId: number;
  axis: PointerResizeAxis;
  startCoordinate: number;
  lastDelta: number;
  pendingDelta: number;
  frameId: number | null;
}

/**
 * 将 Pointer 增量限制到每帧最多一次回调。调用方在 onResize 中执行自己的边界约束，
 * 并在 onResizeEnd(cancelled=true) 时恢复拖动前状态。
 */
export function usePointerResize<Context>(options: PointerResizeOptions<Context>): PointerResizeHandlers<Context> {
  const optionsRef = useRef(options);
  const activeRef = useRef<ActivePointerResize<Context> | null>(null);
  const removeLifecycleListenersRef = useRef<(() => void) | null>(null);
  optionsRef.current = options;

  const finish = useCallback((pointerId: number, cancelled: boolean) => {
    const active = activeRef.current;
    if (!active || active.pointerId !== pointerId) return;

    if (active.frameId !== null) {
      window.cancelAnimationFrame(active.frameId);
      active.frameId = null;
    }
    if (!cancelled && active.pendingDelta !== active.lastDelta) {
      active.lastDelta = active.pendingDelta;
      optionsRef.current.onResize(active.context, active.pendingDelta);
    }

    activeRef.current = null;
    removeLifecycleListenersRef.current?.();
    removeLifecycleListenersRef.current = null;
    document.body.classList.remove(optionsRef.current.bodyClassName ?? "lfaa-is-resizing");
    optionsRef.current.onResizeEnd?.(active.context, cancelled);

    try {
      if (active.element.hasPointerCapture(pointerId)) active.element.releasePointerCapture(pointerId);
    } catch {
      // 浏览器在失焦/移除目标时可能已自行释放捕获。
    }
  }, []);

  const onPointerDown = useCallback((event: PointerEvent<HTMLElement>, context: Context) => {
    if (event.button !== 0 || event.isPrimary === false || activeRef.current) return;
    event.preventDefault();
    event.stopPropagation();

    const axis = optionsRef.current.axis ?? "horizontal";
    const element = event.currentTarget;
    try {
      element.setPointerCapture(event.pointerId);
    } catch {
      return;
    }

    const startCoordinate = axis === "horizontal" ? event.clientX : event.clientY;
    activeRef.current = {
      context,
      element,
      pointerId: event.pointerId,
      axis,
      startCoordinate,
      lastDelta: 0,
      pendingDelta: 0,
      frameId: null,
    };
    document.body.classList.add(optionsRef.current.bodyClassName ?? "lfaa-is-resizing");
    optionsRef.current.onResizeStart?.(context, event);

    const cancelOnBlur = () => finish(event.pointerId, true);
    const cancelWhenHidden = () => {
      if (document.visibilityState === "hidden") cancelOnBlur();
    };
    window.addEventListener("blur", cancelOnBlur);
    document.addEventListener("visibilitychange", cancelWhenHidden);
    removeLifecycleListenersRef.current = () => {
      window.removeEventListener("blur", cancelOnBlur);
      document.removeEventListener("visibilitychange", cancelWhenHidden);
    };
  }, [finish]);

  const onPointerMove = useCallback((event: PointerEvent<HTMLElement>) => {
    const active = activeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    active.pendingDelta = (active.axis === "horizontal" ? event.clientX : event.clientY) - active.startCoordinate;
    if (active.frameId !== null) return;

    active.frameId = window.requestAnimationFrame(() => {
      const current = activeRef.current;
      if (current !== active || current.pendingDelta === current.lastDelta) {
        active.frameId = null;
        return;
      }
      current.frameId = null;
      current.lastDelta = current.pendingDelta;
      optionsRef.current.onResize(current.context, current.pendingDelta);
    });
  }, []);

  const onPointerUp = useCallback((event: PointerEvent<HTMLElement>) => {
    event.stopPropagation();
    finish(event.pointerId, false);
  }, [finish]);

  const onPointerCancel = useCallback((event: PointerEvent<HTMLElement>) => {
    event.stopPropagation();
    finish(event.pointerId, true);
  }, [finish]);

  const onLostPointerCapture = useCallback((event: PointerEvent<HTMLElement>) => {
    finish(event.pointerId, true);
  }, [finish]);

  useEffect(() => () => {
    const active = activeRef.current;
    if (active) finish(active.pointerId, true);
  }, [finish]);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onLostPointerCapture };
}
