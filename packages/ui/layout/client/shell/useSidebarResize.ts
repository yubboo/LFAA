// 管理浏览器工作台的左右栏调宽、弹性吸附和本地宽度偏好。
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { WORKBENCH_REGIONS } from "../../contract/index";
import {
  computeKeyResizeWidth,
  computeMaxPanelWidth,
  computePushedRightWidth,
  computeResizeOutcome,
  hasExceededDragThreshold,
  type ResizeSide,
} from "./sidebar-resize";
import {
  LEFT_SIDEBAR_WIDTH_STORAGE_KEY,
  RIGHT_PANEL_WIDTH_STORAGE_KEY,
  readPanelWidthPref,
  writePanelWidthPref,
} from "./ui-preferences";

/** 将共享的侧栏方向类型提供给手柄与 Shell。 */
export type { ResizeSide } from "./sidebar-resize";

/** 记录拖拽起点及测量结果，以便合并指针更新。 */
export interface ActiveDragState {
  side: ResizeSide;
  snappedCollapsed: boolean;
  width: number;
}

// 容纳浏览器栅格布局把 CSS 小数换算为内部布局单位时的测量误差。
const LAYOUT_WIDTH_TOLERANCE = 0.05;

/** 统一管理侧栏的指针拖拽、键盘调宽和拖拽结束时的持久化。 */
export function useSidebarResize({
  shellRef,
  isCompact,
  leftOpen,
  rightOpen,
  onCollapseSide,
  onBeforeDrag,
}: {
  shellRef: RefObject<HTMLDivElement | null>;
  isCompact: boolean;
  leftOpen: boolean;
  rightOpen: boolean;
  onCollapseSide: (side: ResizeSide) => void;
  onBeforeDrag?: () => void;
}) {
  const [leftWidth, setLeftWidth] = useState<number | null>(() => readPanelWidthPref(LEFT_SIDEBAR_WIDTH_STORAGE_KEY));
  const [rightWidth, setRightWidth] = useState<number | null>(() => readPanelWidthPref(RIGHT_PANEL_WIDTH_STORAGE_KEY));
  const [dragState, setDragState] = useState<ActiveDragState | null>(null);
  const dragStateRef = useRef<ActiveDragState | null>(null);
  const cleanupDragRef = useRef<(() => void) | null>(null);

  const commitDragRef = (next: ActiveDragState | null) => {
    dragStateRef.current = next;
    setDragState(next);
  };

  // 共用持久化入口，左二推挤后的右栏宽度也能在刷新时恢复。
  const saveWidth = useCallback((side: ResizeSide, width: number) => {
    const savedWidth = Math.round(width);
    if (side === "left") {
      setLeftWidth(savedWidth);
      writePanelWidthPref(LEFT_SIDEBAR_WIDTH_STORAGE_KEY, savedWidth);
    } else {
      setRightWidth(savedWidth);
      writePanelWidthPref(RIGHT_PANEL_WIDTH_STORAGE_KEY, savedWidth);
    }
  }, []);

  useEffect(() => () => {
    cleanupDragRef.current?.();
  }, []);

  // React 提交新持久化基础宽度后，再清理瞬时拖拽宽度变量，避免交接闪烁或误删基础宽度。
  useLayoutEffect(() => {
    if (dragState !== null) return;
    const shellEl = shellRef.current;
    if (!shellEl) return;
    shellEl.style.removeProperty("--left-drag-width");
    shellEl.style.removeProperty("--right-drag-width");
  }, [dragState, leftWidth, rightWidth, shellRef]);

  const readLayoutMetrics = useCallback(() => {
    const shellEl = shellRef.current;
    if (!shellEl) return null;
    const shellRect = shellEl.getBoundingClientRect();
    const railEl = shellEl.querySelector(`[data-region="${WORKBENCH_REGIONS[0]}"]`);
    const leftEl = shellEl.querySelector(`[data-region="${WORKBENCH_REGIONS[1]}"]`);
    const rightEl = shellEl.querySelector(`[data-region="${WORKBENCH_REGIONS[3]}"]`);
    // 「预览区在左」时最右一列是会话列（workspace），它带 data-pane="right" 标记；
    // 仅在该布局下优先取它，避免把中间列的工作台宽度当成右栏起始宽度。
    const rightPaneEl = shellEl.dataset.layout === "preview-center"
      ? (shellEl.querySelector('[data-pane="right"]') ?? rightEl)
      : rightEl;
    const railRight = railEl ? railEl.getBoundingClientRect().right : shellRect.left + 69.6;
    const railWidth = Math.max(0, railRight - shellRect.left);
    const currentLeftWidth = leftEl ? leftEl.getBoundingClientRect().width : (leftWidth ?? 260);
    const currentRightWidth = rightPaneEl ? rightPaneEl.getBoundingClientRect().width : (rightWidth ?? 260);
    return { shellEl, shellRect, railWidth, currentLeftWidth, currentRightWidth };
  }, [leftWidth, rightWidth, shellRef]);

  const startResize = useCallback((side: ResizeSide, event: PointerEvent<HTMLDivElement>) => {
    if (isCompact || event.button !== 0) return;
    const metrics = readLayoutMetrics();
    if (!metrics) return;
    event.preventDefault();
    cleanupDragRef.current?.();

    const { shellEl, shellRect, railWidth, currentLeftWidth, currentRightWidth } = metrics;
    const oppositeWidth = side === "left"
      ? (rightOpen ? currentRightWidth : 0)
      : (leftOpen ? currentLeftWidth : 0);
    const initialWidth = side === "left" ? currentLeftWidth : currentRightWidth;
    const resizeBounds = { side, shellWidth: shellRect.width, railWidth, oppositeWidth };
    const dragWidthVar = side === "left" ? "--left-drag-width" : "--right-drag-width";
    const handleEl = event.currentTarget;
    const pointerId = event.pointerId;
    const startClientX = event.clientX;

    let rafId: number | null = null;
    let latestClientX = startClientX;
    let lastVisualWidth = initialWidth;
    let hasElasticTension = false;
    let dragActivated = false;
    let prevCursor = "";
    let prevUserSelect = "";
    let captured = false;

    // 仅左二向右才联动右栏。沿用临时宽度变量，回拉时撤掉联动并恢复原值。
    const previewRightPush = (nextLeftWidth: number) => {
      if (side !== "left" || !rightOpen) return null;
      const width = computePushedRightWidth(initialWidth, nextLeftWidth, currentRightWidth);
      if (width === null) {
        shellEl.style.removeProperty("--right-drag-width");
      } else {
        shellEl.style.setProperty("--right-drag-width", `${width}px`);
      }
      return width;
    };

    const activateDrag = () => {
      dragActivated = true;
      onBeforeDrag?.();
      // 写入第一帧宽度前先切换绘制状态，不等待 React 提交拖拽状态。
      shellEl.dataset.resizing = "true";
      shellEl.style.setProperty(dragWidthVar, `${initialWidth}px`);
      commitDragRef({ side, snappedCollapsed: false, width: initialWidth });

      prevCursor = document.body.style.cursor;
      prevUserSelect = document.body.style.userSelect;
      document.body.style.cursor = "col-resize";
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
      const current = dragStateRef.current;
      if (!current) return;

      const deltaX = latestClientX - startClientX;
      const rawWidth = side === "left"
        ? initialWidth + deltaX
        : initialWidth - deltaX;
      const outcome = computeResizeOutcome({
        ...resizeBounds,
        rawWidth,
        wasCollapsed: current.snappedCollapsed,
      });

      const snappedChanged = current.snappedCollapsed !== outcome.snappedCollapsed;
      lastVisualWidth = outcome.visualWidth;
      hasElasticTension = outcome.tension > 0;
      shellEl.style.setProperty(dragWidthVar, outcome.snappedCollapsed ? "0px" : `${outcome.visualWidth}px`);
      previewRightPush(outcome.visualWidth);

      dragStateRef.current = { side, snappedCollapsed: outcome.snappedCollapsed, width: outcome.width };
      if (snappedChanged) {
        setDragState({ side, snappedCollapsed: outcome.snappedCollapsed, width: outcome.width });
      }
    };

    const onPointerMove = (moveEvent: globalThis.PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      // 浏览器外松开鼠标后若错过 pointerup，回到页面时结束本次调宽。
      if (moveEvent.pointerType === "mouse" && (moveEvent.buttons & 1) === 0) {
        finishDrag();
        return;
      }
      latestClientX = moveEvent.clientX;
      if (!dragActivated) {
        if (!hasExceededDragThreshold(startClientX, latestClientX)) return;
        activateDrag();
      }
      if (rafId === null) {
        rafId = window.requestAnimationFrame(applyFrame);
      }
    };

    const cleanup = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
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
        delete shellEl.dataset.resizing;
        document.body.style.cursor = prevCursor;
        document.body.style.userSelect = prevUserSelect;
      }
    };

    const finishDrag = (endEvent?: globalThis.PointerEvent | FocusEvent) => {
      if (endEvent && "pointerId" in endEvent && endEvent.pointerId !== pointerId) return;
      if (!dragActivated) {
        cleanupDragRef.current?.();
        cleanupDragRef.current = null;
        return;
      }
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        applyFrame();
      }
      cleanupDragRef.current?.();
      cleanupDragRef.current = null;

      const finalState = dragStateRef.current;
      if (!finalState) {
        shellEl.style.removeProperty(dragWidthVar);
        commitDragRef(null);
        return;
      }

      if (finalState.snappedCollapsed) {
        shellEl.style.removeProperty(dragWidthVar);
        commitDragRef(null);
        onCollapseSide(finalState.side);
        return;
      }

      commitDragRef(null);

      // 在窄窗口贴着上限拖动但没有改变宽度时，保留用户此前的宽屏偏好。
      if (!hasElasticTension && Math.abs(lastVisualWidth - initialWidth) < LAYOUT_WIDTH_TOLERANCE) return;

      const settledWidth = Math.min(finalState.width, computeMaxPanelWidth(resizeBounds));
      shellEl.style.setProperty(dragWidthVar, `${settledWidth}px`);
      const pushedRightWidth = previewRightPush(settledWidth);
      saveWidth(finalState.side, finalState.width);
      if (pushedRightWidth !== null) {
        saveWidth("right", pushedRightWidth);
      }
    };

    cleanupDragRef.current = cleanup;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);
    window.addEventListener("blur", finishDrag);
    handleEl.addEventListener("lostpointercapture", finishDrag);
  }, [isCompact, leftOpen, onBeforeDrag, onCollapseSide, readLayoutMetrics, rightOpen, saveWidth]);

  const handleKeyResize = useCallback((side: ResizeSide, event: KeyboardEvent<HTMLDivElement>) => {
    if (isCompact || dragStateRef.current) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const metrics = readLayoutMetrics();
    if (!metrics) return;
    event.preventDefault();
    const oppositeWidth = side === "left"
      ? (rightOpen ? metrics.currentRightWidth : 0)
      : (leftOpen ? metrics.currentLeftWidth : 0);
    const currentWidth = side === "left" ? metrics.currentLeftWidth : metrics.currentRightWidth;
    const resizeBounds = { side, shellWidth: metrics.shellRect.width, railWidth: metrics.railWidth, oppositeWidth };
    const nextWidth = computeKeyResizeWidth({
      ...resizeBounds,
      key: event.key,
      shiftKey: event.shiftKey,
      currentWidth,
    });
    if (Math.abs(nextWidth - currentWidth) < LAYOUT_WIDTH_TOLERANCE) return;
    const maxWidth = computeMaxPanelWidth(resizeBounds);
    saveWidth(side, nextWidth === maxWidth ? Math.ceil(maxWidth) : nextWidth);
    if (side === "left" && rightOpen) {
      const pushedRightWidth = computePushedRightWidth(currentWidth, nextWidth, oppositeWidth);
      if (pushedRightWidth !== null) {
        saveWidth("right", pushedRightWidth);
      }
    }
  }, [isCompact, leftOpen, readLayoutMetrics, rightOpen, saveWidth]);

  return {
    leftWidth,
    rightWidth,
    dragState,
    startResize,
    handleKeyResize,
  };
}
