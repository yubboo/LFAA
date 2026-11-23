// 验证错误条：文案常驻，工作区冲突时多出「用工作树并行」入口。
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
        source: "export default new Proxy({}, { get: (_, key) => String(key) });",
      };
    }
    return nextLoad(url, context);
  },
});

const { ChatErrorBanner } = await import("../client/conversation/ChatErrorBanner");

test("工作区冲突时显示文案与并行入口", () => {
  const html = renderToStaticMarkup(createElement(ChatErrorBanner, {
    message: "工作区正被「会话一」占用。",
    isZh: true,
    showIsolate: true,
    onIsolate: () => undefined,
  }));
  assert.match(html, /工作区正被/u);
  assert.match(html, /用工作树并行/u);
});

test("普通错误只显示文案，不显示并行入口", () => {
  const html = renderToStaticMarkup(createElement(ChatErrorBanner, {
    message: "请求失败",
    isZh: true,
    showIsolate: false,
    onIsolate: () => undefined,
  }));
  assert.match(html, /请求失败/u);
  assert.doesNotMatch(html, /用工作树并行/u);
});