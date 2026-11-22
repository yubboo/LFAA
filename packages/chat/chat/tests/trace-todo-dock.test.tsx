// 验证轨迹视图顶部复用任务卡：有清单时渲染，没有清单时不渲染。
// 断言固定使用中文词典：CI（en-US）与本地（zh-CN）的 navigator.language 不同，不能让用例随宿主语言漂移。
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { zhMessages } from "../client/locales.zh";
import type { ChatMessageItem } from "../client/store/chat-types";

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

const { ConversationTrace } = await import("../client/conversation/Conversation-Trace");

const TODOS = [
  { id: "1", content: "读源码", status: "completed" as const },
  { id: "2", content: "写测试", status: "in_progress" as const },
];

function messages(withTodos: boolean): ChatMessageItem[] {
  return [{
    id: "m1",
    role: "assistant",
    content: "已完成。",
    createdAt: 1,
    steps: [{
      id: "s1",
      iteration: 1,
      phase: "act",
      status: "done",
      title: "行动：todo_write",
      toolName: "todo_write",
      timestamp: 2,
      ...(withTodos ? { todos: TODOS } : {}),
    }],
  }];
}

function render(list: ChatMessageItem[]) {
  return renderToStaticMarkup(createElement(ConversationTrace, {
    messages: list,
    locale: zhMessages,
    target: null,
    pendingApproval: null,
    onResolveApproval: () => undefined,
  }));
}

test("有清单时轨迹视图顶部也显示任务卡，且默认收起", () => {
  const html = render(messages(true));
  assert.match(html, /data-testid="todo-dock"/u);
  assert.match(html, /进行中 1/u);
  assert.match(html, /aria-expanded="false"/u);
  assert.doesNotMatch(html, /读源码/u);
});

test("没有清单时不渲染任务卡", () => {
  const html = render(messages(false));
  assert.doesNotMatch(html, /data-testid="todo-dock"/u);
});