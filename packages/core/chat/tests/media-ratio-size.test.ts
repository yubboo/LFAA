// 图片尺寸换算比例：再次生图占位用（覆盖常见比例与不匹配情况）。
import assert from "node:assert/strict";
import test from "node:test";
import { ratioFromSize } from "../client/chat-media";

test("常见图片尺寸能换算成对应比例", () => {
  assert.equal(ratioFromSize(2048, 1152), "16:9");
  assert.equal(ratioFromSize(1152, 2048), "9:16");
  assert.equal(ratioFromSize(2048, 2048), "1:1");
  assert.equal(ratioFromSize(2048, 1536), "4:3");
  assert.equal(ratioFromSize(1536, 2048), "3:4");
  assert.equal(ratioFromSize(1920, 1280), "3:2");
  assert.equal(ratioFromSize(1280, 1920), "2:3");
});

test("非常用比例或非法尺寸不强行归类", () => {
  assert.equal(ratioFromSize(2000, 800), undefined);
  assert.equal(ratioFromSize(0, 100), undefined);
  assert.equal(ratioFromSize(100, 0), undefined);
});