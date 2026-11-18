// 管理左二与右侧栏 rAF 流畅跟手拖拽拉伸、点击防误触阈值、弹性阻尼过渡与松手固化逻辑。
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { WORKBENCH_REGIONS } from "../src/index";
import {
  MIN_PANEL_WIDTH,
  computeKeyResizeWidth,
  computeResizeOutcome,
  hasExceededDragThreshold,
} from "./sidebar-resize";
import {
  LEFT_SIDEBAR_WIDTH_STORAGE_KEY,
  RIGHT_PANEL_WIDTH_STORAGE_KEY,
  readPanelWidthPref,
  writePanelWidthPref,
} from "./ui-preferences";

export type ResizeSide = "left" | "right";

export interface ActiveDragState {
  side: ResizeSide;
  snappedCollapsed: boolean;
  width: number;
}

const SNAP_ANIM_DURATION_MS = 200;

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
  const snapTimerRef = useRef<number | null>(null);
  const cleanupDragRef = useRef<(() => void) | null>(null);

  const commitDragRef = (next: ActiveDragState | null) => {
    dragStateRef.current = next;
    setDragState(next);
  };

  const triggerSnapAnimation = useCallback((shellEl: HTMLDivElement) => {
    shellEl.dataset.snapAnimating = "true";
    if (snapTimerRef.current !== null) {
      window.clearTimeout(snapTimerRef.current);
    }
    snapTimerRef.current = window.setTimeout(() => {
      snapTimerRef.current = null;
      delete shellEl.dataset.snapAnimating;
    }, SNAP_ANIM_DURATION_MS);
  }, []);

  useEffect(() => () => {
    cleanupDragRef.current?.();
    if (snapTimerRef.current !== null) {
      window.clearTimeout(snapTimerRef.current);
    }
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
    const railRight = railEl ? railEl.getBoundingClientRect().right : shellRect.left + 69.6;
    const railWidth = Math.max(0, railRight - shellRect.left);
    const currentLeftWidth = leftEl ? leftEl.getBoundingClientRect().width : (leftWidth ?? 260);
    const currentRightWidth = rightEl ? rightEl.getBoundingClientRect().width : (rightWidth ?? 260);
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
    const initialWidth = Math.max(
      MIN_PANEL_WIDTH,
      Math.round(side === "left" ? currentLeftWidth : currentRightWidth),
    );
    const dragWidthVar = side === "left" ? "--left-drag-width" : "--right-drag-width";
    const opacityVar = side === "left" ? "--left-drag-opacity" : "--right-drag-opacity";
    const handleEl = event.currentTarget;
    const pointerId = event.pointerId;
    const startClientX = event.clientX;

    let rafId: number | null = null;
    let latestClientX = startClientX;
    let lastVisualWidth = initialWidth;
    let dragActivated = false;
    let prevCursor = "";
    let prevUserSelect = "";
    let captured = false;

    const activateDrag = () => {
      dragActivated = true;
      onBeforeDrag?.();
      shellEl.style.setProperty(dragWidthVar, `${initialWidth}px`);
      shellEl.style.setProperty(opacityVar, "1");
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
        rawWidth,
        shellWidth: shellRect.width,
        railWidth,
        oppositeWidth,
        wasCollapsed: current.snappedCollapsed,
      });

      const snappedChanged = current.snappedCollapsed !== outcome.snappedCollapsed;
      if (snappedChanged) {
        triggerSnapAnimation(shellEl);
      }

      lastVisualWidth = outcome.visualWidth;
      shellEl.style.setProperty(dragWidthVar, outcome.snappedCollapsed ? "0px" : `${outcome.visualWidth}px`);
      shellEl.style.setProperty(opacityVar, outcome.snappedCollapsed ? "0" : String(Number((1 - outcome.tension * 0.28).toFixed(3))));

      dragStateRef.current = { side, snappedCollapsed: outcome.snappedCollapsed, width: outcome.width };
      if (snappedChanged) {
        setDragState({ side, snappedCollapsed: outcome.snappedCollapsed, width: outcome.width });
      }
    };

    const onPointerMove = (moveEvent: globalThis.PointerEvent) => {
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
        document.body.style.cursor = prevCursor;
        document.body.style.userSelect = prevUserSelect;
      }
    };

    const finishDrag = () => {
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
      shellEl.style.removeProperty(opacityVar);
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

      // 若在弹性阻尼区间松手，触发平滑回弹至最小展开宽度 220px
      if (lastVisualWidth < finalState.width) {
        triggerSnapAnimation(shellEl);
      }
      shellEl.style.setProperty(dragWidthVar, `${finalState.width}px`);
      commitDragRef(null);

      if (finalState.side === "left") {
        setLeftWidth(finalState.width);
        writePanelWidthPref(LEFT_SIDEBAR_WIDTH_STORAGE_KEY, finalState.width);
      } else {
        setRightWidth(finalState.width);
        writePanelWidthPref(RIGHT_PANEL_WIDTH_STORAGE_KEY, finalState.width);
      }
    };

    cleanupDragRef.current = cleanup;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);
    window.addEventListener("blur", finishDrag);
    handleEl.addEventListener("lostpointercapture", finishDrag);
  }, [isCompact, leftOpen, onBeforeDrag, onCollapseSide, readLayoutMetrics, rightOpen, triggerSnapAnimation]);

  const handleKeyResize = useCallback((side: ResizeSide, event: KeyboardEvent<HTMLDivElement>) => {
    if (isCompact) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const metrics = readLayoutMetrics();
    if (!metrics) return;
    event.preventDefault();
    const oppositeWidth = side === "left"
      ? (rightOpen ? metrics.currentRightWidth : 0)
      : (leftOpen ? metrics.currentLeftWidth : 0);
    const nextWidth = computeKeyResizeWidth({
      side,
      key: event.key,
      shiftKey: event.shiftKey,
      currentWidth: side === "left" ? metrics.currentLeftWidth : metrics.currentRightWidth,
      shellWidth: metrics.shellRect.width,
      railWidth: metrics.railWidth,
      oppositeWidth,
    });
    triggerSnapAnimation(metrics.shellEl);
    if (side === "left") {
      setLeftWidth(nextWidth);
      writePanelWidthPref(LEFT_SIDEBAR_WIDTH_STORAGE_KEY, nextWidth);
    } else {
      setRightWidth(nextWidth);
      writePanelWidthPref(RIGHT_PANEL_WIDTH_STORAGE_KEY, nextWidth);
    }
  }, [isCompact, leftOpen, readLayoutMetrics, rightOpen, triggerSnapAnimation]);

  return {
    leftWidth,
    rightWidth,
    dragState,
    startResize,
    handleKeyResize,
  };
}
