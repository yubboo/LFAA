// 外观开关的像素图标：9×9 点阵上的月亮与太阳，按参考图的方块颗粒感手工排布。
/** 网格边长；渲染时用 viewBox 0 0 9 9 画方块，坐标即格子序号。 */
export const PIXEL_GRID = 9;

export interface PixelCell {
  x: number;
  y: number;
}

export type PixelGlyphKind = "moon" | "sun";

/** 月亮：左下实心、右上被咬掉一块的圆盘，缺口外留两粒碎点，读起来才是月牙。 */
const MOON_CELLS: PixelCell[] = [
  { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 },
  { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 },
  { x: 0, y: 3 }, { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 },
  { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 },
  { x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }, { x: 3, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 },
  { x: 0, y: 6 }, { x: 1, y: 6 }, { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 7, y: 6 },
  { x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 }, { x: 6, y: 7 },
  { x: 2, y: 8 }, { x: 3, y: 8 }, { x: 4, y: 8 }, { x: 5, y: 8 },
  { x: 7, y: 0 }, { x: 8, y: 3 },
];

/** 太阳：中心圆盘 + 八个方向的短射线，射线与圆盘之间留一格空隙。 */
const SUN_CELLS: PixelCell[] = [
  { x: 4, y: 0 }, { x: 1, y: 1 }, { x: 7, y: 1 }, { x: 2, y: 2 }, { x: 4, y: 2 }, { x: 6, y: 2 },
  { x: 3, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 3 },
  { x: 0, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }, { x: 5, y: 4 }, { x: 6, y: 4 }, { x: 8, y: 4 },
  { x: 3, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 },
  { x: 2, y: 6 }, { x: 4, y: 6 }, { x: 6, y: 6 }, { x: 1, y: 7 }, { x: 7, y: 7 }, { x: 4, y: 8 },
];

/** 按图标种类取方块表，渲染层直接遍历。 */
export function pixelCells(kind: PixelGlyphKind): PixelCell[] {
  return kind === "sun" ? SUN_CELLS : MOON_CELLS;
}