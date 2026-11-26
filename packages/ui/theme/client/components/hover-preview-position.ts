// 悬停预览卡的贴边翻转：纯函数，便于单测；组件只负责把结果写成 transform。
/** 预览卡固定尺寸（与 ThemeHoverPreview.module.css 的 width 保持一致）。 */
export const PREVIEW_CARD_WIDTH = 340;
export const PREVIEW_CARD_HEIGHT = 236;

/** 光标在视口右下边缘时把卡片翻到左上，避免出界。 */
export function placePreviewCard(
  x: number,
  y: number,
  viewportWidth: number,
  viewportHeight: number,
): { x: number; y: number } {
  const flipX = x + 18 + PREVIEW_CARD_WIDTH > viewportWidth - 8;
  const flipY = y + 34 + PREVIEW_CARD_HEIGHT > viewportHeight - 8;
  return {
    x: flipX ? -PREVIEW_CARD_WIDTH - 18 : 18,
    y: flipY ? -PREVIEW_CARD_HEIGHT - 36 : 34,
  };
}