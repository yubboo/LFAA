// 验证活动与阶段文案：负责人指定的 19 条中文状态短语必须逐条对应真实状态，且不暴露内部工具名。
import assert from "node:assert/strict";
import test from "node:test";
import { describeStep, getActivityLabel, getLiveStage } from "../client/conversation/activity-label";
import { timelineMessages } from "../client/locales";
import type { AgentStepItem } from "../client/store/chat-types";

function step(overrides: Partial<AgentStepItem>): AgentStepItem {
  return {
    id: "act-1",
    iteration: 1,
    phase: "act",
    status: "done",
    title: "调用工具",
    toolName: "fetch_url",
    timestamp: 1,
    ...overrides,
  } as AgentStepItem;
}

const zh = timelineMessages.zh;

test("负责人指定的状态短语逐条存在并对应真实状态", () => {
  // 文件读取 / 编辑 / 创建 / 删除
  assert.match(getActivityLabel(step({ toolName: "edit_file", status: "done" }), true), /^已编辑/u);
  assert.match(getActivityLabel(step({ toolName: "edit_file", status: "running" }), true), /^正在编辑中/u);
  assert.match(getActivityLabel(step({ toolName: "read_file", status: "done" }), true), /^已读取/u);
  assert.match(getActivityLabel(step({ toolName: "read_file", status: "running" }), true), /^正在读取中/u);
  assert.match(getActivityLabel(step({ toolName: "create_file", status: "running" }), true), /^正在创建中/u);
  assert.match(getActivityLabel(step({ toolName: "create_file", status: "done" }), true), /^已创建/u);
  assert.match(getActivityLabel(step({ toolName: "delete_file", status: "running" }), true), /^删除中/u);
  assert.match(getActivityLabel(step({ toolName: "delete_file", status: "done" }), true), /^已删除/u);
  // 命令运行
  assert.match(getActivityLabel(step({ toolName: "run_command", status: "running" }), true), /^正在运行命令/u);
  assert.match(zh.runningCommand, /^运行命令中/u);
  // 思考 / 分析
  assert.equal(zh.thinking, "正在思考");
  assert.equal(zh.reasoning, "深度思考");
  assert.equal(zh.exploring, "正在分析");
  assert.equal(zh.thought, "已分析");
  assert.equal(zh.checking, "检查中");
  assert.equal(describeStep(step({ phase: "think", status: "running", title: "", detail: "" }), true), "思考中");
  assert.equal(describeStep(step({ phase: "think", status: "done", title: "", detail: "" }), true), "已分析");
  assert.equal(describeStep(step({ phase: "check", status: "running" }), true), "检查中");
  assert.equal(describeStep(step({ phase: "check", status: "done" }), true), "已分析");
  // 运行阶段
  assert.equal(zh.executing, "正在运行");
  // 准备调用：浏览器与其他工具
  assert.equal(getActivityLabel(step({ toolName: "browser_navigate", status: "preparing" }), true), "准备调用内置浏览器");
  assert.equal(getActivityLabel(step({ toolName: "fetch_url", status: "preparing" }), true), "准备调用网页抓取工具");
});

test("实时阶段映射：思考 / 深度思考 / 正在分析 / 正在运行 / 检查中 / 已分析", () => {
  const now = Date.now();
  const base = { id: "s", iteration: 1, title: "", timestamp: now } as unknown as AgentStepItem;
  const thinkRunning = { ...base, phase: "think", status: "running" } as AgentStepItem;
  assert.equal(zh[getLiveStage([thinkRunning], now) as keyof typeof zh], "正在思考");
  const reasoning = { ...thinkRunning, modelStage: "reasoning" } as AgentStepItem;
  assert.equal(zh[getLiveStage([reasoning], now) as keyof typeof zh], "深度思考");
  const readAct = { ...base, phase: "act", status: "running", permissionLevel: "read" } as AgentStepItem;
  assert.equal(zh[getLiveStage([readAct], now) as keyof typeof zh], "正在分析");
  const writeAct = { ...base, phase: "act", status: "running", permissionLevel: "write" } as AgentStepItem;
  assert.equal(zh[getLiveStage([writeAct], now) as keyof typeof zh], "正在运行");
  const checking = { ...base, phase: "check", status: "running" } as AgentStepItem;
  assert.equal(zh[getLiveStage([checking], now) as keyof typeof zh], "检查中");
  // 完成后由时间线取 thought 文案（已分析），不再走实时阶段。
  assert.equal(zh.thought, "已分析");
});

test("失败状态与摘要文案正式化", () => {
  assert.equal(getActivityLabel(step({ status: "error" }), true), "执行失败：网页抓取");
  assert.equal(timelineMessages.zh.commandFailed, "失败");
  assert.equal(timelineMessages.zh.modelFailed, "模型请求失败");
  assert.equal(timelineMessages.zh.failures(2), "2 项执行失败");
  assert.equal(timelineMessages.en.commandFailed, "Failed");
  assert.equal(timelineMessages.en.modelFailed, "Model request failed");
  assert.equal(timelineMessages.en.failures(2), "2 failed");
});

test("未登记工具使用正式显示名，不直接暴露内部工具名", () => {
  const done = getActivityLabel(step({ status: "done" }), true);
  assert.equal(done, "已完成：网页抓取");
  assert.doesNotMatch(done, /fetch_url/u);
  assert.equal(getActivityLabel(step({ status: "running" }), true), "正在运行：网页抓取");
  assert.equal(getActivityLabel(step({ status: "error" }), false), "Failed: web fetch");
});