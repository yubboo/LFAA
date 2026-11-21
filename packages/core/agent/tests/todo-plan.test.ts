// 验证任务清单策略：todo_write 排到工具首位，且提醒只在「没清单 + 已多步 + 没提醒过」时触发一次。
import assert from "node:assert/strict";
import test from "node:test";
import { preferTodoFirst, shouldNudgeTodos } from "../src/todo-plan";

test("todo_write 被提到工具清单首位，其余顺序不变", () => {
  const tools = [{ name: "read_file" }, { name: "todo_write" }, { name: "write_file" }];
  assert.deepEqual(preferTodoFirst(tools).map((tool) => tool.name), ["todo_write", "read_file", "write_file"]);
  assert.deepEqual(preferTodoFirst([{ name: "a" }, { name: "b" }]).map((tool) => tool.name), ["a", "b"]);
  assert.deepEqual(preferTodoFirst([]), []);
});

test("提醒条件：无清单且已执行至少三次工具，同一次运行只提醒一次", () => {
  assert.equal(shouldNudgeTodos({ existingTodos: 0, executedToolCount: 3, alreadyNudged: false }), true);
  assert.equal(shouldNudgeTodos({ existingTodos: 2, executedToolCount: 5, alreadyNudged: false }), false);
  assert.equal(shouldNudgeTodos({ existingTodos: 0, executedToolCount: 2, alreadyNudged: false }), false);
  assert.equal(shouldNudgeTodos({ existingTodos: 0, executedToolCount: 6, alreadyNudged: true }), false);
});