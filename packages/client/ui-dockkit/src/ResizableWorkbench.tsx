/**
 * 文件：ResizableWorkbench.tsx
 * 作用：提供左栏 / 中间区 / 右栏 / 底部面板的纯布局容器，并实现拖拽缩放与吸附收起。
 * 负责：尺寸状态、Pointer 拖拽、吸附迟滞、动态最大宽度、键盘 Resize、布局持久化。
 * 不负责：侧栏里面显示什么、Shell 按钮放在哪里、终端内容、业务状态。
 * 状态归属：默认由本组件拥有几何尺寸；leftWidth 与栏位开合均可由父组件受控，受控时父组件是对应事实源。
 * 对外接口：ResizableWorkbench(props)，leftWidth/onLeftWidthChange 可让多个 Surface 共用同一左栏宽度事实源。
 * 关联文件：workbench-layout.types.ts、workbench.css、@lfaa/app-shell/AgentWorkbench.tsx。
 * 修改注意事项：
 * - min 表示视觉展开态最小宽度；Pointer 越过 min 后视觉宽度保持 min，只累计“超拖距离”。
 * - 默认超拖达到 min 的 50% 才进入吸附预览，降低误触；Pointer 不松手仍可反向拉出。
 * - Pointer Up 后 separator 不允许反向展开，只能由显式按钮/快捷键恢复。
 * - 本组件只容纳布局级窗格交换控制；业务按钮由各 Pane 自己拥有，受控/非受控状态必须保持一致。
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
import {
  WORKBENCH_INTERACTION_TOKENS,
  resolveSnapCaptureThreshold,
  resolveSnapDragFrame,
} from "./workbench-interaction.config.ts";
import { WORKBENCH_LAYOUT_TOKENS, resolveLegacyWorkbenchInitialWidths, resolvePreviousWorkbenchInitialWidths, resolveWorkbenchLayoutMetrics } from "./workbench-layout.config.ts";
import type { ResizableWorkbenchProps, WorkbenchPaneLimits } from "./workbench-layout.types.ts";
import "./workbench.css";

// ===== 1. 内部持久化 / 拖拽状态 =====
interface StoredLayoutState {
  leftWidth: number;
  rightWidth: number;
  bottomHeight: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  layoutDefaultsVersion: number;
}

interface SnapDragState {
  pointerId: number;
  target: HTMLDivElement;
  min: number;
  max: number;
  lastRaw: number;
  captureThreshold: number;
  snapped: boolean;
  releaseStartedAt: number | null;
}

interface SideDragState extends SnapDragState {
  side: "left" | "right";
  rectLeft: number;
  rectRight: number;
  startSize: number;
}

interface BottomDragState extends SnapDragState {
  rectBottom: number;
  startHeight: number;
  lastHeight: number;
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

// 反向释放时用平滑起止曲线连接吸附态与当前 Pointer 尺寸。
function easeInOutCubic(progress: number): number {
  const value = clamp(progress, 0, 1);
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
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
  containerWidth: number,
): StoredLayoutState {
  if (typeof window === "undefined") {
    return {
      leftWidth: left.initial,
      rightWidth: right.initial,
      bottomHeight: bottom.initial,
      leftCollapsed: false,
      rightCollapsed: true,
      layoutDefaultsVersion: 3,
    };
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) throw new Error("empty");
    const parsed = JSON.parse(raw) as Partial<StoredLayoutState>;
    const storedDefaultsVersion = Number(parsed.layoutDefaultsVersion) || 0;
    const usesPreviousDefaults = storedDefaultsVersion < 2;
    const usesPreviousInitialWidths = storedDefaultsVersion < 3;
    const legacyWidths = resolveLegacyWorkbenchInitialWidths(containerWidth);
    const previousWidths = resolvePreviousWorkbenchInitialWidths(containerWidth);
    const storedLeftWidth = Number(parsed.leftWidth) || left.initial;
    const storedRightWidth = Number(parsed.rightWidth) || right.initial;
    const leftWasPreviousDefault = usesPreviousInitialWidths && storedLeftWidth === previousWidths.left;
    const leftWasLegacyDefault = usesPreviousDefaults && storedLeftWidth === legacyWidths.left;
    return {
      leftWidth: clamp(leftWasPreviousDefault || leftWasLegacyDefault ? left.initial : storedLeftWidth, left.min, left.max),
      rightWidth: clamp(usesPreviousDefaults && storedRightWidth === legacyWidths.right ? right.initial : storedRightWidth, right.min, right.max),
      bottomHeight: clamp(Number(parsed.bottomHeight) || bottom.initial, bottom.min, bottom.max),
      leftCollapsed: Boolean(parsed.leftCollapsed),
      rightCollapsed: usesPreviousDefaults ? true : Boolean(parsed.rightCollapsed),
      layoutDefaultsVersion: 3,
    };
  } catch {
    return {
      leftWidth: left.initial,
      rightWidth: right.initial,
      bottomHeight: bottom.initial,
      leftCollapsed: false,
      rightCollapsed: true,
      layoutDefaultsVersion: 3,
    };
  }
}

// ===== 3. ResizableWorkbench 主组件 =====
export function ResizableWorkbench({
  left,
  center,
  leftVisible = true,
  right,
  rightPaneSwapped: rightPaneSwappedProp = false,
  onSwapPanes,
  bottom,
  storageKey = "lfaa.workbench.layout.v5",
  leftLimits = DEFAULT_LEFT,
  rightLimits = DEFAULT_RIGHT,
  bottomLimits = DEFAULT_BOTTOM,
  containerWidth = 1200,
  snapCaptureRatio = WORKBENCH_INTERACTION_TOKENS.snap.captureRatio,
  snapHysteresis = 24,
  snapCaptureDurationMs = WORKBENCH_INTERACTION_TOKENS.snap.captureDurationMs,
  snapReleaseDurationMs = WORKBENCH_INTERACTION_TOKENS.snap.releaseDurationMs,
  snapSettleDurationMs = WORKBENCH_INTERACTION_TOKENS.snap.settleDurationMs,
  minCenterWidth = 520,
  leftWidth: leftWidthProp,
  leftCollapsed: leftCollapsedProp,
  rightCollapsed: rightCollapsedProp,
  bottomOpen = false,
  layoutMode = "desktop",
  onLeftWidthChange,
  onLeftCollapsedChange,
  onRightCollapsedChange,
  onBottomOpenChange,
}: ResizableWorkbenchProps) {
  const rightEnabled = right !== undefined && right !== null;
  const rightPaneSwapped = rightEnabled && layoutMode === "desktop" && rightPaneSwappedProp;
  const initial = useMemo(
    () => loadState(storageKey, leftLimits, rightLimits, bottomLimits, containerWidth),
    [bottomLimits, containerWidth, leftLimits, rightLimits, storageKey],
  );
  const [internalLeftWidth, setInternalLeftWidth] = useState(initial.leftWidth);
  const [rightWidth, setRightWidth] = useState(initial.rightWidth);
  const [bottomHeight, setBottomHeight] = useState(initial.bottomHeight);
  const [internalLeftCollapsed, setInternalLeftCollapsed] = useState(initial.leftCollapsed);
  const [internalRightCollapsed, setInternalRightCollapsed] = useState(initial.rightCollapsed);
  const leftWidth = leftWidthProp ?? internalLeftWidth;
  const leftCollapsed = leftCollapsedProp ?? internalLeftCollapsed;
  const rightCollapsed = rightCollapsedProp ?? internalRightCollapsed;

  // 受控模式下父组件拥有 leftWidth；非受控模式下组件自己保存。
  // 工作台与 Settings 可以因此共享同一个左栏宽度事实源，而不是各存一份。
  const setResolvedLeftWidth = useCallback((next: number | ((value: number) => number)) => {
    const resolved = typeof next === "function" ? next(leftWidth) : next;
    if (leftWidthProp === undefined) setInternalLeftWidth(resolved);
    onLeftWidthChange?.(resolved);
  }, [leftWidth, leftWidthProp, onLeftWidthChange]);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const activeLayoutTransitionsRef = useRef(new Set<string>());
  const sideDragRef = useRef<SideDragState | null>(null);
  const bottomDragRef = useRef<BottomDragState | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingRef = useRef<number | null>(null);

  const trackLayoutTransitionStart = useCallback((event: TransitionEvent) => {
    const root = rootRef.current;
    if (!root || event.target !== root || !["grid-template-columns", "grid-template-rows"].includes(event.propertyName)) return;
    activeLayoutTransitionsRef.current.add(event.propertyName);
    root.dataset.layoutTransitioning = "true";
    if (event.propertyName === "grid-template-columns") root.dataset.widthTransitioning = "true";
  }, []);

  const trackLayoutTransitionEnd = useCallback((event: TransitionEvent) => {
    const root = rootRef.current;
    if (!root || event.target !== root || !["grid-template-columns", "grid-template-rows"].includes(event.propertyName)) return;
    const activeTransitions = activeLayoutTransitionsRef.current;
    activeTransitions.delete(event.propertyName);
    if (!activeTransitions.size) root.dataset.layoutTransitioning = "false";
    if (event.propertyName === "grid-template-columns" && !activeTransitions.has("grid-template-columns")) {
      root.dataset.widthTransitioning = "false";
    }
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.addEventListener("transitionrun", trackLayoutTransitionStart);
    root.addEventListener("transitionend", trackLayoutTransitionEnd);
    root.addEventListener("transitioncancel", trackLayoutTransitionEnd);
    return () => {
      root.removeEventListener("transitionrun", trackLayoutTransitionStart);
      root.removeEventListener("transitionend", trackLayoutTransitionEnd);
      root.removeEventListener("transitioncancel", trackLayoutTransitionEnd);
    };
  }, [trackLayoutTransitionEnd, trackLayoutTransitionStart]);

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
        ? (!rightEnabled || rightCollapsed ? 0 : rightWidth)
        : (leftCollapsed ? 0 : leftWidth)
      : 0;
    const staticMax = side === "left" ? leftLimits.max : rightLimits.max;
    const handleBudget = layoutMode === "desktop"
      ? HANDLE_WIDTH + (rightEnabled ? HANDLE_WIDTH : 0)
      : HANDLE_WIDTH;
    const available = Math.max(0, rect.width - otherWidth - minCenterWidth - handleBudget);
    return Math.max(0, Math.min(staticMax, available > 0 ? available : staticMax));
  }, [layoutMode, leftCollapsed, leftLimits.max, leftWidth, minCenterWidth, rightCollapsed, rightEnabled, rightLimits.max, rightWidth]);

  // 响应式计算结果变化时，把历史持久化尺寸重新夹进当前容器允许的范围。
  // 这一步很重要：用户在大屏保存的 340px 侧栏，切到小窗后不能继续拿 340px 挤压主区。
  useEffect(() => {
    setResolvedLeftWidth((value) => clamp(value, leftLimits.min, leftLimits.max));
  }, [leftLimits.max, leftLimits.min, setResolvedLeftWidth]);

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
    setResolvedLeftWidth((value) => clamp(value, dynamicMin, dynamicMax));
  }, [getDynamicMax, leftLimits.min, setResolvedLeftWidth]);

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
      layoutDefaultsVersion: 3,
    }));
  }, [bottomHeight, leftCollapsed, leftWidth, rightCollapsed, rightWidth, storageKey]);

  // ===== 4. 左右栏与底部面板共用的 Pointer 拖拽和吸附预览 =====
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

  const setBottomPreview = useCallback((visualHeight: number, snapped: boolean) => {
    const root = rootRef.current;
    if (!root) return;
    root.dataset.snapPreview = snapped ? "bottom" : "none";
    root.dataset.autoSnap = snapped ? "bottom" : "none";
    root.style.setProperty("--lfaa-bottom-row", `${Math.max(0, visualHeight)}px`);
  }, []);

  // requestAnimationFrame 合并高频 pointermove。
  // 规则：
  // 1) min 是左右栏和底部面板“正常展开态”的最小可用尺寸，不等于吸附触发线；
  // 2) Pointer 越过 min 后，视觉宽度固定在 min；只继续累计“隐藏超拖距离”；
  // 3) 只有 Pointer 的虚拟尺寸达到 captureThreshold（默认 min × 0.50）才进入 snap capture；
  // 4) 未达到 captureThreshold 就松手时保持 min，不会收起，降低误触；
  // 5) 已 capture 后 Pointer 仍按住，只要反向拖过 min + hysteresis，就从 0 恢复到 min 并继续正常拉伸；
  // 6) 只有 Pointer Up 时仍处于 snapped，才真正提交侧栏收起或底部面板关闭。
  const flushPending = useCallback(() => {
    frameRef.current = null;
    const sideDrag = sideDragRef.current;
    const bottomDrag = bottomDragRef.current;
    const drag = sideDrag ?? bottomDrag;
    if (!drag) return;
    const pendingValue = pendingRef.current;
    if (pendingValue === null && drag.releaseStartedAt === null) return;
    const rawValue = pendingValue ?? drag.lastRaw;
    pendingRef.current = null;

    const frame = resolveSnapDragFrame({
      rawSize: rawValue,
      minSize: drag.min,
      maxSize: drag.max,
      captureThreshold: drag.captureThreshold,
      snapped: drag.snapped,
      releaseHysteresis: snapHysteresis,
    });
    drag.lastRaw = frame.rawSize;
    drag.snapped = frame.snapped;

    if (frame.releasedThisFrame) {
      drag.releaseStartedAt = performance.now();
    } else if (frame.capturedThisFrame) {
      drag.releaseStartedAt = null;
    }

    let visualSize = frame.visualSize;
    if (!frame.snapped && drag.releaseStartedAt !== null) {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const progress = reducedMotion
        ? 1
        : clamp((performance.now() - drag.releaseStartedAt) / Math.max(1, snapReleaseDurationMs), 0, 1);
      // 只在反向释放的固定时长内缓动；缓动结束时系数为 1，与最新 Pointer 尺寸无缝衔接。
      visualSize *= easeInOutCubic(progress);
      if (progress >= 1) drag.releaseStartedAt = null;
    }

    // 同一解析结果驱动水平栏和底部面板，避免分轴维护不同的阻尼或释放规则。
    if (sideDrag) setSidePreview(sideDrag.side, visualSize, frame.snapped);
    if (bottomDrag) {
      bottomDrag.lastHeight = frame.visualSize || bottomDrag.min;
      setBottomPreview(visualSize, frame.snapped);
    }
    // 普通拖动逐帧直写；仅吸附后的短暂反向释放会有限时地补帧。
    if (!frame.snapped && drag.releaseStartedAt !== null) frameRef.current = window.requestAnimationFrame(flushPending);
  }, [setBottomPreview, setSidePreview, snapHysteresis, snapReleaseDurationMs]);

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
      target: event.currentTarget,
      rectLeft: rect.left,
      rectRight: rect.right,
      startSize: current,
      min: effectiveMin,
      max: effectiveMax,
      lastRaw: current,
      captureThreshold: resolveSnapCaptureThreshold(effectiveMin, snapCaptureRatio),
      snapped: false,
      releaseStartedAt: null,
    };

    root.dataset.dragging = side;
    root.dataset.snapPreview = "none";
    root.dataset.autoSnap = "none";
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.classList.add("lfaa-is-resizing");
  }, [getDynamicMax, leftCollapsed, leftLimits.min, leftWidth, rightCollapsed, rightLimits.min, rightWidth, snapCaptureRatio]);

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
        const frame = resolveSnapDragFrame({
          rawSize: rawValue,
          minSize: drag.min,
          maxSize: drag.max,
          captureThreshold: drag.captureThreshold,
          snapped: drag.snapped,
          releaseHysteresis: snapHysteresis,
        });
        drag.lastRaw = frame.rawSize;
        drag.snapped = frame.snapped;
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
        setResolvedLeftWidth(finalWidth);
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
    drag.releaseStartedAt = null;
    pendingRef.current = null;
    if (root) {
      root.dataset.dragging = "none";
      root.dataset.snapPreview = "none";
      root.dataset.autoSnap = "none";
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }, [setResolvedLeftCollapsed, setResolvedLeftWidth, setResolvedRightCollapsed, snapHysteresis]);

  // ===== 5. 底部面板拖拽与向下吸附收起 =====
  const onBottomPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const root = rootRef.current;
    if (!root || !bottomOpen) return;
    const rect = root.getBoundingClientRect();
    const dynamicMax = Math.max(bottomLimits.min, Math.min(bottomLimits.max, rect.height - 180));
    bottomDragRef.current = {
      pointerId: event.pointerId,
      target: event.currentTarget,
      rectBottom: rect.bottom,
      startHeight: bottomHeight,
      min: bottomLimits.min,
      max: dynamicMax,
      lastRaw: bottomHeight,
      lastHeight: bottomHeight,
      captureThreshold: resolveSnapCaptureThreshold(bottomLimits.min, snapCaptureRatio),
      snapped: false,
      releaseStartedAt: null,
    };
    root.dataset.dragging = "bottom";
    root.dataset.snapPreview = "none";
    root.dataset.autoSnap = "none";
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.classList.add("lfaa-is-resizing-vertical");
  }, [bottomHeight, bottomLimits.max, bottomLimits.min, bottomOpen, snapCaptureRatio]);

  const onBottomPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = bottomDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    schedule(drag.rectBottom - event.clientY);
  }, [schedule]);

  const finishBottomDrag = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = bottomDragRef.current;
    const root = rootRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      const rawValue = pendingRef.current;
      if (rawValue !== null) {
        const frame = resolveSnapDragFrame({
          rawSize: rawValue,
          minSize: drag.min,
          maxSize: drag.max,
          captureThreshold: drag.captureThreshold,
          snapped: drag.snapped,
          releaseHysteresis: snapHysteresis,
        });
        drag.lastRaw = frame.rawSize;
        drag.snapped = frame.snapped;
        drag.lastHeight = frame.visualSize || drag.min;
      }
    }

    if (drag.snapped) {
      root?.style.setProperty("--lfaa-bottom-row", "0px");
      onBottomOpenChange?.(false);
    } else {
      const finalHeight = clamp(drag.lastHeight, drag.min, drag.max);
      root?.style.setProperty("--lfaa-bottom-row", `${finalHeight}px`);
      setBottomHeight(finalHeight);
    }

    bottomDragRef.current = null;
    drag.releaseStartedAt = null;
    pendingRef.current = null;
    document.body.classList.remove("lfaa-is-resizing-vertical");
    if (root) {
      root.dataset.dragging = "none";
      root.dataset.snapPreview = "none";
      root.dataset.autoSnap = "none";
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }, [onBottomOpenChange, snapHysteresis]);

  // 中断拖拽时恢复开始前的尺寸，并同步清掉 Pointer、动画帧和全局光标状态。
  const cancelPointerInteractions = useCallback(() => {
    const root = rootRef.current;
    const sideDrag = sideDragRef.current;
    const bottomDrag = bottomDragRef.current;
    sideDragRef.current = null;
    bottomDragRef.current = null;

    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    pendingRef.current = null;

    if (root && sideDrag) {
      const columnName = sideDrag.side === "left" ? "--lfaa-left-column" : "--lfaa-right-column";
      const sizeName = sideDrag.side === "left" ? "--lfaa-left-size" : "--lfaa-right-size";
      root.style.setProperty(columnName, `${sideDrag.startSize}px`);
      root.style.setProperty(sizeName, `${sideDrag.startSize}px`);
    }
    if (root && bottomDrag) root.style.setProperty("--lfaa-bottom-row", `${bottomDrag.startHeight}px`);

    if (root) {
      root.dataset.dragging = "none";
      root.dataset.snapPreview = "none";
      root.dataset.autoSnap = "none";
    }
    if (typeof document !== "undefined") {
      document.body.classList.remove("lfaa-is-resizing", "lfaa-is-resizing-vertical");
    }

    if (sideDrag?.target.hasPointerCapture(sideDrag.pointerId)) sideDrag.target.releasePointerCapture(sideDrag.pointerId);
    if (bottomDrag?.target.hasPointerCapture(bottomDrag.pointerId)) bottomDrag.target.releasePointerCapture(bottomDrag.pointerId);
  }, []);

  const cancelPointerEvent = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (sideDragRef.current?.pointerId === event.pointerId || bottomDragRef.current?.pointerId === event.pointerId) {
      cancelPointerInteractions();
    }
  }, [cancelPointerInteractions]);

  useEffect(() => {
    const handleWindowBlur = () => cancelPointerInteractions();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") cancelPointerInteractions();
    };
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      cancelPointerInteractions();
    };
  }, [cancelPointerInteractions]);

  // ===== 6. Separator 键盘 Resize =====
  // Home 收起、End 恢复；方向键按 12px，Shift+方向键按 36px。
  const keyboardResize = useCallback((event: KeyboardEvent<HTMLDivElement>, side: "left" | "right") => {
    const collapsed = side === "left" ? leftCollapsed : rightCollapsed;
    // 已吸附的栏位不能从 resize separator 反向展开；使用外部显式控件或快捷键。
    if (collapsed) return;
    const step = event.shiftKey
      ? WORKBENCH_INTERACTION_TOKENS.keyboard.fastStepPx
      : WORKBENCH_INTERACTION_TOKENS.keyboard.stepPx;
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
        setResolvedLeftWidth((value) => clamp(Math.max(value, leftLimits.initial), leftLimits.min, max));
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
      setResolvedLeftWidth((value) => clamp(value + (event.key === expandKey ? step : -step), leftLimits.min, max));
    } else {
      const max = Math.max(rightLimits.min, getDynamicMax("right"));
      setResolvedRightCollapsed(false);
      setRightWidth((value) => clamp(value + (event.key === expandKey ? step : -step), rightLimits.min, max));
    }
  }, [getDynamicMax, leftCollapsed, leftLimits.initial, leftLimits.min, rightCollapsed, rightLimits.initial, rightLimits.min, setResolvedLeftCollapsed, setResolvedLeftWidth, setResolvedRightCollapsed]);

  // ===== 7. CSS Grid 变量输出 =====
  // 普通开合由 CSS Grid 完成；拖动尺寸由共用 Pointer 帧处理直接写入或执行释放缓动。
  const style = {
    "--lfaa-left-size": `${leftWidth}px`,
    // 收起侧栏时同步收起分隔器列，避免主内容边缘留下空隙或悬浮细线。
    "--lfaa-left-handle-width": `${leftVisible && !leftCollapsed ? HANDLE_WIDTH : 0}px`,
    "--lfaa-right-handle-width": `${rightEnabled && !rightCollapsed ? HANDLE_WIDTH : 0}px`,
    "--lfaa-right-size": `${rightWidth}px`,
    "--lfaa-left-column": `${leftCollapsed ? 0 : leftWidth}px`,
    "--lfaa-right-column": `${rightEnabled && !rightCollapsed ? rightWidth : 0}px`,
    "--lfaa-bottom-size": `${bottomHeight}px`,
    "--lfaa-bottom-row": `${bottom && bottomOpen ? bottomHeight : 0}px`,
    // 吸附捕获和状态归位只从统一 token 写入 CSS 变量；释放缓动由共用 Pointer 帧处理驱动。
    "--lfaa-snap-capture-duration": `${snapCaptureDurationMs}ms`,
    "--lfaa-snap-settle-duration": `${snapSettleDurationMs}ms`,
  } as CSSProperties;

  const centerPane = <main className="lfaa-workbench__center">{center}</main>;
  const rightPane = rightEnabled ? <aside className="lfaa-workbench__pane lfaa-workbench__pane--right" aria-label="右侧工作区">{right}</aside> : null;

  // ===== 8. DOM 结构 =====
  // 交换时同步交换 DOM 顺序，保证视觉顺序、键盘焦点顺序与辅助技术阅读顺序一致。
  return (
    <div
      ref={rootRef}
      className="lfaa-workbench"
      style={style}
      data-left-collapsed={leftCollapsed}
      data-right-collapsed={rightCollapsed}
      data-right-swapped={rightPaneSwapped}
      data-bottom-open={Boolean(bottom && bottomOpen)}
      data-layout-transitioning="false"
      data-width-transitioning="false"
      data-dragging="none"
      data-snap-preview="none"
      data-auto-snap="none"
      data-layout-mode={layoutMode}
    >
      {leftVisible ? <aside className="lfaa-workbench__pane lfaa-workbench__pane--left" aria-label="左侧导航">{left}</aside> : null}
      {leftVisible ? <div
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
        onPointerCancel={cancelPointerEvent}
        onLostPointerCapture={cancelPointerEvent}
        onKeyDown={(event) => keyboardResize(event, "left")}
      /> : null}

      {rightPaneSwapped ? rightPane : centerPane}

      {rightEnabled && layoutMode === "desktop" && !rightCollapsed && onSwapPanes ? <button
        className="lfaa-workbench__swap-control"
        type="button"
        aria-label={rightPaneSwapped ? "恢复左右窗格" : "交换中间区与工具资源栏"}
        aria-pressed={rightPaneSwapped}
        title={rightPaneSwapped ? "恢复左右窗格" : "交换左右窗格"}
        data-tooltip={rightPaneSwapped ? "恢复左右窗格" : "交换左右窗格"}
        onClick={onSwapPanes}
      ><span aria-hidden="true">↔</span></button> : null}

      {rightEnabled ? <div
        className="lfaa-workbench__handle lfaa-workbench__handle--right"
        role="separator"
        aria-orientation="vertical"
        aria-label="调整中间区与侧栏宽度"
        aria-valuemin={rightLimits.min}
        aria-valuemax={rightLimits.max}
        aria-valuenow={rightCollapsed ? 0 : rightWidth}
        tabIndex={rightCollapsed ? -1 : 0}
        aria-disabled={rightCollapsed}
        onPointerDown={(event) => onSidePointerDown(event, "right")}
        onPointerMove={onSidePointerMove}
        onPointerUp={finishSideDrag}
        onPointerCancel={cancelPointerEvent}
        onLostPointerCapture={cancelPointerEvent}
        onKeyDown={(event) => keyboardResize(event, "right")}
      /> : null}

      {rightPaneSwapped ? centerPane : rightPane}

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
            onPointerCancel={cancelPointerEvent}
            onLostPointerCapture={cancelPointerEvent}
          />
          <div className="lfaa-workbench__bottom-content">{bottom}</div>
        </section>
      ) : null}
    </div>
  );
}
