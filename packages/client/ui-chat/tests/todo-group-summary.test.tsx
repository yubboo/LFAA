// 验证一轮里有多步操作时，活动摘要会并列真实动作，不再只显示最后一步或退回「N 项操作」。
// 断言固定使用中文词典：CI（en-US）与本地（zh-CN）的 navigator.language 不同，不能让用例随宿主语言漂移。
import assert from "node:assert/strict";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { zhMessages } from "../client/locales.zh";
import type { AgentStepItem } from "../client/store/chat-types";

(globalThis as { React?: typeof React }).React = React;

const { AssistantTimeline } = await import("../client/conversation/AssistantTimeline");

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
    locale: zhMessages,
    content: "完成。",
    steps,
    createdAt: 1,
    isStreaming: false,
    pendingApproval: null,
    onResolveApproval: () => undefined,
    onOpenFile: () => undefined,
  }));
}

test("同轮包含命令与清单时，摘要并列两项真实动作并显示清单进度", () => {
  const html = render([
    step({ id: "cmd", toolName: "run_command", status: "done", timestamp: 3 }),
    step({ id: "todo", toolName: "todo_write", todos: TODOS, timestamp: 4 }),
  ]);
  assert.match(html, /已运行命令/u);
  assert.match(html, /已更新任务清单（完成 1 \/ 共 2）/u);
  assert.doesNotMatch(html, /项操作/u);
});

test("单步轮次直接给出动作摘要", () => {
  const html = render([step({ id: "cmd", toolName: "run_command", status: "done" })]);
  assert.match(html, /已运行命令/u);
  assert.doesNotMatch(html, /项操作/u);
});