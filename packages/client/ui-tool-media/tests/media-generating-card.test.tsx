// 生成中占位卡片：骨架宽高跟随目标比例，文案与比例标签中英文正确。
import assert from "node:assert/strict";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as { React?: typeof React }).React = React;

const { MediaGeneratingCard } = await import("../client/compose/Media-Generating-Card");

test("竖图占位收窄、横图占位放宽，比例标签与文案可见", () => {
  const portrait = renderToStaticMarkup(createElement(MediaGeneratingCard, { kind: "image", ratio: "9:16", isZh: true }));
  assert.match(portrait, /正在生成图片/u);
  assert.match(portrait, /9:16/u);
  assert.match(portrait, /aspect-ratio:9 \/ 16/u);
  assert.match(portrait, /width:11\.8125rem/u);
  assert.match(portrait, /role="status"/u);

  const landscape = renderToStaticMarkup(createElement(MediaGeneratingCard, { kind: "image", ratio: "16:9", isZh: false }));
  assert.match(landscape, /Generating image/u);
  assert.match(landscape, /width:22rem/u);
  assert.match(landscape, /16:9/u);
});

test("未给出比例时按方图占位，视频与语音使用各自文案", () => {
  const video = renderToStaticMarkup(createElement(MediaGeneratingCard, { kind: "video", isZh: true }));
  assert.match(video, /正在生成视频/u);
  assert.match(video, /aspect-ratio:1 \/ 1/u);
  assert.match(video, /width:21rem/u);
  assert.doesNotMatch(video, /\d{1,2}:\d{1,2}<\/span>/u);

  const audio = renderToStaticMarkup(createElement(MediaGeneratingCard, { kind: "audio", isZh: false }));
  assert.match(audio, /Generating speech/u);
});