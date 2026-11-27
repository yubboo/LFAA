// 验证模型选择行：方舟「控制台路由」已在副标题里时不再单独占一行，额外状态仍保留。
import assert from "node:assert/strict";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as { React?: typeof React }).React = React;

const { ModelOptionRow } = await import("../client/models/ModelReasoningList");
const { arkModelMessages } = await import("../client/locales");

function render(id: string, displayName: string | undefined): string {
  return renderToStaticMarkup(createElement(ModelOptionRow, {
    item: { id, ...(displayName ? { displayName } : {}), supportsReasoning: false, reasoningMode: "none", reasoningLevels: [] },
    selected: false,
    arkPlan: "agent",
    arkLabels: arkModelMessages.zh,
    onSelect: () => {},
  }));
}

test("方舟控制台路由已在副标题中，不再单独重复一行", () => {
  const html = render("ark-code-latest", "方舟路由 · 控制台路由");
  assert.equal((html.match(/控制台路由/gu) ?? []).length, 1);
});

test("即将下线等额外状态仍然显示", () => {
  const html = render("kimi-k3", "Kimi · 文本生成、推理");
  assert.match(html, /即将下线/u);
});