// 计算左二栏与右侧栏拖拽调宽、弹性阻尼压缩、中心区保护与 50% 阈值磁吸折叠纯函数。
export const MIN_PANEL_WIDTH = 220;
export const MAX_PANEL_WIDTH = 440;
export const MIN_CENTER_WIDTH = 360;
export const SNAP_THRESHOLD_RATIO = 0.5;
export const SNAP_THRESHOLD_WIDTH = MIN_PANEL_WIDTH * SNAP_THRESHOLD_RATIO;
export const SNAP_REOPEN_THRESHOLD_WIDTH = SNAP_THRESHOLD_WIDTH + 14;
export const DRAG_THRESHOLD_PX = 3;

export function hasExceededDragThreshold(
  startX: number,
  currentX: number,
  threshold = DRAG_THRESHOLD_PX,
): boolean {
  return Math.abs(currentX - startX) >= threshold;
}

export interface ResizeOutcome {
  snappedCollapsed: boolean;
  width: number;
  visualWidth: number;
  tension: number;
}

export function computeMaxPanelWidth({
  shellWidth,
  railWidth,
  oppositeWidth,
}: {
  shellWidth: number;
  railWidth: number;
  oppositeWidth: number;
}): number {
  const available = shellWidth - railWidth - oppositeWidth - MIN_CENTER_WIDTH;
  return Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, Math.floor(available)));
}

// 拖拽进入 [110, 220) 区间时提供温和的弹性收缩与透明度阻尼反馈；低于 110px 吸附收起，已吸附后回拉过 124px 平滑重开。
export function computeResizeOutcome({
  rawWidth,
  shellWidth,
  railWidth,
  oppositeWidth,
  wasCollapsed = false,
}: {
  rawWidth: number;
  shellWidth: number;
  railWidth: number;
  oppositeWidth: number;
  wasCollapsed?: boolean;
}): ResizeOutcome {
  const threshold = wasCollapsed ? SNAP_REOPEN_THRESHOLD_WIDTH : SNAP_THRESHOLD_WIDTH;
  if (rawWidth < threshold) {
    return { snappedCollapsed: true, width: MIN_PANEL_WIDTH, visualWidth: 0, tension: 1 };
  }
  if (rawWidth < MIN_PANEL_WIDTH) {
    const progress = (MIN_PANEL_WIDTH - rawWidth) / (MIN_PANEL_WIDTH - SNAP_THRESHOLD_WIDTH);
    const clampedProgress = Math.max(0, Math.min(1, progress));
    const visualWidth = Math.round(MIN_PANEL_WIDTH - (MIN_PANEL_WIDTH - rawWidth) * 0.3);
    return {
      snappedCollapsed: false,
      width: MIN_PANEL_WIDTH,
      visualWidth,
      tension: Number(clampedProgress.toFixed(3)),
    };
  }
  const maxWidth = computeMaxPanelWidth({ shellWidth, railWidth, oppositeWidth });
  const clamped = Math.round(Math.max(MIN_PANEL_WIDTH, Math.min(rawWidth, maxWidth)));
  return { snappedCollapsed: false, width: clamped, visualWidth: clamped, tension: 0 };
}

export function computeKeyResizeWidth({
  side,
  key,
  shiftKey,
  currentWidth,
  shellWidth,
  railWidth,
  oppositeWidth,
}: {
  side: "left" | "right";
  key: "ArrowLeft" | "ArrowRight";
  shiftKey: boolean;
  currentWidth: number;
  shellWidth: number;
  railWidth: number;
  oppositeWidth: number;
}): number {
  const step = shiftKey ? 48 : 16;
  const signedDelta = side === "left"
    ? (key === "ArrowRight" ? step : -step)
    : (key === "ArrowLeft" ? step : -step);
  const maxWidth = computeMaxPanelWidth({ shellWidth, railWidth, oppositeWidth });
  return Math.round(Math.max(MIN_PANEL_WIDTH, Math.min(currentWidth + signedDelta, maxWidth)));
}

// React 仅维护持久化基础宽度变量；拖拽瞬时宽度由 --left-drag-width / --right-drag-width 独立覆盖，避免重渲染误删内联宽度。
export function buildSidebarWidthVars({
  isCompact,
  leftWidth,
  rightWidth,
}: {
  isCompact: boolean;
  leftWidth: number | null;
  rightWidth: number | null;
}): Record<string, string> {
  if (isCompact) return {};
  const vars: Record<string, string> = {};
  if (leftWidth !== null) {
    vars["--left-sidebar-base-width"] = `${leftWidth}px`;
  }
  if (rightWidth !== null) {
    vars["--right-panel-base-width"] = `${rightWidth}px`;
  }
  return vars;
}
