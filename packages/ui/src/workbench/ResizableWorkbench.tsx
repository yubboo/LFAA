/**
 * 文件：ResizableWorkbench.tsx
 * 作用：提供左右可拉伸、到达最小宽度即自动吸附收起的三栏工作台布局。
 * 负责：UI 布局宽度、收起状态、键盘/Pointer 交互和本地持久化。
 * 不负责：业务事实状态、资源加载、Agent 状态。
 * 状态归属：浏览器 UI 本地状态。
 * 对外接口：ResizableWorkbench。
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import type { ResizableWorkbenchProps, WorkbenchPaneLimits } from "./workbench-layout.types";
import "./workbench.css";

interface StoredLayoutState {
  leftWidth: number;
  rightWidth: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
}

interface DragState {
  side: "left" | "right";
  pointerId: number;
  rectLeft: number;
  rectRight: number;
  min: number;
  max: number;
  lastRaw: number;
  snapped: boolean;
}

const DEFAULT_LEFT: WorkbenchPaneLimits = { min: 240, max: 640, initial: 288 };
const DEFAULT_RIGHT: WorkbenchPaneLimits = { min: 300, max: 760, initial: 360 };
const HANDLE_WIDTH = 7;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function resolveNext(current: boolean, next: boolean | ((value: boolean) => boolean)) {
  return typeof next === "function" ? next(current) : next;
}

function loadState(key: string, left: WorkbenchPaneLimits, right: WorkbenchPaneLimits): StoredLayoutState {
  if (typeof window === "undefined") {
    return { leftWidth: left.initial, rightWidth: right.initial, leftCollapsed: false, rightCollapsed: false };
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) throw new Error("empty");
    const parsed = JSON.parse(raw) as Partial<StoredLayoutState>;
    return {
      leftWidth: clamp(Number(parsed.leftWidth) || left.initial, left.min, left.max),
      rightWidth: clamp(Number(parsed.rightWidth) || right.initial, right.min, right.max),
      leftCollapsed: Boolean(parsed.leftCollapsed),
      rightCollapsed: Boolean(parsed.rightCollapsed),
    };
  } catch {
    return { leftWidth: left.initial, rightWidth: right.initial, leftCollapsed: false, rightCollapsed: false };
  }
}

export function ResizableWorkbench({
  left,
  center,
  right,
  storageKey = "lfaa.workbench.layout.v4",
  leftLimits = DEFAULT_LEFT,
  rightLimits = DEFAULT_RIGHT,
  snapHysteresis = 24,
  minCenterWidth = 520,
  leftCollapsed: leftCollapsedProp,
  rightCollapsed: rightCollapsedProp,
  onLeftCollapsedChange,
  onRightCollapsedChange,
}: ResizableWorkbenchProps) {
  const initial = useMemo(() => loadState(storageKey, leftLimits, rightLimits), [storageKey, leftLimits, rightLimits]);
  const [leftWidth, setLeftWidth] = useState(initial.leftWidth);
  const [rightWidth, setRightWidth] = useState(initial.rightWidth);
  const [internalLeftCollapsed, setInternalLeftCollapsed] = useState(initial.leftCollapsed);
  const [internalRightCollapsed, setInternalRightCollapsed] = useState(initial.rightCollapsed);
  const leftCollapsed = leftCollapsedProp ?? internalLeftCollapsed;
  const rightCollapsed = rightCollapsedProp ?? internalRightCollapsed;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingRef = useRef<number | null>(null);

  const setResolvedLeftCollapsed = useCallback((next: boolean | ((value: boolean) => boolean)) => {
    const resolved = resolveNext(leftCollapsed, next);
    if (leftCollapsedProp === undefined) setInternalLeftCollapsed(resolved);
    onLeftCollapsedChange?.(resolved);
  }, [leftCollapsed, leftCollapsedProp, onLeftCollapsedChange]);

  const setResolvedRightCollapsed = useCallback((next: boolean | ((value: boolean) => boolean)) => {
    const resolved = resolveNext(rightCollapsed, next);
    if (rightCollapsedProp === undefined) setInternalRightCollapsed(resolved);
    onRightCollapsedChange?.(resolved);
  }, [onRightCollapsedChange, rightCollapsed, rightCollapsedProp]);

  const getDynamicMax = useCallback((side: "left" | "right") => {
    const root = rootRef.current;
    if (!root) return side === "left" ? leftLimits.max : rightLimits.max;
    const rect = root.getBoundingClientRect();
    const otherWidth = side === "left"
      ? (rightCollapsed ? 0 : rightWidth)
      : (leftCollapsed ? 0 : leftWidth);
    const staticMax = side === "left" ? leftLimits.max : rightLimits.max;
    const available = Math.max(0, rect.width - otherWidth - minCenterWidth - HANDLE_WIDTH * 2);
    return Math.max(0, Math.min(staticMax, available > 0 ? available : staticMax));
  }, [leftCollapsed, leftLimits.max, leftWidth, minCenterWidth, rightCollapsed, rightLimits.max, rightWidth]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify({ leftWidth, rightWidth, leftCollapsed, rightCollapsed }));
  }, [leftCollapsed, leftWidth, rightCollapsed, rightWidth, storageKey]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(([entry]) => {
      if (!entry || entry.contentRect.width <= 1120) return;
      const totalAllowed = Math.max(0, entry.contentRect.width - minCenterWidth - HANDLE_WIDTH * 2);
      const visibleLeft = leftCollapsed ? 0 : leftWidth;
      const visibleRight = rightCollapsed ? 0 : rightWidth;
      if (visibleLeft + visibleRight <= totalAllowed) return;

      const leftBase = leftCollapsed ? 0 : Math.min(leftLimits.min, totalAllowed);
      const rightBase = rightCollapsed ? 0 : Math.min(rightLimits.min, Math.max(0, totalAllowed - leftBase));
      const baseTotal = leftBase + rightBase;
      const extraAllowed = Math.max(0, totalAllowed - baseTotal);
      const leftExtra = leftCollapsed ? 0 : Math.max(0, visibleLeft - leftBase);
      const rightExtra = rightCollapsed ? 0 : Math.max(0, visibleRight - rightBase);
      const extraTotal = leftExtra + rightExtra;
      const leftShare = extraTotal > 0 ? leftExtra / extraTotal : 0.5;

      if (!leftCollapsed) setLeftWidth(clamp(leftBase + extraAllowed * leftShare, leftBase, leftLimits.max));
      if (!rightCollapsed) setRightWidth(clamp(rightBase + extraAllowed * (1 - leftShare), rightBase, rightLimits.max));
    });

    observer.observe(root);
    return () => observer.disconnect();
  }, [leftCollapsed, leftLimits.max, leftLimits.min, leftWidth, minCenterWidth, rightCollapsed, rightLimits.max, rightLimits.min, rightWidth]);

  const setPreview = useCallback((side: "left" | "right", value: number, snapped: boolean) => {
    const root = rootRef.current;
    if (!root) return;

    const columnName = side === "left" ? "--lfaa-left-column" : "--lfaa-right-column";
    const sizeName = side === "left" ? "--lfaa-left-size" : "--lfaa-right-size";

    root.dataset.snapPreview = snapped ? side : "none";
    root.dataset.autoSnap = snapped ? side : "none";
    root.style.setProperty(columnName, `${snapped ? 0 : value}px`);

    if (!snapped) {
      root.style.setProperty(sizeName, `${Math.max(value, 1)}px`);
    }
  }, []);

  const flushPending = useCallback(() => {
    frameRef.current = null;
    const rawValue = pendingRef.current;
    const drag = dragRef.current;
    if (rawValue === null || drag === null) return;

    const raw = clamp(rawValue, 0, drag.max);
    drag.lastRaw = raw;

    if (!drag.snapped && raw <= drag.min) {
      drag.snapped = true;
      setPreview(drag.side, 0, true);
      return;
    }

    if (drag.snapped) {
      if (raw >= drag.min + snapHysteresis) {
        drag.snapped = false;
        setPreview(drag.side, clamp(raw, drag.min, drag.max), false);
      } else {
        setPreview(drag.side, 0, true);
      }
      return;
    }

    setPreview(drag.side, clamp(raw, drag.min, drag.max), false);
  }, [setPreview, snapHysteresis]);

  const schedule = useCallback((value: number) => {
    pendingRef.current = value;
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(flushPending);
  }, [flushPending]);

  const onPointerDown = useCallback((event: PointerEvent<HTMLDivElement>, side: "left" | "right") => {
    const root = rootRef.current;
    if (!root) return;

    const rect = root.getBoundingClientRect();
    const staticMin = side === "left" ? leftLimits.min : rightLimits.min;
    const effectiveMax = getDynamicMax(side);
    const effectiveMin = Math.min(staticMin, effectiveMax);
    const collapsed = side === "left" ? leftCollapsed : rightCollapsed;
    const current = side === "left" ? (collapsed ? 0 : leftWidth) : (collapsed ? 0 : rightWidth);

    dragRef.current = {
      side,
      pointerId: event.pointerId,
      rectLeft: rect.left,
      rectRight: rect.right,
      min: effectiveMin,
      max: effectiveMax,
      lastRaw: current,
      snapped: collapsed,
    };

    root.dataset.dragging = side;
    root.dataset.snapPreview = collapsed ? side : "none";
    root.dataset.autoSnap = collapsed ? side : "none";
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.classList.add("lfaa-is-resizing");
  }, [getDynamicMax, leftCollapsed, leftLimits.min, leftWidth, rightCollapsed, rightLimits.min, rightWidth]);

  const onPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const raw = drag.side === "left" ? event.clientX - drag.rectLeft : drag.rectRight - event.clientX;
    schedule(raw);
  }, [schedule]);

  const finishDrag = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      const rawValue = pendingRef.current;
      if (rawValue !== null) {
        const bounded = clamp(rawValue, 0, drag.max);
        drag.lastRaw = bounded;
        if (!drag.snapped && bounded <= drag.min) drag.snapped = true;
        else if (drag.snapped && bounded >= drag.min + snapHysteresis) drag.snapped = false;
      }
    }

    const root = rootRef.current;
    document.body.classList.remove("lfaa-is-resizing");

    if (drag.side === "left") {
      if (drag.snapped) {
        setResolvedLeftCollapsed(true);
      } else {
        setLeftWidth(clamp(drag.lastRaw, drag.min, drag.max));
        setResolvedLeftCollapsed(false);
      }
    } else if (drag.snapped) {
      setResolvedRightCollapsed(true);
    } else {
      setRightWidth(clamp(drag.lastRaw, drag.min, drag.max));
      setResolvedRightCollapsed(false);
    }

    dragRef.current = null;
    pendingRef.current = null;

    if (root) {
      window.requestAnimationFrame(() => {
        root.dataset.dragging = "none";
        root.dataset.snapPreview = "none";
        root.dataset.autoSnap = "none";
      });
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, [setResolvedLeftCollapsed, setResolvedRightCollapsed, snapHysteresis]);

  const keyboardResize = useCallback((event: KeyboardEvent<HTMLDivElement>, side: "left" | "right") => {
    const step = event.shiftKey ? 36 : 12;
    const collapseKey = side === "left" ? "ArrowLeft" : "ArrowRight";
    const expandKey = side === "left" ? "ArrowRight" : "ArrowLeft";

    if (event.key === "Home") {
      event.preventDefault();
      if (side === "left") setResolvedLeftCollapsed(true);
      else setResolvedRightCollapsed(true);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      if (side === "left") {
        const max = Math.max(leftLimits.min, getDynamicMax("left"));
        setResolvedLeftCollapsed(false);
        setLeftWidth((value) => clamp(Math.max(value, leftLimits.initial), leftLimits.min, max));
      } else {
        const max = Math.max(rightLimits.min, getDynamicMax("right"));
        setResolvedRightCollapsed(false);
        setRightWidth((value) => clamp(Math.max(value, rightLimits.initial), rightLimits.min, max));
      }
      return;
    }

    if (event.key !== collapseKey && event.key !== expandKey) return;
    event.preventDefault();

    if (side === "left") {
      const max = Math.max(leftLimits.min, getDynamicMax("left"));
      setResolvedLeftCollapsed(false);
      setLeftWidth((value) => clamp(value + (event.key === expandKey ? step : -step), leftLimits.min, max));
    } else {
      const max = Math.max(rightLimits.min, getDynamicMax("right"));
      setResolvedRightCollapsed(false);
      setRightWidth((value) => clamp(value + (event.key === expandKey ? step : -step), rightLimits.min, max));
    }
  }, [getDynamicMax, leftLimits.initial, leftLimits.min, rightLimits.initial, rightLimits.min, setResolvedLeftCollapsed, setResolvedRightCollapsed]);

  const style = {
    "--lfaa-left-size": `${leftWidth}px`,
    "--lfaa-right-size": `${rightWidth}px`,
    "--lfaa-left-column": `${leftCollapsed ? 0 : leftWidth}px`,
    "--lfaa-right-column": `${rightCollapsed ? 0 : rightWidth}px`,
  } as CSSProperties;

  return (
    <div
      ref={rootRef}
      className="lfaa-workbench"
      style={style}
      data-left-collapsed={leftCollapsed}
      data-right-collapsed={rightCollapsed}
      data-dragging="none"
      data-snap-preview="none"
      data-auto-snap="none"
    >
      <aside className="lfaa-workbench__pane lfaa-workbench__pane--left" aria-label="左侧导航">{left}</aside>

      <div
        className="lfaa-workbench__handle lfaa-workbench__handle--left"
        role="separator"
        aria-orientation="vertical"
        aria-label="调整左侧栏宽度"
        aria-valuemin={leftLimits.min}
        aria-valuemax={leftLimits.max}
        aria-valuenow={leftCollapsed ? 0 : leftWidth}
        tabIndex={0}
        onPointerDown={(event) => onPointerDown(event, "left")}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onKeyDown={(event) => keyboardResize(event, "left")}
      />

      <main className="lfaa-workbench__center">{center}</main>

      <div
        className="lfaa-workbench__handle lfaa-workbench__handle--right"
        role="separator"
        aria-orientation="vertical"
        aria-label="调整右侧栏宽度"
        aria-valuemin={rightLimits.min}
        aria-valuemax={rightLimits.max}
        aria-valuenow={rightCollapsed ? 0 : rightWidth}
        tabIndex={0}
        onPointerDown={(event) => onPointerDown(event, "right")}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onKeyDown={(event) => keyboardResize(event, "right")}
      />

      <aside className="lfaa-workbench__pane lfaa-workbench__pane--right" aria-label="右侧工具与资源">{right}</aside>
    </div>
  );
}
