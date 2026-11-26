// 设置中心「终端」页回归：沿用统一页头、分组与行式结构，分段控件读取已保存的位置。
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

const { TerminalSettingsView } = await import("../client/settings/TerminalSettingsView");

test("终端设置页使用统一页头与行式分组，并显示已保存的位置", () => {
  const stored = new Map<string, string>([["lfaa:terminal-placement", "bottom"]]);
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => { stored.set(key, value); },
      removeItem: (key: string) => { stored.delete(key); },
      clear: () => { stored.clear(); },
      key: () => null,
      get length() { return stored.size; },
    },
  });

  try {
    const html = renderToStaticMarkup(createElement(TerminalSettingsView, { isZh: true }));

    // 页头与分组：h1 页标题 + h2 分组标题，和「Git」「常规」等页同一套结构。
    assert.match(html, /<h1[^>]*>终端<\/h1>/u);
    assert.match(html, /<h2[^>]*>布局<\/h2>/u);
    assert.ok(html.includes("展示位置"));
    assert.ok(html.includes("在右侧工作台以标签页打开，或停在工作台底部。"));

    // 分段控件：两项都在，当前值来自 localStorage。
    assert.match(html, /aria-pressed="false"[^>]*>右侧面板/u);
    assert.match(html, /aria-pressed="true"[^>]*>底部面板/u);
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
  }
});