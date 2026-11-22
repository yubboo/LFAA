// 验证独立轨迹按文本偏移呈现真实步骤，并兼容历史记录。
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getChatLocale } from "../client/locales";

(globalThis as { React?: typeof React }).React = React;
registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith(".css")) return { format: "module", shortCircuit: true, source: "export default new Proxy({}, { get: (_, k) => String(k) });" };
  return nextLoad(url, context);
} });
const { ConversationTrace } = await import("../client/conversation/Conversation-Trace");
// 组件文案随本机语言切换，断言使用同一份 locale，避免 en-US 之外的环境误报。
const locale = getChatLocale();

test("轨迹按正文与步骤顺序展示运行中的真实数据", () => {
  const html = renderToStaticMarkup(createElement(ConversationTrace, {
    locale: getChatLocale(), pendingApproval: null, onResolveApproval: () => {},
    messages: [{ id: "a", role: "assistant", content: "先检查再回答", createdAt: 1, status: "streaming", steps: [
      { id: "s", phase: "act", status: "running", iteration: 1, title: "读取文件", textOffset: 3, timestamp: 1 },
    ] }],
  }));
  assert.ok(html.indexOf("先检查") < html.indexOf("读取文件"));
  assert.ok(html.indexOf("读取文件") < html.indexOf("再回答"));
  assert.ok(html.includes(locale.isZh ? "进行中" : "Running"));
});

test("来自对话的定位选中对应消息步骤", () => {
  const html = renderToStaticMarkup(createElement(ConversationTrace, {
    locale: getChatLocale(), pendingApproval: null, onResolveApproval: () => {}, target: { messageId: "b", stepId: "s" },
    messages: ["a", "b"].map((id) => ({ id, role: "assistant" as const, content: "", createdAt: 1, steps: [
      { id: "s", phase: "act" as const, status: "done" as const, iteration: 1, title: id, timestamp: 1 },
    ] })),
  }));
  assert.match(html, /aria-pressed="true"/u);
  assert.ok(html.includes(locale.isZh ? "轨迹详情" : "Event details"));
});
