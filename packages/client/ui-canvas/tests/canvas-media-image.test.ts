// 浏览器媒体变换的几何测试：在 Node.js 验证裁剪与宫格输出的源像素范围。
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cropPixels, gridRegions, mediaOutputSize } from "../client/canvas/canvas-media-image";
import { frameSampleTimes } from "../client/canvas/canvas-media-video";

describe("画布图片编辑", () => {
  it("把百分比裁剪框换算为边缘一致的源像素区间", () => {
    assert.deepEqual(cropPixels(101, 53, { x: 10, y: 25, width: 70, height: 50 }), {
      x: 10, y: 13, width: 71, height: 27,
    });
    assert.equal(cropPixels(101, 53, { x: 25, y: 0, width: 80, height: 100 }), null);
    assert.equal(cropPixels(101, 53, { x: NaN, y: 0, width: 10, height: 100 }), null);
  });

  it("完整切分不能整除的图片，最后一行和一列补齐余下像素", () => {
    const regions = gridRegions(101, 53, 3);
    assert.equal(regions.length, 9);
    assert.deepEqual(regions[0], { x: 0, y: 0, width: 33, height: 17 });
    assert.deepEqual(regions[8], { x: 67, y: 35, width: 34, height: 18 });
    assert.equal(regions.reduce((sum, region) => sum + region.width * region.height, 0), 101 * 53);
  });

  it("按长边缩放横竖素材，视频输出限制为偶数尺寸", () => {
    assert.deepEqual(mediaOutputSize(640, 480, 1920), { width: 1920, height: 1440 });
    assert.deepEqual(mediaOutputSize(721, 1281, 1080, true), { width: 608, height: 1080 });
    assert.throws(() => mediaOutputSize(0, 480, 1920), RangeError);
    assert.throws(() => mediaOutputSize(640, 480, 1081, true), RangeError);
  });
});

describe("画布视频采样", () => {
  it("均匀覆盖所选区间，最后一点不落在视频结束位置", () => {
    assert.deepEqual(frameSampleTimes(2, 8, 3), [2, 4, 6]);
    assert.deepEqual(frameSampleTimes(1.5, 2.5, 1), [1.5]);
    assert.throws(() => frameSampleTimes(5, 5, 3), RangeError);
    assert.throws(() => frameSampleTimes(0, 2, 13), RangeError);
  });
});
