// 验证沙箱与工具层的集成：只读模式拦截写入与命令，工作区模式放行工作区内写入。
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import { toolsPlugin } from "@lfaa/tools";
import { LocalSandboxEnforcer } from "../src/index";

/** 构造带沙箱的工具上下文；返回执行工具所需的执行上下文。 */
async function setup(mode: "read-only" | "workspace-write") {
  const root = await mkdtemp(join(tmpdir(), "lfaa-sandbox-"));
  const ctx = new Context();
  new LocalSandboxEnforcer(ctx);
  await ctx.plugin(toolsPlugin, { sandbox: ctx.sandbox });
  return {
    root,
    ctx,
    exec: {
      workspaceRoots: [root],
      sessionId: "sandbox-test",
      runId: "sandbox-run",
      signal: new AbortController().signal,
      sandboxMode: mode,
    },
  };
}

test("只读模式下 write_file 与 run_command 被沙箱拒绝", async (t) => {
  const { root, ctx, exec } = await setup("read-only");
  t.after(() => rm(root, { recursive: true, force: true }));

  const write = await ctx.tools.executeTool("write_file", { path: join(root, "a.txt"), content: "x" }, exec);
  assert.equal(write.ok, false);
  assert.match(String(write.output), /只读/);

  const command = await ctx.tools.executeTool("run_command", { command: "echo hi" }, exec);
  assert.equal(command.ok, false);
  assert.match(String(command.output), /只读/);

  // 读取类工具不受影响
  const listing = await ctx.tools.executeTool("list_dir", { path: root }, exec);
  assert.equal(listing.ok, true);
});

test("工作区模式下工作区内写入放行、越界写入被拒绝", async (t) => {
  const { root, ctx, exec } = await setup("workspace-write");
  t.after(() => rm(root, { recursive: true, force: true }));

  const inside = await ctx.tools.executeTool("write_file", { path: join(root, "ok.txt"), content: "ok" }, exec);
  assert.equal(inside.ok, true);

  const outside = await ctx.tools.executeTool("write_file", { path: join(tmpdir(), "lfaa-outside.txt"), content: "no" }, exec);
  assert.equal(outside.ok, false);
  assert.match(String(outside.output), /超出工作区/);
});
