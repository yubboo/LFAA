// 验证超时策略：超时返回可读结果并中止信号，快工具原样通过，父级取消向内传递。
import assert from "node:assert/strict";
import { Context } from "@deepseek-ai/cordis";
import test from "node:test";
import { toolsPlugin, type ToolExecutionContext, type ToolExecutionResult } from "@lfaa/tools";
import { resolveTimeoutMs, timeoutResult, timeoutPolicyPlugin } from "../src/index";

function execContext(signal = new AbortController().signal): ToolExecutionContext {
  return { workspaceRoots: [process.cwd()], sessionId: "s1", runId: "r1", signal };
}

function registerSlowTool(ctx: Context, delayMs: number, seen: { aborted: boolean }): void {
  ctx.tools.registerTool({
    moduleName: "test",
    name: "slow_tool",
    title: "慢工具",
    description: "测试用",
    permissionLevel: "read",
    parameters: { type: "object", properties: {} },
    execute: async (_args, context): Promise<ToolExecutionResult> => {
      context.signal.addEventListener("abort", () => { seen.aborted = true; }, { once: true });
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return { ok: true, output: "done", summary: "ok" };
    },
  });
}

test("按工具覆盖优先，非法值回落默认", () => {
  assert.equal(resolveTimeoutMs("run_command", { byTool: { run_command: 1234 } }), 1234);
  assert.equal(resolveTimeoutMs("read_file", { byTool: { run_command: 1234 }, defaultTimeoutMs: 5000 }), 5000);
  assert.equal(resolveTimeoutMs("read_file", { defaultTimeoutMs: 0 }), 10 * 60_000);
});

test("超时返回可读失败结果，并中止该次执行的信号", async () => {
  const ctx = new Context();
  await ctx.plugin(toolsPlugin, { includeBuiltins: false });
  const seen = { aborted: false };
  registerSlowTool(ctx, 120, seen);
  timeoutPolicyPlugin(ctx, { defaultTimeoutMs: 20 });
  const result = await ctx.tools.executeTool("slow_tool", {}, execContext());
  assert.equal(result.ok, false);
  assert.equal(result.metadata?.timedOut, true);
  assert.match(result.output, /执行超过/u);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(seen.aborted, true);
});

test("未超时的工具原样返回结果", async () => {
  const ctx = new Context();
  await ctx.plugin(toolsPlugin, { includeBuiltins: false });
  registerSlowTool(ctx, 5, { aborted: false });
  timeoutPolicyPlugin(ctx, { defaultTimeoutMs: 500 });
  const result = await ctx.tools.executeTool("slow_tool", {}, execContext());
  assert.deepEqual(result, { ok: true, output: "done", summary: "ok" });
});

test("父级取消时不再发起执行，超时结果结构稳定", async () => {
  const ctx = new Context();
  await ctx.plugin(toolsPlugin, { includeBuiltins: false });
  registerSlowTool(ctx, 5, { aborted: false });
  timeoutPolicyPlugin(ctx, { defaultTimeoutMs: 500 });
  const controller = new AbortController();
  controller.abort();
  const result = await ctx.tools.executeTool("slow_tool", {}, execContext(controller.signal));
  assert.equal(result.ok, false);
  assert.match(result.output, /已被取消/u);
  assert.equal(timeoutResult("x", 1000).metadata?.timeoutMs, 1000);
});