// 更多应用菜单几何：卡片贴着左二会话栏内侧展开，宽度跟随该栏而不盖住中间会话区。
import type { PopoverRect } from "./popover-geometry";
import {
  POPOVER_EDGE,
  POPOVER_MAX_WIDTH,
  POPOVER_SCROLLBAR_GUTTER,
  POPOVER_VIEWPORT_EDGE,
  columnPopoverLeft,
  columnPopoverWidth,
} from "./popover-geometry";

export interface AppMenuTriggerRect extends PopoverRect {
  top: number;
}

export interface AppMenuGeometry {
  left: number;
  top: number;
  width: number;
}

/** 左二栏收起时贴着图标栏展开的间距。 */
const RAIL_GAP = 8;
/** 8 项紧凑菜单的估算高度，用于在短视口下把顶边向上夹紧，避免贴底溢出。 */
export const APP_MENU_ESTIMATED_HEIGHT = 276;

/** 计算更多应用卡片位置；左二栏缺席（收起/窄屏）时退回贴着图标栏的独立浮层。 */
export function resolveAppMenuGeometry({
  trigger,
  column,
  viewportWidth,
  viewportHeight,
  estimatedHeight = APP_MENU_ESTIMATED_HEIGHT,
}: {
  trigger: AppMenuTriggerRect;
  column: PopoverRect | null;
  viewportWidth: number;
  viewportHeight: number;
  estimatedHeight?: number;
}): AppMenuGeometry {
  const maxTop = Math.max(POPOVER_VIEWPORT_EDGE, viewportHeight - estimatedHeight - POPOVER_VIEWPORT_EDGE);
  const top = Math.max(POPOVER_VIEWPORT_EDGE, Math.min(trigger.top, maxTop));
  const anchoredToColumn = column !== null && column.width > POPOVER_EDGE + POPOVER_SCROLLBAR_GUTTER;
  if (anchoredToColumn) {
    return {
      left: columnPopoverLeft(column),
      top,
      width: columnPopoverWidth(column),
    };
  }
  const left = trigger.right + RAIL_GAP;
  const room = viewportWidth - left - POPOVER_VIEWPORT_EDGE;
  return { left, top, width: Math.max(0, Math.min(POPOVER_MAX_WIDTH, room)) };
}
