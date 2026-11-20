// 验证待办工具包的状态归一、合并与统计逻辑。
import assert from "node:assert/strict";
import test from "node:test";
import { mergeTodos, normalizeStatus, summarize } from "../src/index";

test("非法状态归为 pending", () => {
  assert.equal(normalizeStatus("completed"), "completed");
  assert.equal(normalizeStatus("doing"), "pending");
  assert.equal(normalizeStatus(undefined), "pending");
});

test("同 id 覆盖、新 id 追加、未提及保留", () => {
  const merged = mergeTodos(
    [{ id: "a", content: "写文档", status: "pending" }],
    [{ id: "a", content: "写文档", status: "completed" }, { id: "b", content: "补测试", status: "pending" }],
  );
  assert.equal(merged.length, 2);
  assert.equal(merged.find((item) => item.id === "a")?.status, "completed");
});

test("统计完成与进行中数量", () => {
  const stats = summarize([
    { id: "a", content: "x", status: "completed" },
    { id: "b", content: "y", status: "pending" },
  ]);
  assert.deepEqual(stats, { total: 2, completed: 1, active: 1 });
});