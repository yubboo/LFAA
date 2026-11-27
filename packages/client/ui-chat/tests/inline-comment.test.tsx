// 验证行内批注框的结构：行号提示、输入框、取消/添加按钮，以及空草稿时禁用提交。
import assert from "node:assert/strict";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ChatClientStore } from "../client/store/chat-store";

(globalThis as { React?: typeof React }).React = React;

const { InlineComment } = await import("../client/workbench/InlineComment");

const store = { enqueueComposerInsert: () => undefined } as unknown as ChatClientStore;

test("行内批注框渲染行号提示、输入框与操作按钮，空草稿时禁用提交", () => {
  const html = renderToStaticMarkup(createElement(InlineComment, {
    lineNumber: 12,
    lineText: "const a = 1;",
    displayPath: "src/a.ts",
    isZh: true,
    store,
    onClose: () => undefined,
  }));
  assert.match(html, /第 12 行批注/u);
  assert.match(html, /<textarea/u);
  assert.match(html, /取消/u);
  assert.match(html, /添加到对话/u);
  assert.match(html, /disabled=""/u);
});

test("英文界面使用英文文案", () => {
  const html = renderToStaticMarkup(createElement(InlineComment, {
    lineNumber: 3,
    lineText: "x",
    displayPath: "b.ts",
    isZh: false,
    store,
    onClose: () => undefined,
  }));
  assert.match(html, /Line 3 comment/u);
  assert.match(html, /Add Comment/u);
});