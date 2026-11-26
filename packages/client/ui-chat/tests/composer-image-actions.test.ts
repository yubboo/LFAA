// 验证图片附件另存为文件名的推导：保留原名与扩展名，缺扩展名时按 MIME 补全，空名回落 image。
import assert from "node:assert/strict";
import test from "node:test";
import { imageFileName } from "../client/composer/composer-image-actions";

test("另存为：已有扩展名时原样保留，路径只取文件名", () => {
  assert.equal(imageFileName("截图.png", "image/png"), "截图.png");
  assert.equal(imageFileName("C:\\Users\\yu\\Pictures\\photo.webp", "image/webp"), "photo.webp");
});

test("另存为：缺扩展名时按图片类型补全，jpeg 归一为 jpg", () => {
  assert.equal(imageFileName("截图", "image/jpeg"), "截图.jpg");
  assert.equal(imageFileName("截图", "image/png"), "截图.png");
});

test("另存为：空名称回落到 image 并补扩展名", () => {
  assert.equal(imageFileName("   ", "image/webp"), "image.webp");
});