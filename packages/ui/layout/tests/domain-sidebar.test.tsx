// 验证资料库左二菜单已把「图像」并入分类，旧图像域的 热门/模板/我的图像 占位菜单不再出现。
import assert from "node:assert/strict";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as { React?: typeof React }).React = React;

const { DomainSidebarMenu } = await import("../client/navigation/DomainSidebarMenu");
const { locales } = await import("../client/locales");
const { resolveWorkbenchDomain } = await import("../client/navigation/workbench-domains");

test("资料库左二菜单包含图像分类并与工作台标签同步", () => {
  const markup = renderToStaticMarkup(createElement(DomainSidebarMenu, {
    locale: locales.zh,
    domain: resolveWorkbenchDomain("library", locales.zh),
    activeView: "library",
    activeLibraryTab: "media",
    activeDomainItem: "",
    pluginViews: [],
    onSelectLibraryTab: () => {},
    onSelectDomainItem: () => {},
    onNavigate: () => {},
  }));

  assert.match(markup, /资料库分类/u);
  assert.match(markup, /全部资产与记忆/u);
  assert.match(markup, /图像/u);
  assert.match(markup, /Agent 产物/u);
  assert.match(markup, /本地资产/u);
  assert.match(markup, /Agent 记忆/u);
  assert.doesNotMatch(markup, /热门|模板|我的图像/u);
  assert.equal((markup.match(/aria-current="page"/gu) ?? []).length, 1);
});