// 验证输入框上方任务卡：进度摘要、递增步骤序号、状态点、空清单不渲染、超过 12 条折叠余项。
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

const { TodoDock, TODO_DOCK_VISIBLE_LIMIT } = await import("../client/session/TodoDock");

const LIST = [
  { id: "1", content: "读源码", status: "completed" as const },
  { id: "2", content: "写测试", status: "in_progress" as const },
  { id: "3", content: "跑构建", status: "pending" as const },
];

test("渲染进度摘要与每条任务的状态点", () => {
  const html = renderToStaticMarkup(createElement(TodoDock, { todos: LIST, isZh: true }));
  assert.match(html, /data-testid="todo-dock"/u);
  assert.match(html, />任务</u);
  assert.match(html, /1 已完成 · 1 进行中 · 1 待处理/u);
  assert.match(html, /读源码/u);
  assert.match(html, /data-status="completed"/u);
  assert.match(html, /data-status="in_progress"/u);
  assert.match(html, /data-status="pending"/u);
  assert.equal((html.match(/class="marker"/gu) ?? []).length, LIST.length);
  assert.match(html, /spinner/u);
});

test("默认收起时只显示标题和摘要，不渲染任务行", () => {
  const html = renderToStaticMarkup(createElement(TodoDock, { todos: LIST, isZh: true, defaultCollapsed: true }));
  assert.match(html, /aria-expanded="false"/u);
  assert.match(html, /1 已完成 · 1 进行中 · 1 待处理/u);
  assert.doesNotMatch(html, /读源码/u);
});

test("暂停时进行中行停转，摘要与读屏文案改为已暂停", () => {
  const html = renderToStaticMarkup(createElement(TodoDock, { todos: LIST, isZh: true, paused: true }));
  assert.match(html, /1 已暂停/u);
  assert.doesNotMatch(html, /spinner/u);
  assert.match(html, /pauseIcon/u);
  assert.match(html, />已暂停</u);
});

test("空清单不渲染任何节点", () => {
  assert.equal(renderToStaticMarkup(createElement(TodoDock, { todos: [], isZh: true })), "");
});

test("每条任务带从 1 开始的递增序号，供规划步骤使用", () => {
  const html = renderToStaticMarkup(createElement(TodoDock, { todos: LIST, isZh: true }));
  assert.match(html, /<ol/u);
  LIST.forEach((_, index) => {
    const step = index + 1;
    assert.match(html, new RegExp(`data-step="${step}"`, "u"));
    assert.match(html, new RegExp(`>${step}\\.</span>`, "u"));
  });
});

test("超过上限时只渲染前 12 条并提示余量", () => {
  const many = Array.from({ length: TODO_DOCK_VISIBLE_LIMIT + 3 }, (_, index) => ({
    id: String(index),
    content: `任务 ${index}`,
    status: "pending" as const,
  }));
  const html = renderToStaticMarkup(createElement(TodoDock, { todos: many, isZh: true }));
  assert.match(html, new RegExp(`展开全部 ${TODO_DOCK_VISIBLE_LIMIT + 3} 条`, "u"));
  // 12 个任务行 + 1 行展开按钮；状态点与条目共用 data-status，因此不按状态计数。
  assert.equal((html.match(/<li/gu) ?? []).length, TODO_DOCK_VISIBLE_LIMIT + 1);
  assert.doesNotMatch(html, /任务 14/u);
});

test("英文界面使用英文文案", () => {
  const html = renderToStaticMarkup(createElement(TodoDock, { todos: LIST, isZh: false }));
  assert.match(html, /Tasks/u);
  assert.match(html, /1 done · 1 active · 1 pending/u);
});

test("任务条目只读：不渲染勾选控件，状态由隐藏文本表达", () => {
  const html = renderToStaticMarkup(createElement(TodoDock, { todos: LIST, isZh: true }));
  assert.doesNotMatch(html, /role="checkbox"/u);
  // 只有折叠标题是按钮；任务行不能出现任何可点击控件。
  assert.equal((html.match(/<button/gu) ?? []).length, 1);
  assert.equal((html.match(/class="srOnly"/gu) ?? []).length, LIST.length);
  assert.match(html, />进行中</u);
  assert.match(html, />待处理</u);
});