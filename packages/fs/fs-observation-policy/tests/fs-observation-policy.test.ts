// 验证写前必读：已存在文件未读时拦截、读过放行、新建文件放行、会话隔离。
import assert from "node:assert/strict";
import { Context } from "@deepseek-ai/cordis";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { toolsPlugin, type ToolExecutionContext, type ToolExecutionResult } from "@lfaa/tools";
import { installFsObservationPolicy, observationHint, ObservationTracker } from "../src/index";

function execContext(root: string, sessionId = "s1"): ToolExecutionContext {
  return { workspaceRoots: [root], sessionId, runId: "r1", signal: new AbortController().signal };
}

async function setup() {
  const root = await mkdtemp(join(tmpdir(), "lfaa-fs-policy-"));
  const ctx = new Context();
  await ctx.plugin(toolsPlugin, { includeBuiltins: false });
  const calls: string[] = [];
  const register = (name: string, permissionLevel: "read" | "write") => {
    ctx.tools.registerTool({
      moduleName: "test",
      name,
      title: name,
      description: name,
      permissionLevel,
      parameters: { type: "object", properties: { path: { type: "string" } } },
      execute: async (): Promise<ToolExecutionResult> => {
        calls.push(name);
        return { ok: true, output: `${name} ok`, summary: "ok" };
      },
    });
  };
  register("read_file", "read");
  register("write_file", "write");
  register("edit_file", "write");
  const tracker = installFsObservationPolicy(ctx);
  return { ctx, root, calls, tracker };
}

test("已存在文件未读时写入被拦截，提示用 read_file", async () => {
  const { ctx, root } = await setup();
  try {
    await writeFile(join(root, "a.txt"), "hello", "utf8");
    const blocked = await ctx.tools.executeTool("write_file", { path: "a.txt" }, execContext(root));
    assert.equal(blocked.ok, false);
    assert.equal(blocked.metadata?.observationBlocked, true);
    assert.match(blocked.output, /read_file/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("读过之后写入与编辑放行，新建文件无需先读", async () => {
  const { ctx, root, calls } = await setup();
  try {
    await writeFile(join(root, "a.txt"), "hello", "utf8");
    const read = await ctx.tools.executeTool("read_file", { path: "a.txt" }, execContext(root));
    assert.equal(read.ok, true);
    const write = await ctx.tools.executeTool("write_file", { path: "a.txt" }, execContext(root));
    assert.equal(write.ok, true);
    const edit = await ctx.tools.executeTool("edit_file", { path: "a.txt" }, execContext(root));
    assert.equal(edit.ok, true);
    const created = await ctx.tools.executeTool("write_file", { path: "new.txt" }, execContext(root));
    assert.equal(created.ok, true);
    assert.deepEqual(calls, ["read_file", "write_file", "edit_file", "write_file"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("读取按会话隔离，其他会话仍被拦截", async () => {
  const { ctx, root } = await setup();
  try {
    await writeFile(join(root, "a.txt"), "hello", "utf8");
    await ctx.tools.executeTool("read_file", { path: "a.txt" }, execContext(root, "s1"));
    const other = await ctx.tools.executeTool("write_file", { path: "a.txt" }, execContext(root, "s2"));
    assert.equal(other.ok, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("工作区外路径交给工具自身判定，策略不重复拦截", async () => {
  const { ctx, root } = await setup();
  try {
    const outside = await ctx.tools.executeTool("write_file", { path: "../outside.txt" }, execContext(root));
    assert.equal(outside.ok, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("追踪器与提示文案可独立使用", () => {
  const tracker = new ObservationTracker();
  tracker.markRead("s1", "/tmp/a");
  assert.equal(tracker.hasRead("s1", "/tmp/a"), true);
  assert.deepEqual(tracker.listRead("s1"), ["/tmp/a"]);
  tracker.clearSession("s1");
  assert.equal(tracker.hasRead("s1", "/tmp/a"), false);
  assert.match(observationHint("edit_file", "src/a.ts"), /edit_file.*src\/a\.ts.*read_file/u);
});