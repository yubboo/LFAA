/**
 * 文件：useDismissibleLayer.ts
 * 作用：为 Popover / Menu / Floating Card 提供统一的“点击空白处关闭 + Esc 关闭”行为。
 * 负责：监听 document pointerdown（capture）与 Escape；只在事件发生于 layer 外部时调用 onDismiss。
 * 不负责：定位、动画、焦点陷阱、业务状态。
 * 状态归属：调用方拥有 open；本 Hook 只管理监听器生命周期。
 * 对外接口：useDismissibleLayer。
 * 修改注意事项：必须使用 pointerdown capture，避免 click/focus 顺序导致浮层闪烁；不要在每个业务组件重复实现 outside-click。
 */
import { useEffect, useRef, type RefObject } from "react";

export interface DismissibleLayerOptions {
  open: boolean;
  onDismiss: () => void;
  closeOnEscape?: boolean;
}

export function useDismissibleLayer<T extends HTMLElement>({
  open,
  onDismiss,
  closeOnEscape = true,
}: DismissibleLayerOptions): RefObject<T | null> {
  const layerRef = useRef<T | null>(null);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const layer = layerRef.current;
      if (!layer) return;
      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      if (path.includes(layer) || layer.contains(event.target as Node | null)) return;
      dismissRef.current();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!closeOnEscape || event.key !== "Escape") return;
      dismissRef.current();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeOnEscape, open]);

  return layerRef;
}
