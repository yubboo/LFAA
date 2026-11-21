// 输入栏比例选择器：自动状态与具体比例的触发文案、选项网格与选中态。
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as { React?: typeof React }).React = React;

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) {
      return {
        format: "module",
        shortCircuit: true,
        source: "export default new Proxy({}, { get: (_, k) => String(k) });",
      };
    }
    return nextLoad(url, context);
  },
});

const { MediaRatioPicker } = await import("../client/components/MediaRatioPicker");

test("比例选择器默认显示「比例 自动」，浮层包含全部常用比例", () => {
  const html = renderToStaticMarkup(createElement(MediaRatioPicker, {
    isZh: true,
    value: "auto",
    initialOpen: true,
    onChange: () => {},
  }));
  assert.match(html, /比例<\/span><span[^>]*>自动/u);
  for (const option of ["自动", "9:16", "2:3", "3:4", "1:1", "4:3", "3:2", "16:9"]) {
    assert.ok(html.includes(option), `缺少比例选项 ${option}`);
  }
  assert.match(html, /aria-label="选择图片比例"/u);
});

test("选中具体比例时触发按钮显示该比例，并标记选中项", () => {
  const html = renderToStaticMarkup(createElement(MediaRatioPicker, {
    isZh: false,
    value: "16:9",
    initialOpen: true,
    onChange: () => {},
  }));
  assert.match(html, /Ratio<\/span><span[^>]*>16:9/u);
  assert.match(html, /aria-selected="true"[^>]*data-active="true"/u);
  assert.match(html, /aria-label="Image ratio"/u);
});