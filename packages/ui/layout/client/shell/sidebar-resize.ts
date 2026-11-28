// 计算左二栏与右侧栏拖拽调宽、弹性阻尼压缩、中心区保护与 50% 阈值磁吸折叠纯函数。
export const MIN_PANEL_WIDTH = 220;
// 左二会话栏默认最小宽度（与参考工作区红线对齐），窄桌面下不再被 15% 压窄导致内容变形。
export const LEFT_MIN_PANEL_WIDTH = 240;
export const MIN_CENTER_WIDTH = 360;
// 扣除左一图标栏后，左二默认上限 18%，手动调整可到 25%。
const LEFT_DEFAULT_MAX_SHARE = 0.18;
const PANEL_MAX_SHARE = { left: 0.25, right: 0.75 };
const CENTER_MIN_SHARE = 0.1;
export const SNAP_THRESHOLD_RATIO = 0.5;
const SNAP_REOPEN_BUFFER = 14;
export const SNAP_THRESHOLD_WIDTH = LEFT_MIN_PANEL_WIDTH * SNAP_THRESHOLD_RATIO;
export const SNAP_REOPEN_THRESHOLD_WIDTH = SNAP_THRESHOLD_WIDTH + SNAP_REOPEN_BUFFER;
export const DRAG_THRESHOLD_PX = 3;

/** 区分调宽手柄位于主工作区哪一侧。 */
export type ResizeSide = "left" | "right";

/** 过滤按下分隔条后的小幅位移，避免点击被误判为拖拽。 */
export function hasExceededDragThreshold(
  startX: number,
  currentX: number,
  threshold = DRAG_THRESHOLD_PX,
): boolean {
  return Math.abs(currentX - startX) >= threshold;
}

/** 同时记录吸附结果、保存宽度及拖拽过程中的视觉宽度。 */
export interface ResizeOutcome {
  snappedCollapsed: boolean;
  width: number;
  visualWidth: number;
  tension: number;
}

/** 左二只为已展开右栏预留最小宽度，右栏则必须保留左二的当前宽度。 */
export function computeMaxPanelWidth({
  side,
  shellWidth,
  railWidth,
  oppositeWidth,
}: {
  side: ResizeSide;
  shellWidth: number;
  railWidth: number;
  oppositeWidth: number;
}): number {
  const available = Math.max(0, shellWidth - railWidth);
  const centerMin = Math.max(MIN_CENTER_WIDTH, available * CENTER_MIN_SHARE);
  const oppositeReserve = side === "left" ? Math.min(oppositeWidth, MIN_PANEL_WIDTH) : oppositeWidth;
  const panelMax = Math.min(available * PANEL_MAX_SHARE[side], available - centerMin - oppositeReserve);
  return Math.max(0, panelMax);
}

/** 左二栏保底 240px（不因比例压窄变形），右栏沿用 220px；两者均不超过当前可用上限。 */
function computeMinPanelWidth(side: ResizeSide, _shellWidth: number, _railWidth: number, maxWidth: number): number {
  const baseMin = side === "left" ? LEFT_MIN_PANEL_WIDTH : MIN_PANEL_WIDTH;
  return Math.min(baseMin, maxWidth);
}

/** 左二扩宽时先推右栏，使中央宽度保持稳定，右栏到最小时再将剩下的增量交给中央。 */
export function computePushedRightWidth(startLeftWidth: number, nextLeftWidth: number, startRightWidth: number): number | null {
  const growth = nextLeftWidth - startLeftWidth;
  if (growth <= 0 || startRightWidth <= MIN_PANEL_WIDTH) return null;
  return Math.max(MIN_PANEL_WIDTH, startRightWidth - growth);
}

// 正常宽度用 110px 吸附线。比例限制使侧栏窄于 220px 时，吸附和阻尼按实际展开宽度缩放。
export function computeResizeOutcome({
  side,
  rawWidth,
  shellWidth,
  railWidth,
  oppositeWidth,
  wasCollapsed = false,
}: {
  side: ResizeSide;
  rawWidth: number;
  shellWidth: number;
  railWidth: number;
  oppositeWidth: number;
  wasCollapsed?: boolean;
}): ResizeOutcome {
  const maxWidth = computeMaxPanelWidth({ side, shellWidth, railWidth, oppositeWidth });
  const minWidth = computeMinPanelWidth(side, shellWidth, railWidth, maxWidth);
  const snapWidth = minWidth * SNAP_THRESHOLD_RATIO;
  const threshold = wasCollapsed ? Math.min(minWidth, snapWidth + SNAP_REOPEN_BUFFER) : snapWidth;
  if (rawWidth < threshold) {
    return { snappedCollapsed: true, width: Math.ceil(minWidth), visualWidth: 0, tension: 1 };
  }
  if (rawWidth < minWidth) {
    const progress = (minWidth - rawWidth) / (minWidth - snapWidth);
    const clampedProgress = Math.max(0, Math.min(1, progress));
    const visualWidth = minWidth - (minWidth - rawWidth) * 0.3;
    return {
      snappedCollapsed: false,
      width: Math.ceil(minWidth),
      visualWidth,
      tension: Number(clampedProgress.toFixed(3)),
    };
  }
  // 拖拽保留 CSS 布局的小数精度。到达上限时保存向上取整的偏好，由 CSS 限制实际宽度。
  const visualWidth = Math.min(rawWidth, maxWidth);
  const width = visualWidth === maxWidth ? Math.ceil(maxWidth) : Math.round(visualWidth);
  return { snappedCollapsed: false, width, visualWidth, tension: 0 };
}

/** 按分隔条方向计算键盘调宽步进，并应用和拖拽相同的边界。 */
export function computeKeyResizeWidth({
  side,
  key,
  shiftKey,
  currentWidth,
  shellWidth,
  railWidth,
  oppositeWidth,
}: {
  side: ResizeSide;
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
  const maxWidth = computeMaxPanelWidth({ side, shellWidth, railWidth, oppositeWidth });
  const minWidth = computeMinPanelWidth(side, shellWidth, railWidth, maxWidth);
  return Math.max(minWidth, Math.min(currentWidth + signedDelta, maxWidth));
}

// Shell 与拖拽共用比例和最小宽度。拖拽临时变量仍独立，避免 React 重渲染清空指针位置。
export function buildSidebarWidthVars({
  isCompact,
  leftWidth,
  rightWidth,
  rightWide = false,
}: {
  isCompact: boolean;
  leftWidth: number | null;
  rightWidth: number | null;
  rightWide?: boolean;
}): Record<string, string> {
  if (isCompact) return {};
  const vars: Record<string, string> = {
    "--left-default-max-share": String(LEFT_DEFAULT_MAX_SHARE),
    "--left-max-share": String(PANEL_MAX_SHARE.left),
    "--right-max-share": String(PANEL_MAX_SHARE.right),
    "--center-min-share": String(CENTER_MIN_SHARE),
    "--center-min-pixels": `${MIN_CENTER_WIDTH}px`,
    "--panel-min-pixels": `${MIN_PANEL_WIDTH}px`,
    "--left-min-pixels": `${LEFT_MIN_PANEL_WIDTH}px`,
  };
  if (leftWidth !== null) {
    vars["--left-sidebar-base-width"] = `${leftWidth}px`;
  }
  if (rightWidth !== null) {
    // 一旦用户手动调宽过右栏，严格按已保存宽度定格；仅在未调宽过时由 CSS right-wide 提供宽默认值。
    vars["--right-panel-base-width"] = `${rightWidth}px`;
  }
  return vars;
}
