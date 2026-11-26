// 悬浮卡片几何共用口径：与 @lfaa/ui-theme 的 --popover-* 令牌保持一致，
// 供账号菜单、模式菜单等贴左二栏展开的浮层复用同一组内缩与宽度上限。
/** 参与定位的矩形，只保留需要的边，DOM 与测试共用。 */
export interface PopoverRect {
  left: number;
  right: number;
  bottom: number;
  width: number;
}

/** 卡片最宽值：21.5rem（对应 --popover-max-width），栏再宽也不放大。 */
export const POPOVER_MAX_WIDTH = 344;
/** 贴栏时左缘内缩：贴住栏内左边线（对应 --popover-edge）。 */
export const POPOVER_EDGE = 2;
/** 贴栏时右缘内缩：给栏内滚动条让位（对应 --popover-scrollbar-gutter）。 */
export const POPOVER_SCROLLBAR_GUTTER = 12;
/** 卡片与视口四周的最小间距。 */
export const POPOVER_VIEWPORT_EDGE = 8;

/** 贴栏卡片的左缘：栏左缘 + 2px，不压住栏的分隔线。 */
export function columnPopoverLeft(column: PopoverRect): number {
  return column.left + POPOVER_EDGE;
}

/** 贴栏卡片的宽度：栏宽扣掉左右内缩，封顶 21.5rem，窄栏下也不为负。 */
export function columnPopoverWidth(column: PopoverRect): number {
  return Math.min(POPOVER_MAX_WIDTH, Math.max(0, column.width - POPOVER_EDGE - POPOVER_SCROLLBAR_GUTTER));
}