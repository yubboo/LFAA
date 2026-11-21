// 验证生图比例识别与尺寸映射：明确比例优先、等值换算、未指定时用常用默认比例。
import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_IMAGE_RATIO, buildRatioHint, detectImageRatio, fallbackImageSize, resolveImagePlan, sizeToRatio,
} from "../src/image-ratio";

test("识别显式比例写法（半角/全角冒号、比、像素尺寸）", () => {
  assert.equal(detectImageRatio("生成一张 9:16 的竖屏美少女"), "9:16");
  assert.equal(detectImageRatio("来一张 16：9 横版海报"), "16:9");
  assert.equal(detectImageRatio("画个 4比3 的风景"), "4:3");
  assert.equal(detectImageRatio("1920x1080 的电脑壁纸"), "16:9");
  assert.equal(detectImageRatio("512x512 的蓝色图标"), "1:1");
  assert.equal(detectImageRatio("3:4 的人物写真"), "3:4");
});

test("识别画幅关键词，未提及比例时不乱猜", () => {
  assert.equal(detectImageRatio("竖版海报，海边日落"), "9:16");
  assert.equal(detectImageRatio("横屏壁纸，城市夜景"), "16:9");
  assert.equal(detectImageRatio("方形头像，白色背景"), "1:1");
  assert.equal(detectImageRatio("一位清爽自然的美少女肖像"), undefined);
});

test("比例计划：明确要求时给高清尺寸与构图提示，未指定时只给默认比例", () => {
  const explicit = resolveImagePlan("生成一张 9:16 的竖屏美少女");
  assert.equal(explicit.ratio, "9:16");
  assert.equal(explicit.size, "1152x2048");
  assert.equal(explicit.explicit, true);
  assert.match(explicit.hint ?? "", /9:16/u);

  const fallback = resolveImagePlan("一位清爽自然的美少女肖像");
  assert.equal(fallback.ratio, DEFAULT_IMAGE_RATIO);
  assert.equal(fallback.size, "2048x2048");
  assert.equal(fallback.explicit, false);
  assert.equal(fallback.hint, undefined);
});

test("等值比例换算与近似比例、兜底尺寸、尺寸反查", () => {
  assert.equal(detectImageRatio("1080:1920 竖屏"), "9:16");
  assert.equal(detectImageRatio("2:1 超宽海报"), "16:9");
  assert.equal(detectImageRatio("2:3 竖版海报"), "2:3");
  assert.equal(detectImageRatio("3:2 横版海报"), "3:2");
  assert.equal(fallbackImageSize("9:16"), "720x1280");
  assert.equal(fallbackImageSize("16:9"), "1280x720");
  assert.equal(fallbackImageSize("2:3"), "768x1152");
  assert.equal(sizeToRatio("2048x1152"), "16:9");
  assert.equal(sizeToRatio("1152x2048"), "9:16");
  assert.equal(sizeToRatio("bad-size"), undefined);
  assert.match(buildRatioHint("16:9"), /横版/u);
  assert.match(buildRatioHint("9:16"), /竖版/u);
  assert.match(buildRatioHint("2:3"), /竖版/u);
  assert.match(buildRatioHint("3:2"), /横版/u);
});

test("描述里明确写出的比例优先于输入栏选择，未写时按输入栏选择", () => {
  const picked = resolveImagePlan("一位美少女肖像", "16:9");
  assert.equal(picked.ratio, "16:9");
  assert.equal(picked.size, "2048x1152");
  assert.equal(picked.explicit, true);

  // 描述里写了 9:16 时以描述为准，避免输入栏残留的旧选择把用户明说的比例盖掉。
  const spoken = resolveImagePlan("生成一张 9:16 的竖版海报", "16:9");
  assert.equal(spoken.ratio, "9:16");
  assert.equal(spoken.size, "1152x2048");

  // 关键词同样优先。
  assert.equal(resolveImagePlan("竖版手机壁纸", "16:9").ratio, "9:16");

  const invalid = resolveImagePlan("一位美少女肖像", "5:4");
  assert.equal(invalid.ratio, "1:1");
  assert.equal(invalid.explicit, false);
});