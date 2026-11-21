// 验证任务清单工具：参数校验、整表替换、会话落盘与读取、非法输入不落库。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import { memoryPlugin } from "@lfaa/memory";
import { toolsPlugin, type ToolExecutionContext } from "@lfaa/tools";
import todoPlugin, { normalizeIncomingTodos, summarize, TodoInputError } from "../src/index";

async function setup() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-todo-"));
  const ctx = new Context();
  const toolsFiber = ctx.plugin(toolsPlugin, { includeBuiltins: false });
  await toolsFiber;
  const memoryFiber = ctx.plugin(memoryPlugin, {
    sessionsDir: path.join(root, "sessions"),
    memoryFilePath: path.join(root, "memory.json"),
  });
  await memoryFiber;
  const todoFiber = ctx.plugin(todoPlugin);
  await todoFiber;
  const session = await ctx.memory.createSession({ title: "任务清单测试" });
  return {
    ctx,
    sessionId: session.id,
    cleanup: () => fs.rm(root, { recursive: true, force: true }),
  };
}

function execContext(sessionId: string): ToolExecutionContext {
  return { workspaceRoots: [process.cwd()], sessionId, runId: "run-1", signal: new AbortController().signal };
}

test("清单校验：内容必填、不可重复、同一时刻最多一条进行中", () => {
  const ok = normalizeIncomingTodos([
    { content: " 读源码 ", status: "in_progress" },
    { content: "写测试", status: "pending", id: "t2" },
  ]);
  assert.deepEqual(ok, [
    { id: "读源码", content: "读源码", status: "in_progress" },
    { id: "t2", content: "写测试", status: "pending" },
  ]);

  assert.throws(() => normalizeIncomingTodos([]), TodoInputError);
  assert.throws(() => normalizeIncomingTodos([{ content: "   ", status: "pending" }]), /不能为空/u);
  assert.throws(
    () => normalizeIncomingTodos([{ content: "重复", status: "pending" }, { content: "重复", status: "completed" }]),
    /重复/u,
  );
  assert.throws(() => normalizeIncomingTodos([{ content: "a", status: "doing" }]), /状态非法/u);
  assert.throws(
    () => normalizeIncomingTodos([
      { content: "a", status: "in_progress" },
      { content: "b", status: "in_progress" },
    ]),
    /只能有一条/u,
  );
});

test("统计各状态数量", () => {
  const counts = summarize([
    { id: "a", content: "x", status: "completed" },
    { id: "b", content: "y", status: "in_progress" },
    { id: "c", content: "z", status: "pending" },
  ]);
  assert.deepEqual(counts, { total: 3, completed: 1, inProgress: 1, pending: 1 });
});

test("todo_write 整表替换并写入会话，todo_read 能读回", async () => {
  const { ctx, sessionId, cleanup } = await setup();
  try {
    const written = await ctx.tools.executeTool("todo_write", {
      todos: [
        { content: "读源码", status: "in_progress" },
        { content: "写测试", status: "pending" },
        { content: "跑构建", status: "pending" },
      ],
    }, execContext(sessionId));
    assert.equal(written.ok, true);
    assert.match(written.summary, /共 3 条/u);
    assert.equal((written.metadata?.todos as unknown[]).length, 3);

    // 落盘：换一个服务实例读同一会话目录也能拿到清单（等价于重启 Host）。
    const loaded = await ctx.memory.getSession(sessionId);
    assert.equal(loaded?.todos?.length, 3);
    assert.equal(loaded?.todos?.[0]?.status, "in_progress");

    // 整表替换：只传两项，之前的第三项被删除而不是合并保留。
    const replaced = await ctx.tools.executeTool("todo_write", {
      todos: [
        { content: "读源码", status: "completed" },
        { content: "写测试", status: "in_progress" },
      ],
    }, execContext(sessionId));
    assert.equal(replaced.ok, true);
    const read = await ctx.tools.executeTool("todo_read", {}, execContext(sessionId));
    const payload = JSON.parse(read.output) as { counts: { total: number; completed: number }; todos: Array<{ content: string }> };
    assert.equal(payload.counts.total, 2);
    assert.equal(payload.counts.completed, 1);
    assert.deepEqual(payload.todos.map((item) => item.content), ["读源码", "写测试"]);
  } finally {
    await cleanup();
  }
});

test("非法清单不落库，已有清单保持原样", async () => {
  const { ctx, sessionId, cleanup } = await setup();
  try {
    await ctx.tools.executeTool("todo_write", {
      todos: [{ content: "保持这一条", status: "pending" }],
    }, execContext(sessionId));

    const failed = await ctx.tools.executeTool("todo_write", {
      todos: [
        { content: "a", status: "in_progress" },
        { content: "b", status: "in_progress" },
      ],
    }, execContext(sessionId));
    assert.equal(failed.ok, false);
    assert.match(failed.output, /任务清单参数无效/u);

    const loaded = await ctx.memory.getSession(sessionId);
    assert.deepEqual(loaded?.todos?.map((item) => item.content), ["保持这一条"]);
  } finally {
    await cleanup();
  }
});

test("会话不存在时明确失败，不静默成功", async () => {
  const { ctx, cleanup } = await setup();
  try {
    const result = await ctx.tools.executeTool("todo_write", {
      todos: [{ content: "孤立写入", status: "pending" }],
    }, execContext("not-exist-session"));
    assert.equal(result.ok, false);
    assert.match(result.output, /找不到当前会话/u);
  } finally {
    await cleanup();
  }
});