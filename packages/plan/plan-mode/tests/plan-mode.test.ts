// 验证计划模式：进入后写/执行工具被拦截、只读仍可用、退出恢复、会话之间互不影响。
import assert from "node:assert/strict";
import { Context } from "@deepseek-ai/cordis";
import test from "node:test";
import { toolsPlugin, type ToolExecutionContext, type ToolExecutionResult } from "@lfaa/tools";
import planModePlugin, { blockedMessage, installPlanMode } from "../src/index";

async function setup() {
  const ctx = new Context();
  await ctx.plugin(toolsPlugin, { includeBuiltins: false });
  const calls: string[] = [];
  const register = (name: string, permissionLevel: "read" | "write" | "exec") => {
    ctx.tools.registerTool({
      moduleName: "test",
      name,
      title: name,
      description: name,
      permissionLevel,
      parameters: { type: "object", properties: {} },
      execute: async (): Promise<ToolExecutionResult> => {
        calls.push(name);
        return { ok: true, output: `${name} ok`, summary: "ok" };
      },
    });
  };
  register("read_something", "read");
  register("write_something", "write");
  register("exec_something", "exec");
  const service = installPlanMode(ctx);
  return { ctx, calls, service };
}

function execContext(sessionId = "s1"): ToolExecutionContext {
  return { workspaceRoots: [process.cwd()], sessionId, runId: "r1", signal: new AbortController().signal };
}

test("进入计划模式后写与执行工具被拦截，只读工具照常执行", async () => {
  const { ctx } = await setup();
  await ctx.tools.executeTool("plan_mode_enter", { objective: "目标" }, execContext());
  const write = await ctx.tools.executeTool("write_something", {}, execContext());
  assert.equal(write.ok, false);
  assert.equal(write.metadata?.planModeBlocked, true);
  assert.match(write.output, /计划模式/u);
  assert.match(write.output, /plan_mode_exit/u);

  const exec = await ctx.tools.executeTool("exec_something", {}, execContext());
  assert.equal(exec.ok, false);

  const read = await ctx.tools.executeTool("read_something", {}, execContext());
  assert.equal(read.ok, true);
});

test("退出计划模式后恢复写工具，摘要回显在输出里", async () => {
  const { ctx } = await setup();
  await ctx.tools.executeTool("plan_mode_enter", { objective: "目标" }, execContext());
  const exit = await ctx.tools.executeTool("plan_mode_exit", { plan: "先读后写" }, execContext());
  assert.equal(exit.ok, true);
  assert.match(exit.output, /先读后写/u);
  const write = await ctx.tools.executeTool("write_something", {}, execContext());
  assert.equal(write.ok, true);
});

test("计划模式按会话隔离，未进入的会话不受影响", async () => {
  const { ctx } = await setup();
  await ctx.tools.executeTool("plan_mode_enter", { objective: "目标" }, execContext("s1"));
  const other = await ctx.tools.executeTool("write_something", {}, execContext("s2"));
  assert.equal(other.ok, true);
  const status = await ctx.tools.executeTool("plan_mode_status", {}, execContext("s1"));
  assert.equal(status.ok, true);
  assert.match(status.output, /目标/u);
});

test("拦截文案说明退出方式，服务可枚举会话", async () => {
  const { service } = await setup();
  service.enter("s9", "重构");
  assert.deepEqual(service.listSessions(), ["s9"]);
  assert.match(blockedMessage("write_file", "重构"), /plan_mode_exit/u);
  service.exit("s9");
  assert.equal(service.isPlanning("s9"), false);
});

test("插件对象带 inject 声明，可直接交给 Loader", () => {
  const inject = planModePlugin.inject;
  assert.ok(Array.isArray(inject) && inject.includes("tools"));
  assert.equal(planModePlugin.name, "lfaa-plan-mode");
});