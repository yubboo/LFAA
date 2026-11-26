// 模式菜单几何：卡片钉在左二栏内侧展开，宽度跟随该栏，不盖住中间会话区。
import type { PopoverRect } from "./popover-geometry";
import {
  POPOVER_MAX_WIDTH,
  POPOVER_VIEWPORT_EDGE,
  columnPopoverLeft,
  columnPopoverWidth,
} from "./popover-geometry";

export interface ModeMenuGeometry {
  left: number;
  top: number;
  width: number;
}

/** 卡片与触发按钮的垂直间距。 */
const TRIGGER_GAP = 8;
/** 左二栏缺席时贴着触发按钮展开的间距。 */
const TRIGGER_RIGHT_GAP = 8;

/** 计算模式卡片位置；左二栏缺席（收起/窄屏）时退回贴着触发按钮的独立浮层。 */
export function resolveModeMenuGeometry({
  trigger,
  column,
  viewportWidth,
}: {
  trigger: PopoverRect;
  column: PopoverRect | null;
  viewportWidth: number;
}): ModeMenuGeometry {
  const top = trigger.bottom + TRIGGER_GAP;
  if (column !== null && column.width > 0) {
    return { left: columnPopoverLeft(column), top, width: columnPopoverWidth(column) };
  }
  const left = trigger.right + TRIGGER_RIGHT_GAP;
  const room = viewportWidth - left - POPOVER_VIEWPORT_EDGE;
  return { left, top, width: Math.max(0, Math.min(POPOVER_MAX_WIDTH, room)) };
}