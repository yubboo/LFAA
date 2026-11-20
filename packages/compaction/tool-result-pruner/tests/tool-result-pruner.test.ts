// 验证结果精简：噪声清理、行列截断标注、按工具覆盖、失败结果不动、中间件链路生效。
import assert from "node:assert/strict";
import { Context } from "@deepseek-ai/cordis";
import test from "node:test";
import { toolsPlugin, type ToolExecutionContext } from "@lfaa/tools";
import toolResultPrunerPlugin, {
  capChars,
  capLines,
  cleanNoise,
  pruneResult,
  resolveLimit,
} from "../src/index";

function execContext(): ToolExecutionContext {
  return { workspaceRoots: [process.cwd()], sessionId: "s1", runId: "r1", signal: new AbortController().signal };
}

test("清理 ANSI、行尾空白与连续空行", () => {
  const noisy = "\u001B[31mred\u001B[0m   \n\n\n\nline  ";
  const cleaned = cleanNoise(noisy);
  assert.equal(cleaned.includes("\u001B"), false);
  assert.equal(cleaned, "red\n\nline");
});

test("按行截断保留首尾并标注省略行数", () => {
  const lines = Array.from({ length: 30 }, (_, index) => `L${index}`).join("\n");
  const capped = capLines(lines, 10);
  assert.match(capped, /中间 20 行已省略/u);
  assert.match(capped, /^L0/u);
  assert.match(capped, /L29$/u);
  assert.equal(capLines("a\nb", 10), "a\nb");
});

test("按字符截断保留首尾并标注省略字符数", () => {
  const capped = capChars("x".repeat(1000), 100);
  assert.match(capped, /中间 900 个字符已省略/u);
  assert.equal(capped.length < 200, true);
  assert.equal(capChars("short", 100), "short");
});

test("按工具覆盖阈值，非法值回落默认", () => {
  assert.deepEqual(resolveLimit("read_file", { byTool: { read_file: { maxLines: 50 } } }), { maxLines: 50, maxChars: 40_000 });
  assert.deepEqual(resolveLimit("grep", { maxLines: 0, maxChars: -1 }), { maxLines: 1_200, maxChars: 40_000 });
});

test("失败结果保持原样，成功结果被标记精简", () => {
  const failed = { ok: false, output: "x".repeat(100), summary: "bad" };
  assert.equal(pruneResult(failed, "run_command", { maxChars: 10 }), failed);
  const ok = { ok: true, output: "y".repeat(100), summary: "ok" };
  const pruned = pruneResult(ok, "read_file", { maxChars: 20 });
  assert.equal(pruned.metadata?.pruned, true);
  assert.match(pruned.output, /已省略/u);
  assert.match(pruned.summary, /已精简/u);
});

test("中间件在真实执行链路上生效", async () => {
  const ctx = new Context();
  await ctx.plugin(toolsPlugin, { includeBuiltins: false });
  ctx.tools.registerTool({
    moduleName: "test",
    name: "noisy_tool",
    title: "噪声工具",
    description: "测试用",
    permissionLevel: "read",
    parameters: { type: "object", properties: {} },
    execute: async () => ({
      ok: true,
      output: `\u001B[32m${"A".repeat(500)}\u001B[0m`,
      summary: "ok",
    }),
  });
  await ctx.plugin(toolResultPrunerPlugin, { maxChars: 100 });
  const result = await ctx.tools.executeTool("noisy_tool", {}, execContext());
  assert.equal(result.metadata?.pruned, true);
  assert.equal(result.output.includes("\u001B"), false);
  assert.match(result.output, /已省略/u);
});