// 验证共享折叠面板按钮的状态表达：动作文案、aria-expanded、左右镜像与分栏线标记都随状态变化。
import assert from "node:assert/strict";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as { React?: typeof React }).React = React;

const { PanelToggleButton } = await import("../client/PanelToggleButton");

test("展开态输出收起文案与展开标记", () => {
  const markup = renderToStaticMarkup(createElement(PanelToggleButton, {
    expanded: true,
    label: "收起左二菜单栏",
    onClick: () => {},
  }));
  assert.match(markup, /aria-expanded="true"/u);
  assert.match(markup, /aria-label="收起左二菜单栏"/u);
  assert.match(markup, /data-expanded="true"/u);
  assert.match(markup, /data-side="left"/u);
  assert.match(markup, /<line/u);
});

test("收起态复用同一图形并支持右栏镜像", () => {
  const markup = renderToStaticMarkup(createElement(PanelToggleButton, {
    expanded: false,
    label: "展开右侧菜单栏",
    side: "right",
    onClick: () => {},
  }));
  assert.match(markup, /aria-expanded="false"/u);
  assert.match(markup, /aria-label="展开右侧菜单栏"/u);
  assert.match(markup, /data-expanded="false"/u);
  assert.match(markup, /data-side="right"/u);
});
