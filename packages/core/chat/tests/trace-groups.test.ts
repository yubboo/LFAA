// 验证留痕分组：按动作类型归并、保持出现顺序、统计数量并标记失败。
import assert from "node:assert/strict";
import test from "node:test";
import { groupTrace } from "../client/components/trace-groups";
import type { AgentStepItem } from "../client/chat-types";

function step(partial: Partial<AgentStepItem> & { id: string }): AgentStepItem {
  return {
    iteration: 1,
    phase: "act",
    status: "done",
    title: "动作",
    timestamp: Date.now(),
    ...partial,
  } as AgentStepItem;
}

test("按类型归并并保持首次出现顺序", () => {
  const groups = groupTrace([
    step({ id: "a", toolName: "glob" }),
    step({ id: "b", toolName: "read_file" }),
    step({ id: "c", toolName: "glob" }),
  ], true);

  assert.deepEqual(groups.map((group) => group.key), ["search", "read"]);
  assert.equal(groups[0]?.steps.length, 2);
  assert.equal(groups[0]?.title, "已搜索");
});

test("命令与文件变更分别成组，并按语言取标题", () => {
  const zh = groupTrace([
    step({ id: "c1", toolName: "run_command" }),
    step({ id: "f1", toolName: "write_file", fileChange: { kind: "created" } as never }),
  ], true);
  assert.deepEqual(zh.map((group) => group.title), ["运行命令", "文件变更"]);

  const en = groupTrace([step({ id: "c1", toolName: "run_command" })], false);
  assert.equal(en[0]?.title, "Commands");
});

test("思考、未知工具与失败标记", () => {
  const groups = groupTrace([
    step({ id: "t1", phase: "think", status: "running" }),
    step({ id: "u1", toolName: "unknown_tool" }),
    step({ id: "e1", toolName: "run_command", status: "error" }),
  ], true);

  assert.deepEqual(groups.map((group) => group.key), ["think", "other", "command"]);
  assert.equal(groups[0]?.title, "思考过程");
  assert.equal(groups[2]?.failed, true);
  assert.equal(groups[1]?.failed, false);
});

test("空输入返回空分组", () => {
  assert.deepEqual(groupTrace([], true), []);
});
