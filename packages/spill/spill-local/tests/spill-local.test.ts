// 验证长结果落盘：短结果不动、长结果写文件并只回窗口，文件名与元数据正确。
import assert from "node:assert/strict";
import { Context } from "@deepseek-ai/cordis";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { toolsPlugin, type ToolExecutionContext } from "@lfaa/tools";
import { buildSpillWindow, shouldSpill, spillFileName, spillLocalPlugin } from "../src/index";

function execContext(): ToolExecutionContext {
  return { workspaceRoots: [process.cwd()], sessionId: "s1", runId: "r1", signal: new AbortController().signal };
}

test("阈值判断与窗口拼接", () => {
  assert.equal(shouldSpill("abc", 3), false);
  assert.equal(shouldSpill("abcd", 3), true);
  assert.equal(buildSpillWindow("x".repeat(100), 10, 5).includes("中间 85 个字符已省略"), true);
  assert.equal(buildSpillWindow("short", 10, 5), "short");
});

test("文件名只保留安全字符", () => {
  assert.match(spillFileName("run_command/../x", 1700000000000, "abcd1234"), /^1700000000000-run_command-\.\.-x-abcd1234\.txt$/u);
  assert.match(spillFileName("!!", 1, "abcdefgh"), /^1-tool-abcdefgh\.txt$/u);
});

test("长输出落盘并只回首尾窗口，短输出原样通过", async () => {
  const root = await mkdtemp(join(tmpdir(), "lfaa-spill-"));
  try {
    const ctx = new Context();
    await ctx.plugin(toolsPlugin, { includeBuiltins: false });
    ctx.tools.registerTool({
      moduleName: "test",
      name: "big_tool",
      title: "大输出",
      description: "测试用",
      permissionLevel: "read",
      parameters: { type: "object", properties: {} },
      execute: async () => ({ ok: true, output: `${"A".repeat(300)}END`, summary: "ok" }),
    });
    spillLocalPlugin(ctx, { root, maxChars: 100, headChars: 20, tailChars: 10 });

    const spilled = await ctx.tools.executeTool("big_tool", {}, execContext());
    assert.equal(spilled.metadata?.spilled, true);
    assert.match(spilled.output, /已省略/u);
    assert.match(spilled.output, /read_file/u);
    const files = await readdir(join(root, "s1"));
    assert.equal(files.length, 1);
    const saved = await readFile(join(root, "s1", files[0]!), "utf8");
    assert.equal(saved.length, 303);
    assert.equal(saved, `${"A".repeat(300)}END`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});