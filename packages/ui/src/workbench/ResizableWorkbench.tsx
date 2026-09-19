/**
 * 文件：ResizableWorkbench.tsx
 * 作用：提供左栏 / 中间区 / 右栏 / 底部面板的纯布局容器，并实现拖拽缩放与吸附收起。
 * 负责：尺寸状态、Pointer 拖拽、吸附迟滞、动态最大宽度、键盘 Resize、布局持久化。
 * 不负责：侧栏里面显示什么、Shell 按钮放在哪里、终端内容、业务状态。
 * 状态归属：本组件拥有几何尺寸；栏位开合可由父组件受控，受控时父组件是 collapsed/open 的事实源。
 * 对外接口：ResizableWorkbench(props)，其中 onLeftWidthChange 用于把真实左栏宽度同步给 Shell 的 Hover Preview。
 * 关联文件：workbench-layout.types.ts、workbench.css、@lfaa/app-shell/AgentWorkbench.tsx。
 * 修改注意事项：
 * - 展开态尺寸绝不低于 min；拖到 min 即进入吸附收起预览，Pointer 不松手可反向拖回 min 并继续拉伸。
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
import { WORKBENCH_LAYOUT_TOKENS, resolveWorkbenchLayoutMetrics } from "./workbench-layout.config";
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
const DEFAULT_METRICS = resolveWorkbenchLayoutMetrics(1200, 800);
const DEFAULT_LEFT: WorkbenchPaneLimits = DEFAULT_METRICS.left;
const DEFAULT_RIGHT: WorkbenchPaneLimits = DEFAULT_METRICS.right;
const DEFAULT_BOTTOM: WorkbenchPaneLimits = DEFAULT_METRICS.bottom;
const HANDLE_WIDTH = WORKBENCH_LAYOUT_TOKENS.separator;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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
  layoutMode = "desktop",
  onLeftWidthChange,
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

  // 将左栏实际宽度回传给 Shell。Hover Preview 不再维护独立宽度，保证预览与点击展开完全一致。
  useEffect(() => {
    onLeftWidthChange?.(leftWidth);
  }, [leftWidth, onLeftWidthChange]);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const snapReleaseTimerRef = useRef<number | null>(null);
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

  // 动态 max 会给中间区预留 minCenterWidth。
  // 只有 Desktop 双 Dock 才需要扣除“另一侧栏”的宽度；Compact/Mobile 的 Overlay 不参与主区几何。
  const getDynamicMax = useCallback((side: "left" | "right") => {
    const root = rootRef.current;
    if (!root) return side === "left" ? leftLimits.max : rightLimits.max;
    const rect = root.getBoundingClientRect();
    const otherWidth = layoutMode === "desktop"
      ? side === "left"
        ? (rightCollapsed ? 0 : rightWidth)
        : (leftCollapsed ? 0 : leftWidth)
      : 0;
    const staticMax = side === "left" ? leftLimits.max : rightLimits.max;
    const handleBudget = layoutMode === "desktop" ? HANDLE_WIDTH * 2 : HANDLE_WIDTH;
    const available = Math.max(0, rect.width - otherWidth - minCenterWidth - handleBudget);
    return Math.max(0, Math.min(staticMax, available > 0 ? available : staticMax));
  }, [layoutMode, leftCollapsed, leftLimits.max, leftWidth, minCenterWidth, rightCollapsed, rightLimits.max, rightWidth]);

  // 响应式计算结果变化时，把历史持久化尺寸重新夹进当前容器允许的范围。
  // 这一步很重要：用户在大屏保存的 340px 侧栏，切到小窗后不能继续拿 340px 挤压主区。
  useEffect(() => {
    setLeftWidth((value) => clamp(value, leftLimits.min, leftLimits.max));
  }, [leftLimits.max, leftLimits.min]);

  useEffect(() => {
    setRightWidth((value) => clamp(value, rightLimits.min, rightLimits.max));
  }, [rightLimits.max, rightLimits.min]);

  useEffect(() => {
    setBottomHeight((value) => clamp(value, bottomLimits.min, bottomLimits.max));
  }, [bottomLimits.max, bottomLimits.min]);

  // 容器变窄时，历史持久化宽度还要继续受“中心区保护”约束。
  // 例如 1440px 保存的左栏宽度，在 760px 小窗里不能原样保留并把中心区挤没。
  useEffect(() => {
    const dynamicMax = getDynamicMax("left");
    const dynamicMin = Math.min(leftLimits.min, dynamicMax);
    setLeftWidth((value) => clamp(value, dynamicMin, dynamicMax));
  }, [getDynamicMax, leftLimits.min]);

  useEffect(() => {
    if (layoutMode !== "desktop") return;
    const dynamicMax = getDynamicMax("right");
    const dynamicMin = Math.min(rightLimits.min, dynamicMax);
    setRightWidth((value) => clamp(value, dynamicMin, dynamicMax));
  }, [getDynamicMax, layoutMode, rightLimits.min]);

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
  // snap capture 反向释放时保留一个极短的过渡窗口：0 -> min 不再瞬间跳开；
  // 窗口结束后立即恢复普通 resize 的 1:1 跟手，避免持续动画追逐 Pointer。
  const beginSnapRelease = useCallback((target: "left" | "right" | "bottom") => {
    const root = rootRef.current;
    if (!root) return;
    if (snapReleaseTimerRef.current !== null) window.clearTimeout(snapReleaseTimerRef.current);
    root.dataset.snapRelease = target;
    snapReleaseTimerRef.current = window.setTimeout(() => {
      const current = rootRef.current;
      if (current?.dataset.snapRelease === target) current.dataset.snapRelease = "none";
      snapReleaseTimerRef.current = null;
    }, 150);
  }, []);

  const cancelSnapRelease = useCallback(() => {
    if (snapReleaseTimerRef.current !== null) {
      window.clearTimeout(snapReleaseTimerRef.current);
      snapReleaseTimerRef.current = null;
    }
    if (rootRef.current) rootRef.current.dataset.snapRelease = "none";
  }, []);

  useEffect(() => () => {
    if (snapReleaseTimerRef.current !== null) window.clearTimeout(snapReleaseTimerRef.current);
  }, []);

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
  // 1) 展开状态绝不允许低于 min；min 是“可用布局”的硬下限；
  // 2) 向内拖到 min 即进入 snap capture，视觉上吸附到 0，表达“准备收起”；
  // 3) Pointer 仍按住时，只要反向拖过 min + hysteresis，就从 0 恢复到 min 并继续正常拉伸；
  // 4) 只有 Pointer Up 时仍处于 snapped，才真正提交 collapsed。
  const flushPending = useCallback(() => {
    frameRef.current = null;
    const rawValue = pendingRef.current;
    const drag = sideDragRef.current;
    if (rawValue === null || drag === null) return;

    const raw = clamp(rawValue, 0, drag.max);
    drag.lastRaw = raw;

    const wasSnapped = drag.snapped;
    if (!drag.snapped && raw <= drag.min) drag.snapped = true;
    else if (drag.snapped && raw >= drag.min + snapHysteresis) drag.snapped = false;

    if (wasSnapped && !drag.snapped) beginSnapRelease(drag.side);
    else if (!wasSnapped && drag.snapped) cancelSnapRelease();

    // snapped 时只预览“收起”；反向释放时用 150ms 过渡从 0 回到 min/当前 Pointer，随后恢复完全跟手。
    const visual = drag.snapped ? 0 : clamp(raw, drag.min, drag.max);
    setSidePreview(drag.side, visual, drag.snapped);
  }, [beginSnapRelease, cancelSnapRelease, setSidePreview, snapHysteresis]);

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

    cancelSnapRelease();
    root.dataset.dragging = side;
    root.dataset.snapPreview = "none";
    root.dataset.autoSnap = "none";
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.classList.add("lfaa-is-resizing");
  }, [cancelSnapRelease, getDynamicMax, leftCollapsed, leftLimits.min, leftWidth, rightCollapsed, rightLimits.min, rightWidth]);

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
        drag.lastRaw = bounded;
        if (!drag.snapped && bounded <= drag.min) drag.snapped = true;
        else if (drag.snapped && bounded >= drag.min + snapHysteresis) drag.snapped = false;
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

  // ===== 5. 底部面板拖拽与向下吸附收起 =====
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
    cancelSnapRelease();
    root.dataset.dragging = "bottom";
    root.dataset.snapPreview = "none";
    root.dataset.autoSnap = "none";
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.classList.add("lfaa-is-resizing-vertical");
  }, [bottomHeight, bottomLimits.max, bottomLimits.min, bottomOpen, cancelSnapRelease]);

  const onBottomPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = bottomDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const raw = clamp(drag.rectBottom - event.clientY, 0, drag.max);
    drag.lastRaw = raw;

    const wasSnapped = drag.snapped;
    if (!drag.snapped && raw <= drag.min) drag.snapped = true;
    else if (drag.snapped && raw >= drag.min + snapHysteresis) drag.snapped = false;

    if (wasSnapped && !drag.snapped) beginSnapRelease("bottom");
    else if (!wasSnapped && drag.snapped) cancelSnapRelease();

    // 底部面板与左右栏一致：吸附与反向释放都提供短过渡，普通拖拽保持直接跟手。
    const visual = drag.snapped ? 0 : clamp(raw, drag.min, drag.max);
    drag.lastHeight = clamp(raw, drag.min, drag.max);
    setBottomPreview(visual, drag.snapped);
  }, [beginSnapRelease, cancelSnapRelease, setBottomPreview, snapHysteresis]);

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
      data-snap-release="none"
      data-auto-snap="none"
      data-layout-mode={layoutMode}
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
