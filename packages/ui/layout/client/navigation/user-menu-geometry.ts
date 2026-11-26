// 用户菜单浮层几何：让账号卡片贴着左二会话栏内侧展开，宽度跟随该栏而不压到中间会话区。
import type { PopoverRect } from "./popover-geometry";
import {
  POPOVER_EDGE,
  POPOVER_MAX_WIDTH,
  POPOVER_SCROLLBAR_GUTTER,
  POPOVER_VIEWPORT_EDGE,
  columnPopoverLeft,
  columnPopoverWidth,
} from "./popover-geometry";

export type { PopoverRect } from "./popover-geometry";

export interface UserMenuGeometry {
  left: number;
  bottom: number;
  width: number;
}

/** 卡片最宽值：左二栏够宽时也用原来的 21.5rem，不再随视口无限变肥。 */
export const USER_MENU_MAX_WIDTH = POPOVER_MAX_WIDTH;
/** 左二栏收起时贴着图标栏展开的间距。 */
const RAIL_GAP = 8;

/** 计算菜单卡片位置；左二栏缺席（收起/窄屏）时退回贴着图标栏的独立浮层。 */
export function resolveUserMenuGeometry({
  trigger,
  column,
  viewportHeight,
  viewportWidth,
}: {
  trigger: PopoverRect;
  column: PopoverRect | null;
  viewportHeight: number;
  viewportWidth: number;
}): UserMenuGeometry {
  const bottom = Math.max(POPOVER_VIEWPORT_EDGE, viewportHeight - trigger.bottom);
  const anchoredToColumn = column !== null && column.width > POPOVER_EDGE + POPOVER_SCROLLBAR_GUTTER;
  if (anchoredToColumn) {
    return {
      left: columnPopoverLeft(column),
      bottom,
      width: columnPopoverWidth(column),
    };
  }
  const left = trigger.right + RAIL_GAP;
  const room = viewportWidth - left - POPOVER_VIEWPORT_EDGE;
  return { left, bottom, width: Math.max(0, Math.min(POPOVER_MAX_WIDTH, room)) };
}