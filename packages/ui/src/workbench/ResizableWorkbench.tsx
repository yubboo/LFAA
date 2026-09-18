/**
 * 文件：ResizableWorkbench.tsx
 * 作用：提供左右可拉伸、到达最小宽度即自动吸附收起的三栏工作台布局。
 * 负责：UI 布局宽度、收起状态、键盘/Pointer 交互和本地持久化。
 * 不负责：业务事实状态、资源加载、Agent 状态。
 * 状态归属：浏览器 UI 本地状态。
 * 对外接口：ResizableWorkbench。
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
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
  storageKey = "lfaa.workbench.layout.v3",
  leftLimits = DEFAULT_LEFT,
  rightLimits = DEFAULT_RIGHT,
  snapHysteresis = 24,
  minCenterWidth = 520,
}: ResizableWorkbenchProps) {
  const initial = useMemo(() => loadState(storageKey, leftLimits, rightLimits), [storageKey, leftLimits, rightLimits]);
  const [leftWidth, setLeftWidth] = useState(initial.leftWidth);
  const [rightWidth, setRightWidth] = useState(initial.rightWidth);
  const [leftCollapsed, setLeftCollapsed] = useState(initial.leftCollapsed);
  const [rightCollapsed, setRightCollapsed] = useState(initial.rightCollapsed);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingRef = useRef<number | null>(null);

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

    // 收起时保留上一次展开宽度，方便按钮/刷新后恢复。
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

    // 目标交互：一到最小宽度就自动吸附，不再继续拖到独立 96px 阈值，
    // 也不等待 Pointer Up 才决定 collapsed。
    if (!drag.snapped && raw <= drag.min) {
      drag.snapped = true;
      setPreview(drag.side, 0, true);
      return;
    }

    // 反向拖回使用小迟滞，避免指针在 min 边界轻微抖动时反复开合。
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
        setLeftCollapsed(true);
      } else {
        setLeftWidth(clamp(drag.lastRaw, drag.min, drag.max));
        setLeftCollapsed(false);
      }
    } else if (drag.snapped) {
      setRightCollapsed(true);
    } else {
      setRightWidth(clamp(drag.lastRaw, drag.min, drag.max));
      setRightCollapsed(false);
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
  }, [snapHysteresis]);

  const toggleCollapsed = useCallback((side: "left" | "right") => {
    if (side === "left") setLeftCollapsed((value) => !value);
    else setRightCollapsed((value) => !value);
  }, []);

  const keyboardResize = useCallback((event: KeyboardEvent<HTMLDivElement>, side: "left" | "right") => {
    const step = event.shiftKey ? 36 : 12;
    const collapseKey = side === "left" ? "ArrowLeft" : "ArrowRight";
    const expandKey = side === "left" ? "ArrowRight" : "ArrowLeft";

    if (event.key === "Enter") {
      event.preventDefault();
      toggleCollapsed(side);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      side === "left" ? setLeftCollapsed(true) : setRightCollapsed(true);
      return;
    }

    if (event.key !== collapseKey && event.key !== expandKey) return;
    event.preventDefault();

    if (side === "left") {
      const max = Math.max(leftLimits.min, getDynamicMax("left"));
      setLeftCollapsed(false);
      setLeftWidth((value) => clamp(value + (event.key === expandKey ? step : -step), leftLimits.min, max));
    } else {
      const max = Math.max(rightLimits.min, getDynamicMax("right"));
      setRightCollapsed(false);
      setRightWidth((value) => clamp(value + (event.key === expandKey ? step : -step), rightLimits.min, max));
    }
  }, [getDynamicMax, leftLimits.min, rightLimits.min, toggleCollapsed]);

  const style = {
    "--lfaa-left-size": `${leftWidth}px`,
    "--lfaa-right-size": `${rightWidth}px`,
    "--lfaa-left-column": `${leftCollapsed ? 0 : leftWidth}px`,
    "--lfaa-right-column": `${rightCollapsed ? 0 : rightWidth}px`,
  } as CSSProperties;

  return (
    <div ref={rootRef} className="lfaa-workbench" style={style} data-left-collapsed={leftCollapsed} data-right-collapsed={rightCollapsed} data-dragging="none" data-snap-preview="none" data-auto-snap="none">
      <aside className="lfaa-workbench__pane lfaa-workbench__pane--left" aria-label="左侧导航">{left}</aside>

      <div className="lfaa-workbench__handle lfaa-workbench__handle--left" role="separator" aria-orientation="vertical" aria-label="调整左侧栏宽度" aria-valuemin={leftLimits.min} aria-valuemax={leftLimits.max} aria-valuenow={leftCollapsed ? 0 : leftWidth} tabIndex={0}
        onPointerDown={(event) => onPointerDown(event, "left")} onPointerMove={onPointerMove} onPointerUp={finishDrag} onPointerCancel={finishDrag}
        onDoubleClick={() => toggleCollapsed("left")} onKeyDown={(event) => keyboardResize(event, "left")}>
        <button className="lfaa-workbench__snap" type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => toggleCollapsed("left")} aria-label={leftCollapsed ? "展开左侧栏" : "收起左侧栏"}>{leftCollapsed ? "›" : "‹"}</button>
      </div>

      <main className="lfaa-workbench__center">{center}</main>

      <div className="lfaa-workbench__handle lfaa-workbench__handle--right" role="separator" aria-orientation="vertical" aria-label="调整右侧栏宽度" aria-valuemin={rightLimits.min} aria-valuemax={rightLimits.max} aria-valuenow={rightCollapsed ? 0 : rightWidth} tabIndex={0}
        onPointerDown={(event) => onPointerDown(event, "right")} onPointerMove={onPointerMove} onPointerUp={finishDrag} onPointerCancel={finishDrag}
        onDoubleClick={() => toggleCollapsed("right")} onKeyDown={(event) => keyboardResize(event, "right")}>
        <button className="lfaa-workbench__snap" type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => toggleCollapsed("right")} aria-label={rightCollapsed ? "展开右侧栏" : "收起右侧栏"}>{rightCollapsed ? "‹" : "›"}</button>
      </div>

      <aside className="lfaa-workbench__pane lfaa-workbench__pane--right" aria-label="右侧资源栏">{right}</aside>
    </div>
  );
}
