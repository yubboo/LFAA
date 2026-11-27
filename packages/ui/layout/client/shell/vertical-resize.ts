// 计算底部面板（如终端）纵向拖拽调高、0.3 弹性阻尼、50% 磁吸折叠与预览线偏移纯函数。
import { DRAG_THRESHOLD_PX, SNAP_THRESHOLD_RATIO } from "./sidebar-resize";

const SNAP_REOPEN_BUFFER = 14;

/** 纵向拖拽计算结果：含吸附折叠状态、落位高度、视觉高度与阻尼张力（0..1）。 */
export interface VerticalResizeOutcome {
  snappedCollapsed: boolean;
  height: number;
  visualHeight: number;
  tension: number;
}

/** 根据原始目标高度计算纵向拖拽的阻尼、吸附与边界夹紧结果。 */
export function computeVerticalResizeOutcome({
  rawHeight,
  minHeight,
  maxHeight,
  wasCollapsed = false,
}: {
  rawHeight: number;
  minHeight: number;
  maxHeight: number;
  wasCollapsed?: boolean;
}): VerticalResizeOutcome {
  const safeMax = Math.max(0, maxHeight);
  const safeMin = Math.min(Math.max(0, minHeight), safeMax);
  const snapHeight = safeMin * SNAP_THRESHOLD_RATIO;
  const threshold = wasCollapsed ? Math.min(safeMin, snapHeight + SNAP_REOPEN_BUFFER) : snapHeight;

  if (rawHeight < threshold) {
    return { snappedCollapsed: true, height: Math.ceil(safeMin), visualHeight: 0, tension: 1 };
  }

  if (rawHeight < safeMin) {
    const span = Math.max(1, safeMin - snapHeight);
    const progress = Math.max(0, Math.min(1, (safeMin - rawHeight) / span));
    const visualHeight = safeMin - (safeMin - rawHeight) * 0.3;
    return {
      snappedCollapsed: false,
      height: Math.ceil(safeMin),
      visualHeight,
      tension: Number(progress.toFixed(3)),
    };
  }

  const visualHeight = Math.min(rawHeight, safeMax);
  const height = visualHeight === safeMax ? Math.ceil(safeMax) : Math.round(visualHeight);
  return { snappedCollapsed: false, height, visualHeight, tension: 0 };
}

/** 计算上沿手柄预览线相对起点的纵向 transform 偏移（向上变高为负，向下变矮/贴底为正）。 */
export function computeVerticalPreviewOffset(
  initialHeight: number,
  visualHeight: number,
  snappedCollapsed: boolean,
): number {
  const target = snappedCollapsed ? 0 : visualHeight;
  return initialHeight - target;
}

/** 过滤纵向按下后的微小抖动，避免误触拖拽。 */
export function hasExceededVerticalDragThreshold(
  startY: number,
  currentY: number,
  threshold = DRAG_THRESHOLD_PX,
): boolean {
  return Math.abs(currentY - startY) >= threshold;
}

/** 键盘上下方向键调整底部面板高度，默认 16px，按住 Shift 48px。 */
export function computeKeyVerticalResizeHeight({
  key,
  shiftKey,
  currentHeight,
  minHeight,
  maxHeight,
}: {
  key: "ArrowUp" | "ArrowDown";
  shiftKey: boolean;
  currentHeight: number;
  minHeight: number;
  maxHeight: number;
}): number {
  const step = shiftKey ? 48 : 16;
  const delta = key === "ArrowUp" ? step : -step;
  return Math.max(minHeight, Math.min(maxHeight, currentHeight + delta));
}
