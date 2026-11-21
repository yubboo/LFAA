// 验证一轮里有多步操作时，活动摘要会标注操作数，避免只显示最后一步而把同轮动作藏起来。
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getChatLocale } from "../client/locales";
import type { AgentStepItem } from "../client/chat-types";

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

const { AssistantTimeline } = await import("../client/components/AssistantTimeline");

const TODOS = [
  { id: "1", content: "读源码", status: "completed" as const },
  { id: "2", content: "写测试", status: "in_progress" as const },
];

function step(overrides: Partial<AgentStepItem>): AgentStepItem {
  return {
    id: "s1",
    iteration: 3,
    phase: "act",
    status: "done",
    title: "行动",
    timestamp: 2,
    ...overrides,
  };
}

function render(steps: AgentStepItem[]) {
  return renderToStaticMarkup(createElement(AssistantTimeline, {
    locale: getChatLocale(),
    content: "完成。",
    steps,
    createdAt: 1,
    isStreaming: false,
    pendingApproval: null,
    onResolveApproval: () => undefined,
    onOpenFile: () => undefined,
  }));
}

test("同轮包含命令与清单时，摘要标注「2 项操作」并显示清单进度", () => {
  const html = render([
    step({ id: "cmd", toolName: "run_command", status: "done", timestamp: 3 }),
    step({ id: "todo", toolName: "todo_write", todos: TODOS, timestamp: 4 }),
  ]);
  assert.match(html, /2 项操作/u);
  assert.match(html, /已更新任务清单（完成 1 \/ 共 2）/u);
});

test("单步轮次不加操作数前缀，保持原有摘要", () => {
  const html = render([step({ id: "cmd", toolName: "run_command", status: "done" })]);
  assert.doesNotMatch(html, /项操作/u);
});