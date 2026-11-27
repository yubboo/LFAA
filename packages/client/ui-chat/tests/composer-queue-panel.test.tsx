// 验证排队面板摘要与提示：收起/展开文案、全部发送提示，以及箭头位于操作之后。
import assert from "node:assert/strict";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as { React?: typeof React }).React = React;

const { ComposerFollowUpHint, ComposerQueuePanel } = await import("../client/composer/ComposerQueuePanel");

const QUEUE = [
  { id: "q1", text: "第一条排队消息" },
  { id: "q2", text: "第二条排队消息" },
];

test("排队面板摘要包含条数、全部插话与末尾展开箭头", () => {
  const html = renderToStaticMarkup(createElement(ComposerQueuePanel, {
    isZh: true,
    queue: QUEUE,
    onEdit: () => undefined,
    onRemove: () => undefined,
    onMove: () => undefined,
    onSendNow: () => undefined,
    onClear: () => undefined,
    onFlush: () => undefined,
  }));
  assert.match(html, /2 条排队消息/u);
  assert.match(html, /全部插话/u);
  const summary = html.slice(html.indexOf("<summary"), html.indexOf("</summary>") + 10);
  assert.match(summary, /全部插话<\/button>.*chevron/su);
  assert.match(html, /第一条排队消息/u);
  assert.match(html, /第二条排队消息/u);
});

test("有排队消息时提示直接说明 Ctrl+Enter 立即发送全部", () => {
  const html = renderToStaticMarkup(createElement(ComposerFollowUpHint, {
    isZh: true,
    followUpMode: "queue",
    running: true,
    queuedCount: 2,
  }));
  assert.match(html, /2 条排队中/u);
  assert.match(html, /Ctrl\+Enter 立即发送全部/u);
  assert.doesNotMatch(html, /相反操作/u);
});

test("没有排队时提示仍说明 Enter 的排队行为", () => {
  const html = renderToStaticMarkup(createElement(ComposerFollowUpHint, {
    isZh: true,
    followUpMode: "queue",
    running: true,
    queuedCount: 0,
  }));
  assert.match(html, /Enter 排队/u);
  assert.match(html, /Ctrl\+Enter 相反操作/u);
});