// 验证任务清单在活动行里的文案：完成时显示真实进度，而不是裸 JSON 或统一措辞。
import assert from "node:assert/strict";
import test from "node:test";
import { getActivityLabel } from "../client/activity-label";
import type { AgentStepItem } from "../client/chat-types";

function step(overrides: Partial<AgentStepItem>): AgentStepItem {
  return {
    id: "s1",
    iteration: 1,
    phase: "act",
    status: "done",
    title: "行动：todo_write",
    toolName: "todo_write",
    timestamp: 1,
    ...overrides,
  };
}

const TODOS = [
  { id: "1", content: "读源码", status: "completed" as const },
  { id: "2", content: "写测试", status: "in_progress" as const },
  { id: "3", content: "跑构建", status: "pending" as const },
];

test("任务清单完成后显示「完成 N / 共 M」", () => {
  assert.equal(getActivityLabel(step({ todos: TODOS }), true), "已更新任务清单（完成 1 / 共 3）");
  assert.equal(getActivityLabel(step({ todos: TODOS }), false), "Updated task list (1/3 done)");
});

test("运行中的任务清单仍用进行时措辞", () => {
  assert.equal(getActivityLabel(step({ status: "running", todos: TODOS }), true), "正在更新任务清单");
});