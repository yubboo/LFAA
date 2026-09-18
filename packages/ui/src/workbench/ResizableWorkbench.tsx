/**
 * 文件：ResizableWorkbench.tsx
 * 作用：提供左右可拉伸、可吸附收起的三栏工作台布局。
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
}

const DEFAULT_LEFT: WorkbenchPaneLimits = { min: 220, max: 520, initial: 280 };
const DEFAULT_RIGHT: WorkbenchPaneLimits = { min: 260, max: 560, initial: 320 };

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
  storageKey = "lfaa.workbench.layout.v1",
  leftLimits = DEFAULT_LEFT,
  rightLimits = DEFAULT_RIGHT,
  snapThreshold = 128,
}: ResizableWorkbenchProps) {
  const initial = useMemo(() => loadState(storageKey, leftLimits, rightLimits), [storageKey, leftLimits, rightLimits]);
  const [leftWidth, setLeftWidth] = useState(initial.leftWidth);
  const [rightWidth, setRightWidth] = useState(initial.rightWidth);
  const [leftCollapsed, setLeftCollapsed] = useState(initial.leftCollapsed);
  const [rightCollapsed, setRightCollapsed] = useState(initial.rightCollapsed);
  const dragRef = useRef<DragState | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingRef = useRef<number | null>(null);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify({ leftWidth, rightWidth, leftCollapsed, rightCollapsed }));
  }, [leftCollapsed, leftWidth, rightCollapsed, rightWidth, storageKey]);

  const flushPending = useCallback(() => {
    frameRef.current = null;
    const value = pendingRef.current;
    const drag = dragRef.current;
    if (value === null || drag === null) return;

    if (drag.side === "left") {
      if (value < snapThreshold) {
        setLeftCollapsed(true);
        return;
      }
      setLeftCollapsed(false);
      setLeftWidth(clamp(value, leftLimits.min, leftLimits.max));
      return;
    }

    if (value < snapThreshold) {
      setRightCollapsed(true);
      return;
    }
    setRightCollapsed(false);
    setRightWidth(clamp(value, rightLimits.min, rightLimits.max));
  }, [leftLimits.max, leftLimits.min, rightLimits.max, rightLimits.min, snapThreshold]);

  const schedule = useCallback((value: number) => {
    pendingRef.current = value;
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(flushPending);
  }, [flushPending]);

  const onPointerDown = useCallback((event: PointerEvent<HTMLDivElement>, side: "left" | "right") => {
    dragRef.current = { side, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.classList.add("lfaa-is-resizing");
  }, []);

  const onPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    schedule(drag.side === "left" ? event.clientX : window.innerWidth - event.clientX);
  }, [schedule]);

  const finishDrag = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    document.body.classList.remove("lfaa-is-resizing");
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const keyboardResize = useCallback((event: KeyboardEvent<HTMLDivElement>, side: "left" | "right") => {
    const step = event.shiftKey ? 32 : 12;
    const collapseKey = side === "left" ? "ArrowLeft" : "ArrowRight";
    const expandKey = side === "left" ? "ArrowRight" : "ArrowLeft";

    if (event.key === "Enter") {
      event.preventDefault();
      side === "left" ? setLeftCollapsed((v) => !v) : setRightCollapsed((v) => !v);
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
      setLeftCollapsed(false);
      setLeftWidth((value) => clamp(value + (event.key === expandKey ? step : -step), leftLimits.min, leftLimits.max));
    } else {
      setRightCollapsed(false);
      setRightWidth((value) => clamp(value + (event.key === expandKey ? step : -step), rightLimits.min, rightLimits.max));
    }
  }, [leftLimits.max, leftLimits.min, rightLimits.max, rightLimits.min]);

  const style = {
    "--lfaa-left-width": `${leftCollapsed ? 0 : leftWidth}px`,
    "--lfaa-right-width": `${rightCollapsed ? 0 : rightWidth}px`,
  } as CSSProperties;

  return (
    <div className="lfaa-workbench" style={style} data-left-collapsed={leftCollapsed} data-right-collapsed={rightCollapsed}>
      <aside className="lfaa-workbench__pane lfaa-workbench__pane--left" aria-label="左侧导航">
        {left}
      </aside>

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
        onDoubleClick={() => setLeftCollapsed((value) => !value)}
        onKeyDown={(event) => keyboardResize(event, "left")}
      >
        <button className="lfaa-workbench__snap" type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => setLeftCollapsed((value) => !value)} aria-label={leftCollapsed ? "展开左侧栏" : "收起左侧栏"}>
          {leftCollapsed ? "›" : "‹"}
        </button>
      </div>

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
        onDoubleClick={() => setRightCollapsed((value) => !value)}
        onKeyDown={(event) => keyboardResize(event, "right")}
      >
        <button className="lfaa-workbench__snap" type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => setRightCollapsed((value) => !value)} aria-label={rightCollapsed ? "展开右侧栏" : "收起右侧栏"}>
          {rightCollapsed ? "‹" : "›"}
        </button>
      </div>

      <aside className="lfaa-workbench__pane lfaa-workbench__pane--right" aria-label="右侧资源栏">
        {right}
      </aside>
    </div>
  );
}
