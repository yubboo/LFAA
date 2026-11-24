// 验证工作区顶栏的展开/收起入口统一由共享 PanelToggleButton 渲染：文案、展开状态与右栏隐藏规则保持一致。
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as { React?: typeof React }).React = React;

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) {
      return { format: "module", shortCircuit: true, source: "export default new Proxy({}, { get: (_, k) => String(k) });" };
    }
    return nextLoad(url, context);
  },
});

const { WorkspaceBar } = await import("../client/shell/WorkspaceBar");
const { locales } = await import("../client/locales");

/** 顶栏所需的最小属性集合，其余用默认值。 */
const baseProps = {
  locale: locales.zh,
  title: "首页",
  leftOpen: true,
  leftDragCollapsed: false,
  hasRightColumn: true,
  rightOpen: false,
  rightDragCollapsed: false,
  onToggleLeft: () => {},
  onToggleRight: () => {},
};

test("顶栏左栏按钮使用共享折叠组件并反映展开状态", () => {
  const markup = renderToStaticMarkup(createElement(WorkspaceBar, baseProps));
  assert.match(markup, /data-side="left"/u);
  assert.match(markup, /data-expanded="true"/u);
  assert.match(markup, /aria-label="收起左二会话项目菜单栏"/u);
  assert.match(markup, /data-side="right"/u);
});

test("收起左栏后按钮切换为展开文案", () => {
  const markup = renderToStaticMarkup(createElement(WorkspaceBar, { ...baseProps, leftOpen: false }));
  assert.match(markup, /data-expanded="false"/u);
  assert.match(markup, /aria-label="展开左二会话项目菜单栏"/u);
});

test("三栏视图不渲染右栏切换按钮", () => {
  const markup = renderToStaticMarkup(createElement(WorkspaceBar, { ...baseProps, hasRightColumn: false }));
  assert.doesNotMatch(markup, /data-side="right"/u);
});
