// 验证逐次沙箱策略：模式解析、写入/命令按模式拦截、只对配置的工具生效。
import assert from "node:assert/strict";
import { Context } from "@deepseek-ai/cordis";
import test from "node:test";
import { toolsPlugin, type ToolExecutionContext, type ToolExecutionResult } from "@lfaa/tools";
import type { SandboxDecision, SandboxPolicy } from "../src/seam";
import sandboxPolicyPlugin, { createSandboxPolicy, resolveSandboxMode } from "../src/policy";

function execContext(): ToolExecutionContext {
  return { workspaceRoots: [process.cwd()], sessionId: "s1", runId: "r1", signal: new AbortController().signal, sandboxMode: "workspace-write" };
}

/** 只读模式一律拒绝写入与命令，其余放行；用于验证策略确实影响判定。 */
const readonlySandbox = {
  checkWrite: (_target: string, policy: SandboxPolicy): SandboxDecision => policy.mode === "read-only"
    ? { allowed: false, reason: "只读模式禁止写入" }
    : { allowed: true },
  checkCommand: (_command: string, policy: SandboxPolicy): SandboxDecision => policy.mode === "read-only"
    ? { allowed: false, reason: "只读模式禁止执行命令" }
    : { allowed: true },
};

function registerTools(ctx: Context): void {
  const tool = (name: string, permissionLevel: "read" | "write" | "exec") => ctx.tools.registerTool({
    moduleName: "test",
    name,
    title: name,
    description: name,
    permissionLevel,
    parameters: { type: "object", properties: { path: { type: "string" }, command: { type: "string" } } },
    execute: async (): Promise<ToolExecutionResult> => ({ ok: true, output: "ran", summary: "ok" }),
  });
  tool("read_file", "read");
  tool("write_file", "write");
  tool("run_command", "exec");
}

test("模式解析：按工具覆盖优先，onlyTools 限定范围", () => {
  assert.equal(resolveSandboxMode("write_file", { mode: "read-only" }), "read-only");
  assert.equal(resolveSandboxMode("write_file", { mode: "workspace-write", byTool: { write_file: "read-only" } }), "read-only");
  assert.equal(resolveSandboxMode("read_file", { mode: "read-only", onlyTools: ["write_file"] }), undefined);
  assert.equal(resolveSandboxMode("run_command", {}), undefined);
  assert.equal(typeof createSandboxPolicy({ mode: "read-only" }), "function");
});

test("只读策略让写入被沙箱拒绝，只读工具不受影响", async () => {
  const ctx = new Context();
  await ctx.plugin(toolsPlugin, { includeBuiltins: false, sandbox: readonlySandbox });
  registerTools(ctx);
  await ctx.plugin(sandboxPolicyPlugin, { mode: "read-only" });

  const write = await ctx.tools.executeTool("write_file", { path: "a.txt" }, execContext());
  assert.equal(write.ok, false);
  assert.match(write.summary, /沙箱拒绝/u);
  const read = await ctx.tools.executeTool("read_file", { path: "a.txt" }, execContext());
  assert.equal(read.ok, true);
});

test("按工具覆盖只锁命令，不影响写入", async () => {
  const ctx = new Context();
  await ctx.plugin(toolsPlugin, { includeBuiltins: false, sandbox: readonlySandbox });
  registerTools(ctx);
  await ctx.plugin(sandboxPolicyPlugin, { mode: "workspace-write", byTool: { run_command: "read-only" } });

  const command = await ctx.tools.executeTool("run_command", { command: "echo hi" }, execContext());
  assert.equal(command.ok, false);
  const write = await ctx.tools.executeTool("write_file", { path: "a.txt" }, execContext());
  assert.equal(write.ok, true);
});

test("未挂策略时沿用调用方模式，不受影响", async () => {
  const ctx = new Context();
  await ctx.plugin(toolsPlugin, { includeBuiltins: false, sandbox: readonlySandbox });
  registerTools(ctx);
  const write = await ctx.tools.executeTool("write_file", { path: "a.txt" }, execContext());
  assert.equal(write.ok, true);
});