// 验证从会话步骤里取任务清单：取最近一次、跨消息回退、状态统计。
import assert from "node:assert/strict";
import test from "node:test";
import { countSessionTodos, latestSessionTodos } from "../client/session/session-todos";
import type { ChatMessageItem } from "../client/store/chat-types";

function message(id: string, todos: Array<{ id: string; content: string; status: "pending" | "in_progress" | "completed" }> | undefined): ChatMessageItem {
  return {
    id,
    role: "assistant",
    content: "",
    createdAt: 1,
    ...(todos
      ? {
        steps: [{
          id: `step-${id}`,
          iteration: 1,
          phase: "act",
          status: "done",
          title: "行动：todo_write",
          toolName: "todo_write",
          timestamp: 1,
          todos,
        }],
      }
      : {}),
  };
}

test("取最后一条消息里最后一次清单（整表替换语义）", () => {
  const first = [{ id: "1", content: "写文档", status: "pending" as const }];
  const second = [
    { id: "1", content: "写文档", status: "completed" as const },
    { id: "2", content: "补测试", status: "in_progress" as const },
  ];
  const messages = [message("m1", first), message("m2", second)];
  assert.deepEqual(latestSessionTodos(messages), second);
});

test("没有清单的会话返回 null，不渲染空卡片", () => {
  assert.equal(latestSessionTodos([]), null);
  assert.equal(latestSessionTodos([message("m1", undefined)]), null);
});

test("统计各状态数量", () => {
  assert.deepEqual(
    countSessionTodos([
      { id: "1", content: "a", status: "completed" },
      { id: "2", content: "b", status: "in_progress" },
      { id: "3", content: "c", status: "pending" },
    ]),
    { total: 3, completed: 1, inProgress: 1, pending: 1 },
  );
});

test("全部完成时不再有未完成任务，输入框任务卡应消失", () => {
  assert.equal(hasOpenSessionTodos([]), false);
  assert.equal(hasOpenSessionTodos([{ id: "1", content: "a", status: "completed" }]), false);
  assert.equal(hasOpenSessionTodos([
    { id: "1", content: "a", status: "completed" },
    { id: "2", content: "b", status: "pending" },
  ]), true);
});