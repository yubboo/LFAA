// 共享浮层关闭监听 Hook：统一处理外部指针点击、Escape 关闭与焦点归还，消除各菜单重复事件绑定。
import { useEffect, type RefObject } from "react";

/** 在浮层打开期间监听外部点击与 Escape；Esc 关闭时按需将焦点归还触发器。 */
export function useDismissibleLayer({
  open,
  refs,
  onClose,
  returnFocusRef,
  stopEscapePropagation = true,
}: {
  open: boolean;
  /** 视为浮层内部的容器引用（面板本体 + 触发器等）。 */
  refs: ReadonlyArray<RefObject<HTMLElement | null> | undefined>;
  onClose: () => void;
  /** 按 Esc 关闭后要回焦的元素（通常为触发按钮）。 */
  returnFocusRef?: RefObject<HTMLElement | null> | undefined;
  stopEscapePropagation?: boolean;
}): void {
  useEffect(() => {
    if (!open || typeof document === "undefined") return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      for (const ref of refs) {
        if (ref?.current?.contains(target)) return;
      }
      onClose();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (stopEscapePropagation) event.stopPropagation();
      onClose();
      returnFocusRef?.current?.focus();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [onClose, open, refs, returnFocusRef, stopEscapePropagation]);
}
