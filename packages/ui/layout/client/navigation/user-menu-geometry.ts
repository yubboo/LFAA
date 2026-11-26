// 用户菜单浮层几何：让账号卡片贴着左二会话栏内侧展开，宽度跟随该栏而不压到中间会话区。
/** 参与计算的矩形，只保留定位需要的边距，DOM 与测试共用。 */
export interface MenuRect {
  left: number;
  right: number;
  bottom: number;
  width: number;
}

export interface UserMenuGeometry {
  left: number;
  bottom: number;
  width: number;
}

/** 卡片最宽值：左二栏够宽时也用原来的 21.5rem，不再随视口无限变肥。 */
export const USER_MENU_MAX_WIDTH = 344;
/** 左边内缩：卡片贴着栏的左边线，只留 2px 让圆角不压住分隔线（对应 `--popover-edge`）。 */
const COLUMN_LEFT_INSET = 2;
/** 右边内缩：给栏内滚动条让位（滚动条 10px + 2px 间隙），卡片不压住它（对应 `--popover-scrollbar-gutter`）。 */
const COLUMN_RIGHT_INSET = 12;
/** 左二栏收起时贴着图标栏展开的间距。 */
const RAIL_GAP = 8;
/** 卡片与视口四周的最小间距。 */
const VIEWPORT_EDGE = 8;

/** 计算菜单卡片位置；左二栏缺席（收起/窄屏）时退回贴着图标栏的独立浮层。 */
export function resolveUserMenuGeometry({
  trigger,
  column,
  viewportHeight,
  viewportWidth,
}: {
  trigger: MenuRect;
  column: MenuRect | null;
  viewportHeight: number;
  viewportWidth: number;
}): UserMenuGeometry {
  const bottom = Math.max(VIEWPORT_EDGE, viewportHeight - trigger.bottom);
  const columnInsets = COLUMN_LEFT_INSET + COLUMN_RIGHT_INSET;
  const anchoredToColumn = column !== null && column.width > columnInsets;
  if (anchoredToColumn) {
    return {
      left: column.left + COLUMN_LEFT_INSET,
      bottom,
      width: Math.min(USER_MENU_MAX_WIDTH, column.width - columnInsets),
    };
  }
  const left = trigger.right + RAIL_GAP;
  const room = viewportWidth - left - VIEWPORT_EDGE;
  return { left, bottom, width: Math.max(0, Math.min(USER_MENU_MAX_WIDTH, room)) };
}
