// 验证悬停预览卡的贴边翻转：默认落在光标右下，靠近视口右/下边缘时翻到另一侧。
import assert from "node:assert/strict";
import test from "node:test";
import {
  PREVIEW_CARD_HEIGHT,
  PREVIEW_CARD_WIDTH,
  placePreviewCard,
} from "../client/components/hover-preview-position";

test("视口中部：预览卡落在光标右下方", () => {
  assert.deepEqual(placePreviewCard(400, 300, 1440, 900), { x: 18, y: 34 });
});

test("靠近右边缘：翻到光标左侧，纵向不动", () => {
  const placed = placePreviewCard(1200, 300, 1440, 900);
  assert.equal(placed.x, -PREVIEW_CARD_WIDTH - 18);
  assert.equal(placed.y, 34);
});

test("靠近右下角：两轴同时翻转", () => {
  assert.deepEqual(placePreviewCard(1300, 800, 1440, 900), {
    x: -PREVIEW_CARD_WIDTH - 18,
    y: -PREVIEW_CARD_HEIGHT - 36,
  });
});