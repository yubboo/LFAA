// 验证多步活动摘要：用真实动作和对象说明这一轮做了什么，不再出现「N 项操作」这类空话。
import assert from "node:assert/strict";
import test from "node:test";
import { summarizeActivityGroup } from "../client/conversation/activity-label";
import type { AgentStepItem } from "../client/store/chat-types";

function step(overrides: Partial<AgentStepItem>): AgentStepItem {
  return { id: "s", iteration: 1, phase: "act", status: "done", title: "行动", timestamp: 1, ...overrides };
}

function read(id: string, path: string, status: AgentStepItem["status"] = "done"): AgentStepItem {
  return step({ id, toolName: "read_file", toolTarget: path, status });
}

test("未登记工具在并列摘要里用正式动作名，不出现「已完成：」前缀", () => {
  assert.equal(
    summarizeActivityGroup([
      step({ id: "edit", toolName: "edit_file", fileChange: { path: "/w/c.ts" } as never }),
      step({ id: "web", toolName: "fetch_url" }),
    ], true),
    "已编辑 · 网页抓取",
  );
});

test("单步摘要用小圆点隔开动作与对象，命令再带上真实命令行", () => {
  assert.equal(summarizeActivityGroup([read("a", "/w/workspace/src/a.ts")], true), "已读取 · a.ts");
  assert.equal(
    summarizeActivityGroup([step({ toolName: "run_command", commandTrace: { command: "npm run build" } })], true),
    "已运行命令 · npm run build",
  );
});

test("同类多步直接点名对象，对象之间保持顿号", () => {
  const summary = summarizeActivityGroup([
    read("a", "/w/workspace/src/a.ts"),
    read("b", "/w/workspace/src/b.ts"),
  ], true);
  assert.equal(summary, "已读取 · a.ts、b.ts");
  assert.doesNotMatch(summary ?? "", /项操作/u);
});

test("同类动作超过三个改为报数量，并保留可读量词", () => {
  const paths = ["a", "b", "c", "d"].map((name, index) => read(`r${index}`, `/w/${name}.ts`));
  assert.equal(summarizeActivityGroup(paths, true), "已读取 4 个文件");
  assert.equal(summarizeActivityGroup(paths, false), "Read 4 files");
});

test("混合动作用小圆点并列，三种以上用「等」收尾", () => {
  assert.equal(
    summarizeActivityGroup([
      step({ id: "cmd", toolName: "run_command" }),
      read("a", "/w/a.ts"),
      read("b", "/w/b.ts"),
    ], true),
    "已运行命令 · 已读取 2 个文件",
  );
  const many = summarizeActivityGroup([
    step({ id: "cmd", toolName: "run_command" }),
    read("a", "/w/a.ts"),
    step({ id: "edit", toolName: "edit_file", fileChange: { path: "/w/c.ts" } as never }),
    step({ id: "web", toolName: "fetch_url" }),
  ], true);
  assert.equal(many, "已运行命令 · 已读取 · 已编辑 等");
});

test("运行中的动作只报进行态，不提前说完成", () => {
  assert.equal(
    summarizeActivityGroup([read("a", "/w/a.ts"), read("b", "/w/b.ts", "running")], true),
    "正在读取中",
  );
});

test("失败动作退回中性主体名，和失败徽标保持一致", () => {
  assert.equal(summarizeActivityGroup([step({ toolName: "fetch_url", status: "error" })], true), "网页抓取");
  assert.equal(
    summarizeActivityGroup([
      step({ id: "e1", toolName: "run_command", status: "error" }),
      step({ id: "e2", toolName: "run_command", status: "error" }),
    ], true),
    "运行命令",
  );
});

test("英文使用小圆点并列，且不出现中文标点", () => {
  const summary = summarizeActivityGroup([
    step({ id: "cmd", toolName: "run_command" }),
    read("a", "/w/a.ts"),
  ], false);
  assert.equal(summary, "Ran command · Read");
  assert.doesNotMatch(summary ?? "", /、/u);
});

test("空轮次没有摘要，交由调用方回退到模型阶段", () => {
  assert.equal(summarizeActivityGroup([], true), undefined);
});