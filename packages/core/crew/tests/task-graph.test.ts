// 验证任务图校验与拓扑排序：重复 id、缺失依赖、自依赖、环与稳定顺序。
import assert from "node:assert/strict";
import test from "node:test";
import { checkTaskGraph, dependencyIds, orderTasks } from "../src/task-graph";
import type { CrewTaskSpec } from "../src/types";

function task(id: string, dependsOn?: string[]): CrewTaskSpec {
  return { id, description: `执行 ${id}`, expectedOutput: `${id} 的交付`, ...(dependsOn ? { dependsOn } : {}) };
}

test("合法任务图按依赖排序，同层保持声明顺序", () => {
  const tasks = [task("draft", ["research"]), task("research"), task("review", ["draft"])];
  assert.equal(checkTaskGraph(tasks).ok, true);
  assert.deepEqual(orderTasks(tasks).map((item) => item.id), ["research", "draft", "review"]);
});

test("同层任务按声明顺序执行", () => {
  const tasks = [task("b"), task("a"), task("c", ["a", "b"])];
  assert.deepEqual(orderTasks(tasks).map((item) => item.id), ["b", "a", "c"]);
});

test("空列表、重复 id、自依赖与缺失依赖都会被拦下", () => {
  assert.equal(checkTaskGraph([]).ok, false);
  assert.equal(checkTaskGraph([task("a"), task("a")]).ok, false);
  assert.equal(checkTaskGraph([task("a", ["a"])]).ok, false);
  assert.equal(checkTaskGraph([task("a", ["missing"])]).ok, false);
});

test("依赖成环会被拦下，orderTasks 抛错", () => {
  const tasks = [task("a", ["b"]), task("b", ["a"])];
  const check = checkTaskGraph(tasks);
  assert.equal(check.ok, false);
  assert.match(check.issues.join("；"), /环/u);
  assert.throws(() => orderTasks(tasks), /任务图不合法/u);
});

test("超过 6 个任务与空字段会被拦下", () => {
  const many = Array.from({ length: 7 }, (_, index) => task(`t${index}`));
  assert.equal(checkTaskGraph(many).ok, false);
  const missing = checkTaskGraph([{ id: "x", description: "", expectedOutput: "" }]);
  assert.equal(missing.ok, false);
  assert.equal(missing.issues.length >= 2, true);
});

test("依赖 id 去重后返回", () => {
  assert.deepEqual(dependencyIds(task("a", ["b", "b", "c"])), ["b", "c"]);
  assert.deepEqual(dependencyIds(task("a")), []);
});