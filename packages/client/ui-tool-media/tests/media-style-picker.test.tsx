// 输入栏风格选择器：自动状态、全部选项、选中态与中英文案。
import assert from "node:assert/strict";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as { React?: typeof React }).React = React;

const { MediaStylePicker } = await import("../client/compose/MediaStylePicker");

test("风格选择器默认显示「风格 自动」，浮层包含全部风格", () => {
  const html = renderToStaticMarkup(createElement(MediaStylePicker, {
    isZh: true,
    value: "auto",
    initialOpen: true,
    onChange: () => {},
  }));
  assert.match(html, /风格<\/span><span[^>]*>自动/u);
  for (const option of ["自动", "写真", "电影感", "插画", "二次元", "水彩", "3D"]) {
    assert.ok(html.includes(option), `缺少风格选项 ${option}`);
  }
  assert.match(html, /aria-label="选择画面风格"/u);
});

test("选中电影感时触发按钮显示该风格并标记选中", () => {
  const html = renderToStaticMarkup(createElement(MediaStylePicker, {
    isZh: false,
    value: "cinematic",
    initialOpen: true,
    onChange: () => {},
  }));
  assert.match(html, /Style<\/span><span[^>]*>Cinematic/u);
  assert.match(html, /aria-selected="true"[^>]*data-active="true"/u);
  assert.match(html, /aria-label="Image style"/u);
});