// 验证共享滚动容器 ScrollArea 的 SSR 输出：方向标记、常驻槽标记、附加类名与内容包裹都正确，
// 且在无 DOM 的服务端渲染下不会因滚动监听而报错。
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// 测试用 tsx 走经典 JSX 运行时，和 layout 包用例一样把 React 挂到全局。
(globalThis as { React?: typeof React }).React = React;

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) {
      return { format: "module", shortCircuit: true, source: "export default new Proxy({}, { get: (_, k) => String(k) });" };
    }
    return nextLoad(url, context);
  },
});

const { ScrollArea } = await import("../client/ScrollArea");

test("ScrollArea 默认按纵向滚动并原样透传内容", () => {
  const markup = renderToStaticMarkup(createElement(ScrollArea, null, createElement("p", null, "设置正文")));
  assert.match(markup, /data-axis="y"/u);
  assert.match(markup, /设置正文/u);
  assert.doesNotMatch(markup, /data-gutter/u);
});

test("ScrollArea 支持横向方向、常驻槽位与附加类名", () => {
  const markup = renderToStaticMarkup(createElement(ScrollArea, {
    axis: "x",
    stableGutter: true,
    className: "extra-class",
    "aria-label": "设置滚动区",
  }, "项目"));
  assert.match(markup, /data-axis="x"/u);
  assert.match(markup, /data-gutter="stable"/u);
  assert.match(markup, /extra-class/u);
  assert.match(markup, /aria-label="设置滚动区"/u);
  assert.match(markup, /项目/u);
});