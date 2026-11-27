// 验证交接条：标题、摘要、来源与接手/忽略按钮。
import assert from "node:assert/strict";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as { React?: typeof React }).React = React;

const { HandoffBar } = await import("../client/session/HandoffBar");

const HANDOFF = {
  id: "h1",
  title: "接手循环拆分",
  summary: "A1–A4 已完成，剩余 B1",
  nextSteps: ["写回调单测"],
  fromSessionId: "s1",
  projectId: "p1",
  createdAt: 1,
};

test("交接条显示标题、摘要与两个动作", () => {
  const html = renderToStaticMarkup(createElement(HandoffBar, {
    handoff: HANDOFF,
    isZh: true,
    onAccept: () => undefined,
    onDismiss: () => undefined,
  }));
  assert.match(html, /data-testid="handoff-bar"/u);
  assert.match(html, /待接手/u);
  assert.match(html, /接手循环拆分/u);
  assert.match(html, /A1–A4 已完成/u);
  assert.match(html, /接手/u);
  assert.match(html, /忽略/u);
});