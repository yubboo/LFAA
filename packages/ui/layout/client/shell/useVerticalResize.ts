// 管理底部面板的实时跟手纵向拖拽、0.3 弹性阻尼、50% 阈值平滑磁吸收起与键盘调高。
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import {
  computeKeyVerticalResizeHeight,
  computeVerticalResizeOutcome,
  hasExceededVerticalDragThreshold,
} from "./vertical-resize";

const LAYOUT_HEIGHT_TOLERANCE = 0.05;

/** 纵向拖拽结果与处理器：供 ShellBottomDock 与工作台底部终端共用。 */
export function useVerticalResize({
  containerRef,
  height,
  minHeight,
  maxHeight,
  onCommitHeight,
  onCollapse,
}: {
  containerRef: RefObject<HTMLElement | null>;
  height: number;
  minHeight: number;
  maxHeight: number;
  onCommitHeight: (nextHeight: number) => void;
  onCollapse: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [snapped, setSnapped] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => () => {
    cleanupRef.current?.();
  }, []);

  const startResize = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const containerEl = containerRef.current;
    if (!containerEl) return;
    event.preventDefault();
    cleanupRef.current?.();

    const handleEl = event.currentTarget;
    const pointerId = event.pointerId;
    const startClientY = event.clientY;
    const initialHeight = containerEl.getBoundingClientRect().height || height;

    let rafId: number | null = null;
    let snapAnimTimer: number | null = null;
    let latestClientY = startClientY;
    let dragActivated = false;
    let currentSnapped = false;
    let latestOutcomeHeight = initialHeight;
    let lastVisualHeight = initialHeight;
    let hasElasticTension = false;
    let prevCursor = "";
    let prevUserSelect = "";
    let captured = false;

    const triggerSnapAnim = () => {
      containerEl.dataset.resizeSnapAnim = "true";
      if (snapAnimTimer !== null) window.clearTimeout(snapAnimTimer);
      snapAnimTimer = window.setTimeout(() => {
        snapAnimTimer = null;
        delete containerEl.dataset.resizeSnapAnim;
      }, 220);
    };

    const activateDrag = () => {
      dragActivated = true;
      containerEl.dataset.resizing = "true";
      containerEl.style.setProperty("--resize-tension", "0");
      containerEl.style.height = `${initialHeight}px`;
      setDragging(true);
      setSnapped(false);

      prevCursor = document.body.style.cursor;
      prevUserSelect = document.body.style.userSelect;
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";

      try {
        if (typeof handleEl.setPointerCapture === "function") {
          handleEl.setPointerCapture(pointerId);
          captured = handleEl.hasPointerCapture?.(pointerId) ?? true;
        }
      } catch {
        // 合成事件或无真实指针 ID 时忽略捕获失败，仍由 window 监听兜底。
      }
    };

    const applyFrame = () => {
      rafId = null;
      if (!dragActivated) return;

      // 上沿手柄：往上拖变高，往下拖变矮。
      const rawHeight = initialHeight + (startClientY - latestClientY);
      const outcome = computeVerticalResizeOutcome({
        rawHeight,
        minHeight,
        maxHeight,
        wasCollapsed: currentSnapped,
      });

      const snappedChanged = currentSnapped !== outcome.snappedCollapsed;
      currentSnapped = outcome.snappedCollapsed;
      latestOutcomeHeight = outcome.height;
      lastVisualHeight = outcome.visualHeight;
      hasElasticTension = outcome.tension > 0;

      if (snappedChanged) {
        triggerSnapAnim();
      }

      containerEl.style.height = outcome.snappedCollapsed ? "0px" : `${outcome.visualHeight}px`;
      containerEl.style.setProperty("--resize-tension", String(outcome.tension));

      if (snappedChanged) {
        setSnapped(outcome.snappedCollapsed);
      }
    };

    const cleanup = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (snapAnimTimer !== null) {
        window.clearTimeout(snapAnimTimer);
        snapAnimTimer = null;
      }
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
      window.removeEventListener("blur", finishDrag);
      handleEl.removeEventListener("lostpointercapture", finishDrag);

      if (captured) {
        captured = false;
        try {
          if (handleEl.hasPointerCapture?.(pointerId)) {
            handleEl.releasePointerCapture?.(pointerId);
          }
        } catch {
          // 忽略元素已卸载时的释放异常。
        }
      }

      if (dragActivated) {
        containerEl.style.removeProperty("--resize-tension");
        delete containerEl.dataset.resizing;
        delete containerEl.dataset.resizeSnapAnim;
        document.body.style.cursor = prevCursor;
        document.body.style.userSelect = prevUserSelect;
      }
    };

    const onPointerMove = (moveEvent: globalThis.PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      if (moveEvent.pointerType === "mouse" && (moveEvent.buttons & 1) === 0) {
        finishDrag();
        return;
      }
      latestClientY = moveEvent.clientY;
      if (!dragActivated) {
        if (!hasExceededVerticalDragThreshold(startClientY, latestClientY)) return;
        activateDrag();
      }
      if (rafId === null) {
        rafId = window.requestAnimationFrame(applyFrame);
      }
    };

    const finishDrag = (endEvent?: globalThis.PointerEvent | FocusEvent) => {
      if (endEvent && "pointerId" in endEvent && endEvent.pointerId !== pointerId) return;
      if (!dragActivated) {
        cleanupRef.current?.();
        cleanupRef.current = null;
        return;
      }
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        applyFrame();
      }
      cleanupRef.current?.();
      cleanupRef.current = null;

      setDragging(false);
      setSnapped(false);

      if (currentSnapped) {
        onCollapse();
        return;
      }

      // 阻尼区松手未跨过吸附线时平滑回弹到目标高度。
      containerEl.style.height = `${latestOutcomeHeight}px`;
      if (!hasElasticTension && Math.abs(lastVisualHeight - initialHeight) < LAYOUT_HEIGHT_TOLERANCE) return;
      onCommitHeight(latestOutcomeHeight);
    };

    cleanupRef.current = cleanup;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);
    window.addEventListener("blur", finishDrag);
    handleEl.addEventListener("lostpointercapture", finishDrag);
  }, [containerRef, height, maxHeight, minHeight, onCollapse, onCommitHeight]);

  const handleKeyResize = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (dragging) return;
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const next = computeKeyVerticalResizeHeight({
      key: event.key,
      shiftKey: event.shiftKey,
      currentHeight: height,
      minHeight,
      maxHeight,
    });
    if (Math.abs(next - height) < LAYOUT_HEIGHT_TOLERANCE) return;
    onCommitHeight(next);
  }, [dragging, height, maxHeight, minHeight, onCommitHeight]);

  return {
    dragging,
    snapped,
    startResize,
    handleKeyResize,
  };
}
