/**
 * 文件：ResizableWorkbench.tsx
 * 作用：提供左栏 / 中间区 / 右栏 / 底部面板的纯布局容器，并实现拖拽缩放与吸附收起。
 * 负责：尺寸状态、Pointer 拖拽、吸附迟滞、动态最大宽度、键盘 Resize、布局持久化。
 * 不负责：侧栏里面显示什么、Shell 按钮放在哪里、终端内容、业务状态。
 * 状态归属：本组件拥有几何尺寸；栏位开合可由父组件受控，受控时父组件是 collapsed/open 的事实源。
 * 对外接口：ResizableWorkbench(props)。
 * 关联文件：workbench-layout.types.ts、workbench.css、@lfaa/app-shell/AgentWorkbench.tsx。
 * 修改注意事项：
 * - Pointer 按住期间允许“进入吸附磁区 -> 反向拖回最小尺寸”；只有 Pointer Up 真正确认 collapsed。
 * - Pointer Up 后 separator 不允许反向展开，只能由显式按钮/快捷键恢复。
 * - 不要在本组件新增业务按钮；受控/非受控状态必须保持一致。
 *
 * Grid 结构：
 * ┌──── left ────┬ handle ┬──────── center ────────┬ handle ┬── right ──┐
 * │               │        │                        │        │           │
 * │               │        ├────────────────────────┴────────┴───────────┤
 * │               │        │                 bottom                     │
 * └───────────────┴────────┴─────────────────────────────────────────────┘
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

// ===== 1. 内部持久化 / 拖拽状态 =====
interface StoredLayoutState {
  leftWidth: number;
  rightWidth: number;
  bottomHeight: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
}

interface SideDragState {
  side: "left" | "right";
  pointerId: number;
  rectLeft: number;
  rectRight: number;
  min: number;
  max: number;
  lastRaw: number;
  snapped: boolean;
}

interface BottomDragState {
  pointerId: number;
  rectBottom: number;
  min: number;
  max: number;
  lastRaw: number;
  lastHeight: number;
  snapped: boolean;
}

// ===== 2. 默认布局参数与通用辅助函数 =====
const DEFAULT_LEFT: WorkbenchPaneLimits = { min: 240, max: 640, initial: 288 };
const DEFAULT_RIGHT: WorkbenchPaneLimits = { min: 300, max: 760, initial: 360 };
const DEFAULT_BOTTOM: WorkbenchPaneLimits = { min: 150, max: 560, initial: 260 };
const HANDLE_WIDTH = 7;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// min 以下不是立刻从“最小宽度”硬跳到 0，而是进入弹性磁区。
// Pointer 越靠近边缘，视觉尺寸越接近 0；反向拖回 min 时可在同一次 Pointer Capture 中恢复。
function elasticSize(raw: number, min: number): number {
  if (min <= 0 || raw >= min) return raw;
  const progress = clamp(raw / min, 0, 1);
  return min * Math.pow(progress, 1.35);
}

// 真正提交吸附的磁区只占靠近边缘的一小段，避免用户刚碰到 min 就突然整栏消失。
function snapCommitThreshold(min: number, hysteresis: number): number {
  return clamp(hysteresis * 2.25, 36, Math.max(36, min * 0.34));
}

function resolveNext(current: boolean, next: boolean | ((value: boolean) => boolean)) {
  return typeof next === "function" ? next(current) : next;
}

// 从 localStorage 恢复几何尺寸；读取失败时回退默认值，避免布局状态损坏导致页面不可用。
function loadState(
  key: string,
  left: WorkbenchPaneLimits,
  right: WorkbenchPaneLimits,
  bottom: WorkbenchPaneLimits,
): StoredLayoutState {
  if (typeof window === "undefined") {
    return {
      leftWidth: left.initial,
      rightWidth: right.initial,
      bottomHeight: bottom.initial,
      leftCollapsed: false,
      rightCollapsed: false,
    };
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) throw new Error("empty");
    const parsed = JSON.parse(raw) as Partial<StoredLayoutState>;
    return {
      leftWidth: clamp(Number(parsed.leftWidth) || left.initial, left.min, left.max),
      rightWidth: clamp(Number(parsed.rightWidth) || right.initial, right.min, right.max),
      bottomHeight: clamp(Number(parsed.bottomHeight) || bottom.initial, bottom.min, bottom.max),
      leftCollapsed: Boolean(parsed.leftCollapsed),
      rightCollapsed: Boolean(parsed.rightCollapsed),
    };
  } catch {
    return {
      leftWidth: left.initial,
      rightWidth: right.initial,
      bottomHeight: bottom.initial,
      leftCollapsed: false,
      rightCollapsed: false,
    };
  }
}

// ===== 3. ResizableWorkbench 主组件 =====
export function ResizableWorkbench({
  left,
  center,
  right,
  bottom,
  storageKey = "lfaa.workbench.layout.v5",
  leftLimits = DEFAULT_LEFT,
  rightLimits = DEFAULT_RIGHT,
  bottomLimits = DEFAULT_BOTTOM,
  snapHysteresis = 24,
  minCenterWidth = 520,
  leftCollapsed: leftCollapsedProp,
  rightCollapsed: rightCollapsedProp,
  bottomOpen = false,
  onLeftCollapsedChange,
  onRightCollapsedChange,
  onBottomOpenChange,
}: ResizableWorkbenchProps) {
  const initial = useMemo(
    () => loadState(storageKey, leftLimits, rightLimits, bottomLimits),
    [bottomLimits, leftLimits, rightLimits, storageKey],
  );
  const [leftWidth, setLeftWidth] = useState(initial.leftWidth);
  const [rightWidth, setRightWidth] = useState(initial.rightWidth);
  const [bottomHeight, setBottomHeight] = useState(initial.bottomHeight);
  const [internalLeftCollapsed, setInternalLeftCollapsed] = useState(initial.leftCollapsed);
  const [internalRightCollapsed, setInternalRightCollapsed] = useState(initial.rightCollapsed);
  const leftCollapsed = leftCollapsedProp ?? internalLeftCollapsed;
  const rightCollapsed = rightCollapsedProp ?? internalRightCollapsed;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const sideDragRef = useRef<SideDragState | null>(null);
  const bottomDragRef = useRef<BottomDragState | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingRef = useRef<number | null>(null);

  // 受控模式：父组件提供 collapsed 值时，只通过回调请求变更；
  // 非受控模式：组件自己保存 collapsed。两种模式不能同时拥有两份真值。
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

  // 动态 max 会给中间区预留 minCenterWidth，并扣除另一侧已展开栏位。
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
    window.localStorage.setItem(storageKey, JSON.stringify({
      leftWidth,
      rightWidth,
      bottomHeight,
      leftCollapsed,
      rightCollapsed,
    }));
  }, [bottomHeight, leftCollapsed, leftWidth, rightCollapsed, rightWidth, storageKey]);

  // ===== 4. 左右栏 Pointer 拖拽与吸附预览 =====
  // 拖动过程中直接写 CSS 变量，避免每个 pointermove 都触发 React render。
  const setSidePreview = useCallback((side: "left" | "right", visualSize: number, snapped: boolean) => {
    const root = rootRef.current;
    if (!root) return;
    const columnName = side === "left" ? "--lfaa-left-column" : "--lfaa-right-column";
    const sizeName = side === "left" ? "--lfaa-left-size" : "--lfaa-right-size";
    root.dataset.snapPreview = snapped ? side : "none";
    root.dataset.autoSnap = snapped ? side : "none";
    root.style.setProperty(columnName, `${Math.max(0, visualSize)}px`);
    root.style.setProperty(sizeName, `${Math.max(1, visualSize)}px`);
  }, []);

  // requestAnimationFrame 合并高频 pointermove。
  // 规则：
  // 1) raw < min 时进入“弹性压缩区”，视觉尺寸连续变化，不再从 min 硬跳到 0；
  // 2) raw 进入靠边磁区后只标记 snapped，Pointer 仍然保持捕获；
  // 3) 用户不松手并反向拖回 min，立即退出 snapped，可继续正常拉伸；
  // 4) 只有 Pointer Up 时仍处于 snapped，才真正提交 collapsed。
  const flushPending = useCallback(() => {
    frameRef.current = null;
    const rawValue = pendingRef.current;
    const drag = sideDragRef.current;
    if (rawValue === null || drag === null) return;

    const raw = clamp(rawValue, 0, drag.max);
    const commitAt = snapCommitThreshold(drag.min, snapHysteresis);
    drag.lastRaw = raw;

    if (!drag.snapped && raw <= commitAt) drag.snapped = true;
    else if (drag.snapped && raw >= drag.min) drag.snapped = false;

    const visual = elasticSize(raw, drag.min);
    setSidePreview(drag.side, visual, drag.snapped);
  }, [setSidePreview, snapHysteresis]);

  const schedule = useCallback((value: number) => {
    pendingRef.current = value;
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(flushPending);
  }, [flushPending]);

  // Pointer Down 记录本次拖拽的几何边界。已吸附栏位禁止从 separator 反向展开。
  const onSidePointerDown = useCallback((event: PointerEvent<HTMLDivElement>, side: "left" | "right") => {
    const root = rootRef.current;
    if (!root) return;
    const collapsed = side === "left" ? leftCollapsed : rightCollapsed;
    // 吸附收起后分隔条只保留边界，不允许反向拖拽展开；必须通过对应 UI 控件重新打开。
    if (collapsed) return;
    const rect = root.getBoundingClientRect();
    const staticMin = side === "left" ? leftLimits.min : rightLimits.min;
    const effectiveMax = getDynamicMax(side);
    const effectiveMin = Math.min(staticMin, effectiveMax);
    const current = side === "left" ? leftWidth : rightWidth;

    sideDragRef.current = {
      side,
      pointerId: event.pointerId,
      rectLeft: rect.left,
      rectRight: rect.right,
      min: effectiveMin,
      max: effectiveMax,
      lastRaw: current,
      snapped: false,
    };

    root.dataset.dragging = side;
    root.dataset.snapPreview = "none";
    root.dataset.autoSnap = "none";
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.classList.add("lfaa-is-resizing");
  }, [getDynamicMax, leftCollapsed, leftLimits.min, leftWidth, rightCollapsed, rightLimits.min, rightWidth]);

  const onSidePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = sideDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const raw = drag.side === "left" ? event.clientX - drag.rectLeft : drag.rectRight - event.clientX;
    schedule(raw);
  }, [schedule]);

  const finishSideDrag = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = sideDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      const rawValue = pendingRef.current;
      if (rawValue !== null) {
        const bounded = clamp(rawValue, 0, drag.max);
        const commitAt = snapCommitThreshold(drag.min, snapHysteresis);
        drag.lastRaw = bounded;
        if (!drag.snapped && bounded <= commitAt) drag.snapped = true;
        else if (drag.snapped && bounded >= drag.min) drag.snapped = false;
      }
    }

    const root = rootRef.current;
    document.body.classList.remove("lfaa-is-resizing");

    if (drag.side === "left") {
      if (drag.snapped) {
        root?.style.setProperty("--lfaa-left-column", "0px");
        setResolvedLeftCollapsed(true);
      } else {
        const finalWidth = clamp(drag.lastRaw, drag.min, drag.max);
        root?.style.setProperty("--lfaa-left-column", `${finalWidth}px`);
        root?.style.setProperty("--lfaa-left-size", `${finalWidth}px`);
        setLeftWidth(finalWidth);
        setResolvedLeftCollapsed(false);
      }
    } else if (drag.snapped) {
      root?.style.setProperty("--lfaa-right-column", "0px");
      setResolvedRightCollapsed(true);
    } else {
      const finalWidth = clamp(drag.lastRaw, drag.min, drag.max);
      root?.style.setProperty("--lfaa-right-column", `${finalWidth}px`);
      root?.style.setProperty("--lfaa-right-size", `${finalWidth}px`);
      setRightWidth(finalWidth);
      setResolvedRightCollapsed(false);
    }

    sideDragRef.current = null;
    pendingRef.current = null;
    if (root) {
      window.requestAnimationFrame(() => {
        root.dataset.dragging = "none";
        root.dataset.snapPreview = "none";
        root.dataset.autoSnap = "none";
      });
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }, [setResolvedLeftCollapsed, setResolvedRightCollapsed, snapHysteresis]);

  const setBottomPreview = useCallback((visualHeight: number, snapped: boolean) => {
    const root = rootRef.current;
    if (!root) return;
    root.dataset.snapPreview = snapped ? "bottom" : "none";
    root.dataset.autoSnap = snapped ? "bottom" : "none";
    root.style.setProperty("--lfaa-bottom-row", `${Math.max(0, visualHeight)}px`);
  }, []);

  // ===== 5. 底部面板拖拽与向下弹性吸附 =====
  const onBottomPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const root = rootRef.current;
    if (!root || !bottomOpen) return;
    const rect = root.getBoundingClientRect();
    const dynamicMax = Math.max(bottomLimits.min, Math.min(bottomLimits.max, rect.height - 180));
    bottomDragRef.current = {
      pointerId: event.pointerId,
      rectBottom: rect.bottom,
      min: bottomLimits.min,
      max: dynamicMax,
      lastRaw: bottomHeight,
      lastHeight: bottomHeight,
      snapped: false,
    };
    root.dataset.dragging = "bottom";
    root.dataset.snapPreview = "none";
    root.dataset.autoSnap = "none";
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.classList.add("lfaa-is-resizing-vertical");
  }, [bottomHeight, bottomLimits.max, bottomLimits.min, bottomOpen]);

  const onBottomPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = bottomDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const raw = clamp(drag.rectBottom - event.clientY, 0, drag.max);
    const commitAt = snapCommitThreshold(drag.min, snapHysteresis);
    drag.lastRaw = raw;

    if (!drag.snapped && raw <= commitAt) drag.snapped = true;
    else if (drag.snapped && raw >= drag.min) drag.snapped = false;

    const visual = elasticSize(raw, drag.min);
    drag.lastHeight = clamp(Math.max(raw, drag.min), drag.min, drag.max);
    setBottomPreview(visual, drag.snapped);
  }, [setBottomPreview, snapHysteresis]);

  const finishBottomDrag = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = bottomDragRef.current;
    const root = rootRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (drag.snapped) {
      root?.style.setProperty("--lfaa-bottom-row", "0px");
      onBottomOpenChange?.(false);
    } else {
      const finalHeight = clamp(drag.lastHeight, drag.min, drag.max);
      root?.style.setProperty("--lfaa-bottom-row", `${finalHeight}px`);
      setBottomHeight(finalHeight);
    }

    bottomDragRef.current = null;
    document.body.classList.remove("lfaa-is-resizing-vertical");
    if (root) {
      window.requestAnimationFrame(() => {
        root.dataset.dragging = "none";
        root.dataset.snapPreview = "none";
        root.dataset.autoSnap = "none";
      });
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }, [onBottomOpenChange]);

  // ===== 6. Separator 键盘 Resize =====
  // Home 收起、End 恢复；方向键按 12px，Shift+方向键按 36px。
  const keyboardResize = useCallback((event: KeyboardEvent<HTMLDivElement>, side: "left" | "right") => {
    const collapsed = side === "left" ? leftCollapsed : rightCollapsed;
    // 已吸附的栏位不能从 resize separator 反向展开；使用外部显式控件或快捷键。
    if (collapsed) return;
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
  }, [getDynamicMax, leftCollapsed, leftLimits.initial, leftLimits.min, rightCollapsed, rightLimits.initial, rightLimits.min, setResolvedLeftCollapsed, setResolvedRightCollapsed]);

  // ===== 7. CSS Grid 变量输出 =====
  // collapsed/open 最终只转换成列宽 / 行高变量，视觉动画由 workbench.css 完成。
  const style = {
    "--lfaa-left-size": `${leftWidth}px`,
    "--lfaa-right-size": `${rightWidth}px`,
    "--lfaa-left-column": `${leftCollapsed ? 0 : leftWidth}px`,
    "--lfaa-right-column": `${rightCollapsed ? 0 : rightWidth}px`,
    "--lfaa-bottom-size": `${bottomHeight}px`,
    "--lfaa-bottom-row": `${bottom && bottomOpen ? bottomHeight : 0}px`,
  } as CSSProperties;

  // ===== 8. DOM 结构 =====
  // 顺序与 CSS Grid 列严格对应：left -> handle -> center -> handle -> right；bottom 单独占第二行。
  return (
    <div
      ref={rootRef}
      className="lfaa-workbench"
      style={style}
      data-left-collapsed={leftCollapsed}
      data-right-collapsed={rightCollapsed}
      data-bottom-open={Boolean(bottom && bottomOpen)}
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
        tabIndex={leftCollapsed ? -1 : 0}
        aria-disabled={leftCollapsed}
        onPointerDown={(event) => onSidePointerDown(event, "left")}
        onPointerMove={onSidePointerMove}
        onPointerUp={finishSideDrag}
        onPointerCancel={finishSideDrag}
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
        tabIndex={rightCollapsed ? -1 : 0}
        aria-disabled={rightCollapsed}
        onPointerDown={(event) => onSidePointerDown(event, "right")}
        onPointerMove={onSidePointerMove}
        onPointerUp={finishSideDrag}
        onPointerCancel={finishSideDrag}
        onKeyDown={(event) => keyboardResize(event, "right")}
      />

      <aside className="lfaa-workbench__pane lfaa-workbench__pane--right" aria-label="右侧工具与资源">{right}</aside>

      {bottom ? (
        <section className="lfaa-workbench__bottom" aria-label="底部面板">
          <div
            className="lfaa-workbench__bottom-handle"
            role="separator"
            aria-orientation="horizontal"
            aria-label="调整底部面板高度"
            aria-valuemin={bottomLimits.min}
            aria-valuemax={bottomLimits.max}
            aria-valuenow={bottomOpen ? bottomHeight : 0}
            aria-disabled={!bottomOpen}
            tabIndex={bottomOpen ? 0 : -1}
            onPointerDown={onBottomPointerDown}
            onPointerMove={onBottomPointerMove}
            onPointerUp={finishBottomDrag}
            onPointerCancel={finishBottomDrag}
          />
          <div className="lfaa-workbench__bottom-content">{bottom}</div>
        </section>
      ) : null}
    </div>
  );
}
