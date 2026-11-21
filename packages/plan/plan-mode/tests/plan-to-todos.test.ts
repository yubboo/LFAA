// 验证计划文本转任务清单：分步才建清单、写入会话、单行计划不落库、会话缺失不报错。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import { memoryPlugin } from "@lfaa/memory";
import { toolsPlugin, type ToolExecutionContext } from "@lfaa/tools";
import planModePlugin, { PLAN_TODO_LIMIT, planToTodos } from "../src/index";

async function setup() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-plan-todos-"));
  const ctx = new Context();
  await ctx.plugin(toolsPlugin, { includeBuiltins: false });
  await ctx.plugin(memoryPlugin, {
    sessionsDir: path.join(dir, "sessions"),
    memoryFilePath: path.join(dir, "memory.json"),
  });
  await ctx.plugin(planModePlugin, {});
  const session = await ctx.memory.createSession({ title: "计划转清单" });
  return { ctx, sessionId: session.id, cleanup: () => fs.rm(dir, { recursive: true, force: true }) };
}

function exec(sessionId: string): ToolExecutionContext {
  return { workspaceRoots: [process.cwd()], sessionId, runId: "r1", signal: new AbortController().signal };
}

test("计划文本按行转条目，去掉序号与列表符号，超过上限截断", () => {
  const todos = planToTodos("1. 读现有实现\n- 补测试\n* 跑构建");
  assert.deepEqual(todos, [
    { id: "1", content: "读现有实现", status: "pending" },
    { id: "2", content: "补测试", status: "pending" },
    { id: "3", content: "跑构建", status: "pending" },
  ]);
  assert.deepEqual(planToTodos("只有一句话的计划"), []);
  assert.deepEqual(planToTodos(""), []);
  const many = Array.from({ length: PLAN_TODO_LIMIT + 5 }, (_, index) => `步骤 ${index}`).join("\n");
  assert.equal(planToTodos(many).length, PLAN_TODO_LIMIT);
});

test("退出计划模式时把分步计划写进会话清单", async () => {
  const { ctx, sessionId, cleanup } = await setup();
  try {
    await ctx.tools.executeTool("plan_mode_enter", { objective: "重构模块" }, exec(sessionId));
    const exit = await ctx.tools.executeTool("plan_mode_exit", {
      plan: "1. 读现有实现\n2. 拆出服务\n3. 补回归测试",
    }, exec(sessionId));
    assert.equal(exit.ok, true);
    assert.match(exit.output, /已把计划转为 3 条任务清单/u);
    assert.equal((exit.metadata?.todos as unknown[]).length, 3);

    const session = await ctx.memory.getSession(sessionId);
    assert.deepEqual(session?.todos?.map((item) => item.content), ["读现有实现", "拆出服务", "补回归测试"]);
    assert.equal(session?.todos?.[0]?.status, "pending");
  } finally {
    await cleanup();
  }
});

test("单行计划不建清单，原有清单保持不变", async () => {
  const { ctx, sessionId, cleanup } = await setup();
  try {
    await ctx.memory.updateSession(sessionId, { todos: [{ id: "old", content: "原任务", status: "pending" }] });
    await ctx.tools.executeTool("plan_mode_enter", { objective: "看看" }, exec(sessionId));
    const exit = await ctx.tools.executeTool("plan_mode_exit", { plan: "先读一遍代码" }, exec(sessionId));
    assert.equal(exit.ok, true);
    assert.match(exit.output, /先读一遍代码/u);
    assert.doesNotMatch(exit.output, /任务清单/u);
    const session = await ctx.memory.getSession(sessionId);
    assert.deepEqual(session?.todos?.map((item) => item.content), ["原任务"]);
  } finally {
    await cleanup();
  }
});

test("会话不存在时仍正常退出，不抛错", async () => {
  const { ctx, cleanup } = await setup();
  try {
    await ctx.tools.executeTool("plan_mode_enter", { objective: "目标" }, exec("ghost-session"));
    const exit = await ctx.tools.executeTool("plan_mode_exit", { plan: "一\n二" }, exec("ghost-session"));
    assert.equal(exit.ok, true);
  } finally {
    await cleanup();
  }
});